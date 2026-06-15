import { ReactNode, useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';

type CowbandSoundtrackGateProps = {
  children: ReactNode;
};

const VIDEO_ID = 'VRiANT6NgUw';
const EMBED_URL = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?loop=1&playlist=${VIDEO_ID}&modestbranding=1&rel=0`;
const PANEL_STATE_KEY = 'ptq_cowband_soundtrack_open';

export default function CowbandSoundtrackGate({ children }: CowbandSoundtrackGateProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(PANEL_STATE_KEY) !== 'false';
  });

  useEffect(() => {
    window.localStorage.setItem(PANEL_STATE_KEY, String(isOpen));
  }, [isOpen]);

  return (
    <>
      {children}

      <aside
        className="fixed bottom-4 left-4 z-[90] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-amber-300/25 bg-slate-950/90 text-slate-100 shadow-2xl shadow-amber-500/10 backdrop-blur-xl"
        aria-label="Cowband soundtrack player"
      >
        <div className="flex items-center gap-3 border-b border-slate-800/80 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-cyan-300 text-slate-950">
            <Music2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black uppercase tracking-wide text-white">Cowband Soundtrack</div>
            <div className="truncate text-[11px] font-semibold text-slate-400">Music by Cowguy55</div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-200 transition hover:border-cyan-300/60 hover:text-white"
            aria-expanded={isOpen}
            aria-controls="cowband-youtube-player"
          >
            {isOpen ? 'Hide' : 'Music'}
          </button>
        </div>

        {isOpen && (
          <div id="cowband-youtube-player" className="p-3">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
              <iframe
                className="aspect-video w-full"
                src={EMBED_URL}
                title="Cowband soundtrack by Cowguy55"
                allow="encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <p className="mt-3 text-[11px] font-semibold leading-snug text-slate-400">
              Press play in the player to use Cowguy55's Cowband music during the intro and game.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
