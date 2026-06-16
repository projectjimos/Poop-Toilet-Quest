import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCookie } from '../utils/cookies';

interface UtilityPanelVisibilityGateProps {
  children: ReactNode;
}

const STORAGE_KEY = 'poop_quest_utilities_panel_hidden';
const PANEL_SIGNATURES = ['Toilet Utilities', 'Water + electricity power every flush'];
const PROFILE_COOKIE = 'poop_quest_current_user';

function getActiveProfile(): string | null {
  return getCookie(PROFILE_COOKIE) || localStorage.getItem(PROFILE_COOKIE);
}

function isUtilitiesPanel(node: HTMLElement): boolean {
  const text = node.textContent || '';
  return PANEL_SIGNATURES.every((signature) => text.includes(signature));
}

function findUtilitiesPanel(): HTMLElement | null {
  const fixedPanels = Array.from(document.querySelectorAll<HTMLElement>('div.fixed'));
  const directMatch = fixedPanels.find(isUtilitiesPanel);
  if (directMatch) return directMatch;

  const textMatch = Array.from(document.querySelectorAll<HTMLElement>('div')).find(isUtilitiesPanel);
  if (!textMatch) return null;

  let current: HTMLElement | null = textMatch;
  while (current) {
    if (current.classList.contains('fixed')) return current;
    current = current.parentElement;
  }

  return textMatch;
}

function applyPanelVisibility(hidden: boolean): boolean {
  const panel = findUtilitiesPanel();
  if (!panel) return false;

  if (hidden) {
    panel.style.setProperty('display', 'none', 'important');
    panel.style.setProperty('pointer-events', 'none', 'important');
    panel.setAttribute('aria-hidden', 'true');
  } else {
    panel.style.removeProperty('display');
    panel.style.removeProperty('pointer-events');
    panel.removeAttribute('aria-hidden');
  }

  return true;
}

export default function UtilityPanelVisibilityGate({ children }: UtilityPanelVisibilityGateProps) {
  const [hidden, setHidden] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [hasProfile, setHasProfile] = useState<boolean>(() => Boolean(getActiveProfile()));
  const [panelFound, setPanelFound] = useState(false);

  const buttonLabel = useMemo(() => {
    if (hidden) return 'Show Utilities';
    return panelFound ? 'Hide Utilities' : 'Find Utilities';
  }, [hidden, panelFound]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, hidden ? 'true' : 'false');
  }, [hidden]);

  useEffect(() => {
    const syncProfile = () => setHasProfile(Boolean(getActiveProfile()));
    syncProfile();
    const interval = window.setInterval(syncProfile, 750);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let animationFrame = 0;

    const apply = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        setPanelFound(applyPanelVisibility(hidden));
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(apply, 500);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearInterval(interval);
      observer.disconnect();
      applyPanelVisibility(false);
    };
  }, [hidden]);

  const handleToggle = () => {
    const nextHidden = !hidden;
    setHidden(nextHidden);
    applyPanelVisibility(nextHidden);
  };

  return (
    <>
      {children}
      {hasProfile && (
        <button
          type="button"
          onClick={handleToggle}
          className={`fixed z-[120] right-4 font-mono rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-wide shadow-2xl transition-all ${
            hidden
              ? 'bottom-4 bg-cyan-300 text-slate-950 border-cyan-100 shadow-cyan-900/40 hover:bg-cyan-200'
              : 'bottom-[min(44vh,430px)] bg-slate-950/95 text-cyan-100 border-cyan-400/40 shadow-cyan-950/50 hover:bg-slate-900'
          }`}
          aria-pressed={hidden}
          aria-label={hidden ? 'Show water and electricity shop' : 'Hide water and electricity shop'}
          title={hidden ? 'Show water and electricity shop' : 'Hide water and electricity shop'}
        >
          {buttonLabel}
        </button>
      )}
    </>
  );
}
