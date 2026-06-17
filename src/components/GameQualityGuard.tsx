import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCookie } from '../utils/cookies';

const CURRENT_USER_KEY = 'poop_quest_current_user';
const LEGACY_PASSWORD_KEY = 'poop_quest_user_passwords';
const GOAL_DISMISSED_KEY = 'poop_quest_goal_helper_dismissed';
const STARTER_WATER = 500;
const STARTER_ELECTRICITY = 500;

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

function createClosedMultiplayerSocket(url: string): WebSocket {
  const target = new EventTarget() as WebSocket & {
    url: string;
    readyState: number;
    bufferedAmount: number;
    extensions: string;
    protocol: string;
    binaryType: BinaryType;
    onopen: ((this: WebSocket, ev: Event) => any) | null;
    onclose: ((this: WebSocket, ev: CloseEvent) => any) | null;
    onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null;
    onerror: ((this: WebSocket, ev: Event) => any) | null;
  };

  target.url = url;
  target.readyState = WebSocket.CLOSED;
  target.bufferedAmount = 0;
  target.extensions = '';
  target.protocol = '';
  target.binaryType = 'blob';
  target.onopen = null;
  target.onclose = null;
  target.onmessage = null;
  target.onerror = null;
  target.send = () => undefined;
  target.close = () => undefined;
  target.dispatchEvent = EventTarget.prototype.dispatchEvent.bind(target);
  target.addEventListener = EventTarget.prototype.addEventListener.bind(target) as WebSocket['addEventListener'];
  target.removeEventListener = EventTarget.prototype.removeEventListener.bind(target) as WebSocket['removeEventListener'];

  window.setTimeout(() => {
    const closeEvent = new CloseEvent('close', {
      code: 1000,
      reason: 'Solo-only mode',
      wasClean: true,
    });
    target.onclose?.call(target, closeEvent);
    target.dispatchEvent(closeEvent);
  }, 0);

  return target;
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

  const SoloSafeWebSocket = function WebSocketShim(this: WebSocket, url: string | URL, protocols?: string | string[]) {
    const target = String(url);
    if (target.includes('/multiplayer')) {
      return createClosedMultiplayerSocket(target);
    }
    return new OriginalWebSocket(url, protocols as any);
  } as unknown as typeof WebSocket;

  SoloSafeWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  SoloSafeWebSocket.OPEN = OriginalWebSocket.OPEN;
  SoloSafeWebSocket.CLOSING = OriginalWebSocket.CLOSING;
  SoloSafeWebSocket.CLOSED = OriginalWebSocket.CLOSED;
  SoloSafeWebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket = SoloSafeWebSocket;

  return () => {
    window.fetch = originalFetch;
    window.WebSocket = OriginalWebSocket;
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

    localStorage.removeItem('poop_quest_friends');
  }, []);

  useEffect(() => installBackendNoiseGuard(), []);

  useEffect(() => {
    const syncGoalState = () => setGoalState(readGoalState());
    syncGoalState();

    const interval = window.setInterval(syncGoalState, 2000);
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
        <aside className="pointer-events-none fixed left-4 top-20 z-[55] w-[min(90vw,360px)] rounded-2xl border border-amber-400/30 bg-slate-950/90 p-4 font-mono text-slate-100 shadow-2xl shadow-amber-950/30 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Next Goal</div>
              <p className="mt-1 text-sm font-black leading-snug text-white">{nextGoal}</p>
            </div>
            <button
              type="button"
              onClick={dismissGoal}
              className="pointer-events-auto rounded-full border border-slate-700 px-2 py-1 text-[10px] font-black uppercase text-slate-400 transition hover:border-amber-300 hover:text-amber-200"
              aria-label="Hide next goal helper"
            >
              Hide
            </button>
          </div>
          {wasLegacyCleaned && (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-100">
              Old local password data was removed. Use Google, email, or guest mode.
            </div>
          )}
        </aside>
      )}
    </>
  );
}
