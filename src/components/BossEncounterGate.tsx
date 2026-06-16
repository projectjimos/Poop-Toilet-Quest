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

type Point = { x: number; y: number };

type BossState = {
  wave: number;
  name: string;
  hp: number;
  maxHp: number;
  rewardCoins: number;
  utilityCost: number;
  position: Point;
  defeated: boolean;
};

type Status = {
  text: string;
  tone: 'warn' | 'success' | 'info';
  id: number;
};

type AbilityKind = 'replica' | 'spark' | 'rush' | 'zone' | 'shield';

type Ability = {
  id: string;
  name: string;
  emoji: string;
  kind: AbilityKind;
  weight: number;
};

type AbilityVisual = {
  id: number;
  emoji: string;
  label: string;
  x: number;
  y: number;
  expiresAt: number;
};

type Replica = {
  id: number;
  x: number;
  y: number;
  expiresAt: number;
};

type WaveRuntime = {
  active?: boolean;
  currentWave?: number;
  bossRequired?: boolean;
  bossDefeated?: boolean;
};

const WAVE_RUNTIME_KEY = '__ptqWaveClearRuntime';
const UTILITY_EVENT = 'ptq:utilities-updated';
const COINS_EVENT = 'ptq:coins-updated';
const BOSS_DEFEATED_EVENT = 'ptq:boss-defeated';
const PLAYER_TARGET: Point = { x: 50, y: 56 };
const CLOSE_RANGE = 13;
const HIT_RANGE_BONUS = 8;
const BOSS_NAMES = [
  'Crowned Bacteria King',
  'Royal Germ Emperor',
  'Sewer Microbe Monarch',
  'Toxic Crown Germ',
  'Galactic Bacteria Overlord'
];

const ABILITY_LIBRARY: Ability[] = [
  { id: 'replica-1', name: 'Mini Bacteria Replica', emoji: '🦠', kind: 'replica', weight: 1 },
  { id: 'spark-1', name: 'Spore Spark Volley', emoji: '🟣', kind: 'spark', weight: 1.1 },
  { id: 'rush-1', name: 'Royal Rush', emoji: '😡', kind: 'rush', weight: 1.2 },
  { id: 'zone-1', name: 'Arena Zone Pulse', emoji: '🌀', kind: 'zone', weight: 1.25 },
  { id: 'shield-1', name: 'Crown Shield Pulse', emoji: '👑', kind: 'shield', weight: 1.35 },
  { id: 'replica-2', name: 'Replica Swarm', emoji: '🦠', kind: 'replica', weight: 1.45 },
  { id: 'spark-2', name: 'Wide Spark Volley', emoji: '✨', kind: 'spark', weight: 1.55 },
  { id: 'zone-2', name: 'Royal Zone Burst', emoji: '🔆', kind: 'zone', weight: 1.65 }
];

const isMobileLike = () => window.matchMedia?.('(pointer: coarse), (max-width: 760px)').matches ?? false;

function getWaveRuntime(): WaveRuntime | null {
  return ((window as unknown as Record<string, WaveRuntime | undefined>)[WAVE_RUNTIME_KEY]) || null;
}

function getActiveWave(): number | null {
  const runtime = getWaveRuntime();
  const wave = runtime?.currentWave;
  return runtime?.active && Number.isFinite(wave) && wave! > 0 ? wave! : null;
}

function isGameActivelyPlaying(): boolean {
  return Boolean(getWaveRuntime()?.active);
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
  const parsed = Number.parseInt(localStorage.getItem(key) || '', 10);
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

function getWaterCost(toilet: Toilet): number {
  if (toilet.id === 'porta_potty') return 1;
  const cooldownPressure = toilet.cooldownMs < 3000 ? 4 : toilet.cooldownMs < 4500 ? 2 : 0;
  const calculated = Math.round(toilet.level * 0.35 + toilet.damage * 0.06 + toilet.flushRadius * 0.01 + cooldownPressure);
  return Math.min(75, Math.max(1, calculated));
}

function getElectricityCost(toilet: Toilet): number {
  if (toilet.id === 'porta_potty') return 1;
  const fastFlushPressure = toilet.cooldownMs < 2500 ? 10 : toilet.cooldownMs < 3500 ? 6 : toilet.cooldownMs < 5000 ? 3 : 0;
  const calculated = Math.round(toilet.level * 0.5 + toilet.damage * 0.055 + toilet.flushRadius * 0.012 + fastFlushPressure);
  return Math.min(95, Math.max(1, calculated));
}

function distanceBetween(a: Point, b: Point = PLAYER_TARGET): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampBossPosition(point: Point): Point {
  return {
    x: Math.max(-12, Math.min(112, point.x)),
    y: Math.max(-10, Math.min(112, point.y))
  };
}

function getSpawnPosition(wave: number): Point {
  const side = Math.floor(wave / 5) % 4;
  if (side === 0) return { x: -8, y: 22 };
  if (side === 1) return { x: 108, y: 24 };
  if (side === 2) return { x: 106, y: 92 };
  return { x: -6, y: 90 };
}

function getAbilitySlots(wave: number): number {
  return Math.min(6, Math.max(1, Math.floor(wave / 5)));
}

function getAvailableAbilities(wave: number): Ability[] {
  return ABILITY_LIBRARY.slice(0, Math.min(ABILITY_LIBRARY.length, getAbilitySlots(wave) + 1));
}

function makeBossForWave(wave: number): BossState {
  const abilitySlots = getAbilitySlots(wave);
  const maxHp = 1900 + wave * 380 + abilitySlots * 520;
  return {
    wave,
    name: BOSS_NAMES[Math.floor((wave / 5 - 1) % BOSS_NAMES.length)],
    hp: maxHp,
    maxHp,
    rewardCoins: 280 + wave * 46 + abilitySlots * 135,
    utilityCost: Math.min(260, 16 + wave * 3 + abilitySlots * 8),
    position: getSpawnPosition(wave),
    defeated: false
  };
}

function getFlushRange(toilet: Toilet): number {
  const base = toilet.flushRadius / 20 + HIT_RANGE_BONUS;
  return Math.min(38, Math.max(20, base));
}

function getBossDamage(toilet: Toilet, boss: BossState, hasReplicas: boolean, isRushing: boolean, hasShield: boolean): number {
  const raw = Math.max(28, Math.round(toilet.damage * 0.72 + toilet.level * 8));
  const cap = Math.max(125, Math.round(boss.maxHp * 0.17));
  const replicaPenalty = hasReplicas ? 0.86 : 1;
  const rushPenalty = isRushing ? 0.78 : 1;
  const shieldPenalty = hasShield ? 0.8 : 1;
  return Math.max(18, Math.round(Math.min(raw, cap) * replicaPenalty * rushPenalty * shieldPenalty));
}

function makeStatus(text: string, tone: Status['tone'] = 'info'): Status {
  return { text, tone, id: Date.now() };
}

function writeProfileReward(profile: string, boss: BossState): number {
  const jackpotCoins = boss.rewardCoins + Math.round(boss.maxHp * 0.07);
  const nextCoins = writeNumber(coinsKey(profile), readNumber(coinsKey(profile), 0) + jackpotCoins);
  const bonusUtility = Math.round(jackpotCoins * 0.55);
  const nextWater = writeNumber(waterKey(profile), readNumber(waterKey(profile), 500) + bonusUtility);
  const nextPower = writeNumber(electricityKey(profile), readNumber(electricityKey(profile), 500) + bonusUtility);
  window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: { profile, amount: nextCoins } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'water', amount: nextWater } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'electricity', amount: nextPower } }));
  return jackpotCoins;
}

function useProfileUtilities(profile: string, waterAmount: number, powerAmount: number): void {
  const nextWater = writeNumber(waterKey(profile), Math.max(0, readNumber(waterKey(profile), 500) - waterAmount));
  const nextPower = writeNumber(electricityKey(profile), Math.max(0, readNumber(electricityKey(profile), 500) - powerAmount));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'water', amount: nextWater } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'electricity', amount: nextPower } }));
}

export default function BossEncounterGate({ children }: BossEncounterGateProps) {
  const [boss, setBoss] = useState<BossState | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [abilityVisuals, setAbilityVisuals] = useState<AbilityVisual[]>([]);
  const [replicas, setReplicas] = useState<Replica[]>([]);
  const [latestAbility, setLatestAbility] = useState('Boss bacteria is chasing you');
  const bossRef = useRef<BossState | null>(null);
  const replicasRef = useRef<Replica[]>([]);
  const defeatedWavesRef = useRef<Set<number>>(new Set());
  const lastBossWaveRef = useRef<number | null>(null);
  const lastPressureRef = useRef(0);
  const lastAbilityRef = useRef(0);
  const rushUntilRef = useRef(0);
  const shieldUntilRef = useRef(0);
  const lastFlushHitRef = useRef<Record<string, number>>({});
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    bossRef.current = boss;
  }, [boss]);

  useEffect(() => {
    replicasRef.current = replicas;
  }, [replicas]);

  const bossRatio = useMemo(() => (boss ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0), [boss]);
  const bossDistance = useMemo(() => (boss ? Math.round(distanceBetween(boss.position)) : 999), [boss]);
  const abilitySlots = useMemo(() => (boss ? getAbilitySlots(boss.wave) : 0), [boss]);
  const hitRange = useMemo(() => Math.round(getFlushRange(getActiveToilet(getActiveProfile()))), [boss, status]);
  const bossIsClose = bossDistance <= hitRange;
  const bossIsRushing = Date.now() < rushUntilRef.current;
  const bossHasShield = Date.now() < shieldUntilRef.current;
  const jackpot = boss ? boss.rewardCoins + Math.round(boss.maxHp * 0.07) : 0;

  useEffect(() => {
    if (!status) return;
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(null), 2600);
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, [status]);

  useEffect(() => {
    const tickMs = isMobileLike() ? 560 : 380;
    const interval = window.setInterval(() => {
      const wave = getActiveWave();
      const now = Date.now();

      if (!isGameActivelyPlaying() || !wave || wave % 5 !== 0) {
        if (bossRef.current) {
          setBoss(null);
          setReplicas([]);
          setAbilityVisuals([]);
        }
        lastBossWaveRef.current = null;
        return;
      }

      if (defeatedWavesRef.current.has(wave)) return;

      if (!bossRef.current || bossRef.current.wave !== wave || lastBossWaveRef.current !== wave) {
        const nextBoss = makeBossForWave(wave);
        lastBossWaveRef.current = wave;
        rushUntilRef.current = 0;
        shieldUntilRef.current = 0;
        lastAbilityRef.current = now + 900;
        setBoss(nextBoss);
        setReplicas([]);
        setAbilityVisuals([]);
        setLatestAbility('Boss bacteria is chasing you');
        setStatus(makeStatus(`👑🦠 BOSS wave ${wave}: ${nextBoss.name} is on the map. Run away or get in range to flush.`, 'warn'));
        playBossAppearsSound();
        return;
      }

      setBoss((current) => {
        if (!current || current.defeated) return current;
        const distance = distanceBetween(current.position);
        const speed = Math.min(3.8, 0.95 + current.wave * 0.016 + (now < rushUntilRef.current ? 0.85 : 0));
        const ratio = distance > 0 ? Math.min(speed / distance, 1) : 0;
        return {
          ...current,
          position: clampBossPosition({
            x: current.position.x + (PLAYER_TARGET.x - current.position.x) * ratio,
            y: current.position.y + (PLAYER_TARGET.y - current.position.y) * ratio
          })
        };
      });

      const activeBoss = bossRef.current;
      if (!activeBoss || activeBoss.defeated) return;

      if (now - lastPressureRef.current > 3300 && distanceBetween(activeBoss.position) <= CLOSE_RANGE) {
        lastPressureRef.current = now;
        const profile = getActiveProfile();
        if (profile) {
          const slots = Math.max(1, getAbilitySlots(activeBoss.wave));
          const waterCost = Math.round(activeBoss.utilityCost * 0.78 + slots * 3);
          const powerCost = Math.round(activeBoss.utilityCost + slots * 4);
          useProfileUtilities(profile, waterCost, powerCost);
          setStatus(makeStatus(`BOSS contact drained ${waterCost} water and ${powerCost} electricity.`, 'warn'));
        }
      }

      const cooldown = Math.max(3300, 5200 - getAbilitySlots(activeBoss.wave) * 210);
      if (now - lastAbilityRef.current > cooldown) {
        lastAbilityRef.current = now;
        const abilities = getAvailableAbilities(activeBoss.wave);
        const ability = abilities[Math.floor((now / cooldown + activeBoss.wave) % abilities.length)];
        setLatestAbility(ability.name);
        setAbilityVisuals((items) => [
          ...items.filter((item) => item.expiresAt > now).slice(-2),
          {
            id: now,
            emoji: ability.emoji,
            label: ability.name,
            x: Math.max(-6, Math.min(106, activeBoss.position.x + Math.random() * 12 - 6)),
            y: Math.max(-4, Math.min(106, activeBoss.position.y + Math.random() * 12 - 6)),
            expiresAt: now + 1600
          }
        ]);

        if (ability.kind === 'replica') {
          const count = Math.min(isMobileLike() ? 2 : 4, 1 + getAbilitySlots(activeBoss.wave));
          setReplicas(Array.from({ length: count }, (_, index) => ({
            id: now + index,
            x: Math.max(-8, Math.min(108, activeBoss.position.x + Math.cos(index) * (6 + index))),
            y: Math.max(-6, Math.min(108, activeBoss.position.y + Math.sin(index) * (5 + index))),
            expiresAt: now + 5200
          })));
          setStatus(makeStatus(`${activeBoss.name} released mini bacteria copies.`, 'warn'));
        } else if (ability.kind === 'rush') {
          rushUntilRef.current = now + 5000;
          setStatus(makeStatus(`${activeBoss.name} is rushing faster.`, 'warn'));
        } else if (ability.kind === 'shield') {
          shieldUntilRef.current = now + 5000;
          setStatus(makeStatus(`${activeBoss.name} raised a crown shield.`, 'warn'));
        } else {
          const profile = getActiveProfile();
          if (profile) {
            const cost = Math.round((10 + Math.floor(activeBoss.wave / 5) * 5) * ability.weight);
            useProfileUtilities(profile, ability.kind === 'zone' ? cost + 8 : Math.round(cost * 0.7), ability.kind === 'spark' ? cost + 10 : cost);
          }
          setStatus(makeStatus(`${activeBoss.name} used ${ability.name}.`, 'warn'));
        }
      }

      setAbilityVisuals((items) => items.filter((item) => item.expiresAt > now));
      setReplicas((items) => items.filter((item) => item.expiresAt > now));
    }, tickMs);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const applyBossHit = (flushName: string) => {
      const activeBoss = bossRef.current;
      if (!activeBoss || activeBoss.defeated || !isGameActivelyPlaying()) return;
      const profile = getActiveProfile();
      const toilet = getActiveToilet(profile);
      const waterCost = getWaterCost(toilet);
      const powerCost = getElectricityCost(toilet);
      const currentWater = profile ? readNumber(waterKey(profile), 500) : 500;
      const currentPower = profile ? readNumber(electricityKey(profile), 500) : 500;
      const range = getFlushRange(toilet);
      const distance = distanceBetween(activeBoss.position);

      if (profile && (currentWater < waterCost || currentPower < powerCost)) return;
      if (distance > range) {
        setStatus(makeStatus(`Boss is out of range. Chase the BOSS label or let it chase you closer. Range ${Math.round(range)}, distance ${Math.round(distance)}.`, 'warn'));
        return;
      }

      const hitSlot = `${flushName}:${activeBoss.wave}`;
      const now = Date.now();
      const nextAllowed = lastFlushHitRef.current[hitSlot] || 0;
      if (now < nextAllowed) return;
      lastFlushHitRef.current[hitSlot] = now + Math.max(560, toilet.cooldownMs - 120);
      const damage = getBossDamage(toilet, activeBoss, replicasRef.current.length > 0, now < rushUntilRef.current, now < shieldUntilRef.current);

      setBoss((prev) => {
        if (!prev || prev.wave !== activeBoss.wave || prev.defeated) return prev;
        const nextHp = Math.max(0, prev.hp - damage);
        if (nextHp <= 0) {
          defeatedWavesRef.current.add(prev.wave);
          const activeProfile = getActiveProfile();
          const jackpotCoins = activeProfile ? writeProfileReward(activeProfile, prev) : prev.rewardCoins;
          setStatus(makeStatus(`JACKPOT! 👑🦠 ${prev.name} cleared. +${jackpotCoins} coins plus water and electricity.`, 'success'));
          setReplicas([]);
          setAbilityVisuals([]);
          playUnlockSound();
          window.dispatchEvent(new CustomEvent(BOSS_DEFEATED_EVENT, { detail: { wave: prev.wave } }));
          window.setTimeout(() => setBoss((current) => (current?.wave === prev.wave ? null : current)), 1600);
          return { ...prev, hp: 0, defeated: true };
        }
        playDamageSound();
        setStatus(makeStatus(`${toilet.emoji} ${toilet.name} hit BOSS for ${damage} HP.`, 'info'));
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
    }, 900);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      {children}
      {boss && (
        <div className="fixed inset-0 z-[334] pointer-events-none overflow-hidden font-mono" aria-live="polite">
          <div
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${bossIsClose ? 'border-emerald-300/80 bg-emerald-300/10' : 'border-lime-300/45 bg-lime-400/8'}`}
            style={{ left: `${boss.position.x}%`, top: `${boss.position.y}%`, width: `${Math.max(76, hitRange * 3.2)}px`, height: `${Math.max(76, hitRange * 3.2)}px` }}
          />

          {abilityVisuals.map((visual) => (
            <div key={visual.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-200/35 bg-black/55 px-2 py-1 text-center shadow-lg" style={{ left: `${visual.x}%`, top: `${visual.y}%` }}>
              <div className="text-xl">{visual.emoji}</div>
              <div className="mt-1 max-w-24 text-[7px] font-black uppercase tracking-[0.1em] text-amber-100">{visual.label}</div>
            </div>
          ))}

          {replicas.map((replica) => (
            <div key={replica.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime-200/40 bg-emerald-950/65 px-2 py-1 text-2xl shadow-lg shadow-emerald-950/40" style={{ left: `${replica.x}%`, top: `${replica.y}%` }} aria-hidden="true">
              🦠
            </div>
          ))}

          <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ease-linear" style={{ left: `${boss.position.x}%`, top: `${boss.position.y}%` }}>
            <div className="relative text-center">
              {bossHasShield && <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300/55" />}
              <div className="relative min-w-[88px] rounded-2xl border border-lime-300/60 bg-slate-950/72 px-2 py-2 shadow-xl shadow-emerald-950/50 backdrop-blur-sm">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full border border-yellow-200/40 bg-black/65 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.22em] text-yellow-200">BOSS</div>
                <div className="text-[2.65rem] leading-none sm:text-[3.35rem]">👑🦠</div>
                <div className="mt-1 h-2 overflow-hidden rounded-full border border-red-200/30 bg-red-950/80">
                  <div className="h-full bg-gradient-to-r from-red-500 via-orange-300 to-yellow-200 transition-all duration-200" style={{ width: `${bossRatio * 100}%` }} />
                </div>
                <div className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-lime-100">Wave {boss.wave} • {bossIsClose ? 'HITTABLE' : 'CHASING'}</div>
              </div>
            </div>
          </div>

          <div className="absolute right-3 top-28 w-[min(78vw,260px)] rounded-2xl border border-lime-400/45 bg-slate-950/88 p-2 text-white shadow-xl shadow-emerald-950/30 backdrop-blur-md pointer-events-auto">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[8px] uppercase tracking-[0.22em] text-lime-200">Map boss</div>
                <div className="text-sm font-black leading-tight">👑🦠 {boss.name}</div>
                <div className="text-[9px] text-slate-300">Small enemy. Run away, then flush in range.</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-right">
                <div className="text-[7px] uppercase tracking-wider text-slate-300">Jackpot</div>
                <div className="text-xs font-black text-amber-200">+{jackpot}</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-[9px] uppercase tracking-wider text-slate-300"><span>HP</span><span>{Math.ceil(boss.hp)} / {boss.maxHp}</span></div>
              <div className="h-2 overflow-hidden rounded-full border border-lime-300/30 bg-slate-900"><div className="h-full bg-gradient-to-r from-lime-500 via-yellow-300 to-orange-300 transition-all duration-200" style={{ width: `${bossRatio * 100}%` }} /></div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[8px] uppercase tracking-wider text-slate-300">
              <div className={`rounded-lg border p-1 ${bossIsClose ? 'border-emerald-300/40 bg-emerald-900/35' : 'border-white/10 bg-white/5'}`}><div className="text-xs font-black text-cyan-200">{bossDistance}</div><div>distance</div></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-1"><div className="text-xs font-black text-fuchsia-200">{abilitySlots}</div><div>powers</div></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-1"><div className="text-xs font-black text-amber-200">{replicas.length}</div><div>copies</div></div>
            </div>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2 text-[10px] text-slate-200"><span className="font-black text-amber-200">Latest:</span> {latestAbility}</div>
            {status && <div className={`mt-2 rounded-xl border px-2 py-1 text-[10px] font-bold ${status.tone === 'success' ? 'border-emerald-300/35 bg-emerald-900/35 text-emerald-100' : status.tone === 'warn' ? 'border-amber-300/35 bg-amber-900/35 text-amber-100' : 'border-cyan-300/35 bg-cyan-900/35 text-cyan-100'}`}>{status.text}</div>}
          </div>
        </div>
      )}
    </>
  );
}
