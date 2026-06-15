import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { getCookie } from '../utils/cookies';

interface FirstRunTutorialGateProps {
  children: React.ReactNode;
}

type TutorialStep = {
  eyebrow: string;
  title: string;
  emoji: string;
  body: string;
  bullets: string[];
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    eyebrow: 'The whole quest in 5 seconds',
    title: 'Run fast, flush enemies, get rich.',
    emoji: '💩',
    body: 'You are the Poop Hero. The sewer is full of pests. Your job is to survive, react quickly, grab coins, and become powerful enough to unlock ridiculous toilets.',
    bullets: [
      'Move around the arena and dodge the enemies chasing you.',
      'Flush when enemies are close enough to blast them for damage.',
      'Pick up coins from the map and from flushed enemies.'
    ]
  },
  {
    eyebrow: 'Controls',
    title: 'Train your fingers to react faster.',
    emoji: '⚡',
    body: 'The game is meant to feel quick. Move first, aim your timing, then flush at the perfect moment when enemies are inside your blast zone.',
    bullets: [
      'PC: move with WASD or arrow keys, then press SPACE to flush.',
      'Mobile: drag on the arena to move, then tap the red FLUSH button.',
      'Do not spam the flush: every toilet has a cooldown, so timing matters.'
    ]
  },
  {
    eyebrow: 'The money loop',
    title: 'Coins turn into unknown toilets.',
    emoji: '🪙',
    body: 'Coins are your progress. Spend them to unlock toilets with bigger range, stronger damage, faster cooldowns, and weirder powers.',
    bullets: [
      'Your next goal is usually: survive long enough to buy the next toilet.',
      'Better toilets make future runs easier and more explosive.',
      'Watch your wallet and check the toilet shop between runs.'
    ]
  },
  {
    eyebrow: 'Upgrade strategy',
    title: 'Equip the best. Sell the rest.',
    emoji: '🚽',
    body: 'Not every toilet needs to stay forever. Keep the toilet that helps your current run, then sell weaker toilets to chase the next upgrade faster.',
    bullets: [
      'Equip toilets with stronger blast radius or better cooldown for your play style.',
      'Sell old toilets when you need coins for a better mystery unlock.',
      'Level up by collecting toilets and pushing into harder sewer waves.'
    ]
  }
];

const getCurrentProfileName = (cloudUser: string | null): string | null => {
  return (
    cloudUser ||
    getCookie('poop_quest_current_user') ||
    localStorage.getItem('poop_quest_current_user') ||
    null
  );
};

const getTutorialStorageKey = (profileName: string) => {
  return `poop_quest_tutorial_seen_${encodeURIComponent(profileName.toLowerCase())}`;
};

const playProfileCinematic = () => {
  window.dispatchEvent(new CustomEvent('ptq:play-intro-cinematic', {
    detail: { reason: 'profile-ready' }
  }));
};

export default function FirstRunTutorialGate({ children }: FirstRunTutorialGateProps) {
  const [cloudUserName, setCloudUserName] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const lastProfileCinematicRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCloudUserName(user?.email || null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const evaluateTutorialState = () => {
      const cookiesAccepted = getCookie('poop_quest_cookie_consent') === 'true';
      const detectedProfile = getCurrentProfileName(cloudUserName);
      setProfileName(detectedProfile);

      if (!cookiesAccepted || !detectedProfile) {
        if (!detectedProfile) {
          lastProfileCinematicRef.current = null;
        }
        setIsVisible(false);
        return;
      }

      const normalizedProfileName = detectedProfile.toLowerCase();
      if (lastProfileCinematicRef.current !== normalizedProfileName) {
        lastProfileCinematicRef.current = normalizedProfileName;
        playProfileCinematic();
      }

      const tutorialSeen = localStorage.getItem(getTutorialStorageKey(detectedProfile)) === 'true';
      setIsVisible(!tutorialSeen);
    };

    evaluateTutorialState();
    const timer = window.setInterval(evaluateTutorialState, 500);
    return () => window.clearInterval(timer);
  }, [cloudUserName]);

  const currentStep = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;

  const safeProfileName = useMemo(() => {
    if (!profileName) return 'Poop Hero';
    if (profileName.includes('@')) return profileName.split('@')[0] || 'Poop Hero';
    return profileName;
  }, [profileName]);

  const completeTutorial = () => {
    if (profileName) {
      localStorage.setItem(getTutorialStorageKey(profileName), 'true');
    }
    setIsVisible(false);
    setStepIndex(0);
  };

  const goForward = () => {
    if (isLastStep) {
      completeTutorial();
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
  };

  const goBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <>
      {children}

      {isVisible && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/88 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="first-run-tutorial-title"
        >
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-amber-400/30 bg-slate-950 text-slate-100 shadow-2xl shadow-amber-950/40">
            <div className="absolute -left-24 -top-24 h-52 w-52 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

            <div className="relative grid gap-0 md:grid-cols-[1fr_1.25fr]">
              <div className="flex min-h-[260px] flex-col justify-between bg-gradient-to-br from-amber-500/15 via-slate-900 to-cyan-500/10 p-6 md:p-8">
                <button
                  type="button"
                  onClick={completeTutorial}
                  className="self-end rounded-full border border-slate-600 bg-slate-950/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:border-amber-400 hover:text-amber-300"
                >
                  Skip Tutorial
                </button>

                <div className="text-center md:text-left">
                  <div className="mb-4 text-7xl drop-shadow-[0_0_30px_rgba(251,191,36,0.35)]" aria-hidden="true">
                    {currentStep.emoji}
                  </div>
                  <div className="mb-2 inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                    New Player Tutorial
                  </div>
                  <h2 className="font-mono text-2xl font-black uppercase leading-tight text-white md:text-3xl">
                    Welcome, {safeProfileName}
                  </h2>
                  <p className="mt-3 text-xs leading-relaxed text-slate-300">
                    Learn the loop once. Then chase faster reactions, richer runs, and crazier toilets.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-4 gap-2" aria-label="Tutorial progress">
                  {TUTORIAL_STEPS.map((step, index) => (
                    <button
                      key={step.title}
                      type="button"
                      onClick={() => setStepIndex(index)}
                      className={`h-2 rounded-full transition-all ${index === stepIndex ? 'bg-amber-300' : index < stepIndex ? 'bg-emerald-400/80' : 'bg-slate-700'}`}
                      aria-label={`Go to tutorial step ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="relative p-6 md:p-8">
                <div className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
                  Step {stepIndex + 1} of {TUTORIAL_STEPS.length} • {currentStep.eyebrow}
                </div>

                <h3 id="first-run-tutorial-title" className="font-mono text-2xl font-black uppercase leading-tight text-white">
                  {currentStep.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {currentStep.body}
                </p>

                <div className="mt-6 space-y-3">
                  {currentStep.bullets.map((bullet, index) => (
                    <div key={bullet} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-slate-950">
                        {index + 1}
                      </div>
                      <p className="text-xs leading-relaxed text-slate-200">{bullet}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Remember</div>
                  <div className="mt-1 text-sm font-bold text-white">
                    Dodge → Flush → Grab Coins → Buy Unknown Toilets → Equip or Sell → Level Up
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={stepIndex === 0}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={completeTutorial}
                      className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-400 transition hover:text-slate-100"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={goForward}
                      className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-950/30 transition hover:scale-[1.02] active:scale-95"
                    >
                      {isLastStep ? 'Start Playing' : 'Next Rule'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
