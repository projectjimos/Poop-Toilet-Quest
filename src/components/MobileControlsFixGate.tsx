import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

interface MobileControlsFixGateProps {
  children: ReactNode;
}

type DirectionKey = 'w' | 'a' | 's' | 'd';

const MOVEMENT_KEYS: DirectionKey[] = ['w', 'a', 's', 'd'];
const KEY_META: Record<DirectionKey, { key: string; code: string }> = {
  w: { key: 'w', code: 'KeyW' },
  a: { key: 'a', code: 'KeyA' },
  s: { key: 's', code: 'KeyS' },
  d: { key: 'd', code: 'KeyD' }
};

const isMobileLike = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches ||
    window.innerWidth <= 820 ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)
  );
};

const dispatchKeyboard = (type: 'keydown' | 'keyup', keyName: DirectionKey | ' ') => {
  const meta = keyName === ' '
    ? { key: ' ', code: 'Space' }
    : KEY_META[keyName];

  window.dispatchEvent(new KeyboardEvent(type, {
    key: meta.key,
    code: meta.code,
    bubbles: true,
    cancelable: true
  }));
};

const releaseKeys = (pressed: Set<DirectionKey>) => {
  pressed.forEach((keyName) => dispatchKeyboard('keyup', keyName));
  pressed.clear();
};

export default function MobileControlsFixGate({ children }: MobileControlsFixGateProps) {
  const [isMobile, setIsMobile] = useState(() => isMobileLike());
  const [isPlaying, setIsPlaying] = useState(false);
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pressedKeysRef = useRef<Set<DirectionKey>>(new Set());
  const pointerIdRef = useRef<number | null>(null);

  const shouldShow = isMobile && isPlaying;

  const observerConfig = useMemo(() => ({ childList: true, subtree: true, characterData: true }), []);

  useEffect(() => {
    const syncDevice = () => setIsMobile(isMobileLike());
    syncDevice();
    window.addEventListener('resize', syncDevice);
    window.addEventListener('orientationchange', syncDevice);
    return () => {
      window.removeEventListener('resize', syncDevice);
      window.removeEventListener('orientationchange', syncDevice);
    };
  }, []);

  useEffect(() => {
    const detectPlaying = () => {
      const bodyText = document.body.innerText || '';
      const hasActiveHud = bodyText.includes('Controls: Touch and drag') || bodyText.includes('Current mission') || bodyText.includes('Wave:');
      const isLobby = bodyText.includes('SELECT INPUT SYSTEM') || bodyText.includes('START ADVENTURE');
      setIsPlaying(hasActiveHud && !isLobby);
    };

    detectPlaying();
    const observer = new MutationObserver(detectPlaying);
    observer.observe(document.body, observerConfig);
    const interval = window.setInterval(detectPlaying, 1200);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [observerConfig]);

  useEffect(() => {
    if (!shouldShow) {
      releaseKeys(pressedKeysRef.current);
      setActive(false);
      setKnob({ x: 0, y: 0 });
    }
  }, [shouldShow]);

  const updateDirection = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;

    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxReach = rect.width * 0.36;
    const distance = Math.hypot(dx, dy);
    const safeDistance = Math.max(distance, 1);
    const limitedX = Math.max(-maxReach, Math.min(maxReach, dx));
    const limitedY = Math.max(-maxReach, Math.min(maxReach, dy));

    setKnob({ x: limitedX, y: limitedY });

    const nextKeys = new Set<DirectionKey>();
    if (distance > 10) {
      const normalizedX = dx / safeDistance;
      const normalizedY = dy / safeDistance;
      if (normalizedY < -0.35) nextKeys.add('w');
      if (normalizedY > 0.35) nextKeys.add('s');
      if (normalizedX < -0.35) nextKeys.add('a');
      if (normalizedX > 0.35) nextKeys.add('d');
    }

    MOVEMENT_KEYS.forEach((keyName) => {
      const wasPressed = pressedKeysRef.current.has(keyName);
      const shouldPress = nextKeys.has(keyName);
      if (shouldPress && !wasPressed) {
        dispatchKeyboard('keydown', keyName);
        pressedKeysRef.current.add(keyName);
      }
      if (!shouldPress && wasPressed) {
        dispatchKeyboard('keyup', keyName);
        pressedKeysRef.current.delete(keyName);
      }
    });
  };

  const stopMovement = () => {
    releaseKeys(pressedKeysRef.current);
    pointerIdRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(true);
    updateDirection(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active || pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updateDirection(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    stopMovement();
  };

  const flush = (event: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const trigger = (window as any).triggerToiletFlush;
    if (typeof trigger === 'function') {
      trigger();
    } else {
      dispatchKeyboard('keydown', ' ');
      window.setTimeout(() => dispatchKeyboard('keyup', ' '), 40);
    }
  };

  return (
    <>
      {children}
      {shouldShow && (
        <div className="mobile-controls-fix" aria-label="Mobile movement and flush controls">
          <div
            ref={baseRef}
            className={`mobile-controls-fix__stick ${active ? 'mobile-controls-fix__stick--active' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              className="mobile-controls-fix__knob"
              style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
            >
              💩
            </div>
            <div className="mobile-controls-fix__hint">DRAG</div>
          </div>

          <button
            type="button"
            className="mobile-controls-fix__flush"
            onPointerDown={flush}
            onClick={flush}
          >
            <span>🚽</span>
            <strong>FLUSH</strong>
          </button>
        </div>
      )}
    </>
  );
}
