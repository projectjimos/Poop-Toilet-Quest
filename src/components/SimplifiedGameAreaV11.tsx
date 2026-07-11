import { useEffect, useMemo, type ComponentProps } from 'react';
import SimplifiedGameAreaV10 from './SimplifiedGameAreaV10';
import type { Toilet } from '../types';

type GameAreaV10Props = ComponentProps<typeof SimplifiedGameAreaV10>;

type EnemyLike = {
  id?: string;
  emoji?: string;
  name?: string;
  hp?: number;
  maxHp?: number;
  speed?: number;
  size?: number;
  scoreValue?: number;
  coinDrop?: number;
  x?: number;
  y?: number;
  isBoss?: boolean;
  bossWave?: number;
  lastSummonMs?: number;
};

type RuntimeLike = {
  active?: boolean;
  wave?: number;
  player?: {
    speed?: number;
    hp?: number;
    x?: number;
    y?: number;
  };
  enemies?: EnemyLike[];
  coins?: unknown[];
};

const WORLD_SIZE = 1500;
const BASE_PLAYER_SPEED = 250;
const MAX_PLAYER_SPEED = 430;
const GAMEPLAY_TUNE_INTERVAL_MS = 250;
const DEFAULT_BOSS_SUMMON_INTERVAL_MS = 5000;
const FASTEST_BOSS_SUMMON_INTERVAL_MS = 900;

const SUMMON_TROOPS = [
  { emoji: '🦠', name: 'Boss Germ Troop', hp: 18, speed: 76, size: 25, scoreValue: 1, coinDrop: 1 },
  { emoji: '🪰', name: 'Boss Fly Troop', hp: 16, speed: 98, size: 24, scoreValue: 1, coinDrop: 1 },
  { emoji: '🧻', name: 'Boss Paper Troop', hp: 30, speed: 62, size: 30, scoreValue: 2, coinDrop: 2 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function speedForToilet(toilet: Toilet) {
  const levelScore = Math.max(1, toilet.level || 1);
  const costScore = Math.floor(Math.sqrt(Math.max(0, toilet.cost)) / 3);
  const damageScore = Math.floor(Math.max(0, toilet.damage) / 28);
  const powerScore = Math.max(levelScore, costScore, damageScore);
  const speedBonus = clamp(Math.floor((powerScore - 1) * 4.5), 0, MAX_PLAYER_SPEED - BASE_PLAYER_SPEED);
  return BASE_PLAYER_SPEED + speedBonus;
}

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function bossTierFor(enemy: EnemyLike) {
  const bossWave = typeof enemy.bossWave === 'number' ? enemy.bossWave : 5;
  return Math.max(1, Math.floor(bossWave / 5));
}

function bossSummonIntervalMs(tier: number) {
  return clamp(Math.round(DEFAULT_BOSS_SUMMON_INTERVAL_MS / tier), FASTEST_BOSS_SUMMON_INTERVAL_MS, DEFAULT_BOSS_SUMMON_INTERVAL_MS);
}

function maxSummonedTroops(tier: number) {
  return clamp(3 + tier * 2, 5, 16);
}

function slowBossSpeed(tier: number) {
  return clamp(28 + tier * 2, 28, 48);
}

function makeSummonedTroop(boss: EnemyLike, tier: number): EnemyLike {
  const troop = SUMMON_TROOPS[Math.floor(Math.random() * Math.min(SUMMON_TROOPS.length, 1 + Math.ceil(tier / 2)))];
  const angle = Math.random() * Math.PI * 2;
  const radius = 72 + Math.random() * 95;
  const x = clamp((boss.x || WORLD_SIZE / 2) + Math.cos(angle) * radius, 35, WORLD_SIZE - 35);
  const y = clamp((boss.y || WORLD_SIZE / 2) + Math.sin(angle) * radius, 35, WORLD_SIZE - 35);
  const hp = Math.round(troop.hp + tier * 4);

  return {
    ...troop,
    id: id('boss_troop'),
    x,
    y,
    hp,
    maxHp: hp,
    speed: clamp(troop.speed + tier * 3, troop.speed, 125),
    scoreValue: troop.scoreValue + Math.floor(tier / 2),
    coinDrop: troop.coinDrop + Math.floor(tier / 3),
    isBoss: false,
  };
}

function tuneBossSummons(runtime: RuntimeLike, now = performance.now()) {
  if (!runtime.active || !Array.isArray(runtime.enemies)) return;

  const boss = runtime.enemies.find((enemy) => enemy?.isBoss === true);
  if (!boss) return;

  const tier = bossTierFor(boss);
  if (typeof boss.speed === 'number') {
    boss.speed = slowBossSpeed(tier);
  }

  const existingTroops = runtime.enemies.filter((enemy) => enemy?.isBoss !== true);
  if (existingTroops.length >= maxSummonedTroops(tier)) return;

  if (typeof boss.lastSummonMs !== 'number') {
    boss.lastSummonMs = now;
    return;
  }

  const intervalMs = bossSummonIntervalMs(tier);
  if (now - boss.lastSummonMs < intervalMs) return;

  boss.lastSummonMs = now;
  runtime.enemies.push(makeSummonedTroop(boss, tier));
}

function isRuntimeLike(value: unknown): value is RuntimeLike {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as RuntimeLike;
  return (
    maybe.player !== undefined &&
    typeof maybe.player === 'object' &&
    typeof maybe.player.speed === 'number' &&
    Array.isArray(maybe.enemies) &&
    Array.isArray(maybe.coins)
  );
}

function getRuntimeFromHookList(fiber: any): RuntimeLike | null {
  let hook = fiber?.memoizedState;
  let guard = 0;

  while (hook && guard < 80) {
    const possibleRefValue = hook.memoizedState?.current;
    if (isRuntimeLike(possibleRefValue)) return possibleRefValue;

    const possibleDirectValue = hook.memoizedState;
    if (isRuntimeLike(possibleDirectValue)) return possibleDirectValue;

    hook = hook.next;
    guard += 1;
  }

  return null;
}

function findRuntimeFromFiber(fiber: any, seen = new Set<any>()): RuntimeLike | null {
  if (!fiber || seen.has(fiber)) return null;
  seen.add(fiber);

  const runtimeFromHooks = getRuntimeFromHookList(fiber);
  if (runtimeFromHooks) return runtimeFromHooks;

  return (
    findRuntimeFromFiber(fiber.child, seen) ||
    findRuntimeFromFiber(fiber.sibling, seen) ||
    findRuntimeFromFiber(fiber.alternate, seen)
  );
}

function findGameRuntime() {
  const root = document.getElementById('root');
  if (!root) return null;

  const reactKey = Object.keys(root).find((key) => key.startsWith('__reactContainer$') || key.startsWith('__reactFiber$'));
  if (!reactKey) return null;

  const rootValue = (root as any)[reactKey];
  const startingFiber = rootValue?.current || rootValue;
  return findRuntimeFromFiber(startingFiber);
}

function tuneRuntime(playerSpeed: number) {
  const runtime = findGameRuntime();
  if (!runtime?.player) return false;

  runtime.player.speed = playerSpeed;
  tuneBossSummons(runtime);
  return true;
}

export default function SimplifiedGameAreaV11(props: GameAreaV10Props) {
  const playerSpeed = useMemo(() => speedForToilet(props.activeToilet), [
    props.activeToilet.id,
    props.activeToilet.level,
    props.activeToilet.cost,
    props.activeToilet.damage,
  ]);

  const speedBonus = playerSpeed - BASE_PLAYER_SPEED;

  useEffect(() => {
    const tuneGameplay = () => tuneRuntime(playerSpeed);

    tuneGameplay();
    const intervalId = window.setInterval(tuneGameplay, GAMEPLAY_TUNE_INTERVAL_MS);
    const onPlayRequested = () => window.setTimeout(tuneGameplay, 0);

    window.addEventListener('ptq:play-requested', onPlayRequested);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('ptq:play-requested', onPlayRequested);
    };
  }, [playerSpeed]);

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 font-mono text-xs font-bold text-cyan-100">
        Equipped toilet speed: {playerSpeed} movement speed
        {speedBonus > 0 ? ` · +${speedBonus} from ${props.activeToilet.name}` : ' · starter speed'}
      </div>
      <SimplifiedGameAreaV10 {...props} />
    </div>
  );
}
