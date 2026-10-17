// Hands-on trials: every way a bot describes a wave, tape or antenna must be read back
// to the same value, and the radio must not hear a number in it.
import { dialOptions, type DialKind } from '../shared/dials';
import { describeFor, understandFor } from '../server/bot-lines';
import { ITEM_SETS, type Glyph } from '../shared/protocol';
import { trialSequence, generateTrial } from '../server/puzzle';
import { Listener } from '../server/listener';
import { TRIAL_JAMS } from '../shared/dials';

let failures = 0;
const fail = (msg: string) => { failures++; console.error('FAIL', msg); };

const sets = Object.values(ITEM_SETS).map((s) => [...s] as Glyph[]);
for (const kind of ['wave', 'cassette', 'antenna', 'equalizer', 'morse', 'scale', 'wires', 'lamp'] as DialKind[]) {
  const options = dialOptions(kind);
  for (const v of options) for (const lang of ['ru', 'en'] as const) for (let i = 0; i < 25; i++) {
    const scale = kind === 'scale' ? [...sets[i % sets.length]].sort(() => Math.random() - 0.5).slice(0, 5) : undefined;
    const text = describeFor(kind, v, lang, scale);
    const read = understandFor(kind, text, options, scale);
    if (read !== v) fail(`${kind} ${v} ${lang}: "${text}" read as ${read}`);
    const listener = new Listener(); listener.setJammed(TRIAL_JAMS[kind] ?? []);
    const heard = listener.listen(kind === 'scale' ? text.replace(/.*?: /, '') : text);
    if (kind !== 'scale' && heard.heardWords.length) fail(`${kind} ${v} ${lang}: radio hears ${heard.heardWords.join(', ')} in "${text}"`);
  }
}

for (let i = 0; i < 300; i++) {
  const route = trialSequence(4);
  if (new Set(route.map((r) => r.kind)).size !== 4) fail('repeated trial in a match');
  if (!['wave', 'cassette', 'antenna', 'equalizer', 'wires'].includes(route[0].kind)) fail(`match opens with ${route[0].kind}`);
  const pictures = ['code', 'missing', 'scale'];
  if (route.some((r, i) => i > 0 && pictures.includes(r.kind) && pictures.includes(route[i - 1].kind))) fail('two picture trials back to back');
  for (const step of route) {
    const t = generateTrial(step.kind, step.set, ['a', 'b', 'c', 'd']);
    if (t.controls.length !== 4) fail(`${step.kind}: ${t.controls.length} controls`);
  }
}

console.log(failures ? `${failures} failures` : 'dials ok');
process.exit(failures ? 1 : 0);
