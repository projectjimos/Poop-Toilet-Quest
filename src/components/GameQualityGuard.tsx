import { useEffect, type ReactNode } from 'react';
import { getCookie } from '../utils/cookies';

const CURRENT_USER_KEY = 'poop_quest_current_user';

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

function getActiveProfile(): string | null {
  return getCookie(CURRENT_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY);
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
  useEffect(() => {
    localStorage.removeItem('poop_quest_friends');
    localStorage.removeItem('poop_quest_goal_helper_dismissed');
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

  return <>{children}</>;
}
