import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { WebSocket } from 'ws';
import type { ServerMessage } from '../shared/protocol';

process.env.FRAGMENT_DATA_DIR = mkdtempSync(resolve(process.env.FRAGMENT_TEST_WORK || '.', 'economy-test-'));
const economy = await import('../server/economy');
const { Room } = await import('../server/room');
const account = economy.identify();
const messages: ServerMessage[] = [];
const socket = { OPEN: 1, readyState: 1, send: (raw: string) => messages.push(JSON.parse(raw)) } as unknown as WebSocket;
assert.throws(() => economy.buy(account.id, 'operator'), /Not enough/);
assert.throws(() => economy.equip(account.id, 'operator'), /not owned/);
assert.throws(() => economy.buy(account.id, 'invalid'), /Unknown/);
const room = new Room('TEST', true, 'ru');
const human = room.addPlayer('Tester', '#c9c4b8', socket);
human.accountId = account.id;
room.addCompanions();
economy.profileListeners.add(() => room.broadcast());
try {
  for (let game = 0; game < 2; game++) {
    room.start(human);
    room.stopTimer();
    for (let trial = 0; trial < 3; trial++) {
      room.turnId = human.id;
      human.lastChat = 0;
      room.chatFrom(human, '…');
      (room as unknown as { tickCompanions(now: number): void }).tickCompanions(Date.now() + 5000);
      const control = room.trial!.controls.find((c) => c.ownerId === human.id)!;
      room.setControl(human, control.id, control.target);
      room.setReady(human, true);
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    assert.equal(room.phase, 'won');
    assert.equal(economy.profile(account.id).balance, (game + 1) * 10);
    room.again(human);
  }
  assert.equal(messages.filter((m) => m.t === 'reward').length, 2);
  assert(messages.filter((m) => m.t === 'state' && m.state.phase === 'won').every((m) => m.t === 'state' && !!m.state.fragment), 'reward updates always include the completed Fragment');
  economy.buy(account.id, 'operator');
  economy.buy(account.id, 'operator');
  assert.equal(economy.profile(account.id).balance, 0, 'repeat purchase does not charge again');
  economy.equip(account.id, 'operator');
  assert.equal(room.publicState().players.find((p) => p.id === human.id)!.skin, 'operator');
  assert.equal(economy.identify(account.token).id, account.id, 'same device restores profile');
  economy.reward(account.id, 'dedup-test', true);
  assert.equal(economy.reward(account.id, 'dedup-test', true).amount, 0);
  for (let i = 0; i < 20; i++) economy.reward(account.id, 'cap-' + i, false);
  assert.equal(economy.profile(account.id).balance, 80, '100 daily earned minus 20 spent');
  const saved = JSON.parse(readFileSync(join(process.env.FRAGMENT_DATA_DIR, 'profiles.json'), 'utf8'));
  assert.equal(saved[0].equipped, 'operator');
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { join } from 'node:path';
    import { identify, profile } from './server/economy.ts';
    const saved = JSON.parse(readFileSync(join(process.env.FRAGMENT_DATA_DIR, 'profiles.json'), 'utf8'));
    const restored = identify(saved[0].token);
    assert.equal(profile(restored.id).equipped, 'operator');
    assert.equal(profile(restored.id).balance, 80);
  `], { encoding: 'utf8' });
  assert.equal(child.status, 0, 'new server process restores the saved profile');
  console.log('PASS: two real practice wins -> 20 Signal -> buy -> equip -> shared player state; insufficient funds, duplicate purchase/reward, daily cap, persistence across processes');
} finally { room.stopTimer(); }
