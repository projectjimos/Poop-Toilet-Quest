import { ReactNode, useEffect } from 'react';

interface CoOpRemovalGateProps {
  children: ReactNode;
}

const COOP_BLOCKED_TERMS = [
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

const hideElement = (element: HTMLElement) => {
  element.setAttribute('aria-hidden', 'true');
  element.style.setProperty('display', 'none', 'important');
  element.style.setProperty('visibility', 'hidden', 'important');
  element.style.setProperty('pointer-events', 'none', 'important');
};

const isButtonLike = (element: Element): element is HTMLElement => {
  const tag = element.tagName.toLowerCase();
  return tag === 'button' || tag === 'input' || tag === 'a' || Boolean((element as HTMLElement).onclick);
};

export default function CoOpRemovalGate({ children }: CoOpRemovalGateProps) {
  useEffect(() => {
    let frame = 0;

    const removeCoOpUi = () => {
      frame = 0;

      const allElements = Array.from(document.querySelectorAll<HTMLElement>('button, input, a, div, span'));

      allElements.forEach((element) => {
        const text = (element.textContent || element.getAttribute('placeholder') || '').trim();
        if (!text) return;

        const isCoOpElement = COOP_BLOCKED_TERMS.some((term) => text.includes(term));
        if (!isCoOpElement) return;

        if (text.includes('CO-OP Arena')) {
          hideElement(element);
          return;
        }

        if (text.includes('CO-OP ON') || text.includes('SOLO PLAY')) {
          const container = element.closest('div');
          hideElement((container as HTMLElement) || element);
          return;
        }

        if (text.includes('Keyboard Bindings for Sharing')) {
          const panel = element.closest('div.mt-3') || element.closest('div');
          hideElement((panel as HTMLElement) || element);
          return;
        }

        if (text.includes('Quick Join') || text.includes('Public Showdown') || text.includes('Custom Room') || text.includes('Friends List')) {
          const panel = element.closest('.animate-fade-in') || element.closest('div');
          hideElement((panel as HTMLElement) || element);
        }
      });

      const startButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter((button) => {
        const text = button.textContent || '';
        return text.includes('Start CO-OP Play');
      });

      startButtons.forEach((button) => {
        button.textContent = button.textContent?.replace('Start CO-OP Play', 'Start PC Play') || 'Start PC Play';
      });

      const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
      const selectedCoOpTab = tabButtons.find((button) => {
        const text = button.textContent || '';
        return text.includes('CO-OP Arena') && button.className.includes('bg-amber');
      });

      if (selectedCoOpTab) {
        const intelTab = tabButtons.find((button) => (button.textContent || '').includes('Sewer Enemy'));
        intelTab?.click();
      }
    };

    const scheduleRemove = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(removeCoOpUi);
    };

    const clickBlocker = (event: MouseEvent | PointerEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const clickable = target.closest('button, a, input') as HTMLElement | null;
      if (!clickable) return;
      const text = (clickable.textContent || clickable.getAttribute('placeholder') || '').trim();
      const isBlocked = COOP_BLOCKED_TERMS.some((term) => text.includes(term));
      if (!isBlocked) return;

      event.preventDefault();
      event.stopPropagation();
      hideElement(clickable);
      scheduleRemove();
    };

    scheduleRemove();
    const slowInterval = window.setInterval(scheduleRemove, 2000);
    const observer = new MutationObserver(scheduleRemove);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', clickBlocker, true);
    document.addEventListener('pointerdown', clickBlocker, true);
    document.addEventListener('touchstart', clickBlocker, true);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearInterval(slowInterval);
      observer.disconnect();
      document.removeEventListener('click', clickBlocker, true);
      document.removeEventListener('pointerdown', clickBlocker, true);
      document.removeEventListener('touchstart', clickBlocker, true);
    };
  }, []);

  return <>{children}</>;
}
