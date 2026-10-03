import { TRIAL_KINDS } from '../server/puzzle';
import { TRIALS_PER_GAME } from '../shared/protocol';
import assert from 'node:assert/strict';
import type { WebSocket } from 'ws';
import type { ServerMessage } from '../shared/protocol';
import { Room } from '../server/room';

// Run with --prod to verify that built-in companions do not rely on debug bots.
const messages: ServerMessage[] = [];
const socket = { OPEN: 1, readyState: 1, send: (raw: string) => messages.push(JSON.parse(raw)) } as unknown as WebSocket;
const room = new Room('TEST', true, 'ru');
const human = room.addPlayer('Tester', '#c9c4b8', socket);
room.addCompanions();
room.addCompanions();
assert.equal(room.players.length, 3, 'exactly two companions');
assert.equal(room.hostId, human.id, 'human remains host');
assert.equal(room.publicState().players.filter((p) => p.bot && p.connected).length, 2);
assert.throws(() => room.resume(room.players[1].id, socket), /Cannot resume a bot/);
room.start(human);
room.stopTimer();

const botTick = (now: number) => (room as unknown as { tickCompanions(now: number): void }).tickCompanions(now);
try {
  for (let index = 0; index < TRIALS_PER_GAME; index++) {
    const trial = room.trial!;
    const privateMsg = messages.filter((m) => m.t === 'private').at(-1);
    assert.ok(privateMsg?.t === 'private' && !privateMsg.info.targets, 'human never receives debug answers');
    room.turnId = human.id;
    botTick(Date.now() + 5000);
    assert.equal(room.ready.size, 0, 'bots wait for human participation');
    human.lastChat = 0;
    room.chatFrom(human, '…');
    botTick(Date.now() + 5000);
    assert.equal(room.ready.size, 2, 'both bots set their controls and confirm');
    const control = trial.controls.find((c) => c.ownerId === human.id)!;
    room.setControl(human, control.id, control.target);
    room.setReady(human, true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.equal(room.phase, index === TRIALS_PER_GAME - 1 ? 'won' : 'playing');
    console.log(`ok   practice trial ${index + 1}: ${trial.kind}`);
  }
  assert.ok(room.fragment);
  room.again(human);
  assert.equal(room.players.length, 3, 'companions remain for replay');
  room.start(human);
  room.stopTimer();
  assert.equal(room.phase, 'playing');
  room.disconnect(human);
  assert.ok(room.emptySince, 'offline practice room can be cleaned up');
  console.log('ok   replay, private answers, host, disconnect cleanup');
} finally {
  room.stopTimer();
}

// Every rule must work with production companions, not only the random five above.
for (const kind of TRIAL_KINDS) {
  const testRoom = new Room('RULE', true, 'ru');
  const player = testRoom.addPlayer('Tester', '#c9c4b8', socket);
  testRoom.addCompanions();
  testRoom.start(player);
  testRoom.stopTimer();
  try {
    testRoom.plan[0].kind = kind;
    (testRoom as unknown as { setupTrial(): void }).setupTrial();
    assert(!('target' in testRoom.publicState().trial!.controls[0]));
    assert(!('clue' in testRoom.publicState().trial!.controls[0]));
    player.lastChat = 0;
    testRoom.turnId = player.id;
    testRoom.chatFrom(player, '…');
    (testRoom as unknown as { tickCompanions(now: number): void }).tickCompanions(Date.now() + 5000);
    assert.equal(testRoom.ready.size, 2, `companions confirm ${kind}`);
    testRoom.trial!.controls.filter(c => c.ownerId !== player.id).forEach(c => {
      assert.equal(testRoom.values.get(c.id), c.target, `companion sets ${kind}`);
    });
  } finally { testRoom.stopTimer(); }
}
console.log('ok   all twenty rules with production companions and public clue privacy');
