import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import SimplifiedGameAreaV13 from './SimplifiedGameAreaV13';

const ICE_CREAM_SKIN_ID = 'sprinkles_vanilla_icecream';
const ICE_CREAM_KILL_COST = 100;

type GameAreaV13Props = ComponentProps<typeof SimplifiedGameAreaV13>;

function profileKey(profile: string | null) {
  return (profile || 'Guest Player').trim() || 'Guest Player';
}

function storageKey(profile: string | null, key: string) {
  return `poop_quest_${key}_${profileKey(profile)}`;
}

function readNumber(key: string, fallback: number) {
  const parsed = Number.parseInt(localStorage.getItem(key) || '', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function readStringArray(key: string, fallback: string[]) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function readKillCredits(profile: string | null) {
  return readNumber(storageKey(profile, 'kill_credits'), 0);
}

function saveKillCredits(profile: string | null, amount: number) {
  localStorage.setItem(storageKey(profile, 'kill_credits'), Math.max(0, amount).toString());
}

function readUnlockedSkins(profile: string | null) {
  return readStringArray(storageKey(profile, 'unlocked_skins'), ['default']);
}

function saveUnlockedIceCream(profile: string | null) {
  const key = storageKey(profile, 'unlocked_skins');
  const next = Array.from(new Set(['default', ...readUnlockedSkins(profile), ICE_CREAM_SKIN_ID]));
  localStorage.setItem(key, JSON.stringify(next));
}

function readActiveSkinId(profile: string | null) {
  return localStorage.getItem(storageKey(profile, 'active_skin')) || 'default';
}

function saveActiveIceCream(profile: string | null) {
  localStorage.setItem(storageKey(profile, 'active_skin'), ICE_CREAM_SKIN_ID);
  window.dispatchEvent(new CustomEvent('ptq:play-requested'));
}

export default function SimplifiedGameAreaV14(props: GameAreaV13Props) {
  const [killCredits, setKillCredits] = useState(() => readKillCredits(props.currentUser));
  const [unlockedSkins, setUnlockedSkins] = useState(() => readUnlockedSkins(props.currentUser));
  const [activeSkinId, setActiveSkinId] = useState(() => readActiveSkinId(props.currentUser));

  const isUnlocked = unlockedSkins.includes(ICE_CREAM_SKIN_ID);
  const isActive = activeSkinId === ICE_CREAM_SKIN_ID;
  const remainingKills = Math.max(0, ICE_CREAM_KILL_COST - killCredits);

  const refreshState = useCallback(() => {
    setKillCredits(readKillCredits(props.currentUser));
    setUnlockedSkins(readUnlockedSkins(props.currentUser));
    setActiveSkinId(readActiveSkinId(props.currentUser));
  }, [props.currentUser]);

  useEffect(() => {
    refreshState();
    const intervalId = window.setInterval(refreshState, 500);
    window.addEventListener('storage', refreshState);
    window.addEventListener('ptq:play-requested', refreshState);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshState);
      window.removeEventListener('ptq:play-requested', refreshState);
    };
  }, [refreshState]);

  const buyOrEquip = useCallback(() => {
    if (!isUnlocked) {
      const currentKills = readKillCredits(props.currentUser);
      if (currentKills < ICE_CREAM_KILL_COST) return;
      saveKillCredits(props.currentUser, currentKills - ICE_CREAM_KILL_COST);
      saveUnlockedIceCream(props.currentUser);
    }

    saveActiveIceCream(props.currentUser);
    refreshState();
  }, [isUnlocked, props.currentUser, refreshState]);

  const castAbility = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
  }, []);

  const actionLabel = useMemo(() => {
    if (!isUnlocked && killCredits < ICE_CREAM_KILL_COST) return `Need ${remainingKills} kills`;
    if (!isUnlocked) return 'Buy + Equip';
    return isActive ? 'Equipped' : 'Equip';
  }, [isUnlocked, isActive, killCredits, remainingKills]);

  return (
    <div className="icecream-kill-shop grid gap-3">
      <style>{`.icecream-kill-shop > div > section:first-child { display: none; }`}</style>

      <section className="rounded-2xl border border-pink-300/30 bg-gradient-to-r from-pink-500/15 via-slate-950 to-cyan-500/15 p-4 font-mono text-xs font-bold text-pink-50 shadow-xl shadow-pink-950/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-200">Skin Shop Featured Ability Skin</div>
            <h3 className="mt-1 text-lg font-black uppercase text-white">🍦 Sprinkles Vanilla Ice Cream</h3>
            <p className="mt-1 max-w-3xl leading-relaxed text-pink-100/80">
              Costs {ICE_CREAM_KILL_COST} kills. Equip it, then press <span className="rounded bg-slate-950 px-2 py-1 text-white">1</span> for a full-arena ice cream flush. Cooldown: 10s.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-pink-200/25 bg-slate-950/80 px-3 py-2 text-pink-100">
              {isUnlocked ? 'Unlocked' : `${killCredits}/${ICE_CREAM_KILL_COST} kills`}
            </div>
            <button
              type="button"
              onClick={buyOrEquip}
              disabled={isActive || (!isUnlocked && killCredits < ICE_CREAM_KILL_COST)}
              className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase transition ${isActive ? 'bg-emerald-400 text-slate-950' : !isUnlocked && killCredits < ICE_CREAM_KILL_COST ? 'cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-pink-300 text-slate-950 hover:bg-pink-200'}`}
            >
              {actionLabel}
            </button>
            {isActive && (
              <button
                type="button"
                onClick={castAbility}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-[11px] font-black uppercase text-slate-950 transition hover:bg-cyan-200"
              >
                Cast
              </button>
            )}
          </div>
        </div>
      </section>

      <SimplifiedGameAreaV13 {...props} />
    </div>
  );
}
