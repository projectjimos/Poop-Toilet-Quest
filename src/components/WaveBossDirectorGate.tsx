import { useEffect, useRef, useState, type ReactNode } from 'react';
import { playBossAppearsSound, playWaveCompleteSound } from '../utils/audio';

interface WaveBossDirectorGateProps {
  children: ReactNode;
}

interface WaveBanner {
  wave: number;
  kind: 'normal' | 'boss';
  title: string;
  subtitle: string;
}

type WaveSnapshot = {
  currentWave: number;
  targetQuota: number;
  spawnedThisWave: number;
  liveEnemies: number;
  remainingSpawns: number;
  bossRequired: boolean;
  bossDefeated: boolean;
};

const WAVE_LABEL_PATTERN = /Poop Crusader\s*Level\s*(\d+)/i;
const WAVE_RUNTIME_KEY = '__ptqWaveClearRuntime';
const WAVE_UPDATE_EVENT = 'ptq:wave-director-updated';

const getVisibleWave = (): number | null => {
  const text = document.body?.innerText || '';
  const match = text.match(WAVE_LABEL_PATTERN);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getRuntimeSnapshot = (): WaveSnapshot | null => {
  const runtime = ((window as unknown as Record<string, any>)[WAVE_RUNTIME_KEY]);
  if (!runtime?.active || !Number.isFinite(runtime.currentWave)) return null;
  return {
    currentWave: runtime.currentWave,
    targetQuota: runtime.targetQuota || 0,
    spawnedThisWave: runtime.spawnedThisWave || 0,
    liveEnemies: runtime.liveEnemies || 0,
    remainingSpawns: Math.max(0, (runtime.targetQuota || 0) - (runtime.spawnedThisWave || 0)),
    bossRequired: Boolean(runtime.bossRequired),
    bossDefeated: Boolean(runtime.bossDefeated)
  };
};

const isGameActivelyPlaying = (): boolean => {
  const text = document.body?.innerText || '';
  const isLobby = /SELECT INPUT SYSTEM|Start PC Play|Start Mobile Play|Start CO-OP Play/i.test(text);
  const isGameOver = /GAME OVER|Try Again|Return to Lobby/i.test(text);
  const hasWaveHud = WAVE_LABEL_PATTERN.test(text);
  return hasWaveHud && !isLobby && !isGameOver;
};

const makeBanner = (wave: number): WaveBanner => {
  const isBoss = wave % 5 === 0;
  if (isBoss) {
    return {
      wave,
      kind: 'boss',
      title: `EXTREME BOSS WAVE ${wave}`,
      subtitle: 'Clear every monster and defeat the crowned bacteria boss before the next wave unlocks.'
    };
  }

  return {
    wave,
    kind: 'normal',
    title: `WAVE ${wave}`,
    subtitle: wave === 1
      ? 'Clear every monster in this wave before wave 2 opens.'
      : 'More opponents are joining. The next wave only opens after the arena is clear.'
  };
};

export default function WaveBossDirectorGate({ children }: WaveBossDirectorGateProps) {
  const [banner, setBanner] = useState<WaveBanner | null>(null);
  const [activeWave, setActiveWave] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [snapshot, setSnapshot] = useState<WaveSnapshot | null>(null);
  const lastAnnouncedWaveRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const showWaveBanner = (wave: number) => {
      const nextBanner = makeBanner(wave);
      setBanner(nextBanner);

      if (nextBanner.kind === 'boss') {
        playBossAppearsSound();
      } else if (wave > 1) {
        playWaveCompleteSound();
      }

      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
      }
      bannerTimerRef.current = window.setTimeout(() => setBanner(null), nextBanner.kind === 'boss' ? 4200 : 3000);
    };

    const applySnapshot = (nextSnapshot: WaveSnapshot | null) => {
      const playingNow = isGameActivelyPlaying();
      setIsPlaying(playingNow);

      const wave = nextSnapshot?.currentWave || getVisibleWave();
      setSnapshot(nextSnapshot);

      if (!playingNow || !wave) return;

      setActiveWave(wave);
      if (lastAnnouncedWaveRef.current !== wave) {
        lastAnnouncedWaveRef.current = wave;
        showWaveBanner(wave);
      }
    };

    const handleWaveUpdate = (event: Event) => {
      const detail = (event as CustomEvent<WaveSnapshot>).detail;
      if (detail?.currentWave) {
        applySnapshot(detail);
      }
    };

    window.addEventListener(WAVE_UPDATE_EVENT, handleWaveUpdate);

    const interval = window.setInterval(() => {
      applySnapshot(getRuntimeSnapshot());
    }, 350);

    return () => {
      window.removeEventListener(WAVE_UPDATE_EVENT, handleWaveUpdate);
      window.clearInterval(interval);
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const liveCount = snapshot?.liveEnemies ?? 0;
  const targetQuota = snapshot?.targetQuota ?? 0;
  const spawned = snapshot?.spawnedThisWave ?? 0;
  const remainingSpawns = snapshot?.remainingSpawns ?? 0;
  const bossLocked = Boolean(snapshot?.bossRequired && !snapshot?.bossDefeated);

  return (
    <>
      {children}

      {isPlaying && (
        <div className="fixed left-1/2 top-3 z-[320] -translate-x-1/2 pointer-events-none px-3 w-full max-w-sm">
          <div className={`mx-auto rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md ${activeWave % 5 === 0 ? 'bg-red-950/85 border-red-400/50 shadow-red-950/50' : 'bg-slate-950/85 border-amber-400/35 shadow-amber-950/40'}`}>
            <div className="flex items-center justify-between gap-3 font-mono">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-300">Current mission</div>
                <div className={`text-sm font-black ${activeWave % 5 === 0 ? 'text-red-300' : 'text-amber-300'}`}>Wave {activeWave}</div>
              </div>
              <div className="text-right text-[10px] leading-tight text-slate-300">
                <div>{activeWave % 5 === 0 ? 'Boss round' : 'Clear round'}</div>
                <div className="text-slate-400">Live {liveCount} • Spawned {spawned}/{targetQuota}</div>
                <div className="text-slate-500">{remainingSpawns > 0 ? `${remainingSpawns} more incoming` : bossLocked ? 'Boss must fall' : 'Clear remaining monsters'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {banner && (
        <div className="fixed inset-0 z-[340] pointer-events-none flex items-center justify-center px-4">
          <div className={`relative max-w-xl w-full rounded-3xl border p-7 text-center shadow-2xl overflow-hidden animate-wave-pop ${banner.kind === 'boss' ? 'bg-gradient-to-br from-red-950 via-slate-950 to-purple-950 border-red-400/60 shadow-red-950/60' : 'bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 border-amber-400/50 shadow-amber-950/50'}`}>
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,white,transparent_55%)]" />
            <div className="relative">
              <div className="text-6xl mb-3">{banner.kind === 'boss' ? '👑🦠' : '🌊🚽'}</div>
              <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${banner.kind === 'boss' ? 'text-red-200' : 'text-amber-200'}`}>
                {banner.title}
              </div>
              <div className="mt-3 text-sm sm:text-base font-mono text-slate-200 leading-relaxed">
                {banner.subtitle}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-slate-300">
                <div className="rounded-xl bg-white/5 border border-white/10 py-2">Dodge</div>
                <div className="rounded-xl bg-white/5 border border-white/10 py-2">Flush</div>
                <div className="rounded-xl bg-white/5 border border-white/10 py-2">Clear all</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
