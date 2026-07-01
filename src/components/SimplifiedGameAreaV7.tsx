import { useEffect, type ComponentProps } from 'react';
import SimplifiedGameAreaV6 from './SimplifiedGameAreaV6';

type GameAreaV6Props = ComponentProps<typeof SimplifiedGameAreaV6>;

const FRUIT_SKIN_EMOJIS = new Set(['🍎', '🍌', '🍓', '🍉', '🍍', '🍒', '🍇']);

function isActivePlayerSkinDraw(text: unknown, font: string) {
  return typeof text === 'string' && FRUIT_SKIN_EMOJIS.has(text) && /\b4[4-9]px\b/.test(font);
}

export default function SimplifiedGameAreaV7(props: GameAreaV6Props) {
  useEffect(() => {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;

    CanvasRenderingContext2D.prototype.fillText = function poopVariantFillText(
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ) {
      if (isActivePlayerSkinDraw(text, this.font)) {
        const originalFont = this.font;
        const originalShadowBlur = this.shadowBlur;
        const originalShadowColor = this.shadowColor;

        if (typeof maxWidth === 'number') {
          originalFillText.call(this, '💩', x, y, maxWidth);
        } else {
          originalFillText.call(this, '💩', x, y);
        }

        this.save();
        this.font = '22px Arial';
        this.textAlign = 'center';
        this.textBaseline = 'middle';
        this.shadowColor = originalShadowColor || '#f59e0b';
        this.shadowBlur = Math.max(Number(originalShadowBlur) || 0, 6);
        originalFillText.call(this, text, x + 17, y - 22);
        this.restore();

        this.font = originalFont;
        this.shadowBlur = originalShadowBlur;
        this.shadowColor = originalShadowColor;
        return;
      }

      if (typeof maxWidth === 'number') {
        originalFillText.call(this, text, x, y, maxWidth);
      } else {
        originalFillText.call(this, text, x, y);
      }
    } as CanvasRenderingContext2D['fillText'];

    return () => {
      if (CanvasRenderingContext2D.prototype.fillText.name === 'poopVariantFillText') {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
      }
    };
  }, []);

  return <SimplifiedGameAreaV6 {...props} />;
}
