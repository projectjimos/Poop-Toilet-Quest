import { useEffect, useRef, useState, type ReactNode } from 'react';

const REAL_START_PATTERNS = [/Start\s+(PC|Mobile|CO-OP)\s+Play/i];
const LOBBY_PATTERNS = [/SELECT INPUT SYSTEM/i, /START ADVENTURE/i, /POOP TOILET QUEST/i];
const PLAYING_PATTERNS = [/Current mission/i, /Wave\s+\d+/i, /Controls:\s*Touch and drag/i];

function getBodyText(): string {
  return document.body?.innerText || '';
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

function findStartButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  return buttons.find((button) => {
    if (button.dataset.ptqRescueButton === 'true') return false;
    const label = button.innerText || button.textContent || '';
    return REAL_START_PATTERNS.some((pattern) => pattern.test(label));
  }) || null;
}

function protectStartButton(): boolean {
  const startButton = findStartButton();
  if (!startButton) return false;

  startButton.dataset.ptqStartButton = 'true';
  startButton.style.setProperty('position', 'relative');
  startButton.style.setProperty('z-index', '999');
  startButton.style.setProperty('pointer-events', 'auto', 'important');
  startButton.removeAttribute('disabled');
  startButton.setAttribute('aria-label', 'Start Poop Toilet Quest');
  return true;
}

function makePointerEvent(type: 'pointerdown' | 'pointerup'): Event {
  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch' });
  }
  return new MouseEvent(type === 'pointerdown' ? 'mousedown' : 'mouseup', { bubbles: true, cancelable: true });
}

function clickRealStartButton(): boolean {
  const startButton = findStartButton();
  if (!startButton) return false;

  protectStartButton();
  startButton.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  startButton.focus({ preventScroll: true });

  const events: Event[] = [
    makePointerEvent('pointerdown'),
    makePointerEvent('pointerup'),
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  ];

  events.forEach((event) => startButton.dispatchEvent(event));
  startButton.click();
  window.dispatchEvent(new CustomEvent('ptq:play-requested', { detail: { source: 'play-fix' } }));
  return true;
}

export default function PlayButtonFixGate({ children }: { children: ReactNode }) {
  const [showFallback, setShowFallback] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const lastAttemptRef = useRef(0);

  useEffect(() => {
    const sync = () => {
      const lobby = isLobbyVisible();
      const playing = isGamePlaying();
      const hasStart = protectStartButton();
      setShowFallback(lobby && hasStart && !playing);
    };

    sync();
    const interval = window.setInterval(sync, 700);
    window.addEventListener('resize', sync);
    window.addEventListener('focus', sync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const handleStart = () => {
    const now = Date.now();
    if (now - lastAttemptRef.current < 650) return;
    lastAttemptRef.current = now;

    setLastMessage('Starting quest...');
    const clicked = clickRealStartButton();
    if (!clicked) {
      setLastMessage('Start button not found yet. Close tutorial or registry, then try again.');
      return;
    }

    window.setTimeout(() => {
      if (isGamePlaying()) {
        setShowFallback(false);
        setLastMessage(null);
      } else {
        setLastMessage('If it did not start, tap the center Start button once more.');
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
