import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import { TOILET_CATALOG } from '../data';
import type { Toilet } from '../types';
import { playCoinSound, playDamageSound, playFlushSound, playUnlockSound } from '../utils/audio';

type GameState = 'lobby' | 'playing' | 'gameover';
type ControlMode = 'pc' | 'mobile';
type ShopTab = 'toilets' | 'skins';

type EnemyTemplate = { emoji: string; name: string; hp: number; speed: number; size: number; scoreValue: number; coinDrop: number };
type Enemy = EnemyTemplate & { id: string; x: number; y: number; maxHp: number; isBoss?: boolean; bossWave?: number };
type Coin = { id: string; x: number; y: number; value: number; size: number; wobble: number };
type Fruit = { id: string; x: number; y: number; emoji: string; heal: number; size: number; wobble: number };
type Particle = { id: string; x: number; y: number; vx: number; vy: number; text: string; color: string; life: number; maxLife: number };
type PlayerState = { x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; size: number; speed: number };
type Skin = { id: string; name: string; emoji: string; cost: number; description: string };

type Runtime = {
  player: PlayerState;
  enemies: Enemy[];
  coins: Coin[];
  fruits: Fruit[];
  particles: Particle[];
  wave: number;
  score: number;
  killsThisRun: number;
  sessionCoins: number;
  flushCooldownMs: number;
  lastEnemySpawnMs: number;
  lastFruitRollMs: number;
  lastFrameMs: number;
  bossWaveSpawned: number;
  bossDefeatedWaves: number[];
  active: boolean;
  cameraX: number;
  cameraY: number;
  flushPulse: null | { x: number; y: number; radius: number; maxRadius: number; color: string; emoji: string };
};

interface GameAreaProps {
  coins: number;
  addCoins: (amount: number) => void;
  unlockedToilets: string[];
  setUnlockedToilets: (val: string[] | ((prev: string[]) => string[])) => void;
  unlockToilet: (id: string, cost: number) => void;
  sellToilet: (id: string, cost: number) => void;
  activeToilet: Toilet;
  setActiveToilet: (toilet: Toilet) => void;
  setActiveToiletId: (id: string) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  highScore: number;
  onHighScoreChange: (score: number) => void;
  poopLevel: number;
  setPoopLevel: (val: number | ((prev: number) => number)) => void;
  currentUser: string | null;
}

const WORLD_SIZE = 1500;
const SHOP_TOILET_LIMIT = 12;
const MAX_ENEMIES = 24;
const MAX_COINS = 32;
const MAX_PARTICLES = 110;
const MAX_FRUITS = 3;
const STARTING_TOILET_ID = 'porta_potty';
const DEFAULT_SKIN_ID = 'default';

const SKINS: Skin[] = [
  { id: DEFAULT_SKIN_ID, name: 'Default', emoji: '💩', cost: 0, description: 'The classic free starter skin.' },
  { id: 'apple', name: 'Apple', emoji: '🍎', cost: 5, description: 'A clean red fruit skin.' },
  { id: 'banana', name: 'Banana', emoji: '🍌', cost: 10, description: 'A fast yellow fruit skin.' },
  { id: 'strawberry', name: 'Strawberry', emoji: '🍓', cost: 15, description: 'A tiny sweet fruit skin.' },
  { id: 'watermelon', name: 'Watermelon', emoji: '🍉', cost: 20, description: 'A big juicy fruit skin.' },
  { id: 'pineapple', name: 'Pineapple', emoji: '🍍', cost: 30, description: 'A spiky trophy fruit skin.' },
  { id: 'cherry', name: 'Cherry', emoji: '🍒', cost: 40, description: 'A double-fruit flex skin.' },
  { id: 'grapes', name: 'Grapes', emoji: '🍇', cost: 50, description: 'The ultimate fruit collector skin.' },
];

const ENEMY_POOL: EnemyTemplate[] = [
  { emoji: '🦠', name: 'Tiny Germ', hp: 16, speed: 72, size: 25, scoreValue: 1, coinDrop: 1 },
  { emoji: '🪰', name: 'Fast Fly', hp: 14, speed: 112, size: 24, scoreValue: 1, coinDrop: 1 },
  { emoji: '🧼', name: 'Soap Guard', hp: 30, speed: 58, size: 29, scoreValue: 2, coinDrop: 2 },
  { emoji: '🧻', name: 'Paper Tank', hp: 42, speed: 45, size: 32, scoreValue: 3, coinDrop: 3 },
  { emoji: '🧹', name: 'Brush Brute', hp: 64, speed: 70, size: 36, scoreValue: 4, coinDrop: 4 },
];

const BOSS_POOL: EnemyTemplate[] = [
  { emoji: '🚽', name: 'Toilet Clogger', hp: 220, speed: 42, size: 58, scoreValue: 16, coinDrop: 18 },
  { emoji: '🦠', name: 'Mega Germ King', hp: 250, speed: 48, size: 60, scoreValue: 18, coinDrop: 20 },
  { emoji: '🧻', name: 'Paper Roll Titan', hp: 290, speed: 38, size: 64, scoreValue: 22, coinDrop: 24 },
];

const FRUITS = [
  { emoji: '🍎', heal: 15, size: 22 },
  { emoji: '🍌', heal: 25, size: 23 },
  { emoji: '🍓', heal: 35, size: 22 },
  { emoji: '🍉', heal: 50, size: 24 },
];

function id(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function distance(ax: number, ay: number, bx: number, by: number) { const dx = ax - bx; const dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function profileKey(profile: string | null) { return (profile || 'Guest Player').trim() || 'Guest Player'; }
function storageKey(profile: string | null, key: string) { return `poop_quest_${key}_${profileKey(profile)}`; }
function readNumber(key: string, fallback: number) { const parsed = Number.parseInt(localStorage.getItem(key) || '', 10); return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback; }
function readStringArray(key: string, fallback: string[]) { try { const parsed = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : fallback; } catch { return fallback; } }
function validSkin(idValue: string | null) { return SKINS.some((skin) => skin.id === idValue) ? idValue || DEFAULT_SKIN_ID : DEFAULT_SKIN_ID; }

function randomCoin(value = 1): Coin {
  return { id: id('coin'), x: 70 + Math.random() * (WORLD_SIZE - 140), y: 70 + Math.random() * (WORLD_SIZE - 140), value, size: value > 1 ? 18 : 15, wobble: Math.random() * Math.PI * 2 };
}
function coinNear(x: number, y: number, value = 1): Coin {
  const angle = Math.random() * Math.PI * 2;
  const radius = 18 + Math.random() * 72;
  return { id: id('coin'), x: clamp(x + Math.cos(angle) * radius, 45, WORLD_SIZE - 45), y: clamp(y + Math.sin(angle) * radius, 45, WORLD_SIZE - 45), value, size: value > 1 ? 18 : 15, wobble: Math.random() * Math.PI * 2 };
}
function coinDropFor(enemy: Enemy, wave: number) {
  if (enemy.isBoss) return clamp(enemy.coinDrop + Math.floor(wave / 5) * 3, 18, 45);
  const waveBonus = Math.floor(Math.max(0, wave - 1) / 4);
  const hpBonus = enemy.maxHp >= 60 ? 1 : 0;
  return clamp(enemy.coinDrop + waveBonus + hpBonus, 1, 8);
}
function killCreditFor(enemy: Enemy) { return enemy.isBoss ? 5 : 1; }
function makeRuntime(): Runtime {
  return {
    player: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, vx: 0, vy: 0, hp: 100, maxHp: 100, size: 28, speed: 250 },
    enemies: [], coins: Array.from({ length: 10 }, () => randomCoin()), fruits: [], particles: [], wave: 1, score: 0, killsThisRun: 0, sessionCoins: 0,
    flushCooldownMs: 0, lastEnemySpawnMs: 0, lastFruitRollMs: 0, lastFrameMs: 0, bossWaveSpawned: 0, bossDefeatedWaves: [], active: false, cameraX: 0, cameraY: 0, flushPulse: null,
  };
}
function hasBoss(runtime: Runtime) { return runtime.enemies.some((enemy) => enemy.isBoss); }
function currentBoss(runtime: Runtime) { return runtime.enemies.find((enemy) => enemy.isBoss) || null; }
function flushReadyRatio(runtime: Runtime, toilet: Toilet) { if (!runtime.active || toilet.cooldownMs <= 0) return 1; return clamp(1 - runtime.flushCooldownMs / toilet.cooldownMs, 0, 1); }

function drawPlayerFlushBar(ctx: CanvasRenderingContext2D, player: PlayerState, runtime: Runtime, toilet: Toilet) {
  const ratio = flushReadyRatio(runtime, toilet);
  const ready = ratio >= 0.995;
  const barWidth = 58;
  const x = player.x - barWidth / 2;
  const y = player.y - player.size - 38;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
  ctx.strokeStyle = ready ? '#67e8f9' : '#1d4ed8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, barWidth, 8, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ready ? '#38bdf8' : '#2563eb';
  ctx.beginPath(); ctx.roundRect(x + 2, y + 2, Math.max(0, (barWidth - 4) * ratio), 4, 4); ctx.fill();
  ctx.font = '900 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = ready ? '#e0f2fe' : '#93c5fd';
  ctx.fillText(ready ? 'FLUSH READY' : 'CHARGING', player.x, y - 3);
  ctx.restore();
}

function drawMinimap(ctx: CanvasRenderingContext2D, runtime: Runtime, width: number, toilet: Toilet) {
  const mapSize = Math.min(158, Math.max(118, Math.floor(width * 0.22)));
  const x = width - mapSize - 16;
  const y = 16;
  const innerX = x + 6;
  const innerY = y + 22;
  const innerW = mapSize - 12;
  const innerH = mapSize - 28;
  const player = runtime.player;
  const enemiesInRange = runtime.enemies.filter((enemy) => distance(player.x, player.y, enemy.x, enemy.y) <= toilet.flushRadius + enemy.size);
  const dangerEnemies = runtime.enemies.filter((enemy) => distance(player.x, player.y, enemy.x, enemy.y) <= 260 + enemy.size);
  const boss = currentBoss(runtime);
  const mapX = (worldX: number) => innerX + (worldX / WORLD_SIZE) * innerW;
  const mapY = (worldY: number) => innerY + (worldY / WORLD_SIZE) * innerH;
  const px = mapX(player.x);
  const py = mapY(player.y);
  ctx.save();
  ctx.globalAlpha = 0.96;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
  ctx.strokeStyle = boss ? '#f97316' : enemiesInRange.length ? '#fbbf24' : dangerEnemies.length ? '#fb7185' : '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, mapSize, mapSize, 14); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.roundRect(innerX, innerY, innerW, innerH, 10); ctx.clip(); ctx.fillStyle = '#07111f'; ctx.fillRect(innerX, innerY, innerW, innerH);
  ctx.strokeStyle = enemiesInRange.length ? 'rgba(251, 191, 36, 0.75)' : 'rgba(56, 189, 248, 0.42)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, Math.max(8, (toilet.flushRadius / WORLD_SIZE) * innerW), 0, Math.PI * 2); ctx.stroke();
  for (const coin of runtime.coins) { ctx.fillStyle = coin.value > 1 ? '#f59e0b' : '#facc15'; ctx.beginPath(); ctx.arc(mapX(coin.x), mapY(coin.y), coin.value > 1 ? 2.5 : 1.7, 0, Math.PI * 2); ctx.fill(); }
  for (const fruit of runtime.fruits) { ctx.fillStyle = '#34d399'; ctx.beginPath(); ctx.arc(mapX(fruit.x), mapY(fruit.y), 2.4, 0, Math.PI * 2); ctx.fill(); }
  for (const enemy of runtime.enemies) { const inRange = distance(player.x, player.y, enemy.x, enemy.y) <= toilet.flushRadius + enemy.size; const close = distance(player.x, player.y, enemy.x, enemy.y) <= 260 + enemy.size; ctx.fillStyle = enemy.isBoss ? '#f97316' : inRange ? '#fbbf24' : close ? '#fb7185' : '#ef4444'; ctx.beginPath(); ctx.arc(mapX(enemy.x), mapY(enemy.y), enemy.isBoss ? 6.5 : inRange ? 4.2 : close ? 3.6 : 2.8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#22c55e'; ctx.strokeStyle = '#ecfeff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#e2e8f0'; ctx.font = '900 10px monospace'; ctx.textAlign = 'left'; ctx.fillText('MINIMAP', x + 10, y + 13);
  ctx.textAlign = 'right'; ctx.fillStyle = boss ? '#fb923c' : enemiesInRange.length ? '#fbbf24' : dangerEnemies.length ? '#fb7185' : '#67e8f9'; ctx.fillText(boss ? 'BOSS!' : `${enemiesInRange.length} IN RANGE`, x + mapSize - 9, y + 13);
  const bannerY = y + mapSize + 6; ctx.fillStyle = boss ? 'rgba(249, 115, 22, 0.94)' : enemiesInRange.length ? 'rgba(251, 191, 36, 0.94)' : dangerEnemies.length ? 'rgba(251, 113, 133, 0.92)' : 'rgba(8, 47, 73, 0.92)'; ctx.beginPath(); ctx.roundRect(x, bannerY, mapSize, 23, 9); ctx.fill();
  ctx.fillStyle = boss ? '#111827' : enemiesInRange.length ? '#1e293b' : '#e0f2fe'; ctx.font = '900 10px monospace'; ctx.textAlign = 'center'; ctx.fillText(boss ? 'BOSS WAVE!' : enemiesInRange.length ? 'FLUSH NOW!' : dangerEnemies.length ? 'ENEMY CLOSE!' : 'AREA CLEAR', x + mapSize / 2, bannerY + 15);
  ctx.restore();
}

export default function SimplifiedGameAreaV6({ coins, addCoins, unlockedToilets, unlockToilet, sellToilet, activeToilet, setActiveToiletId, isMuted, setIsMuted, highScore, onHighScoreChange, poopLevel, currentUser }: GameAreaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<Runtime>(makeRuntime());
  const keysRef = useRef<Record<string, boolean>>({});
  const joystickRef = useRef({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const latestToiletRef = useRef(activeToilet);
  const pendingCoinSoundRef = useRef(false);
  const pauseRef = useRef(false);
  const activeSkinRef = useRef<SSkin | null>(null);

  type SSkin = Skin;

  const [gameState, setGameState] = useState<GameState>('lobby');
  const [controlMode, setControlMode] = useState<ControlMode>(() => (localStorage.getItem('poop_quest_control_mode') as ControlMode) || 'pc');
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [playerHp, setPlayerHp] = useState(100);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [killsThisRun, setKillsThisRun] = useState(0);
  const [killCredits, setKillCredits] = useState(0);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>([DEFAULT_SKIN_ID]);
  const [activeSkinId, setActiveSkinId] = useState(DEFAULT_SKIN_ID);
  const [flushCooldownMs, setFlushCooldownMs] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<ShopTab>('toilets');
  const [isPaused, setIsPaused] = useState(false);
  const [bossName, setBossName] = useState<string | null>(null);

  const shopToilets = useMemo(() => TOILET_CATALOG.filter((toilet) => toilet.id !== 'cowguy_throne').slice(0, SHOP_TOILET_LIMIT), []);
  const nextLockedToilet = useMemo(() => shopToilets.find((toilet) => !unlockedToilets.includes(toilet.id)), [shopToilets, unlockedToilets]);
  const activeSkin = useMemo(() => SKINS.find((skin) => skin.id === activeSkinId) || SKINS[0], [activeSkinId]);

  useEffect(() => { latestToiletRef.current = activeToilet; }, [activeToilet]);
  useEffect(() => { activeSkinRef.current = activeSkin; }, [activeSkin]);
  useEffect(() => { pauseRef.current = isPaused; }, [isPaused]);
  useEffect(() => { localStorage.setItem('poop_quest_control_mode', controlMode); }, [controlMode]);

  useEffect(() => {
    setKillCredits(readNumber(storageKey(currentUser, 'kill_credits'), 0));
    const storedSkins = readStringArray(storageKey(currentUser, 'unlocked_skins'), [DEFAULT_SKIN_ID]);
    const mergedSkins = Array.from(new Set([DEFAULT_SKIN_ID, ...storedSkins]));
    setUnlockedSkins(mergedSkins);
    const storedActiveSkin = validSkin(localStorage.getItem(storageKey(currentUser, 'active_skin')));
    setActiveSkinId(mergedSkins.includes(storedActiveSkin) ? storedActiveSkin : DEFAULT_SKIN_ID);
  }, [currentUser]);

  useEffect(() => { localStorage.setItem(storageKey(currentUser, 'kill_credits'), killCredits.toString()); }, [currentUser, killCredits]);
  useEffect(() => { localStorage.setItem(storageKey(currentUser, 'unlocked_skins'), JSON.stringify(unlockedSkins)); }, [currentUser, unlockedSkins]);
  useEffect(() => { localStorage.setItem(storageKey(currentUser, 'active_skin'), activeSkinId); }, [currentUser, activeSkinId]);

  const pushParticle = useCallback((text: string, x: number, y: number, color = '#fbbf24') => {
    const runtime = runtimeRef.current;
    runtime.particles.push({ id: id('fx'), x, y, vx: (Math.random() - 0.5) * 40, vy: -55 - Math.random() * 35, text, color, life: 0, maxLife: 650 });
    if (runtime.particles.length > MAX_PARTICLES) runtime.particles.splice(0, runtime.particles.length - MAX_PARTICLES);
  }, []);

  const togglePause = useCallback(() => { if (gameState !== 'playing') return; setIsPaused((previous) => !previous); joystickRef.current.active = false; }, [gameState]);

  const spawnBossIfNeeded = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime.active || runtime.wave < 5 || runtime.wave % 5 !== 0) return;
    if (runtime.bossWaveSpawned === runtime.wave || runtime.bossDefeatedWaves.includes(runtime.wave) || hasBoss(runtime)) return;
    const template = BOSS_POOL[Math.floor((runtime.wave / 5 - 1) % BOSS_POOL.length)];
    const scaledHp = template.hp + runtime.wave * 42;
    const angle = Math.random() * Math.PI * 2;
    const player = runtime.player;
    runtime.bossWaveSpawned = runtime.wave;
    runtime.enemies = runtime.enemies.filter((enemy) => enemy.isBoss || distance(enemy.x, enemy.y, player.x, player.y) > 260).slice(-8);
    runtime.enemies.push({ ...template, id: id('boss'), x: clamp(player.x + Math.cos(angle) * 520, 80, WORLD_SIZE - 80), y: clamp(player.y + Math.sin(angle) * 520, 80, WORLD_SIZE - 80), hp: scaledHp, maxHp: scaledHp, speed: template.speed + runtime.wave * 1.5, isBoss: true, bossWave: runtime.wave });
    setBossName(template.name);
    pushParticle(`BOSS WAVE ${runtime.wave}!`, player.x, player.y - 80, '#fb923c');
  }, [pushParticle]);

  const spawnEnemy = useCallback((now: number) => {
    const runtime = runtimeRef.current;
    if (!runtime.active || hasBoss(runtime) || runtime.enemies.length >= MAX_ENEMIES) return;
    const maxEnemiesForWave = clamp(5 + runtime.wave * 2, 7, MAX_ENEMIES);
    if (runtime.enemies.length >= maxEnemiesForWave) return;
    const spawnEvery = clamp(1400 - runtime.wave * 90 - poopLevel * 20, 520, 1400);
    if (now - runtime.lastEnemySpawnMs < spawnEvery) return;
    runtime.lastEnemySpawnMs = now;
    const player = runtime.player;
    const angle = Math.random() * Math.PI * 2;
    const distFromPlayer = 430 + Math.random() * 180;
    const poolIndex = Math.min(ENEMY_POOL.length - 1, Math.floor((runtime.wave - 1) / 2));
    const template = ENEMY_POOL[Math.floor(Math.random() * (poolIndex + 1))];
    const scaledHp = template.hp + runtime.wave * 3;
    runtime.enemies.push({ ...template, id: id('enemy'), x: clamp(player.x + Math.cos(angle) * distFromPlayer, 35, WORLD_SIZE - 35), y: clamp(player.y + Math.sin(angle) * distFromPlayer, 35, WORLD_SIZE - 35), hp: scaledHp, maxHp: scaledHp, speed: template.speed + runtime.wave * 4 });
  }, [poopLevel]);

  const triggerFlush = useCallback(() => {
    const runtime = runtimeRef.current;
    const toilet = latestToiletRef.current;
    if (pauseRef.current || !runtime.active || runtime.player.hp <= 0 || runtime.flushCooldownMs > 0) return;
    runtime.flushCooldownMs = toilet.cooldownMs;
    runtime.flushPulse = { x: runtime.player.x, y: runtime.player.y, radius: 20, maxRadius: toilet.flushRadius, color: toilet.pulseColor, emoji: toilet.emoji };
    for (const enemy of runtime.enemies) {
      if (distance(runtime.player.x, runtime.player.y, enemy.x, enemy.y) <= toilet.flushRadius + enemy.size) {
        const damage = enemy.isBoss ? Math.round(toilet.damage * 0.75) : toilet.damage;
        enemy.hp -= damage;
        pushParticle(`-${damage}`, enemy.x, enemy.y - 20, toilet.pulseColor);
      }
    }
    if (!isMuted) playFlushSound();
    setFlushCooldownMs(runtime.flushCooldownMs);
  }, [isMuted, pushParticle]);

  const startGame = useCallback((mode: ControlMode) => {
    setControlMode(mode);
    const runtime = makeRuntime();
    runtime.active = true;
    runtimeRef.current = runtime;
    setGameState('playing');
    setIsPaused(false);
    setBossName(null);
    setShopOpen(false);
    setScore(0);
    setWave(1);
    setPlayerHp(100);
    setSessionCoins(0);
    setKillsThisRun(0);
    setFlushCooldownMs(0);
    window.dispatchEvent(new CustomEvent('ptq:play-requested'));
  }, []);

  const restartGame = useCallback(() => startGame(controlMode), [controlMode, startGame]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keysRef.current[event.key] = true;
      if (event.code === 'Space' || event.key === ' ') { event.preventDefault(); triggerFlush(); }
      if (event.key.toLowerCase() === 'p' || event.key === 'Escape') { event.preventDefault(); togglePause(); }
    };
    const up = (event: KeyboardEvent) => { keysRef.current[event.key] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [triggerFlush, togglePause]);

  useEffect(() => { (window as any).triggerToiletFlush = triggerFlush; return () => { if ((window as any).triggerToiletFlush === triggerFlush) delete (window as any).triggerToiletFlush; }; }, [triggerFlush]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { const rect = shell.getBoundingClientRect(); const scale = window.devicePixelRatio || 1; canvas.width = Math.max(320, Math.floor(rect.width * scale)); canvas.height = Math.max(360, Math.floor(rect.height * scale)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; ctx.setTransform(scale, 0, 0, scale, 0, 0); };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(shell);

    const drawFrame = (now: number) => {
      const runtime = runtimeRef.current;
      const width = canvas.clientWidth || 900;
      const height = canvas.clientHeight || 580;
      const isLoopPaused = pauseRef.current && runtime.active;
      const dtMs = runtime.lastFrameMs ? Math.min(40, now - runtime.lastFrameMs) : 16;
      const dt = dtMs / 1000;
      runtime.lastFrameMs = now;

      if (runtime.active && !isLoopPaused) {
        const player = runtime.player;
        const keys = keysRef.current;
        let mx = 0; let my = 0;
        if (keys.w || keys.W || keys.ArrowUp) my -= 1; if (keys.s || keys.S || keys.ArrowDown) my += 1; if (keys.a || keys.A || keys.ArrowLeft) mx -= 1; if (keys.d || keys.D || keys.ArrowRight) mx += 1;
        const joystick = joystickRef.current;
        if (joystick.active) { const dx = joystick.x - joystick.startX; const dy = joystick.y - joystick.startY; const len = Math.sqrt(dx * dx + dy * dy); if (len > 8) { mx = dx / len; my = dy / len; } }
        if (mx || my) { const len = Math.sqrt(mx * mx + my * my) || 1; player.vx = (mx / len) * player.speed; player.vy = (my / len) * player.speed; } else { player.vx *= 0.82; player.vy *= 0.82; }
        player.x = clamp(player.x + player.vx * dt, player.size, WORLD_SIZE - player.size); player.y = clamp(player.y + player.vy * dt, player.size, WORLD_SIZE - player.size);
        runtime.flushCooldownMs = Math.max(0, runtime.flushCooldownMs - dtMs);
        if (runtime.flushPulse) { runtime.flushPulse.radius += dtMs * 0.72; if (runtime.flushPulse.radius >= runtime.flushPulse.maxRadius) runtime.flushPulse = null; }
        spawnBossIfNeeded(); spawnEnemy(now); if (!hasBoss(runtime) && runtime.coins.length < 10) runtime.coins.push(randomCoin());
        if (now - runtime.lastFruitRollMs > 1000) { runtime.lastFruitRollMs = now; if (runtime.fruits.length < MAX_FRUITS && Math.random() < (hasBoss(runtime) ? 0.045 : 0.025)) { const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)]; runtime.fruits.push({ id: id('fruit'), x: 80 + Math.random() * (WORLD_SIZE - 160), y: 80 + Math.random() * (WORLD_SIZE - 160), ...fruit, wobble: Math.random() * Math.PI * 2 }); } }
        for (const enemy of runtime.enemies) { const dx = player.x - enemy.x; const dy = player.y - enemy.y; const len = Math.sqrt(dx * dx + dy * dy) || 1; enemy.x += (dx / len) * enemy.speed * dt; enemy.y += (dy / len) * enemy.speed * dt; if (len < player.size + enemy.size * 0.55) { player.hp -= (enemy.isBoss ? 35 : 22) * dt; if (Math.random() < 0.06) pushParticle(enemy.isBoss ? 'BOSS HIT!' : 'Ouch!', player.x, player.y - 25, '#fb7185'); } }

        const aliveEnemies: Enemy[] = [];
        for (const enemy of runtime.enemies) {
          if (enemy.hp <= 0) {
            const droppedCoins = coinDropFor(enemy, runtime.wave);
            const earnedKills = killCreditFor(enemy);
            runtime.score += enemy.scoreValue;
            runtime.killsThisRun += earnedKills;
            setKillCredits((previous) => previous + earnedKills);
            setKillsThisRun(runtime.killsThisRun);
            if (enemy.isBoss) { runtime.bossDefeatedWaves.push(enemy.bossWave || runtime.wave); setBossName(null); pushParticle(`${enemy.name} defeated!`, enemy.x, enemy.y - 64, '#fb923c'); }
            pushParticle(`+${earnedKills} kills`, enemy.x, enemy.y - 54, '#f0abfc'); pushParticle(`+${droppedCoins} coins`, enemy.x, enemy.y - 18, '#facc15'); pushParticle(`+${enemy.scoreValue} score`, enemy.x, enemy.y - 36, '#a7f3d0');
            for (let i = 0; i < droppedCoins; i++) runtime.coins.push(coinNear(enemy.x, enemy.y));
          } else aliveEnemies.push(enemy);
        }
        runtime.enemies = aliveEnemies.slice(-MAX_ENEMIES); runtime.coins = runtime.coins.slice(-MAX_COINS);
        runtime.coins = runtime.coins.filter((coin) => { if (distance(player.x, player.y, coin.x, coin.y) < player.size + coin.size) { runtime.sessionCoins += coin.value; addCoins(coin.value); pushParticle(`+${coin.value} 🪙`, coin.x, coin.y - 10, '#fcd34d'); pendingCoinSoundRef.current = true; window.dispatchEvent(new CustomEvent('ptq:coins-updated')); return false; } return true; });
        runtime.fruits = runtime.fruits.filter((fruit) => { if (distance(player.x, player.y, fruit.x, fruit.y) < player.size + fruit.size) { const oldHp = player.hp; player.hp = clamp(player.hp + fruit.heal, 0, player.maxHp); pushParticle(`+${Math.round(player.hp - oldHp)} HP`, fruit.x, fruit.y - 10, '#34d399'); return false; } return true; });
        runtime.particles = runtime.particles.filter((particle) => { particle.life += dtMs; particle.x += particle.vx * dt; particle.y += particle.vy * dt; return particle.life < particle.maxLife; }).slice(-MAX_PARTICLES);
        const nextWave = Math.max(1, Math.floor(runtime.score / 12) + 1); if (nextWave !== runtime.wave && !hasBoss(runtime)) { runtime.wave = nextWave; pushParticle(runtime.wave % 5 === 0 ? `Boss wave ${runtime.wave}!` : `Wave ${runtime.wave}`, player.x, player.y - 55, runtime.wave % 5 === 0 ? '#fb923c' : '#fbbf24'); }
        if (player.hp <= 0) { player.hp = 0; runtime.active = false; setBossName(null); setIsPaused(false); setGameState('gameover'); if (runtime.score > highScore) onHighScoreChange(runtime.score); if (!isMuted) playDamageSound(); }
        runtime.cameraX = clamp(player.x - width / 2, 0, WORLD_SIZE - width); runtime.cameraY = clamp(player.y - height / 2, 0, WORLD_SIZE - height); setScore(runtime.score); setWave(runtime.wave); setPlayerHp(Math.ceil(player.hp)); setSessionCoins(runtime.sessionCoins); setFlushCooldownMs(Math.ceil(runtime.flushCooldownMs));
        if (pendingCoinSoundRef.current) { pendingCoinSoundRef.current = false; if (!isMuted) playCoinSound(); }
      }

      ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, width, height);
      const runtimeForDraw = runtimeRef.current; const boss = currentBoss(runtimeForDraw); const camX = runtimeForDraw.cameraX; const camY = runtimeForDraw.cameraY; const toScreenX = (worldX: number) => worldX - camX; const toScreenY = (worldY: number) => worldY - camY;
      ctx.save(); ctx.translate(-camX, -camY); ctx.fillStyle = '#07111f'; ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE); ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'; ctx.lineWidth = 1;
      for (let x = 0; x <= WORLD_SIZE; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_SIZE); ctx.stroke(); }
      for (let y = 0; y <= WORLD_SIZE; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_SIZE, y); ctx.stroke(); }
      ctx.lineWidth = 8; ctx.strokeStyle = '#ef4444'; ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
      for (const coin of runtimeForDraw.coins) { const float = Math.sin(now / 180 + coin.wobble) * 5; ctx.font = `${coin.size + 8}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(coin.value > 1 ? '💰' : '🪙', coin.x, coin.y + float); }
      for (const fruit of runtimeForDraw.fruits) { const float = Math.sin(now / 160 + fruit.wobble) * 5; ctx.font = `${fruit.size + 8}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fruit.emoji, fruit.x, fruit.y + float); }
      if (runtimeForDraw.flushPulse) { const pulse = runtimeForDraw.flushPulse; ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = pulse.color; ctx.lineWidth = 6; ctx.shadowColor = pulse.color; ctx.shadowBlur = 22; ctx.beginPath(); ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2); ctx.stroke(); ctx.font = '42px Arial'; ctx.fillText(pulse.emoji, pulse.x, pulse.y); ctx.restore(); }
      for (const enemy of runtimeForDraw.enemies) { if (enemy.isBoss) { ctx.save(); ctx.strokeStyle = 'rgba(249, 115, 22, 0.72)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.size + 16 + Math.sin(now / 140) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } ctx.font = `${enemy.size + (enemy.isBoss ? 18 : 8)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(enemy.emoji, enemy.x, enemy.y); const barWidth = enemy.isBoss ? enemy.size + 70 : enemy.size + 12; const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1); ctx.fillStyle = '#334155'; ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.size - (enemy.isBoss ? 30 : 14), barWidth, enemy.isBoss ? 8 : 4); ctx.fillStyle = enemy.isBoss ? '#fb923c' : ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444'; ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.size - (enemy.isBoss ? 30 : 14), barWidth * ratio, enemy.isBoss ? 8 : 4); ctx.font = '900 9px monospace'; ctx.fillStyle = enemy.isBoss ? '#fed7aa' : '#facc15'; ctx.fillText(`${coinDropFor(enemy, runtimeForDraw.wave)}🪙 ${killCreditFor(enemy)}K`, enemy.x, enemy.y - enemy.size - (enemy.isBoss ? 42 : 22)); }
      const player = runtimeForDraw.player; drawPlayerFlushBar(ctx, player, runtimeForDraw, latestToiletRef.current); ctx.font = `${player.size + 18}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 12; ctx.fillText(activeSkinRef.current?.emoji || '💩', player.x, player.y); ctx.shadowBlur = 0; ctx.restore();
      for (const particle of runtimeForDraw.particles) { const alpha = clamp(1 - particle.life / particle.maxLife, 0, 1); ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = particle.color; ctx.font = '900 13px monospace'; ctx.textAlign = 'center'; ctx.fillText(particle.text, toScreenX(particle.x), toScreenY(particle.y)); ctx.restore(); }
      if (boss) { const ratio = clamp(boss.hp / boss.maxHp, 0, 1); const barW = Math.min(440, width - 240); const x = width / 2 - barW / 2; const y = 20; ctx.save(); ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, barW, 40, 14); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(x + 14, y + 22, barW - 28, 8); ctx.fillStyle = '#fb923c'; ctx.fillRect(x + 14, y + 22, (barW - 28) * ratio, 8); ctx.fillStyle = '#fed7aa'; ctx.font = '900 12px monospace'; ctx.textAlign = 'center'; ctx.fillText(`BOSS WAVE ${boss.bossWave}: ${boss.name}`, width / 2, y + 15); ctx.restore(); }
      drawMinimap(ctx, runtimeForDraw, width, latestToiletRef.current);
      if (gameState === 'lobby') { ctx.fillStyle = 'rgba(2, 6, 23, 0.55)'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#fbbf24'; ctx.font = '900 24px monospace'; ctx.textAlign = 'center'; ctx.fillText('Pick PC or Mobile Play', width / 2, height / 2 - 8); }
      if (isLoopPaused) { ctx.fillStyle = 'rgba(2, 6, 23, 0.62)'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#bae6fd'; ctx.font = '900 32px monospace'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', width / 2, height / 2 - 16); ctx.fillStyle = '#cbd5e1'; ctx.font = '900 13px monospace'; ctx.fillText('Press P, Esc, or Resume to continue', width / 2, height / 2 + 14); }
      animationRef.current = requestAnimationFrame(drawFrame);
    };
    animationRef.current = requestAnimationFrame(drawFrame);
    return () => { resizeObserver.disconnect(); if (animationRef.current !== null) cancelAnimationFrame(animationRef.current); };
  }, [addCoins, gameState, highScore, isMuted, onHighScoreChange, poopLevel, pushParticle, spawnBossIfNeeded, spawnEnemy]);

  const buyToilet = (toilet: Toilet) => { if (unlockedToilets.includes(toilet.id)) { setActiveToiletId(toilet.id); if (!isMuted) playUnlockSound(); return; } if (coins >= toilet.cost) { unlockToilet(toilet.id, toilet.cost); if (!isMuted) playUnlockSound(); } };
  const sellOwnedToilet = (toilet: Toilet) => { if (toilet.id === STARTING_TOILET_ID || activeToilet.id === toilet.id) return; sellToilet(toilet.id, toilet.cost); };
  const buyOrEquipSkin = (skin: Skin) => { if (unlockedSkins.includes(skin.id)) { setActiveSkinId(skin.id); if (!isMuted) playUnlockSound(); return; } if (killCredits < skin.cost) return; setKillCredits((previous) => previous - skin.cost); setUnlockedSkins((previous) => previous.includes(skin.id) ? previous : [...previous, skin.id]); setActiveSkinId(skin.id); if (!isMuted) playUnlockSound(); };
  const cooldownPercent = activeToilet.cooldownMs > 0 ? clamp(1 - flushCooldownMs / activeToilet.cooldownMs, 0, 1) : 1;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/70 p-4 font-mono lg:flex-row lg:items-center lg:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Solo Arcade Engine</div><h3 className="text-xl font-black text-white">Collect kills. Unlock fruit skins.</h3><p className="mt-1 text-xs font-bold text-slate-400">Default is free. Spend kills on custom fruit skins in the Skin Shop.</p></div>
        <div className="grid grid-cols-2 gap-2 text-xs font-black sm:flex"><div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-amber-300">🪙 {coins}</div><div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-fuchsia-300">Kills {killCredits}</div><div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-cyan-300">Score {score}</div><div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-emerald-300">HP {playerHp}</div><div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-violet-300">Wave {wave}</div></div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_350px]">
        <div ref={shellRef} className="relative min-h-[520px] overflow-hidden bg-slate-950"><canvas ref={canvasRef} className="block h-full min-h-[520px] w-full touch-none" />
          {gameState === 'playing' && <button type="button" onClick={togglePause} className="absolute left-4 top-4 z-30 rounded-2xl border border-sky-300/35 bg-slate-950/80 px-4 py-2 font-mono text-xs font-black uppercase text-sky-100 shadow-xl backdrop-blur-md transition hover:bg-sky-400/15">{isPaused ? <Play className="mr-1 inline h-4 w-4" /> : <Pause className="mr-1 inline h-4 w-4" />}{isPaused ? 'Resume' : 'Pause'}</button>}
          {bossName && gameState === 'playing' && !isPaused && <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-2xl border border-orange-300/40 bg-orange-500/20 px-5 py-3 text-center font-mono text-xs font-black uppercase text-orange-100 shadow-2xl backdrop-blur-md">Boss Appeared: {bossName}</div>}
          {gameState !== 'playing' && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 p-5 text-center font-mono backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-amber-400/25 bg-slate-900/95 p-6 shadow-2xl"><div className="text-5xl">{activeSkin.emoji}🚽</div><h3 className="mt-3 text-2xl font-black uppercase text-white">{gameState === 'gameover' ? 'Quest Over' : 'Ready to Flush?'}</h3><p className="mt-2 text-sm font-bold text-slate-400">{gameState === 'gameover' ? `You scored ${score}, collected ${sessionCoins} coins, and earned ${killsThisRun} kills this run.` : 'Get kills, then buy fruit skins from the shop.'}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => startGame('pc')} className="rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black uppercase text-slate-950 shadow-xl shadow-amber-500/20 transition hover:bg-amber-300"><Play className="mr-2 inline h-4 w-4" /> Start PC Play</button><button type="button" onClick={() => startGame('mobile')} className="rounded-2xl border border-cyan-300/35 bg-cyan-400/15 px-5 py-4 text-sm font-black uppercase text-cyan-100 transition hover:bg-cyan-400/25"><Play className="mr-2 inline h-4 w-4" /> Start Mobile Play</button></div></div></div>}
          {controlMode === 'mobile' && gameState === 'playing' && !isPaused && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 p-5 font-mono"><div className="pointer-events-auto relative h-32 w-32 rounded-full border border-cyan-300/30 bg-slate-900/70 shadow-2xl backdrop-blur-md touch-none" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const rect = event.currentTarget.getBoundingClientRect(); joystickRef.current = { active: true, startX: rect.left + rect.width / 2, startY: rect.top + rect.height / 2, x: event.clientX, y: event.clientY }; }} onPointerMove={(event) => { if (!joystickRef.current.active) return; joystickRef.current.x = event.clientX; joystickRef.current.y = event.clientY; }} onPointerUp={() => { joystickRef.current.active = false; }} onPointerCancel={() => { joystickRef.current.active = false; }}><div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/25 ring-2 ring-cyan-200/30" /><div className="absolute inset-x-0 bottom-3 text-center text-[10px] font-black uppercase tracking-widest text-cyan-100">Move</div></div><button type="button" onPointerDown={(event) => { event.preventDefault(); triggerFlush(); }} className="pointer-events-auto h-28 w-28 rounded-full border border-amber-200/40 bg-amber-400 text-sm font-black uppercase text-slate-950 shadow-2xl shadow-amber-500/30 transition active:scale-95">Flush</button></div>}
        </div>
        <aside className="border-t border-slate-800 bg-slate-900/80 p-4 font-mono lg:border-l lg:border-t-0">
          <div className="mb-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setShopOpen((open) => !open)} className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-xs font-black uppercase text-amber-200 transition hover:bg-amber-400/20"><ShoppingBag className="mr-1 inline h-4 w-4" /> Shop</button><button type="button" onClick={() => setIsMuted(!isMuted)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs font-black uppercase text-slate-200 transition hover:border-slate-500">{isMuted ? <VolumeX className="mr-1 inline h-4 w-4" /> : <Volume2 className="mr-1 inline h-4 w-4" />} Sound</button><button type="button" onClick={togglePause} disabled={gameState !== 'playing'} className="rounded-xl border border-sky-400/25 bg-sky-400/10 px-3 py-3 text-xs font-black uppercase text-sky-200 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40">{isPaused ? <Play className="mr-1 inline h-4 w-4" /> : <Pause className="mr-1 inline h-4 w-4" />} {isPaused ? 'Resume' : 'Pause'}</button><button type="button" onClick={restartGame} className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-3 text-xs font-black uppercase text-cyan-200 transition hover:bg-cyan-400/20"><RotateCcw className="mr-1 inline h-4 w-4" /> Restart</button></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Equipped</div><div className="mt-2 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="text-4xl">{activeSkin.emoji}</div><div><div className="text-sm font-black text-white">{activeSkin.name} Skin</div><div className="mt-1 text-xs font-bold text-slate-400">{activeToilet.name} · cooldown {(activeToilet.cooldownMs / 1000).toFixed(1)}s</div></div></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${cooldownPercent * 100}%` }} /></div></div>
          <div className="mt-4 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-4 text-xs font-bold leading-relaxed text-fuchsia-100"><div className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300">Skin Currency</div><p className="mt-2">Kills buy skins. Normal enemies give 1 kill. Bosses give 5 kills. Current kill bank: {killCredits}.</p></div>
          {shopOpen && <div className="mt-4"><div className="mb-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setShopTab('toilets')} className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${shopTab === 'toilets' ? 'bg-amber-400 text-slate-950' : 'bg-slate-950 text-slate-300'}`}>Toilets</button><button type="button" onClick={() => setShopTab('skins')} className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${shopTab === 'skins' ? 'bg-fuchsia-400 text-slate-950' : 'bg-slate-950 text-slate-300'}`}>Skins</button></div><div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">{shopTab === 'toilets' ? shopToilets.map((toilet) => { const owned = unlockedToilets.includes(toilet.id); const active = activeToilet.id === toilet.id; const affordable = coins >= toilet.cost; return <div key={toilet.id} className="rounded-2xl border border-slate-800 bg-slate-950/85 p-3"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="text-3xl">{toilet.emoji}</div><div className="min-w-0"><div className="truncate text-xs font-black text-white">{toilet.name}</div><div className="mt-1 text-[10px] font-bold text-slate-500">Cost {toilet.cost} coins · DMG {toilet.damage}</div></div></div><button type="button" disabled={!owned && !affordable} onClick={() => buyToilet(toilet)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase transition ${active ? 'bg-emerald-400 text-slate-950' : owned ? 'bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25' : affordable ? 'bg-amber-400 text-slate-950 hover:bg-amber-300' : 'cursor-not-allowed bg-slate-800 text-slate-500'}`}>{active ? 'Active' : owned ? 'Equip' : affordable ? 'Buy' : 'Need Coins'}</button></div>{owned && toilet.id !== STARTING_TOILET_ID && !active && <button type="button" onClick={() => sellOwnedToilet(toilet)} className="mt-2 text-[10px] font-black uppercase text-rose-300 hover:text-rose-200">Sell for {Math.floor(toilet.cost * 0.9)} coins</button>}</div>; }) : SKINS.map((skin) => { const owned = unlockedSkins.includes(skin.id); const active = activeSkinId === skin.id; const affordable = killCredits >= skin.cost; return <div key={skin.id} className="rounded-2xl border border-fuchsia-400/15 bg-slate-950/85 p-3"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="text-3xl">{skin.emoji}</div><div className="min-w-0"><div className="truncate text-xs font-black text-white">{skin.name}</div><div className="mt-1 text-[10px] font-bold text-slate-500">{skin.cost === 0 ? 'Free Default Skin' : `${skin.cost} kills`} · {skin.description}</div></div></div><button type="button" disabled={!owned && !affordable} onClick={() => buyOrEquipSkin(skin)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase transition ${active ? 'bg-emerald-400 text-slate-950' : owned ? 'bg-fuchsia-400/15 text-fuchsia-200 hover:bg-fuchsia-400/25' : affordable ? 'bg-fuchsia-400 text-slate-950 hover:bg-fuchsia-300' : 'cursor-not-allowed bg-slate-800 text-slate-500'}`}>{active ? 'Active' : owned ? 'Equip' : skin.cost === 0 ? 'Free' : affordable ? 'Buy' : 'Need Kills'}</button></div></div>; })}</div></div>}
          {!shopOpen && <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs font-bold leading-relaxed text-slate-400"><div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Next Upgrade</div>{nextLockedToilet ? <p className="mt-2">Save {Math.max(0, nextLockedToilet.cost - coins)} more coins for {nextLockedToilet.emoji} {nextLockedToilet.name}.</p> : <p className="mt-2">You own every simplified shop toilet. Keep chasing higher scores.</p>}<p className="mt-3">Open Shop → Skins to spend kills on fruit skins. Default is free.</p></div>}
        </aside>
      </div>
    </div>
  );
}
