import assert from 'node:assert/strict';
import type { WebSocket } from 'ws';
import { MAX_PLAYERS } from '../shared/protocol';
import { TRIAL_KINDS } from '../server/puzzle';
import { Room } from '../server/room';

const socket = { OPEN: 1, readyState: 1, send: () => {} } as unknown as WebSocket;
const room = new Room('TEAM', false, 'ru');
const host = room.addPlayer('Host', '#c9c4b8', socket);
assert.throws(() => room.addBot(host), /Invite one friend/);
const friend = room.addPlayer('Friend', '#8d9499', socket);
assert.throws(() => room.addBot(friend), /Only the host/);
room.addBot(host);
room.addBot(host);
assert.equal(room.players.length, MAX_PLAYERS);
assert.equal(room.players.filter((p) => p.companion).length, 2);
assert.throws(() => room.addBot(host), /full/);
const bot = room.players.find((p) => p.companion)!;
assert.throws(() => room.removeBot(friend, bot.id), /Only the host/);
room.removeBot(host, bot.id);
assert.equal(room.players.length, 3);
room.addBot(host);
const third = room.addPlayer('Third friend', '#7d93a3', socket);
assert.equal(room.players.length, MAX_PLAYERS, 'a late human replaces one bot');
assert.equal(room.players.filter((p) => p.companion).length, 1);
assert(room.players.includes(third));
const walletRoom = new Room('WALL', false, 'ru');
const walletOwner = walletRoom.addPlayer('Wallet owner', '#c9c4b8', socket);
walletOwner.accountId = 'same-account';
assert.throws(() => walletRoom.addPlayer('Second tab', '#8d9499', socket, false, 'same-account'), /already in the room/);
room.start(host);
room.stopTimer();
assert.equal(room.phase, 'playing');
assert.throws(() => room.addBot(host), /Only the host/);

try {
  for (const kind of TRIAL_KINDS) {
    room.plan[0].kind = kind;
    (room as unknown as { setupTrial(): void }).setupTrial();
    assert.equal(room.publicState().players.length, 4);
    room.turnId = host.id;
    host.lastChat = 0;
    room.chatFrom(host, '…');
    (room as unknown as { tickCompanions(now: number): void }).tickCompanions(Date.now() + 5000);
    const companion = room.players.find((p) => p.companion)!;
    assert(room.ready.has(companion.id), `friend-room bot confirms ${kind}`);
    for (const control of room.trial!.controls.filter((c) => c.ownerId === companion.id)) {
      assert.equal(room.values.get(control.id), control.target, `friend-room bot sets ${kind}`);
    }
  }
  console.log('ok   friend lobby: 2 humans + bots, host controls, human replacement, all fifteen trials');
} finally {
  room.stopTimer();
}
