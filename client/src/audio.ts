// One continuous soundtrack across screens, plus procedural radio and action sounds.

import { settings } from './settings';
import soundtrackUrl from './assets/audio/fragment-dark-loop.wav?url';
import { radioFoleySamples } from './radio-foley';
let ctx: AudioContext | null = null;
let unlocked = false;
let master: GainNode;
let music: GainNode;
let ambience: GainNode;
let effects: GainNode;
let tension: GainNode;
let soundtrackLevel: GainNode;
let inMatch = false;
let currentSuspicion = 0;

function syncSoundscape() {
  if (!ctx) return;
  // Change only gain, never restart the source when the screen changes.
  soundtrackLevel.gain.setTargetAtTime(inMatch ? 0.4 : 1, ctx.currentTime, 1.2);
  tension.gain.setTargetAtTime(inMatch ? 0.005 + currentSuspicion * 0.0005 : 0.005, ctx.currentTime, 1.5);
}

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
  soundtrackLevel = a.createGain();
  soundtrackLevel.gain.value = 0;
  soundtrackLevel.connect(music);
  // The WAV has an offline crossfade at its seam. A decoded buffer loops
  // sample-accurately, without media-element seek delays or codec padding.
  void fetch(soundtrackUrl)
    .then(response => {
      if (!response.ok) throw new Error(`Soundtrack HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then(bytes => a.decodeAudioData(bytes))
    .then(buffer => {
      const source = a.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(soundtrackLevel);
      source.start();
      syncSoundscape();
    })
    .catch(error => console.warn('Fragment soundtrack unavailable', error));
  const overtone = a.createOscillator();
  overtone.frequency.value = 233.08;
  overtone.type = 'triangle';
  tension = a.createGain();
  tension.gain.value = 0.005;
  overtone.connect(tension).connect(ambience);
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
  const nextSuspicion = Math.max(0, Math.min(100, suspicion));
  if (inMatch === playing && currentSuspicion === nextSuspicion) return;
  inMatch = playing;
  currentSuspicion = nextSuspicion;
  syncSoundscape();
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

const radioBuffers = new Map<string, AudioBuffer>();
let radioVariant = 0;

function radioContact(seconds: number, volume: number) {
  try {
    const a = ac();
    if (!a || document.hidden && !settings.backgroundAudio) return;
    const variant = radioVariant++ % 4;
    const key = `${seconds}:${variant}`;
    let buf = radioBuffers.get(key);
    if (!buf) {
      const data = radioFoleySamples(a.sampleRate, seconds, variant);
      buf = a.createBuffer(1, data.length, a.sampleRate);
      buf.getChannelData(0).set(data);
      radioBuffers.set(key, buf);
    }
    const src = a.createBufferSource();
    src.buffer = buf;
    const gain = a.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(effects);
    src.onended = () => { src.disconnect(); gain.disconnect(); };
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
  dial: () => { tone(440, 0.06, 0.045, 'triangle'); tone(660, 0.08, 0.025, 'sine', 0.04); },
  send: () => { tone(260, 0.09, 0.035, 'triangle'); radioContact(0.07, 0.025); },
  confirm: () => { tone(392, 0.16, 0.05, 'sine'); tone(587, 0.22, 0.04, 'sine', 0.08); },
  pass: () => { tone(440, 0.12, 0.035, 'triangle'); tone(330, 0.18, 0.035, 'triangle', 0.08); },
  hurry: () => { tone(220, 0.15, 0.03, 'sine'); tone(220, 0.15, 0.03, 'sine', 0.24); },
  turn: () => {
    tone(330, 0.12, 0.05, 'triangle');
    radioContact(0.12, 0.05);
  },
  heard: () => radioContact(0.45, 0.22),
  learned: () => radioContact(0.6, 0.15),
  wrong: () => {
    tone(70, 0.45, 0.25, 'triangle');
    radioContact(0.2, 0.1);
  },
  retune: () => radioContact(1.6, 0.24),
  open: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 1.4, 0.07, 'sine', i * 0.12)),
};
