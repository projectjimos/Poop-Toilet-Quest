import { useEffect, type ComponentProps } from 'react';
import { TOILET_CATALOG } from '../data';
import type { Toilet } from '../types';
import SimplifiedGameAreaV11 from './SimplifiedGameAreaV11';

type GameAreaV11Props = ComponentProps<typeof SimplifiedGameAreaV11>;

const CHEST_NAMES = ['Wooden Chest', 'Iron Chest', 'Gold Chest', 'Diamond Chest', 'Galaxy Chest'];
const CHEST_ROLL_SKEW_POWER = 8;
const CHEST_SKEW_WINDOW_MS = 120;
const LEGENDARY_FILLER_COUNT = 70;
const SECRET_FILLER_COUNT = 55;
const FILLER_PREFIX = 'chest_filler_';

function chestFillerToilet(index: number, secret: boolean): Toilet {
  const level = secret ? 81 + (index % 20) : 53 + (index % 28);
  const damage = secret ? 42 + (index % 6) * 8 : 24 + (index % 6) * 6;
  const cost = secret ? 450 + index * 9 : 180 + index * 6;
  const cooldownMs = secret ? 2600 - (index % 5) * 120 : 3400 - (index % 5) * 100;
  const flushRadius = secret ? 310 + (index % 6) * 18 : 230 + (index % 6) * 14;

  return {
    id: `${FILLER_PREFIX}${secret ? 'secret' : 'legend'}_${index + 1}`,
    name: secret ? `Fakeout Secret Toilet ${index + 1}` : `Fakeout Legendary Toilet ${index + 1}`,
    emoji: secret ? '🎁' : '📦',
    cost,
    cooldownMs,
    description: 'A chest-only fakeout toilet that looks rare but keeps chest rewards from being too overpowered.',
    perk: 'Chest filler reward. Usable, but not one of the strongest hidden toilets.',
    color: secret ? '#7c3aed' : '#d97706',
    pulseColor: secret ? '#a78bfa' : '#fbbf24',
    damage,
    level,
    flushRadius,
  };
}

function installChestFillerToilets() {
  if (TOILET_CATALOG.some((toilet) => toilet.id.startsWith(FILLER_PREFIX))) return;

  const fillers: Toilet[] = [
    ...Array.from({ length: LEGENDARY_FILLER_COUNT }, (_, index) => chestFillerToilet(index, false)),
    ...Array.from({ length: SECRET_FILLER_COUNT }, (_, index) => chestFillerToilet(index, true)),
  ];

  TOILET_CATALOG.push(...fillers);
}

function isChestOpenClick(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const button = target.closest('button');
  if (!button || button.textContent?.trim().toLowerCase() !== 'open') return false;

  const cardText = button.closest('article')?.textContent || '';
  return CHEST_NAMES.some((name) => cardText.includes(name));
}

export default function SimplifiedGameAreaV12(props: GameAreaV11Props) {
  useEffect(() => {
    installChestFillerToilets();
  }, []);

  useEffect(() => {
    const originalRandom = Math.random;
    let skewUntil = 0;
    let skewedCalls = 0;

    Math.random = function chestBalancedRandom() {
      const roll = originalRandom();
      if (Date.now() <= skewUntil) {
        skewedCalls += 1;
        if (skewedCalls === 1) return roll ** CHEST_ROLL_SKEW_POWER;
      }
      return roll;
    };

    const markChestRoll = (event: MouseEvent) => {
      if (!isChestOpenClick(event.target)) return;
      skewUntil = Date.now() + CHEST_SKEW_WINDOW_MS;
      skewedCalls = 0;
    };

    document.addEventListener('click', markChestRoll, true);

    return () => {
      document.removeEventListener('click', markChestRoll, true);
      if (Math.random.name === 'chestBalancedRandom') {
        Math.random = originalRandom;
      }
    };
  }, []);

  return <SimplifiedGameAreaV11 {...props} />;
}
