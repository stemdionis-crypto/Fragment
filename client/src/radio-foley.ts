// Dry relay contacts and a worn tuning mechanism, without a pitched sweep.
export function radioFoleySamples(sampleRate: number, seconds: number, variant: number): Float32Array {
  const samples = new Float32Array(Math.ceil(sampleRate * seconds));
  let seed = 7919 + variant * 104729;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const strike = (at: number, strength: number) => {
    const start = Math.floor(at * sampleRate);
    const body = 370 + random() * 140;
    let softened = 0;
    for (let i = 0; i < sampleRate * 0.075 && start + i < samples.length; i++) {
      const t = i / sampleRate;
      softened += 0.23 * (random() * 2 - 1 - softened);
      const contact = softened * Math.exp(-t * 260);
      const casing = Math.sin(t * Math.PI * 2 * body) * Math.exp(-t * 105)
        + 0.3 * Math.sin(t * Math.PI * 2 * body * 2.71) * Math.exp(-t * 190);
      const attack = Math.min(1, t / 0.0015);
      samples[start + i] += strength * attack * (contact * 0.9 + casing * 0.25);
    }
  };
  strike(0.008, 1);
  strike(Math.min(seconds * 0.37, 0.065), 0.45);
  // Irregular clusters, rather than a continuous white-noise whoosh.
  let at = 0.1;
  while (at < seconds - 0.1) {
    strike(at, 0.18 + random() * 0.35);
    at += 0.055 + random() * 0.16;
  }
  if (seconds > 0.3) strike(seconds - 0.09, 0.65);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const fade = Math.min(1, i / (sampleRate * 0.004), (samples.length - 1 - i) / (sampleRate * 0.018));
    samples[i] *= Math.max(0, fade);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const scale = peak > 0 ? 0.8 / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
}
