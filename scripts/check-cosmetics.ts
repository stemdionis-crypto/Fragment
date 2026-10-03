import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { WebSocket } from 'ws';
import { COSMETICS, DEFAULT_ITEMS } from '../shared/economy';

process.env.FRAGMENT_DATA_DIR = mkdtempSync(join(tmpdir(), 'fragment-cosmetics-'));
// A real pre-update profile: migration must retain balance, skin and wallet.
writeFileSync(join(process.env.FRAGMENT_DATA_DIR, 'profiles.json'), JSON.stringify([{ id: 'legacy', token: 'old-token', balance: 500, owned: ['classic','operator'], equipped: 'operator', items: ['emote-wow','emote-love'], wins: 4, rounds: [], day: '', earnedToday: 0, wallet: 'legacy-wallet' }]));
const economy = await import('../server/economy');
const { Room } = await import('../server/room');
const account = economy.identify('old-token');
assert.equal(account.balance, 540, 'retired paid emotes refunded');
assert.equal(JSON.parse(readFileSync(join(process.env.FRAGMENT_DATA_DIR, 'profiles.json'), 'utf8'))[0].balance, 540, 'refund persisted once');
assert(!account.items.some(id => id.startsWith('emote-')));
assert.equal(account.equipped, 'operator');
assert.equal(account.wallet, 'legacy-wallet');
assert(DEFAULT_ITEMS.every(id => economy.profile(account.id).items.includes(id)));
assert.equal(new Set(COSMETICS.map(i => i.id)).size, COSMETICS.length);
const selections = ['headphones','mask-skull','table-walnut','wallpaper-botanical','lighting-amber','poster-signal','decor-plant','victory-sparks'];
for (const id of selections) { economy.buyItem(account.id, id); economy.equipItem(account.id, id); }
const balance = economy.profile(account.id).balance;
economy.buyItem(account.id, 'headphones');
assert.equal(economy.profile(account.id).balance, balance);
assert.throws(() => economy.equipItem(account.id,'beanie'), /not owned/);
assert.throws(() => economy.buyItem(account.id,'emote-wow'), /Unknown/);
assert.throws(() => economy.buyItem(account.id,'invalid'), /Unknown/);
const guest = economy.identify();
assert.throws(() => economy.buyItem(guest.id,'headphones'), /Not enough/);
const copy = economy.profile(account.id); copy.items.length = 0; copy.loadout.head = 'fake';
assert(economy.profile(account.id).items.includes('headphones'));
assert.equal(economy.profile(account.id).loadout.head,'headphones');

const messages: unknown[] = [];
const socket = { OPEN: 1, readyState: 1, send: (raw: string) => messages.push(JSON.parse(raw)) } as unknown as WebSocket;
const room = new Room('SHOP', true, 'ru');
const host = room.addPlayer('Host','#aaa69d',socket); host.accountId = account.id;
const peerMessages: {t: string; state?: {players: {cosmetics?: {face?: string}}[]}}[] = [];
const peerSocket = { OPEN: 1, readyState: 1, send: (raw: string) => peerMessages.push(JSON.parse(raw)) } as unknown as WebSocket;
const peer = room.addPlayer('Peer','#aaa69d',peerSocket); peer.accountId = guest.id;
room.addCompanions(); room.start(host); room.stopTimer();
try {
  const state = room.publicState();
  assert.equal(state.roomStyle?.table,'table-walnut');
  assert.equal(state.players[0].cosmetics?.head,'headphones');
  assert.equal(state.players[0].skin,'operator');
  assert.equal(state.players[0].cosmetics?.face,'mask-skull');
  economy.equipItem(account.id,'face-none');
  assert.equal(room.publicState().players[0].cosmetics?.face,'face-none');
  room.broadcast();
  assert.equal(peerMessages.filter(m => m.t === 'state').at(-1)?.state?.players[0].cosmetics?.face,'face-none', 'peer sees restored face');
  assert(!('emote' in state.players[0]));
  economy.equipItem(account.id,'head-none');
  assert.equal(room.publicState().players[0].cosmetics?.head,'head-none');
  const saved = JSON.parse(readFileSync(join(process.env.FRAGMENT_DATA_DIR,'profiles.json'),'utf8'));
  assert(saved.find((a: {id: string}) => a.id === account.id).items.includes('victory-sparks'));
  const restored = spawnSync(process.execPath, ['--import','tsx','--input-type=module','-e', `
    import assert from 'node:assert/strict';
    import { identify } from './server/economy.ts';
    assert.equal(identify('old-token').balance, ${balance}, 'refund is not repeated on restart');
  `], { encoding: 'utf8' });
  assert.equal(restored.status,0,restored.stderr);
  console.log('PASS: legacy profile migration, every cosmetic category, ownership, duplicate purchase, shared room/character state, mask replacement slots and retired-emote refunds');
} finally { room.stopTimer(); }
