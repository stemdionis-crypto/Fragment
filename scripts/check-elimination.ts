import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WebSocket } from 'ws';
import type { ServerMessage } from '../shared/protocol';

const directory = mkdtempSync(join(tmpdir(), 'fragment-elimination-'));
process.env.FRAGMENT_DATA_DIR = directory;
delete process.env.DATABASE_URL; delete process.env.RENDER;
const { Room } = await import('../server/room');
const { generateTrial, solveFromKnowledge, TRIAL_KINDS } = await import('../server/puzzle');
const economy = await import('../server/economy');
const rooms: InstanceType<typeof Room>[] = [];
function fixture() {
  const messages: ServerMessage[] = [];
  const socket = { OPEN: 1, readyState: 1, send: (raw: string) => messages.push(JSON.parse(raw)) } as unknown as WebSocket;
  const room = new Room('TEST', true); rooms.push(room);
  const human = room.addPlayer('Tester', '#c9c4b8', socket);
  room.addCompanions(); room.start(human); room.stopTimer();
  return { room, human, messages };
}
const check = (room: InstanceType<typeof Room>) => (room as unknown as { check(): void }).check();
const retune = (room: InstanceType<typeof Room>) => { room.suspicion = 100; (room as unknown as { checkSuspicion(): void }).checkSuspicion(); };
try {
  const account = await economy.identify();
  const { room, human, messages } = fixture();
  human.accountId = account.id;
  let detached = false; human.onEliminated = () => { detached = true; };
  for (let n = 0; n < 4; n++) {
    room.turnId = human.id; human.lastChat = 0; room.chatFrom(human, 'звезда');
    if (n < 3) assert(room.players.includes(human));
  }
  assert.equal(room.retunes, 2);
  assert(!room.players.includes(human)); assert(detached); assert.equal(human.socket, null);
  const notice = messages.find(m => m.t === 'eliminated');
  assert.deepEqual(notice, { t: 'eliminated', words: 4, answers: 0 });
  assert.throws(() => room.resume(human.id, {} as WebSocket), /no longer/);
  for (let n = 0; n < 100 && economy.profile(account.id).botGamesPlayed !== 1; n++) await new Promise(r => setTimeout(r, 10));
  assert.equal(economy.profile(account.id).botPoints, 0, 'elimination cannot reduce points below zero');
  assert.equal(economy.profile(account.id).botGamesPlayed, 1);
  assert.equal(room.phase, 'lost', 'a bot-only room stops after its human is removed');

  const f = fixture();
  const bot = f.room.players.find(p => p.companion)!;
  const other = f.room.players.find(p => p.companion && p !== bot)!;
  const fail = (who: string) => {
    for (const c of f.room.trial!.controls) f.room.values.set(c.id, c.ownerId === who ? c.options.find(v => v !== c.target)! : c.target);
    f.room.ready = new Set(f.room.players.map(p => p.id)); check(f.room);
  };
  // Moving a wrong control without confirming must not count as a wrong answer.
  const control = f.room.trial!.controls.find(c => c.ownerId === f.human.id)!;
  f.room.setControl(f.human, control.id, control.options.find(v => v !== control.target)!);
  assert.equal(f.room.publicState().players.find(p => p.id === f.human.id)!.wrongAnswers, 0);
  for (let n = 0; n < 6; n++) fail(bot.id);
  assert.equal(f.room.retunes, 2); assert.equal(f.room.players.length, 3);
  assert(!f.room.players.includes(bot)); assert.equal(f.room.phase, 'playing');
  assert(f.room.trial!.controls.every(c => f.room.players.some(p => p.id === c.ownerId)));
  assert(!Object.hasOwn(f.room.trial!.knows, bot.id));
  assert.notEqual(f.room.turnId, bot.id);
  fail(other.id); retune(f.room); assert.equal(f.room.players.length, 3, 'third retune removes nobody');
  retune(f.room); assert.equal(f.room.players.length, 2, 'fourth retune removes next worst player');
  assert(!f.room.players.includes(other)); assert.equal(f.room.phase, 'playing');
  for (const kind of TRIAL_KINDS) for (const count of [2, 3]) {
    const trial = generateTrial(kind, 'objects', Array.from({ length: count }, (_, i) => `survivor-${i}`));
    const solution = solveFromKnowledge(trial, Object.values(trial.knows), Object.values(trial.hands ?? {}));
    assert(trial.controls.every(c => solution.get(c.id) === c.target), `remaining players can solve ${kind}`);
  }
  assert.equal(economy.profile(account.id).balance, 0, 'bot elimination cannot mint Signals');
  const winner = await economy.identify();
  const w = fixture(); w.human.accountId = winner.id;
  while (w.room.phase === 'playing') {
    for (const c of w.room.trial!.controls) w.room.values.set(c.id, c.target);
    w.room.ready = new Set(w.room.players.map(p => p.id)); check(w.room);
  }
  assert.equal(w.room.phase, 'won');
  for (let n = 0; n < 100 && economy.profile(winner.id).botGamesPlayed !== 1; n++) await new Promise(r => setTimeout(r, 10));
  assert.equal(economy.profile(winner.id).botPoints, 10, 'a completed bot match commits +10');
  assert.equal(economy.profile(winner.id).balance, 0);
  console.log('PASS: +50 words, individual confirmed errors, second/fourth retune elimination, detach/resume rejection, survivor controls and solvability, durable result with a zero floor');
} finally {
  rooms.forEach(room => room.stopTimer());
  await economy.closeAccountStore(); rmSync(directory, { recursive: true, force: true });
}
