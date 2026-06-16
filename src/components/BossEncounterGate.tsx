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

const WAVE_LABEL_PATTERN = /Poop Crusader\s*Level\s*(\d+)/i;
const UTILITY_EVENT = 'ptq:utilities-updated';
const COINS_EVENT = 'ptq:coins-updated';
const PLAYER_TARGET: Point = { x: 50, y: 54 };
const CLOSE_RANGE = 32;
const HIT_RANGE_BONUS = 14;
const BASE_ABILITY_COOLDOWN_MS = 4200;
const BOSS_NAMES = ['Crowned Bacteria King', 'Royal Germ Emperor', 'Sewer Microbe Monarch', 'Toxic Crown Germ', 'Galactic Bacteria Overlord'];
const ABILITY_BASES: Array<Omit<Ability, 'id' | 'name' | 'weight'>> = [
  { emoji: '🦠', kind: 'replica' },
  { emoji: '🟣', kind: 'spark' },
  { emoji: '😡', kind: 'rush' },
  { emoji: '🌀', kind: 'zone' },
  { emoji: '👑', kind: 'shield' }
];
const ABILITY_LIBRARY: Ability[] = Array.from({ length: 120 }, (_, index) => {
  const base = ABILITY_BASES[index % ABILITY_BASES.length];
  const tier = Math.floor(index / ABILITY_BASES.length) + 1;
  const name = {
    replica: 'Mini Bacteria Replica',
    spark: 'Spore Spark Volley',
    rush: 'Royal Rush',
    zone: 'Arena Zone Pulse',
    shield: 'Crown Shield Pulse'
  }[base.kind];
  return { ...base, id: `${base.kind}-${tier}`, name: `${name} ${tier}`, weight: 1 + tier * 0.035 };
});

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

function getWaterCost(toilet: Toilet): number {
  if (toilet.id === 'porta_potty') return 1;
  const cooldownPressure = toilet.cooldownMs < 3000 ? 4 : toilet.cooldownMs < 4500 ? 2 : 0;
  const calculated = Math.round(toilet.level * 0.35 + toilet.damage * 0.06 + toilet.flushRadius * 0.01 + cooldownPressure);
  return Math.min(75, Math.max(1, calculated));
}

function getElectricityCost(toilet: Toilet): number {
  if (toilet.id === 'porta_potty') return 1;
  const fastFlushPressure = toilet.cooldownMs < 2500 ? 10 : toilet.cooldownMs < 3500 ? 6 : toilet.cooldownMs < 5000 ? 3 : 0;
  const powerPressure = toilet.damage * 0.055 + toilet.flushRadius * 0.012;
  const calculated = Math.round(toilet.level * 0.5 + powerPressure + fastFlushPressure);
  return Math.min(95, Math.max(1, calculated));
}

function distanceBetween(a: Point, b: Point = PLAYER_TARGET): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getSpawnPosition(wave: number): Point {
  const side = Math.floor(wave / 5) % 4;
  if (side === 0) return { x: 10, y: 22 };
  if (side === 1) return { x: 90, y: 24 };
  if (side === 2) return { x: 88, y: 82 };
  return { x: 12, y: 80 };
}

function getAbilitySlots(wave: number): number {
  return Math.min(14, Math.max(1, Math.floor(wave / 5)));
}

function getAvailableAbilities(wave: number): Ability[] {
  return ABILITY_LIBRARY.slice(0, Math.min(ABILITY_LIBRARY.length, getAbilitySlots(wave) * 10));
}

function makeBossForWave(wave: number): BossState {
  const abilitySlots = getAbilitySlots(wave);
  const maxHp = 1800 + wave * 420 + abilitySlots * 520;
  return {
    wave,
    name: BOSS_NAMES[Math.floor((wave / 5 - 1) % BOSS_NAMES.length)],
    hp: maxHp,
    maxHp,
    rewardCoins: 240 + wave * 48 + abilitySlots * 150,
    utilityCost: Math.min(320, 20 + wave * 5 + abilitySlots * 10),
    position: getSpawnPosition(wave),
    defeated: false
  };
}

function getFlushRange(toilet: Toilet): number {
  const base = toilet.flushRadius / 12 + HIT_RANGE_BONUS;
  return Math.min(64, Math.max(36, base));
}

function getBossDamage(toilet: Toilet, boss: BossState, hasReplicas: boolean, isRushing: boolean, hasShield: boolean): number {
  const raw = Math.max(18, Math.round(toilet.damage * 0.62 + toilet.level * 6));
  const cap = Math.max(95, Math.round(boss.maxHp * 0.135));
  const replicaPenalty = hasReplicas ? 0.78 : 1;
  const rushPenalty = isRushing ? 0.7 : 1;
  const shieldPenalty = hasShield ? 0.78 : 1;
  return Math.max(12, Math.round(Math.min(raw, cap) * replicaPenalty * rushPenalty * shieldPenalty));
}

function makeStatus(text: string, tone: Status['tone'] = 'info'): Status {
  return { text, tone, id: Date.now() };
}

function writeProfileReward(profile: string, boss: BossState): void {
  const jackpotCoins = boss.rewardCoins + Math.round(boss.maxHp * 0.065);
  const nextCoins = writeNumber(coinsKey(profile), readNumber(coinsKey(profile), 0) + jackpotCoins);
  const nextWater = writeNumber(waterKey(profile), readNumber(waterKey(profile), 500) + Math.round(jackpotCoins * 0.62));
  const nextPower = writeNumber(electricityKey(profile), readNumber(electricityKey(profile), 500) + Math.round(jackpotCoins * 0.62));
  window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: { profile, amount: nextCoins } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'water', amount: nextWater } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'electricity', amount: nextPower } }));
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
  const [latestAbility, setLatestAbility] = useState('Crowned bacteria is tracking you');
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
  const jackpot = boss ? boss.rewardCoins + Math.round(boss.maxHp * 0.065) : 0;

  useEffect(() => {
    if (!status) return;
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(null), 3600);
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, [status]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const wave = getVisibleWave();
      if (!isGameActivelyPlaying() || !wave || wave % 5 !== 0) {
        setBoss(null);
        setReplicas([]);
        setAbilityVisuals([]);
        lastBossWaveRef.current = null;
        return;
      }
      if (defeatedWavesRef.current.has(wave)) return;
      if (!bossRef.current || bossRef.current.wave !== wave || lastBossWaveRef.current !== wave) {
        const nextBoss = makeBossForWave(wave);
        lastBossWaveRef.current = wave;
        setBoss(nextBoss);
        setReplicas([]);
        setAbilityVisuals([]);
        setLatestAbility('Crowned bacteria is tracking you');
        setStatus(makeStatus(`👑🦠 ${nextBoss.name} entered the battlefield. Get inside the glowing circle and flush.`, 'warn'));
        playBossAppearsSound();
      }
    }, 350);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const moveInterval = window.setInterval(() => {
      setBoss((current) => {
        if (!current || current.defeated || !isGameActivelyPlaying()) return current;
        const distance = distanceBetween(current.position);
        const speed = Math.min(3.1, 0.72 + current.wave * 0.018 + (Date.now() < rushUntilRef.current ? 0.95 : 0));
        const ratio = distance > 0 ? Math.min(speed / distance, 1) : 0;
        const wobble = Math.sin(Date.now() / 350 + current.wave) * 0.18;
        return {
          ...current,
          position: {
            x: Math.max(6, Math.min(94, current.position.x + (PLAYER_TARGET.x - current.position.x) * ratio + wobble)),
            y: Math.max(12, Math.min(88, current.position.y + (PLAYER_TARGET.y - current.position.y) * ratio))
          }
        };
      });
    }, 110);
    return () => window.clearInterval(moveInterval);
  }, []);

  useEffect(() => {
    const cleanup = window.setInterval(() => {
      const now = Date.now();
      setAbilityVisuals((items) => items.filter((item) => item.expiresAt > now));
      setReplicas((items) => items.filter((item) => item.expiresAt > now));
    }, 500);
    return () => window.clearInterval(cleanup);
  }, []);

  useEffect(() => {
    const pressure = window.setInterval(() => {
      const activeBoss = bossRef.current;
      if (!activeBoss || activeBoss.defeated || !isGameActivelyPlaying()) return;
      if (distanceBetween(activeBoss.position) > CLOSE_RANGE) return;
      const now = Date.now();
      if (now - lastPressureRef.current < 2200) return;
      lastPressureRef.current = now;
      const profile = getActiveProfile();
      if (!profile) return;
      const slots = Math.max(1, getAbilitySlots(activeBoss.wave));
      const waterCost = activeBoss.utilityCost + slots * 4;
      const powerCost = Math.ceil(activeBoss.utilityCost * 1.25 + slots * 5);
      useProfileUtilities(profile, waterCost, powerCost);
      setStatus(makeStatus(`👑🦠 ${activeBoss.name} is close and used ${waterCost} water and ${powerCost} electricity.`, 'warn'));
    }, 650);
    return () => window.clearInterval(pressure);
  }, []);

  useEffect(() => {
    const useAbility = (ability: Ability, activeBoss: BossState) => {
      const now = Date.now();
      const profile = getActiveProfile();
      setLatestAbility(ability.name);
      setAbilityVisuals((items) => [
        ...items,
        {
          id: now,
          emoji: ability.emoji,
          label: ability.name,
          x: Math.max(12, Math.min(88, activeBoss.position.x + Math.random() * 20 - 10)),
          y: Math.max(16, Math.min(86, activeBoss.position.y + Math.random() * 20 - 10)),
          expiresAt: now + 2100
        }
      ]);

      if (ability.kind === 'replica') {
        const count = Math.min(9, 2 + getAbilitySlots(activeBoss.wave));
        setReplicas((items) => [
          ...items,
          ...Array.from({ length: count }, (_, index) => ({
            id: now + index,
            x: Math.max(8, Math.min(92, activeBoss.position.x + Math.cos(index) * (8 + index * 1.6))),
            y: Math.max(14, Math.min(88, activeBoss.position.y + Math.sin(index) * (7 + index * 1.4))),
            expiresAt: now + 8500
          }))
        ]);
        setStatus(makeStatus(`${activeBoss.name} spawned mini bacteria replicas.`, 'warn'));
        return;
      }

      if (ability.kind === 'rush') {
        rushUntilRef.current = now + 7000;
        setStatus(makeStatus(`${activeBoss.name} used Royal Rush and moves faster for a few seconds.`, 'warn'));
        return;
      }

      if (ability.kind === 'shield') {
        shieldUntilRef.current = now + 7000;
        setStatus(makeStatus(`${activeBoss.name} raised its crown shield. You can still hit it, but damage is reduced.`, 'warn'));
        return;
      }

      if (!profile) return;
      const distance = distanceBetween(activeBoss.position);
      const rangeFactor = distance <= CLOSE_RANGE ? 1 : 0.42;
      const waveScale = Math.max(1, Math.floor(activeBoss.wave / 5));
      const cost = Math.round((12 + waveScale * 8) * rangeFactor * ability.weight);
      const waterCost = ability.kind === 'zone' ? cost + 14 : Math.round(cost * 0.85);
      const powerCost = ability.kind === 'spark' ? cost + 18 : cost + 6;
      useProfileUtilities(profile, waterCost, powerCost);
      setStatus(makeStatus(`${activeBoss.name} used ${ability.name}. Keep moving and flush from inside the circle.`, 'warn'));
    };

    const interval = window.setInterval(() => {
      const activeBoss = bossRef.current;
      if (!activeBoss || activeBoss.defeated || !isGameActivelyPlaying()) return;
      const now = Date.now();
      const cooldown = Math.max(2200, BASE_ABILITY_COOLDOWN_MS - getAbilitySlots(activeBoss.wave) * 140);
      if (now - lastAbilityRef.current < cooldown) return;
      lastAbilityRef.current = now;
      const abilities = getAvailableAbilities(activeBoss.wave);
      const index = Math.floor((now / cooldown + activeBoss.wave) % abilities.length);
      useAbility(abilities[index], activeBoss);
    }, 500);
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
        setStatus(makeStatus(`Too far. Move close to 👑🦠 until it is inside the glowing hit circle. Range ${Math.round(range)}, distance ${Math.round(distance)}.`, 'warn'));
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
          if (activeProfile) writeProfileReward(activeProfile, prev);
          const jackpotCoins = prev.rewardCoins + Math.round(prev.maxHp * 0.065);
          setStatus(makeStatus(`JACKPOT! 👑🦠 ${prev.name} cleared. +${jackpotCoins} coins plus water and electricity.`, 'success'));
          setReplicas([]);
          setAbilityVisuals([]);
          playUnlockSound();
          window.setTimeout(() => setBoss((current) => (current?.wave === prev.wave ? null : current)), 1900);
          return { ...prev, hp: 0, defeated: true };
        }
        playDamageSound();
        setStatus(makeStatus(`${toilet.emoji} ${toilet.name} hit 👑🦠 for ${damage} HP. Stay inside the glowing circle.`, 'info'));
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
        <div className="fixed inset-0 z-[334] pointer-events-none font-mono" aria-live="polite">
          <div
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 ${bossIsClose ? 'border-emerald-300/80 bg-emerald-300/12 shadow-[0_0_55px_rgba(16,185,129,0.45)]' : 'border-lime-300/45 bg-lime-400/10 shadow-[0_0_45px_rgba(132,204,22,0.32)]'}`}
            style={{ left: `${boss.position.x}%`, top: `${boss.position.y}%`, width: `${Math.max(190, hitRange * 7)}px`, height: `${Math.max(190, hitRange * 7)}px` }}
          />
          <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/35 bg-slate-950/75 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100" style={{ left: `${boss.position.x}%`, top: `calc(${boss.position.y}% + 8.5rem)` }}>
            {bossIsClose ? 'In hit range — flush now!' : `Hit circle range: ${hitRange}`}
          </div>

          {abilityVisuals.map((visual) => (
            <div key={visual.id} className="absolute -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-amber-200/40 bg-black/45 px-3 py-2 text-center shadow-xl" style={{ left: `${visual.x}%`, top: `${visual.y}%` }}>
              <div className="text-3xl">{visual.emoji}</div>
              <div className="mt-1 max-w-28 text-[8px] font-black uppercase tracking-[0.12em] text-amber-100">{visual.label}</div>
            </div>
          ))}

          {replicas.map((replica) => (
            <div key={replica.id} className="absolute -translate-x-1/2 -translate-y-1/2 animate-bounce rounded-full border border-lime-200/40 bg-emerald-950/70 px-3 py-2 text-4xl shadow-xl shadow-emerald-950/50" style={{ left: `${replica.x}%`, top: `${replica.y}%` }} aria-hidden="true">
              🦠
            </div>
          ))}

          <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ease-linear" style={{ left: `${boss.position.x}%`, top: `${boss.position.y}%` }}>
            <div className={`${bossIsRushing ? 'animate-bounce' : 'animate-pulse'} relative text-center`}>
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/20 blur-3xl" />
              <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-lime-200/30" />
              {bossHasShield && <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-yellow-300/60 shadow-[0_0_45px_rgba(250,204,21,0.45)]" />}
              <div className="relative rounded-[2rem] border border-lime-300/60 bg-slate-950/65 px-5 py-4 shadow-2xl shadow-emerald-950/70 backdrop-blur-sm">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[4.5rem] drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)]">👑</div>
                <div className="text-[6.5rem] leading-none drop-shadow-[0_18px_28px_rgba(0,0,0,0.8)] sm:text-[8rem]">🦠</div>
                <div className="mt-1 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-lime-100">{boss.name}</div>
                <div className="mt-2 text-[9px] font-black uppercase tracking-[0.22em] text-amber-200">Wave {boss.wave} • Distance {bossDistance} • {bossIsClose ? 'HITTABLE' : 'CHASE IT'}</div>
              </div>
            </div>
          </div>

          <div className="absolute right-4 top-24 w-[min(92vw,405px)] rounded-3xl border border-lime-400/55 bg-gradient-to-br from-emerald-950/95 via-slate-950/95 to-lime-950/95 p-4 text-white shadow-2xl shadow-emerald-950/50 backdrop-blur-md pointer-events-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-lime-200">Crowned bacteria boss</div>
                <div className="text-xl font-black leading-tight">👑🦠 {boss.name}</div>
                <div className="mt-1 text-[11px] text-slate-300">It follows the player. Flush only counts inside the glowing circle around the boss.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                <div className="text-[9px] uppercase tracking-wider text-slate-300">Jackpot</div>
                <div className="text-sm font-black text-amber-200">+{jackpot}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-300"><span>Boss HP</span><span>{Math.ceil(boss.hp)} / {boss.maxHp}</span></div>
              <div className="h-4 overflow-hidden rounded-full border border-lime-300/30 bg-slate-900"><div className="h-full bg-gradient-to-r from-lime-500 via-yellow-300 to-orange-300 transition-all duration-200" style={{ width: `${bossRatio * 100}%` }} /></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-wider text-slate-300">
              <div className={`rounded-xl border p-2 ${bossIsClose ? 'border-emerald-300/40 bg-emerald-900/35' : 'border-white/10 bg-white/5'}`}><div className="text-base font-black text-cyan-200">{bossDistance}</div><div>distance</div></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2"><div className="text-base font-black text-fuchsia-200">{abilitySlots}</div><div>abilities</div></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2"><div className="text-base font-black text-amber-200">{replicas.length}</div><div>replicas</div></div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-slate-200"><span className="font-black text-amber-200">Latest power:</span> {latestAbility}<div className="mt-1 text-[11px] text-lime-100">Tip: stand near the glowing circle and flush when the bacteria is close.</div></div>
            {status && <div className={`mt-3 rounded-2xl border px-3 py-2 text-xs font-bold ${status.tone === 'success' ? 'border-emerald-300/35 bg-emerald-900/35 text-emerald-100' : status.tone === 'warn' ? 'border-amber-300/35 bg-amber-900/35 text-amber-100' : 'border-cyan-300/35 bg-cyan-900/35 text-cyan-100'}`}>{status.text}</div>}
          </div>
        </div>
      )}
    </>
  );
}
