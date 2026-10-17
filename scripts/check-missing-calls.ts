// The "Missing" match that got stuck: a vague hint must not lock the bots onto a wrong card,
// "нет" must take it back, and a place on the button grid must be enough to agree.
import assert from 'node:assert/strict';
import type { Glyph } from '../shared/protocol';
import type { WebSocket } from 'ws';
import { Room } from '../server/room';

const options: Glyph[] = ['triangle', 'circle', 'square', 'cross', 'star', 'moon', 'eye', 'key'];
const socket = { OPEN: 1, readyState: 1, send: () => {} } as unknown as WebSocket;
const room = new Room('MISS', true, 'ru');
const human = room.addPlayer('Женя', '#c9c4b8', socket);
room.addCompanions();
room.start(human);
room.stopTimer();
const tick = () => (room as unknown as { tickCompanions(now: number): void }).tickCompanions(Date.now() + 5000);
const say = (text: string) => { room.turnId = human.id; (room as unknown as { turnMessagesLeft: number }).turnMessagesLeft = 3; human.lastChat = 0; room.chatFrom(human, text); tick(); };
const bots = () => room.players.filter((p) => p.companion);
const botValues = () => bots().map((b) => room.values.get(room.trial!.controls.find((c) => c.ownerId === b.id)!.id));
try {
  const players = room.players;
  room.trial = {
    ...room.trial!, kind: 'missing',
    controls: players.map((p, i) => ({ id: 'vote' + i, ownerId: p.id, label: { ru: 'Ваш голос', en: 'Your vote' }, options, target: 'star' })),
    knows: Object.fromEntries(players.map((p) => [p.id, []])),
    hands: { [human.id]: ['square', 'moon', 'triangle'], [players[1].id]: ['cross', 'moon', 'eye'], [players[2].id]: ['cross', 'key', 'circle'], [players[3].id]: ['key', 'triangle', 'moon'] },
  };
  room.values = new Map(room.trial.controls.map((c) => [c.id, null]));
  room.ready.clear();
  // the real "Missing" trial jams nothing extra; drop whatever the random opening trial set
  (room as unknown as { listener: { setJammed(p: RegExp[]): void } }).listener.setJammed([]);

  say('выбирайте ту фигуру которая ночью на небе');
  assert.ok(botValues().every((v) => v !== 'moon'), 'a vague "at night in the sky" does not lock the bots onto the moon');

  say('выбирайте то, чего очень много ночью на небе');
  assert.ok(botValues().every((v) => v === 'star'), 'stars are "many at night in the sky"');

  say('нет, не то');
  tick();
  assert.ok(bots().every((b) => !room.ready.has(b.id)), '"нет" takes the bots\' confirmation back');

  say('нажимайте слева снизу');
  assert.ok(botValues().every((v) => v === 'star'), 'a place on the shared grid is understood');
  assert.ok(bots().every((b) => room.ready.has(b.id)), 'bots confirm the grid answer');
  console.log('PASS: vague hints stay open, "нет" withdraws, grid positions and "many at night" pick the star');
} finally {
  room.stopTimer();
}
