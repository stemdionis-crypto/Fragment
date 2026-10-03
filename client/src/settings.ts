export interface Settings {
  master: number; music: number; ambience: number; effects: number;
  muted: boolean; backgroundAudio: boolean; camera: boolean;
  reducedMotion: boolean; filmGrain: boolean; flashes: boolean;
}
const KEY = 'fragment.settings.v1';
export const defaults: Settings = {
  master: 70, music: 35, ambience: 25, effects: 65,
  muted: false, backgroundAudio: false, camera: true,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  filmGrain: true, flashes: true,
};
function restore(): Settings {
  const result = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    for (const key of ['master', 'music', 'ambience', 'effects'] as const) {
      if (typeof saved?.[key] === 'number' && Number.isFinite(saved[key])) result[key] = Math.max(0, Math.min(100, saved[key]));
    }
    for (const key of ['muted', 'backgroundAudio', 'camera', 'reducedMotion', 'filmGrain', 'flashes'] as const) {
      if (typeof saved?.[key] === 'boolean') result[key] = saved[key];
    }
  } catch { /* use defaults */ }
  return result;
}
export const settings = restore();
function applyVisuals() {
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  document.body.classList.toggle('no-grain', !settings.filmGrain);
  document.body.classList.toggle('no-flashes', !settings.flashes || settings.reducedMotion);
}
export function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* optional persistence */ }
  applyVisuals();
  window.dispatchEvent(new Event('fragment:settings'));
}
applyVisuals();
