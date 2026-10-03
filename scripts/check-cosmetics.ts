import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { WebSocket } from 'ws';
import { COSMETICS, DEFAULT_ITEMS, EMOTE_COOLDOWN_MS } from '../shared/economy';

process.env.FRAGMENT_DATA_DIR = mkdtempSync(join(tmpdir(), 'fragment-cosmetics-'));
// A real pre-update profile: migration must retain balance, skin and wallet.
writeFileSync(join(process.env.FRAGMENT_DATA_DIR, 'profiles.json'), JSON.stringify([{ id: 'legacy', token: 'old-token', balance: 500, owned: ['classic','operator'], equipped: 'operator', wins: 4, rounds: [], day: '', earnedToday: 0, wallet: 'legacy-wallet' }]));
const economy = await import('../server/economy');
const { Room } = await import('../server/room');
const account = economy.identify('old-token');
assert.equal(account.balance, 500);
assert.equal(account.equipped, 'operator');
assert.equal(account.wallet, 'legacy-wallet');
assert(DEFAULT_ITEMS.every(id => economy.profile(account.id).items.includes(id)));
assert.equal(new Set(COSMETICS.map(i => i.id)).size, COSMETICS.length);
const selections = ['headphones','glasses','table-walnut','wallpaper-botanical','lighting-amber','poster-signal','decor-plant','victory-sparks','emote-wow'];
for (const id of selections) { economy.buyItem(account.id, id); if (!id.startsWith('emote-')) economy.equipItem(account.id, id); }
const balance = economy.profile(account.id).balance;
economy.buyItem(account.id, 'headphones');
assert.equal(economy.profile(account.id).balance, balance);
assert.throws(() => economy.equipItem(account.id,'beanie'), /not owned/);
assert.throws(() => economy.equipItem(account.id,'emote-wow'), /during play/);
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
room.addCompanions(); room.start(host); room.stopTimer();
const now = Date.now; let time = now(); Date.now = () => time;
try {
  const state = room.publicState();
  assert.equal(state.roomStyle?.table,'table-walnut');
  assert.equal(state.players[0].cosmetics?.head,'headphones');
  assert.equal(state.players[0].skin,'operator');
  room.emoteFrom(host,'emote-wow');
  assert.equal(room.publicState().players[0].emote?.id,'emote-wow');
  assert(messages.length > 0);
  assert.throws(() => room.emoteFrom(host,'emote-wave'), /three seconds/);
  time += EMOTE_COOLDOWN_MS - 1;
  assert.throws(() => room.emoteFrom(host,'emote-think'), /three seconds/);
  time++;
  room.emoteFrom(host,'emote-wave');
  assert.equal(room.publicState().players[0].emote?.id,'emote-wave');
  assert.throws(() => room.emoteFrom(host,'emote-love'), /not owned/);
  time += 2501;
  assert.equal(room.publicState().players[0].emote,undefined);
  const other = new Room('NEXT',true,'ru');
  const same = other.addPlayer('Host','#aaa69d',socket); same.accountId = account.id;
  other.addCompanions(); other.start(same); other.stopTimer();
  assert.throws(() => other.emoteFrom(same,'emote-wave'), /three seconds/, 'room switching cannot bypass cooldown');
  const suspicion = room.suspicion;
  time += 500; room.emoteFrom(host,'emote-think');
  assert.equal(room.suspicion,suspicion,'emotes have no puzzle effect');
  economy.equipItem(account.id,'head-none');
  assert.equal(room.publicState().players[0].cosmetics?.head,'head-none');
  const saved = JSON.parse(readFileSync(join(process.env.FRAGMENT_DATA_DIR,'profiles.json'),'utf8'));
  assert(saved.find((a: {id: string}) => a.id === account.id).items.includes('victory-sparks'));
  console.log('PASS: legacy profile migration, every cosmetic category, ownership, duplicate purchase, shared room/character state, emote privacy and cross-room 3s cooldown');
} finally { Date.now = now; room.stopTimer(); }
