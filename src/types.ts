export interface Toilet {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  cooldownMs: number;
  description: string;
  perk: string;
  color: string;
  pulseColor: string;
  damage: number;
  level: number;
  flushRadius: number;
}

export interface Armor {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  level: number;
  description: string;
  perk: string;
  shieldHp: number; // Shield value provided
  maxShieldHp: number; // Max shield capacity
  shieldAbsorbPercent: number; // Damage absorption fraction (e.g. 0.4 for 40%)
  abilityId: 'soap_ring' | 'dash_impulse' | 'acid_spill' | 'magnet' | 'bouncy_shield' | 'nuclear_flush_boost' | 'electro_shock';
  abilityName: string;
  abilityDescription: string;
  color: string;
}

export interface Player {
  x: number;
  y: number;
  targetX?: number; // for touch movement
  targetY?: number; // for touch movement
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  size: number;
  angle: number;
}

export type EnemyType = 'germ' | 'fly' | 'soap' | 'toilet_paper' | 'brush' | 'bleach' | 'plunger';

export interface Enemy {
  id: string;
  type: EnemyType;
  emoji: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  size: number;
  scoreValue: number;
  // Optional ability states
  abilityCooldown?: number;
  abilityState?: 'idle' | 'charging' | 'active';
  abilityDuration?: number;
  abilityVx?: number;
  abilityVy?: number;
}

export interface Puddle {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
  opacity: number;
}

export interface CoinPickup {
  id: string;
  x: number;
  y: number;
  size: number;
  value: number;
  bounceOffset: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  text?: string;
  emoji?: string;
  scale?: number;
  isWord?: boolean;
}

export interface GameStats {
  coinsCollected: number;
  enemiesDefeated: number;
  toiletsUnlockedCount: number;
  secondsSurvived: number;
}

export interface Laser {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  width: number;
  life: number;
  maxLife: number;
  opacity: number;
}

export interface FruitPickup {
  id: string;
  x: number;
  y: number;
  type: 'apple' | 'banana' | 'strawberry' | 'melon' | 'pineapple';
  name: string;
  emoji: string;
  healAmount: number;
  size: number;
  bounceOffset: number;
}

