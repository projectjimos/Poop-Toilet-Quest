import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { TOILET_CATALOG } from '../data';
import type { Toilet } from '../types';
import { getCookie } from '../utils/cookies';

const CURRENT_USER_KEY = 'poop_quest_current_user';
const GOAL_DISMISSED_KEY = 'poop_quest_goal_helper_dismissed';
const STARTING_TOILET_ID = 'porta_potty';
const DEFAULT_SKIN_ID = 'default';

const SKIN_GOALS = [
  { id: 'default', name: 'Default', cost: 0 },
  { id: 'apple', name: 'Apple', cost: 5 },
  { id: 'banana', name: 'Banana', cost: 10 },
  { id: 'strawberry', name: 'Strawberry', cost: 15 },
  { id: 'watermelon', name: 'Watermelon', cost: 20 },
  { id: 'pineapple', name: 'Pineapple', cost: 30 },
  { id: 'cherry', name: 'Cherry', cost: 40 },
  { id: 'grapes', name: 'Grapes', cost: 50 },
];

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
  unlockedToilets: string[];
  activeToiletId: string;
  killCredits: number;
  unlockedSkins: string[];
  activeSkinId: string;
};

function getActiveProfile(): string | null {
  return getCookie(CURRENT_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY);
}

function profileKey(profile: string): string {
  return profile.trim() || 'Guest Player';
}

function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function readString(key: string, fallback: string): string {
  const raw = localStorage.getItem(key);
  return raw && raw.trim() ? raw : fallback;
}

function readStringArray(key: string, fallback: string[]): string[] {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function readGoalState(): GoalState {
  const profile = getActiveProfile();
  if (!profile) {
    return {
      profile: null,
      coins: 0,
      unlockedToilets: [STARTING_TOILET_ID],
      activeToiletId: STARTING_TOILET_ID,
      killCredits: 0,
      unlockedSkins: [DEFAULT_SKIN_ID],
      activeSkinId: DEFAULT_SKIN_ID,
    };
  }

  const key = profileKey(profile);

  return {
    profile,
    coins: readNumber(`poop_quest_coins_${key}`, 0),
    unlockedToilets: readStringArray(`poop_quest_unlocked_${key}`, [STARTING_TOILET_ID]),
    activeToiletId: readString(`poop_quest_active_id_${key}`, STARTING_TOILET_ID),
    killCredits: readNumber(`poop_quest_kill_credits_${key}`, 0),
    unlockedSkins: readStringArray(`poop_quest_unlocked_skins_${key}`, [DEFAULT_SKIN_ID]),
    activeSkinId: readString(`poop_quest_active_skin_${key}`, DEFAULT_SKIN_ID),
  };
}

function findToiletById(id: string): Toilet | undefined {
  return TOILET_CATALOG.find((toilet) => toilet.id === id);
}

function sortToiletsByLevel(toilets: Toilet[]) {
  return [...toilets].sort((a, b) => (a.level || 0) - (b.level || 0));
}

function strongestOwnedToilet(unlockedToilets: string[]): Toilet {
  const owned = unlockedToilets.map(findToiletById).filter((toilet): toilet is Toilet => Boolean(toilet));
  return sortToiletsByLevel(owned).at(-1) || TOILET_CATALOG[0];
}

function nextLockedToilet(unlockedToilets: string[]): Toilet | undefined {
  return sortToiletsByLevel(TOILET_CATALOG).find((toilet) => !unlockedToilets.includes(toilet.id));
}

function nextLockedSkin(unlockedSkins: string[]) {
  return SKIN_GOALS.find((skin) => !unlockedSkins.includes(skin.id));
}

function getNextGoal(state: GoalState): string {
  const { profile, coins, unlockedToilets, activeToiletId, killCredits, unlockedSkins, activeSkinId } = state;

  if (!profile) return 'Create a local username to start playing.';

  const activeToilet = findToiletById(activeToiletId) || TOILET_CATALOG[0];
  const strongestToilet = strongestOwnedToilet(unlockedToilets);
  const nextToilet = nextLockedToilet(unlockedToilets);
  const nextSkin = nextLockedSkin(unlockedSkins);
  const hasBetterToiletEquipped = strongestToilet.id === activeToilet.id;

  if (!hasBetterToiletEquipped) {
    return `Open Shop → Toilets and equip ${strongestToilet.emoji} ${strongestToilet.name}. It is stronger than your current toilet.`;
  }

  if (nextToilet && coins >= nextToilet.cost) {
    return `Open Shop → Toilets and buy ${nextToilet.emoji} ${nextToilet.name} for ${nextToilet.cost} coins.`;
  }

  if (nextSkin && killCredits >= nextSkin.cost) {
    return `Open Shop → Skins and unlock the ${nextSkin.name} skin for ${nextSkin.cost} kills.`;
  }

  const unlockedNonDefaultSkin = unlockedSkins.find((skinId) => skinId !== DEFAULT_SKIN_ID);
  if (unlockedNonDefaultSkin && activeSkinId === DEFAULT_SKIN_ID) {
    const skinName = SKIN_GOALS.find((skin) => skin.id === unlockedNonDefaultSkin)?.name || 'new';
    return `Open Shop → Skins and equip your ${skinName} skin.`;
  }

  if (nextToilet) {
    return `Collect ${Math.max(0, nextToilet.cost - coins)} more coins for ${nextToilet.emoji} ${nextToilet.name}.`;
  }

  if (nextSkin) {
    return `Defeat ${Math.max(0, nextSkin.cost - killCredits)} more enemies or boss-credit kills to unlock the ${nextSkin.name} skin.`;
  }

  return `You own every visible upgrade. Keep surviving, beat boss waves, and chase a higher score with ${activeToilet.emoji} ${activeToilet.name}.`;
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
    if (typeof CloseEvent !== 'undefined' && closeEvent instanceof CloseEvent) {
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
  const [isGoalDismissed, setIsGoalDismissed] = useState(() => localStorage.getItem(GOAL_DISMISSED_KEY) === 'true');

  useEffect(() => {
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

    const interval = window.setInterval(syncGoalState, 2000);
    window.addEventListener('storage', syncGoalState);
    window.addEventListener('focus', syncGoalState);
    window.addEventListener('ptq:play-requested', syncGoalState as EventListener);
    window.addEventListener('ptq:coins-updated', syncGoalState as EventListener);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', syncGoalState);
      window.removeEventListener('focus', syncGoalState);
      window.removeEventListener('ptq:play-requested', syncGoalState as EventListener);
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
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Coins {goalState.coins} · Kills {goalState.killCredits}
              </p>
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
        </aside>
      )}
    </>
  );
}
