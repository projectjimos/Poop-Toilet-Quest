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

type BossPosition = {
  x: number;
  y: number;
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
  position: BossPosition;
  spawnedAt: number;
};

type BossStatus = {
  text: string;
  tone: 'warn' | 'success' | 'info';
  id: number;
};

type BossAbility = {
  id: string;
  name: string;
  emoji: string;
  kind: 'replica' | 'projectile' | 'berserk' | 'lava' | 'bleach' | 'surge';
  weight: number;
};

type AbilityVisual = {
  id: number;
  emoji: string;
  label: string;
  kind: BossAbility['kind'];
  x: number;
  y: number;
  expiresAt: number;
};

type MiniReplica = {
  id: number;
  emoji: string;
  x: number;
  y: number;
  expiresAt: number;
};

const WAVE_LABEL_PATTERN = /Poop Crusader\s*Level\s*(\d+)/i;
const UTILITY_EVENT = 'ptq:utilities-updated';
const COINS_EVENT = 'ptq:coins-updated';
const PLAYER_TARGET: BossPosition = { x: 50, y: 55 };
const BODY_PRESSURE_RANGE = 24;
const BASE_ABILITY_COOLDOWN_MS = 4300;

const BOSS_POOL = [
  { name: 'Plunger Titan', emoji: '🪠👑' },
  { name: 'Germ King', emoji: '🦠👑' },
  { name: 'Paper Beast', emoji: '🧻👹' },
  { name: 'Mega Brush', emoji: '🪥⚡' },
  { name: 'Sewer Overlord', emoji: '🚽🌌' }
];

const ABILITY_FAMILIES: Array<Omit<BossAbility, 'id' | 'name' | 'weight'>> = [
  { emoji: '👥', kind: 'replica' },
  { emoji: '🟣', kind: 'projectile' },
  { emoji: '😡', kind: 'berserk' },
  { emoji: '🌋', kind: 'lava' },
  { emoji: '🧪', kind: 'bleach' },
  { emoji: '⚡', kind: 'surge' }
];

const ABILITY_LIBRARY: BossAbility[] = Array.from({ length: 120 }, (_, index) => {
  const family = ABILITY_FAMILIES[index % ABILITY_FAMILIES.length];
  const tier = Math.floor(index / ABILITY_FAMILIES.length) + 1;
  const familyName = {
    replica: 'Mini Replica Swarm',
    projectile: 'Sewer Orb Volley',
    berserk: 'Berserk Rush',
    lava: 'Lava Wave',
    bleach: 'Bleach Storm',
    surge: 'Power Surge'
  }[family.kind];

  return {
    ...family,
    id: `${family.kind}-${tier}`,
    name: `${familyName} ${tier}`,
    weight: 1 + tier * 0.03
  };
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

function distanceBetween(a: BossPosition, b: BossPosition = PLAYER_TARGET): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getSpawnPosition(wave: number): BossPosition {
  const side = Math.floor(wave / 5) % 4;
  if (side === 0) return { x: 12, y: 24 };
  if (side === 1) return { x: 88, y: 28 };
  if (side === 2) return { x: 86, y: 82 };
  return { x: 14, y: 78 };
}

function getAbilitySlots(wave: number): number {
  return Math.min(12, Math.max(1, Math.floor(wave / 5)));
}

function getAvailableAbilities(wave: number): BossAbility[] {
  return ABILITY_LIBRARY.slice(0, Math.min(ABILITY_LIBRARY.length, getAbilitySlots(wave) * 10));
}

function makeBossForWave(wave: number): BossState {
  const bossPick = BOSS_POOL[Math.floor((wave / 5 - 1) % BOSS_POOL.length)];
  const abilitySlots = getAbilitySlots(wave);
  const maxHp = 1050 + wave * 330 + abilitySlots * 360;

  return {
    wave,
    name: bossPick.name,
    emoji: bossPick.emoji,
    hp: maxHp,
    maxHp,
    rewardCoins: 160 + wave * 34 + abilitySlots * 90,
    pressureCost: Math.min(230, 16 + wave * 4 + abilitySlots * 7),
    defeated: false,
    position: getSpawnPosition(wave),
    spawnedAt: Date.now()
  };
}

function getFlushRange(toilet: Toilet): number {
  return Math.min(42, Math.max(18, toilet.flushRadius / 14));
}

function getBossDamage(toilet: Toilet, boss: BossState, hasReplicas: boolean, isBerserk: boolean): number {
  const rawDamage = Math.max(12, Math.round(toilet.damage * 0.52 + toilet.level * 4.5));
  const perFlushCap = Math.max(55, Math.round(boss.maxHp * 0.115));
  const replicaPenalty = hasReplicas ? 0.82 : 1;
  const berserkPenalty = isBerserk ? 0.68 : 1;
  return Math.max(8, Math.round(Math.min(rawDamage, perFlushCap) * replicaPenalty * berserkPenalty));
}

function makeStatus(text: string, tone: BossStatus['tone'] = 'info'): BossStatus {
  return { text, tone, id: Date.now() };
}

function writeProfileReward(profile: string, boss: BossState): void {
  const jackpotCoins = boss.rewardCoins + Math.round(boss.maxHp * 0.045);
  const nextCoins = writeNumber(coinsKey(profile), readNumber(coinsKey(profile), 0) + jackpotCoins);
  const nextWater = writeNumber(waterKey(profile), readNumber(waterKey(profile), 500) + Math.round(jackpotCoins * 0.55));
  const nextPower = writeNumber(electricityKey(profile), readNumber(electricityKey(profile), 500) + Math.round(jackpotCoins * 0.55));

  window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: { profile, amount: nextCoins } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'water', amount: nextWater } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'electricity', amount: nextPower } }));
}

function drainProfileUtilities(profile: string, waterCost: number, powerCost: number): void {
  const nextWater = writeNumber(waterKey(profile), Math.max(0, readNumber(waterKey(profile), 500) - waterCost));
  const nextPower = writeNumber(electricityKey(profile), Math.max(0, readNumber(electricityKey(profile), 500) - powerCost));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'water', amount: nextWater } }));
  window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: { profile, kind: 'electricity', amount: nextPower } }));
}

export default function BossEncounterGate({ children }: BossEncounterGateProps) {
  const [boss, setBoss] = useState<BossState | null>(null);
  const [status, setStatus] = useState<BossStatus | null>(null);
  const [abilityVisuals, setAbilityVisuals] = useState<AbilityVisual[]>([]);
  const [replicas, setReplicas] = useState<MiniReplica[]>([]);
  const [lastAbilityName, setLastAbilityName] = useState<string>('Tracking player');
  const bossRef = useRef<BossState | null>(null);
  const replicasRef = useRef<MiniReplica[]>([]);
  const defeatedWavesRef = useRef<Set<number>>(new Set());
  const lastBossWaveRef = useRef<number | null>(null);
  const lastPressureRef = useRef<number>(0);
  const lastAbilityRef = useRef<number>(0);
  const berserkUntilRef = useRef<number>(0);
  const lastFlushHitRef = useRef<Record<string, number>>({});
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    bossRef.current = boss;
  }, [boss]);

  useEffect(() => {
    replicasRef.current = replicas;
  }, [replicas]);

  const bossRatio = useMemo(() => {
    if (!boss) return 0;
    return Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  }, [boss]);

  const bossDistance = useMemo(() => {
    if (!boss) return 999;
    return Math.round(distanceBetween(boss.position));
  }, [boss]);

  const activeAbilitySlots = useMemo(() => (boss ? getAbilitySlots(boss.wave) : 0), [boss]);

  useEffect(() => {
    if (!status) return;
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(null), 3300);
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
        setReplicas([]);
        setAbilityVisuals([]);
        lastBossWaveRef.current = null;
        return;
      }

      if (wave % 5 !== 0) {
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
        setLastAbilityName('Hunting the player');
        setStatus(makeStatus(`${nextBoss.emoji} ${nextBoss.name} spawned on the battlefield! Wave ${wave} boss has ${getAbilitySlots(wave)} ability slot(s).`, 'warn'));
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
        const isBerserk = Date.now() < berserkUntilRef.current;
        const step = Math.min(2.1, 0.42 + current.wave * 0.012 + (isBerserk ? 0.42 : 0));
        const dx = PLAYER_TARGET.x - current.position.x;
        const dy = PLAYER_TARGET.y - current.position.y;
        const ratio = distance > 0 ? Math.min(step / distance, 1) : 0;
        const wobble = Math.sin(Date.now() / 450 + current.wave) * 0.16;

        return {
          ...current,
          position: {
            x: Math.max(6, Math.min(94, current.position.x + dx * ratio + wobble)),
            y: Math.max(14, Math.min(88, current.position.y + dy * ratio))
          }
        };
      });
    }, 120);

    return () => window.clearInterval(moveInterval);
  }, []);

  useEffect(() => {
    const cleanupInterval = window.setInterval(() => {
      const now = Date.now();
      setAbilityVisuals((items) => items.filter((item) => item.expiresAt > now));
      setReplicas((items) => items.filter((item) => item.expiresAt > now));
    }, 500);

    return () => window.clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    const pressureInterval = window.setInterval(() => {
      const activeBoss = bossRef.current;
      if (!activeBoss || activeBoss.defeated || !isGameActivelyPlaying()) return;
      if (distanceBetween(activeBoss.position) > BODY_PRESSURE_RANGE) return;

      const now = Date.now();
      if (now - lastPressureRef.current < 2500) return;
      lastPressureRef.current = now;

      const profile = getActiveProfile();
      if (!profile) return;

      const abilityPressure = Math.max(1, getAbilitySlots(activeBoss.wave));
      const waterCost = activeBoss.pressureCost + abilityPressure * 3;
      const powerCost = Math.ceil(activeBoss.pressureCost * 1.18 + abilityPressure * 4);
      drainProfileUtilities(profile, waterCost, powerCost);
      setStatus(makeStatus(`${activeBoss.name} is in range! Pressure drained ${waterCost} water and ${powerCost} electricity.`, 'warn'));
    }, 650);

    return () => window.clearInterval(pressureInterval);
  }, []);

  useEffect(() => {
    const useAbility = (ability: BossAbility, activeBoss: BossState) => {
      const profile = getActiveProfile();
      const now = Date.now();
      setLastAbilityName(ability.name);
      setAbilityVisuals((items) => [
        ...items,
        {
          id: now,
          emoji: ability.emoji,
          label: ability.name,
          kind: ability.kind,
          x: Math.max(12, Math.min(88, activeBoss.position.x + (Math.random() * 18 - 9))),
          y: Math.max(18, Math.min(86, activeBoss.position.y + (Math.random() * 18 - 9))),
          expiresAt: now + 1900
        }
      ]);

      if (ability.kind === 'replica') {
        const count = Math.min(7, 2 + getAbilitySlots(activeBoss.wave));
        setReplicas((items) => [
          ...items,
          ...Array.from({ length: count }, (_, index) => ({
            id: now + index,
            emoji: activeBoss.emoji,
            x: Math.max(8, Math.min(92, activeBoss.position.x + Math.cos(index) * (8 + index))),
            y: Math.max(16, Math.min(88, activeBoss.position.y + Math.sin(index) * (7 + index))),
            expiresAt: now + 7500
          }))
        ]);
        setStatus(makeStatus(`${activeBoss.name} made mini replicas. Clear the boss before the swarm builds up!`, 'warn'));
        return;
      }

      if (ability.kind === 'berserk') {
        berserkUntilRef.current = now + 6500;
        setStatus(makeStatus(`${activeBoss.name} went berserk: faster movement and stronger resistance!`, 'warn'));
        return;
      }

      if (!profile) return;
      const distance = distanceBetween(activeBoss.position);
      const closePenalty = distance <= BODY_PRESSURE_RANGE ? 1 : 0.45;
      const waveScale = Math.max(1, Math.floor(activeBoss.wave / 5));
      const baseDrain = Math.round((10 + waveScale * 7) * closePenalty * ability.weight);

      if (ability.kind === 'projectile') {
        drainProfileUtilities(profile, baseDrain, baseDrain + 8);
        setStatus(makeStatus(`${activeBoss.name} launched sewer orbs. Stay moving to protect utilities.`, 'warn'));
      } else if (ability.kind === 'lava') {
        drainProfileUtilities(profile, baseDrain + 12, Math.round(baseDrain * 0.75));
        setStatus(makeStatus(`${activeBoss.name} summoned lava waves around the arena.`, 'warn'));
      } else if (ability.kind === 'bleach') {
        drainProfileUtilities(profile, Math.round(baseDrain * 1.2), baseDrain + 4);
        setStatus(makeStatus(`${activeBoss.name} spread bleach zones. Keep distance from the boss.`, 'warn'));
      } else if (ability.kind === 'surge') {
        drainProfileUtilities(profile, Math.round(baseDrain * 0.7), baseDrain + 16);
        setStatus(makeStatus(`${activeBoss.name} caused a power surge. Electricity took the bigger hit.`, 'warn'));
      }
    };

    const abilityInterval = window.setInterval(() => {
      const activeBoss = bossRef.current;
      if (!activeBoss || activeBoss.defeated || !isGameActivelyPlaying()) return;

      const now = Date.now();
      const cooldown = Math.max(2300, BASE_ABILITY_COOLDOWN_MS - getAbilitySlots(activeBoss.wave) * 130);
      if (now - lastAbilityRef.current < cooldown) return;
      lastAbilityRef.current = now;

      const abilities = getAvailableAbilities(activeBoss.wave);
      const index = Math.floor((now / cooldown + activeBoss.wave) % abilities.length);
      useAbility(abilities[index], activeBoss);
    }, 500);

    return () => window.clearInterval(abilityInterval);
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
      const hitRange = getFlushRange(toilet);
      const distance = distanceBetween(activeBoss.position);

      if (profile && (currentWater < waterCost || currentPower < powerCost)) return;

      if (distance > hitRange) {
        setStatus(makeStatus(`${activeBoss.name} is too far away. Get within ${Math.round(hitRange)} range to hit it.`, 'warn'));
        return;
      }

      const hitSlot = `${flushName}:${activeBoss.wave}`;
      const now = Date.now();
      const nextAllowed = lastFlushHitRef.current[hitSlot] || 0;
      if (now < nextAllowed) return;
      lastFlushHitRef.current[hitSlot] = now + Math.max(650, toilet.cooldownMs - 75);

      const isBerserk = now < berserkUntilRef.current;
      const hasReplicas = replicasRef.current.length > 0;
      const damage = getBossDamage(toilet, activeBoss, hasReplicas, isBerserk);

      setBoss((prev) => {
        if (!prev || prev.wave !== activeBoss.wave || prev.defeated) return prev;
        const nextHp = Math.max(0, prev.hp - damage);

        if (nextHp <= 0) {
          defeatedWavesRef.current.add(prev.wave);
          const defeatedBoss = { ...prev, hp: 0, defeated: true };
          const activeProfile = getActiveProfile();
          if (activeProfile) writeProfileReward(activeProfile, prev);
          const jackpot = prev.rewardCoins + Math.round(prev.maxHp * 0.045);
          setStatus(makeStatus(`JACKPOT! ${prev.emoji} ${prev.name} cleared. +${jackpot} coins plus water and electricity.`, 'success'));
          setReplicas([]);
          setAbilityVisuals([]);
          playUnlockSound();
          window.setTimeout(() => setBoss((current) => (current?.wave === prev.wave ? null : current)), 1900);
          return defeatedBoss;
        }

        playDamageSound();
        setStatus(makeStatus(`${toilet.emoji} ${toilet.name} hit ${prev.name} for ${damage} HP. Distance: ${Math.round(distance)}.`, 'info'));
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

  const bossHitRangeLabel = useMemo(() => {
    const profile = getActiveProfile();
    return Math.round(getFlushRange(getActiveToilet(profile)));
  }, [boss, status]);

  return (
    <>
      {children}

      {boss && (
        <div className="fixed inset-0 z-[334] pointer-events-none font-mono" aria-live="polite">
          <div className="absolute left-1/2 top-[55%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-200/20 bg-cyan-300/5 shadow-[0_0_40px_rgba(34,211,238,0.18)]" />
          <div className="absolute left-1/2 top-[55%] -translate-x-1/2 translate-y-[5.5rem] rounded-full border border-cyan-200/30 bg-slate-950/65 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
            Flush hit range: {bossHitRangeLabel}
          </div>

          {abilityVisuals.map((visual) => (
            <div
              key={visual.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-amber-200/40 bg-black/45 px-3 py-2 text-center shadow-xl"
              style={{ left: `${visual.x}%`, top: `${visual.y}%` }}
            >
              <div className="text-3xl">{visual.emoji}</div>
              <div className="mt-1 max-w-28 text-[8px] font-black uppercase tracking-[0.12em] text-amber-100">{visual.label}</div>
            </div>
          ))}

          {replicas.map((replica) => (
            <div
              key={replica.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 animate-bounce rounded-2xl border border-red-200/30 bg-slate-950/60 px-2 py-1 text-3xl shadow-xl shadow-red-950/40"
              style={{ left: `${replica.x}%`, top: `${replica.y}%` }}
              aria-hidden="true"
            >
              {replica.emoji}
            </div>
          ))}

          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ease-linear"
            style={{ left: `${boss.position.x}%`, top: `${boss.position.y}%` }}
          >
            <div className={`${Date.now() < berserkUntilRef.current ? 'animate-bounce' : 'animate-pulse'} relative text-center`}>
              <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/25 blur-3xl" />
              <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-red-300/30" />
              <div className="relative rounded-[2rem] border border-red-300/50 bg-slate-950/50 px-4 py-3 shadow-2xl shadow-red-950/60 backdrop-blur-sm">
                <div className="text-[5.2rem] leading-none drop-shadow-[0_18px_28px_rgba(0,0,0,0.8)] sm:text-[7rem]">{boss.emoji}</div>
                <div className="mt-1 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-100">
                  {boss.name}
                </div>
                <div className="mt-2 text-[9px] font-black uppercase tracking-[0.22em] text-amber-200">
                  Wave {boss.wave} boss • Distance {bossDistance}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute right-4 top-24 w-[min(92vw,390px)] rounded-3xl border border-red-400/55 bg-gradient-to-br from-red-950/95 via-slate-950/95 to-purple-950/95 p-4 text-white shadow-2xl shadow-red-950/50 backdrop-blur-md pointer-events-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-red-200">Physical boss wave</div>
                <div className="text-xl font-black leading-tight">{boss.emoji} {boss.name}</div>
                <div className="mt-1 text-[11px] text-slate-300">Follows the player. Flush only counts when the boss is inside range.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                <div className="text-[9px] uppercase tracking-wider text-slate-300">Jackpot</div>
                <div className="text-sm font-black text-amber-200">+{boss.rewardCoins + Math.round(boss.maxHp * 0.045)}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-300">
                <span>Boss HP</span>
                <span>{Math.ceil(boss.hp)} / {boss.maxHp}</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full border border-red-300/30 bg-slate-900">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300 transition-all duration-200"
                  style={{ width: `${bossRatio * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-wider text-slate-300">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="text-base font-black text-cyan-200">{bossDistance}</div>
                <div>distance</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="text-base font-black text-fuchsia-200">{activeAbilitySlots}</div>
                <div>ability slots</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="text-base font-black text-amber-200">{replicas.length}</div>
                <div>replicas</div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-slate-200">
              <span className="font-black text-amber-200">Latest power:</span> {lastAbilityName}
            </div>

            {status && (
              <div className={`mt-3 rounded-2xl border px-3 py-2 text-xs font-bold ${status.tone === 'success' ? 'border-emerald-300/35 bg-emerald-900/35 text-emerald-100' : status.tone === 'warn' ? 'border-amber-300/35 bg-amber-900/35 text-amber-100' : 'border-cyan-300/35 bg-cyan-900/35 text-cyan-100'}`}>
                {status.text}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
