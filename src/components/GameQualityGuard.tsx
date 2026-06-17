import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCookie } from '../utils/cookies';

const CURRENT_USER_KEY = 'poop_quest_current_user';
const LEGACY_PASSWORD_KEY = 'poop_quest_user_passwords';
const GOAL_DISMISSED_KEY = 'poop_quest_goal_helper_dismissed';
const STARTER_WATER = 500;
const STARTER_ELECTRICITY = 500;

const SOLO_ONLY_BLOCKED_TERMS = [
  'CO-OP Arena',
  'Quick Join',
  'Public Showdown',
  'Custom Room',
  'Friends List',
  'Keyboard Bindings for Sharing',
  'CO-OP ON',
  'SOLO PLAY',
  'Start CO-OP Play'
];

type GoalState = {
  profile: string | null;
  coins: number;
  water: number;
  electricity: number;
};

function getActiveProfile(): string | null {
  return getCookie(CURRENT_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY);
}

function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function readGoalState(): GoalState {
  const profile = getActiveProfile();
  if (!profile) {
    return {
      profile: null,
      coins: 0,
      water: STARTER_WATER,
      electricity: STARTER_ELECTRICITY,
    };
  }

  return {
    profile,
    coins: readNumber(`poop_quest_coins_${profile}`, 0),
    water: readNumber(`poop_quest_water_${profile}`, STARTER_WATER),
    electricity: readNumber(`poop_quest_electricity_${profile}`, STARTER_ELECTRICITY),
  };
}

function getNextGoal({ profile, coins, water, electricity }: GoalState): string {
  if (!profile) return 'Choose Google, email, or guest to start your quest.';
  if (water < 50) return 'Refill water before your next big flush.';
  if (electricity < 50) return 'Recharge electricity before your next big flush.';
  if (coins < 15) return `Collect ${15 - coins} more coins to buy your first mystery toilet.`;
  if (coins < 50) return 'Open the toilet shop and reveal your next upgrade.';
  return 'Survive longer, sell weak toilets, and push toward the next wave.';
}

function installBackendNoiseGuard(): () => void {
  const originalFetch = window.fetch.bind(window);
  const OriginalWebSocket = window.WebSocket;

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (target.includes('/api/multiplayer') || target.includes('/multiplayer')) {
      return Promise.resolve(new Response(JSON.stringify({ rooms: [], online: [], disabled: true, soloOnly: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;

  window.WebSocket = class SoloOnlyWebSocket extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const target = String(url);
      if (target.includes('/multiplayer')) {
        throw new Error('Solo-only mode: multiplayer sockets are disabled.');
      }
      super(url, protocols as any);
    }
  } as typeof WebSocket;

  return () => {
    window.fetch = originalFetch;
    window.WebSocket = OriginalWebSocket;
  };
}

function installSoloOnlyUiGuard(): () => void {
  let frame = 0;

  const hideElement = (element: HTMLElement) => {
    element.setAttribute('aria-hidden', 'true');
    element.style.setProperty('display', 'none', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
  };

  const removeSoloOnlySurfaces = () => {
    frame = 0;

    const allElements = Array.from(document.querySelectorAll<HTMLElement>('button, input, a, div, span'));
    allElements.forEach((element) => {
      const text = (element.textContent || element.getAttribute('placeholder') || '').trim();
      if (!text) return;

      const isBlocked = SOLO_ONLY_BLOCKED_TERMS.some((term) => text.includes(term));
      if (!isBlocked) return;

      const panel =
        element.closest('[data-solo-remove]') ||
        element.closest('.animate-fade-in') ||
        element.closest('div.mt-3') ||
        element.closest('div') ||
        element;

      hideElement((panel as HTMLElement) || element);
    });

    const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    const selectedOldTab = tabButtons.find((button) => {
      const text = button.textContent || '';
      return text.includes('CO-OP Arena') && button.className.includes('bg-amber');
    });

    if (selectedOldTab) {
      tabButtons.find((button) => (button.textContent || '').includes('Sewer Enemy'))?.click();
    }
  };

  const scheduleRemove = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(removeSoloOnlySurfaces);
  };

  localStorage.removeItem('poop_quest_friends');
  scheduleRemove();

  const observer = new MutationObserver(scheduleRemove);
  observer.observe(document.body, { childList: true, subtree: true });
  const interval = window.setInterval(scheduleRemove, 3000);

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    observer.disconnect();
    window.clearInterval(interval);
  };
}

export default function GameQualityGuard({ children }: { children: ReactNode }) {
  const [goalState, setGoalState] = useState<GoalState>(() => readGoalState());
  const [wasLegacyCleaned, setWasLegacyCleaned] = useState(false);
  const [isGoalDismissed, setIsGoalDismissed] = useState(() => localStorage.getItem(GOAL_DISMISSED_KEY) === 'true');

  useEffect(() => {
    if (localStorage.getItem(LEGACY_PASSWORD_KEY) !== null) {
      localStorage.removeItem(LEGACY_PASSWORD_KEY);
      localStorage.setItem('poop_quest_legacy_passwords_removed', 'true');
      setWasLegacyCleaned(true);
    }
  }, []);

  useEffect(() => installBackendNoiseGuard(), []);
  useEffect(() => installSoloOnlyUiGuard(), []);

  useEffect(() => {
    const syncGoalState = () => setGoalState(readGoalState());
    syncGoalState();

    const interval = window.setInterval(syncGoalState, 1000);
    window.addEventListener('storage', syncGoalState);
    window.addEventListener('ptq:coins-updated', syncGoalState as EventListener);
    window.addEventListener('ptq:utilities-updated', syncGoalState as EventListener);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', syncGoalState);
      window.removeEventListener('ptq:coins-updated', syncGoalState as EventListener);
      window.removeEventListener('ptq:utilities-updated', syncGoalState as EventListener);
    };
  }, []);

  const nextGoal = useMemo(() => getNextGoal(goalState), [goalState]);

  const dismissGoal = () => {
    localStorage.setItem(GOAL_DISMISSED_KEY, 'true');
    setIsGoalDismissed(true);
  };

  return (
    <>
      {children}

      {goalState.profile && !isGoalDismissed && (
        <aside className="fixed left-4 top-20 z-[75] w-[min(90vw,360px)] rounded-2xl border border-amber-400/30 bg-slate-950/95 p-4 font-mono text-slate-100 shadow-2xl shadow-amber-950/30 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Next Goal</div>
              <p className="mt-1 text-sm font-black leading-snug text-white">{nextGoal}</p>
            </div>
            <button
              type="button"
              onClick={dismissGoal}
              className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-black uppercase text-slate-400 transition hover:border-amber-300 hover:text-amber-200"
              aria-label="Hide next goal helper"
            >
              Hide
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-black uppercase tracking-wide">
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-2 text-amber-200">🪙 {goalState.coins}</div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">💧 {goalState.water}</div>
            <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-2 text-violet-200">⚡ {goalState.electricity}</div>
          </div>
          {wasLegacyCleaned && (
            <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2 text-[10px] font-bold text-emerald-200">
              Old local passwords were removed. Use Firebase email, Google, or guest mode only.
            </p>
          )}
        </aside>
      )}
    </>
  );
}
