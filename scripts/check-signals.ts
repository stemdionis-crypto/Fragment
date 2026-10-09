import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'fragment-signals-'));
process.env.FRAGMENT_DATA_DIR = directory;
try {
  const { identify, profile, reward, buy, bindWallet, syncPlatform } = await import('../server/economy');
  const a = identify();
  bindWallet(a.id, 'test-wallet-signals');
  assert.equal(reward(a.id, 'practice', true).amount, 0);
  assert.equal(profile(a.id).balance, 0);
  assert.equal(reward(a.id, 'win', false).amount, 10);
  assert.equal(reward(a.id, 'win', false).amount, 0);
  assert.equal(reward(a.id, 'loss', false, false).amount, 3);
  assert.equal(profile(a.id).balance, 13);
  for (let i = 0; i < 8; i++) reward(a.id, 'daily-'+i, false);
  assert.equal(profile(a.id).balance, 50);
  assert.equal(profile(a.id).totalSignalEarned, 50);
  assert.throws(() => buy(a.id, 'operator'), /Signals/);
  const state = { owned: ['classic'] as ['classic'], items: [], equipped: 'classic' as const, loadout: {} };
  const p = syncPlatform('signal-test-user', state, '400', true);
  assert.equal(profile(p.id).balance, 400);
  assert.equal(reward(p.id, 'platform-win', false).amount, 0);
  assert.equal(profile(p.id).balance, 400); // Credited only by an atomic iDos quest claim.
  assert.throws(() => buy(p.id, 'operator'), /Use iDos/);
  const { Room } = await import('../server/room');
  const socket = { OPEN: 1, readyState: 1, send: () => {} } as any;
  const left = identify(); const right = identify();
  const room = new Room('SIGN', false);
  const player = room.addPlayer('Left', '#c9c4b8', socket, false, left.id);
  player.roundMessages = 2;
  room.startedAt = Date.now()-70_000;
  (room as any).roundId = 'solo-test';
  (room as any).recordParticipants(true);
  assert.equal(profile(left.id).balance, 0, 'one human cannot earn');
  const friend = room.addPlayer('Right', '#8d9499', socket, false, right.id);
  friend.roundMessages = 2;
  (room as any).roundId = 'human-test';
  (room as any).recordParticipants(false);
  assert.equal(profile(left.id).balance, 3);
  assert.equal(profile(right.id).balance, 3);
  (room as any).recordParticipants(false);
  assert.equal(profile(right.id).balance, 3, 'room reward is replay-safe');
  room.startedAt = Date.now()-10_000;
  (room as any).roundId = 'short-test';
  (room as any).recordParticipants(true);
  assert.equal(profile(right.id).balance, 3, 'short match cannot earn');
  const store = JSON.parse(readFileSync('idos/store.json', 'utf8'));
  for (const offer of Object.values(store.StoreOffers) as any[]) {
    const entry = offer.Pricing.Options.signal.Cost.Standard.Entries[0];
    assert.equal(entry.Type, 'VirtualCurrency'); assert.equal(entry.CurrencyID, 'SI');
    assert(entry.Amount >= 300);
  }
  const quests = JSON.parse(readFileSync('idos/quests.json', 'utf8'));
  assert.equal(Object.keys(quests.Quests).length, 50);
  for (const quest of Object.values(quests.Quests) as any[]) {
    assert.equal(quest.Reward.Grant.Standard.Entries[0].CurrencyID, 'SI');
    assert.equal(quest.Reward.Grant.Standard.Entries[0].Amount, 1);
  }
  console.log('Signals: bot exclusion, win/loss rewards, replay, daily cap, platform isolation and staged store passed.');
} finally { rmSync(directory, { recursive: true, force: true }); }
