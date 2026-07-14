import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import SimplifiedGameAreaV14 from './SimplifiedGameAreaV14';

const STRAWBERRY_SKIN_ID = 'strawberry_sprinkles_icecream';
const STRAWBERRY_EMOJI = '🍨';
const STRAWBERRY_KILL_COST = 500;
const STRAWBERRY_COOLDOWN_MS = 60000;
const PLAYER_SKIN_EMOJIS = new Set(['💩', '🍎', '🍌', '🍓', '🍉', '🍍', '🍒', '🍇', '🍦']);

type GameAreaV14Props = ComponentProps<typeof SimplifiedGameAreaV14>;

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

function readNumber(key: string, fallback: number) {
  const parsed = Number.parseInt(localStorage.getItem(key) || '', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function readStringArray(key: string, fallback: string[]) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function readKillCredits(profile: string | null) {
  return readNumber(storageKey(profile, 'kill_credits'), 0);
}

function saveKillCredits(profile: string | null, amount: number) {
  localStorage.setItem(storageKey(profile, 'kill_credits'), Math.max(0, amount).toString());
}

function readUnlockedSkins(profile: string | null) {
  return readStringArray(storageKey(profile, 'unlocked_skins'), ['default']);
}

function saveUnlockedStrawberry(profile: string | null) {
  const key = storageKey(profile, 'unlocked_skins');
  const next = Array.from(new Set(['default', ...readUnlockedSkins(profile), STRAWBERRY_SKIN_ID]));
  localStorage.setItem(key, JSON.stringify(next));
}

function readActiveSkinId(profile: string | null) {
  return localStorage.getItem(storageKey(profile, 'active_skin')) || 'default';
}

function saveActiveStrawberry(profile: string | null) {
  localStorage.setItem(storageKey(profile, 'active_skin'), STRAWBERRY_SKIN_ID);
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
    id: id('strawberry_clear'),
    x,
    y,
    vx: (Math.random() - 0.5) * 70,
    vy: -85 - Math.random() * 45,
    text,
    color,
    life: 0,
    maxLife: 950,
  });
}

function castStrawberryArenaClear() {
  const runtime = findGameRuntime();
  if (!runtime?.active || !runtime.player || !Array.isArray(runtime.enemies)) return false;

  const playerX = runtime.player.x || 750;
  const playerY = runtime.player.y || 750;
  let hitCount = 0;

  for (const enemy of runtime.enemies) {
    if (!enemy || typeof enemy.hp !== 'number') continue;
    const previousHp = Math.max(1, Math.ceil(enemy.hp));
    enemy.hp = 0;
    hitCount += 1;

    if (typeof enemy.x === 'number' && typeof enemy.y === 'number') {
      addParticle(runtime, `KO 🍓 -${previousHp}`, enemy.x, enemy.y - 24, enemy.isBoss ? '#f472b6' : '#fecdd3');
    }
  }

  runtime.flushPulse = {
    x: playerX,
    y: playerY,
    radius: 20,
    maxRadius: 1700,
    color: '#fb7185',
    emoji: STRAWBERRY_EMOJI,
  };

  addParticle(runtime, hitCount > 0 ? `STRAWBERRY CLEAR x${hitCount}` : 'STRAWBERRY CLEAR!', playerX, playerY - 76, '#ffe4e6');
  return true;
}

function getEmojiFontSize(font: string) {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number.parseFloat(match[1]) : 0;
}

export default function SimplifiedGameAreaV15(props: GameAreaV14Props) {
  const [killCredits, setKillCredits] = useState(() => readKillCredits(props.currentUser));
  const [unlockedSkins, setUnlockedSkins] = useState(() => readUnlockedSkins(props.currentUser));
  const [activeSkinId, setActiveSkinId] = useState(() => readActiveSkinId(props.currentUser));
  const [cooldownEndsAt, setCooldownEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const isUnlocked = unlockedSkins.includes(STRAWBERRY_SKIN_ID);
  const isActive = activeSkinId === STRAWBERRY_SKIN_ID;
  const cooldownMs = Math.max(0, cooldownEndsAt - now);
  const cooldownSeconds = Math.ceil(cooldownMs / 1000);
  const remainingKills = Math.max(0, STRAWBERRY_KILL_COST - killCredits);

  const refreshState = useCallback(() => {
    setKillCredits(readKillCredits(props.currentUser));
    setUnlockedSkins(readUnlockedSkins(props.currentUser));
    setActiveSkinId(readActiveSkinId(props.currentUser));
  }, [props.currentUser]);

  useEffect(() => {
    refreshState();
    const intervalId = window.setInterval(refreshState, 500);
    window.addEventListener('storage', refreshState);
    window.addEventListener('ptq:play-requested', refreshState);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshState);
      window.removeEventListener('ptq:play-requested', refreshState);
    };
  }, [refreshState]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(intervalId);
  }, []);

  const buyOrEquip = useCallback(() => {
    if (!isUnlocked) {
      const currentKills = readKillCredits(props.currentUser);
      if (currentKills < STRAWBERRY_KILL_COST) return;
      saveKillCredits(props.currentUser, currentKills - STRAWBERRY_KILL_COST);
      saveUnlockedStrawberry(props.currentUser);
    }

    saveActiveStrawberry(props.currentUser);
    refreshState();
  }, [isUnlocked, props.currentUser, refreshState]);

  const tryCastAbility = useCallback(() => {
    if (readActiveSkinId(props.currentUser) !== STRAWBERRY_SKIN_ID) return;
    const currentTime = Date.now();
    if (currentTime < cooldownEndsAt) return;

    if (castStrawberryArenaClear()) {
      setCooldownEndsAt(currentTime + STRAWBERRY_COOLDOWN_MS);
      setNow(currentTime);
    }
  }, [cooldownEndsAt, props.currentUser]);

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

    CanvasRenderingContext2D.prototype.fillText = function strawberrySkinFillText(text: string, x: number, y: number, maxWidth?: number) {
      const shouldReplacePlayerEmoji = readActiveSkinId(props.currentUser) === STRAWBERRY_SKIN_ID && PLAYER_SKIN_EMOJIS.has(text) && getEmojiFontSize(this.font) >= 38;
      const nextText = shouldReplacePlayerEmoji ? STRAWBERRY_EMOJI : text;

      if (typeof maxWidth === 'number') return originalFillText.call(this, nextText, x, y, maxWidth);
      return originalFillText.call(this, nextText, x, y);
    };

    return () => {
      if (CanvasRenderingContext2D.prototype.fillText.name === 'strawberrySkinFillText') {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
      }
    };
  }, [props.currentUser]);

  const actionLabel = useMemo(() => {
    if (!isUnlocked && killCredits < STRAWBERRY_KILL_COST) return `Need ${remainingKills} kills`;
    if (!isUnlocked) return 'Buy + Equip';
    return isActive ? 'Equipped' : 'Equip';
  }, [isUnlocked, isActive, killCredits, remainingKills]);

  return (
    <div className="grid gap-3">
      <section className="rounded-2xl border border-rose-300/30 bg-gradient-to-r from-rose-500/15 via-slate-950 to-pink-500/15 p-4 font-mono text-xs font-bold text-rose-50 shadow-xl shadow-rose-950/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-200">Skin Shop Mythic Ability Skin</div>
            <h3 className="mt-1 text-lg font-black uppercase text-white">🍓🍨 Strawberry Sprinkles Ice Cream</h3>
            <p className="mt-1 max-w-3xl leading-relaxed text-rose-100/80">
              Costs {STRAWBERRY_KILL_COST} kills. Equip it, then press <span className="rounded bg-slate-950 px-2 py-1 text-white">1</span> to auto-clear every enemy on the map. Cooldown: 1 minute.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-rose-200/25 bg-slate-950/80 px-3 py-2 text-rose-100">
              {isUnlocked ? isActive ? cooldownMs > 0 ? `Cooldown ${cooldownSeconds}s` : 'Ready: press 1' : 'Unlocked' : `${killCredits}/${STRAWBERRY_KILL_COST} kills`}
            </div>
            <button
              type="button"
              onClick={buyOrEquip}
              disabled={isActive || (!isUnlocked && killCredits < STRAWBERRY_KILL_COST)}
              className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase transition ${isActive ? 'bg-emerald-400 text-slate-950' : !isUnlocked && killCredits < STRAWBERRY_KILL_COST ? 'cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-rose-300 text-slate-950 hover:bg-rose-200'}`}
            >
              {actionLabel}
            </button>
            {isActive && (
              <button
                type="button"
                onClick={tryCastAbility}
                disabled={cooldownMs > 0}
                className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase transition ${cooldownMs > 0 ? 'cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-pink-300 text-slate-950 hover:bg-pink-200'}`}
              >
                {cooldownMs > 0 ? `${cooldownSeconds}s` : 'Cast'}
              </button>
            )}
          </div>
        </div>
      </section>

      <SimplifiedGameAreaV14 {...props} />
    </div>
  );
}
