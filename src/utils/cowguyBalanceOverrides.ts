import { ARMOR_CATALOG, TOILET_CATALOG } from '../data';

const toilet = TOILET_CATALOG.find((item) => item.id === 'cowguy_throne');
if (toilet) {
  toilet.cooldownMs = 2400;
  toilet.damage = 135;
  toilet.flushRadius = 540;
}

const suit = ARMOR_CATALOG.find((item) => item.id === 'cowguy_suit');
if (suit) {
  suit.shieldHp = 160;
  suit.maxShieldHp = 160;
  suit.shieldAbsorbPercent = 0.38;
}
