import { useEffect, type ComponentProps } from 'react';
import SimplifiedGameAreaV6 from './SimplifiedGameAreaV6';

type GameAreaV6Props = ComponentProps<typeof SimplifiedGameAreaV6>;

type Theme = {
  body: string;
  dark: string;
  light: string;
  detail?: string;
  seed?: string;
};

const THEMES: Record<string, Theme> = {
  '🍎': { body: '#ef4444', dark: '#991b1b', light: '#fecaca', detail: '#166534' },
  '🍌': { body: '#facc15', dark: '#a16207', light: '#fef08a', detail: '#854d0e' },
  '🍓': { body: '#e11d48', dark: '#9f1239', light: '#fecdd3', detail: '#15803d', seed: '#fde68a' },
  '🍉': { body: '#22c55e', dark: '#166534', light: '#bbf7d0', detail: '#ef4444', seed: '#111827' },
  '🍍': { body: '#f59e0b', dark: '#92400e', light: '#fde68a', detail: '#16a34a', seed: '#78350f' },
  '🍒': { body: '#dc2626', dark: '#991b1b', light: '#fecaca', detail: '#16a34a' },
  '🍇': { body: '#8b5cf6', dark: '#5b21b6', light: '#ddd6fe', detail: '#16a34a' },
};

function isPlayerFruit(text: unknown, font: string) {
  return typeof text === 'string' && text in THEMES && /\b4[4-9]px\b/.test(font);
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function lump(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawDetails(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, theme: Theme) {
  ctx.save();

  if (text === '🍎' || text === '🍒') {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 34);
    ctx.quadraticCurveTo(x + 9, y - 47, x + 20, y - 50);
    ctx.stroke();
    oval(ctx, x + 22, y - 49, 10, 5, theme.detail || '#166534');
  }

  if (text === '🍌') {
    ctx.strokeStyle = theme.detail || '#854d0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 30, -0.95, 0.9);
    ctx.stroke();
  }

  if (text === '🍓') {
    oval(ctx, x, y - 40, 17, 7, theme.detail || '#15803d');
    ctx.fillStyle = theme.seed || '#fde68a';
    for (const point of [[-14, -18], [2, -20], [16, -11], [-5, -4], [10, 6], [-17, 10]]) {
      ctx.beginPath();
      ctx.ellipse(x + point[0], y + point[1], 2.2, 3.2, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (text === '🍉') {
    ctx.strokeStyle = theme.detail || '#ef4444';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x - 2, y + 5, 24, 0.25, 2.65);
    ctx.stroke();
    ctx.fillStyle = theme.seed || '#111827';
    for (const point of [[-9, -6], [7, 1], [-2, 13]]) {
      ctx.beginPath();
      ctx.ellipse(x + point[0], y + point[1], 2.2, 3.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (text === '🍍') {
    ctx.fillStyle = theme.detail || '#16a34a';
    for (const point of [[-10, -43, -0.5], [0, -48, 0], [10, -43, 0.5]]) {
      ctx.save();
      ctx.translate(x + point[0], y + point[1]);
      ctx.rotate(point[2]);
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(8, 9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  if (text === '🍇') {
    oval(ctx, x + 8, y - 42, 11, 5, theme.detail || '#16a34a');
    ctx.fillStyle = theme.light;
    ctx.globalAlpha = 0.28;
    for (const point of [[-14, -16], [0, -20], [14, -13], [-6, -2], [9, 5], [-11, 12]]) {
      ctx.beginPath();
      ctx.arc(x + point[0], y + point[1], 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawSwirl(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const theme = THEMES[text];
  ctx.save();
  ctx.shadowColor = theme.dark;
  ctx.shadowBlur = 16;
  lump(ctx, x, y + 15, 27, 19, theme.body, theme.dark);
  lump(ctx, x - 1, y - 1, 23, 17, theme.body, theme.dark);
  lump(ctx, x + 1, y - 17, 16, 13, theme.body, theme.dark);
  lump(ctx, x + 2, y - 31, 9, 8, theme.body, theme.dark);
  ctx.shadowBlur = 0;
  oval(ctx, x - 9, y - 9, 5, 3, theme.light);
  oval(ctx, x - 12, y + 8, 6, 3, theme.light);
  oval(ctx, x + 7, y - 27, 3.5, 2, theme.light);
  drawDetails(ctx, text, x, y, theme);
  ctx.restore();
}

export default function SimplifiedGameAreaV8(props: GameAreaV6Props) {
  useEffect(() => {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;

    CanvasRenderingContext2D.prototype.fillText = function fruitSwirlFillText(text: string, x: number, y: number, maxWidth?: number) {
      if (isPlayerFruit(text, this.font)) {
        drawSwirl(this, text, x, y);
        return;
      }

      if (typeof maxWidth === 'number') {
        originalFillText.call(this, text, x, y, maxWidth);
      } else {
        originalFillText.call(this, text, x, y);
      }
    } as CanvasRenderingContext2D['fillText'];

    return () => {
      if (CanvasRenderingContext2D.prototype.fillText.name === 'fruitSwirlFillText') {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
      }
    };
  }, []);

  return <SimplifiedGameAreaV6 {...props} />;
}
