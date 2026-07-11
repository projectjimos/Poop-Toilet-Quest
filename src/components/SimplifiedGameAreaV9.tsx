import { useEffect, type ComponentProps } from 'react';
import SimplifiedGameAreaV8 from './SimplifiedGameAreaV8';

type GameAreaV8Props = ComponentProps<typeof SimplifiedGameAreaV8>;

type MaybeBoss = {
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tuneBossDifficulty(enemy: MaybeBoss) {
  if (!enemy || enemy.isBoss !== true) return;

  const bossWave = typeof enemy.bossWave === 'number' ? enemy.bossWave : 5;
  const bossTier = Math.max(1, Math.floor(bossWave / 5));

  // Bosses should feel heavy, not fast. Later waves get only tiny speed bumps.
  if (typeof enemy.speed === 'number') {
    enemy.speed = clamp(Math.round(34 + bossTier * 2), 34, 56);
  }

  // Keep bosses beatable now that they summon troops; scaling should be lighter.
  const hpBonus = Math.round(bossTier * 30 + Math.max(0, bossTier - 1) ** 2 * 6);
  if (typeof enemy.maxHp === 'number') enemy.maxHp += hpBonus;
  if (typeof enemy.hp === 'number') enemy.hp += hpBonus;

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

export default function SimplifiedGameAreaV9(props: GameAreaV8Props) {
  useEffect(() => {
    const originalPush = Array.prototype.push;

    Array.prototype.push = function bossDifficultyPush(...items: unknown[]) {
      for (const item of items) {
        if (item && typeof item === 'object') {
          tuneBossDifficulty(item as MaybeBoss);
        }
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
