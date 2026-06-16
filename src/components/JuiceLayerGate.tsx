import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { TOILET_CATALOG } from '../data';
import {
  playBossAppearsSound,
  playCoinStreakSound,
  playNewToiletRevealSound,
  playWaveCompleteSound
} from '../utils/audio';

type JuiceToastKind = 'coins' | 'toilet' | 'boss' | 'wave';

type JuiceToast = {
  id: number;
  kind: JuiceToastKind;
  icon: string;
  title: string;
  detail: string;
};

type WaveDirectorDetail = {
  reason?: string;
  currentWave?: number;
};

const COIN_STREAK_TARGET = 5;
const COIN_STREAK_WINDOW_MS = 2600;
const TOAST_DURATION_MS = 2600;
const STORAGE_SCAN_MS = 2200;

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

const toastStyles: Record<JuiceToastKind, string> = {
  coins: 'border-yellow-300/40 bg-yellow-400/15 text-yellow-100 shadow-yellow-900/25',
  toilet: 'border-fuchsia-300/40 bg-fuchsia-400/15 text-fuchsia-100 shadow-fuchsia-900/25',
  boss: 'border-red-300/40 bg-red-500/15 text-red-100 shadow-red-950/35',
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

  const pushToast = (toast: Omit<JuiceToast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-1), { ...toast, id }]);
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
    };

    resetBaselinesForProfile(profileRef.current);

    const handleWaveUpdate = (event: Event) => {
      const detail = (event as CustomEvent<WaveDirectorDetail>).detail || {};
      const currentWave = Number(detail.currentWave);
      if (!Number.isFinite(currentWave) || currentWave < 1) return;

      if (lastWaveRef.current === null) {
        lastWaveRef.current = currentWave;
        return;
      }

      if (currentWave > lastWaveRef.current) {
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
            title: 'Boss wave!',
            detail: `Wave ${currentWave} has a crowned bacteria boss.`
          });
        }

        lastWaveRef.current = currentWave;
      }
    };

    const checkStorageRewards = () => {
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

        if (nextBurstCount >= COIN_STREAK_TARGET && now - lastCoinStreakSoundRef.current > 2600) {
          lastCoinStreakSoundRef.current = now;
          coinBurstRef.current = { count: 0, expiresAt: now + COIN_STREAK_WINDOW_MS };
          playCoinStreakSound();
          pushToast({
            kind: 'coins',
            icon: '🪙',
            title: `${nextBurstCount}-coin streak!`,
            detail: 'Nice pickup chain.'
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
    };

    const intervalId = window.setInterval(checkStorageRewards, STORAGE_SCAN_MS);
    window.addEventListener('ptq:wave-director-updated', handleWaveUpdate as EventListener);
    window.addEventListener('ptq:coins-updated', checkStorageRewards as EventListener);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('ptq:wave-director-updated', handleWaveUpdate as EventListener);
      window.removeEventListener('ptq:coins-updated', checkStorageRewards as EventListener);
    };
  }, []);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed right-3 top-20 z-[90] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-3">
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
