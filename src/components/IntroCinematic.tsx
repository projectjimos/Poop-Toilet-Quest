import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, FastForward, Sparkles, Timer, Zap } from 'lucide-react';
import { getCookie } from '../utils/cookies';

type IntroCinematicProps = {
  children: ReactNode;
};

const INTRO_SEEN_KEY = 'poop_quest_intro_seen_session';
const COOKIE_CONSENT_KEY = 'poop_quest_cookie_consent';

function shouldShowIntro(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const alreadyAcceptedCookies = getCookie(COOKIE_CONSENT_KEY) === 'true';
    if (alreadyAcceptedCookies) return false;

    return window.sessionStorage.getItem(INTRO_SEEN_KEY) !== 'true';
  } catch {
    return getCookie(COOKIE_CONSENT_KEY) !== 'true';
  }
}

export default function IntroCinematic({ children }: IntroCinematicProps) {
  const [showIntro, setShowIntro] = useState<boolean>(shouldShowIntro);
  const [beat, setBeat] = useState<number>(0);

  const objectives = useMemo(() => [
    {
      icon: <Zap className="w-4 h-4" />,
      title: 'React Fast',
      detail: 'Dodge rushes and hit perfect flush timing.'
    },
    {
      icon: <Coins className="w-4 h-4" />,
      title: 'Collect & Sell',
      detail: 'Grab coins, sell weak toilets, upgrade the run.'
    },
    {
      icon: <Sparkles className="w-4 h-4" />,
      title: 'Reveal Toilets',
      detail: 'Buy unknown toilets and unlock weird power.'
    },
    {
      icon: <Timer className="w-4 h-4" />,
      title: 'Level Up',
      detail: 'Every run trains faster fingers.'
    }
  ], []);

  const finishIntro = useCallback(() => {
    try {
      window.sessionStorage.setItem(INTRO_SEEN_KEY, 'true');
    } catch {
      // Storage can be unavailable in strict browser privacy modes. The intro can still close normally.
    }

    setShowIntro(false);
  }, []);

  useEffect(() => {
    if (!showIntro) return undefined;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (prefersReducedMotion) {
      setBeat(objectives.length);
      timers.push(setTimeout(finishIntro, 2200));
    } else {
      [750, 1800, 2900, 4100].forEach((delay, index) => {
        timers.push(setTimeout(() => setBeat(index + 1), delay));
      });
      timers.push(setTimeout(finishIntro, 7200));
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [finishIntro, objectives.length, showIntro]);

  if (!showIntro) {
    return <>{children}</>;
  }

  return (
    <main
      className="intro-cinematic min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-8 overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      aria-describedby="intro-subtitle"
    >
      <div className="intro-bg-grid" aria-hidden="true" />
      <div className="intro-bg-glow intro-bg-glow-amber" aria-hidden="true" />
      <div className="intro-bg-glow intro-bg-glow-cyan" aria-hidden="true" />

      <button
        type="button"
        onClick={finishIntro}
        className="intro-skip-button"
        aria-label="Skip intro and continue to the cookie gate"
      >
        <FastForward className="w-3.5 h-3.5" /> Skip
      </button>

      <section className="intro-shell relative z-10 w-full max-w-5xl rounded-[2rem] border border-amber-400/25 bg-slate-950/80 shadow-2xl shadow-amber-500/10 backdrop-blur-xl p-5 sm:p-8 md:p-10">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-10 items-center">
          <div className="intro-scene-wrap order-2 lg:order-1" aria-hidden="true">
            <div className="intro-scene">
              <div className="intro-floor" />
              <div className="intro-flush-ring" />
              <div className="intro-toilet-core">
                <div className="intro-toilet-shadow" />
                <div className="intro-toilet-emoji">🚽</div>
                <div className="intro-toilet-badge">LVL ?</div>
              </div>
              <div className="intro-enemy intro-enemy-one">🪰</div>
              <div className="intro-enemy intro-enemy-two">🦠</div>
              <div className="intro-enemy intro-enemy-three">🧻</div>
              <div className="intro-coin intro-coin-one">🪙</div>
              <div className="intro-coin intro-coin-two">🪙</div>
              <div className="intro-coin intro-coin-three">🪙</div>
              <div className="intro-mystery-card">
                <span className="text-2xl">?</span>
                <span>UNKNOWN TOILET</span>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200 mb-4">
              Fast fingers arcade quest
            </div>

            <h1 id="intro-title" className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[0.92] uppercase">
              <span className="block bg-gradient-to-r from-amber-200 via-amber-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">
                Poop Toilet
              </span>
              <span className="block text-slate-50">Quest</span>
            </h1>

            <p id="intro-subtitle" className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Flush enemies, collect coins, sell weak toilets, and reveal ridiculous unknown toilets while training your reaction speed.
            </p>

            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              {objectives.map((objective, index) => {
                const isActive = beat >= index + 1;
                return (
                  <div
                    key={objective.title}
                    className={`intro-objective-card ${isActive ? 'intro-objective-card-active' : ''}`}
                  >
                    <div className="intro-objective-icon">
                      {objective.icon}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide text-slate-100">
                        {objective.title}
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-400">
                        {objective.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2">
                <span>Loading sewer arena</span>
                <span>Cookie gate next</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="intro-progress-fill h-full rounded-full bg-gradient-to-r from-amber-400 via-cyan-300 to-emerald-300" />
              </div>
            </div>

            <button
              type="button"
              onClick={finishIntro}
              className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-cyan-300 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-950 shadow-xl shadow-cyan-500/10 transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Enter the Quest
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
