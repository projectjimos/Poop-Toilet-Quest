import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TOILET_CATALOG } from '../data';
import type { Toilet } from '../types';
import { getCookie } from '../utils/cookies';
import { playBossAppearsSound, playDamageSound, playUnlockSound } from '../utils/audio';

interface BossEncounterGateProps {
  children: ReactNode;
}

type WrappedFlush = (() => void) & {
  __ptqBossWrapped?: boolean;
  __ptqBossOriginal?: () => void;
};

type BossState = {
  wave: number;
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  rewardCoins: number;
  pressureCost: number;
  defeated: boolean;
};

type BossStatus = {
  text: string;
  tone: 'warn' | 'success' | 'info';
  id: number;
};

const WAVE_LABEL_PATTERN = /Poop Crusader\s*Level\s*(\d+)/i;
const UTILITY_EVENT = 'ptq:utilities-updated';
const COINS_EVENT = 'ptq:coins-updated';

function getVisibleWave(): number | null {
  const text = document.body?.innerText || '';
  const match = text.match(WAVE_LABEL_PATTERN);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isGameActivelyPlaying(): boolean {
  const text = document.body?.innerText || '';
  const isLobby = /SELECT INPUT SYSTEM|Start PC Play|Start Mobile Play|Start CO-OP Play/i.test(text);
  const isGameOver = /GAME OVER|Try Again|Return to Lobby/i.test(text);
  const hasWaveHud = WAVE_LABEL_PATTERN.test(text);
  return hasWaveHud && !isLobby && !isGameOver;
}

function getActiveProfile(): string | null {
  return getCookie('poop_quest_current_user') || localStorage.getItem('poop_quest_current_user');
}

function activeToiletKey(profile: string): string {
  return `poop_quest_active_id_${profile}`;
}

function coinsKey(profile: string): string {
  return `poop_quest_coins_${profile}`;
}

function waterKey(profile: string): string {
  return `poop_quest_water_${profile}`;
}

function electricityKey(profile: string): string {
  return `poop_quest_electricity_${profile}`;
}

function readNumber(key: string, fallback = 0): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function writeNumber(key: string, amount: number): number {
  const safeAmount = Math.max(0, Math.floor(amount));
  localStorage.setItem(key, String(safeAmount));
  return safeAmount;
}

function getActiveToilet(profile: string | null): Toilet {
  const activeId = profile ? localStorage.getItem(activeToiletKey(profile)) : null;
  return TOILET_CATALOG.find((toilet) => toilet.id === activeId) || TOILET_CATALOG[0];
}

function makeBossForWave(wave: number): BossState {
  const bossPool = [
    { name: 'Plunger Titan', emoji: '🪠👑' },
    { name: 'Germ King', emoji: '🦠👑' },
    { name: 'Paper Beast', emoji: '🧻👹' },
    { name: 'Mega Brush', emoji: '🪥⚡' },
    { name: 'Sewer Overlord', emoji: '🚽🌌' }
  ];
  const pick = bossPool[Math.floor((wave / 5 - 1) % bossPool.length)];
  const maxHp = 900 + wave * 280;

  return {
    wave,
    name: pick.name,
    emoji: pick.emoji,
    hp: maxHp,
    maxHp,
    rewardCoins: 75 + wave * 18,
    pressureCost: Math.min(160, 18 + wave * 4),
    defeated: false
  };
}

function getBossDamage(toilet: Toilet, boss: BossState): number {
  const rawDamage = Math.max(15, Math.round(toilet.damage * 0.58 + toilet.level * 5));
  const perFlushCap = Math.max(75, Math.round(boss.maxHp * 0.14));
  return Math.min(rawDamage, perFlushCap);
}

function makeStatus(text: string, tone: BossStatus['tone'] = 'info'): BossStatus {
  return { text, tone, id: Date.now() };
}

function rewardProfile(profile: string, boss: BossState): void {
  const nextCoins = writeNumber(coinsKey(profile), readNumber(coinsKey(profile), 0) + boss.rewardCoins);
  const nextWater = writeNumber(waterKey(profile), readNumber(waterKey(profile), 500) + Math.round(boss.rewardCoins * 0.65));
  const nextPower = writeNumber(electricityKey(profile), readNumber(electricityKey(profile), 500) + Math.round(boss.rewardCoins * 0.65));

  window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: { profile, amount: nextCoins } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'water', amount: nextWater } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'electricity', amount: nextPower } }));
}

export default function BossEncounterGate({ children }: BossEncounterGateProps) {
  const [boss, setBoss] = useState<BossState | null>(null);
  const [status, setStatus] = useState<BossStatus | null>(null);
  const bossRef = useRef<BossState | null>(null);
  const defeatedWavesRef = useRef<Set<number>>(new Set());
  const lastBossWaveRef = useRef<number | null>(null);
  const lastPressureRef = useRef<number>(0);
  const lastFlushHitRef = useRef<Record<string, number>>({});
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    bossRef.current = boss;
  }, [boss]);

  const bossRatio = useMemo(() => {
    if (!boss) return 0;
    return Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  }, [boss]);

  useEffect(() => {
    if (!status) return;
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(null), 3000);
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, [status]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const playing = isGameActivelyPlaying();
      const wave = getVisibleWave();

      if (!playing || !wave) {
        setBoss(null);
        lastBossWaveRef.current = null;
        return;
      }

      if (wave % 5 !== 0) {
        setBoss(null);
        lastBossWaveRef.current = null;
        return;
      }

      if (defeatedWavesRef.current.has(wave)) return;

      if (!bossRef.current || bossRef.current.wave !== wave || lastBossWaveRef.current !== wave) {
        const nextBoss = makeBossForWave(wave);
        lastBossWaveRef.current = wave;
        setBoss(nextBoss);
        setStatus(makeStatus(`${nextBoss.emoji} ${nextBoss.name} entered Wave ${wave}! Land flushes to break its HP bar.`, 'warn'));
        playBossAppearsSound();
      }
    }, 400);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const pressureInterval = window.setInterval(() => {
      const activeBoss = bossRef.current;
      if (!activeBoss || activeBoss.defeated || !isGameActivelyPlaying()) return;

      const now = Date.now();
      if (now - lastPressureRef.current < 6200) return;
      lastPressureRef.current = now;

      const profile = getActiveProfile();
      if (!profile) return;

      const waterCost = activeBoss.pressureCost;
      const powerCost = Math.ceil(activeBoss.pressureCost * 1.15);
      const nextWater = writeNumber(waterKey(profile), Math.max(0, readNumber(waterKey(profile), 500) - waterCost));
      const nextPower = writeNumber(electricityKey(profile), Math.max(0, readNumber(electricityKey(profile), 500) - powerCost));

      window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'water', amount: nextWater } }));
      window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'electricity', amount: nextPower } }));
      setStatus(makeStatus(`${activeBoss.name} pressure drained ${waterCost} water and ${powerCost} electricity.`, 'warn'));
    }, 1000);

    return () => window.clearInterval(pressureInterval);
  }, []);

  useEffect(() => {
    const applyBossHit = (flushName: string) => {
      const activeBoss = bossRef.current;
      if (!activeBoss || activeBoss.defeated || !isGameActivelyPlaying()) return;

      const profile = getActiveProfile();
      const toilet = getActiveToilet(profile);
      const hitSlot = `${flushName}:${activeBoss.wave}`;
      const now = Date.now();
      const nextAllowed = lastFlushHitRef.current[hitSlot] || 0;

      if (now < nextAllowed) return;
      lastFlushHitRef.current[hitSlot] = now + Math.max(550, toilet.cooldownMs - 75);

      const damage = getBossDamage(toilet, activeBoss);
      setBoss((prev) => {
        if (!prev || prev.wave !== activeBoss.wave || prev.defeated) return prev;
        const nextHp = Math.max(0, prev.hp - damage);

        if (nextHp <= 0) {
          defeatedWavesRef.current.add(prev.wave);
          const defeatedBoss = { ...prev, hp: 0, defeated: true };
          const activeProfile = getActiveProfile();
          if (activeProfile) rewardProfile(activeProfile, prev);
          setStatus(makeStatus(`${prev.emoji} ${prev.name} cleared! +${prev.rewardCoins} coins and utility bonus.`, 'success'));
          playUnlockSound();
          window.setTimeout(() => setBoss((current) => (current?.wave === prev.wave ? null : current)), 1800);
          return defeatedBoss;
        }

        playDamageSound();
        setStatus(makeStatus(`${toilet.emoji} ${toilet.name} hit ${prev.name} for ${damage} HP.`, 'info'));
        return { ...prev, hp: nextHp };
      });
    };

    const wrapFlush = (flushName: 'triggerToiletFlush' | 'triggerToiletFlush2') => {
      const current = (window as any)[flushName] as WrappedFlush | undefined;
      if (!current || current.__ptqBossWrapped) return;

      const original = current.__ptqBossOriginal || current;
      const wrapped: WrappedFlush = () => {
        original();
        applyBossHit(flushName);
      };

      wrapped.__ptqBossWrapped = true;
      wrapped.__ptqBossOriginal = original;
      (window as any)[flushName] = wrapped;
    };

    const interval = window.setInterval(() => {
      wrapFlush('triggerToiletFlush');
      wrapFlush('triggerToiletFlush2');
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      {children}

      {boss && (
        <div className="fixed top-24 right-4 z-[335] w-[min(92vw,380px)] font-mono pointer-events-none">
          <div className="pointer-events-auto rounded-3xl border border-red-400/55 bg-gradient-to-br from-red-950/95 via-slate-950/95 to-purple-950/95 p-4 shadow-2xl shadow-red-950/50 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-red-200">Extreme boss wave</div>
                <div className="text-xl font-black text-white leading-tight">{boss.emoji} {boss.name}</div>
                <div className="text-[11px] text-slate-300 mt-1">Wave {boss.wave} • Boss resists huge toilets, so timing matters.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                <div className="text-[9px] uppercase tracking-wider text-slate-300">Reward</div>
                <div className="text-sm font-black text-amber-200">+{boss.rewardCoins}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-300 mb-1">
                <span>Boss HP</span>
                <span>{Math.ceil(boss.hp)} / {boss.maxHp}</span>
              </div>
              <div className="h-4 rounded-full bg-slate-900 border border-red-300/30 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300 transition-all duration-200"
                  style={{ width: `${bossRatio * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-wider text-slate-300">
              <div className="rounded-xl border border-white/10 bg-white/5 py-2">Dodge</div>
              <div className="rounded-xl border border-white/10 bg-white/5 py-2">Flush</div>
              <div className="rounded-xl border border-white/10 bg-white/5 py-2">Refill</div>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="fixed left-1/2 top-[6.6rem] z-[345] -translate-x-1/2 px-4 pointer-events-none w-full max-w-lg">
          <div className={`mx-auto rounded-2xl border px-4 py-3 text-center font-mono text-sm shadow-2xl backdrop-blur-md ${status.tone === 'success' ? 'border-emerald-300/60 bg-emerald-950/90 text-emerald-100' : status.tone === 'warn' ? 'border-red-300/60 bg-red-950/90 text-red-100' : 'border-cyan-300/60 bg-slate-950/90 text-cyan-100'}`}>
            {status.text}
          </div>
        </div>
      )}
    </>
  );
}
