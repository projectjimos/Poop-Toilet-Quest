import { ARMOR_CATALOG, TOILET_CATALOG } from '../data';
import type { Armor } from '../types';

const toilet = TOILET_CATALOG.find((item) => item.id === 'cowguy_throne');
if (toilet) {
  toilet.cooldownMs = 2400;
  toilet.damage = 135;
  toilet.flushRadius = 540;
}

const NO_SUIT: Armor = {
  id: 'basic_poncho',
  name: 'No Suit',
  emoji: '👕',
  cost: 0,
  level: 1,
  description: 'Suit systems are retired. Play with movement, toilets, water, electricity, and coins.',
  perk: 'No shield, no suit power, no kinetic effects.',
  shieldHp: 0,
  maxShieldHp: 0,
  shieldAbsorbPercent: 0,
  abilityId: 'magnet',
  abilityName: 'No Suit Ability',
  abilityDescription: 'Suit abilities are disabled.',
  color: '#64748b',
};

ARMOR_CATALOG.splice(0, ARMOR_CATALOG.length, NO_SUIT);
