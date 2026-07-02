import type { ComponentProps } from 'react';
import SimplifiedGameAreaV9 from './SimplifiedGameAreaV9';

type GameAreaV9Props = ComponentProps<typeof SimplifiedGameAreaV9>;

type MaybeToilet = {
  id?: unknown;
  name?: unknown;
  cost?: unknown;
  cooldownMs?: unknown;
  damage?: unknown;
  flushRadius?: unknown;
};

const ORIGINAL_SLICE = Array.prototype.slice;
const ORIGINAL_SHOP_LIMIT = 12;
const EXPANDED_SHOP_LIMIT = 52;
let isExpandedShopSliceInstalled = false;

function looksLikeToilet(item: unknown): item is MaybeToilet {
  if (!item || typeof item !== 'object') return false;
  const value = item as MaybeToilet;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.cost === 'number' &&
    typeof value.cooldownMs === 'number' &&
    typeof value.damage === 'number' &&
    typeof value.flushRadius === 'number'
  );
}

function shouldExpandSlice(target: unknown, start?: number, end?: number) {
  if (!Array.isArray(target)) return false;
  if (start !== 0 || end !== ORIGINAL_SHOP_LIMIT) return false;
  if (target.length <= ORIGINAL_SHOP_LIMIT) return false;
  return target.slice(0, Math.min(3, target.length)).every(looksLikeToilet);
}

function installExpandedToiletShopSlice() {
  if (isExpandedShopSliceInstalled) return;
  isExpandedShopSliceInstalled = true;

  Array.prototype.slice = function expandedToiletShopSlice(start?: number, end?: number) {
    if (shouldExpandSlice(this, start, end)) {
      return ORIGINAL_SLICE.call(this, 0, EXPANDED_SHOP_LIMIT);
    }

    return ORIGINAL_SLICE.call(this, start, end);
  } as typeof Array.prototype.slice;
}

export default function SimplifiedGameAreaV10(props: GameAreaV9Props) {
  installExpandedToiletShopSlice();
  return <SimplifiedGameAreaV9 {...props} />;
}
