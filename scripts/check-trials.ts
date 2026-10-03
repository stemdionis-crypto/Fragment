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
      if (kind === 'missing') {
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
for (let i = 0; i < 500; i++) if (new Set(trialSequence(3).map((p) => p.kind)).size === 3) varied++;
failed ||= varied !== 500;
console.log(`${varied === 500 ? 'ok  ' : 'FAIL'} every game has 3 different trials (${varied}/500)`);
process.exit(failed ? 1 : 0);
