import { useEffect, useMemo, type ComponentProps } from 'react';
import SimplifiedGameAreaV10 from './SimplifiedGameAreaV10';
import type { Toilet } from '../types';

type GameAreaV10Props = ComponentProps<typeof SimplifiedGameAreaV10>;

type RuntimeLike = {
  active?: boolean;
  player?: {
    speed?: number;
    hp?: number;
    x?: number;
    y?: number;
  };
  enemies?: unknown[];
  coins?: unknown[];
};

const BASE_PLAYER_SPEED = 250;
const MAX_PLAYER_SPEED = 430;
const SPEED_APPLY_INTERVAL_MS = 250;

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

function applyPlayerSpeed(speed: number) {
  const runtime = findGameRuntime();
  if (!runtime?.player) return false;
  runtime.player.speed = speed;
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
    const applySpeed = () => applyPlayerSpeed(playerSpeed);

    applySpeed();
    const intervalId = window.setInterval(applySpeed, SPEED_APPLY_INTERVAL_MS);
    const onPlayRequested = () => window.setTimeout(applySpeed, 0);

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
