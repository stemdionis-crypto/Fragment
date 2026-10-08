import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WebSocket } from 'ws';

const directory = mkdtempSync(join(tmpdir(), 'fragment-upgrade-'));
process.env.FRAGMENT_DATA_DIR = directory;
const economy = await import('../server/economy');
const { Room } = await import('../server/room');
const socket = { OPEN: 1, readyState: 1, send: () => {} } as unknown as WebSocket;
try {
  const account = economy.identify();
  economy.bindWallet(account.id, 'TestWalletAddress');
  economy.recordMatch(account.id, 'one', true, 142, 'Tester', false);
  economy.recordMatch(account.id, 'one', true, 1, 'Tester', false);
  economy.recordMatch(account.id, 'two', false, 300, 'Tester', false);
  economy.reward(account.id, 'one', false);
  assert.equal(economy.profile(account.id).gamesPlayed, 2);
  assert.equal(economy.profile(account.id).wins, 1);
  assert.equal(economy.profile(account.id).fastestSeconds, 142);
  assert.equal(economy.profile(account.id).totalSignalEarned, 25);
  assert.equal(economy.leaderboard('speed')[0].value, 142);
  assert.equal(economy.leaderboard('signal')[0].value, 25);
  assert.equal(economy.leaderboard('games')[0].value, 2);

  const room = new Room('TEST', true);
  const human = room.addPlayer('Tester', '#c9c4b8', socket);
  room.addCompanions();
  room.start(human);
  room.stopTimer();
  room.turnId = human.id;
  room.turnEndsAt = Date.now() - 120_000;
  room.endsAt = Date.now() + 120_000;
  (room as unknown as { tick(): void }).tick();
  assert.equal(room.turnId, human.id, 'human turn does not expire while match time remains');
  room.pass(human);
  assert.notEqual(room.turnId, human.id, 'pass still advances the turn');
  room.stopTimer();
  console.log('PASS: account stats, leaderboard metrics, completed-match dedupe, unlimited turn and manual pass');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
