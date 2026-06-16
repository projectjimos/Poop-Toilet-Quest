import { useEffect, type ReactNode } from 'react';

interface CoinLifetimeGateProps {
  children: ReactNode;
}

type CoinLike = {
  id?: unknown;
  x?: unknown;
  y?: unknown;
  size?: unknown;
  value?: unknown;
  bounceOffset?: unknown;
  __ptqCoinSpawnedAt?: number;
  __ptqCoinExpiresAt?: number;
};

type CoinLifetimeRuntime = {
  originalPush: typeof Array.prototype.push;
  coinArrays: Set<unknown[]>;
  owners: number;
};

const RUNTIME_KEY = '__ptqCoinLifetimeRuntime';
const COIN_TTL_MS = 15_000;
const CLEANUP_INTERVAL_MS = 1_000;

function getRuntime(): CoinLifetimeRuntime | undefined {
  return (window as unknown as Record<string, CoinLifetimeRuntime | undefined>)[RUNTIME_KEY];
}

function setRuntime(runtime: CoinLifetimeRuntime | undefined): void {
  const host = window as unknown as Record<string, CoinLifetimeRuntime | undefined>;
  if (!runtime) {
    delete host[RUNTIME_KEY];
    return;
  }
  host[RUNTIME_KEY] = runtime;
}

function isCoinLike(value: unknown): value is CoinLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as CoinLike;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.size === 'number' &&
    typeof candidate.value === 'number' &&
    typeof candidate.bounceOffset === 'number'
  );
}

function stampCoin(coin: CoinLike, now: number): void {
  if (!coin.__ptqCoinSpawnedAt) {
    Object.defineProperty(coin, '__ptqCoinSpawnedAt', {
      value: now,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }

  Object.defineProperty(coin, '__ptqCoinExpiresAt', {
    value: coin.__ptqCoinSpawnedAt + COIN_TTL_MS,
    writable: true,
    enumerable: false,
    configurable: true
  });
}

function pruneCoins(runtime: CoinLifetimeRuntime): number {
  const now = Date.now();
  let removed = 0;

  runtime.coinArrays.forEach((array) => {
    if (!Array.isArray(array)) {
      runtime.coinArrays.delete(array);
      return;
    }

    let hasCoinItems = false;

    for (let index = array.length - 1; index >= 0; index -= 1) {
      const item = array[index];
      if (!isCoinLike(item)) continue;
      hasCoinItems = true;

      const expiresAt = item.__ptqCoinExpiresAt || now + COIN_TTL_MS;
      if (expiresAt <= now) {
        array.splice(index, 1);
        removed += 1;
      }
    }

    if (!hasCoinItems && array.length === 0) {
      runtime.coinArrays.delete(array);
    }
  });

  if (removed > 0) {
    window.dispatchEvent(new CustomEvent('ptq:coin-pickups-expired', { detail: { removed } }));
  }

  return removed;
}

export default function CoinLifetimeGate({ children }: CoinLifetimeGateProps) {
  useEffect(() => {
    let runtime = getRuntime();

    if (!runtime) {
      const originalPush = Array.prototype.push;
      runtime = {
        originalPush,
        coinArrays: new Set<unknown[]>(),
        owners: 0
      };

      Array.prototype.push = function ptqCoinLifetimePush<T>(this: T[], ...items: T[]): number {
        const now = Date.now();
        let containsCoin = false;

        items.forEach((item) => {
          if (isCoinLike(item)) {
            stampCoin(item, now);
            containsCoin = true;
          }
        });

        const result = originalPush.apply(this, items);

        if (containsCoin) {
          runtime?.coinArrays.add(this as unknown[]);
        }

        return result;
      } as typeof Array.prototype.push;

      setRuntime(runtime);
    }

    runtime.owners += 1;

    const cleanupTimer = window.setInterval(() => {
      const activeRuntime = getRuntime();
      if (activeRuntime) pruneCoins(activeRuntime);
    }, CLEANUP_INTERVAL_MS);

    return () => {
      window.clearInterval(cleanupTimer);
      const activeRuntime = getRuntime();
      if (!activeRuntime) return;

      activeRuntime.owners = Math.max(0, activeRuntime.owners - 1);
      if (activeRuntime.owners === 0) {
        Array.prototype.push = activeRuntime.originalPush;
        setRuntime(undefined);
      }
    };
  }, []);

  return <>{children}</>;
}
