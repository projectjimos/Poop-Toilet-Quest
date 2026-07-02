import { useEffect, useMemo, useState, type ReactNode } from 'react';

const INTRO_SEEN_SESSION_KEY = 'poop_quest_intro_seen_this_session';
const INTRO_DISABLED_KEY = 'poop_quest_intro_disabled';
const INTRO_DURATION_MS = 4200;

type Scene = {
  emoji: string;
  title: string;
  subtitle: string;
};

const SCENES: Scene[] = [
  { emoji: '🌌', title: 'A strange smell enters the arcade...', subtitle: 'The toilet world is under attack.' },
  { emoji: '💩', title: 'One hero drops in.', subtitle: 'Small. Squishy. Ready to flush.' },
  { emoji: '🚽', title: 'The throne powers up.', subtitle: 'Collect coins. Buy upgrades. Survive the waves.' },
  { emoji: '👑', title: 'Boss waves are coming.', subtitle: 'Every fifth wave brings a bigger challenge.' },
];

function shouldShowIntro() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (sessionStorage.getItem(INTRO_SEEN_SESSION_KEY) === 'true') return false;
  if (localStorage.getItem(INTRO_DISABLED_KEY) === 'true') return false;
  return true;
}

export default function IntroShortMovie({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(() => shouldShowIntro());
  const [sceneIndex, setSceneIndex] = useState(0);

  const progressPercent = useMemo(() => {
    return Math.min(100, ((sceneIndex + 1) / SCENES.length) * 100);
  }, [sceneIndex]);

  useEffect(() => {
    if (!isVisible) return;

    const sceneTimer = window.setInterval(() => {
      setSceneIndex((previous) => Math.min(SCENES.length - 1, previous + 1));
    }, INTRO_DURATION_MS / SCENES.length);

    const closeTimer = window.setTimeout(() => {
      sessionStorage.setItem(INTRO_SEEN_SESSION_KEY, 'true');
      setIsVisible(false);
    }, INTRO_DURATION_MS);

    return () => {
      window.clearInterval(sceneTimer);
      window.clearTimeout(closeTimer);
    };
  }, [isVisible]);

  const skipIntro = () => {
    sessionStorage.setItem(INTRO_SEEN_SESSION_KEY, 'true');
    setIsVisible(false);
  };

  const neverShowAgain = () => {
    localStorage.setItem(INTRO_DISABLED_KEY, 'true');
    sessionStorage.setItem(INTRO_SEEN_SESSION_KEY, 'true');
    setIsVisible(false);
  };

  const scene = SCENES[sceneIndex];

  return (
    <>
      {children}

      {isVisible && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/95 p-5 font-mono text-slate-100 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-[12%] top-[18%] h-20 w-20 rounded-full bg-amber-400/10 blur-2xl" />
            <div className="absolute right-[10%] top-[28%] h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute bottom-[14%] left-[30%] h-24 w-24 rounded-full bg-fuchsia-400/10 blur-3xl" />
          </div>

          <section className="relative w-full max-w-2xl rounded-[2rem] border border-amber-300/25 bg-slate-900/90 p-6 text-center shadow-2xl shadow-amber-950/30">
            <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full border border-amber-300/25 bg-slate-950 text-6xl shadow-xl shadow-amber-950/30 animate-pulse">
              {scene.emoji}
            </div>

            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">Poop Toilet Quest</div>
            <h1 className="mt-3 text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">{scene.title}</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm font-bold leading-relaxed text-slate-300 sm:text-base">{scene.subtitle}</p>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-amber-300 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={skipIntro}
                className="pointer-events-auto rounded-2xl bg-amber-300 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-950 transition hover:bg-amber-200"
              >
                Skip / Start Game
              </button>
              <button
                type="button"
                onClick={neverShowAgain}
                className="pointer-events-auto rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Don’t show again
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
