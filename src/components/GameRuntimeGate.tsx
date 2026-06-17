import { useEffect, type ReactNode } from 'react';

type EnemyLike = {
  id?: unknown;
  type?: unknown;
  emoji?: unknown;
  name?: unknown;
  x?: unknown;
  y?: unknown;
  hp?: unknown;
  maxHp?: unknown;
  speed?: unknown;
  size?: unknown;
  scoreValue?: unknown;
  __ptqWave?: number;
};

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

type GameRuntime = {
  originalPush: typeof Array.prototype.push;
  owners: number;
  enemyArrays: Set<unknown[]>;
  coinArrays: Set<unknown[]>;
  active: boolean;
  currentWave: number;
  targetQuota: number;
  spawnedThisWave: number;
  liveEnemies: number;
  bossRequired: boolean;
  bossDefeated: boolean;
  lastActiveState: boolean;
  gateOpenUntil: number;
};

const RUNTIME_KEY = '__ptqWaveClearRuntime';
const WAVE_UPDATE_EVENT = 'ptq:wave-director-updated';
const COIN_EXPIRED_EVENT = 'ptq:coin-pickups-expired';
const PLAY_REQUESTED_EVENT = 'ptq:play-requested';
const TICK_MS = 900;
const COIN_TTL_MS = 15_000;
const ACTIVE_CHECK_CACHE_MS = 1200;

let lastActiveCheckAt = 0;
let lastActiveCheckValue = false;

function getRuntime(): GameRuntime | undefined {
  return (window as unknown as Record<string, GameRuntime | undefined>)[RUNTIME_KEY];
}

function setRuntime(runtime: GameRuntime | undefined): void {
  const host = window as unknown as Record<string, GameRuntime | undefined>;
  if (!runtime) {
    delete host[RUNTIME_KEY];
    return;
  }
  host[RUNTIME_KEY] = runtime;
}

function isGameActivelyPlaying(): boolean {
  const now = Date.now();
  if (now - lastActiveCheckAt < ACTIVE_CHECK_CACHE_MS) return lastActiveCheckValue;
  lastActiveCheckAt = now;

  const text = document.body?.innerText || '';
  const isLobby = /SELECT INPUT SYSTEM|Start PC Play|Start Mobile Play|Start CO-OP Play|Start Quest/i.test(text);
  const isGameOver = /GAME OVER|Try Again|Return to Lobby/i.test(text);
  const hasGameHud = /Poop Crusader\s*Level\s*\d+/i.test(text);
  lastActiveCheckValue = hasGameHud && !isLobby && !isGameOver;
  return lastActiveCheckValue;
}

function isEnemyLike(value: unknown): value is EnemyLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as EnemyLike;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.emoji === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.hp === 'number' &&
    typeof candidate.maxHp === 'number' &&
    typeof candidate.speed === 'number' &&
    typeof candidate.size === 'number' &&
    typeof candidate.scoreValue === 'number'
  );
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

function getQuotaForWave(wave: number): number {
  const base = 6 + wave * 2 + Math.floor(wave / 2);
  const bonusWaveBonus = wave % 5 === 0 ? 8 + Math.floor(wave / 5) * 2 : 0;
  return Math.min(70, Math.max(8, base + bonusWaveBonus));
}

function resetForWave(runtime: GameRuntime, wave: number): void {
  runtime.currentWave = Math.max(1, wave);
  runtime.targetQuota = getQuotaForWave(runtime.currentWave);
  runtime.spawnedThisWave = 0;
  runtime.liveEnemies = 0;
  runtime.bossRequired = false;
  runtime.bossDefeated = true;
  runtime.gateOpenUntil = Date.now() + 900;
}

function forceRuntimePlaying(runtime: GameRuntime, reason = 'play-requested'): void {
  runtime.active = true;
  runtime.lastActiveState = true;
  runtime.enemyArrays.clear();
  resetForWave(runtime, 1);
  lastActiveCheckAt = Date.now();
  lastActiveCheckValue = true;
  emitUpdate(runtime, reason);
}

function clearTrackedEnemies(runtime: GameRuntime): void {
  runtime.enemyArrays.forEach((array) => {
    if (!Array.isArray(array)) return;
    for (let index = array.length - 1; index >= 0; index -= 1) {
      const item = array[index];
      if (isEnemyLike(item) && item.__ptqWave && item.__ptqWave !== runtime.currentWave) {
        array.splice(index, 1);
      }
    }
  });
}

function countLiveEnemies(runtime: GameRuntime): number {
  let live = 0;
  runtime.enemyArrays.forEach((array) => {
    if (!Array.isArray(array)) {
      runtime.enemyArrays.delete(array);
      return;
    }

    let hasLiveWaveEnemies = false;
    array.forEach((item) => {
      if (isEnemyLike(item) && item.__ptqWave === runtime.currentWave && typeof item.hp === 'number' && item.hp > 0) {
        live += 1;
        hasLiveWaveEnemies = true;
      }
    });

    if (!hasLiveWaveEnemies && array.length === 0) {
      runtime.enemyArrays.delete(array);
    }
  });
  return live;
}

function pruneCoins(runtime: GameRuntime): void {
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
    window.dispatchEvent(new CustomEvent(COIN_EXPIRED_EVENT, { detail: { removed } }));
  }
}

function emitUpdate(runtime: GameRuntime, reason = 'tick'): void {
  window.dispatchEvent(new CustomEvent(WAVE_UPDATE_EVENT, {
    detail: {
      reason,
      currentWave: runtime.currentWave,
      targetQuota: runtime.targetQuota,
      spawnedThisWave: runtime.spawnedThisWave,
      liveEnemies: runtime.liveEnemies,
      remainingSpawns: Math.max(0, runtime.targetQuota - runtime.spawnedThisWave),
      bossRequired: false,
      bossDefeated: true,
      bonusWave: runtime.currentWave % 5 === 0,
      waveClear: runtime.spawnedThisWave >= runtime.targetQuota && runtime.liveEnemies === 0
    }
  }));
}

function maybeAdvanceWave(runtime: GameRuntime): void {
  if (!runtime.active) return;
  runtime.liveEnemies = countLiveEnemies(runtime);
  pruneCoins(runtime);

  const allMonstersSpawned = runtime.spawnedThisWave >= runtime.targetQuota;
  const allMonstersCleared = runtime.liveEnemies === 0;

  if (allMonstersSpawned && allMonstersCleared) {
    resetForWave(runtime, runtime.currentWave + 1);
    clearTrackedEnemies(runtime);
    emitUpdate(runtime, 'wave-advanced');
    return;
  }

  emitUpdate(runtime, 'wave-active');
}

export default function GameRuntimeGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    let runtime = getRuntime();

    if (!runtime) {
      const originalPush = Array.prototype.push;
      runtime = {
        originalPush,
        owners: 0,
        enemyArrays: new Set<unknown[]>(),
        coinArrays: new Set<unknown[]>(),
        active: false,
        currentWave: 1,
        targetQuota: getQuotaForWave(1),
        spawnedThisWave: 0,
        liveEnemies: 0,
        bossRequired: false,
        bossDefeated: true,
        lastActiveState: false,
        gateOpenUntil: 0
      };

      Array.prototype.push = function ptqGameRuntimePush<T>(this: T[], ...items: T[]): number {
        const activeRuntime = getRuntime();
        if (!activeRuntime || items.length === 0) return originalPush.apply(this, items);

        let hasObjectItem = false;
        for (let index = 0; index < items.length; index += 1) {
          if (items[index] && typeof items[index] === 'object') {
            hasObjectItem = true;
            break;
          }
        }
        if (!hasObjectItem) return activeRuntime.originalPush.apply(this, items);

        const now = Date.now();
        const allowedItems: T[] = [];
        let acceptedEnemy = false;
        let containsCoin = false;

        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (isCoinLike(item)) {
            stampCoin(item, now);
            containsCoin = true;
            allowedItems.push(item);
            continue;
          }

          if (!activeRuntime.active || !isEnemyLike(item)) {
            allowedItems.push(item);
            continue;
          }

          const stillOpening = now < activeRuntime.gateOpenUntil;
          const canSpawn = stillOpening || activeRuntime.spawnedThisWave < activeRuntime.targetQuota;
          if (!canSpawn) continue;

          item.__ptqWave = activeRuntime.currentWave;
          activeRuntime.spawnedThisWave += 1;
          acceptedEnemy = true;
          allowedItems.push(item);
        }

        const result = activeRuntime.originalPush.apply(this, allowedItems);

        if (containsCoin) activeRuntime.coinArrays.add(this as unknown[]);
        if (acceptedEnemy) {
          activeRuntime.enemyArrays.add(this as unknown[]);
          activeRuntime.liveEnemies = countLiveEnemies(activeRuntime);
          emitUpdate(activeRuntime, 'monster-spawned');
        }

        return result;
      } as typeof Array.prototype.push;

      setRuntime(runtime);
    }

    runtime.owners += 1;

    const handlePlayRequested = () => {
      const activeRuntime = getRuntime();
      if (!activeRuntime) return;
      forceRuntimePlaying(activeRuntime, 'play-requested');
    };

    window.addEventListener(PLAY_REQUESTED_EVENT, handlePlayRequested);

    const interval = window.setInterval(() => {
      const activeRuntime = getRuntime();
      if (!activeRuntime) return;
      const playingNow = isGameActivelyPlaying();

      if (playingNow && !activeRuntime.lastActiveState) {
        forceRuntimePlaying(activeRuntime, 'game-started');
      }

      if (!playingNow && activeRuntime.lastActiveState) {
        activeRuntime.active = false;
        activeRuntime.enemyArrays.clear();
        activeRuntime.currentWave = 1;
        activeRuntime.targetQuota = getQuotaForWave(1);
        activeRuntime.spawnedThisWave = 0;
        activeRuntime.liveEnemies = 0;
        activeRuntime.bossRequired = false;
        activeRuntime.bossDefeated = true;
        emitUpdate(activeRuntime, 'game-stopped');
      }

      activeRuntime.lastActiveState = playingNow;
      if (playingNow || activeRuntime.active) maybeAdvanceWave(activeRuntime);
      else pruneCoins(activeRuntime);
    }, TICK_MS);

    return () => {
      window.removeEventListener(PLAY_REQUESTED_EVENT, handlePlayRequested);
      window.clearInterval(interval);
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
