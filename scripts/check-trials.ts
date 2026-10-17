import assert from 'node:assert/strict';
import { HAND_TRIALS, decodeClue } from '../shared/trial-rules';
// Sanity check for the trials, for 3 and 4 players and every set of pictures:
//   - every player owns exactly one control (a vote in "Missing")
//   - the right setting of a control is known to exactly one player, and never to its owner
//   - pooled together, the table knows every answer; alone, nobody does
//   npm run check
import { ITEM_SETS, type ItemSet } from '../shared/protocol';
import { TRIAL_KINDS, generateTrial, solveFromKnowledge, trialSequence } from '../server/puzzle';

const RUNS = 800;
let failed = false;
const sets = Object.keys(ITEM_SETS) as ItemSet[];

for (const kind of TRIAL_KINDS) {
  for (const n of [3, 4]) {
    let ok = 0;
    for (let run = 0; run < RUNS; run++) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const t = generateTrial(kind, sets[run % sets.length], players);
      const owners = t.controls.map((c) => c.ownerId);
      const oneEach = players.every((p) => owners.filter((o) => o === p).length === 1);
      const knowsList = players.map((p) => t.knows[p] ?? []);
      const handsList = players.map((p) => t.hands?.[p] ?? []);
      const pooled = solveFromKnowledge(t, knowsList, handsList);
      const solved = t.controls.every((c) => pooled.get(c.id) === c.target);
      let fair = true;
      if (HAND_TRIALS.includes(kind)) {
        // No single hand reveals the missing picture
        fair = players.every((_, i) => [...solveFromKnowledge(t, [], [handsList[i]]).values()].every((v) => v === null));
      } else {
        // Each control is known by exactly one player, who is not its owner
        fair = t.controls.every((c) => {
          const knowers = players.filter((p) => (t.knows[p] ?? []).some((k) => k.controlId === c.id));
          return knowers.length === 1 && knowers[0] !== c.ownerId;
        });
      }
      if (oneEach && solved && fair) ok++;
    }
    const pass = ok === RUNS;
    failed ||= !pass;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${kind.padEnd(9)} ${n} players  ${ok}/${RUNS}`);
  }
}
let varied = 0;
for (let i = 0; i < 500; i++) if (new Set(trialSequence(4).map((p) => p.kind)).size === 4) varied++;
failed ||= varied !== 500;
console.log(`${varied === 500 ? 'ok  ' : 'FAIL'} every game has 4 different trials (${varied}/500)`);
for (let i = 0; i < 500; i++) {
  const sequence = trialSequence(4);
  assert.ok(['wave', 'cassette', 'antenna', 'equalizer', 'wires'].includes(sequence[0].kind), 'a hands-on part opens the match');
  assert.equal(new Set(sequence.map((trial) => trial.set)).size, 4, 'every trial uses a distinct picture set');
}
assert.equal(TRIAL_KINDS.length, 10);
assert.equal(new Set(TRIAL_KINDS).size, 10);
const seen = new Set<string>();
for (let i = 0; i < 500; i++) trialSequence(4).forEach(t => seen.add(t.kind));
assert.equal(seen.size, 10, 'all trials can be selected');
assert.throws(() => trialSequence(11));
assert.throws(() => trialSequence(0));
const digits = [0,1,2,3,4,5,6,7,8,9];
const expected = { echo: [1,2,3,4,5,6,7,8,9,0] };
for (const [kind, outputs] of Object.entries(expected)) {
  digits.forEach((d, i) => assert.equal(decodeClue(kind as typeof TRIAL_KINDS[number], d, digits), outputs[i]));
}
const scale = ITEM_SETS[sets[0]];
const positions = { next: [1,2,3,4,5,6,7,0], previous: [7,0,1,2,3,4,5,6], opposite: [4,5,6,7,0,1,2,3], reflection: [7,6,5,4,3,2,1,0], pairs: [1,0,3,2,5,4,7,6], leap: [2,3,4,5,6,7,0,1] };
for (const [kind, indices] of Object.entries(positions)) scale.forEach((v,i) => assert.equal(decodeClue(kind as typeof TRIAL_KINDS[number], v, scale),scale[indices[i]]));
console.log('ok   fifteen-trial progression, selection coverage and independent cipher examples');
process.exit(failed ? 1 : 0);
