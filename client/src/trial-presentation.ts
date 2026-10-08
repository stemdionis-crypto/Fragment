import type { Glyph, TrialKind, TrialView } from '../../shared/protocol';
import { decodeClue, SYMBOL_CIPHERS } from '../../shared/trial-rules';
import { glyphSvg } from './glyphs';

// Each trial has its own illustrated transmission card, using the same line art as the game.
const LOOK: Partial<Record<TrialKind, { mark: Glyph; accent: string; glow: string }>> = {
  tuning: { mark: 'antenna', accent: '#b6c5b8', glow: '#36534c' },
  missing: { mark: 'eye', accent: '#b4b9d0', glow: '#343c58' },
  frequency: { mark: 'dial', accent: '#c9bba2', glow: '#514734' },
  code: { mark: 'lock', accent: '#c1a8a2', glow: '#593d3c' },
  common: { mark: 'circle', accent: '#bdc9ad', glow: '#42543b' },
  next: { mark: 'wind', accent: '#b5cad1', glow: '#36545c' },
  echo: { mark: 'speaker', accent: '#cabfa5', glow: '#5b4e38' },
  duplicate: { mark: 'record', accent: '#c7aec0', glow: '#593f54' },
  previous: { mark: 'hourglass', accent: '#c7b99c', glow: '#554b34' },
  pairs: { mark: 'wire', accent: '#a9c5bd', glow: '#36554d' },
  crowd: { mark: 'star', accent: '#c7b6a5', glow: '#5b4638' },
  rare: { mark: 'feather', accent: '#b7bed2', glow: '#41465f' },
  leap: { mark: 'lightning', accent: '#d0bd99', glow: '#5e4f30' },
  opposite: { mark: 'compass', accent: '#b6c7d0', glow: '#3b515e' },
  reflection: { mark: 'moon', accent: '#c2b3c9', glow: '#514157' },
};

export function trialBanner(tr: TrialView, ru: boolean) {
  const look = LOOK[tr.kind] ?? LOOK.tuning!;
  const chapter = ru ? `ПЕРЕДАЧА ${tr.index + 1} / ${tr.total}` : `TRANSMISSION ${tr.index + 1} / ${tr.total}`;
  const title = ru ? tr.title.ru : tr.title.en;
  return `<div class="trial-banner" style="--trial-accent:${look.accent};--trial-glow:${look.glow}">
    <div class="trial-banner-copy"><span class="trial-banner-chapter">${chapter}</span><strong>${title}</strong></div>
    <div class="trial-banner-art" aria-hidden="true"><span class="trial-banner-ring"></span>${glyphSvg(look.mark, look.accent, 74)}</div>
  </div>`;
}

export function trialExample(tr: TrialView, ru: boolean) {
  if (SYMBOL_CIPHERS.includes(tr.kind)) {
    const scale = tr.controls[0]?.options ?? [];
    if (scale.length !== 8) return '';
    const input = scale[0] as Glyph;
    const result = decodeClue(tr.kind, input, scale) as Glyph;
    return `<div class="trial-example"><span>${ru ? 'ПРИМЕР' : 'EXAMPLE'}</span>${glyphSvg(input, 'currentColor', 24)}<b>→</b>${glyphSvg(result, 'currentColor', 24)}</div>`;
  }
  if (tr.kind === 'echo') return `<div class="trial-example"><span>${ru ? 'ПРИМЕР' : 'EXAMPLE'}</span><b>4 → 5</b></div>`;
  return '';
}
