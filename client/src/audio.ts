// Tiny procedural sound: radio static, a thud and a chime. No audio files.

import { settings } from './settings';
let ctx: AudioContext | null = null;
let unlocked = false;
let master: GainNode;
let music: GainNode;
let ambience: GainNode;
let effects: GainNode;
let tension: GainNode;

function syncVolumes() {
  if (!ctx) return;
  const hidden = document.hidden && !settings.backgroundAudio;
  master.gain.setTargetAtTime(settings.muted || hidden ? 0 : settings.master / 100, ctx.currentTime, 0.08);
  for (const [channel, value] of [[music, settings.music], [ambience, settings.ambience], [effects, settings.effects]] as const)
    channel.gain.setTargetAtTime(value / 100, ctx.currentTime, 0.08);
  if (hidden) void ctx.suspend().catch(() => {});
  else if (unlocked && ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

function soundtrack(a: AudioContext) {
  // Original, slowly breathing minor drone and a radio hiss. No external assets.
  for (const [i, frequency] of [55, 110, 130.81, 164.81, 220].entries()) {
    const osc = a.createOscillator();
    const voice = a.createGain();
    osc.frequency.value = frequency;
    osc.detune.value = i % 2 ? 3 : -3;
    voice.gain.value = i === 0 ? 0.09 : 0.035;
    osc.connect(voice).connect(music);
    const breath = a.createOscillator();
    const depth = a.createGain();
    breath.frequency.value = 0.025 + i * 0.007;
    depth.gain.value = 0.012;
    breath.connect(depth).connect(voice.gain);
    breath.start();
    osc.start();
  }
  const overtone = a.createOscillator();
  overtone.frequency.value = 233.08;
  overtone.type = 'triangle';
  tension = a.createGain();
  tension.gain.value = 0.005;
  overtone.connect(tension).connect(music);
  overtone.start();
  const buffer = a.createBuffer(1, a.sampleRate * 4, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = a.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 650;
  const level = a.createGain();
  level.gain.value = 0.07;
  noise.connect(filter).connect(level).connect(ambience);
  noise.start();
}

export function setSoundscape(playing: boolean, suspicion: number) {
  if (!ctx) return;
  tension.gain.setTargetAtTime(playing ? 0.005 + Math.max(0, Math.min(100, suspicion)) * 0.0005 : 0.005, ctx.currentTime, 1.5);
}

function ac() {
  if (!unlocked) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    music = ctx.createGain();
    ambience = ctx.createGain();
    effects = ctx.createGain();
    for (const channel of [music, ambience, effects]) channel.connect(master);
    soundtrack(ctx);
    syncVolumes();
  }
  if (ctx.state === 'suspended' && (!document.hidden || settings.backgroundAudio)) void ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  const unlock = () => { unlocked = true; try { ac(); } catch { /* audio unavailable */ } };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('fragment:settings', syncVolumes);
  document.addEventListener('visibilitychange', syncVolumes);
}

export function staticBurst(seconds = 0.35, volume = 0.18, freq = 1800) {
  try {
    const a = ac();
    if (!a || document.hidden && !settings.backgroundAudio) return;
    const len = Math.floor(a.sampleRate * seconds);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.97 ? 0.6 : 1);
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const gain = a.createGain();
    gain.gain.setValueAtTime(volume, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + seconds);
    src.connect(filter).connect(gain).connect(effects);
    src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
    src.start();
  } catch {
    /* audio not available */
  }
}

function tone(freq: number, seconds: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
  try {
    const a = ac();
    if (!a || document.hidden && !settings.backgroundAudio) return;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = a.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain).connect(effects);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  } catch {
    /* audio not available */
  }
}

export const sfx = {
  key: () => tone(180, 0.08, 0.08, 'square'),
  turn: () => {
    tone(330, 0.12, 0.05, 'triangle');
    staticBurst(0.12, 0.05, 3000);
  },
  heard: () => staticBurst(0.45, 0.22, 2200),
  learned: () => {
    staticBurst(0.25, 0.12, 900);
    tone(110, 0.6, 0.06, 'sawtooth', 0.1);
  },
  wrong: () => {
    tone(70, 0.45, 0.25, 'triangle');
    staticBurst(0.2, 0.1, 400);
  },
  retune: () => staticBurst(1.6, 0.3, 1200),
  open: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 1.4, 0.07, 'sine', i * 0.12)),
};
