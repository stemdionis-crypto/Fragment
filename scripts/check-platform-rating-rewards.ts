import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
const directory = mkdtempSync(join(tmpdir(), 'fragment-platform-rating-'));
process.env.FRAGMENT_DATA_DIR = directory; delete process.env.DATABASE_URL; delete process.env.RENDER; delete process.env.FRAGMENT_LOCAL_PREVIEW;
const e = await import('../server/economy');
const { claimPlatformBotReward } = await import('../server/idos');
try {
  const a = await e.syncPlatform('platform-rating-test', { owned: ['classic'], items: [], equipped: 'classic', loadout: {} }, '500', true);
  assert.throws(() => e.validatePlatformRatingReward(a.id, 1));
  for (let i = 0; i < 20; i++) await e.recordMatch(a.id, 'win-' + i, true, 90, 'Test', true, true);
  const eligibility = e.validatePlatformRatingReward(a.id, 1);
  assert.equal(e.platformReceipt(eligibility.receipt)?.botRatingPeak, 200);
  assert.throws(() => e.validatePlatformRatingReward(a.id, 2));
  let status = 'Completed', claims = 0, balance = 500;
  const fakeCall = (async (_session: unknown, module: string, action: string) => {
    if (module === 'CloudCode') return {};
    if (action === 'GetUserQuestState') return { State: { PermanentQuests: { fragment_bot_rating_1: { Status: status } } } };
    if (action === 'ClaimQuestReward') { claims++; status = 'Claimed'; balance += 200; throw new Error('reply lost after commit'); }
    if (action === 'GetInventory') return { VirtualCurrencies: { SI: { Amount: balance } } };
    throw new Error('Unexpected API action');
  }) as typeof import('../server/idos').platformCall;
  const session = { userId: 'platform-rating-test', ticket: 'mock-session-ticket-only' };
  const actual = await claimPlatformBotReward(session, eligibility.receipt, 1, fakeCall);
  assert.equal(actual, 700);
  const results = await Promise.all([e.confirmPlatformRatingReward(a.id, 1, actual), e.confirmPlatformRatingReward(a.id, 1, actual)]);
  assert.deepEqual(results.map(r => r.amount), [200, 0]);
  assert.equal(e.profile(a.id).balance, 700); assert.equal(e.profile(a.id).botRewardClaimed, 1);
  assert.equal(await claimPlatformBotReward(session, eligibility.receipt, 1, fakeCall), 700);
  assert.equal(claims, 1, 'platform claim cannot be repeated');
  status = 'Active';
  await assert.rejects(claimPlatformBotReward(session, eligibility.receipt, 1, fakeCall));
  assert.equal(e.profile(a.id).balance, 700, 'a locked platform quest cannot credit a cached balance');
  const handlers: Record<string, (args: unknown, ctx: unknown) => unknown> = {};
  const metrics: unknown[][] = [];
  const receipt = e.platformReceipt(eligibility.receipt)!;
  runInNewContext(readFileSync('idos/cloud-code.js', 'utf8'), { handlers, server: {
    HttpRequest: () => ({Success:true,Data:{Ok:true,Body:JSON.stringify(receipt)}}),
    AddQuestProgress: (...args: unknown[]) => { metrics.push(args); return {Success:true,Data:{}}; },
    GetUserCustomData: () => ({Success:true,Data:{}}), SetUserCustomData: () => ({Success:true,Data:{}}),
  }});
  assert.throws(() => handlers.fragmentMatch({receipt:eligibility.receipt}, {UserID:'another-user'}));
  handlers.fragmentMatch({receipt:eligibility.receipt}, {UserID:'platform-rating-test'});
  assert(metrics.some(m => m[0] === 'fragment_bot_rating_peak' && m[1] === 200));
  console.log('PASS: locked tiers, verified receipt ownership, authoritative SI grant, lost-reply reconciliation, duplicate/parallel claims and quest metrics');
} finally { await e.closeAccountStore(); rmSync(directory, { recursive:true, force:true }); }
