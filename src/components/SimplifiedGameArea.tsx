import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import type { Toilet } from '../types';
import { TOILET_CATALOG } from '../data';
import { playCoinSound, playDamageSound, playFlushSound, playUnlockSound } from '../utils/audio';

type GameState = 'lobby' | 'playing' | 'gameover';
type ControlMode = 'pc' | 'mobile';

type Enemy = { id: string; x: number; y: number; hp: number; maxHp: number; speed: number; size: number; emoji: string; name: string; value: number };
type Coin = { id: string; x: number; y: number; size: number; value: number; wobble: number };
type Fruit = { id: string; x: number; y: number; emoji: string; heal: number; size: number; wobble: number };
type Particle = { id: string; x: number; y: number; vx: number; vy: number; life: number; maxLife: number; text: string; color: string };
type Player = { x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; size: number; speed: number };

type Runtime = {
  player: Player;
  enemies: Enemy[];
  coins: Coin[];
  fruits: Fruit[];
  particles: Particle[];
  wave: number;
  score: number;
  sessionCoins: number;
  flushCooldownMs: number;
  lastEnemySpawnMs: number;
  lastFruitRollMs: number;
  lastFrameMs: number;
  active: boolean;
  worldSize: number;
  cameraX: number;
  cameraY: number;
  flushPulse: null | { x: number; y: number; radius: number; maxRadius: number; color: string; emoji: string };
};

interface SimplifiedGameAreaProps {
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
  suitLevel?: number;
  setSuitLevel?: (val: number | ((prev: number) => number)) => void;
  unlockedArmors?: string[];
  setUnlockedArmors?: (val: string[] | ((prev: string[]) => string[])) => void;
  activeArmorId?: string;
  setActiveArmorId?: (id: string) => void;
  currentUser: string | null;
}

const ENEMY_POOL = [
  { emoji: '🦠', name: 'Germ', hp: 18, speed: 72, size: 26, value: 1 },
  { emoji: '🪰', name: 'Fly', hp: 14, speed: 105, size: 24, value: 1 },
  { emoji: '🧼', name: 'Soap', hp: 28, speed: 58, size: 28, value: 2 },
  { emoji: '🧻', name: 'Paper Roll', hp: 36, speed: 46, size: 30, value: 2 },
];

const FRUITS = [
  { emoji: '🍎', heal: 15, size: 22 },
  { emoji: '🍌', heal: 25, size: 23 },
  { emoji: '🍓', heal: 35, size: 22 },
  { emoji: '🍉', heal: 50, size: 24 },
];

const SHOP_TOILET_LIMIT = 12;
const MAX_ENEMIES = 24;
const MAX_COINS = 14;
const MAX_PARTICLES = 90;
const MAX_FRUITS = 3;
const WORLD_SIZE = 1500;

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function spawnCoin(worldSize = WORLD_SIZE): Coin {
  return { id: randomId('coin'), x: 70 + Math.random() * (worldSize - 140), y: 70 + Math.random() * (worldSize - 140), size: 15, value: 1, wobble: Math.random() * Math.PI * 2 };
}

function makeRuntime(): Runtime {
  return {
    player: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, vx: 0, vy: 0, hp: 100, maxHp: 100, size: 28, speed: 250 },
    enemies: [],
    coins: Array.from({ length: 10 }, () => spawnCoin()),
    fruits: [],
    particles: [],
    wave: 1,
    score: 0,
    sessionCoins: 0,
    flushCooldownMs: 0,
    lastEnemySpawnMs: 0,
    lastFruitRollMs: 0,
    lastFrameMs: 0,
    active: false,
    worldSize: WORLD_SIZE,
    cameraX: 0,
    cameraY: 0,
    flushPulse: null,
  };
}

function drawMinimap(ctx: CanvasRenderingContext2D, runtime: Runtime, width: number, activeToilet: Toilet) {
  const mapSize = Math.min(158, Math.max(118, Math.floor(width * 0.22)));
  const padding = 16;
  const x = width - mapSize - padding;
  const y = padding;
  const scale = mapSize / runtime.worldSize;
  const player = runtime.player;
  const range = activeToilet.flushRadius;
  const enemiesInRange = runtime.enemies.filter((enemy) => distance(player.x, player.y, enemy.x, enemy.y) <= range + enemy.size);
  const dangerEnemies = runtime.enemies.filter((enemy) => distance(player.x, player.y, enemy.x, enemy.y) <= 260 + enemy.size);

  ctx.save();
  ctx.globalAlpha = 0.96;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
  ctx.strokeStyle = enemiesInRange.length > 0 ? '#fbbf24' : dangerEnemies.length > 0 ? '#fb7185' : '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, mapSize, mapSize, 14);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 22, mapSize - 12, mapSize - 28, 10);
  ctx.clip();
  ctx.fillStyle = '#07111f';
  ctx.fillRect(x + 6, y + 22, mapSize - 12, mapSize - 28);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gx = x + 6 + ((mapSize - 12) * i) / 4;
    const gy = y + 22 + ((mapSize - 28) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(gx, y + 22);
    ctx.lineTo(gx, y + mapSize - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6, gy);
    ctx.lineTo(x + mapSize - 6, gy);
    ctx.stroke();
  }

  const mapX = (worldX: number) => x + 6 + worldX * scale * ((mapSize - 12) / mapSize);
  const mapY = (worldY: number) => y + 22 + worldY * scale * ((mapSize - 28) / mapSize);
  const px = mapX(player.x);
  const py = mapY(player.y);
  const rangeRadius = Math.max(8, range * scale * ((mapSize - 12) / mapSize));

  ctx.strokeStyle = enemiesInRange.length > 0 ? 'rgba(251, 191, 36, 0.75)' : 'rgba(56, 189, 248, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px, py, rangeRadius, 0, Math.PI * 2);
  ctx.stroke();

  for (const coin of runtime.coins) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(mapX(coin.x), mapY(coin.y), 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const fruit of runtime.fruits) {
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(mapX(fruit.x), mapY(fruit.y), 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of runtime.enemies) {
    const ex = mapX(enemy.x);
    const ey = mapY(enemy.y);
    const inRange = distance(player.x, player.y, enemy.x, enemy.y) <= range + enemy.size;
    const close = distance(player.x, player.y, enemy.x, enemy.y) <= 260 + enemy.size;
    ctx.fillStyle = inRange ? '#fbbf24' : close ? '#fb7185' : '#ef4444';
    ctx.beginPath();
    ctx.arc(ex, ey, inRange ? 4.1 : close ? 3.6 : 2.8, 0, Math.PI * 2);
    ctx.fill();
    if (inRange) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#22c55e';
  ctx.strokeStyle = '#ecfeff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '900 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('MINIMAP', x + 10, y + 12);
  ctx.textAlign = 'right';
  ctx.fillStyle = enemiesInRange.length > 0 ? '#fbbf24' : dangerEnemies.length > 0 ? '#fb7185' : '#67e8f9';
  ctx.fillText(`${enemiesInRange.length} IN RANGE`, x + mapSize - 9, y + 12);

  const bannerY = y + mapSize + 6;
  ctx.fillStyle = enemiesInRange.length > 0 ? 'rgba(251, 191, 36, 0.94)' : dangerEnemies.length > 0 ? 'rgba(251, 113, 133, 0.92)' : 'rgba(8, 47, 73, 0.92)';
  ctx.beginPath();
  ctx.roundRect(x, bannerY, mapSize, 23, 9);
  ctx.fill();
  ctx.fillStyle = enemiesInRange.length > 0 ? '#1e293b' : '#e0f2fe';
  ctx.font = '900 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(enemiesInRange.length > 0 ? 'FLUSH NOW!' : dangerEnemies.length > 0 ? 'ENEMY CLOSE!' : 'AREA CLEAR', x + mapSize / 2, bannerY + 12);
  ctx.restore();
}

export default function SimplifiedGameArea({
  coins,
  addCoins,
  unlockedToilets,
  unlockToilet,
  sellToilet,
  activeToilet,
  setActiveToiletId,
  isMuted,
  setIsMuted,
  highScore,
  onHighScoreChange,
  poopLevel,
}: SimplifiedGameAreaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<Runtime>(makeRuntime());
  const keysRef = useRef<Record<string, boolean>>({});
  const joystickRef = useRef({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const latestToiletRef = useRef(activeToilet);
  const pendingCoinSoundRef = useRef(false);

  const [gameState, setGameState] = useState<GameState>('lobby');
  const [controlMode, setControlMode] = useState<ControlMode>(() => (localStorage.getItem('poop_quest_control_mode') as ControlMode) || 'pc');
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [playerHp, setPlayerHp] = useState(100);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [flushCooldownMs, setFlushCooldownMs] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);

  const shopToilets = useMemo(() => TOILET_CATALOG.filter((toilet) => toilet.id !== 'cowguy_throne').slice(0, SHOP_TOILET_LIMIT), []);
  const nextLockedToilet = useMemo(() => shopToilets.find((toilet) => !unlockedToilets.includes(toilet.id)), [shopToilets, unlockedToilets]);

  useEffect(() => {
    latestToiletRef.current = activeToilet;
  }, [activeToilet]);

  useEffect(() => {
    localStorage.setItem('poop_quest_control_mode', controlMode);
  }, [controlMode]);

  const pushParticle = useCallback((text: string, x: number, y: number, color = '#fbbf24') => {
    const runtime = runtimeRef.current;
    runtime.particles.push({ id: randomId('fx'), x, y, vx: (Math.random() - 0.5) * 40, vy: -55 - Math.random() * 35, life: 0, maxLife: 650, text, color });
    if (runtime.particles.length > MAX_PARTICLES) runtime.particles.splice(0, runtime.particles.length - MAX_PARTICLES);
  }, []);

  const spawnEnemy = useCallback((now: number) => {
    const runtime = runtimeRef.current;
    if (!runtime.active || runtime.enemies.length >= MAX_ENEMIES) return;
    const maxEnemiesForWave = clamp(5 + runtime.wave * 2, 7, MAX_ENEMIES);
    if (runtime.enemies.length >= maxEnemiesForWave) return;
    const spawnEvery = clamp(1400 - runtime.wave * 90 - poopLevel * 20, 520, 1400);
    if (now - runtime.lastEnemySpawnMs < spawnEvery) return;
    runtime.lastEnemySpawnMs = now;

    const player = runtime.player;
    const angle = Math.random() * Math.PI * 2;
    const distFromPlayer = 430 + Math.random() * 180;
    const poolIndex = Math.min(ENEMY_POOL.length - 1, Math.floor((runtime.wave - 1) / 3));
    const template = ENEMY_POOL[Math.floor(Math.random() * (poolIndex + 1))];
    runtime.enemies.push({
      id: randomId('enemy'),
      x: clamp(player.x + Math.cos(angle) * distFromPlayer, 35, runtime.worldSize - 35),
      y: clamp(player.y + Math.sin(angle) * distFromPlayer, 35, runtime.worldSize - 35),
      hp: template.hp + runtime.wave * 3,
      maxHp: template.hp + runtime.wave * 3,
      speed: template.speed + runtime.wave * 4,
      size: template.size,
      emoji: template.emoji,
      name: template.name,
      value: template.value,
    });
  }, [poopLevel]);

  const triggerFlush = useCallback(() => {
    const runtime = runtimeRef.current;
    const toilet = latestToiletRef.current;
    if (!runtime.active || runtime.player.hp <= 0 || runtime.flushCooldownMs > 0) return;
    runtime.flushCooldownMs = toilet.cooldownMs;
    runtime.flushPulse = { x: runtime.player.x, y: runtime.player.y, radius: 20, maxRadius: toilet.flushRadius, color: toilet.pulseColor, emoji: toilet.emoji };
    for (const enemy of runtime.enemies) {
      if (distance(runtime.player.x, runtime.player.y, enemy.x, enemy.y) <= toilet.flushRadius + enemy.size) {
        enemy.hp -= toilet.damage;
        pushParticle(`-${toilet.damage}`, enemy.x, enemy.y - 20, toilet.pulseColor);
      }
    }
    if (!isMuted) playFlushSound();
    setFlushCooldownMs(runtime.flushCooldownMs);
    window.dispatchEvent(new CustomEvent('ptq:play-requested'));
  }, [isMuted, pushParticle]);

  const startGame = useCallback((mode: ControlMode) => {
    setControlMode(mode);
    const runtime = makeRuntime();
    runtime.active = true;
    runtimeRef.current = runtime;
    setGameState('playing');
    setShopOpen(false);
    setScore(0);
    setWave(1);
    setPlayerHp(100);
    setSessionCoins(0);
    setFlushCooldownMs(0);
    window.dispatchEvent(new CustomEvent('ptq:play-requested'));
  }, []);

  const restartGame = useCallback(() => startGame(controlMode), [controlMode, startGame]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keysRef.current[event.key] = true;
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        triggerFlush();
      }
    };
    const up = (event: KeyboardEvent) => {
      keysRef.current[event.key] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [triggerFlush]);

  useEffect(() => {
    (window as any).triggerToiletFlush = triggerFlush;
    return () => {
      if ((window as any).triggerToiletFlush === triggerFlush) delete (window as any).triggerToiletFlush;
    };
  }, [triggerFlush]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = shell.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(320, Math.floor(rect.width * scale));
      canvas.height = Math.max(360, Math.floor(rect.height * scale));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(shell);

    const drawFrame = (now: number) => {
      const runtime = runtimeRef.current;
      const width = canvas.clientWidth || 900;
      const height = canvas.clientHeight || 580;
      const dtMs = runtime.lastFrameMs ? Math.min(40, now - runtime.lastFrameMs) : 16;
      const dt = dtMs / 1000;
      runtime.lastFrameMs = now;

      if (runtime.active) {
        const player = runtime.player;
        const keys = keysRef.current;
        let mx = 0;
        let my = 0;
        if (keys.w || keys.W || keys.ArrowUp) my -= 1;
        if (keys.s || keys.S || keys.ArrowDown) my += 1;
        if (keys.a || keys.A || keys.ArrowLeft) mx -= 1;
        if (keys.d || keys.D || keys.ArrowRight) mx += 1;

        const joystick = joystickRef.current;
        if (joystick.active) {
          const dx = joystick.x - joystick.startX;
          const dy = joystick.y - joystick.startY;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 8) {
            mx = dx / len;
            my = dy / len;
          }
        }

        if (mx !== 0 || my !== 0) {
          const len = Math.sqrt(mx * mx + my * my) || 1;
          player.vx = (mx / len) * player.speed;
          player.vy = (my / len) * player.speed;
        } else {
          player.vx *= 0.82;
          player.vy *= 0.82;
        }
        player.x = clamp(player.x + player.vx * dt, player.size, runtime.worldSize - player.size);
        player.y = clamp(player.y + player.vy * dt, player.size, runtime.worldSize - player.size);

        runtime.flushCooldownMs = Math.max(0, runtime.flushCooldownMs - dtMs);
        if (runtime.flushPulse) {
          runtime.flushPulse.radius += dtMs * 0.72;
          if (runtime.flushPulse.radius >= runtime.flushPulse.maxRadius) runtime.flushPulse = null;
        }
        spawnEnemy(now);
        if (runtime.coins.length < MAX_COINS) runtime.coins.push(spawnCoin(runtime.worldSize));

        if (now - runtime.lastFruitRollMs > 1000) {
          runtime.lastFruitRollMs = now;
          if (runtime.fruits.length < MAX_FRUITS && Math.random() < 0.025) {
            const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
            runtime.fruits.push({ id: randomId('fruit'), x: 80 + Math.random() * (runtime.worldSize - 160), y: 80 + Math.random() * (runtime.worldSize - 160), emoji: fruit.emoji, heal: fruit.heal, size: fruit.size, wobble: Math.random() * Math.PI * 2 });
          }
        }

        for (const enemy of runtime.enemies) {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          enemy.x += (dx / len) * enemy.speed * dt;
          enemy.y += (dy / len) * enemy.speed * dt;
          if (len < player.size + enemy.size * 0.55) {
            player.hp -= 22 * dt;
            if (Math.random() < 0.06) pushParticle('Ouch!', player.x, player.y - 25, '#fb7185');
          }
        }

        const remainingEnemies: Enemy[] = [];
        for (const enemy of runtime.enemies) {
          if (enemy.hp <= 0) {
            runtime.score += enemy.value;
            pushParticle(`+${enemy.value} kill`, enemy.x, enemy.y - 10, '#a7f3d0');
            runtime.coins.push(spawnCoin(runtime.worldSize));
            if (Math.random() < 0.25 && runtime.coins.length < MAX_COINS) runtime.coins.push(spawnCoin(runtime.worldSize));
          } else remainingEnemies.push(enemy);
        }
        runtime.enemies = remainingEnemies.slice(-MAX_ENEMIES);
        runtime.coins = runtime.coins.slice(-MAX_COINS);

        runtime.coins = runtime.coins.filter((coin) => {
          if (distance(player.x, player.y, coin.x, coin.y) < player.size + coin.size) {
            runtime.sessionCoins += coin.value;
            addCoins(coin.value);
            pushParticle('+1 🪙', coin.x, coin.y - 10, '#fcd34d');
            pendingCoinSoundRef.current = true;
            window.dispatchEvent(new CustomEvent('ptq:coins-updated'));
            return false;
          }
          return true;
        });

        runtime.fruits = runtime.fruits.filter((fruit) => {
          if (distance(player.x, player.y, fruit.x, fruit.y) < player.size + fruit.size) {
            const oldHp = player.hp;
            player.hp = clamp(player.hp + fruit.heal, 0, player.maxHp);
            pushParticle(`+${Math.round(player.hp - oldHp)} HP`, fruit.x, fruit.y - 10, '#34d399');
            return false;
          }
          return true;
        });

        runtime.particles = runtime.particles.filter((particle) => {
          particle.life += dtMs;
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          return particle.life < particle.maxLife;
        }).slice(-MAX_PARTICLES);

        const nextWave = Math.max(1, Math.floor(runtime.score / 12) + 1);
        if (nextWave !== runtime.wave) {
          runtime.wave = nextWave;
          pushParticle(`Wave ${nextWave}`, player.x, player.y - 55, '#fbbf24');
        }
        if (player.hp <= 0) {
          player.hp = 0;
          runtime.active = false;
          setGameState('gameover');
          if (runtime.score > highScore) onHighScoreChange(runtime.score);
          if (!isMuted) playDamageSound();
        }

        runtime.cameraX = clamp(player.x - width / 2, 0, runtime.worldSize - width);
        runtime.cameraY = clamp(player.y - height / 2, 0, runtime.worldSize - height);
        setScore(runtime.score);
        setWave(runtime.wave);
        setPlayerHp(Math.ceil(player.hp));
        setSessionCoins(runtime.sessionCoins);
        setFlushCooldownMs(Math.ceil(runtime.flushCooldownMs));
        if (pendingCoinSoundRef.current) {
          pendingCoinSoundRef.current = false;
          if (!isMuted) playCoinSound();
        }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);
      const runtimeForDraw = runtimeRef.current;
      const camX = runtimeForDraw.cameraX;
      const camY = runtimeForDraw.cameraY;
      const toScreenX = (worldX: number) => worldX - camX;
      const toScreenY = (worldY: number) => worldY - camY;

      ctx.save();
      ctx.translate(-camX, -camY);
      ctx.fillStyle = '#07111f';
      ctx.fillRect(0, 0, runtimeForDraw.worldSize, runtimeForDraw.worldSize);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= runtimeForDraw.worldSize; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, runtimeForDraw.worldSize);
        ctx.stroke();
      }
      for (let y = 0; y <= runtimeForDraw.worldSize; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(runtimeForDraw.worldSize, y);
        ctx.stroke();
      }
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ef4444';
      ctx.strokeRect(0, 0, runtimeForDraw.worldSize, runtimeForDraw.worldSize);

      for (const coin of runtimeForDraw.coins) {
        const float = Math.sin(now / 180 + coin.wobble) * 5;
        ctx.font = `${coin.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪙', coin.x, coin.y + float);
      }
      for (const fruit of runtimeForDraw.fruits) {
        const float = Math.sin(now / 160 + fruit.wobble) * 5;
        ctx.font = `${fruit.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fruit.emoji, fruit.x, fruit.y + float);
      }
      const pulse = runtimeForDraw.flushPulse;
      if (pulse) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = pulse.color;
        ctx.lineWidth = 6;
        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '42px Arial';
        ctx.fillText(pulse.emoji, pulse.x, pulse.y);
        ctx.restore();
      }
      for (const enemy of runtimeForDraw.enemies) {
        ctx.font = `${enemy.size + 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(enemy.emoji, enemy.x, enemy.y);
        const barWidth = enemy.size + 12;
        const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
        ctx.fillStyle = '#334155';
        ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.size - 14, barWidth, 4);
        ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.size - 14, barWidth * ratio, 4);
      }
      const player = runtimeForDraw.player;
      ctx.font = `${player.size + 18}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.fillText('💩', player.x, player.y);
      ctx.shadowBlur = 0;
      ctx.restore();

      for (const particle of runtimeForDraw.particles) {
        const alpha = clamp(1 - particle.life / particle.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.font = '900 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(particle.text, toScreenX(particle.x), toScreenY(particle.y));
        ctx.restore();
      }

      drawMinimap(ctx, runtimeForDraw, width, latestToiletRef.current);

      if (gameState === 'lobby') {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Pick PC or Mobile Play', width / 2, height / 2 - 8);
      }
      animationRef.current = requestAnimationFrame(drawFrame);
    };

    animationRef.current = requestAnimationFrame(drawFrame);
    return () => {
      resizeObserver.disconnect();
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [addCoins, gameState, highScore, isMuted, onHighScoreChange, poopLevel, pushParticle, spawnEnemy]);

  const buyToilet = (toilet: Toilet) => {
    if (unlockedToilets.includes(toilet.id)) {
      setActiveToiletId(toilet.id);
      if (!isMuted) playUnlockSound();
      return;
    }
    if (coins >= toilet.cost) {
      unlockToilet(toilet.id, toilet.cost);
      if (!isMuted) playUnlockSound();
    }
  };

  const sellOwnedToilet = (toilet: Toilet) => {
    if (toilet.id === 'porta_potty' || activeToilet.id === toilet.id) return;
    sellToilet(toilet.id, toilet.cost);
  };

  const cooldownPercent = activeToilet.cooldownMs > 0 ? clamp(1 - flushCooldownMs / activeToilet.cooldownMs, 0, 1) : 1;

  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/30 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/70 p-4 font-mono lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Solo Arcade Engine</div>
          <h3 className="text-xl font-black text-white">Move fast. Flush germs. Buy toilets.</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">Top-right minimap shows enemies, nearby danger, and who is inside your flush range.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-black sm:flex">
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-amber-300">🪙 {coins}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-cyan-300">Score {score}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-emerald-300">HP {playerHp}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-violet-300">Wave {wave}</div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div ref={shellRef} className="relative min-h-[520px] overflow-hidden bg-slate-950">
          <canvas ref={canvasRef} className="block h-full min-h-[520px] w-full touch-none" />

          {gameState !== 'playing' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 p-5 text-center font-mono backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-amber-400/25 bg-slate-900/95 p-6 shadow-2xl">
                <div className="text-5xl">💩🚽</div>
                <h3 className="mt-3 text-2xl font-black uppercase text-white">{gameState === 'gameover' ? 'Quest Over' : 'Ready to Flush?'}</h3>
                <p className="mt-2 text-sm font-bold text-slate-400">{gameState === 'gameover' ? `You scored ${score} kills and collected ${sessionCoins} coins this run.` : 'Start instantly. Watch the top-right minimap to time your flushes.'}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => startGame('pc')} className="rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black uppercase text-slate-950 shadow-xl shadow-amber-500/20 transition hover:bg-amber-300">
                    <Play className="mr-2 inline h-4 w-4" /> Start PC Play
                  </button>
                  <button type="button" onClick={() => startGame('mobile')} className="rounded-2xl border border-cyan-300/35 bg-cyan-400/15 px-5 py-4 text-sm font-black uppercase text-cyan-100 transition hover:bg-cyan-400/25">
                    <Play className="mr-2 inline h-4 w-4" /> Start Mobile Play
                  </button>
                </div>
              </div>
            </div>
          )}

          {controlMode === 'mobile' && gameState === 'playing' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 p-5 font-mono">
              <div
                className="pointer-events-auto relative h-32 w-32 rounded-full border border-cyan-300/30 bg-slate-900/70 shadow-2xl backdrop-blur-md touch-none"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const rect = event.currentTarget.getBoundingClientRect();
                  joystickRef.current = { active: true, startX: rect.left + rect.width / 2, startY: rect.top + rect.height / 2, x: event.clientX, y: event.clientY };
                }}
                onPointerMove={(event) => {
                  if (!joystickRef.current.active) return;
                  joystickRef.current.x = event.clientX;
                  joystickRef.current.y = event.clientY;
                }}
                onPointerUp={() => { joystickRef.current.active = false; }}
                onPointerCancel={() => { joystickRef.current.active = false; }}
              >
                <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/25 ring-2 ring-cyan-200/30" />
                <div className="absolute inset-x-0 bottom-3 text-center text-[10px] font-black uppercase tracking-widest text-cyan-100">Move</div>
              </div>
              <button type="button" onPointerDown={(event) => { event.preventDefault(); triggerFlush(); }} className="pointer-events-auto h-28 w-28 rounded-full border border-amber-200/40 bg-amber-400 text-sm font-black uppercase text-slate-950 shadow-2xl shadow-amber-500/30 transition active:scale-95">
                Flush
              </button>
            </div>
          )}
        </div>

        <aside className="border-t border-slate-800 bg-slate-900/80 p-4 font-mono lg:border-l lg:border-t-0">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setShopOpen((open) => !open)} className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-xs font-black uppercase text-amber-200 transition hover:bg-amber-400/20"><ShoppingBag className="mr-1 inline h-4 w-4" /> Shop</button>
            <button type="button" onClick={() => setIsMuted(!isMuted)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs font-black uppercase text-slate-200 transition hover:border-slate-500">{isMuted ? <VolumeX className="mr-1 inline h-4 w-4" /> : <Volume2 className="mr-1 inline h-4 w-4" />} Sound</button>
            <button type="button" onClick={restartGame} className="col-span-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-3 text-xs font-black uppercase text-cyan-200 transition hover:bg-cyan-400/20"><RotateCcw className="mr-1 inline h-4 w-4" /> Restart Current Mode</button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Equipped Toilet</div>
            <div className="mt-2 flex items-center gap-3">
              <div className="text-4xl">{activeToilet.emoji}</div>
              <div>
                <div className="text-sm font-black text-white">{activeToilet.name}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">Damage {activeToilet.damage} · Radius {activeToilet.flushRadius} · Cooldown {(activeToilet.cooldownMs / 1000).toFixed(1)}s</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${cooldownPercent * 100}%` }} /></div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs font-bold leading-relaxed text-slate-400">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Map Legend</div>
            <div className="mt-2 grid gap-1">
              <span><span className="text-emerald-300">●</span> You</span>
              <span><span className="text-rose-400">●</span> Enemy</span>
              <span><span className="text-amber-300">●</span> Enemy inside flush range</span>
              <span><span className="text-yellow-300">●</span> Coins · <span className="text-emerald-300">●</span> Fruit</span>
            </div>
          </div>

          {shopOpen && (
            <div className="mt-4 max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {shopToilets.map((toilet) => {
                const owned = unlockedToilets.includes(toilet.id);
                const active = activeToilet.id === toilet.id;
                const affordable = coins >= toilet.cost;
                return (
                  <div key={toilet.id} className="rounded-2xl border border-slate-800 bg-slate-950/85 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3"><div className="text-3xl">{toilet.emoji}</div><div className="min-w-0"><div className="truncate text-xs font-black text-white">{toilet.name}</div><div className="mt-1 text-[10px] font-bold text-slate-500">Cost {toilet.cost} · DMG {toilet.damage} · R {toilet.flushRadius}</div></div></div>
                      <button type="button" disabled={!owned && !affordable} onClick={() => buyToilet(toilet)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase transition ${active ? 'bg-emerald-400 text-slate-950' : owned ? 'bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25' : affordable ? 'bg-amber-400 text-slate-950 hover:bg-amber-300' : 'cursor-not-allowed bg-slate-800 text-slate-500'}`}>{active ? 'Active' : owned ? 'Equip' : affordable ? 'Buy' : 'Need Coins'}</button>
                    </div>
                    {owned && toilet.id !== 'porta_potty' && !active && <button type="button" onClick={() => sellOwnedToilet(toilet)} className="mt-2 text-[10px] font-black uppercase text-rose-300 hover:text-rose-200">Sell for {Math.floor(toilet.cost * 0.9)} coins</button>}
                  </div>
                );
              })}
            </div>
          )}

          {!shopOpen && (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs font-bold leading-relaxed text-slate-400">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Next Upgrade</div>
              {nextLockedToilet ? <p className="mt-2">Save {Math.max(0, nextLockedToilet.cost - coins)} more coins for {nextLockedToilet.emoji} {nextLockedToilet.name}.</p> : <p className="mt-2">You own every simplified shop toilet. Keep chasing higher scores.</p>}
              <p className="mt-3">PC: WASD/Arrows + Space. Mobile: use the joystick and Flush button.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
