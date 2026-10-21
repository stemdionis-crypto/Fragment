import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
import type { WebSocket } from 'ws';

const directory = mkdtempSync(join(tmpdir(), 'fragment-platform-stakes-'));
process.env.FRAGMENT_DATA_DIR = directory;
delete process.env.DATABASE_URL; delete process.env.RENDER; delete process.env.FRAGMENT_LOCAL_PREVIEW;
const e = await import('../server/economy');
const { executePlatformStake } = await import('../server/idos');
const { Room } = await import('../server/room');
const rooms: InstanceType<typeof Room>[] = [];
const balances = new Map<string, number>();
const customs = new Map<string, Record<string, { Value: string }>>();
const applied = new Set<string>();
let uid = '', mutations = 0, loseReply = false, rejectCredit = false, loseMarker = false;
const handlers: Record<string, (args: unknown, context: unknown) => any> = {};
const fixture = { owned: ['classic'] as const, items: [] as string[], equipped: 'classic' as const, loadout: {}, stakesReady: true };
const state = () => ({ ...fixture, owned: [...fixture.owned] });
const code = readFileSync('idos/cloud-code.js', 'utf8');
runInNewContext(code, { handlers, server: {
  HttpRequest: ({ Url }: { Url: string }) => ({ Success: true, Data: { Ok: true, Body: JSON.stringify(e.platformStakeReceipt(Url.split('/').at(-1)!)) } }),
  GetUserCustomData: () => ({ Success: true, Data: { Internal: customs.get(uid) ?? {} } }),
  SetUserCustomData: (bucket: string, key: string, value: string) => {
    assert.equal(bucket, 'Internal');
    if (loseMarker) { loseMarker = false; return { Success: false }; }
    const row = customs.get(uid) ?? {}; row[key] = { Value: value }; customs.set(uid, row);
    return { Success: true };
  },
  ReadUserData: () => ({ InventoryV2: { VirtualCurrencies: { SI: { Amount: balances.get(uid) } } } }),
  ApplyResourceOperation: ({ Reason, Operation }: any) => {
    const key = uid + ':' + Reason;
    if (applied.has(key)) return { Success: true, Data: {} };
    const debit = Operation.Consume?.Standard.Entries?.[0];
    const credit = Operation.Grant?.Standard.Entries?.[0];
    for (const entry of [debit, credit].filter(Boolean)) {
      assert.equal(entry.Type, 'VirtualCurrency'); assert.equal(entry.CurrencyID, 'SI');
      assert(Number.isSafeInteger(entry.Amount) && entry.Amount > 0);
    }
    if (credit && rejectCredit) return { Success: false, Error: 'temporary grant limit' };
    const n = balances.get(uid)! - (debit?.Amount ?? 0) + (credit?.Amount ?? 0);
    if (n < 0) return { Success: false, Error: 'VC SI: insufficient balance' };
    balances.set(uid, n); applied.add(key); mutations++;
    return { Success: true, Data: Operation };
  },
} });
const call = (async (session: { userId: string }, _module: string, _action: string, body: any) => {
  uid = session.userId;
  const result = handlers.fragmentStake(body.FunctionParameter, { UserID: uid });
  if (loseReply) { loseReply = false; throw new Error('reply lost after commit'); }
  return { FunctionResult: result };
}) as typeof import('../server/idos').platformCall;
e.configureStakeGateway(async (id, receipt) => {
  await e.preparePlatformStakeAttempt(id, receipt);
  return executePlatformStake({ userId: e.profile(id).platform!.userId, ticket: 'test-session-ticket-only' }, receipt, call);
});
const account = async (label: string, ready = true) => {
  balances.set(label, 1000);
  return e.syncPlatform(label, { ...state(), stakesReady: ready }, '1000', true);
};

try {
  const disabled = await account('disabled', false);
  await assert.rejects(e.reserveStake(disabled.id, 'disabled', 100), /unavailable/);
  assert.equal(mutations, 0);
  const a = await account('A'), b = await account('B'), c = await account('C');
  for (const n of [-1, NaN, Infinity, 0.5, 1_000_001]) await assert.rejects(e.reserveStake(a.id, 'invalid', n));
  await e.reserveStake(a.id, 'edit', 100); assert.equal(balances.get('A'), 900);
  const count = mutations;
  await e.reserveStake(a.id, 'edit', 100); assert.equal(mutations, count);
  await e.reserveStake(a.id, 'edit', 150); assert.equal(balances.get('A'), 850);
  await e.reserveStake(a.id, 'edit', 50); assert.equal(balances.get('A'), 950);
  await e.reserveStake(a.id, 'edit', 0); assert.equal(balances.get('A'), 1000);
  await assert.rejects(e.reserveStake(a.id, 'poor', 1001), /Not enough/);
  assert.equal(e.stakeAmount(a.id, 'poor'), 0); assert.equal(balances.get('A'), 1000);

  await Promise.all([e.reserveStake(a.id, 'race-1', 100), assert.rejects(e.reserveStake(a.id, 'race-2', 100), /previous/)]);
  await e.refundStakes('race-1', a.id); assert.equal(balances.get('A'), 1000);
  loseReply = true;
  await assert.rejects(e.reserveStake(a.id, 'lost-reply', 100), /pending/);
  assert.equal(balances.get('A'), 900); assert.equal(e.profile(a.id).signalsSyncPending, true);
  await e.refundStakes('lost-reply', a.id);
  assert.equal(balances.get('A'), 1000); assert.equal(e.profile(a.id).signalsSyncPending, false);
  loseMarker = true;
  await assert.rejects(e.reserveStake(a.id, 'lost-marker', 100), /pending/);
  const once = mutations;
  await e.syncPlatformStakes(a.id); assert.equal(mutations, once, 'platform reason deduplicates a failed journal write');
  await e.refundStakes('lost-marker'); assert.equal(balances.get('A'), 1000);

  await e.reserveStake(a.id, 'match', 100); await e.reserveStake(b.id, 'match', 200); await e.reserveStake(c.id, 'match', 100);
  const receipts = JSON.parse(readFileSync(join(directory, 'profiles.json'), 'utf8')).find((r: any) => r.id === a.id).platformStakeJobs;
  const receipt = receipts.at(-1).id;
  uid = 'B'; assert.throws(() => handlers.fragmentStake({ receipt }, { UserID: 'B' }), /another account/);
  uid = 'A';
  handlers.fragmentStake({ receipt, credit: 999999, currency: 'Main' }, { UserID: 'A' });
  assert.equal(balances.get('A'), 900, 'old/client-modified receipt cannot mint money');
  await e.syncPlatform('A', { ...state(), capturedAt: 1 }, '1000', true);
  assert.equal(e.profile(a.id).balance, 900, 'stale inventory cannot overwrite a confirmed debit');
  await e.activateStakes('match', [{ id: a.id, amount: 100 }, { id: b.id, amount: 200 }, { id: c.id, amount: 100 }]);
  await e.forfeitStake(a.id, 'match');
  rejectCredit = true;
  await e.settleStakes('match', [b.id, c.id]);
  assert.equal(e.profile(b.id).balance, 800); assert.equal(e.profile(b.id).signalsSyncPending, true);
  assert.equal(e.profile(b.id).pendingSignals, 467);
  await assert.rejects(e.reserveStake(b.id, 'blocked', 1), /pending/);
  rejectCredit = false; loseReply = true;
  await e.syncPlatformStakes(b.id);
  await Promise.all([e.settleStakes('match', [b.id, c.id]), e.settleStakes('match', [b.id, c.id])]);
  assert.equal(balances.get('A'), 900); assert.equal(balances.get('B'), 1267); assert.equal(balances.get('C'), 1133);
  assert.equal(e.profile(b.id).lastStakeResult?.payout, 467);
  assert.equal(e.profile(c.id).lastStakeResult?.payout, 233);
  assert.equal(e.profile(a.id).lastStakeResult?.payout, 0);
  await e.refundStakes('match'); assert.equal(balances.get('A'), 900, 'settled loss is not refunded');

  const socket = { OPEN: 1, readyState: 1, send() {} } as unknown as WebSocket;
  const room = new Room('BETS'); rooms.push(room);
  const p = room.addPlayer('A', '#c9c4b8', socket, false, a.id), q = room.addPlayer('B', '#8d9499', socket, false, b.id);
  room.addBot(p); room.addBot(p);
  loseReply = true; await assert.rejects(room.setStake(p, 10), /pending/);
  await assert.rejects(room.begin(p), /confirmation/);
  await e.syncPlatformStakes(a.id);
  await room.setStake(q, 10); await room.begin(p); room.stopTimer(); assert.equal(room.phase, 'playing');
  room.abandon(p); (room as unknown as { win(): void }).win();
  for (let n = 0; n < 150 && e.profile(b.id).reservedSignals; n++) await new Promise(r => setTimeout(r, 10));
  assert.equal(e.profile(b.id).lastStakeResult?.payout, 30);

  // Restart cannot convert a real hold into a cached local refund.
  await e.reserveStake(c.id, 'restart', 70);
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const e=await import('./server/economy.ts');
    const a=await e.syncPlatform('C', {owned:['classic'],items:[],equipped:'classic',loadout:{},stakesReady:true},'1063',true);
    assert.equal(e.profile(a.id).balance,1063); assert.equal(e.profile(a.id).signalsSyncPending,true);
    let balance=1063, calls=0;
    e.configureStakeGateway(async(id,receipt)=>{ const job=e.platformStakeReceipt(receipt); assert.equal(job.kind,'refund'); assert.equal(job.credit,70); balance+=job.credit; calls++; return {applied:true,balance}; });
    await e.syncPlatformStakes(a.id); await e.syncPlatformStakes(a.id);
    assert.equal(calls,1); assert.equal(e.profile(a.id).balance,1133); assert.equal(e.profile(a.id).signalsSyncPending,false);
    await e.closeAccountStore();
  `], { env: process.env, encoding: 'utf8', timeout: 20000 });
  assert.equal(child.status, 0, child.stderr);
  console.log('PASS: platform debits, edits, insufficient balance, ownership, replay, lost replies/markers, pending start guard, proportional payouts, credit retries, stale snapshots, leaver integration and restart refund');
} finally {
  rooms.forEach(r => r.stopTimer()); await e.closeAccountStore(); rmSync(directory, { recursive: true, force: true });
}
