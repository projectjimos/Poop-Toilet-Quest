import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { CheckCircle2, Loader2, Lock, Mail, Play, Sparkles } from 'lucide-react';
import { getCookie, setCookie } from '../utils/cookies';
import { auth } from '../utils/firebase';

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

const getFriendlyAuthError = (code: string, fallback = 'Email sign-in failed. Please try again.') => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email already has an account. Switch to Sign in and try again.';
    case 'auth/invalid-email':
      return 'Please enter a real email address.';
    case 'auth/weak-password':
      return 'Use a stronger password with at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email or password did not match. Try again or create a new account.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Take a short break, then try again.';
    default:
      return fallback;
  }
};

export default function SimpleRegistryGate({ children }: { children: ReactNode }) {
  const [showRegistry, setShowRegistry] = useState(() => hasCookieConsent() && !getStoredPlayer() && !auth.currentUser);
  const [sessionKey, setSessionKey] = useState(0);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailMode, setEmailMode] = useState<'create' | 'signin'>('create');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [firebasePlayerEmail, setFirebasePlayerEmail] = useState<string | null>(() => auth.currentUser?.email ?? null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebasePlayerEmail(user?.email ?? null);
      if (user) {
        setIsGoogleLoading(false);
        setIsEmailLoading(false);
        setStatusMessage(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const refreshRegistryState = () => {
      setShowRegistry(hasCookieConsent() && !getStoredPlayer() && !firebasePlayerEmail);
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
  }, [firebasePlayerEmail]);

  const completeCloudEntry = (message: string) => {
    setStatusMessage(message);
    setShowRegistry(false);
    setSessionKey((key) => key + 1);
    import('../utils/audio').then((module) => module.playUnlockSound()).catch(() => undefined);
  };

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

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);

      completeCloudEntry('Google save connected. Loading your quest...');
    } catch (error: any) {
      const code = error?.code || '';
      const isPopupClosed = code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
      setStatusMessage(
        isPopupClosed
          ? 'Google sign-in was closed. Choose Google again, email, or guest.'
          : error?.message || 'Google sign-in could not start.'
      );
      setIsGoogleLoading(false);
      if (!isPopupClosed) {
        import('../utils/audio').then((module) => module.playDamageSound()).catch(() => undefined);
      }
    }
  };

  const handleEmailPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanEmail = emailAddress.trim();
    if (!cleanEmail || !password) {
      setStatusMessage('Enter an email and password first.');
      return;
    }

    if (password.length < 6) {
      setStatusMessage('Password must be at least 6 characters.');
      return;
    }

    try {
      setIsEmailLoading(true);
      setStatusMessage(emailMode === 'create' ? 'Creating your cloud save...' : 'Signing in to your cloud save...');

      if (emailMode === 'create') {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }

      setPassword('');
      completeCloudEntry(emailMode === 'create' ? 'Account created. Loading your quest...' : 'Signed in. Loading your quest...');
    } catch (error: any) {
      setIsEmailLoading(false);
      setStatusMessage(getFriendlyAuthError(error?.code || '', error?.message));
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

        <section className="relative w-full max-w-2xl rounded-[2rem] border border-amber-500/25 bg-slate-900/90 shadow-2xl shadow-amber-950/40 p-6 sm:p-8 overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 bg-amber-400/10 rounded-full blur-2xl" />

          <div className="relative text-center mb-7">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-400/30 bg-amber-400/10 text-4xl shadow-lg shadow-amber-500/10">
              💩
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200 mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Three ways to play
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight bg-gradient-to-r from-amber-300 via-yellow-100 to-cyan-300 bg-clip-text text-transparent leading-none">
              Choose Your Quest Save
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
              Use Google, create an email account, or jump in instantly as a guest. Then dodge, flush, collect coins, sell weak toilets, and reveal unknown toilets.
            </p>
          </div>

          <div className="relative grid gap-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isEmailLoading}
              className="group w-full rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-4 text-left text-slate-950 shadow-xl shadow-amber-500/15 transition-all hover:-translate-y-0.5 hover:shadow-amber-500/25 disabled:cursor-wait disabled:opacity-70"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                    {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    Sign up / sign in with Google
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-800/80">
                    Best for fast cloud save, coins, toilets, high scores, and progress across devices.
                  </p>
                </div>
                <span className="rounded-full bg-slate-950/15 px-3 py-1 text-xs font-black uppercase">Cloud</span>
              </div>
            </button>

            <form
              onSubmit={handleEmailPasswordSubmit}
              className="rounded-2xl border border-violet-400/25 bg-slate-950/75 p-4 shadow-xl shadow-violet-500/5"
            >
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-violet-200">
                    <Mail className="h-5 w-5" /> Email account
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Type an email and password. Firebase handles the password securely.
                  </p>
                </div>
                <div className="flex rounded-full border border-slate-700 bg-slate-900 p-1 text-[10px] font-black uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => setEmailMode('create')}
                    className={`rounded-full px-3 py-1 transition ${emailMode === 'create' ? 'bg-violet-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'}`}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMode('signin')}
                    className={`rounded-full px-3 py-1 transition ${emailMode === 'signin' ? 'bg-violet-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'}`}
                  >
                    Sign in
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr_auto]">
                <label className="relative block">
                  <span className="sr-only">Email address</span>
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={emailAddress}
                    onChange={(event) => setEmailAddress(event.target.value)}
                    placeholder="email@example.com"
                    disabled={isEmailLoading || isGoogleLoading}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-3 text-sm font-bold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-300 disabled:opacity-70"
                  />
                </label>
                <label className="relative block">
                  <span className="sr-only">Password</span>
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    autoComplete={emailMode === 'create' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    disabled={isEmailLoading || isGoogleLoading}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-3 text-sm font-bold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-300 disabled:opacity-70"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isEmailLoading || isGoogleLoading}
                  className="rounded-xl border border-violet-300/30 bg-violet-400 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-950 transition hover:bg-violet-300 disabled:cursor-wait disabled:opacity-70"
                >
                  {isEmailLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : emailMode === 'create' ? 'Create' : 'Sign in'}
                </button>
              </div>
            </form>

            <button
              type="button"
              onClick={handleGuestPlay}
              disabled={isGoogleLoading || isEmailLoading}
              className="group w-full rounded-2xl border border-cyan-400/25 bg-slate-950/80 px-5 py-4 text-left shadow-xl shadow-cyan-500/5 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900 disabled:cursor-wait disabled:opacity-70"
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
              <span aria-hidden="true">⚡</span> React fast
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
