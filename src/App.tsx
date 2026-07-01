import { useCallback, useEffect, useMemo, useState } from 'react';
import { HelpCircle, LogOut, RotateCcw, Trophy, User } from 'lucide-react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import GameArea from './components/GameArea';
import { TOILET_CATALOG } from './data';
import type { Toilet } from './types';
import { auth, db } from './utils/firebase';
import { eraseCookie, getCookie, setCookie } from './utils/cookies';

const CURRENT_USER_KEY = 'poop_quest_current_user';
const GUEST_PROFILE_NAME = 'Guest Player';
const STARTING_TOILET_ID = 'porta_potty';

type CloudStatus = 'idle' | 'loading' | 'synced' | 'saving' | 'offline';

type SavePayload = {
  coins: number;
  unlockedToilets: string[];
  activeToiletId: string;
  poopLevel: number;
  highScore: number;
};

function readStoredPlayer(): string | null {
  return getCookie(CURRENT_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY);
}

function safeParseArray(value: string | null, fallback: string[]) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function readNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function profileKey(profile: string) {
  return profile.trim() || GUEST_PROFILE_NAME;
}

function localSaveFor(profile: string): SavePayload {
  const key = profileKey(profile);
  return {
    coins: readNumber(localStorage.getItem(`poop_quest_coins_${key}`), 0),
    unlockedToilets: safeParseArray(localStorage.getItem(`poop_quest_unlocked_${key}`), [STARTING_TOILET_ID]),
    activeToiletId: localStorage.getItem(`poop_quest_active_id_${key}`) || STARTING_TOILET_ID,
    poopLevel: readNumber(localStorage.getItem(`poop_quest_level_${key}`), 1),
    highScore: readNumber(localStorage.getItem(`poop_quest_highscore_${key}`), 0),
  };
}

function saveLocalProfile(profile: string, payload: SavePayload) {
  const key = profileKey(profile);
  localStorage.setItem(`poop_quest_coins_${key}`, payload.coins.toString());
  localStorage.setItem(`poop_quest_unlocked_${key}`, JSON.stringify(payload.unlockedToilets));
  localStorage.setItem(`poop_quest_active_id_${key}`, payload.activeToiletId);
  localStorage.setItem(`poop_quest_level_${key}`, payload.poopLevel.toString());
  localStorage.setItem(`poop_quest_highscore_${key}`, payload.highScore.toString());
}

function getInitialPlayer() {
  return readStoredPlayer();
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => getInitialPlayer());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('idle');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const [coins, setCoins] = useState(0);
  const [unlockedToilets, setUnlockedToilets] = useState<string[]>([STARTING_TOILET_ID]);
  const [activeToiletId, setActiveToiletId] = useState(STARTING_TOILET_ID);
  const [poopLevel, setPoopLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('poop_quest_muted') === 'true');

  const activeToilet = useMemo(() => {
    return TOILET_CATALOG.find((toilet) => toilet.id === activeToiletId) || TOILET_CATALOG[0];
  }, [activeToiletId]);

  const savePayload = useMemo<SavePayload>(() => ({
    coins,
    unlockedToilets,
    activeToiletId,
    poopLevel,
    highScore,
  }), [coins, unlockedToilets, activeToiletId, poopLevel, highScore]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setCloudStatus('idle');
        const storedPlayer = readStoredPlayer();
        setCurrentUser(storedPlayer);
        return;
      }

      const profileName = user.email || `Cloud Player ${user.uid.slice(0, 6)}`;
      setCurrentUser(profileName);
      localStorage.setItem(CURRENT_USER_KEY, profileName);
      setCookie(CURRENT_USER_KEY, profileName, 30);
      setCookie('poop_quest_guest_mode', 'false', 30);
      setCloudStatus('loading');

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          setCoins(readNumber(String(data.coins ?? 0), 0));
          setUnlockedToilets(Array.isArray(data.unlockedToilets) ? data.unlockedToilets : [STARTING_TOILET_ID]);
          setActiveToiletId(typeof data.activeToiletId === 'string' ? data.activeToiletId : STARTING_TOILET_ID);
          setPoopLevel(readNumber(String(data.poopLevel ?? 1), 1));
          setHighScore(readNumber(String(data.highScore ?? 0), 0));
        } else {
          const initialLocalSave = localSaveFor(profileName);
          setCoins(initialLocalSave.coins);
          setUnlockedToilets(initialLocalSave.unlockedToilets);
          setActiveToiletId(initialLocalSave.activeToiletId);
          setPoopLevel(initialLocalSave.poopLevel);
          setHighScore(initialLocalSave.highScore);
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email || '',
            ...initialLocalSave,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        setCloudStatus('synced');
      } catch (error) {
        console.error('Cloud profile load failed', error);
        setCloudStatus('offline');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser || firebaseUser) return;
    const save = localSaveFor(currentUser);
    setCoins(save.coins);
    setUnlockedToilets(save.unlockedToilets);
    setActiveToiletId(save.activeToiletId);
    setPoopLevel(save.poopLevel);
    setHighScore(save.highScore);
  }, [currentUser, firebaseUser]);

  useEffect(() => {
    if (!currentUser || firebaseUser) return;
    saveLocalProfile(currentUser, savePayload);
  }, [currentUser, firebaseUser, savePayload]);

  useEffect(() => {
    if (!firebaseUser || cloudStatus === 'loading') return;

    setCloudStatus('saving');
    const timer = window.setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          ...savePayload,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        setCloudStatus('synced');
      } catch (error) {
        console.error('Cloud profile save failed', error);
        setCloudStatus('offline');
      }
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [firebaseUser, cloudStatus, savePayload]);

  useEffect(() => {
    localStorage.setItem('poop_quest_muted', isMuted ? 'true' : 'false');
  }, [isMuted]);

  useEffect(() => {
    if (activeToiletId === STARTING_TOILET_ID) return;
    if (!unlockedToilets.includes(activeToiletId)) {
      setActiveToiletId(STARTING_TOILET_ID);
    }
  }, [activeToiletId, unlockedToilets]);

  const addCoins = useCallback((amount: number) => {
    setCoins((previous) => Math.max(0, previous + amount));
  }, []);

  const unlockToilet = useCallback((id: string, cost: number) => {
    setCoins((previousCoins) => {
      if (previousCoins < cost || unlockedToilets.includes(id)) return previousCoins;
      setUnlockedToilets((previousUnlocked) => previousUnlocked.includes(id) ? previousUnlocked : [...previousUnlocked, id]);
      setActiveToiletId(id);
      return previousCoins - cost;
    });
  }, [unlockedToilets]);

  const sellToilet = useCallback((id: string, cost: number) => {
    if (id === STARTING_TOILET_ID || activeToiletId === id) return;
    setUnlockedToilets((previous) => {
      if (!previous.includes(id)) return previous;
      setCoins((currentCoins) => currentCoins + Math.floor(cost * 0.9));
      return previous.filter((toiletId) => toiletId !== id);
    });
  }, [activeToiletId]);

  const setActiveToilet = useCallback((toilet: Toilet) => {
    setActiveToiletId(toilet.id);
  }, []);

  const handleHighScoreChange = useCallback((score: number) => {
    setHighScore((previous) => Math.max(previous, score));
  }, []);

  const resetProgress = () => {
    if (!currentUser) return;
    const confirmed = window.confirm(`Reset all progress for ${currentUser}?`);
    if (!confirmed) return;

    setCoins(0);
    setUnlockedToilets([STARTING_TOILET_ID]);
    setActiveToiletId(STARTING_TOILET_ID);
    setPoopLevel(1);
    setHighScore(0);

    if (!firebaseUser) {
      saveLocalProfile(currentUser, {
        coins: 0,
        unlockedToilets: [STARTING_TOILET_ID],
        activeToiletId: STARTING_TOILET_ID,
        poopLevel: 1,
        highScore: 0,
      });
    }
  };

  const handleSignOut = async () => {
    try {
      if (firebaseUser) {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Sign out failed', error);
    }

    setFirebaseUser(null);
    setCurrentUser(null);
    setCloudStatus('idle');
    localStorage.removeItem(CURRENT_USER_KEY);
    eraseCookie(CURRENT_USER_KEY);
    eraseCookie('poop_quest_guest_mode');
  };

  const statusLabel = firebaseUser
    ? cloudStatus === 'synced'
      ? 'Cloud synced'
      : cloudStatus === 'saving'
        ? 'Cloud saving...'
        : cloudStatus === 'loading'
          ? 'Cloud loading...'
          : 'Cloud offline'
    : currentUser
      ? 'Local save'
      : 'Choose save';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💩</span>
            <div>
              <div className="font-mono text-base font-black uppercase tracking-tight text-amber-300 sm:text-lg">
                Poop Toilet Quest
              </div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Solo arcade build
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="hidden rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-300 sm:block">
              {statusLabel}
            </div>
            {currentUser && (
              <div className="hidden max-w-[190px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 sm:flex">
                <User className="h-3.5 w-3.5 text-amber-300" />
                <span className="truncate font-bold">{currentUser}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-black uppercase text-slate-300 transition hover:border-amber-300 hover:text-amber-200"
            >
              <HelpCircle className="mr-1 inline h-3.5 w-3.5" /> Guide
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 font-black uppercase text-rose-200 transition hover:bg-rose-500/20"
              >
                <LogOut className="mr-1 inline h-3.5 w-3.5" /> Out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-3 font-mono sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Coins</div>
            <div className="mt-2 text-2xl font-black text-amber-300">🪙 {coins}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">High Score</div>
            <div className="mt-2 text-2xl font-black text-cyan-300"><Trophy className="mr-1 inline h-5 w-5" /> {highScore}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Toilets Owned</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">{unlockedToilets.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Level</div>
            <div className="mt-2 text-2xl font-black text-violet-300">{poopLevel}</div>
          </div>
          <button
            type="button"
            onClick={resetProgress}
            disabled={!currentUser}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Reset</div>
            <div className="mt-2 text-sm font-black uppercase text-rose-200"><RotateCcw className="mr-1 inline h-4 w-4" /> Progress</div>
          </button>
        </section>

        <GameArea
          coins={coins}
          addCoins={addCoins}
          unlockedToilets={unlockedToilets}
          setUnlockedToilets={setUnlockedToilets}
          unlockToilet={unlockToilet}
          sellToilet={sellToilet}
          activeToilet={activeToilet}
          setActiveToilet={setActiveToilet}
          setActiveToiletId={setActiveToiletId}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          highScore={highScore}
          onHighScoreChange={handleHighScoreChange}
          poopLevel={poopLevel}
          setPoopLevel={setPoopLevel}
          currentUser={currentUser}
        />
      </main>

      {isGuideOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4 font-mono backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-[2rem] border border-amber-400/25 bg-slate-900 p-6 shadow-2xl shadow-amber-950/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Quick Guide</div>
                <h2 className="mt-2 text-2xl font-black uppercase text-white">How to win</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-black uppercase text-slate-300 hover:border-amber-300 hover:text-amber-200"
              >
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-3 text-sm font-bold leading-relaxed text-slate-300">
              <p>Move with WASD or arrows on PC. On mobile, choose Mobile Play and use the joystick.</p>
              <p>Flush with Space or the mobile Flush button. The blue bar above your character shows when flush is ready.</p>
              <p>Enemies drop coins. Stronger enemies drop more. Use coins to buy stronger toilets with more damage, range, and faster cooldown.</p>
              <p>The top-right minimap shows enemies, danger, coins, fruit, and when enemies are inside flush range.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
