import { useEffect, useState, type ReactNode } from 'react';

interface UtilityPanelVisibilityGateProps {
  children: ReactNode;
}

const STORAGE_KEY = 'poop_quest_utilities_panel_hidden';
const PANEL_SIGNATURES = ['Toilet Utilities', 'Water + electricity power every flush'];

function findUtilitiesPanel(): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('div'));
  const header = nodes.find((node) => {
    const text = node.textContent || '';
    return PANEL_SIGNATURES.every((signature) => text.includes(signature));
  });

  return header?.closest('div.fixed') as HTMLElement | null;
}

export default function UtilityPanelVisibilityGate({ children }: UtilityPanelVisibilityGateProps) {
  const [hidden, setHidden] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [panelFound, setPanelFound] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, hidden ? 'true' : 'false');
  }, [hidden]);

  useEffect(() => {
    const applyVisibility = () => {
      const panel = findUtilitiesPanel();
      setPanelFound(Boolean(panel));

      if (!panel) return;
      panel.style.display = hidden ? 'none' : '';
    };

    applyVisibility();
    const interval = window.setInterval(applyVisibility, 400);

    return () => {
      window.clearInterval(interval);
      const panel = findUtilitiesPanel();
      if (panel) panel.style.display = '';
    };
  }, [hidden]);

  return (
    <>
      {children}
      {panelFound && (
        <button
          type="button"
          onClick={() => setHidden((prev) => !prev)}
          className={`fixed z-[96] right-4 font-mono rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-wide shadow-2xl transition-all ${
            hidden
              ? 'bottom-4 bg-cyan-300 text-slate-950 border-cyan-100 shadow-cyan-900/40'
              : 'bottom-[min(44vh,430px)] bg-slate-950/95 text-cyan-100 border-cyan-400/40 shadow-cyan-950/50 hover:bg-slate-900'
          }`}
          aria-pressed={hidden}
          aria-label={hidden ? 'Show utilities panel' : 'Hide utilities panel'}
          title={hidden ? 'Show water and electricity shop' : 'Hide water and electricity shop'}
        >
          {hidden ? 'Show Utilities' : 'Hide Utilities'}
        </button>
      )}
    </>
  );
}
