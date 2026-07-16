import { useEffect, useState, type ComponentProps } from 'react';
import SimplifiedGameAreaV18 from './SimplifiedGameAreaV18';

type GameAreaV18Props = ComponentProps<typeof SimplifiedGameAreaV18>;

type RuntimeLike = {
  active?: boolean;
  wave?: number;
  enemies?: Array<{ isBoss?: boolean }>;
  player?: unknown;
};

function isRuntimeLike(value: unknown): value is RuntimeLike {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as RuntimeLike;
  return Array.isArray(maybe.enemies) && maybe.player !== undefined;
}

function getRuntimeFromHookList(fiber: any): RuntimeLike | null {
  let hook = fiber?.memoizedState;
  let guard = 0;

  while (hook && guard < 140) {
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

function cleanWave(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function noticeForWave(wave: number) {
  return wave % 5 === 0 ? `BOSS WAVE ${wave}!` : `WAVE ${wave}`;
}

export default function SimplifiedGameAreaV19(props: GameAreaV18Props) {
  const [active, setActive] = useState(false);
  const [wave, setWave] = useState(1);
  const [flashNotice, setFlashNotice] = useState('WAVE 1');
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const runtime = findGameRuntime();
      if (!runtime) return;

      const nextActive = runtime.active === true;
      const nextWave = cleanWave(runtime.wave);

      setActive(nextActive);
      setWave((previousWave) => {
        if (nextActive && previousWave !== nextWave) {
          setFlashNotice(noticeForWave(nextWave));
          setFlashKey((previous) => previous + 1);
        }
        return nextWave;
      });
    }, 120);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="relative">
      {active && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-[9999] -translate-x-1/2 px-3 text-center md:top-28">
          <div
            key={flashKey}
            className={`animate-[pulse_1.2s_ease-out_1] rounded-3xl border px-6 py-3 font-mono text-xl font-black uppercase tracking-[0.18em] shadow-2xl backdrop-blur-md md:text-3xl ${
              wave % 5 === 0
                ? 'border-orange-300/70 bg-orange-500/30 text-orange-50 shadow-orange-950/40'
                : 'border-sky-300/70 bg-sky-500/25 text-sky-50 shadow-sky-950/40'
            }`}
          >
            {flashNotice}
          </div>
          <div className="mx-auto mt-2 w-fit rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
            Now playing wave {wave}
          </div>
        </div>
      )}

      <SimplifiedGameAreaV18 {...props} />
    </div>
  );
}
