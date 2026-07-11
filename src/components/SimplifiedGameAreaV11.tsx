import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { TOILET_CATALOG } from '../data';
import SimplifiedGameAreaV10 from './SimplifiedGameAreaV10';
import type { Toilet } from '../types';

type GameAreaV10Props = ComponentProps<typeof SimplifiedGameAreaV10>;

type EnemyLike = {
  id?: string;
  emoji?: string;
  name?: string;
  hp?: number;
  maxHp?: number;
  speed?: number;
  size?: number;
  scoreValue?: number;
  coinDrop?: number;
  x?: number;
  y?: number;
  isBoss?: boolean;
  bossWave?: number;
  lastSummonMs?: number;
};

type CoinLike = {
  id?: string;
  x?: number;
  y?: number;
  value?: number;
  size?: number;
  wobble?: number;
  spawnedAtMs?: number;
};

type RuntimeLike = {
  active?: boolean;
  wave?: number;
  player?: {
    speed?: number;
    hp?: number;
    x?: number;
    y?: number;
  };
  enemies?: EnemyLike[];
  coins?: CoinLike[];
};

type ChestBand = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'secret';

type ChestTier = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  accent: string;
  description: string;
  odds: Array<{ band: ChestBand; weight: number; label: string }>;
};

type ChestResult = {
  title: string;
  detail: string;
  band: ChestBand;
  emoji: string;
};

type SkinPerk = {
  id: string;
  emoji: string;
  name: string;
  short: string;
  detail: string;
  speedBonus?: number;
  damageMultiplier?: number;
  cooldownMultiplier?: number;
  radiusBonus?: number;
};

const WORLD_SIZE = 1500;
const BASE_PLAYER_SPEED = 250;
const MAX_PLAYER_SPEED = 470;
const GAMEPLAY_TUNE_INTERVAL_MS = 250;
const SKIN_SYNC_INTERVAL_MS = 300;
const DEFAULT_BOSS_SUMMON_INTERVAL_MS = 5000;
const FASTEST_BOSS_SUMMON_INTERVAL_MS = 900;
const NORMAL_COIN_DESPAWN_MS = 22000;
const BIG_COIN_DESPAWN_MS = 32000;
const VISIBLE_SHOP_TOILET_LIMIT = 52;

const SKIN_PERKS: Record<string, SkinPerk> = {
  default: {
    id: 'default',
    emoji: '💩',
    name: 'Default Skin',
    short: 'No perk',
    detail: 'Classic mode with no passive bonus.',
  },
  apple: {
    id: 'apple',
    emoji: '🍎',
    name: 'Apple Skin',
    short: '+45 speed',
    detail: 'Crisp apple energy gives +45 movement speed.',
    speedBonus: 45,
  },
  banana: {
    id: 'banana',
    emoji: '🍌',
    name: 'Banana Skin',
    short: '+18% damage',
    detail: 'Banana power makes every flush hit 18% harder.',
    damageMultiplier: 1.18,
  },
  strawberry: {
    id: 'strawberry',
    emoji: '🍓',
    name: 'Strawberry Skin',
    short: '12% faster cooldown',
    detail: 'Tiny strawberry reflexes reduce flush cooldown by 12%.',
    cooldownMultiplier: 0.88,
  },
  watermelon: {
    id: 'watermelon',
    emoji: '🍉',
    name: 'Watermelon Skin',
    short: '+75 radius',
    detail: 'Big watermelon splash adds +75 flush radius.',
    radiusBonus: 75,
  },
  pineapple: {
    id: 'pineapple',
    emoji: '🍍',
    name: 'Pineapple Skin',
    short: '+10% damage, +35 radius',
    detail: 'Spiky pineapple pressure adds +10% damage and +35 radius.',
    damageMultiplier: 1.1,
    radiusBonus: 35,
  },
  cherry: {
    id: 'cherry',
    emoji: '🍒',
    name: 'Cherry Skin',
    short: '+25 speed, +8% damage',
    detail: 'Double cherry combo gives +25 speed and +8% damage.',
    speedBonus: 25,
    damageMultiplier: 1.08,
  },
  grapes: {
    id: 'grapes',
    emoji: '🍇',
    name: 'Grapes Skin',
    short: 'All-around boost',
    detail: 'Ultimate fruit flex: +15 speed, +6% damage, +25 radius, and 6% faster cooldown.',
    speedBonus: 15,
    damageMultiplier: 1.06,
    cooldownMultiplier: 0.94,
    radiusBonus: 25,
  },
};

const CHESTS: ChestTier[] = [
  {
    id: 'wooden',
    name: 'Wooden Chest',
    emoji: '🪵',
    cost: 100,
    accent: 'amber',
    description: 'Cheap roll. Mostly weak toilets worth less than the chest, with a tiny secret chance.',
    odds: [
      { band: 'common', weight: 8300, label: '83% common toilet' },
      { band: 'uncommon', weight: 1300, label: '13% uncommon toilet' },
      { band: 'rare', weight: 390, label: '3.9% rare toilet' },
      { band: 'secret', weight: 10, label: '0.1% secret toilet' },
    ],
  },
  {
    id: 'iron',
    name: 'Iron Chest',
    emoji: '🧰',
    cost: 350,
    accent: 'slate',
    description: 'Better early-game rolls with a small secret chance.',
    odds: [
      { band: 'common', weight: 5200, label: '52% common toilet' },
      { band: 'uncommon', weight: 3300, label: '33% uncommon toilet' },
      { band: 'rare', weight: 1450, label: '14.5% rare toilet' },
      { band: 'secret', weight: 50, label: '0.5% secret toilet' },
    ],
  },
  {
    id: 'gold',
    name: 'Gold Chest',
    emoji: '🏆',
    cost: 900,
    accent: 'yellow',
    description: 'Mid-game chest. Less junk, more rare and epic toilets.',
    odds: [
      { band: 'uncommon', weight: 4500, label: '45% uncommon toilet' },
      { band: 'rare', weight: 3300, label: '33% rare toilet' },
      { band: 'epic', weight: 2100, label: '21% epic toilet' },
      { band: 'secret', weight: 100, label: '1% secret toilet' },
    ],
  },
  {
    id: 'diamond',
    name: 'Diamond Chest',
    emoji: '💎',
    cost: 2500,
    accent: 'cyan',
    description: 'High-tier chest with much better odds for powerful hidden rewards.',
    odds: [
      { band: 'rare', weight: 3800, label: '38% rare toilet' },
      { band: 'epic', weight: 3500, label: '35% epic toilet' },
      { band: 'legendary', weight: 2500, label: '25% legendary toilet' },
      { band: 'secret', weight: 200, label: '2% secret toilet' },
    ],
  },
  {
    id: 'galaxy',
    name: 'Galaxy Chest',
    emoji: '🌌',
    cost: 7500,
    accent: 'violet',
    description: 'Endgame chest. Expensive, but mostly high-rarity toilets and the best secret odds.',
    odds: [
      { band: 'epic', weight: 3700, label: '37% epic toilet' },
      { band: 'legendary', weight: 4500, label: '45% legendary toilet' },
      { band: 'secret', weight: 1800, label: '18% secret toilet' },
    ],
  },
];

const SUMMON_TROOPS = [
  { emoji: '🦠', name: 'Boss Germ Troop', hp: 18, speed: 76, size: 25, scoreValue: 1, coinDrop: 1 },
  { emoji: '🪰', name: 'Boss Fly Troop', hp: 16, speed: 98, size: 24, scoreValue: 1, coinDrop: 1 },
  { emoji: '🧻', name: 'Boss Paper Troop', hp: 30, speed: 62, size: 30, scoreValue: 2, coinDrop: 2 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function profileKey(profile: string | null) {
  return (profile || 'Guest Player').trim() || 'Guest Player';
}

function storageKey(profile: string | null, key: string) {
  return `poop_quest_${key}_${profileKey(profile)}`;
}

function readActiveSkinId(profile: string | null) {
  const stored = localStorage.getItem(storageKey(profile, 'active_skin')) || 'default';
  return SKIN_PERKS[stored] ? stored : 'default';
}

function perkForSkin(id: string) {
  return SKIN_PERKS[id] || SKIN_PERKS.default;
}

function speedForToilet(toilet: Toilet, skinPerk: SkinPerk) {
  const levelScore = Math.max(1, toilet.level || 1);
  const costScore = Math.floor(Math.sqrt(Math.max(0, toilet.cost)) / 3);
  const damageScore = Math.floor(Math.max(0, toilet.damage) / 28);
  const powerScore = Math.max(levelScore, costScore, damageScore);
  const toiletSpeedBonus = clamp(Math.floor((powerScore - 1) * 4.5), 0, MAX_PLAYER_SPEED - BASE_PLAYER_SPEED);
  const skinSpeedBonus = skinPerk.speedBonus || 0;
  return clamp(BASE_PLAYER_SPEED + toiletSpeedBonus + skinSpeedBonus, BASE_PLAYER_SPEED, MAX_PLAYER_SPEED);
}

function applySkinPerkToToilet(toilet: Toilet, skinPerk: SkinPerk): Toilet {
  const damageMultiplier = skinPerk.damageMultiplier || 1;
  const cooldownMultiplier = skinPerk.cooldownMultiplier || 1;
  const radiusBonus = skinPerk.radiusBonus || 0;

  if (damageMultiplier === 1 && cooldownMultiplier === 1 && radiusBonus === 0) return toilet;

  return {
    ...toilet,
    damage: Math.max(1, Math.round(toilet.damage * damageMultiplier)),
    cooldownMs: Math.max(450, Math.round(toilet.cooldownMs * cooldownMultiplier)),
    flushRadius: Math.round(toilet.flushRadius + radiusBonus),
    perk: `${toilet.perk} Skin perk: ${skinPerk.short}.`,
  };
}

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function bossTierFor(enemy: EnemyLike) {
  const bossWave = typeof enemy.bossWave === 'number' ? enemy.bossWave : 5;
  return Math.max(1, Math.floor(bossWave / 5));
}

function bossSummonIntervalMs(tier: number) {
  return clamp(Math.round(DEFAULT_BOSS_SUMMON_INTERVAL_MS / tier), FASTEST_BOSS_SUMMON_INTERVAL_MS, DEFAULT_BOSS_SUMMON_INTERVAL_MS);
}

function maxSummonedTroops(tier: number) {
  return clamp(3 + tier * 2, 5, 16);
}

function slowBossSpeed(tier: number) {
  return clamp(28 + tier * 2, 28, 48);
}

function coinLifetimeMs(coin: CoinLike) {
  return typeof coin.value === 'number' && coin.value > 1 ? BIG_COIN_DESPAWN_MS : NORMAL_COIN_DESPAWN_MS;
}

function toiletsForBand(band: ChestBand): Toilet[] {
  const visibleToilets = TOILET_CATALOG.slice(1, VISIBLE_SHOP_TOILET_LIMIT);
  const secretToilets = TOILET_CATALOG.slice(VISIBLE_SHOP_TOILET_LIMIT);

  if (band === 'common') return visibleToilets.filter((toilet) => toilet.level <= 10);
  if (band === 'uncommon') return visibleToilets.filter((toilet) => toilet.level > 10 && toilet.level <= 25);
  if (band === 'rare') return visibleToilets.filter((toilet) => toilet.level > 25 && toilet.level <= 40);
  if (band === 'epic') return visibleToilets.filter((toilet) => toilet.level > 40 && toilet.level <= 52);
  if (band === 'legendary') return secretToilets.filter((toilet) => toilet.level > 52 && toilet.level <= 80);
  return secretToilets.filter((toilet) => toilet.level > 80);
}

function pickBand(chest: ChestTier): ChestBand {
  const totalWeight = chest.odds.reduce((sum, option) => sum + option.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const option of chest.odds) {
    roll -= option.weight;
    if (roll <= 0) return option.band;
  }

  return chest.odds[chest.odds.length - 1].band;
}

function pickToiletFromBand(band: ChestBand): Toilet {
  const pool = toiletsForBand(band);
  const fallbackPool = TOILET_CATALOG.slice(1, VISIBLE_SHOP_TOILET_LIMIT);
  const finalPool = pool.length > 0 ? pool : fallbackPool;
  return finalPool[Math.floor(Math.random() * finalPool.length)] || TOILET_CATALOG[1] || TOILET_CATALOG[0];
}

function duplicateRefund(toilet: Toilet, chest: ChestTier) {
  const toiletValue = Math.max(10, toilet.cost);
  return Math.max(10, Math.floor(Math.min(chest.cost * 0.65, toiletValue * 0.5 + chest.cost * 0.08)));
}

function bandLabel(band: ChestBand) {
  if (band === 'secret') return 'SECRET';
  return band.toUpperCase();
}

function bandTextClass(band: ChestBand) {
  if (band === 'secret') return 'text-violet-200';
  if (band === 'legendary') return 'text-amber-200';
  if (band === 'epic') return 'text-fuchsia-200';
  if (band === 'rare') return 'text-cyan-200';
  if (band === 'uncommon') return 'text-emerald-200';
  return 'text-slate-200';
}

function makeSummonedTroop(boss: EnemyLike, tier: number): EnemyLike {
  const troop = SUMMON_TROOPS[Math.floor(Math.random() * Math.min(SUMMON_TROOPS.length, 1 + Math.ceil(tier / 2)))];
  const angle = Math.random() * Math.PI * 2;
  const radius = 72 + Math.random() * 95;
  const x = clamp((boss.x || WORLD_SIZE / 2) + Math.cos(angle) * radius, 35, WORLD_SIZE - 35);
  const y = clamp((boss.y || WORLD_SIZE / 2) + Math.sin(angle) * radius, 35, WORLD_SIZE - 35);
  const hp = Math.round(troop.hp + tier * 4);

  return {
    ...troop,
    id: id('boss_troop'),
    x,
    y,
    hp,
    maxHp: hp,
    speed: clamp(troop.speed + tier * 3, troop.speed, 125),
    scoreValue: troop.scoreValue + Math.floor(tier / 2),
    coinDrop: troop.coinDrop + Math.floor(tier / 3),
    isBoss: false,
  };
}

function tuneBossSummons(runtime: RuntimeLike, now = performance.now()) {
  if (!runtime.active || !Array.isArray(runtime.enemies)) return;

  const boss = runtime.enemies.find((enemy) => enemy?.isBoss === true);
  if (!boss) return;

  const tier = bossTierFor(boss);
  if (typeof boss.speed === 'number') {
    boss.speed = slowBossSpeed(tier);
  }

  const existingTroops = runtime.enemies.filter((enemy) => enemy?.isBoss !== true);
  if (existingTroops.length >= maxSummonedTroops(tier)) return;

  if (typeof boss.lastSummonMs !== 'number') {
    boss.lastSummonMs = now;
    return;
  }

  const intervalMs = bossSummonIntervalMs(tier);
  if (now - boss.lastSummonMs < intervalMs) return;

  boss.lastSummonMs = now;
  runtime.enemies.push(makeSummonedTroop(boss, tier));
}

function tuneCoinDespawns(runtime: RuntimeLike, now = performance.now()) {
  if (!runtime.active || !Array.isArray(runtime.coins)) return;

  runtime.coins = runtime.coins.filter((coin) => {
    if (!coin || typeof coin !== 'object') return false;

    if (typeof coin.spawnedAtMs !== 'number') {
      coin.spawnedAtMs = now;
      return true;
    }

    return now - coin.spawnedAtMs < coinLifetimeMs(coin);
  });
}

function isRuntimeLike(value: unknown): value is RuntimeLike {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as RuntimeLike;
  return (
    maybe.player !== undefined &&
    typeof maybe.player === 'object' &&
    typeof maybe.player.speed === 'number' &&
    Array.isArray(maybe.enemies) &&
    Array.isArray(maybe.coins)
  );
}

function getRuntimeFromHookList(fiber: any): RuntimeLike | null {
  let hook = fiber?.memoizedState;
  let guard = 0;

  while (hook && guard < 80) {
    const possibleRefValue = hook.memoizedState?.current;
    if (isRuntimeLike(possibleRefValue)) return possibleRefValue;

    const possibleDirectValue = hook.memoizedState;
    if (isRuntimeLike(possibleDirectValue)) return possibleDirectValue;

    hook = hook.next;
    guard += 1;
  }

  return null;
}

function findRuntimeFromFiber(fiber: any, seen = new Set<any>()): RuntimeLike | null {
  if (!fiber || seen.has(fiber)) return null;
  seen.add(fiber);

  const runtimeFromHooks = getRuntimeFromHookList(fiber);
  if (runtimeFromHooks) return runtimeFromHooks;

  return (
    findRuntimeFromFiber(fiber.child, seen) ||
    findRuntimeFromFiber(fiber.sibling, seen) ||
    findRuntimeFromFiber(fiber.alternate, seen)
  );
}

function findGameRuntime() {
  const root = document.getElementById('root');
  if (!root) return null;

  const reactKey = Object.keys(root).find((key) => key.startsWith('__reactContainer$') || key.startsWith('__reactFiber$'));
  if (!reactKey) return null;

  const rootValue = (root as any)[reactKey];
  const startingFiber = rootValue?.current || rootValue;
  return findRuntimeFromFiber(startingFiber);
}

function tuneRuntime(playerSpeed: number) {
  const runtime = findGameRuntime();
  if (!runtime?.player) return false;

  runtime.player.speed = playerSpeed;
  tuneBossSummons(runtime);
  tuneCoinDespawns(runtime);
  return true;
}

export default function SimplifiedGameAreaV11(props: GameAreaV10Props) {
  const [chestResult, setChestResult] = useState<ChestResult | null>(null);
  const [activeSkinId, setActiveSkinId] = useState(() => readActiveSkinId(props.currentUser));

  const activeSkinPerk = perkForSkin(activeSkinId);

  const boostedToilet = useMemo(() => applySkinPerkToToilet(props.activeToilet, activeSkinPerk), [
    props.activeToilet.id,
    props.activeToilet.name,
    props.activeToilet.cost,
    props.activeToilet.cooldownMs,
    props.activeToilet.damage,
    props.activeToilet.flushRadius,
    props.activeToilet.level,
    props.activeToilet.perk,
    activeSkinPerk.id,
  ]);

  const playerSpeed = useMemo(() => speedForToilet(props.activeToilet, activeSkinPerk), [
    props.activeToilet.id,
    props.activeToilet.level,
    props.activeToilet.cost,
    props.activeToilet.damage,
    activeSkinPerk.id,
  ]);

  const speedBonus = playerSpeed - speedForToilet(props.activeToilet, SKIN_PERKS.default);

  const openChest = (chest: ChestTier) => {
    if (props.coins < chest.cost) {
      setChestResult({
        title: `${chest.name} needs more coins`,
        detail: `You need ${chest.cost - props.coins} more coins to open this chest.`,
        band: 'common',
        emoji: chest.emoji,
      });
      return;
    }

    props.addCoins(-chest.cost);

    const band = pickBand(chest);
    const reward = pickToiletFromBand(band);
    const alreadyOwned = props.unlockedToilets.includes(reward.id);

    if (alreadyOwned) {
      const refund = duplicateRefund(reward, chest);
      props.addCoins(refund);
      setChestResult({
        title: `${chest.emoji} Duplicate ${reward.emoji} ${reward.name}`,
        detail: `You already owned it, so you got ${refund} coins back. ${bandLabel(band)} roll.`,
        band,
        emoji: reward.emoji,
      });
      return;
    }

    props.setUnlockedToilets((previous) => previous.includes(reward.id) ? previous : [...previous, reward.id]);
    props.setActiveToiletId(reward.id);
    setChestResult({
      title: `${chest.emoji} Won ${reward.emoji} ${reward.name}`,
      detail: `${bandLabel(band)} roll · Level ${reward.level} · DMG ${reward.damage}. It was unlocked and equipped automatically.`,
      band,
      emoji: reward.emoji,
    });
  };

  useEffect(() => {
    const syncActiveSkin = () => setActiveSkinId(readActiveSkinId(props.currentUser));

    syncActiveSkin();
    const intervalId = window.setInterval(syncActiveSkin, SKIN_SYNC_INTERVAL_MS);
    window.addEventListener('storage', syncActiveSkin);
    window.addEventListener('ptq:play-requested', syncActiveSkin);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', syncActiveSkin);
      window.removeEventListener('ptq:play-requested', syncActiveSkin);
    };
  }, [props.currentUser]);

  useEffect(() => {
    const tuneGameplay = () => tuneRuntime(playerSpeed);

    tuneGameplay();
    const intervalId = window.setInterval(tuneGameplay, GAMEPLAY_TUNE_INTERVAL_MS);
    const onPlayRequested = () => window.setTimeout(tuneGameplay, 0);

    window.addEventListener('ptq:play-requested', onPlayRequested);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('ptq:play-requested', onPlayRequested);
    };
  }, [playerSpeed]);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 font-mono text-xs font-bold text-cyan-100">
          Equipped toilet speed: {playerSpeed} movement speed
          {speedBonus > 0 ? ` · +${speedBonus} from ${activeSkinPerk.name}` : ' · no skin speed boost'}
        </div>
        <div className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 px-4 py-3 font-mono text-xs font-bold text-fuchsia-100">
          {activeSkinPerk.emoji} Active skin perk: {activeSkinPerk.short}
          <div className="mt-1 text-[11px] text-fuchsia-200/80">{activeSkinPerk.detail}</div>
        </div>
      </div>

      <section className="rounded-2xl border border-amber-400/25 bg-slate-950/90 p-4 font-mono text-slate-100 shadow-xl shadow-amber-950/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Coin Chest Shop</div>
            <h3 className="mt-1 text-lg font-black uppercase text-white">Open chests for random toilets</h3>
            <p className="mt-1 max-w-3xl text-xs font-bold leading-relaxed text-slate-400">
              Uses game coins only. Common rolls are usually weaker than the chest cost, but better chests have better odds for strong hidden toilets that are not sold in the normal shop.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black text-amber-200">🪙 {props.coins} coins</div>
        </div>

        {chestResult && (
          <div className={`mt-3 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-xs font-black ${bandTextClass(chestResult.band)}`}>
            <div>{chestResult.title}</div>
            <div className="mt-1 text-[11px] font-bold text-slate-300">{chestResult.detail}</div>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {CHESTS.map((chest) => {
            const affordable = props.coins >= chest.cost;
            return (
              <article key={chest.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-3xl">{chest.emoji}</div>
                    <div className="mt-2 text-xs font-black uppercase text-white">{chest.name}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-300">{chest.cost} coins</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openChest(chest)}
                    disabled={!affordable}
                    className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase transition ${affordable ? 'bg-amber-400 text-slate-950 hover:bg-amber-300' : 'cursor-not-allowed bg-slate-800 text-slate-500'}`}
                  >
                    Open
                  </button>
                </div>
                <p className="mt-3 text-[11px] font-bold leading-snug text-slate-400">{chest.description}</p>
                <div className="mt-3 space-y-1 border-t border-slate-800 pt-3 text-[10px] font-bold text-slate-500">
                  {chest.odds.map((option) => <div key={`${chest.id}-${option.band}`}>{option.label}</div>)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <SimplifiedGameAreaV10 {...props} activeToilet={boostedToilet} />
    </div>
  );
}
