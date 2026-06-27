import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCookie } from '../utils/cookies';

const CURRENT_USER_KEY = 'poop_quest_current_user';
const LEGACY_PASSWORD_KEY = 'poop_quest_user_passwords';
const GOAL_DISMISSED_KEY = 'poop_quest_goal_helper_dismissed';

const MULTIPLAYER_UI_TEXTS = [
  '🌐 CO-OP Arena',
  'CO-OP Arena',
  'Quick Join: Public Showdown',
  'Custom Room Code/Name',
  'Friends List',
  'Add friends to quick-join their rooms!',
  'CO-OP ACTIVE',
  'Start CO-OP Play',
  '👥 CO-OP ON',
  'Keyboard Bindings for Sharing:',
  'RIP CO-OP MATE',
];

const KINETIC_SUIT_UI_TEXTS = [
  'Kinetic Suits',
  'Kinetic Suit',
  'Suit Shop',
  'Armor Shop',
  'Energy Shield',
  'Kinetic',
  'Cow Suit',
  "Cowguy's Galactic Cow Suit",
  'Galactic Cow Suit',
];

type GoalState = {
  profile: string | null;
  coins: number;
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
  return {
    profile,
    coins: profile ? readNumber(`poop_quest_coins_${profile}`, 0) : 0,
  };
}

function getNextGoal({ profile, coins }: GoalState): string {
  if (!profile) return 'Choose Google, email, or guest to start playing.';
  if (coins < 15) return `Collect ${15 - coins} more coins to buy your first toilet upgrade.`;
  if (coins < 50) return 'Open the toilet shop and buy your next stronger toilet.';
  return 'Keep moving, flush enemies, collect coins, and survive longer.';
}

function createSafeCloseEvent(): CloseEvent | Event {
  if (typeof CloseEvent !== 'undefined') {
    return new CloseEvent('close', {
      code: 1000,
      reason: 'Solo-only mode',
      wasClean: true,
    });
  }

  const event = new Event('close') as Event & { code?: number; reason?: string; wasClean?: boolean };
  event.code = 1000;
  event.reason = 'Solo-only mode';
  event.wasClean = true;
  return event;
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
    const closeEvent = createSafeCloseEvent();
    if (closeEvent instanceof CloseEvent) {
      target.onclose?.call(target, closeEvent);
    }
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
        status: 410,
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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function deleteUiByText(needles: string[]): void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>('button, a, input, textarea, [role="button"]'));

  for (const element of targets) {
    const text = normalizeText(element.textContent || '');
    const placeholder = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.placeholder : '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    const title = element.getAttribute('title') || '';
    const searchText = `${text} ${placeholder} ${ariaLabel} ${title}`;
    const matches = needles.some((needle) => searchText.includes(needle));

    if (matches) {
      element.remove();
    }
  }
}

function cleanRetiredUi(): void {
  deleteUiByText(MULTIPLAYER_UI_TEXTS);
  deleteUiByText(KINETIC_SUIT_UI_TEXTS);
}

function removeStoredSuitProgress(): void {
  const profile = getActiveProfile();
  const keys = [
    'poop_quest_unlocked_armors',
    'poop_quest_active_armor_id',
    'poop_quest_suit_level',
  ];

  for (const key of keys) {
    localStorage.removeItem(key);
  }

  if (profile) {
    localStorage.setItem(`poop_quest_unlocked_armors_${profile}`, JSON.stringify(['basic_poncho']));
    localStorage.setItem(`poop_quest_active_armor_id_${profile}`, 'basic_poncho');
    localStorage.setItem(`poop_quest_suit_level_${profile}`, '1');
  }
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
    removeStoredSuitProgress();
  }, []);

  useEffect(() => installBackendNoiseGuard(), []);

  useEffect(() => {
    cleanRetiredUi();
    const interval = window.setInterval(cleanRetiredUi, 7000);
    window.addEventListener('ptq:play-requested', cleanRetiredUi);
    window.addEventListener('ptq:coins-updated', cleanRetiredUi as EventListener);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('ptq:play-requested', cleanRetiredUi);
      window.removeEventListener('ptq:coins-updated', cleanRetiredUi as EventListener);
    };
  }, []);

  useEffect(() => {
    const syncGoalState = () => setGoalState(readGoalState());
    syncGoalState();

    const interval = window.setInterval(syncGoalState, 5000);
    window.addEventListener('storage', syncGoalState);
    window.addEventListener('ptq:coins-updated', syncGoalState as EventListener);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', syncGoalState);
      window.removeEventListener('ptq:coins-updated', syncGoalState as EventListener);
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
