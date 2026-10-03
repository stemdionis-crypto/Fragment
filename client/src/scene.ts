// The room: a 2D stage in layers (wall, table + people, foreground), with a camera that
// moves to whoever holds the floor. Same hand-drawn look as the radio.

import type { PlayerView } from '../../shared/protocol';
import { radioSvg } from './radio';
import { SKINS, type SkinId } from '../../shared/economy';

export function skinAccessory(id: SkinId) {
  if (id === 'operator') return '<path d="M-53 -180 V-203 Q0 -267 53 -203 V-180" fill="none" stroke="#a9c7bd" stroke-width="9"/><rect x="-59" y="-194" width="17" height="35" rx="6" fill="#365a50"/><rect x="42" y="-194" width="17" height="35" rx="6" fill="#365a50"/>';
  if (id === 'wanderer') return '<path d="M-56 -211 Q0 -286 56 -211 L67 -207 L-67 -207 Z" fill="#714a36" stroke="#e0bc83" stroke-width="4"/><path d="M-30 -118 L0 -62 L30 -118" fill="#e0bc83"/>';
  if (id === 'phantom') return '<path d="M-52 -195 Q-45 -268 0 -273 Q45 -268 52 -195" fill="none" stroke="#c5b1ef" stroke-width="10"/><rect x="-33" y="-191" width="66" height="22" rx="9" fill="#514175" stroke="#c5b1ef" stroke-width="3"/>';
  return '';
}
export function skinPortrait(id: SkinId) {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0];
  return `<svg viewBox="-90 -290 180 320" role="img" aria-label="${skin.name.en}"><path d="M-80 10 Q-80 -115 0 -118 Q80 -115 80 10Z" fill="${skin.cloth}"/><ellipse cx="0" cy="-182" rx="44" ry="52" fill="#b4ada0"/><path d="M-46 -186 Q0 -267 46 -186 Q0 -236 -46 -186Z" fill="#27272b"/><circle cx="-15" cy="-180" r="5"/><circle cx="15" cy="-180" r="5"/>${skinAccessory(id)}</svg>`;
}

const W = 1600;
const H = 900;

interface Seat {
  x: number;
  y: number;
  s: number; // scale (depth)
  back: boolean; // sits behind the table
}

// Seats around the table, by number of players
const SEATS: Record<number, Seat[]> = {
  1: [{ x: 520, y: 540, s: 0.85, back: true }],
  2: [
    { x: 520, y: 540, s: 0.85, back: true },
    { x: 1080, y: 540, s: 0.85, back: true },
  ],
  3: [
    { x: 250, y: 700, s: 1, back: false },
    { x: 520, y: 540, s: 0.85, back: true },
    { x: 1350, y: 700, s: 1, back: false },
  ],
  4: [
    { x: 250, y: 700, s: 1, back: false },
    { x: 520, y: 540, s: 0.85, back: true },
    { x: 1080, y: 540, s: 0.85, back: true },
    { x: 1350, y: 700, s: 1, back: false },
  ],
};

export function seatsFor(n: number) {
  return SEATS[Math.max(1, Math.min(4, n))];
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `rgb(${c.join(',')})`;
}

function character(p: PlayerView, seat: Seat, i: number, me: boolean) {
  const skin = SKINS.find((s) => s.id === p.skin) ?? SKINS[0];
  const cloth = skin.id === 'classic' ? shade(p.color, 0.42) : skin.cloth;
  const clothHi = skin.id === 'classic' ? shade(p.color, 0.62) : skin.accent;
  const hair = shade(p.color, 0.22);
  const flip = seat.x > W / 2 ? -1 : 1;
  // Side seats lean toward the table a little
  const lean = seat.back ? 0 : 6 * flip;
  return `
  <g class="seat" data-id="${p.id}" transform="translate(${seat.x} ${seat.y}) scale(${seat.s})">
    <ellipse class="spot" cx="0" cy="-120" rx="190" ry="230" fill="url(#spot)"/>
    <rect x="-82" y="-250" width="164" height="250" rx="22" fill="#121314" stroke="#070707" stroke-width="4"/>
    <g class="body" style="--d:${i * 0.7}s"><g transform="skewX(${lean})">
      <path d="M-96 10 C-96 -72 -64 -118 0 -118 C64 -118 96 -72 96 10 Z" fill="${cloth}" stroke="#070707" stroke-width="5"/>
      <path d="M-30 -112 L0 -60 L30 -112" fill="none" stroke="${clothHi}" stroke-width="5" stroke-linecap="round"/>
      <rect x="-15" y="-140" width="30" height="30" fill="#6f6a62"/>
      <g class="head">
        <ellipse cx="0" cy="-182" rx="44" ry="52" fill="#b4ada0" stroke="#070707" stroke-width="5"/>
        <path d="M-46 -186 C-50 -246 50 -250 46 -186 C34 -214 -20 -222 -46 -186 Z" fill="${hair}" stroke="#070707" stroke-width="4"/>
        <ellipse cx="0" cy="-160" rx="40" ry="20" fill="#000" opacity=".12"/>
        <g class="eyes">
          <ellipse cx="-15" cy="-180" rx="5" ry="6.5" fill="#0c0c0c"/>
          <ellipse cx="15" cy="-180" rx="5" ry="6.5" fill="#0c0c0c"/>
        </g>
        <path class="mouth" d="M-11 -150 Q0 -146 11 -150" fill="none" stroke="#2a2522" stroke-width="3.5" stroke-linecap="round"/>
        ${skinAccessory(skin.id)}
      </g>
      <circle class="turn-ring" cx="0" cy="-182" r="72" fill="none" stroke="#e3ddcf" stroke-width="4" stroke-dasharray="452" stroke-dashoffset="0" transform="rotate(-90 0 -182)"/>
    </g></g>
    <g class="plate" transform="translate(0 ${seat.back ? 64 : 48})">
      <rect x="-80" y="-18" width="160" height="34" rx="6" fill="#0d0e0f" stroke="${p.color}" stroke-width="2"/>
      <text x="0" y="6" text-anchor="middle" fill="${p.color}">${escapeXml(p.name)}${me ? ' ·' : ''}</text>
    </g>
  </g>`;
}

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

export function sceneSvg(players: PlayerView[], myId: string) {
  const seats = seatsFor(players.length);
  const people = players.map((p, i) => ({ p, seat: seats[i], i }));
  const behind = people.filter((x) => x.seat.back).map((x) => character(x.p, x.seat, x.i, x.p.id === myId)).join('');
  const sides = people.filter((x) => !x.seat.back).map((x) => character(x.p, x.seat, x.i, x.p.id === myId)).join('');

  const stripes = Array.from({ length: 34 }, (_, i) => `<line x1="${-200 + i * 60}" y1="-200" x2="${-200 + i * 60}" y2="760"/>`).join('');

  return `
  <svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-label="The room">
    <defs>
      <radialGradient id="spot"><stop offset="0" stop-color="#e3ddcf" stop-opacity=".16"/><stop offset="1" stop-color="#e3ddcf" stop-opacity="0"/></radialGradient>
      <radialGradient id="lampGlow" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="#e3ddcf" stop-opacity=".22"/><stop offset="1" stop-color="#e3ddcf" stop-opacity="0"/></radialGradient>
      <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3ddcf" stop-opacity=".16"/><stop offset="1" stop-color="#e3ddcf" stop-opacity="0"/></linearGradient>
      <radialGradient id="vignette" cx="50%" cy="45%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>

    <g class="layer" data-depth="0.45">
      <rect x="-400" y="-300" width="2400" height="1500" fill="#111213"/>
      <g stroke="#151617" stroke-width="18">${stripes}</g>
      <rect x="-400" y="760" width="2400" height="500" fill="#0b0c0c"/>
      <line x1="-400" y1="760" x2="2000" y2="760" stroke="#1b1c1d" stroke-width="6"/>
      <g class="sketch">
        <rect x="140" y="120" width="190" height="240" fill="#18191a" stroke="#070707" stroke-width="6"/>
        <rect x="160" y="140" width="150" height="200" fill="#202223"/>
        <ellipse cx="235" cy="215" rx="34" ry="42" fill="#2b2d2e"/>
        <path d="M185 340 C190 270 280 270 285 340 Z" fill="#2b2d2e"/>
        <rect x="1180" y="90" width="260" height="300" fill="#1a2024" stroke="#070707" stroke-width="8"/>
        <path d="M1310 90 V390 M1180 240 H1440" stroke="#070707" stroke-width="8"/>
        <circle cx="1390" cy="150" r="22" fill="#cfd6d4" opacity=".55"/>
        <circle cx="1390" cy="150" r="60" fill="#cfd6d4" opacity=".05"/>
        <circle cx="800" cy="70" r="36" fill="#18191a" stroke="#070707" stroke-width="5"/>
        <path class="clock-hand" d="M800 70 L800 46" stroke="#8d9499" stroke-width="3" stroke-linecap="round"/>
        <path d="M800 70 L818 78" stroke="#8d9499" stroke-width="3" stroke-linecap="round"/>
      </g>
    </g>

    <g class="layer" data-depth="1">
      <path d="M800 -60 V150" stroke="#070707" stroke-width="4"/>
      <polygon points="430,780 1170,780 900,190 700,190" fill="url(#cone)"/>
      ${behind}
      <g class="sketch">
        <ellipse cx="800" cy="640" rx="620" ry="110" fill="url(#lampGlow)"/>
        <polygon points="300,560 1300,560 1480,720 120,720" fill="#202224" stroke="#070707" stroke-width="6"/>
        <polygon points="300,560 1300,560 1320,578 280,578" fill="#2a2c2e"/>
        <rect x="120" y="720" width="1360" height="34" fill="#151617" stroke="#070707" stroke-width="6"/>
        <rect x="180" y="754" width="34" height="140" fill="#101112"/>
        <rect x="1386" y="754" width="34" height="140" fill="#101112"/>
        <ellipse cx="800" cy="676" rx="300" ry="26" fill="#000" opacity=".35"/>
      </g>
      ${radioSvg('x="560" y="370" width="480" height="291"')}
      <g class="sketch">
        <path d="M700 150 L900 150 L860 106 L740 106 Z" fill="#1d1e1f" stroke="#070707" stroke-width="5"/>
        <ellipse cx="800" cy="152" rx="40" ry="8" fill="#f2efe8"/>
      </g>
      ${sides}
    </g>

    <g class="layer" data-depth="1.25">
      <g filter="url(#soft)" opacity=".9">
        <path d="M-260 1000 L-260 700 Q-160 650 -40 700 L-40 1000 Z" fill="#050505"/>
        <rect x="1660" y="760" width="56" height="260" rx="12" fill="#050505"/>
        <path d="M1740 1000 L1750 820 L1830 820 L1840 1000 Z" fill="#050505"/>
      </g>
    </g>

    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#vignette)" pointer-events="none"/>
  </svg>`;
}

// ---------- camera ----------

import { settings } from './settings';
type Target = { x: number; y: number; z: number };

export class Camera {
  private cur: Target = { x: W / 2, y: H / 2, z: 1 };
  private target: Target = { x: W / 2, y: H / 2, z: 1 };
  private overrideUntil = 0;
  private override: Target | null = null;

  constructor(private root: SVGSVGElement) {}

  // Where the camera rests: on the current speaker
  focusSeat(seat: Seat | null) {
    this.target = seat ? { x: seat.x + (W / 2 - seat.x) * 0.25, y: seat.y - 170 * seat.s, z: 1.32 } : { x: W / 2, y: H / 2, z: 1 };
  }

  // A short close-up (someone just said something, or the radio spoke)
  punch(t: Target, ms: number) {
    this.override = t;
    this.overrideUntil = performance.now() + ms;
  }

  punchSeat(seat: Seat, ms = 2600) {
    this.punch({ x: seat.x + (W / 2 - seat.x) * 0.15, y: seat.y - 190 * seat.s, z: 1.6 }, ms);
  }

  punchRadio(ms = 2600) {
    this.punch({ x: 800, y: 500, z: 1.75 }, ms);
  }

  update(now: number) {
    const still = !settings.camera || settings.reducedMotion;
    const t = still ? { x: W / 2, y: H / 2, z: 1 } : this.override && now < this.overrideUntil ? this.override : this.target;
    const k = 0.045;
    this.cur.x += (t.x - this.cur.x) * k;
    this.cur.y += (t.y - this.cur.y) * k;
    this.cur.z += (t.z - this.cur.z) * k;
    if (still) this.cur = { ...t };
    // Gentle handheld drift
    const dx = still ? 0 : Math.sin(now / 2100) * 6;
    const dy = still ? 0 : Math.cos(now / 2700) * 4;
    this.root.querySelectorAll<SVGGElement>('.layer').forEach((layer) => {
      const d = Number(layer.dataset.depth);
      const z = 1 + (this.cur.z - 1) * d;
      const cx = W / 2 + (this.cur.x + dx - W / 2) * d;
      const cy = H / 2 + (this.cur.y + dy - H / 2) * d;
      layer.setAttribute('transform', `translate(${W / 2} ${H / 2}) scale(${z.toFixed(4)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`);
    });
  }
}
