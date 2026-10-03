// The Object: an old valve radio, drawn as SVG.
// Its "magic eye" tuning tube is the suspicion meter: the dark wedge closes as it hears more.

// `attrs` lets the scene embed the radio as a nested <svg> (x, y, width, height)
export function radioSvg(attrs = '') {
  const slats = Array.from({ length: 15 }, (_, i) => {
    const y = 96 + i * 12;
    return `<line x1="66" y1="${y}" x2="250" y2="${y}" />`;
  }).join('');
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const x = 310 + i * 9.4;
    const h = i % 5 === 0 ? 16 : 9;
    return `<line x1="${x}" y1="${88}" x2="${x}" y2="${88 + h}" />`;
  }).join('');
  const labels = ['540', '700', '900', '1200', '1600']
    .map((l, i) => `<text x="${310 + i * 47}" y="132" text-anchor="middle">${l}</text>`)
    .join('');

  return `
  <svg class="radio sketch" viewBox="0 0 560 340" role="img" aria-label="An old radio" ${attrs}>
    <ellipse cx="280" cy="322" rx="250" ry="12" fill="#000" opacity=".5"/>
    <path d="M178 46 C178 6, 382 6, 382 46" fill="none" stroke="#151617" stroke-width="12" stroke-linecap="round"/>
    <rect x="20" y="40" width="520" height="272" rx="26" fill="#2a2c2e" stroke="#0b0b0c" stroke-width="4"/>
    <rect x="30" y="50" width="500" height="252" rx="20" fill="none" stroke="#3f4245" stroke-width="2"/>

    <rect x="50" y="80" width="216" height="200" rx="14" fill="#18191a" stroke="#0b0b0c" stroke-width="3"/>
    <g stroke="#34373a" stroke-width="5" stroke-linecap="round">${slats}</g>
    <text x="158" y="298" text-anchor="middle" class="brand">VOX · 1937</text>

    <rect x="296" y="78" width="216" height="66" rx="8" fill="#cfc8b6" stroke="#0b0b0c" stroke-width="3"/>
    <g stroke="#2a2a2a" stroke-width="1.4">${ticks}</g>
    <g class="dial-labels">${labels}</g>
    <line id="needle" x1="400" y1="82" x2="400" y2="140" stroke="#8c3a2c" stroke-width="2.6" stroke-linecap="round"/>

    <circle cx="404" cy="200" r="36" fill="#0d0e0e" stroke="#0b0b0c" stroke-width="3"/>
    <circle id="eyeGlow" cx="404" cy="200" r="28" fill="#a9c7bd"/>
    <path id="eyeWedge" d="" fill="#0e1211"/>
    <circle cx="404" cy="200" r="8" fill="#0e1211"/>

    <g class="knob" transform="translate(328 266)"><circle r="22" fill="#1b1c1d" stroke="#0b0b0c" stroke-width="3"/><line x1="0" y1="-6" x2="0" y2="-19" stroke="#cfc8b6" stroke-width="2.4" stroke-linecap="round"/></g>
    <g class="knob" transform="translate(480 266)"><circle r="22" fill="#1b1c1d" stroke="#0b0b0c" stroke-width="3"/><line x1="0" y1="-6" x2="13" y2="-14" stroke="#cfc8b6" stroke-width="2.4" stroke-linecap="round"/></g>
    <rect x="80" y="312" width="40" height="10" rx="3" fill="#151617"/>
    <rect x="440" y="312" width="40" height="10" rx="3" fill="#151617"/>
  </svg>`;
}

import { settings } from './settings';
function lerpColor(a: string, b: string, t: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

let shakeUntil = 0;
export function shakeNeedle(ms = 900) {
  shakeUntil = performance.now() + ms;
}

export function updateRadio(root: HTMLElement, suspicion: number, time: number) {
  const wedge = root.querySelector<SVGPathElement>('#eyeWedge');
  const glow = root.querySelector<SVGCircleElement>('#eyeGlow');
  const needle = root.querySelector<SVGLineElement>('#needle');
  if (!wedge || !glow || !needle) return;

  const s = Math.max(0, Math.min(100, suspicion)) / 100;
  // The eye "opens" on you: the dark wedge narrows as suspicion grows
  const half = ((62 * (1 - s) + 3) * Math.PI) / 180;
  const cx = 404;
  const cy = 200;
  const r = 28.5;
  const a1 = -Math.PI / 2 - half;
  const a2 = -Math.PI / 2 + half;
  wedge.setAttribute(
    'd',
    `M${cx} ${cy} L${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)} Z`,
  );
  const color = s < 0.7 ? lerpColor('7f9a92', 'e6efe9', s / 0.7) : lerpColor('e6efe9', 'c4644f', (s - 0.7) / 0.3);
  glow.setAttribute('fill', color);
  glow.style.filter = `drop-shadow(0 0 ${6 + s * 16}px ${color})`;

  const wander = settings.reducedMotion ? 0.5 : 0.5 + 0.38 * Math.sin(time / 2300) + 0.08 * Math.sin(time / 610);
  const shaking = time < shakeUntil;
  const jitter = settings.reducedMotion ? 0 : (Math.random() - 0.5) * (shaking ? 26 : s * 6);
  const x = 310 + wander * 188 + jitter;
  needle.setAttribute('x1', String(x));
  needle.setAttribute('x2', String(x));
}
