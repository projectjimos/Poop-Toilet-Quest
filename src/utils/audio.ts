// Web Audio API Sound Synthesizer
// Provides retro-arcade style sound effects without needing to load external assets.

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (isMuted) return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number = 0.08,
  type: OscillatorType = 'sine',
  destination: AudioNode = ctx.destination
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playNoiseBurst(ctx: AudioContext, startTime: number, duration: number, volume: number, filterFrequency: number) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  noise.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFrequency, startTime);
  filter.Q.setValueAtTime(5, startTime);

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(startTime);
  noise.stop(startTime + duration + 0.02);
}

export function setMuteState(muted: boolean) {
  isMuted = muted;
  if (muted && audioCtx) {
    audioCtx.suspend();
  } else if (!muted && audioCtx) {
    audioCtx.resume();
  }
}

export function playCoinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';

  // High pitch arpeggio
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.setValueAtTime(1320, now + 0.08);

  osc2.frequency.setValueAtTime(440, now);
  osc2.frequency.setValueAtTime(880, now + 0.08);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.26);
  osc2.stop(now + 0.26);
}

export function playFlushSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 1.2;

  // Create White Noise
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  // Use a bandpass filter to sweep down, simulating water gushing
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.setValueAtTime(3.0, now);
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(150, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.setValueAtTime(0.2, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration + 0.1);

  // Add low frequency rumbling bubbling sound
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(40, now + duration);

  // Create bubbling LFO
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(12, now); // 12 Hz bubble modulation
  lfoGain.gain.setValueAtTime(15, now);

  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  oscGain.gain.setValueAtTime(0.18, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  lfo.start(now);
  osc.start(now);
  lfo.stop(now + duration);
  osc.stop(now + duration);
}

export function playDamageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.17);
}

export function playOuchSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.linearRampToValueAtTime(120, now + 0.2);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.23);
}

export function playUnlockSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [261.63, 329.63, 392.00, 523.25]; // C major custom chord

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + idx * 0.08 + 0.35);
  });
}

export function playCoinStreakSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [784, 988, 1175, 1480, 1760];
  notes.forEach((freq, idx) => {
    playTone(ctx, freq, now + idx * 0.055, 0.16, 0.075, idx % 2 === 0 ? 'triangle' : 'sine');
  });
}

export function playPerfectFlushSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const chord = [196, 261.63, 329.63, 392, 523.25, 659.25];
  chord.forEach((freq, idx) => {
    playTone(ctx, freq, now + idx * 0.018, 0.48, idx < 2 ? 0.07 : 0.052, idx < 2 ? 'triangle' : 'sine');
  });
  playNoiseBurst(ctx, now + 0.04, 0.22, 0.05, 1800);
}

export function playNewToiletRevealSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  for (let i = 0; i < 7; i++) {
    playNoiseBurst(ctx, now + i * 0.065, 0.045, 0.035, 700 + i * 250);
    playTone(ctx, 140 + i * 28, now + i * 0.065, 0.05, 0.045, 'square');
  }

  [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
    playTone(ctx, freq, now + 0.48 + idx * 0.07, 0.38, 0.07, 'sine');
  });
}

export function playBossAppearsSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [110, 82.41, 110, 73.42].forEach((freq, idx) => {
    playTone(ctx, freq, now + idx * 0.18, 0.16, 0.11, 'sawtooth');
  });
  playNoiseBurst(ctx, now + 0.03, 0.55, 0.04, 420);
}

export function playLowHpHeartbeatSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [0, 0.22].forEach((offset, idx) => {
    playTone(ctx, idx === 0 ? 72 : 58, now + offset, 0.13, idx === 0 ? 0.13 : 0.09, 'sine');
  });
}

export function playWaveCompleteSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    playTone(ctx, freq, now + idx * 0.09, 0.24, 0.07, idx % 2 === 0 ? 'triangle' : 'sine');
  });
}
