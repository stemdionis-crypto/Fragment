// The room: a 2D stage in layers (wall, table + people, foreground), with a camera that
// moves to whoever holds the floor. Same hand-drawn look as the radio.

import type { PlayerView } from '../../shared/protocol';
import { radioSvg } from './radio';
import { SKINS, type SkinId, type Loadout } from '../../shared/economy';

export function accessorySvg(look: Loadout = {}) {
  const head = look.head === 'headphones' ? '<path d="M-53 -185 V-202 Q0 -265 53 -202 V-185" fill="none" stroke="#aeb9b0" stroke-width="7"/><rect x="-60" y="-199" width="18" height="38" rx="7" fill="#343e3e" stroke="#aeb9b0" stroke-width="3"/><rect x="42" y="-199" width="18" height="38" rx="7" fill="#343e3e" stroke="#aeb9b0" stroke-width="3"/>'
    : look.head === 'beanie' ? '<path d="M-48 -211 Q-42 -258 0 -260 Q42 -258 48 -211Z" fill="#8b7768" stroke="#171719" stroke-width="4"/><rect x="-49" y="-219" width="98" height="17" rx="5" fill="#aa9680"/><path d="M-26 -239V-219 M-9 -250V-219 M9 -250V-219 M26 -239V-219" stroke="#665b52" stroke-width="3"/>'
    : look.head === 'beret' ? '<path d="M-51 -216 Q-68 -244 -18 -253 Q35 -270 57 -233 L39 -213Z" fill="#55675f" stroke="#171719" stroke-width="4"/><path d="M-43 -214H41" stroke="#b1bba3" stroke-width="8"/>' : '';
  const face = look.face === 'glasses' ? '<g fill="none" stroke="#c7c1ac" stroke-width="3"><circle cx="-16" cy="-180" r="13"/><circle cx="16" cy="-180" r="13"/><path d="M-3 -180H3 M-29 -184L-44 -190 M29 -184L44 -190"/></g>'
    : look.face === 'scarf' ? '<path d="M-30 -135Q0 -119 30 -135L27 -111Q0 -103 -27 -111Z" fill="#b0977c" stroke="#242424" stroke-width="3"/><path d="M8 -112L25 -53L43 -60L28 -121Z" fill="#8c7766"/>' : '';
  return head + face;
}
// Distinct character models share only the stage coordinates and animation hooks.
function modelSvg(id: SkinId, color: string, look: Loadout = {}) {
  if (id === 'operator') return goblinModel(look);
  if (id === 'wanderer') return gamerModel(look);
  if (id === 'phantom') return shadowModel(look);
  return `<path d="M-96 10C-96 -72 -64 -118 0 -118C64 -118 96 -72 96 10Z" fill="${shade(color,.42)}" stroke="#111213" stroke-width="5"/><path d="M-30 -112L0 -60L30 -112" fill="none" stroke="${shade(color,.62)}" stroke-width="5"/><rect x="-15" y="-140" width="30" height="30" fill="#8e8577"/><g class="head"><ellipse cx="0" cy="-182" rx="44" ry="52" fill="#b4ada0" stroke="#111213" stroke-width="5"/><path d="M-46 -186C-50 -246 50 -250 46 -186C34 -214 -20 -222 -46 -186Z" fill="#292b2c" stroke="#111213" stroke-width="4"/><g class="eyes"><ellipse cx="-15" cy="-180" rx="5" ry="6" fill="#151515"/><ellipse cx="15" cy="-180" rx="5" ry="6" fill="#151515"/></g><path class="mouth" d="M-11 -150Q0 -146 11 -150" fill="none" stroke="#39312c" stroke-width="3" stroke-linecap="round"/>${accessorySvg(look)}</g>`;
}
function goblinModel(look: Loadout) {
  return `<g class="model-goblin" stroke="#151b18" stroke-linejoin="round" stroke-linecap="round">
    <path d="M-105 12L-103 -54L-82 -99L-41 -126H39L84 -100L105 -49L107 12Z" fill="#70583f" stroke-width="4"/>
    <path d="M-100 -44L-84 -86L-75 -44L-86 -21L-77 -8L-99 8Z M100 -44L83 -85L75 -44L87 -21L78 -6L99 8Z" fill="#66845e" stroke-width="3"/>
    <path d="M-80 -97L-60 -76L-70 -40L-55 -49L-64 -9L-47 -22L-35 12H35L45 -22L61 -9L54 -45L70 -37L60 -76L82 -100L39 -131H-40Z" fill="#3b4642" stroke-width="4"/>
    <path d="M-41 -132L-30 -111L0 -52L31 -110L40 -132" fill="#67845b" stroke-width="3"/>
    <path d="M-78 -89L-43 -110L-4 -47 M78 -89L43 -110L4 -47" fill="none" stroke="#a49877" stroke-width="3"/>
    <path d="M-94 -10Q0 3 94 -10L92 9Q0 19 -92 9Z" fill="#64513b" stroke-width="3"/>
    <rect x="-15" y="-7" width="30" height="22" rx="3" fill="#a29461" stroke-width="3"/><rect x="-9" y="-2" width="18" height="12" fill="#4a4e37" stroke-width="2"/>
    <g transform="translate(-62 -10)"><circle r="17" fill="#8e8050" stroke-width="3"/><circle r="10" fill="#444d37" stroke-width="3"/><path d="M-22 -8L-14 -21M12 -21L22 -8M-19 12L-12 23M13 22L21 12" stroke="#8e8050" stroke-width="6"/></g>
    <path d="M54 -8L49 18L61 20L68 -7" fill="#a49672" stroke-width="3"/>
    <g class="head">
      <path d="M-43 -204Q-89 -226 -128 -222L-103 -195Q-90 -178 -55 -174Z" fill="#6e935f" stroke-width="4"/>
      <path d="M43 -204Q89 -226 128 -222L103 -195Q90 -178 55 -174Z" fill="#6e935f" stroke-width="4"/>
      <path d="M-57 -196L-106 -212L-86 -194L-67 -188 M57 -196L106 -212L86 -194L67 -188" fill="none" stroke="#3d603c" stroke-width="3"/>
      <path d="M-57 -181Q-68 -231 -33 -250Q0 -268 33 -250Q68 -231 57 -181L37 -131Q0 -115 -37 -131Z" fill="#779666" stroke-width="4"/>
      <path d="M-48 -231L-35 -249L-18 -252L-3 -220 M38 -246L53 -232L40 -212" fill="none" stroke="#725d40" stroke-width="12"/>
      <path d="M-51 -222Q0 -238 51 -222L55 -179L36 -136Q0 -119 -36 -136L-55 -179Z" fill="#53583e" stroke-width="4"/>
      <path d="M0 -228V-187 M-45 -153L-54 -143 M44 -153L53 -143" fill="none" stroke="#292f24" stroke-width="2"/>
      <g fill="#a79962" stroke-width="3"><ellipse cx="-26" cy="-190" rx="25" ry="30"/><ellipse cx="26" cy="-190" rx="25" ry="30"/></g>
      <g fill="#667a70" stroke="#303a31" stroke-width="3"><ellipse cx="-26" cy="-190" rx="19" ry="24"/><ellipse cx="26" cy="-190" rx="19" ry="24"/></g>
      <path d="M-39 -186L-26 -210H-18L-32 -171 M13 -185L26 -210H34L20 -172" fill="#c1d0b2" opacity=".22" stroke="none"/>
      <g fill="#c1ac77" stroke-width="2"><rect x="-54" y="-229" width="12" height="14" rx="3" transform="rotate(-22 -48 -222)"/><rect x="43" y="-229" width="12" height="14" rx="3" transform="rotate(22 49 -222)"/><circle cx="-44" cy="-153" r="7"/></g>
      <circle cx="3" cy="-137" r="30" fill="#8c7e4f" stroke-width="4"/>
      <path d="M-22 -150L28 -150 M-25 -142H31 M-26 -134H31" stroke="#41412b" stroke-width="3"/>
      <ellipse cx="3" cy="-125" rx="25" ry="23" fill="#766c43" stroke-width="3"/>
      <ellipse cx="3" cy="-125" rx="18" ry="16" fill="#333b29" stroke-width="3"/>
      <ellipse cx="3" cy="-125" rx="10" ry="9" fill="#82754b" stroke-width="3"/>
      ${accessorySvg({ ...look, face: look.face === 'scarf' ? 'face-none' : look.face }).replaceAll('cy="-180"','cy="-190"')}
    </g>
    ${look.face === 'scarf' ? `<g transform="translate(0 44)">${accessorySvg({face:'scarf'})}</g>` : ''}
  </g>`;
}
function gamerModel(look: Loadout) {
  const headset = !look.head || ['head-none','headphones'].includes(look.head);
  return `<g class="model-gamer" stroke="#242422" stroke-linejoin="round" stroke-linecap="round">
    <path d="M-119 12Q-128 -52 -104 -91Q-87 -114 -49 -125H49Q87 -114 104 -91Q128 -52 119 12Z" fill="#7a7c72" stroke-width="4"/>
    <path d="M-109 -80L-114 -22L-98 -18L-98 10H-119 M109 -80L114 -22L98 -18L98 10H119" fill="#b09576" stroke-width="3"/>
    <path d="M-47 -124L-25 -96Q0 -82 25 -96L47 -124" fill="#bfa080" stroke-width="3"/>
    <path d="M-47 -113L0 -82L47 -113" fill="none" stroke="#43473f" stroke-width="5"/>
    <path d="M-78 -38Q-35 -47 -12 -35 M12 -35Q40 -22 82 -37 M-92 2Q0 15 93 2" fill="none" stroke="#4f534c" stroke-width="2.5"/>
    <g fill="#858166" stroke="none" opacity=".85"><path d="M-57 -78l9 -8 7 12 -4 13 -14 -7Z M31 -58l12 -7 5 11 -8 8Z M-68 -16l8 -6 8 6 -7 12Z M50 -10l9 -5 6 11 -10 5Z"/><circle cx="-26" cy="-57" r="4"/><circle cx="21" cy="-8" r="5"/></g>
    <path d="M-47 -142Q0 -175 47 -142L40 -105Q0 -83 -40 -105Z" fill="#bfa080" stroke-width="3"/>
    <g class="head">
      <path d="M-57 -199Q-59 -247 0 -253Q59 -247 57 -199L57 -161Q52 -135 27 -121Q0 -108 -27 -121Q-52 -135 -57 -161Z" fill="#c9ac8b" stroke-width="4"/>
      <path d="M-57 -211Q-63 -253 -26 -259Q26 -271 57 -231L58 -203Q33 -221 -4 -226Q-36 -226 -57 -211Z" fill="#292d2d" stroke-width="4"/>
      <path d="M-45 -195Q-27 -207 -10 -195 M10 -195Q27 -207 45 -195" fill="none" stroke="#3c332b" stroke-width="5"/>
      <g class="eyes" fill="#ede1c4" stroke-width="2"><path d="M-42 -182Q-27 -194 -11 -182Q-28 -174 -42 -182Z M11 -182Q27 -194 42 -182Q28 -174 11 -182Z"/><g fill="#292724" stroke="none"><ellipse cx="-26" cy="-183" rx="4" ry="5"/><ellipse cx="26" cy="-183" rx="4" ry="5"/></g></g>
      <path d="M-1 -183L-6 -166L3 -162L11 -165 M-34 -170Q-25 -164 -13 -168 M13 -168Q25 -164 34 -170" fill="none" stroke="#9a7b60" stroke-width="2"/>
      <path class="mouth" d="M-19 -147Q-6 -155 0 -151Q6 -155 19 -147 M-14 -139Q0 -134 14 -139" fill="none" stroke="#624b3c" stroke-width="2.5"/>
      <path d="M-38 -130Q0 -109 38 -130 M-28 -120Q0 -104 28 -120" fill="none" stroke="#ac8e70" stroke-width="2"/>
      <g fill="#b67e68" stroke="#a87563" stroke-width="1"><circle cx="-43" cy="-211" r="2.5"/><circle cx="14" cy="-212" r="2"/><circle cx="39" cy="-202" r="2.5"/><circle cx="-47" cy="-161" r="2"/><circle cx="41" cy="-157" r="2.5"/><circle cx="25" cy="-130" r="2"/><circle cx="-25" cy="-145" r="2"/></g>
      ${headset ? `<path d="M-69 -186V-215Q0 -294 69 -215V-186" fill="none" stroke="#1a2020" stroke-width="12"/><path d="M-67 -213Q0 -281 67 -213" fill="none" stroke="#535e5b" stroke-width="4"/><g fill="#343e3c" stroke-width="4"><rect x="-76" y="-201" width="22" height="55" rx="11"/><rect x="54" y="-201" width="22" height="55" rx="11"/></g><path d="M67 -152Q65 -132 22 -139" fill="none" stroke="#1c2322" stroke-width="5"/><rect x="15" y="-143" width="18" height="8" rx="3" fill="#6a746b" stroke-width="2"/>` : ''}
      <g transform="translate(0 4) scale(1.18 1)">${accessorySvg({...look, head: headset ? 'head-none' : look.head})}</g>
    </g>
    <path d="M-47 -116Q0 -97 47 -116" fill="none" stroke="#313b38" stroke-width="12"/>
    <g fill="#3b4542" stroke="#192220" stroke-width="3"><ellipse cx="-43" cy="-107" rx="19" ry="27" transform="rotate(-20 -43 -107)"/><ellipse cx="43" cy="-107" rx="19" ry="27" transform="rotate(20 43 -107)"/></g>
    <g fill="none" stroke="#65716a" stroke-width="2"><ellipse cx="-43" cy="-107" rx="12" ry="19" transform="rotate(-20 -43 -107)"/><ellipse cx="43" cy="-107" rx="12" ry="19" transform="rotate(20 43 -107)"/></g>
  </g>`;
}
function shadowModel(look: Loadout) {
  return `<g class="model-shadow" stroke="#131b1c" stroke-linejoin="round" stroke-linecap="round">
    <path d="M-91 12L-93 -57Q-94 -100 -66 -117L-36 -137H36L66 -117Q94 -100 93 -57L91 12Z" fill="#303b3d" stroke-width="4"/>
    <path d="M-83 -68L-57 -33L-72 10 M83 -68L57 -33L72 10" fill="none" stroke="#5a6666" stroke-width="2"/>
    <path d="M-73 -89L61 10H91L-42 -110Z" fill="#465153" stroke-width="3"/>
    <path d="M73 -89L-61 10H-91L42 -110Z" fill="#394649" stroke-width="3"/>
    <path d="M-63 -56L-76 -33 M-33 -33L-45 -9 M63 -56L76 -33 M33 -33L45 -9" fill="none" stroke="#63706d" stroke-width="2"/>
    <path d="M-90 -10Q0 4 90 -10L87 12H-87Z" fill="#485354" stroke-width="3"/>
    <g class="head">
      <path d="M-69 -145L-65 -222Q-54 -260 0 -272Q54 -260 65 -222L69 -145L45 -104H-45Z" fill="#3b4849" stroke-width="4"/>
      <path d="M-53 -202Q-49 -241 0 -254Q49 -241 53 -202L43 -151L0 -127L-43 -151Z" fill="#1e282b" stroke-width="3"/>
      <path d="M-44 -207Q-39 -233 0 -243Q39 -233 44 -207L36 -160L0 -138L-36 -160Z" fill="#303b40" stroke-width="3"/>
      <path d="M-27 -222Q-15 -202 -4 -204 M27 -222Q15 -202 4 -204 M0 -209L-6 -174L0 -165L6 -174Z M-28 -166L-16 -151 M28 -166L16 -151" fill="none" stroke="#172126" stroke-width="2.5"/>
      <g class="eyes" fill="#10191c" stroke="#4a5758" stroke-width="1.5"><path d="M-33 -196Q-16 -203 -7 -188Q-20 -180 -33 -190Z M33 -196Q16 -203 7 -188Q20 -180 33 -190Z"/></g>
      <path d="M-58 -214Q-60 -164 -47 -133 M58 -214Q60 -164 47 -133" fill="none" stroke="#637171" stroke-width="2"/>
      <g transform="scale(1.14 1)">${accessorySvg({...look, face: look.face === 'scarf' ? 'face-none' : look.face})}</g>
    </g>
    <path d="M-68 -142Q-27 -106 43 -128L69 -148L88 -112Q67 -50 0 -54Q-68 -67 -88 -112Z" fill="#465354" stroke-width="4"/>
    <path d="M-65 -129Q0 -84 67 -131 M-71 -111Q-7 -66 67 -110 M-60 -95Q0 -59 54 -93" fill="none" stroke="#6a7775" stroke-width="2.5"/>
    <path d="M-45 -88Q-7 -70 32 -79" fill="none" stroke="#273639" stroke-width="4"/>
    ${look.face === 'scarf' ? `<path d="M-55 -102Q0 -67 55 -102L50 -87Q0 -56 -50 -87Z" fill="#ac977c" stroke-width="3"/>` : ''}
  </g>`;
}
export function skinPortrait(id: SkinId, look: Loadout = {}) {
  return `<svg viewBox="-145 -300 290 330" role="img" aria-label="Character preview">${modelSvg(id, '#aaa69d', look)}</svg>`;
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
  const flip = seat.x > W / 2 ? -1 : 1;
  // Side seats lean toward the table a little
  const lean = seat.back ? 0 : 6 * flip;
  return `
  <g class="seat" data-id="${p.id}" transform="translate(${seat.x} ${seat.y}) scale(${seat.s})">
    <ellipse class="spot" cx="0" cy="-120" rx="190" ry="230" fill="url(#spot)"/>
    <rect x="-82" y="-250" width="164" height="250" rx="22" fill="#121314" stroke="#070707" stroke-width="4"/>
    <g class="body" style="--d:${i * 0.7}s"><g transform="skewX(${lean})">
      ${modelSvg(skin.id, p.color, p.cosmetics)}
      <circle class="turn-ring" cx="0" cy="-182" r="${skin.id === 'operator' ? 92 : skin.id === 'wanderer' ? 86 : skin.id === 'phantom' ? 82 : 72}" fill="none" stroke="#e3ddcf" stroke-width="4" stroke-dasharray="${2 * Math.PI * (skin.id === 'operator' ? 92 : skin.id === 'wanderer' ? 86 : skin.id === 'phantom' ? 82 : 72)}" stroke-dashoffset="0" transform="rotate(-90 0 -182)"/>
    </g></g>
    <g class="emote-bubble" transform="translate(0 -305)"><rect x="-31" y="-38" width="62" height="54" rx="18" fill="#e3ddcf" stroke="#292d30" stroke-width="3"/><text y="0" text-anchor="middle" style="font-size:30px"></text></g>
    <g class="plate" transform="translate(0 ${seat.back ? 64 : 48})">
      <rect x="-80" y="-18" width="160" height="34" rx="6" fill="#0d0e0f" stroke="${p.color}" stroke-width="2"/>
      <text x="0" y="6" text-anchor="middle" fill="${p.color}">${escapeXml(p.name)}${me ? ' ·' : ''}</text>
    </g>
  </g>`;
}

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

export function sceneSvg(players: PlayerView[], myId: string, look: Loadout = {}) {
  const seats = seatsFor(players.length);
  const people = players.map((p, i) => ({ p, seat: seats[i], i }));
  const behind = people.filter((x) => x.seat.back).map((x) => character(x.p, x.seat, x.i, x.p.id === myId)).join('');
  const sides = people.filter((x) => !x.seat.back).map((x) => character(x.p, x.seat, x.i, x.p.id === myId)).join('');

  const wall = look.wallpaper === 'wallpaper-botanical' ? '#24312d' : look.wallpaper === 'wallpaper-artdeco' ? '#2b2c37' : '#111213';
  const edge = look.table === 'table-walnut' ? '#6c5445' : look.table === 'table-studio' ? '#59696b' : '#2a2c2e';
  const wood = look.table === 'table-walnut' ? '#514039' : look.table === 'table-studio' ? '#323f44' : '#202224';
  const light = look.lighting === 'lighting-amber' ? '#eac695' : look.lighting === 'lighting-moon' ? '#a6c4d5' : '#e3ddcf';
  const pattern = look.wallpaper === 'wallpaper-botanical' ? Array.from({length:18},(_,i)=>`<path d="M${i*100} 0Q${i*100+70} 220 ${i*100} 550 M${i*100} 150q70 -75 50 -110 M${i*100} 310q-70 -75 -50 -110" fill="none" stroke="#748975" stroke-width="3" opacity=".23"/>`).join('') : look.wallpaper === 'wallpaper-artdeco' ? Array.from({length:16},(_,i)=>`<path d="M${i*120} 100l60 -100 60 100 -60 100Z M${i*120} 400l60 -100 60 100 -60 100Z" fill="none" stroke="#a69a7c" stroke-width="3" opacity=".23"/>`).join('') : '';
  const poster = look.poster === 'poster-signal' ? '<rect x="140" y="120" width="190" height="240" fill="#353b38" stroke="#151515" stroke-width="7"/><path d="M165 250Q190 130 215 250T265 250T310 250" fill="none" stroke="#b9ad8e" stroke-width="6"/><text x="235" y="326" text-anchor="middle" fill="#c8beaa" font-size="22">SIGNAL</text>' : look.poster === 'poster-moon' ? '<rect x="140" y="120" width="190" height="240" fill="#2b3242" stroke="#151515" stroke-width="7"/><circle cx="235" cy="214" r="54" fill="#c4c6b9"/><circle cx="254" cy="199" r="48" fill="#2b3242"/><path d="M160 325L217 270L248 308L286 256L313 325" fill="#616877"/>' : '';
  const decor = look.decor === 'decor-plant' ? '<g transform="translate(1190 572)"><path d="M-24 0L-16 52H16L24 0Z" fill="#8c7763"/><path d="M0 5V-80M0 -27Q-65 -85 -46 -101Q-3 -97 0 -27M0 -45Q54 -122 63 -100Q65 -53 0 -45" fill="#70836c" stroke="#303d32" stroke-width="4"/></g>' : look.decor === 'decor-lantern' ? `<g transform="translate(1190 554)"><ellipse cy="32" rx="83" ry="57" fill="${light}" opacity=".12"/><rect x="-25" y="-45" width="50" height="92" rx="9" fill="#292a28" stroke="#aaa286" stroke-width="4"/><rect x="-17" y="-26" width="34" height="51" rx="4" fill="${light}"/><path d="M-16 -43V-66Q0 -82 16 -66V-43" fill="none" stroke="#aaa286" stroke-width="5"/></g>` : look.decor === 'decor-tapes' ? '<g transform="translate(1170 598) rotate(-7)"><rect width="113" height="54" rx="5" fill="#8b8b7c" stroke="#151515" stroke-width="4"/><rect x="14" y="13" width="85" height="21" fill="#323738"/><circle cx="32" cy="24" r="8" fill="#beb8a3"/><circle cx="78" cy="24" r="8" fill="#beb8a3"/><path d="M20 45H88" stroke="#bcb6a3" stroke-width="4"/></g>' : '';
  const stripes = Array.from({ length: 34 }, (_, i) => `<line x1="${-200 + i * 60}" y1="-200" x2="${-200 + i * 60}" y2="760"/>`).join('');

  return `
  <svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-label="The room">
    <defs>
      <radialGradient id="spot"><stop offset="0" stop-color="${light}" stop-opacity=".16"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
      <radialGradient id="lampGlow" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="${light}" stop-opacity=".22"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
      <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}" stop-opacity=".16"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></linearGradient>
      <radialGradient id="vignette" cx="50%" cy="45%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>

    <g class="layer" data-depth="0.45">
      <rect x="-400" y="-300" width="2400" height="1500" fill="${wall}"/>
      ${pattern}
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
      ${poster}
    </g>

    <g class="layer" data-depth="1">
      <path d="M800 -60 V150" stroke="#070707" stroke-width="4"/>
      <polygon points="430,780 1170,780 900,190 700,190" fill="url(#cone)"/>
      ${behind}
      <g class="sketch">
        <ellipse cx="800" cy="640" rx="620" ry="110" fill="url(#lampGlow)"/>
        <polygon points="300,560 1300,560 1480,720 120,720" fill="${wood}" stroke="#070707" stroke-width="6"/>
        <polygon points="300,560 1300,560 1320,578 280,578" fill="${edge}"/>
        <rect x="120" y="720" width="1360" height="34" fill="#151617" stroke="#070707" stroke-width="6"/>
        <rect x="180" y="754" width="34" height="140" fill="#101112"/>
        <rect x="1386" y="754" width="34" height="140" fill="#101112"/>
        <ellipse cx="800" cy="676" rx="300" ry="26" fill="#000" opacity=".35"/>
      </g>
      ${look.table === 'table-walnut' ? '<path d="M340 590Q500 610 610 589 M1060 620Q1220 595 1330 647 M380 685Q480 665 580 688" fill="none" stroke="#826754" stroke-width="3" opacity=".45"/>' : ''}
      ${decor}
      ${look.table === 'table-studio' ? '<path d="M380 596H500 M380 620H500 M1100 646H1230" stroke="#92a5a0" stroke-width="5"/><circle cx="1080" cy="644" r="8" fill="#bcab87"/>' : ''}
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
