import { ReactNode, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Play, Sparkles, User } from 'lucide-react';
import { getCookie, setCookie } from '../utils/cookies';

const COOKIE_CONSENT_KEY = 'poop_quest_cookie_consent';
const CURRENT_USER_KEY = 'poop_quest_current_user';
const GUEST_PROFILE_NAME = 'Guest Player';

const hasCookieConsent = () => getCookie(COOKIE_CONSENT_KEY) === 'true';

const getStoredPlayer = () => {
  return getCookie(CURRENT_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY);
};

const readProfilesList = () => {
  try {
    const saved = localStorage.getItem('poop_quest_profiles_list');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : [];
  } catch {
    return [];
  }
};

export default function SimpleRegistryGate({ children }: { children: ReactNode }) {
  const [showRegistry, setShowRegistry] = useState(() => hasCookieConsent() && !getStoredPlayer());
  const [sessionKey, setSessionKey] = useState(0);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const refreshRegistryState = () => {
      setShowRegistry(hasCookieConsent() && !getStoredPlayer());
    };

    refreshRegistryState();
    const intervalId = window.setInterval(refreshRegistryState, 500);
    window.addEventListener('storage', refreshRegistryState);
    window.addEventListener('focus', refreshRegistryState);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshRegistryState);
      window.removeEventListener('focus', refreshRegistryState);
    };
  }, []);

  const handleGuestPlay = () => {
    const profiles = readProfilesList();
    const nextProfiles = profiles.includes(GUEST_PROFILE_NAME) ? profiles : [...profiles, GUEST_PROFILE_NAME];

    localStorage.setItem('poop_quest_profiles_list', JSON.stringify(nextProfiles));
    localStorage.setItem(CURRENT_USER_KEY, GUEST_PROFILE_NAME);
    setCookie(CURRENT_USER_KEY, GUEST_PROFILE_NAME, 30);
    setCookie('poop_quest_guest_mode', 'true', 30);

    setStatusMessage('Guest quest ready. Loading your local save...');
    setShowRegistry(false);
    setSessionKey((key) => key + 1);

    import('../utils/audio').then((module) => module.playUnlockSound()).catch(() => undefined);
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setStatusMessage('Opening Google sign-in...');

      const response = await fetch(`/api/auth/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) {
        throw new Error('Google sign-in is not available from this deployment yet.');
      }

      const data = await response.json();
      if (!data?.url) {
        throw new Error('Google sign-in did not return a login URL.');
      }

      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        data.url,
        'Google_OAuth_Sign_In',
        `width=${width},height=${height},left=${left},top=${top},status=yes,resizable=yes`
      );

      if (!popup) {
        throw new Error('Popup blocked. Allow popups for this site, then try Google again.');
      }

      setStatusMessage('Finish Google sign-in in the popup. Your cloud save will load after that.');
    } catch (error: any) {
      setStatusMessage(error?.message || 'Google sign-in could not start.');
      setIsGoogleLoading(false);
      import('../utils/audio').then((module) => module.playDamageSound()).catch(() => undefined);
    }
  };

  const game = (
    <div key={sessionKey} className="contents">
      {children}
    </div>
  );

  if (!showRegistry) {
    return game;
  }

  return (
    <>
      {game}
      <div className="fixed inset-0 z-[70] bg-slate-950/95 backdrop-blur-xl text-slate-100 flex items-center justify-center px-4 py-8">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <section className="relative w-full max-w-xl rounded-[2rem] border border-amber-500/25 bg-slate-900/90 shadow-2xl shadow-amber-950/40 p-6 sm:p-8 overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 bg-amber-400/10 rounded-full blur-2xl" />

          <div className="relative text-center mb-7">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-400/30 bg-amber-400/10 text-4xl shadow-lg shadow-amber-500/10">
              💩
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200 mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Two ways to play
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight bg-gradient-to-r from-amber-300 via-yellow-100 to-cyan-300 bg-clip-text text-transparent leading-none">
              Choose Your Quest Save
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
              Save your progress with Google, or jump in instantly as a guest. Then dodge, flush, collect coins, sell weak toilets, and reveal unknown toilets.
            </p>
          </div>

          <div className="relative grid gap-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="group w-full rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-4 text-left text-slate-950 shadow-xl shadow-amber-500/15 transition-all hover:-translate-y-0.5 hover:shadow-amber-500/25 disabled:cursor-wait disabled:opacity-70"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                    {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    Sign up / sign in with Google
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-800/80">
                    Best for cloud save, coins, toilets, high scores, and progress across devices.
                  </p>
                </div>
                <span className="rounded-full bg-slate-950/15 px-3 py-1 text-xs font-black uppercase">Cloud</span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleGuestPlay}
              className="group w-full rounded-2xl border border-cyan-400/25 bg-slate-950/80 px-5 py-4 text-left shadow-xl shadow-cyan-500/5 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-cyan-200">
                    <Play className="h-5 w-5" /> Just play as guest
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Fastest way in. Your progress saves only on this device.
                  </p>
                </div>
                <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-black uppercase text-cyan-200">
                  Local
                </span>
              </div>
            </button>
          </div>

          <div className="relative mt-6 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-wide text-slate-400">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
              <ZapIcon /> React fast
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
              🪙 Collect coins
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
              ❓ Reveal toilets
            </div>
          </div>

          {statusMessage && (
            <div className="relative mt-5 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-xs font-bold text-slate-300">
              {statusMessage}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ZapIcon() {
  return <span aria-hidden="true">⚡</span>;
}
