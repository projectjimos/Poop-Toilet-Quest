import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import SimplifiedGameAreaV12 from './SimplifiedGameAreaV12';

const ICE_CREAM_SKIN_ID = 'sprinkles_vanilla_icecream';
const ICE_CREAM_EMOJI = '🍦';
const ICE_CREAM_COST = 1800;
const ARENA_FLUSH_DAMAGE = 95;
const BOSS_ARENA_FLUSH_DAMAGE = 65;
const ARENA_FLUSH_COOLDOWN_MS = 10000;
const PLAYER_SKIN_EMOJIS = new Set(['💩', '🍎', '🍌', '🍓', '🍉', '🍍', '🍒', '🍇']);

type GameAreaV12Props = ComponentProps<typeof SimplifiedGameAreaV12>;

type EnemyLike = {
  id?: string;
  hp?: number;
  maxHp?: number;
  x?: number;
  y?: number;
  isBoss?: boolean;
};

type ParticleLike = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
};

type RuntimeLike = {
  active?: boolean;
  player?: {
    x?: number;
    y?: number;
    hp?: number;
  };
  enemies?: EnemyLike[];
  particles?: ParticleLike[];
  flushPulse?: null | {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    color: string;
    emoji: string;
  };
};

function profileKey(profile: string | null) {
  return (profile || 'Guest Player').trim() || 'Guest Player';
}

function storageKey(profile: string | null, key: string) {
  return `poop_quest_${key}_${profileKey(profile)}`;
}

function readStringArray(key: string, fallback: string[]) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function readUnlockedSpecialSkins(profile: string | null) {
  return readStringArray(storageKey(profile, 'unlocked_skins'), ['default']);
}

function isIceCreamUnlocked(profile: string | null) {
  return readUnlockedSpecialSkins(profile).includes(ICE_CREAM_SKIN_ID);
}

function readActiveSkinId(profile: string | null) {
  return localStorage.getItem(storageKey(profile, 'active_skin')) || 'default';
}

function saveUnlockedIceCream(profile: string | null) {
  const key = storageKey(profile, 'unlocked_skins');
  const next = Array.from(new Set(['default', ...readStringArray(key, ['default']), ICE_CREAM_SKIN_ID]));
  localStorage.setItem(key, JSON.stringify(next));
}

function saveActiveIceCream(profile: string | null) {
  localStorage.setItem(storageKey(profile, 'active_skin'), ICE_CREAM_SKIN_ID);
  window.dispatchEvent(new CustomEvent('ptq:play-requested'));
}

function isRuntimeLike(value: unknown): value is RuntimeLike {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as RuntimeLike;
  return Array.isArray(maybe.enemies) && maybe.player !== undefined && typeof maybe.player === 'object';
}

function getRuntimeFromHookList(fiber: any): RuntimeLike | null {
  let hook = fiber?.memoizedState;
  let guard = 0;

  while (hook && guard < 100) {
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

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addParticle(runtime: RuntimeLike, text: string, x: number, y: number, color = '#f9a8d4') {
  if (!Array.isArray(runtime.particles)) return;
  runtime.particles.push({
    id: id('icecream_flush'),
    x,
    y,
    vx: (Math.random() - 0.5) * 55,
    vy: -70 - Math.random() * 35,
    text,
    color,
    life: 0,
    maxLife: 850,
  });
}

function castIceCreamArenaFlush() {
  const runtime = findGameRuntime();
  if (!runtime?.active || !runtime.player || !Array.isArray(runtime.enemies)) return false;

  const playerX = runtime.player.x || 750;
  const playerY = runtime.player.y || 750;
  let hitCount = 0;

  for (const enemy of runtime.enemies) {
    if (!enemy || typeof enemy.hp !== 'number') continue;
    const damage = enemy.isBoss ? BOSS_ARENA_FLUSH_DAMAGE : ARENA_FLUSH_DAMAGE;
    enemy.hp -= damage;
    hitCount += 1;

    if (typeof enemy.x === 'number' && typeof enemy.y === 'number') {
      addParticle(runtime, `-${damage} 🍦`, enemy.x, enemy.y - 24, enemy.isBoss ? '#f0abfc' : '#bfdbfe');
    }
  }

  runtime.flushPulse = {
    x: playerX,
    y: playerY,
    radius: 20,
    maxRadius: 1600,
    color: '#f9a8d4',
    emoji: ICE_CREAM_EMOJI,
  };

  addParticle(runtime, hitCount > 0 ? `ARENA FLUSH x${hitCount}` : 'ARENA FLUSH!', playerX, playerY - 70, '#fef3c7');
  return true;
}

function getEmojiFontSize(font: string) {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number.parseFloat(match[1]) : 0;
}

export default function SimplifiedGameAreaV13(props: GameAreaV12Props) {
  const [isUnlocked, setIsUnlocked] = useState(() => isIceCreamUnlocked(props.currentUser));
  const [activeSkinId, setActiveSkinId] = useState(() => readActiveSkinId(props.currentUser));
  const [cooldownEndsAt, setCooldownEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const isActive = activeSkinId === ICE_CREAM_SKIN_ID;
  const cooldownMs = Math.max(0, cooldownEndsAt - now);
  const cooldownSeconds = Math.ceil(cooldownMs / 1000);

  const refreshSkinState = useCallback(() => {
    setIsUnlocked(isIceCreamUnlocked(props.currentUser));
    setActiveSkinId(readActiveSkinId(props.currentUser));
  }, [props.currentUser]);

  const buyOrEquipIceCream = useCallback(() => {
    if (!isUnlocked) {
      if (props.coins < ICE_CREAM_COST) return;
      props.addCoins(-ICE_CREAM_COST);
      saveUnlockedIceCream(props.currentUser);
      setIsUnlocked(true);
    }

    saveActiveIceCream(props.currentUser);
    setActiveSkinId(ICE_CREAM_SKIN_ID);
  }, [isUnlocked, props]);

  const tryCastAbility = useCallback(() => {
    if (readActiveSkinId(props.currentUser) !== ICE_CREAM_SKIN_ID) return;
    const currentTime = Date.now();
    if (currentTime < cooldownEndsAt) return;

    if (castIceCreamArenaFlush()) {
      setCooldownEndsAt(currentTime + ARENA_FLUSH_COOLDOWN_MS);
      setNow(currentTime);
    }
  }, [cooldownEndsAt, props.currentUser]);

  useEffect(() => {
    refreshSkinState();
    const intervalId = window.setInterval(refreshSkinState, 500);
    window.addEventListener('storage', refreshSkinState);
    window.addEventListener('ptq:play-requested', refreshSkinState);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshSkinState);
      window.removeEventListener('ptq:play-requested', refreshSkinState);
    };
  }, [refreshSkinState]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '1') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      tryCastAbility();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tryCastAbility]);

  useEffect(() => {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;

    CanvasRenderingContext2D.prototype.fillText = function iceCreamSkinFillText(text: string, x: number, y: number, maxWidth?: number) {
      const shouldReplacePlayerEmoji = readActiveSkinId(props.currentUser) === ICE_CREAM_SKIN_ID && PLAYER_SKIN_EMOJIS.has(text) && getEmojiFontSize(this.font) >= 38;
      const nextText = shouldReplacePlayerEmoji ? ICE_CREAM_EMOJI : text;

      if (typeof maxWidth === 'number') return originalFillText.call(this, nextText, x, y, maxWidth);
      return originalFillText.call(this, nextText, x, y);
    };

    return () => {
      if (CanvasRenderingContext2D.prototype.fillText.name === 'iceCreamSkinFillText') {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
      }
    };
  }, [props.currentUser]);

  const actionLabel = useMemo(() => {
    if (!isUnlocked && props.coins < ICE_CREAM_COST) return `Need ${ICE_CREAM_COST - props.coins} coins`;
    if (!isUnlocked) return 'Buy + Equip';
    return isActive ? 'Equipped' : 'Equip';
  }, [isUnlocked, isActive, props.coins]);

  return (
    <div className="grid gap-3">
      <section className="rounded-2xl border border-pink-300/30 bg-gradient-to-r from-pink-500/15 via-slate-950 to-cyan-500/15 p-4 font-mono text-xs font-bold text-pink-50 shadow-xl shadow-pink-950/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-200">Special Skin Ability</div>
            <h3 className="mt-1 text-lg font-black uppercase text-white">🍦 Sprinkles Vanilla Ice Cream</h3>
            <p className="mt-1 max-w-3xl leading-relaxed text-pink-100/80">
              Press <span className="rounded bg-slate-950 px-2 py-1 text-white">1</span> to cast a full-arena ice cream flush. It hits every enemy for {ARENA_FLUSH_DAMAGE} damage and bosses for {BOSS_ARENA_FLUSH_DAMAGE}. Cooldown: 10s.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-pink-200/25 bg-slate-950/80 px-3 py-2 text-pink-100">
              {isActive ? cooldownMs > 0 ? `Cooldown ${cooldownSeconds}s` : 'Ability Ready: press 1' : `${ICE_CREAM_COST} coins`}
            </div>
            <button
              type="button"
              onClick={buyOrEquipIceCream}
              disabled={isActive || (!isUnlocked && props.coins < ICE_CREAM_COST)}
              className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase transition ${isActive ? 'bg-emerald-400 text-slate-950' : !isUnlocked && props.coins < ICE_CREAM_COST ? 'cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-pink-300 text-slate-950 hover:bg-pink-200'}`}
            >
              {actionLabel}
            </button>
            {isActive && (
              <button
                type="button"
                onClick={tryCastAbility}
                disabled={cooldownMs > 0}
                className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase transition ${cooldownMs > 0 ? 'cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'}`}
              >
                {cooldownMs > 0 ? `${cooldownSeconds}s` : 'Cast'}
              </button>
            )}
          </div>
        </div>
      </section>

      <SimplifiedGameAreaV12 {...props} />
    </div>
  );
}
