import { useEffect, type ComponentProps } from 'react';
import SimplifiedGameAreaV8 from './SimplifiedGameAreaV8';

type GameAreaV8Props = ComponentProps<typeof SimplifiedGameAreaV8>;

type MaybeBoss = {
  isBoss?: boolean;
  bossWave?: number;
  speed?: number;
  name?: string;
};

function boostBossSpeed(enemy: MaybeBoss) {
  if (!enemy || enemy.isBoss !== true || typeof enemy.speed !== 'number') return;
  const bossWave = typeof enemy.bossWave === 'number' ? enemy.bossWave : 5;
  const waveBonus = Math.max(0, bossWave) * 5;
  const milestoneBonus = Math.floor(Math.max(0, bossWave) / 5) * 8;
  enemy.speed = Math.min(240, Math.round(enemy.speed + waveBonus + milestoneBonus));
}

export default function SimplifiedGameAreaV9(props: GameAreaV8Props) {
  useEffect(() => {
    const originalPush = Array.prototype.push;

    Array.prototype.push = function bossSpeedPush(...items: unknown[]) {
      for (const item of items) {
        if (item && typeof item === 'object') {
          boostBossSpeed(item as MaybeBoss);
        }
      }
      return originalPush.apply(this, items);
    };

    return () => {
      if (Array.prototype.push.name === 'bossSpeedPush') {
        Array.prototype.push = originalPush;
      }
    };
  }, []);

  return <SimplifiedGameAreaV8 {...props} />;
}
