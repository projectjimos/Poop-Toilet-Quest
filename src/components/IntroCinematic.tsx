import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, FastForward, Sparkles, Timer, Zap } from 'lucide-react';

type IntroCinematicProps = {
  children: ReactNode;
};

type IntroReason = 'app-entry' | 'profile-ready';

const CINEMATIC_EVENT_NAME = 'ptq:play-intro-cinematic';
const REPLAY_SUPPRESSION_MS = 3200;

export default function IntroCinematic({ children }: IntroCinematicProps) {
  const [showIntro, setShowIntro] = useState(true);
  const [beat, setBeat] = useState<number>(0);
  const [cinematicReason, setCinematicReason] = useState<IntroReason>('app-entry');
  const showIntroRef = useRef(showIntro);
  const suppressReplayUntilRef = useRef(0);

  const objectives = useMemo(() => [
    {
      icon: <Zap className="w-4 h-4" />,
      title: 'React Fast',
      detail: 'Dodge waves and time your magic flush wave.'
    },
    {
      icon: <Sparkles className="w-4 h-4" />,
      title: 'Clear Waves',
      detail: 'Beat sewer monsters, bonus waves, and harder rounds.'
    },
    {
      icon: <Coins className="w-4 h-4" />,
      title: 'Collect & Sell',
      detail: 'Grab coins, sell weaker toilets, and fund crazier upgrades.'
    },
    {
      icon: <Timer className="w-4 h-4" />,
      title: 'Reveal Toilets',
      detail: 'Buy unknown toilets and uncover ridiculous new powers.'
    }
  ], []);

  const isProfileActivation = cinematicReason === 'profile-ready';

  useEffect(() => {
    showIntroRef.current = showIntro;
  }, [showIntro]);

  const finishIntro = useCallback((suppressReplay = false) => {
    if (suppressReplay) {
      suppressReplayUntilRef.current = Date.now() + REPLAY_SUPPRESSION_MS;
    }
    setShowIntro(false);
  }, []);

  const enterQuest = useCallback(() => {
    finishIntro(true);
  }, [finishIntro]);

  useEffect(() => {
    const handleCinematicRequest = (event: Event) => {
      if (showIntroRef.current) return;
      if (Date.now() < suppressReplayUntilRef.current) return;

      const customEvent = event as CustomEvent<{ reason?: IntroReason }>;
      const requestedReason = customEvent.detail?.reason === 'profile-ready' ? 'profile-ready' : 'app-entry';

      setCinematicReason(requestedReason);
      setBeat(0);
      setShowIntro(true);
    };

    window.addEventListener(CINEMATIC_EVENT_NAME, handleCinematicRequest);
    return () => window.removeEventListener(CINEMATIC_EVENT_NAME, handleCinematicRequest);
  }, []);

  useEffect(() => {
    if (!showIntro) return undefined;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const beatDelays = isProfileActivation ? [360, 920, 1500, 2180] : [650, 1600, 2650, 3850];
    const durationMs = isProfileActivation ? 4700 : 6900;

    if (prefersReducedMotion) {
      setBeat(objectives.length);
      timers.push(setTimeout(() => finishIntro(false), 1500));
    } else {
      beatDelays.forEach((delay, index) => {
        timers.push(setTimeout(() => setBeat(index + 1), delay));
      });
      timers.push(setTimeout(() => finishIntro(false), durationMs));
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [finishIntro, isProfileActivation, objectives.length, showIntro]);

  return (
    <>
      {children}
      {showIntro ? (
        <main
          className={`intro-cinematic ${isProfileActivation ? 'intro-cinematic-profile' : 'intro-cinematic-entry'} fixed inset-0 z-[9999] bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-8 overflow-y-auto select-none`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="intro-title"
          aria-describedby="intro-subtitle"
        >
          <div className="intro-bg-grid" aria-hidden="true" />
          <div className="intro-bg-glow intro-bg-glow-amber" aria-hidden="true" />
          <div className="intro-bg-glow intro-bg-glow-cyan" aria-hidden="true" />
          <div className="intro-bg-comets" aria-hidden="true" />

          <button type="button" onClick={enterQuest} className="intro-skip-button" aria-label="Skip intro and enter the game">
            <FastForward className="w-3.5 h-3.5" /> Skip
          </button>

          <section className="intro-shell relative z-10 w-full max-w-6xl rounded-[2rem] border border-amber-400/25 bg-slate-950/82 shadow-2xl shadow-amber-500/10 backdrop-blur-xl p-5 sm:p-8 md:p-10">
            <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-8 lg:gap-10 items-center">
              <div className="intro-scene-wrap order-2 lg:order-1" aria-hidden="true">
                <div className="intro-scene">
                  <div className="intro-floor" />
                  <div className="intro-villain intro-villain-plunger"><span className="intro-villain-emoji">🪠</span><span className="intro-villain-label">PLUNGER TITAN</span></div>
                  <div className="intro-villain intro-villain-germ"><span className="intro-villain-emoji">🦠</span><span className="intro-villain-label">GERM KING</span></div>
                  <div className="intro-villain intro-villain-paper"><span className="intro-villain-emoji">🧻</span><span className="intro-villain-label">PAPER BEAST</span></div>
                  <div className="intro-magic-beam intro-magic-beam-one" />
                  <div className="intro-magic-beam intro-magic-beam-two" />
                  <div className="intro-magic-beam intro-magic-beam-three" />
                  <div className="intro-wave-ring intro-wave-ring-one" />
                  <div className="intro-wave-ring intro-wave-ring-two" />
                  <div className="intro-wave-ring intro-wave-ring-three" />
                  <div className="intro-hero-mage">
                    <div className="intro-hero-aura" />
                    <div className="intro-hero-shadow" />
                    <div className="intro-hero-emoji">💩</div>
                    <div className="intro-hero-wand">✨</div>
                    <div className="intro-hero-badge">HERO LVL ?</div>
                  </div>
                  <div className="intro-coin intro-coin-one">🪙</div>
                  <div className="intro-coin intro-coin-two">🪙</div>
                  <div className="intro-coin intro-coin-three">🪙</div>
                  <div className="intro-coin intro-coin-four">🪙</div>
                  <div className="intro-mystery-card"><span className="text-2xl">?</span><span>UNKNOWN TOILET</span></div>
                </div>
              </div>

              <div className="order-1 lg:order-2 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200 mb-4">
                  {isProfileActivation ? 'Quest activated' : 'Movie intro'}
                </div>
                <h1 id="intro-title" className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[0.92] uppercase">
                  <span className="block bg-gradient-to-r from-amber-200 via-orange-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">Poop Toilet</span>
                  <span className="block text-slate-50">Quest</span>
                </h1>
                <p id="intro-subtitle" className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  {isProfileActivation
                    ? 'Your run is live: react fast, clear waves, grab coins, sell weak toilets, and reveal unknown upgrades.'
                    : 'A magic poop hero enters the sewer arena, clears monster waves, collects coins, and reveals unknown toilets to level up fast.'}
                </p>
                <div className="mt-6 grid sm:grid-cols-2 gap-3">
                  {objectives.map((objective, index) => {
                    const isActive = beat >= index + 1;
                    return (
                      <div key={objective.title} className={`intro-objective-card ${isActive ? 'intro-objective-card-active' : ''}`}>
                        <div className="intro-objective-icon">{objective.icon}</div>
                        <div>
                          <div className="text-xs font-black uppercase tracking-wide text-slate-100">{objective.title}</div>
                          <p className="mt-1 text-[11px] leading-snug text-slate-400">{objective.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2">
                    <span>{isProfileActivation ? 'Loading your run' : 'Movie loading'}</span>
                    <span>{isProfileActivation ? 'Arena ready' : 'Rookies get briefed'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="intro-progress-fill h-full rounded-full bg-gradient-to-r from-amber-400 via-cyan-300 to-emerald-300" /></div>
                </div>
                <button type="button" onClick={enterQuest} className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-cyan-300 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-950 shadow-xl shadow-cyan-500/10 transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950">
                  Enter the Quest
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : null}
    </>
  );
}
