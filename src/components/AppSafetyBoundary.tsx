import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { setCookie } from '../utils/cookies';

type BoundaryProps = {
  children: ReactNode;
};

type BoundaryState = {
  error: Error | null;
};

const CURRENT_USER_KEY = 'poop_quest_current_user';
const COOKIE_CONSENT_KEY = 'poop_quest_cookie_consent';
const GUEST_PROFILE_NAME = 'Guest Player';

function startGuestRecovery() {
  try {
    const savedProfiles = localStorage.getItem('poop_quest_profiles_list');
    const profiles = savedProfiles ? JSON.parse(savedProfiles) : [];
    const safeProfiles = Array.isArray(profiles) ? profiles.filter((item): item is string => typeof item === 'string') : [];
    const nextProfiles = safeProfiles.includes(GUEST_PROFILE_NAME) ? safeProfiles : [...safeProfiles, GUEST_PROFILE_NAME];

    localStorage.setItem('poop_quest_profiles_list', JSON.stringify(nextProfiles));
    localStorage.setItem(CURRENT_USER_KEY, GUEST_PROFILE_NAME);
    localStorage.setItem('poop_quest_guest_mode', 'true');
    localStorage.setItem('poop_quest_intro_recovered', Date.now().toString());
    setCookie(COOKIE_CONSENT_KEY, 'true', 30);
    setCookie(CURRENT_USER_KEY, GUEST_PROFILE_NAME, 30);
    setCookie('poop_quest_guest_mode', 'true', 30);
  } catch {
    // If storage is blocked, a reload still gives the app another clean boot attempt.
  }

  window.location.reload();
}

function clearEntryState() {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem('poop_quest_guest_mode');
    localStorage.setItem('poop_quest_intro_recovered', Date.now().toString());
    setCookie(COOKIE_CONSENT_KEY, 'true', 30);
  } catch {
    // Ignore blocked storage.
  }

  window.location.reload();
}

function RecoveryPanel({ error, reason }: { error?: Error | null; reason: string }) {
  return (
    <main className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950 px-4 py-6 text-slate-100">
      <section className="w-full max-w-lg rounded-[2rem] border border-amber-400/30 bg-slate-900 p-6 text-center shadow-2xl shadow-amber-950/40">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-400/30 bg-amber-400/10 text-4xl">
          💩
        </div>
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Screen recovery</div>
        <h1 className="text-2xl font-black uppercase text-white">Poop Toilet Quest is unsticking itself</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          The game hit a blank-screen state while entering. Choose a quick recovery path and the app will reload into a playable screen.
        </p>
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left text-xs font-bold text-slate-400">
          <div className="text-slate-500">Reason</div>
          <div className="mt-1 text-slate-200">{reason}</div>
          {error?.message ? <div className="mt-2 break-words text-amber-200">{error.message}</div> : null}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={startGuestRecovery}
            className="rounded-2xl bg-gradient-to-r from-amber-400 to-cyan-300 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-cyan-950/20"
          >
            Continue as Guest
          </button>
          <button
            type="button"
            onClick={clearEntryState}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            Reset Entry Screen
          </button>
        </div>
      </section>
    </main>
  );
}

function BlankScreenWatch() {
  const [isBlank, setIsBlank] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const visibleText = document.body.innerText.trim();
      const hasRecovery = document.querySelector('[data-ptq-recovery]');
      const hasExpectedUi = /Poop Toilet Quest|Enter the Quest|Choose Your Quest|Cookie Integrity|Start PC Play|Start Mobile Play|Just play as guest/i.test(visibleText);

      if (!hasRecovery && !hasExpectedUi) {
        setIsBlank(true);
      }
    }, 4500);

    return () => window.clearTimeout(timer);
  }, []);

  if (!isBlank) return null;

  return (
    <div data-ptq-recovery>
      <RecoveryPanel reason="No visible entry screen appeared after boot." />
    </div>
  );
}

export default class AppSafetyBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Poop Toilet Quest entry crash', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return <RecoveryPanel error={this.state.error} reason="A startup component crashed before the game could render." />;
    }

    return (
      <>
        {this.props.children}
        <BlankScreenWatch />
      </>
    );
  }
}
