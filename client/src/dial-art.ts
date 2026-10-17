// Line art for the hands-on trials: a wave, a strip of tape and an antenna dial.
// Same muted palette as the glyphs; every picture is readable at a glance.
import { LAMP_COLORS, TAPE_FRAMES, bitAt, waveDensity, waveHeight, type DialKind } from '../../shared/dials';
import type { Glyph } from '../../shared/protocol';
import { glyphSvg } from './glyphs';

const AMPLITUDE = [0.09, 0.24, 0.44];

// Landmarks printed around the dials: the words players use instead of the jammed sides
let marks = { ceiling: 'потолок', floor: 'пол', window: 'окно', door: 'дверь', bands: ['бас', 'голос', 'писк'] };
export function setArtLang(ru: boolean) {
  marks = ru ? { ceiling: 'потолок', floor: 'пол', window: 'окно', door: 'дверь', bands: ['бас', 'голос', 'писк'] } : { ceiling: 'ceiling', floor: 'floor', window: 'window', door: 'door', bands: ['bass', 'voice', 'treble'] };
}
const label = (x: number, y: number, text: string, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="#a29f95" letter-spacing=".5">${text}</text>`;
const CYCLES = [1.5, 3, 6];

export function waveSvg(v: number | null, w = 240, h = 96, color = '#e3ddcf') {
  const mid = h / 2;
  let path = `M0 ${mid}`;
  if (v !== null) {
    const amp = AMPLITUDE[waveHeight(v)] * h, cycles = CYCLES[waveDensity(v)];
    path = '';
    for (let x = 0; x <= w; x += 2) path += `${x ? 'L' : 'M'}${x} ${(mid - amp * Math.sin((2 * Math.PI * cycles * x) / w)).toFixed(1)} `;
  } else path += ` L${w} ${mid}`;
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${w}" y1="${h * f}" y2="${h * f}" stroke="#ffffff" stroke-opacity="${f === 0.5 ? 0.12 : 0.05}"/>`).join('');
  return `<svg class="dial-art wave-art" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${grid}<path d="${path}" fill="none" stroke="${v === null ? '#555a5e' : color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ${v === null ? 'stroke-dasharray="6 6"' : ''}/></svg>`;
}

// Three-step meters under a wave card, so "medium" never has to be guessed
export function waveMeter(v: number, ru: boolean) {
  const bar = (n: number) => [0, 1, 2].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
  return `<div class="wave-meter"><span>${ru ? 'высота' : 'height'}</span><b>${bar(waveHeight(v))}</b><span>${ru ? 'частота' : 'spacing'}</span><b>${bar(waveDensity(v))}</b></div>`;
}

export function tapeSvg(n: number | null, w = 260, color = '#e3ddcf') {
  const reel = 26, gap = 4, frameW = (w - reel * 2 - 12 - gap * (TAPE_FRAMES - 1)) / TAPE_FRAMES, h = 92, y = 16, fh = 60;
  const frames = Array.from({ length: TAPE_FRAMES }, (_, i) => {
    const x = reel * 2 + 12 + i * (frameW + gap), on = n !== null && i < n;
    return `<rect x="${x.toFixed(1)}" y="${y}" width="${frameW.toFixed(1)}" height="${fh}" rx="2" fill="${on ? color : 'none'}" fill-opacity="${on ? 0.85 : 0}" stroke="${on ? color : '#4c5155'}" stroke-width="1.5"/>
      <circle cx="${(x + frameW / 2).toFixed(1)}" cy="${y - 6}" r="1.6" fill="#4c5155"/><circle cx="${(x + frameW / 2).toFixed(1)}" cy="${y + fh + 6}" r="1.6" fill="#4c5155"/>`;
  }).join('');
  return `<svg class="dial-art tape-art" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <circle cx="${reel}" cy="${y + fh / 2}" r="${reel - 2}" fill="none" stroke="${color}" stroke-opacity=".7" stroke-width="2"/>
    <circle cx="${reel}" cy="${y + fh / 2}" r="7" fill="none" stroke="${color}" stroke-opacity=".7" stroke-width="2"/>
    ${[0, 120, 240].map((a) => `<line x1="${reel}" y1="${y + fh / 2}" x2="${reel + 15 * Math.sin((a * Math.PI) / 180)}" y2="${y + fh / 2 - 15 * Math.cos((a * Math.PI) / 180)}" stroke="${color}" stroke-opacity=".5" stroke-width="1.5"/>`).join('')}
    <line x1="${reel * 2 - 4}" x2="${reel * 2 + 12}" y1="${y + fh / 2}" y2="${y + fh / 2}" stroke="${color}" stroke-opacity=".6" stroke-width="2"/>
    ${frames}</svg>`;
}

export function antennaSvg(dir: number | null, size = 120, color = '#e3ddcf') {
  const c = size / 2, r = size * 0.38;
  const ticks = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4, x1 = c + (r + 6) * Math.sin(a), y1 = c - (r + 6) * Math.cos(a), x2 = c + (r + 12) * Math.sin(a), y2 = c - (r + 12) * Math.cos(a);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#6a7075" stroke-width="${i % 2 ? 1.5 : 2.5}"/>`;
  }).join('');
  let rod = `<circle cx="${c}" cy="${c}" r="5" fill="#555a5e"/>`;
  if (dir !== null) {
    const a = (dir * Math.PI) / 4, x = c + r * Math.sin(a), y = c - r * Math.cos(a);
    rod = `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${color}"/><circle cx="${c}" cy="${c}" r="8" fill="#2a2d2f" stroke="${color}" stroke-width="2"/>`;
  }
  const pad = 38;
  return `<svg class="dial-art antenna-art" viewBox="${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${r + 16}" fill="none" stroke="#3a3e41" stroke-width="1.5"/>${ticks}${rod}
    ${label(c, c - r - 24, marks.ceiling)}${label(c, c + r + 32, marks.floor)}${label(c + r + 20, c + 4, marks.window, 'start')}${label(c - r - 20, c + 4, marks.door, 'end')}</svg>`;
}

export function dialArt(kind: DialKind, v: number | null, size = 1, color = '#e3ddcf', scale: Glyph[] = [], names: string[] = []) {
  return kind === 'wave' ? waveSvg(v, 240 * size, 96 * size, color)
    : kind === 'cassette' ? tapeSvg(v, 260, color)
    : kind === 'equalizer' ? equalizerSvg(v, 200, color)
    : kind === 'morse' ? morseSvg(v, 240, color)
    : kind === 'scale' ? scaleSvg(v, scale, 300, color, names)
    : kind === 'wires' ? wiresSvg(v, 200, color)
    : kind === 'lamp' ? lampSvg(v, 110 * size)
    : antennaSvg(v, 120 * size, color);
}

// ---------- stage 2: equalizer, morse, station scale, wires, lamp ----------

export function equalizerSvg(v: number | null, w = 200, color = '#e3ddcf') {
  const h = 120, bw = 40, gap = (w - bw * 3) / 4;
  const bars = [0, 1, 2].map((i) => {
    const up = v !== null && bitAt(v, i) === 1, bh = v === null ? 0 : up ? 92 : 30, x = gap + i * (bw + gap);
    return `<rect x="${x}" y="8" width="${bw}" height="100" rx="6" fill="#16181a" stroke="#3a3e41"/>
      ${v === null ? '' : `<rect x="${x + 4}" y="${104 - bh}" width="${bw - 8}" height="${bh}" rx="4" fill="${color}" fill-opacity="${up ? 0.9 : 0.55}"/>`}`;
  }).join('');
  return `<svg class="dial-art eq-art" viewBox="0 0 ${w} ${h + 16}" width="${w}" height="${h + 16}" aria-hidden="true">${bars}
    ${[0, 1, 2].map((i) => label(gap + i * (bw + gap) + bw / 2, h + 10, marks.bands[i])).join('')}</svg>`;
}

export function morseSvg(v: number | null, w = 240, color = '#e3ddcf') {
  const h = 60, slot = w / 3;
  const marks = [0, 1, 2].map((i) => {
    const cx = slot * i + slot / 2;
    if (v === null) return `<circle cx="${cx}" cy="30" r="5" fill="#3a3e41"/>`;
    return bitAt(v, i) ? `<rect x="${cx - 30}" y="22" width="60" height="16" rx="8" fill="${color}"/>` : `<circle cx="${cx}" cy="30" r="10" fill="${color}"/>`;
  }).join('');
  return `<svg class="dial-art morse-art" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${marks}</svg>`;
}

export function scaleSvg(v: number | null, scale: Glyph[], w = 300, color = '#e3ddcf', names: string[] = []) {
  const h = 128, x0 = 26, step = (w - 52) / 8, top = 66;
  const icons = scale.map((g, i) => `<g transform="translate(${x0 + i * 2 * step - 16} 2)">${glyphSvg(g, '#d9d3c5', 32)}</g>`
    + (names[i] ? `<text x="${x0 + i * 2 * step}" y="50" text-anchor="middle" font-size="10.5" fill="#9a9a92">${names[i].length > 10 ? names[i].slice(0, 9) + '…' : names[i]}</text>` : '')).join('');
  const ticks = Array.from({ length: 9 }, (_, i) => `<line x1="${x0 + i * step}" x2="${x0 + i * step}" y1="${top + (i % 2 ? 8 : 2)}" y2="${top + 18}" stroke="#6a7075" stroke-width="${i % 2 ? 1.5 : 2.5}"/>`).join('');
  const pointer = v === null ? '' : `<path d="M${x0 + v * step} ${top - 2} L${x0 + v * step - 8} ${top + 40} L${x0 + v * step + 8} ${top + 40} Z" fill="${color}"/>`;
  return `<svg class="dial-art scale-art" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <rect x="4" y="${top - 6}" width="${w - 8}" height="${h - top}" rx="6" fill="#16181a" stroke="#3a3e41"/>${icons}${ticks}${pointer}</svg>`;
}

export function wiresSvg(v: number | null, w = 200, color = '#e3ddcf') {
  const h = 140, cw = w / 3;
  const sockets = Array.from({ length: 6 }, (_, i) => {
    const cx = cw * (i % 3) + cw / 2, cy = 38 + Math.floor(i / 3) * 62, on = v === i;
    return `<circle cx="${cx}" cy="${cy}" r="20" fill="#16181a" stroke="${on ? color : '#4c5155'}" stroke-width="2"/>
      <circle cx="${cx - 6}" cy="${cy}" r="3" fill="#4c5155"/><circle cx="${cx + 6}" cy="${cy}" r="3" fill="#4c5155"/>
      ${on ? `<circle cx="${cx}" cy="${cy}" r="13" fill="${color}"/><path d="M${cx} ${cy - 13} C ${cx} ${cy - 40}, ${cx + 30} ${cy - 30}, ${cx + 40} ${cy - 50}" stroke="${color}" stroke-width="4" fill="none"/>` : ''}`;
  }).join('');
  return `<svg class="dial-art wires-art" viewBox="-44 -18 ${w + 88} ${h + 36}" width="${w}" height="${h}" aria-hidden="true">
    <rect x="4" y="6" width="${w - 8}" height="${h - 12}" rx="10" fill="#1d2022" stroke="#3a3e41"/>${sockets}
    ${label(w / 2, -5, marks.ceiling)}${label(w / 2, h + 14, marks.floor)}${label(-6, h / 2 + 4, marks.door, 'end')}${label(w + 6, h / 2 + 4, marks.window, 'start')}</svg>`;
}

export function lampSvg(v: number | null, size = 120) {
  const c = v === null ? '#3a3e41' : LAMP_COLORS[v];
  return `<svg class="dial-art lamp-art" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
    ${v === null ? '' : `<circle cx="60" cy="52" r="46" fill="${c}" fill-opacity=".18"/>`}
    <path d="M60 14 C 34 14, 26 40, 38 58 C 44 67, 46 72, 46 80 L74 80 C 74 72, 76 67, 82 58 C 94 40, 86 14, 60 14 Z" fill="${c}" stroke="#16181a" stroke-width="2"/>
    <rect x="46" y="82" width="28" height="8" rx="2" fill="#6a7075"/><rect x="48" y="92" width="24" height="8" rx="2" fill="#555a5e"/><rect x="52" y="102" width="16" height="6" rx="2" fill="#44484c"/></svg>`;
}
