import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { TOILET_CATALOG } from '../data';
import {
  playBossAppearsSound,
  playCoinStreakSound,
  playLowHpHeartbeatSound,
  playNewToiletRevealSound,
  playPerfectFlushSound,
  playWaveCompleteSound
} from '../utils/audio';

type JuiceToastKind = 'coins' | 'flush' | 'toilet' | 'boss' | 'hp' | 'wave';

type JuiceToast = {
  id: number;
  kind: JuiceToastKind;
  icon: string;
  title: string;
  detail: string;
};

const COIN_STREAK_TARGET = 5;
const COIN_STREAK_WINDOW_MS = 2600;
const TOAST_DURATION_MS = 2900;

const getCookieValue = (name: string) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()\[\]\\/+^]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const getCurrentProfile = () => {
  return getCookieValue('poop_quest_current_user') || localStorage.getItem('poop_quest_current_user') || 'Guest Player';
};

const parseNumber = (value: string | null) => {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseArray = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const getToiletName = (id: string) => TOILET_CATALOG.find((toilet) => toilet.id === id)?.name || 'Unknown Toilet';

const extractNumberFromText = (text: string, regex: RegExp) => {
  const match = text.match(regex);
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
};

const toastStyles: Record<JuiceToastKind, string> = {
  coins: 'border-yellow-300/40 bg-yellow-400/15 text-yellow-100 shadow-yellow-900/25',
  flush: 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100 shadow-cyan-900/25',
  toilet: 'border-fuchsia-300/40 bg-fuchsia-400/15 text-fuchsia-100 shadow-fuchsia-900/25',
  boss: 'border-red-300/40 bg-red-500/15 text-red-100 shadow-red-950/35',
  hp: 'border-rose-300/40 bg-rose-500/15 text-rose-100 shadow-rose-950/35',
  wave: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100 shadow-emerald-900/25'
};

export default function JuiceLayerGate({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<JuiceToast[]>([]);
  const profileRef = useRef<string>(getCurrentProfile());
  const lastCoinCountRef = useRef<number | null>(null);
  const coinBurstRef = useRef({ count: 0, expiresAt: 0 });
  const lastCoinStreakSoundRef = useRef(0);
  const unlockedRef = useRef<string[] | null>(null);
  const lastWaveRef = useRef<number | null>(null);
  const lastHpWarningRef = useRef(0);
  const lastKillsRef = useRef<number | null>(null);
  const lastPerfectFlushRef = useRef(0);

  const pushToast = (toast: Omit<JuiceToast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, TOAST_DURATION_MS);
  };

  useEffect(() => {
    const resetBaselinesForProfile = (profile: string) => {
      profileRef.current = profile;
      lastCoinCountRef.current = parseNumber(localStorage.getItem(`poop_quest_coins_${profile}`));
      unlockedRef.current = parseArray(localStorage.getItem(`poop_quest_unlocked_${profile}`));
      coinBurstRef.current = { count: 0, expiresAt: 0 };
      lastWaveRef.current = null;
      lastKillsRef.current = null;
    };

    resetBaselinesForProfile(profileRef.current);

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const profile = getCurrentProfile();

      if (profile !== profileRef.current) {
        resetBaselinesForProfile(profile);
        return;
      }

      const nextCoins = parseNumber(localStorage.getItem(`poop_quest_coins_${profile}`));
      const previousCoins = lastCoinCountRef.current;

      if (previousCoins !== null && nextCoins > previousCoins) {
        const delta = nextCoins - previousCoins;
        const burst = coinBurstRef.current;
        const nextBurstCount = now <= burst.expiresAt ? burst.count + delta : delta;

        coinBurstRef.current = {
          count: nextBurstCount,
          expiresAt: now + COIN_STREAK_WINDOW_MS
        };

        if (nextBurstCount >= COIN_STREAK_TARGET && now - lastCoinStreakSoundRef.current > 2200) {
          lastCoinStreakSoundRef.current = now;
          coinBurstRef.current = { count: 0, expiresAt: now + COIN_STREAK_WINDOW_MS };
          playCoinStreakSound();
          pushToast({
            kind: 'coins',
            icon: '🪙',
            title: `${nextBurstCount}-coin streak!`,
            detail: 'Rising pitch reward activated.'
          });
        }
      }
      lastCoinCountRef.current = nextCoins;

      const nextUnlocked = parseArray(localStorage.getItem(`poop_quest_unlocked_${profile}`));
      const previousUnlocked = unlockedRef.current;

      if (previousUnlocked && nextUnlocked.length > previousUnlocked.length) {
        const added = nextUnlocked.filter((id) => !previousUnlocked.includes(id));
        const unlockedName = added.length > 0 ? getToiletName(added[added.length - 1]) : 'New Toilet';

        playNewToiletRevealSound();
        pushToast({
          kind: 'toilet',
          icon: '🚽',
          title: 'New toilet revealed!',
          detail: unlockedName
        });
      }
      unlockedRef.current = nextUnlocked;

      const pageText = document.body.innerText || '';
      const currentWave = extractNumberFromText(pageText, /\bWave\s*[:#-]?\s*(\d{1,3})\b/i);

      if (currentWave !== null) {
        if (lastWaveRef.current === null) {
          lastWaveRef.current = currentWave;
        } else if (currentWave > lastWaveRef.current) {
          playWaveCompleteSound();
          pushToast({
            kind: 'wave',
            icon: '🏁',
            title: `Wave ${lastWaveRef.current} cleared!`,
            detail: `Wave ${currentWave} is live.`
          });

          if (currentWave % 5 === 0) {
            playBossAppearsSound();
            pushToast({
              kind: 'boss',
              icon: '🚨',
              title: 'Boss pressure rising!',
              detail: `Wave ${currentWave} is a danger spike.`
            });
          }

          lastWaveRef.current = currentWave;
        }
      }

      const currentHp = extractNumberFromText(pageText, /\b(?:HP|Health)\s*[:#-]?\s*(\d{1,3})\b/i);
      if (currentHp !== null && currentHp > 0 && currentHp <= 30 && now - lastHpWarningRef.current > 6500) {
        lastHpWarningRef.current = now;
        playLowHpHeartbeatSound();
        pushToast({
          kind: 'hp',
          icon: '❤️',
          title: 'Low HP!',
          detail: 'Move fast and look for fruit or space.'
        });
      }

      const currentKills = extractNumberFromText(pageText, /\b(?:Kills?|Flushed)\s*[:#-]?\s*(\d{1,4})\b/i);
      if (currentKills !== null) {
        if (lastKillsRef.current === null) {
          lastKillsRef.current = currentKills;
        } else {
          const killDelta = currentKills - lastKillsRef.current;
          if (killDelta >= 3 && now - lastPerfectFlushRef.current > 3200) {
            lastPerfectFlushRef.current = now;
            playPerfectFlushSound();
            pushToast({
              kind: 'flush',
              icon: '💥',
              title: 'Perfect flush!',
              detail: `${killDelta} enemies cleared in one burst.`
            });
          }
          lastKillsRef.current = currentKills;
        }
      }
    }, 600);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed right-3 top-20 z-[90] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl animate-scale-up ${toastStyles[toast.kind]}`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl leading-none drop-shadow">{toast.icon}</div>
              <div>
                <div className="text-sm font-black uppercase tracking-wide">{toast.title}</div>
                <div className="mt-0.5 text-xs font-bold text-slate-100/80">{toast.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
