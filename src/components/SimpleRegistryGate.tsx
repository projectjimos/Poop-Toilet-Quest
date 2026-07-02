import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Pencil, Play, Sparkles, UserRound } from 'lucide-react';
import { getCookie, setCookie } from '../utils/cookies';

const COOKIE_CONSENT_KEY = 'poop_quest_cookie_consent';
const CURRENT_USER_KEY = 'poop_quest_current_user';
const PROFILES_LIST_KEY = 'poop_quest_profiles_list';
const USERNAME_LAST_CHANGED_KEY = 'poop_quest_username_last_changed_at';
const USERNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PROFILE_NAME = 'PoopPlayer';

const hasCookieConsent = () => getCookie(COOKIE_CONSENT_KEY) === 'true';

const getStoredPlayer = () => {
  return getCookie(CURRENT_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY);
};

const cleanUsername = (value: string) => {
  return value.trim().replace(/\s+/g, ' ').slice(0, 18);
};

const validateUsername = (value: string) => {
  const cleaned = cleanUsername(value);
  if (cleaned.length < 3) return 'Username needs at least 3 characters.';
  if (!/^[a-zA-Z0-9 _-]+$/.test(cleaned)) return 'Use letters, numbers, spaces, dashes, or underscores only.';
  return null;
};

const readProfilesList = () => {
  try {
    const saved = localStorage.getItem(PROFILES_LIST_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : [];
  } catch {
    return [];
  }
};

const saveProfileName = (username: string) => {
  const profiles = readProfilesList();
  const nextProfiles = profiles.includes(username) ? profiles : [...profiles, username];
  localStorage.setItem(PROFILES_LIST_KEY, JSON.stringify(nextProfiles));
  localStorage.setItem(CURRENT_USER_KEY, username);
  setCookie(CURRENT_USER_KEY, username, 30);
  setCookie('poop_quest_guest_mode', 'true', 30);
};

const copyProfileStorage = (oldName: string | null, newName: string) => {
  if (!oldName || oldName === newName) return;

  const knownPrefixes = [
    'poop_quest_coins_',
    'poop_quest_unlocked_',
    'poop_quest_active_id_',
    'poop_quest_level_',
    'poop_quest_highscore_',
    'poop_quest_kill_credits_',
    'poop_quest_unlocked_skins_',
    'poop_quest_active_skin_',
  ];

  for (const prefix of knownPrefixes) {
    const oldKey = `${prefix}${oldName}`;
    const newKey = `${prefix}${newName}`;
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldValue);
    }
  }
};

const formatCooldown = (remainingMs: number) => {
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

export default function SimpleRegistryGate({ children }: { children: ReactNode }) {
  const [sessionKey, setSessionKey] = useState(0);
  const [isUsernameGateOpen, setIsUsernameGateOpen] = useState(() => hasCookieConsent() && !getStoredPlayer());
  const [isEditingExistingName, setIsEditingExistingName] = useState(false);
  const [usernameInput, setUsernameInput] = useState(() => getStoredPlayer() || DEFAULT_PROFILE_NAME);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refreshGateState = () => {
      setIsUsernameGateOpen(hasCookieConsent() && !getStoredPlayer());
    };

    const openUsernameSettings = () => {
      setUsernameInput(getStoredPlayer() || DEFAULT_PROFILE_NAME);
      setIsEditingExistingName(true);
      setIsUsernameGateOpen(true);
      setStatusMessage(null);
    };

    refreshGateState();
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
      refreshGateState();
    }, 30_000);

    window.addEventListener('storage', refreshGateState);
    window.addEventListener('focus', refreshGateState);
    window.addEventListener('ptq:open-username-settings', openUsernameSettings);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshGateState);
      window.removeEventListener('focus', refreshGateState);
      window.removeEventListener('ptq:open-username-settings', openUsernameSettings);
    };
  }, []);

  const storedPlayer = getStoredPlayer();
  const lastChangedAt = Number.parseInt(localStorage.getItem(USERNAME_LAST_CHANGED_KEY) || '0', 10) || 0;
  const cooldownRemaining = Math.max(0, USERNAME_COOLDOWN_MS - (now - lastChangedAt));
  const isCooldownBlocked = isEditingExistingName && Boolean(storedPlayer) && cooldownRemaining > 0;

  const helperText = useMemo(() => {
    if (!storedPlayer) return 'Create your local username. No email. No Google. No password.';
    if (isCooldownBlocked) return `You can change your username again in ${formatCooldown(cooldownRemaining)}.`;
    return 'You can change your username, then it locks again for 24 hours.';
  }, [cooldownRemaining, isCooldownBlocked, storedPlayer]);

  const submitUsername = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleaned = cleanUsername(usernameInput);
    const validationError = validateUsername(cleaned);
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    if (isCooldownBlocked) {
      setStatusMessage(`Username change is cooling down. Try again in ${formatCooldown(cooldownRemaining)}.`);
      return;
    }

    const previousName = getStoredPlayer();
    copyProfileStorage(previousName, cleaned);
    saveProfileName(cleaned);
    localStorage.setItem(USERNAME_LAST_CHANGED_KEY, Date.now().toString());

    setStatusMessage(previousName ? 'Username updated. You can change it again after 24 hours.' : 'Local account created. Loading your quest...');
    setIsUsernameGateOpen(false);
    setIsEditingExistingName(false);
    setSessionKey((key) => key + 1);

    import('../utils/audio').then((module) => module.playUnlockSound()).catch(() => undefined);
  };

  const closeEditor = () => {
    if (!storedPlayer) return;
    setIsUsernameGateOpen(false);
    setIsEditingExistingName(false);
    setStatusMessage(null);
  };

  const game = (
    <div key={sessionKey} className="contents">
      {children}
    </div>
  );

  if (!isUsernameGateOpen) {
    return game;
  }

  return (
    <>
      {game}
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/95 px-4 py-8 font-mono text-slate-100 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <section className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-amber-500/25 bg-slate-900/90 p-6 shadow-2xl shadow-amber-950/40 sm:p-8">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" />

          <div className="relative mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-400/30 bg-amber-400/10 text-4xl shadow-lg shadow-amber-500/10">
              💩
            </div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Local account only
            </div>
            <h1 className="bg-gradient-to-r from-amber-300 via-yellow-100 to-cyan-300 bg-clip-text text-3xl font-black uppercase leading-none tracking-tight text-transparent sm:text-4xl">
              {storedPlayer ? 'Change Username' : 'Create Your Username'}
            </h1>
            <p className="mt-4 text-sm font-bold leading-relaxed text-slate-300 sm:text-base">
              {helperText}
            </p>
          </div>

          <form onSubmit={submitUsername} className="relative grid gap-4">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-200">
                <UserRound className="h-4 w-4" /> Username
              </span>
              <input
                type="text"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                maxLength={18}
                disabled={isCooldownBlocked}
                autoFocus
                placeholder="PoopChampion"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-base font-black text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs font-bold leading-relaxed text-slate-400">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <p>Your username is saved locally on this device. After you create or change it, the next change has a 24-hour cooldown.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={isCooldownBlocked}
                className="rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-xl shadow-amber-500/15 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {storedPlayer ? <Pencil className="mr-2 inline h-4 w-4" /> : <Play className="mr-2 inline h-4 w-4" />}
                {storedPlayer ? 'Save Name' : 'Start Quest'}
              </button>

              {storedPlayer && (
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Keep Current
                </button>
              )}
            </div>
          </form>

          {statusMessage && (
            <div className="relative mt-5 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-xs font-bold text-slate-300">
              <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-300" /> {statusMessage}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
