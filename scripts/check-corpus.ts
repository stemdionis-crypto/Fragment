// How well the companions read the benchmark of everyday phrases (scripts/corpus.ts).
// Prints accuracy per trial and a sample of misreadings; fails below the target.
import { understandFor } from '../server/bot-lines';
import { dialOptions, type DialKind, isDial } from '../shared/dials';
import { ITEM_SETS, type Glyph, type Value } from '../shared/protocol';
import { CORPUS } from './corpus';

const TARGET = Number(process.env.TARGET ?? 0.97);
const setOf = (g: Glyph) => Object.values(ITEM_SETS).find((s) => (s as readonly string[]).includes(g))!;
const stats = new Map<string, { ok: number; n: number; bad: string[] }>();
for (const c of CORPUS) {
  const options: Value[] = isDial(c.kind) ? dialOptions(c.kind as DialKind) : [...setOf(c.want as Glyph)];
  const got = understandFor(c.kind, c.text, options, c.scale);
  const s = stats.get(c.kind) ?? { ok: 0, n: 0, bad: [] };
  s.n++;
  if (got === c.want) s.ok++; else s.bad.push(`"${c.text}" → ${got} (нужно ${c.want})`);
  stats.set(c.kind, s);
}
let ok = 0, n = 0;
for (const [kind, s] of stats) {
  ok += s.ok; n += s.n;
  console.log(`${kind.padEnd(10)} ${(100 * s.ok / s.n).toFixed(1).padStart(5)}%  ${s.ok}/${s.n}`);
  if (process.env.VERBOSE) for (const b of s.bad.slice(0, Number(process.env.VERBOSE))) console.log('    ', b);
}
console.log(`ВСЕГО      ${(100 * ok / n).toFixed(1)}%  ${ok}/${n}`);
process.exit(ok / n >= TARGET ? 0 : 1);
