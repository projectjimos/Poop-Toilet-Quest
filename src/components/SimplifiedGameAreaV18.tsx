import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import SimplifiedGameAreaV17 from './SimplifiedGameAreaV17';

type GameAreaV17Props = ComponentProps<typeof SimplifiedGameAreaV17>;

export default function SimplifiedGameAreaV18(props: GameAreaV17Props) {
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  const refreshFullscreenState = useCallback(() => {
    const element = fullscreenRef.current;
    setIsFullscreen(Boolean(element && document.fullscreenElement === element));
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', refreshFullscreenState);
    return () => document.removeEventListener('fullscreenchange', refreshFullscreenState);
  }, [refreshFullscreenState]);

  const enterFullscreen = useCallback(async () => {
    const element = fullscreenRef.current;
    if (!element) return;

    try {
      setFullscreenError(null);
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await element.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      setFullscreenError('Fullscreen was blocked by the browser. Try clicking the button again.');
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      setFullscreenError(null);
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch {
      setFullscreenError('Could not exit fullscreen. Press Esc.');
    }
  }, []);

  const toggleFullscreen = isFullscreen ? exitFullscreen : enterFullscreen;

  return (
    <div
      ref={fullscreenRef}
      className={`grid gap-3 bg-slate-950 ${isFullscreen ? 'min-h-screen overflow-y-auto p-3 md:p-5' : ''}`}
    >
      <section className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 font-mono text-xs font-bold text-emerald-100 shadow-lg shadow-emerald-950/20">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200">Fullscreen Map View</div>
            <div className="mt-1 text-lg font-black uppercase text-white">
              {isFullscreen ? 'Fullscreen active' : 'Make the map bigger'}
            </div>
            <p className="mt-1 max-w-3xl leading-relaxed text-emerald-100/80">
              Use fullscreen to give the game more screen space, reduce browser clutter, and see more of the arena while playing.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-xl bg-emerald-300 px-4 py-2 text-[11px] font-black uppercase text-slate-950 transition hover:bg-emerald-200"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          </button>
        </div>
        {fullscreenError && <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-amber-100">{fullscreenError}</div>}
      </section>

      <div className={isFullscreen ? 'min-h-[calc(100vh-8rem)]' : ''}>
        <SimplifiedGameAreaV17 {...props} />
      </div>
    </div>
  );
}
