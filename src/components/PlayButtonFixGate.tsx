import { useEffect, useRef, useState, type ReactNode } from 'react';

const REAL_START_PATTERNS = [/Start\s+PC\s+Play/i, /Start\s+Mobile\s+Play/i];
const LOBBY_PATTERNS = [/SELECT INPUT SYSTEM/i, /START ADVENTURE/i, /POOP TOILET QUEST/i];
const PLAYING_PATTERNS = [/Current mission/i, /Wave\s+\d+/i, /Controls:\s*Touch and drag/i, /Controls:\s*WASD/i];
const PLAY_REQUESTED_EVENT = 'ptq:play-requested';

type ReactHostElement = HTMLButtonElement & Record<string, unknown>;

type ReactClickProps = {
  onClick?: (event?: unknown) => void;
  onPointerUp?: (event?: unknown) => void;
  onTouchEnd?: (event?: unknown) => void;
};

function getBodyText(): string {
  return document.body?.innerText || '';
}

function matchesStartLabel(label: string): boolean {
  return REAL_START_PATTERNS.some((pattern) => pattern.test(label));
}

function getButtonLabel(button: HTMLButtonElement): string {
  return (button.innerText || button.textContent || '').replace(/\s+/g, ' ').trim();
}

function findStartButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  return buttons.find((button) => {
    if (button.dataset.ptqRescueButton === 'true') return false;
    return matchesStartLabel(getButtonLabel(button));
  }) || null;
}

function findStartButtonFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest('button');
  if (!(button instanceof HTMLButtonElement)) return null;
  if (button.dataset.ptqRescueButton === 'true') return null;
  return matchesStartLabel(getButtonLabel(button)) ? button : null;
}

function hasRealStartButton(): boolean {
  return Boolean(findStartButton());
}

function isLobbyVisible(): boolean {
  const text = getBodyText();
  const hasLobby = LOBBY_PATTERNS.some((pattern) => pattern.test(text));
  const isTutorialOpen = /New Player Tutorial|Skip Tutorial|Next Rule/i.test(text);
  const isRegistryOpen = /Choose Your Quest Save|Three ways to play/i.test(text);
  const isIntroOpen = /Movie intro|Enter the Quest/i.test(text);
  const isGameOver = /GAME OVER|Try Again|Return to Lobby/i.test(text);
  return hasLobby && hasRealStartButton() && !isTutorialOpen && !isRegistryOpen && !isIntroOpen && !isGameOver;
}

function isGamePlaying(): boolean {
  const text = getBodyText();
  return PLAYING_PATTERNS.some((pattern) => pattern.test(text)) && !isLobbyVisible();
}

function getReactClickProps(button: HTMLButtonElement): ReactClickProps | null {
  const host = button as ReactHostElement;
  const reactPropKey = Object.keys(host).find((key) => key.startsWith('__reactProps$'));
  if (!reactPropKey) return null;
  const props = host[reactPropKey];
  return props && typeof props === 'object' ? (props as ReactClickProps) : null;
}

function createButtonEvent(button: HTMLButtonElement, source: string): unknown {
  const nativeEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
  return {
    type: 'click',
    source,
    nativeEvent,
    target: button,
    currentTarget: button,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    persist: () => undefined,
  };
}

function protectStartButton(button = findStartButton()): boolean {
  if (!button) return false;

  button.dataset.ptqStartButton = 'true';
  button.style.setProperty('position', 'relative');
  button.style.setProperty('z-index', '10001');
  button.style.setProperty('pointer-events', 'auto', 'important');
  button.style.setProperty('touch-action', 'manipulation');
  button.style.setProperty('user-select', 'none');
  button.removeAttribute('disabled');
  button.setAttribute('aria-label', 'Start Poop Toilet Quest');
  return true;
}

function makePointerEvent(type: 'pointerdown' | 'pointerup'): Event {
  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch' });
  }
  return new MouseEvent(type === 'pointerdown' ? 'mousedown' : 'mouseup', { bubbles: true, cancelable: true });
}

function announcePlayRequest(source: string): void {
  window.dispatchEvent(new CustomEvent(PLAY_REQUESTED_EVENT, { detail: { source } }));
}

function invokeReactStartHandler(button: HTMLButtonElement, source: string): boolean {
  protectStartButton(button);
  const props = getReactClickProps(button);
  let invoked = false;

  try {
    if (typeof props?.onClick === 'function') {
      props.onClick(createButtonEvent(button, source));
      invoked = true;
    }
  } catch (error) {
    console.warn('[PTQ] Direct start handler failed; falling back to DOM click.', error);
  }

  announcePlayRequest(source);
  return invoked;
}

function clickRealStartButton(source = 'play-fix'): boolean {
  const startButton = findStartButton();
  if (!startButton) return false;

  protectStartButton(startButton);
  startButton.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  startButton.focus({ preventScroll: true });

  const invokedReact = invokeReactStartHandler(startButton, source);

  const events: Event[] = [
    makePointerEvent('pointerdown'),
    makePointerEvent('pointerup'),
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  ];

  events.forEach((event) => startButton.dispatchEvent(event));
  if (!invokedReact) startButton.click();
  announcePlayRequest(source);
  return true;
}

export default function PlayButtonFixGate({ children }: { children: ReactNode }) {
  const [showFallback, setShowFallback] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const lastAttemptRef = useRef(0);
  const lastDirectInvokeRef = useRef(0);

  useEffect(() => {
    const sync = () => {
      const lobby = isLobbyVisible();
      const playing = isGamePlaying();
      const hasStart = protectStartButton();
      setShowFallback(lobby && hasStart && !playing);
    };

    sync();
    const interval = window.setInterval(sync, 600);
    window.addEventListener('resize', sync);
    window.addEventListener('focus', sync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  useEffect(() => {
    const maybeRescueRealButtonTap = (event: Event) => {
      const button = findStartButtonFromTarget(event.target);
      if (!button) return;
      protectStartButton(button);

      window.setTimeout(() => {
        if (isGamePlaying()) return;
        if (!isLobbyVisible()) return;

        const now = Date.now();
        if (now - lastDirectInvokeRef.current < 700) return;
        lastDirectInvokeRef.current = now;
        invokeReactStartHandler(button, 'real-button-rescue');
      }, 80);
    };

    document.addEventListener('click', maybeRescueRealButtonTap, true);
    document.addEventListener('touchend', maybeRescueRealButtonTap, true);
    document.addEventListener('pointerup', maybeRescueRealButtonTap, true);

    return () => {
      document.removeEventListener('click', maybeRescueRealButtonTap, true);
      document.removeEventListener('touchend', maybeRescueRealButtonTap, true);
      document.removeEventListener('pointerup', maybeRescueRealButtonTap, true);
    };
  }, []);

  const handleStart = () => {
    const now = Date.now();
    if (now - lastAttemptRef.current < 650) return;
    lastAttemptRef.current = now;

    setLastMessage('Starting quest...');
    const clicked = clickRealStartButton('force-start');
    if (!clicked) {
      setLastMessage('Start button not found yet. Close tutorial or registry, then try again.');
      return;
    }

    window.setTimeout(() => {
      if (isGamePlaying()) {
        setShowFallback(false);
        setLastMessage(null);
      } else {
        setLastMessage('Tap Start once more. The direct start bridge is active.');
      }
    }, 900);
  };

  return (
    <>
      {children}
      {showFallback && (
        <div className="fixed inset-x-0 bottom-20 z-[10000] flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm rounded-3xl border border-amber-300/50 bg-slate-950/95 p-3 text-center font-mono text-slate-100 shadow-2xl shadow-amber-950/40 backdrop-blur-md">
            <button
              type="button"
              data-ptq-rescue-button="true"
              onClick={handleStart}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-4 text-base font-black uppercase tracking-wide text-slate-950 shadow-xl shadow-amber-950/30 transition active:scale-95"
            >
              ▶ Force Start
            </button>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Backup button for mobile/blocked taps
            </p>
            {lastMessage && <p className="mt-1 text-[10px] text-amber-200">{lastMessage}</p>}
          </div>
        </div>
      )}
    </>
  );
}
