// The items on the radio's keys, drawn as simple line pictures (24×24, stroke only).
import type { Glyph } from '../../shared/protocol';

function star() {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3.6 : 8.5;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12.6 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
}

const SHAPES: Record<Glyph, string> = {
  // signs
  triangle: '<path d="M12 4 L20.5 19 L3.5 19 Z"/>',
  circle: '<circle cx="12" cy="12" r="7.5"/>',
  square: '<rect x="5" y="5" width="14" height="14"/>',
  cross: '<path d="M6 6 L18 18 M18 6 L6 18"/>',
  star: star(),
  moon: '<path d="M15.5 4.2 A8 8 0 1 0 15.5 19.8 A6.4 6.4 0 1 1 15.5 4.2 Z"/>',
  eye: '<path d="M2.5 12 Q12 3.5 21.5 12 Q12 20.5 2.5 12 Z"/><circle cx="12" cy="12" r="2.6"/>',
  key: '<circle cx="7.5" cy="12" r="3.6"/><path d="M11.1 12 H20.5 M17.3 12 V15.3 M20.3 12 V15.3"/>',
  // everyday objects
  candle: '<rect x="8.5" y="10" width="7" height="11" rx="1"/><path d="M12 10 V8"/><path d="M12 2.5 Q14.6 5.4 12 8 Q9.4 5.4 12 2.5 Z"/>',
  cup: '<path d="M4.5 9 H16 V14.5 A4.5 4.5 0 0 1 11.5 19 H9 A4.5 4.5 0 0 1 4.5 14.5 Z"/><path d="M16 10.5 H17.5 A2.5 2.5 0 0 1 17.5 15.5 H16"/><path d="M8.5 3.5 Q9.6 5 8.5 6.5 M12 3.5 Q13.1 5 12 6.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12 V7 M12 12 L15.6 14"/><path d="M12 4.5 V5.4 M19.5 12 H18.6 M12 19.5 V18.6 M4.5 12 H5.4"/>',
  knife: '<path d="M3.5 20.5 L8 16"/><path d="M8 16 L19.5 4.5 Q20.8 8.5 16.5 12.8 L11 18.3 Z"/>',
  book: '<path d="M12 6.5 Q8 4 3.5 5 V19 Q8 18 12 20.5 Q16 18 20.5 19 V5 Q16 4 12 6.5 Z"/><path d="M12 6.5 V20.5"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/><path d="M12 9.5 V14.5"/>',
  feather: '<path d="M19.5 3.5 C11 4.5 6.5 10.5 6.5 17.5 C13 17.5 18.5 12 19.5 3.5 Z"/><path d="M4 20.5 L15 9"/>',
  bottle: '<path d="M10 2.5 H14 V6.5 L16 9.5 V20 A1 1 0 0 1 15 21 H9 A1 1 0 0 1 8 20 V9.5 L10 6.5 Z"/><rect x="8" y="12.5" width="8" height="4.5"/>',
  // animals
  cat: '<path d="M6 10 L6.5 4 L10 7.2 H14 L17.5 4 L18 10 Q19 18 12 19.5 Q5 18 6 10 Z"/><circle cx="9.6" cy="12" r="0.9"/><circle cx="14.4" cy="12" r="0.9"/><path d="M12 14.2 V15.2 M3 13.5 L8 14.5 M3 16 L8 15.5 M21 13.5 L16 14.5 M21 16 L16 15.5"/>',
  owl: '<path d="M6 5 L8.5 7.5 Q12 6 15.5 7.5 L18 5 Q19.5 9 19 13 Q18 20 12 20.5 Q6 20 5 13 Q4.5 9 6 5 Z"/><circle cx="9.3" cy="11.5" r="2.2"/><circle cx="14.7" cy="11.5" r="2.2"/><path d="M11.2 14.2 L12 15.6 L12.8 14.2"/>',
  fish: '<path d="M2.5 12 Q9 4.5 16.5 12 Q9 19.5 2.5 12 Z"/><path d="M16.5 12 L21.5 7.5 V16.5 Z"/><circle cx="7" cy="11" r="0.9"/>',
  spider: '<circle cx="12" cy="13.5" r="3.6"/><circle cx="12" cy="8.3" r="2"/><path d="M8.6 12 L4 9 L3 6 M8.4 14 L3.5 14.5 L2.5 17 M15.4 12 L20 9 L21 6 M15.6 14 L20.5 14.5 L21.5 17 M9.5 16.3 L7 20 M14.5 16.3 L17 20"/>',
  crow: '<path d="M3 15.5 Q7.5 9 14 9.5 L17.5 6.5 L21.5 7.8 L18.2 9.8 Q19.5 13.5 15 15.5 Q10 17.5 3 15.5 Z"/><circle cx="17.2" cy="8.2" r="0.6"/><path d="M11 16.5 L10 20.5 M13.5 16 L13.5 20.5"/>',
  snake: '<path d="M3.5 19 Q6 14.5 9.5 17 T15 15 T19 9.5"/><path d="M17.5 8.5 Q19.5 5.5 21.5 7.5 Q21 10 19 10"/><path d="M21.5 7.5 L23 7"/>',
  rabbit: '<path d="M9.5 9.5 Q7.5 2 9.5 2.5 Q11.5 3 11 9 M14.5 9.5 Q16.5 2 14.5 2.5 Q12.5 3 13 9"/><circle cx="12" cy="14" r="5.5"/><circle cx="10" cy="13" r="0.8"/><circle cx="14" cy="13" r="0.8"/><path d="M11.2 15.6 L12 16.3 L12.8 15.6"/>',
  moth: '<path d="M12 8 Q5 2.5 3.5 9 Q4 13.5 12 12 Q20 13.5 20.5 9 Q19 2.5 12 8 Z"/><path d="M12 12 Q7 13 6.5 17.5 Q9.5 18.5 12 14 Q14.5 18.5 17.5 17.5 Q17 13 12 12 Z"/><path d="M12 7 V18.5 M11 6.5 L9.5 4 M13 6.5 L14.5 4"/>',
};

export function glyphSvg(g: Glyph, color = 'currentColor', size = 28) {
  return `<svg class="glyph" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-label="${g}">${SHAPES[g] ?? ''}</svg>`;
}
