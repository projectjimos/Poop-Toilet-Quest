import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TOILET_CATALOG } from '../data';
import type { Toilet } from '../types';
import { getCookie } from '../utils/cookies';

interface WaterSystemGateProps {
  children: ReactNode;
}

type WrappedFlush = (() => void) & {
  __ptqUtilityWrapped?: boolean;
  __ptqUtilityOriginal?: () => void;
};

type ResourceKind = 'water' | 'electricity';

type UtilityPack = {
  id: string;
  label: string;
  amount: number;
  cost: number;
  emoji: string;
};

type StatusTone = 'info' | 'warn' | 'success';

type StatusMessage = {
  text: string;
  tone: StatusTone;
  id: number;
};

const STARTER_WATER = 500;
const STARTER_ELECTRICITY = 500;
const UTILITY_EVENT = 'ptq:utilities-updated';
const COINS_EVENT = 'ptq:coins-updated';
const LOW_WATER_WARNING_AT = 120;
const LOW_ELECTRICITY_WARNING_AT = 120;

const WATER_PACKS: UtilityPack[] = [
  { id: 'cup', label: 'Cup Refill', amount: 100, cost: 5, emoji: '🥤' },
  { id: 'bucket', label: 'Bucket Refill', amount: 500, cost: 20, emoji: '🪣' },
  { id: 'tank', label: 'Tank Refill', amount: 2000, cost: 70, emoji: '🚰' },
  { id: 'reservoir', label: 'Sewer Reservoir', amount: 10000, cost: 250, emoji: '🌊' }
];

const ELECTRICITY_PACKS: UtilityPack[] = [
  { id: 'spark', label: 'Spark Battery', amount: 100, cost: 5, emoji: '🔋' },
  { id: 'battery', label: 'Battery Pack', amount: 500, cost: 20, emoji: '⚡' },
  { id: 'cell', label: 'Power Cell', amount: 2000, cost: 70, emoji: '💡' },
  { id: 'reactor', label: 'Mini Reactor', amount: 10000, cost: 250, emoji: '🧪' }
];

function getActiveProfile(): string | null {
  return getCookie('poop_quest_current_user') || localStorage.getItem('poop_quest_current_user');
}

function waterKey(profile: string): string {
  return `poop_quest_water_${profile}`;
}

function electricityKey(profile: string): string {
  return `poop_quest_electricity_${profile}`;
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

function resourceKey(profile: string, kind: ResourceKind): string {
  return kind === 'water' ? waterKey(profile) : electricityKey(profile);
}

function writeResource(profile: string, kind: ResourceKind, amount: number): number {
  const safeAmount = Math.max(0, Math.floor(amount));
  localStorage.setItem(resourceKey(profile, kind), String(safeAmount));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind, amount: safeAmount } }));
  return safeAmount;
}

function writeCoins(profile: string, amount: number): number {
  const safeAmount = Math.max(0, Math.floor(amount));
  const key = coinsKey(profile);
  const oldValue = localStorage.getItem(key);

  localStorage.setItem(key, String(safeAmount));
  window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: { profile, amount: safeAmount, oldValue } }));

  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key,
      oldValue,
      newValue: String(safeAmount),
      storageArea: localStorage,
      url: window.location.href
    }));
  } catch {
    // Some browsers restrict synthetic StorageEvent construction. The custom event above is the primary signal.
  }

  return safeAmount;
}

function ensureStarterResource(profile: string, kind: ResourceKind): number {
  const key = resourceKey(profile, kind);
  const existing = localStorage.getItem(key);
  const starterAmount = kind === 'water' ? STARTER_WATER : STARTER_ELECTRICITY;

  if (existing === null) {
    localStorage.setItem(`poop_quest_${kind}_starter_granted_${profile}`, 'true');
    return writeResource(profile, kind, starterAmount);
  }

  return readNumber(key, starterAmount);
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

function getElectricityCost(toilet: Toilet): number {
  if (toilet.id === 'porta_potty') return 1;

  const fastFlushPressure = toilet.cooldownMs < 2500 ? 10 : toilet.cooldownMs < 3500 ? 6 : toilet.cooldownMs < 5000 ? 3 : 0;
  const powerPressure = toilet.damage * 0.055 + toilet.flushRadius * 0.012;
  const calculated = Math.round(toilet.level * 0.5 + powerPressure + fastFlushPressure);

  return Math.min(95, Math.max(1, calculated));
}

function makeStatusMessage(text: string, tone: StatusTone = 'info'): StatusMessage {
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
    return activeProfile ? ensureStarterResource(activeProfile, 'water') : STARTER_WATER;
  });
  const [electricity, setElectricity] = useState<number>(() => {
    const activeProfile = getActiveProfile();
    return activeProfile ? ensureStarterResource(activeProfile, 'electricity') : STARTER_ELECTRICITY;
  });
  const [coinsMirror, setCoinsMirror] = useState<number>(() => {
    const activeProfile = getActiveProfile();
    return activeProfile ? readNumber(coinsKey(activeProfile), 0) : 0;
  });
  const [openShop, setOpenShop] = useState<ResourceKind | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const localCooldownUntilRef = useRef<Record<string, number>>({});

  const activeToilet = useMemo(() => {
    return TOILET_CATALOG.find((toilet) => toilet.id === activeToiletId) || getActiveToilet(profile);
  }, [activeToiletId, profile]);
  const activeWaterCost = useMemo(() => getWaterCost(activeToilet), [activeToilet]);
  const activeElectricityCost = useMemo(() => getElectricityCost(activeToilet), [activeToilet]);
  const waterLow = water <= Math.max(LOW_WATER_WARNING_AT, activeWaterCost * 3);
  const electricityLow = electricity <= Math.max(LOW_ELECTRICITY_WARNING_AT, activeElectricityCost * 3);

  useEffect(() => {
    const syncProfileAndResources = () => {
      const nextProfile = getActiveProfile();
      setProfile((prev) => (prev === nextProfile ? prev : nextProfile));

      if (nextProfile) {
        const nextWater = ensureStarterResource(nextProfile, 'water');
        const nextElectricity = ensureStarterResource(nextProfile, 'electricity');
        const nextActiveToiletId = localStorage.getItem(activeToiletKey(nextProfile)) || 'porta_potty';
        setWater(nextWater);
        setElectricity(nextElectricity);
        setCoinsMirror(readNumber(coinsKey(nextProfile), 0));
        setActiveToiletId((prev) => (prev === nextActiveToiletId ? prev : nextActiveToiletId));
      }
    };

    syncProfileAndResources();
    const interval = window.setInterval(syncProfileAndResources, 750);
    const onUtilityUpdate = () => syncProfileAndResources();
    const onCoinsUpdate = () => syncProfileAndResources();
    window.addEventListener(UTILITY_EVENT, onUtilityUpdate);
    window.addEventListener(COINS_EVENT, onCoinsUpdate);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(UTILITY_EVENT, onUtilityUpdate);
      window.removeEventListener(COINS_EVENT, onCoinsUpdate);
    };
  }, []);

  useEffect(() => {
    const wrapFlush = (flushName: 'triggerToiletFlush' | 'triggerToiletFlush2') => {
      const current = (window as any)[flushName] as WrappedFlush | undefined;
      if (!current || current.__ptqUtilityWrapped) return;

      const original = current.__ptqUtilityOriginal || current;
      const wrapped: WrappedFlush = () => {
        const activeProfile = getActiveProfile();
        if (!activeProfile) {
          original();
          return;
        }

        const toilet = getActiveToilet(activeProfile);
        const waterCost = getWaterCost(toilet);
        const electricityCost = getElectricityCost(toilet);
        const now = Date.now();
        const cooldownSlot = `${flushName}:${toilet.id}`;
        const localCooldownUntil = localCooldownUntilRef.current[cooldownSlot] || 0;

        if (now < localCooldownUntil) {
          original();
          return;
        }

        const currentWater = readNumber(waterKey(activeProfile), STARTER_WATER);
        if (currentWater < waterCost) {
          setStatus(makeStatusMessage(`Out of water! ${toilet.name} needs ${waterCost} water to work.`, 'warn'));
          setOpenShop('water');
          return;
        }

        const currentElectricity = readNumber(electricityKey(activeProfile), STARTER_ELECTRICITY);
        if (currentElectricity < electricityCost) {
          setStatus(makeStatusMessage(`Out of electricity! ${toilet.name} needs ${electricityCost} power to fire up.`, 'warn'));
          setOpenShop('electricity');
          return;
        }

        const nextWater = writeResource(activeProfile, 'water', currentWater - waterCost);
        const nextElectricity = writeResource(activeProfile, 'electricity', currentElectricity - electricityCost);
        setWater(nextWater);
        setElectricity(nextElectricity);
        localCooldownUntilRef.current[cooldownSlot] = now + Math.max(500, toilet.cooldownMs - 75);
        original();
      };

      wrapped.__ptqUtilityWrapped = true;
      wrapped.__ptqUtilityOriginal = original;
      (window as any)[flushName] = wrapped;
    };

    const interval = window.setInterval(() => {
      wrapFlush('triggerToiletFlush');
      wrapFlush('triggerToiletFlush2');
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  const buyResource = (kind: ResourceKind, pack: UtilityPack) => {
    if (!profile) return;

    const currentCoins = readNumber(coinsKey(profile), coinsMirror);
    if (currentCoins < pack.cost) {
      setStatus(makeStatusMessage(`Need ${pack.cost} coins for ${pack.label}. Grab more coins first!`, 'warn'));
      return;
    }

    const nextCoins = Math.max(0, currentCoins - pack.cost);
    const currentAmount = readNumber(resourceKey(profile, kind), kind === 'water' ? STARTER_WATER : STARTER_ELECTRICITY);
    const nextAmount = currentAmount + pack.amount;

    writeCoins(profile, nextCoins);
    writeResource(profile, kind, nextAmount);
    setCoinsMirror(nextCoins);

    if (kind === 'water') {
      setWater(nextAmount);
    } else {
      setElectricity(nextAmount);
    }

    setStatus(makeStatusMessage(`${pack.emoji} Bought ${pack.amount.toLocaleString()} ${kind} for ${pack.cost} coins. Coins left: ${nextCoins.toLocaleString()}.`, 'success'));
  };

  const currentPacks = openShop === 'electricity' ? ELECTRICITY_PACKS : WATER_PACKS;
  const openShopLabel = openShop === 'electricity' ? 'Cheap Power' : 'Cheap Refills';
  const openShopUnit = openShop === 'electricity' ? 'electricity' : 'water';

  return (
    <>
      {children}

      {profile && (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(92vw,390px)] font-mono pointer-events-none">
          <div className="pointer-events-auto bg-slate-950/95 border border-cyan-400/30 shadow-2xl shadow-cyan-950/40 rounded-2xl overflow-hidden backdrop-blur-md">
            <div className="px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-cyan-950/70 via-slate-950 to-yellow-950/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl animate-pulse">🚽</span>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 font-black">Toilet Utilities</div>
                    <div className="text-[10px] text-slate-500 font-bold">Water + electricity power every flush</div>
                  </div>
                </div>

                <div className="shrink-0 text-right rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-amber-200 font-black">Money</div>
                  <div className="text-sm text-amber-100 font-black">🪙 {coinsMirror.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpenShop((prev) => (prev === 'water' ? null : 'water'))}
                  className="flex-1 px-3 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[10px] font-black uppercase tracking-wide transition-colors"
                >
                  Buy Water
                </button>
                <button
                  type="button"
                  onClick={() => setOpenShop((prev) => (prev === 'electricity' ? null : 'electricity'))}
                  className="flex-1 px-3 py-2 rounded-xl bg-yellow-300 hover:bg-yellow-200 text-slate-950 text-[10px] font-black uppercase tracking-wide transition-colors"
                >
                  Buy Power
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-4 py-3 text-[11px] text-slate-300">
              <div className={`rounded-xl border px-3 py-2 ${waterLow ? 'bg-amber-500/10 border-amber-400/30' : 'bg-cyan-500/10 border-cyan-400/20'}`}>
                <div className="text-[9px] uppercase tracking-wider font-black text-cyan-300">💧 Water</div>
                <div className={`text-lg leading-tight font-black ${waterLow ? 'text-amber-300' : 'text-cyan-100'}`}>
                  {water.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500 font-bold">-{activeWaterCost} per flush</div>
              </div>

              <div className={`rounded-xl border px-3 py-2 ${electricityLow ? 'bg-amber-500/10 border-amber-400/30' : 'bg-yellow-500/10 border-yellow-400/20'}`}>
                <div className="text-[9px] uppercase tracking-wider font-black text-yellow-300">⚡ Electricity</div>
                <div className={`text-lg leading-tight font-black ${electricityLow ? 'text-amber-300' : 'text-yellow-100'}`}>
                  {electricity.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500 font-bold">-{activeElectricityCost} per flush</div>
              </div>
            </div>

            <div className="px-4 pb-3 text-[11px] text-slate-300 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-slate-500 uppercase tracking-wider font-bold text-[9px]">Equipped Toilet</div>
                <div className="truncate">
                  {activeToilet.emoji} <span className="text-white font-bold">{activeToilet.name}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Flush Cost</div>
                <div className="text-xs text-cyan-200 font-black">💧 {activeWaterCost} · ⚡ {activeElectricityCost}</div>
              </div>
            </div>

            {(waterLow || electricityLow) && (
              <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-[10px] font-bold leading-relaxed">
                Low utility warning: refill before your toilet sputters during a clutch boss moment.
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

            {openShop && (
              <div className="px-4 pb-4 grid grid-cols-1 gap-2">
                <div className="text-[9px] uppercase tracking-widest text-slate-500 font-black flex items-center justify-between">
                  <span>{openShopLabel}</span>
                  <span>Money: {coinsMirror.toLocaleString()} coins</span>
                </div>
                {currentPacks.map((pack) => {
                  const canAfford = coinsMirror >= pack.cost;
                  const balanceAfterPurchase = Math.max(0, coinsMirror - pack.cost);

                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => buyResource(openShop, pack)}
                      disabled={!canAfford}
                      className={`w-full px-3 py-2 rounded-xl border transition-colors flex items-center justify-between gap-3 text-left ${
                        canAfford
                          ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-cyan-400/40'
                          : 'bg-slate-950/80 border-slate-900 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{pack.emoji}</span>
                        <span className="min-w-0">
                          <span className="block text-xs text-white font-black truncate">{pack.label}</span>
                          <span className="block text-[10px] text-cyan-300 font-bold">+{pack.amount.toLocaleString()} {openShopUnit}</span>
                          <span className="block text-[9px] text-slate-500 font-bold">
                            Balance after buy: {balanceAfterPurchase.toLocaleString()} coins
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-amber-300 font-black">-{pack.cost} coins</span>
                    </button>
                  );
                })}
                <p className="text-[9px] text-slate-500 leading-relaxed">
                  Buying utilities now deducts coins immediately and shows your updated money balance so there is no confusion.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
