import { useEffect, type ReactNode } from 'react';

interface WaveClearDirectorGateProps {
  children: ReactNode;
}

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

type WaveRuntime = {
  originalPush: typeof Array.prototype.push;
  enemyArrays: Set<unknown[]>;
  owners: number;
  active: boolean;
  currentWave: number;
  targetQuota: number;
  spawnedThisWave: number;
  liveEnemies: number;
  bossRequired: boolean;
  bossDefeated: boolean;
  lastWaveAnnounced: number;
  lastActiveState: boolean;
  gateOpenUntil: number;
};

const RUNTIME_KEY = '__ptqWaveClearRuntime';
const WAVE_UPDATE_EVENT = 'ptq:wave-director-updated';
const BOSS_DEFEATED_EVENT = 'ptq:boss-defeated';
const CLEANUP_INTERVAL_MS = 350;

function getRuntime(): WaveRuntime | undefined {
  return (window as unknown as Record<string, WaveRuntime | undefined>)[RUNTIME_KEY];
}

function setRuntime(runtime: WaveRuntime | undefined): void {
  const host = window as unknown as Record<string, WaveRuntime | undefined>;
  if (!runtime) {
    delete host[RUNTIME_KEY];
    return;
  }
  host[RUNTIME_KEY] = runtime;
}

function isGameActivelyPlaying(): boolean {
  const text = document.body?.innerText || '';
  const isLobby = /SELECT INPUT SYSTEM|Start PC Play|Start Mobile Play|Start CO-OP Play/i.test(text);
  const isGameOver = /GAME OVER|Try Again|Return to Lobby/i.test(text);
  const hasGameHud = /Poop Crusader\s*Level\s*\d+/i.test(text);
  return hasGameHud && !isLobby && !isGameOver;
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

function getQuotaForWave(wave: number): number {
  const base = 7 + wave * 2 + Math.floor(wave / 2);
  const bossBonus = wave % 5 === 0 ? 5 + Math.floor(wave / 5) : 0;
  return Math.min(90, Math.max(8, base + bossBonus));
}

function resetForWave(runtime: WaveRuntime, wave: number): void {
  runtime.currentWave = Math.max(1, wave);
  runtime.targetQuota = getQuotaForWave(runtime.currentWave);
  runtime.spawnedThisWave = 0;
  runtime.liveEnemies = 0;
  runtime.bossRequired = runtime.currentWave % 5 === 0;
  runtime.bossDefeated = !runtime.bossRequired;
  runtime.gateOpenUntil = Date.now() + 700;
  runtime.lastWaveAnnounced = runtime.currentWave;
}

function clearTrackedEnemies(runtime: WaveRuntime): void {
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

function countLiveEnemies(runtime: WaveRuntime): number {
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

function emitUpdate(runtime: WaveRuntime, reason = 'tick'): void {
  window.dispatchEvent(new CustomEvent(WAVE_UPDATE_EVENT, {
    detail: {
      reason,
      currentWave: runtime.currentWave,
      targetQuota: runtime.targetQuota,
      spawnedThisWave: runtime.spawnedThisWave,
      liveEnemies: runtime.liveEnemies,
      remainingSpawns: Math.max(0, runtime.targetQuota - runtime.spawnedThisWave),
      bossRequired: runtime.bossRequired,
      bossDefeated: runtime.bossDefeated,
      waveClear: runtime.spawnedThisWave >= runtime.targetQuota && runtime.liveEnemies === 0 && runtime.bossDefeated
    }
  }));
}

function maybeAdvanceWave(runtime: WaveRuntime): void {
  if (!runtime.active) return;
  runtime.liveEnemies = countLiveEnemies(runtime);

  const allMonstersSpawned = runtime.spawnedThisWave >= runtime.targetQuota;
  const allMonstersCleared = runtime.liveEnemies === 0;
  const bossCleared = !runtime.bossRequired || runtime.bossDefeated;

  if (allMonstersSpawned && allMonstersCleared && bossCleared) {
    resetForWave(runtime, runtime.currentWave + 1);
    clearTrackedEnemies(runtime);
    emitUpdate(runtime, 'wave-advanced');
    return;
  }

  emitUpdate(runtime, 'wave-active');
}

export default function WaveClearDirectorGate({ children }: WaveClearDirectorGateProps) {
  useEffect(() => {
    let runtime = getRuntime();

    if (!runtime) {
      const originalPush = Array.prototype.push;
      runtime = {
        originalPush,
        enemyArrays: new Set<unknown[]>(),
        owners: 0,
        active: false,
        currentWave: 1,
        targetQuota: getQuotaForWave(1),
        spawnedThisWave: 0,
        liveEnemies: 0,
        bossRequired: false,
        bossDefeated: true,
        lastWaveAnnounced: 1,
        lastActiveState: false,
        gateOpenUntil: 0
      };

      Array.prototype.push = function ptqWaveClearPush<T>(this: T[], ...items: T[]): number {
        const activeRuntime = getRuntime();
        if (!activeRuntime || !activeRuntime.active) {
          return activeRuntime?.originalPush.apply(this, items) ?? originalPush.apply(this, items);
        }

        const allowedItems: T[] = [];
        let acceptedEnemy = false;

        items.forEach((item) => {
          if (!isEnemyLike(item)) {
            allowedItems.push(item);
            return;
          }

          const now = Date.now();
          const stillOpening = now < activeRuntime.gateOpenUntil;
          const canSpawn = stillOpening || activeRuntime.spawnedThisWave < activeRuntime.targetQuota;

          if (!canSpawn) {
            return;
          }

          item.__ptqWave = activeRuntime.currentWave;
          activeRuntime.spawnedThisWave += 1;
          acceptedEnemy = true;
          allowedItems.push(item);
        });

        const result = activeRuntime.originalPush.apply(this, allowedItems);
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

    const handleBossDefeated = (event: Event) => {
      const activeRuntime = getRuntime();
      if (!activeRuntime) return;
      const detail = (event as CustomEvent<{ wave?: number }>).detail;
      if (detail?.wave === activeRuntime.currentWave) {
        activeRuntime.bossDefeated = true;
        emitUpdate(activeRuntime, 'boss-defeated');
        maybeAdvanceWave(activeRuntime);
      }
    };

    window.addEventListener(BOSS_DEFEATED_EVENT, handleBossDefeated);

    const interval = window.setInterval(() => {
      const activeRuntime = getRuntime();
      if (!activeRuntime) return;
      const playingNow = isGameActivelyPlaying();

      if (playingNow && !activeRuntime.lastActiveState) {
        activeRuntime.active = true;
        activeRuntime.enemyArrays.clear();
        resetForWave(activeRuntime, 1);
        emitUpdate(activeRuntime, 'game-started');
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
      if (playingNow) maybeAdvanceWave(activeRuntime);
    }, CLEANUP_INTERVAL_MS);

    return () => {
      window.removeEventListener(BOSS_DEFEATED_EVENT, handleBossDefeated);
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
