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
  for (let index = 0; index < 3; index++) {
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
    assert.equal(room.phase, index === 2 ? 'won' : 'playing');
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
