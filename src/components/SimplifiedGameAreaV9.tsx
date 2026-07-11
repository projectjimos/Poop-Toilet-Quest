import { useEffect, type ComponentProps } from 'react';
import SimplifiedGameAreaV8 from './SimplifiedGameAreaV8';

type GameAreaV8Props = ComponentProps<typeof SimplifiedGameAreaV8>;

type MaybeEnemy = {
  isBoss?: boolean;
  bossWave?: number;
  speed?: number;
  hp?: number;
  maxHp?: number;
  size?: number;
  scoreValue?: number;
  coinDrop?: number;
  name?: string;
};

const NORMAL_ENEMY_SPEED_CAPS: Record<string, number> = {
  'Tiny Germ': 86,
  'Fast Fly': 124,
  'Soap Guard': 72,
  'Paper Tank': 60,
  'Brush Brute': 86,
  'Boss Germ Troop': 90,
  'Boss Fly Troop': 112,
  'Boss Paper Troop': 76,
};

const NORMAL_ENEMY_HP_CAPS: Record<string, number> = {
  'Tiny Germ': 16,
  'Fast Fly': 14,
  'Soap Guard': 30,
  'Paper Tank': 42,
  'Brush Brute': 64,
  'Boss Germ Troop': 22,
  'Boss Fly Troop': 20,
  'Boss Paper Troop': 36,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function targetBossHp(bossTier: number) {
  // The core engine spawns bosses too tanky for early strong-toilet builds.
  // Keep bosses meaningful, but make them beatable since they also summon troops.
  return Math.round(165 + bossTier * 38 + Math.max(0, bossTier - 1) ** 2 * 10);
}

function tuneNormalEnemySpeed(enemy: MaybeEnemy) {
  if (!enemy || enemy.isBoss === true || typeof enemy.speed !== 'number') return;

  const speedCap = typeof enemy.name === 'string' ? NORMAL_ENEMY_SPEED_CAPS[enemy.name] : undefined;
  if (typeof speedCap === 'number') {
    enemy.speed = Math.min(enemy.speed, speedCap);
  } else {
    enemy.speed = Math.min(enemy.speed, 118);
  }
}

function tuneNormalEnemyHealth(enemy: MaybeEnemy) {
  if (!enemy || enemy.isBoss === true) return;

  const hpCap = typeof enemy.name === 'string' ? NORMAL_ENEMY_HP_CAPS[enemy.name] : undefined;
  if (typeof hpCap !== 'number') return;

  if (typeof enemy.maxHp === 'number') enemy.maxHp = Math.min(enemy.maxHp, hpCap);
  if (typeof enemy.hp === 'number') enemy.hp = Math.min(enemy.hp, hpCap);
}

function tuneBossDifficulty(enemy: MaybeEnemy) {
  if (!enemy || enemy.isBoss !== true) return;

  const bossWave = typeof enemy.bossWave === 'number' ? enemy.bossWave : 5;
  const bossTier = Math.max(1, Math.floor(bossWave / 5));

  // Bosses should feel heavy, not fast. Later waves get only tiny speed bumps.
  if (typeof enemy.speed === 'number') {
    enemy.speed = clamp(Math.round(34 + bossTier * 2), 34, 56);
  }

  // Force boss HP down instead of adding more HP on top of the core engine's scaling.
  const scaledHp = targetBossHp(bossTier);
  if (typeof enemy.maxHp === 'number') enemy.maxHp = Math.min(enemy.maxHp, scaledHp);
  if (typeof enemy.hp === 'number') enemy.hp = Math.min(enemy.hp, scaledHp);

  if (typeof enemy.size === 'number') {
    enemy.size = clamp(Math.round(enemy.size + bossTier * 1.5), enemy.size, 82);
  }

  if (typeof enemy.scoreValue === 'number') {
    enemy.scoreValue += bossTier * 3;
  }

  if (typeof enemy.coinDrop === 'number') {
    enemy.coinDrop = clamp(enemy.coinDrop + bossTier * 2, enemy.coinDrop, 60);
  }
}

function tuneEnemy(item: unknown) {
  if (!item || typeof item !== 'object') return;

  const enemy = item as MaybeEnemy;
  tuneNormalEnemySpeed(enemy);
  tuneNormalEnemyHealth(enemy);
  tuneBossDifficulty(enemy);
}

export default function SimplifiedGameAreaV9(props: GameAreaV8Props) {
  useEffect(() => {
    const originalPush = Array.prototype.push;

    Array.prototype.push = function bossDifficultyPush(...items: unknown[]) {
      for (const item of items) {
        tuneEnemy(item);
      }
      return originalPush.apply(this, items);
    };

    return () => {
      if (Array.prototype.push.name === 'bossDifficultyPush') {
        Array.prototype.push = originalPush;
      }
    };
  }, []);

  return <SimplifiedGameAreaV8 {...props} />;
}
