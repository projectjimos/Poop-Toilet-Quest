import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TOILET_CATALOG } from '../data';
import type { Toilet } from '../types';
import { getCookie } from '../utils/cookies';

interface WaterSystemGateProps {
  children: ReactNode;
}

type WrappedFlush = (() => void) & {
  __ptqWaterWrapped?: boolean;
  __ptqWaterOriginal?: () => void;
};

const STARTER_WATER = 500;
const WATER_EVENT = 'ptq:water-updated';
const LOW_WATER_WARNING_AT = 120;

const WATER_PACKS = [
  { id: 'cup', label: 'Cup Refill', water: 100, cost: 5, emoji: '🥤' },
  { id: 'bucket', label: 'Bucket Refill', water: 500, cost: 20, emoji: '🪣' },
  { id: 'tank', label: 'Tank Refill', water: 2000, cost: 70, emoji: '🚰' },
  { id: 'reservoir', label: 'Sewer Reservoir', water: 10000, cost: 250, emoji: '🌊' }
];

function getActiveProfile(): string | null {
  return getCookie('poop_quest_current_user') || localStorage.getItem('poop_quest_current_user');
}

function waterKey(profile: string): string {
  return `poop_quest_water_${profile}`;
}

function coinsKey(profile: string): string {
  return `poop_quest_coins_${profile}`;
}

function activeToiletKey(profile: string): string {
  return `poop_quest_active_id_${profile}`;
}

function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function writeWater(profile: string, amount: number): number {
  const safeAmount = Math.max(0, Math.floor(amount));
  localStorage.setItem(waterKey(profile), String(safeAmount));
  window.dispatchEvent(new CustomEvent(WATER_EVENT, { detail: { profile, water: safeAmount } }));
  return safeAmount;
}

function ensureStarterWater(profile: string): number {
  const key = waterKey(profile);
  const existing = localStorage.getItem(key);
  if (existing === null) {
    localStorage.setItem(`poop_quest_water_starter_granted_${profile}`, 'true');
    return writeWater(profile, STARTER_WATER);
  }
  return readNumber(key, STARTER_WATER);
}

function getActiveToilet(profile: string | null): Toilet {
  const activeId = profile ? localStorage.getItem(activeToiletKey(profile)) : null;
  return TOILET_CATALOG.find((toilet) => toilet.id === activeId) || TOILET_CATALOG[0];
}

function getWaterCost(toilet: Toilet): number {
  if (toilet.id === 'porta_potty') return 1;

  const cooldownPressure = toilet.cooldownMs < 3000 ? 4 : toilet.cooldownMs < 4500 ? 2 : 0;
  const calculated = Math.round(
    toilet.level * 0.35 +
    toilet.damage * 0.06 +
    toilet.flushRadius * 0.01 +
    cooldownPressure
  );

  return Math.min(75, Math.max(1, calculated));
}

function makeStatusMessage(text: string, tone: 'info' | 'warn' | 'success' = 'info') {
  return { text, tone, id: Date.now() };
}

export default function WaterSystemGate({ children }: WaterSystemGateProps) {
  const [profile, setProfile] = useState<string | null>(() => getActiveProfile());
  const [activeToiletId, setActiveToiletId] = useState<string>(() => {
    const activeProfile = getActiveProfile();
    return activeProfile ? localStorage.getItem(activeToiletKey(activeProfile)) || 'porta_potty' : 'porta_potty';
  });
  const [water, setWater] = useState<number>(() => {
    const activeProfile = getActiveProfile();
    return activeProfile ? ensureStarterWater(activeProfile) : STARTER_WATER;
  });
  const [coinsMirror, setCoinsMirror] = useState<number>(() => {
    const activeProfile = getActiveProfile();
    return activeProfile ? readNumber(coinsKey(activeProfile), 0) : 0;
  });
  const [showRefills, setShowRefills] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: 'info' | 'warn' | 'success'; id: number } | null>(null);
  const localCooldownUntilRef = useRef<Record<string, number>>({});

  const activeToilet = useMemo(() => {
    return TOILET_CATALOG.find((toilet) => toilet.id === activeToiletId) || getActiveToilet(profile);
  }, [activeToiletId, profile]);
  const activeFlushCost = useMemo(() => getWaterCost(activeToilet), [activeToilet]);
  const waterLow = water <= Math.max(LOW_WATER_WARNING_AT, activeFlushCost * 3);

  useEffect(() => {
    const syncProfileAndResources = () => {
      const nextProfile = getActiveProfile();
      setProfile((prev) => (prev === nextProfile ? prev : nextProfile));

      if (nextProfile) {
        const nextWater = ensureStarterWater(nextProfile);
        const nextActiveToiletId = localStorage.getItem(activeToiletKey(nextProfile)) || 'porta_potty';
        setWater(nextWater);
        setCoinsMirror(readNumber(coinsKey(nextProfile), 0));
        setActiveToiletId((prev) => (prev === nextActiveToiletId ? prev : nextActiveToiletId));
      }
    };

    syncProfileAndResources();
    const interval = window.setInterval(syncProfileAndResources, 750);
    const onWaterUpdate = () => syncProfileAndResources();
    window.addEventListener(WATER_EVENT, onWaterUpdate);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(WATER_EVENT, onWaterUpdate);
    };
  }, []);

  useEffect(() => {
    const wrapFlush = (flushName: 'triggerToiletFlush' | 'triggerToiletFlush2') => {
      const current = (window as any)[flushName] as WrappedFlush | undefined;
      if (!current || current.__ptqWaterWrapped) return;

      const original = current.__ptqWaterOriginal || current;
      const wrapped: WrappedFlush = () => {
        const activeProfile = getActiveProfile();
        if (!activeProfile) {
          original();
          return;
        }

        const toilet = getActiveToilet(activeProfile);
        const cost = getWaterCost(toilet);
        const now = Date.now();
        const cooldownSlot = `${flushName}:${toilet.id}`;
        const localCooldownUntil = localCooldownUntilRef.current[cooldownSlot] || 0;

        if (now < localCooldownUntil) {
          original();
          return;
        }

        const currentWater = readNumber(waterKey(activeProfile), STARTER_WATER);
        if (currentWater < cost) {
          setStatus(makeStatusMessage(`Out of water! ${toilet.name} needs ${cost} water to work.`, 'warn'));
          setShowRefills(true);
          return;
        }

        const nextWater = writeWater(activeProfile, currentWater - cost);
        setWater(nextWater);
        localCooldownUntilRef.current[cooldownSlot] = now + Math.max(500, toilet.cooldownMs - 75);
        original();
      };

      wrapped.__ptqWaterWrapped = true;
      wrapped.__ptqWaterOriginal = original;
      (window as any)[flushName] = wrapped;
    };

    const interval = window.setInterval(() => {
      wrapFlush('triggerToiletFlush');
      wrapFlush('triggerToiletFlush2');
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  const buyWater = (pack: typeof WATER_PACKS[number]) => {
    if (!profile) return;

    const currentCoins = readNumber(coinsKey(profile), coinsMirror);
    if (currentCoins < pack.cost) {
      setStatus(makeStatusMessage(`Need ${pack.cost} coins for ${pack.label}. Grab more coins first!`, 'warn'));
      return;
    }

    const nextCoins = Math.max(0, currentCoins - pack.cost);
    const nextWater = readNumber(waterKey(profile), STARTER_WATER) + pack.water;
    localStorage.setItem(coinsKey(profile), String(nextCoins));
    writeWater(profile, nextWater);
    setCoinsMirror(nextCoins);
    setWater(nextWater);
    setStatus(makeStatusMessage(`${pack.emoji} Bought ${pack.water.toLocaleString()} water for ${pack.cost} coins.`, 'success'));
  };

  return (
    <>
      {children}

      {profile && (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(92vw,360px)] font-mono pointer-events-none">
          <div className="pointer-events-auto bg-slate-950/95 border border-cyan-400/30 shadow-2xl shadow-cyan-950/40 rounded-2xl overflow-hidden backdrop-blur-md">
            <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-800 bg-gradient-to-r from-cyan-950/70 via-slate-950 to-blue-950/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl animate-pulse">💧</span>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 font-black">Toilet Water</div>
                  <div className={`text-lg leading-tight font-black ${waterLow ? 'text-amber-300' : 'text-cyan-100'}`}>
                    {water.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">water</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRefills((prev) => !prev)}
                className="shrink-0 px-3 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-black uppercase tracking-wide transition-colors"
              >
                Buy Water
              </button>
            </div>

            <div className="px-4 py-3 text-[11px] text-slate-300 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-slate-500 uppercase tracking-wider font-bold text-[9px]">Equipped Flush Cost</div>
                <div className="truncate">
                  {activeToilet.emoji} <span className="text-white font-bold">{activeToilet.name}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xl text-cyan-300 font-black">-{activeFlushCost}</div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">per flush</div>
              </div>
            </div>

            {waterLow && (
              <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-[10px] font-bold leading-relaxed">
                Low tank warning: refill soon or your toilet will sputter when you need it most.
              </div>
            )}

            {status && (
              <div className={`mx-4 mb-3 px-3 py-2 rounded-xl border text-[10px] font-bold leading-relaxed ${
                status.tone === 'warn'
                  ? 'bg-rose-500/10 border-rose-400/30 text-rose-200'
                  : status.tone === 'success'
                    ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                    : 'bg-cyan-500/10 border-cyan-400/30 text-cyan-200'
              }`}>
                {status.text}
              </div>
            )}

            {showRefills && (
              <div className="px-4 pb-4 grid grid-cols-1 gap-2">
                <div className="text-[9px] uppercase tracking-widest text-slate-500 font-black flex items-center justify-between">
                  <span>Cheap Refills</span>
                  <span>Detected coins: {coinsMirror.toLocaleString()}</span>
                </div>
                {WATER_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => buyWater(pack)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-400/40 transition-colors flex items-center justify-between gap-3 text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{pack.emoji}</span>
                      <span className="min-w-0">
                        <span className="block text-xs text-white font-black truncate">{pack.label}</span>
                        <span className="block text-[10px] text-cyan-300 font-bold">+{pack.water.toLocaleString()} water</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-amber-300 font-black">{pack.cost} coins</span>
                  </button>
                ))}
                <p className="text-[9px] text-slate-500 leading-relaxed">
                  New players get 500 starter water. Stronger toilets stay powerful, but every flush now needs a little tank planning.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
