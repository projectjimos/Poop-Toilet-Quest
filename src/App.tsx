import { useCallback, useEffect, useMemo, useState } from 'react';
import { HelpCircle, Pencil, RotateCcw, Trophy, User } from 'lucide-react';
import GameArea from './components/GameArea';
import { TOILET_CATALOG } from './data';
import type { Toilet } from './types';
import { getCookie } from './utils/cookies';

const CURRENT_USER_KEY = 'poop_quest_current_user';
const GOAL_DISMISSED_KEY = 'poop_quest_goal_helper_dismissed';
const GUEST_PROFILE_NAME = 'Guest Player';
const STARTING_TOILET_ID = 'porta_potty';
const DEFAULT_SKIN_ID = 'default';

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

function resetLocalSkinProfile(profile: string) {
  const key = profileKey(profile);
  localStorage.setItem(`poop_quest_kill_credits_${key}`, '0');
  localStorage.setItem(`poop_quest_unlocked_skins_${key}`, JSON.stringify([DEFAULT_SKIN_ID]));
  localStorage.setItem(`poop_quest_active_skin_${key}`, DEFAULT_SKIN_ID);
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => readStoredPlayer());
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [gameInstanceKey, setGameInstanceKey] = useState(0);

  const [coins, setCoins] = useState(0);
  const [unlockedToilets, setUnlockedToilets] = useState<string[]>([STARTING_TOILET_ID]);
  const [activeToiletId, setActiveToiletId] = useState(STARTING_TOILET_ID);
  const [poopLevel, setPoopLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('poop_quest_muted') === 'true');

  const activeToilet = useMemo(() => {
    return TOILET_CATALOG.find((toilet) => toilet.id === activeToiletId) || TOILET_CATALOG.find((toilet) => toilet.id === STARTING_TOILET_ID) || TOILET_CATALOG[0];
  }, [activeToiletId]);

  const savePayload = useMemo<SavePayload>(() => ({
    coins,
    unlockedToilets,
    activeToiletId,
    poopLevel,
    highScore,
  }), [coins, unlockedToilets, activeToiletId, poopLevel, highScore]);

  useEffect(() => {
    const refreshUser = () => setCurrentUser(readStoredPlayer());
    refreshUser();
    window.addEventListener('storage', refreshUser);
    window.addEventListener('focus', refreshUser);
    return () => {
      window.removeEventListener('storage', refreshUser);
      window.removeEventListener('focus', refreshUser);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const save = localSaveFor(currentUser);
    setCoins(save.coins);
    setUnlockedToilets(save.unlockedToilets);
    setActiveToiletId(save.activeToiletId);
    setPoopLevel(save.poopLevel);
    setHighScore(save.highScore);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    saveLocalProfile(currentUser, savePayload);
  }, [currentUser, savePayload]);

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
    const confirmed = window.confirm(`Reset all progress, skins, kill credits, and goals for ${currentUser}?`);
    if (!confirmed) return;

    const emptySave = {
      coins: 0,
      unlockedToilets: [STARTING_TOILET_ID],
      activeToiletId: STARTING_TOILET_ID,
      poopLevel: 1,
      highScore: 0,
    };

    setCoins(emptySave.coins);
    setUnlockedToilets(emptySave.unlockedToilets);
    setActiveToiletId(emptySave.activeToiletId);
    setPoopLevel(emptySave.poopLevel);
    setHighScore(emptySave.highScore);
    saveLocalProfile(currentUser, emptySave);
    resetLocalSkinProfile(currentUser);
    localStorage.removeItem(GOAL_DISMISSED_KEY);
    window.dispatchEvent(new CustomEvent('ptq:progress-reset'));
    setGameInstanceKey((key) => key + 1);
  };

  const openUsernameSettings = () => {
    window.dispatchEvent(new CustomEvent('ptq:open-username-settings'));
  };

  const statusLabel = currentUser ? 'Local profile' : 'Create username';

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
                Solo local arcade build
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
              onClick={openUsernameSettings}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-black uppercase text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200"
            >
              <Pencil className="mr-1 inline h-3.5 w-3.5" /> Name
            </button>
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-black uppercase text-slate-300 transition hover:border-amber-300 hover:text-amber-200"
            >
              <HelpCircle className="mr-1 inline h-3.5 w-3.5" /> Guide
            </button>
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
            <div className="mt-2 text-sm font-black uppercase text-rose-200"><RotateCcw className="mr-1 inline h-4 w-4" /> Progress + Skins + Goals</div>
          </button>
        </section>

        <GameArea
          key={gameInstanceKey}
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
              <p>Enemies drop coins and kills. Use coins to buy stronger toilets, and use kills to unlock custom skins.</p>
              <p>The top-right minimap shows enemies, danger, coins, fruit, and when enemies are inside flush range.</p>
              <p>Your save is local to this device. Reset Progress also resets skins, kill credits, and goals.</p>
              <p>You can change your username from the Name button, then it has a 24-hour cooldown.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
