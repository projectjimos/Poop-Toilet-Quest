import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Music, Pause, Play } from 'lucide-react';

const SOUNDTRACK_FILE = '/soundtrack.mp3';
const SOUNDTRACK_SOURCE_URL = 'https://www.udio.com/songs/12FTcQktKzJk3hVnxjbh9W?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing';
const MUSIC_ENABLED_KEY = 'poop_quest_soundtrack_enabled';

export default function GameSoundtrack() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Add soundtrack.mp3 to the public folder to play this song in-game.');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.28;

    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => {
      setIsPlaying(true);
      setStatusMessage('Soundtrack playing.');
    };
    const onError = () => {
      setIsPlaying(false);
      setStatusMessage('Soundtrack file missing. Add public/soundtrack.mp3 after downloading your Udio song.');
      localStorage.setItem(MUSIC_ENABLED_KEY, 'false');
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const toggleSoundtrack = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        localStorage.setItem(MUSIC_ENABLED_KEY, 'false');
        setStatusMessage('Soundtrack paused.');
        return;
      }

      await audio.play();
      localStorage.setItem(MUSIC_ENABLED_KEY, 'true');
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      localStorage.setItem(MUSIC_ENABLED_KEY, 'false');
      setStatusMessage('Could not start soundtrack yet. Add public/soundtrack.mp3, then press play.');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 font-mono">
      <audio ref={audioRef} src={SOUNDTRACK_FILE} loop preload="none" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            Soundtrack
          </div>
          <div className="mt-2 flex items-center gap-2 text-lg font-black text-fuchsia-200">
            <Music className="h-5 w-5" /> Udio Theme
          </div>
          <p className="mt-2 text-xs font-bold leading-relaxed text-slate-400">
            {statusMessage}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleSoundtrack}
          className="shrink-0 rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-2 text-xs font-black uppercase text-fuchsia-100 transition hover:bg-fuchsia-400/20"
        >
          {isPlaying ? <Pause className="mr-1 inline h-3.5 w-3.5" /> : <Play className="mr-1 inline h-3.5 w-3.5" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <a
        href={SOUNDTRACK_SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-cyan-200 hover:text-cyan-100"
      >
        Open Udio source <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
