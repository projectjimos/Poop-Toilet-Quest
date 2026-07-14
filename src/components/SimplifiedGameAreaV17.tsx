import { useEffect, useRef, useState, type ComponentProps } from 'react';
import SimplifiedGameAreaV15 from './SimplifiedGameAreaV15';

const WAVE_GUARD_INTERVAL_MS = 50;
const MAX_WAVE_JUMP = 1;
const MIN_WAVE_DURATION_MS = 6500;

// Bosses are allowed only for the current stable wave or the next real wave.
// This blocks score-glitch bosses like Wave 190 or Wave 5 billion before they can appear.
const BOSS_GRACE_WAVES = 1;

type GameAreaV15Props = ComponentProps<typeof SimplifiedGameAreaV15>;

type EnemyLike = {
  isBoss?: boolean;
  bossWave?: number;
  hp?: number;
  maxHp?: number;
  name?: string;
};

type RuntimeLike = {
  active?: boolean;
  wave?: number;
  bossWaveSpawned?: number;
  bossDefeatedWaves?: number[];
  enemies?: EnemyLike[];
  player?: {
    x?: number;
    y?: number;
  };
  particles?: Array<{
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    text: string;
    color: string;
    life: number;
    maxLife: number;
  }>;
};

function isRuntimeLike(value: unknown): value is RuntimeLike {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as RuntimeLike;
  return Array.isArray(maybe.enemies) && maybe.player !== undefined && typeof maybe.player === 'object';
}

function getRuntimeFromHookList(fiber: any): RuntimeLike | null {
  let hook = fiber?.memoizedState;
  let guard = 0;

  while (hook && guard < 120) {
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

function clampWave(value: number) {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.max(1, Math.floor(value));
}

function particleId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addWaveAnnouncement(runtime: RuntimeLike, text: string, color: string) {
  if (!Array.isArray(runtime.particles)) return;
  const playerX = runtime.player?.x || 750;
  const playerY = runtime.player?.y || 750;
  runtime.particles.push({
    id: particleId('wave_notice'),
    x: playerX,
    y: playerY - 88,
    vx: 0,
    vy: -35,
    text,
    color,
    life: 0,
    maxLife: 1200,
  });
}

function announcementForWave(wave: number) {
  return wave % 5 === 0 ? `BOSS WAVE ${wave}!` : `WAVE ${wave}`;
}

function isAbsurdBoss(item: unknown, lastStableWave: number) {
  if (!item || typeof item !== 'object') return false;
  const enemy = item as EnemyLike;
  if (enemy.isBoss !== true || typeof enemy.bossWave !== 'number') return false;

  const bossWave = clampWave(enemy.bossWave);
  return bossWave > lastStableWave + BOSS_GRACE_WAVES;
}

function sanitizeRuntimeWave(runtime: RuntimeLike, lastStableWave: number, lastWaveAdvanceAt: number, now: number) {
  if (!runtime.active) return { wave: 1, changed: lastStableWave !== 1, blocked: false, waiting: false };

  const rawWave = clampWave(typeof runtime.wave === 'number' ? runtime.wave : lastStableWave);
  let nextWave = lastStableWave;
  let waiting = false;

  if (rawWave < lastStableWave) {
    nextWave = rawWave;
  } else if (rawWave > lastStableWave) {
    const canAdvance = now - lastWaveAdvanceAt >= MIN_WAVE_DURATION_MS;
    if (canAdvance) {
      nextWave = Math.min(rawWave, lastStableWave + MAX_WAVE_JUMP);
    } else {
      waiting = true;
    }
  }

  const blocked = rawWave !== nextWave;
  if (runtime.wave !== nextWave) runtime.wave = nextWave;

  if (typeof runtime.bossWaveSpawned === 'number' && runtime.bossWaveSpawned > nextWave + BOSS_GRACE_WAVES) {
    runtime.bossWaveSpawned = nextWave % 5 === 0 ? nextWave : 0;
  }

  if (Array.isArray(runtime.bossDefeatedWaves)) {
    runtime.bossDefeatedWaves = runtime.bossDefeatedWaves.filter((wave) => Number.isFinite(wave) && wave <= nextWave + BOSS_GRACE_WAVES);
  }

  return { wave: nextWave, changed: nextWave !== lastStableWave, blocked, waiting };
}

export default function SimplifiedGameAreaV17(props: GameAreaV15Props) {
  const lastStableWaveRef = useRef(1);
  const lastWaveAdvanceAtRef = useRef(Date.now());
  const [waveNotice, setWaveNotice] = useState('Wave 1');
  const [blockedJumpNotice, setBlockedJumpNotice] = useState<string | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const runtime = findGameRuntime();
      if (!runtime) return;

      const now = Date.now();
      const previousWave = lastStableWaveRef.current;
      const result = sanitizeRuntimeWave(runtime, previousWave, lastWaveAdvanceAtRef.current, now);
      const nextWave = result.wave;

      if (result.blocked && result.waiting) {
        setBlockedJumpNotice(`Holding Wave ${previousWave} so normal waves are not skipped`);
      } else if (result.blocked) {
        const notice = `Blocked fake wave jump → kept Wave ${nextWave}`;
        setBlockedJumpNotice(notice);
        addWaveAnnouncement(runtime, 'WAVE GLITCH BLOCKED!', '#67e8f9');
      }

      if (result.changed) {
        lastStableWaveRef.current = nextWave;
        lastWaveAdvanceAtRef.current = now;
        const text = announcementForWave(nextWave);
        setWaveNotice(text);
        setBlockedJumpNotice(null);
        addWaveAnnouncement(runtime, text, nextWave % 5 === 0 ? '#fb923c' : '#fbbf24');
      }
    }, WAVE_GUARD_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const originalPush = Array.prototype.push;

    Array.prototype.push = function pacedWaveSafetyPush(...items: unknown[]) {
      const filteredItems = items.filter((item) => !isAbsurdBoss(item, lastStableWaveRef.current));
      if (filteredItems.length !== items.length) {
        setBlockedJumpNotice(`Blocked early boss wave after Wave ${lastStableWaveRef.current}`);
      }
      return originalPush.apply(this, filteredItems);
    };

    return () => {
      if (Array.prototype.push.name === 'pacedWaveSafetyPush') {
        Array.prototype.push = originalPush;
      }
    };
  }, []);

  return (
    <div className="grid gap-3">
      <section className="rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-3 font-mono text-xs font-bold text-sky-100 shadow-lg shadow-sky-950/20">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-200">Wave Announcer</div>
            <div className="mt-1 text-lg font-black uppercase text-white">{waveNotice}</div>
          </div>
          <div className="rounded-xl border border-sky-200/25 bg-slate-950/80 px-3 py-2 text-sky-100">
            Normal waves are paced. Bosses cannot skip ahead.
          </div>
        </div>
        {blockedJumpNotice && <div className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-cyan-100">{blockedJumpNotice}</div>}
      </section>

      <SimplifiedGameAreaV15 {...props} />
    </div>
  );
}
