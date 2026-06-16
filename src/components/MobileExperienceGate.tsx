import { useEffect, useMemo, type ReactNode } from 'react';

interface MobileExperienceGateProps {
  children: ReactNode;
}

type DeviceMode = 'mobile' | 'pc';

const CONTROL_MODE_KEY = 'poop_quest_control_mode';
const DEVICE_EVENT = 'ptq:device-mode-changed';

function detectDeviceMode(): DeviceMode {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'pc';
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const noHover = window.matchMedia?.('(hover: none)').matches ?? false;
  const narrowScreen = window.innerWidth <= 820;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return coarsePointer || noHover || narrowScreen || mobileUserAgent ? 'mobile' : 'pc';
}

function applyDeviceMode(mode: DeviceMode) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  localStorage.setItem(CONTROL_MODE_KEY, mode);
  document.documentElement.dataset.ptqDevice = mode;
  document.documentElement.classList.toggle('ptq-mobile', mode === 'mobile');
  document.documentElement.classList.toggle('ptq-pc', mode === 'pc');

  window.dispatchEvent(new CustomEvent(DEVICE_EVENT, { detail: { mode } }));
}

export default function MobileExperienceGate({ children }: MobileExperienceGateProps) {
  const initialMode = useMemo(() => detectDeviceMode(), []);

  // Apply synchronously during the first render so GameArea reads the correct
  // localStorage control mode when it initializes its own state.
  applyDeviceMode(initialMode);

  useEffect(() => {
    const syncMode = () => {
      const nextMode = detectDeviceMode();
      applyDeviceMode(nextMode);
    };

    syncMode();
    window.addEventListener('resize', syncMode);
    window.addEventListener('orientationchange', syncMode);

    const pointerQuery = window.matchMedia?.('(pointer: coarse)');
    const hoverQuery = window.matchMedia?.('(hover: none)');
    pointerQuery?.addEventListener?.('change', syncMode);
    hoverQuery?.addEventListener?.('change', syncMode);

    return () => {
      window.removeEventListener('resize', syncMode);
      window.removeEventListener('orientationchange', syncMode);
      pointerQuery?.removeEventListener?.('change', syncMode);
      hoverQuery?.removeEventListener?.('change', syncMode);
    };
  }, []);

  return <>{children}</>;
}
