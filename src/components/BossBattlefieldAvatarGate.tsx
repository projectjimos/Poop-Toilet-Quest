import { useEffect, useMemo, useState, type ReactNode } from 'react';

interface BossBattlefieldAvatarGateProps {
  children: ReactNode;
}

type BossAvatar = {
  wave: number;
  name: string;
  emoji: string;
};

const WAVE_LABEL_PATTERN = /Poop Crusader\s*Level\s*(\d+)/i;

const BOSS_POOL = [
  { name: 'Plunger Titan', emoji: '🪠👑' },
  { name: 'Germ King', emoji: '🦠👑' },
  { name: 'Paper Beast', emoji: '🧻👹' },
  { name: 'Mega Brush', emoji: '🪥⚡' },
  { name: 'Sewer Overlord', emoji: '🚽🌌' }
];

function getCurrentWave(): number | null {
  const text = document.body?.innerText || '';
  const match = text.match(WAVE_LABEL_PATTERN);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isPlaying(): boolean {
  const text = document.body?.innerText || '';
  const isLobby = /SELECT INPUT SYSTEM|Start PC Play|Start Mobile Play|Start CO-OP Play/i.test(text);
  const isGameOver = /GAME OVER|Try Again|Return to Lobby/i.test(text);
  return WAVE_LABEL_PATTERN.test(text) && !isLobby && !isGameOver;
}

function getBossForWave(wave: number): BossAvatar {
  const boss = BOSS_POOL[Math.floor((wave / 5 - 1) % BOSS_POOL.length)];
  return { wave, ...boss };
}

export default function BossBattlefieldAvatarGate({ children }: BossBattlefieldAvatarGateProps) {
  const [boss, setBoss] = useState<BossAvatar | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const wave = getCurrentWave();
      const text = document.body?.innerText || '';
      const bossPanelActive = /Extreme boss wave/i.test(text);

      if (!wave || wave % 5 !== 0 || !isPlaying() || !bossPanelActive) {
        setBoss(null);
        return;
      }

      const nextBoss = getBossForWave(wave);
      setBoss((current) => {
        if (current?.wave === nextBoss.wave && current.name === nextBoss.name) return current;
        setPulseKey((value) => value + 1);
        return nextBoss;
      });
    }, 300);

    return () => window.clearInterval(interval);
  }, []);

  const bossScale = useMemo(() => {
    if (!boss) return 1;
    return Math.min(1.35, 1 + boss.wave * 0.012);
  }, [boss]);

  return (
    <>
      {children}

      {boss && (
        <div className="fixed inset-0 z-[334] pointer-events-none flex items-center justify-center px-4">
          <div
            key={`${boss.wave}-${pulseKey}`}
            className="relative -translate-y-8 text-center font-mono animate-bounce"
            style={{ transform: `translateY(-2rem) scale(${bossScale})` }}
            aria-hidden="true"
          >
            <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/25 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-red-300/35 animate-ping" />
            <div className="relative rounded-[2rem] border border-red-300/40 bg-slate-950/40 px-5 py-4 shadow-2xl shadow-red-950/50 backdrop-blur-sm">
              <div className="text-[5.6rem] leading-none drop-shadow-[0_16px_28px_rgba(0,0,0,0.75)] sm:text-[7rem]">
                {boss.emoji}
              </div>
              <div className="mt-1 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-red-100 shadow-xl">
                {boss.name}
              </div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">
                Wave {boss.wave} boss • Flush it down
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
