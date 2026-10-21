
import type { UserInventoryState, CurrencyDefinitions, GetUserQuestStateResponse } from '@idosgames/core';
import { SKINS, COSMETICS, DEFAULT_ITEMS, DEFAULT_LOADOUT, type Loadout } from '../shared/economy';
const TITLE = '49HLIN0J';
export interface PlatformSession { userId: string; ticket: string }
export async function platformCall<T>(session: PlatformSession, module: string, action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(session.userId) || typeof session.ticket !== 'string' || session.ticket.length < 16 || session.ticket.length > 8192) throw new Error('Invalid iDos session');
  const response = await fetch('https://api.idosgames.com/api/v2/' + TITLE + '/Client/' + module + '/' + action + '/' + session.userId, {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.ticket, 'X-IG-Platform': 'Web' },
    body: JSON.stringify({ ...body, UserID: session.userId, ClientSessionTicket: session.ticket }),
  });
  if (!response.ok) throw new Error(`iDos ${module}/${action}: HTTP ${response.status}. Sign in again / Войдите в iDos снова`);
  const result = await response.json() as { Success: boolean; Data: T };
  if (!result.Success || result.Data == null) throw new Error('iDos rejected the request / iDos отклонил запрос');
  return result.Data;
}
export function inventoryLook(inventory: UserInventoryState, saved: { equipped?: string; loadout?: Loadout }) {
  const has = (id: string) => (inventory.Items?.['fragment_' + id]?.TotalAmount ?? 0) > 0;
  const owned = SKINS.filter(s => s.price === 0 || has(s.id)).map(s => s.id);
  const items = COSMETICS.filter(i => DEFAULT_ITEMS.includes(i.id) || has(i.id)).map(i => i.id);
  const loadout: Loadout = { ...DEFAULT_LOADOUT };
  for (const i of COSMETICS) if (items.includes(i.id) && saved.loadout?.[i.category] === i.id) loadout[i.category] = i.id;
  return { owned, items, loadout, equipped: owned.find(id => id === saved.equipped) ?? 'classic' as const };
}
export async function platformSnapshot(session: PlatformSession) {
  const capturedAt = Date.now();
  const inventory = await platformCall<UserInventoryState>(session, 'User', 'GetInventory');
  const cloud = await platformCall<{ Error?: unknown; FunctionResult?: { stakesReady?: boolean; nickname?: string; equipped?: string; loadout?: Loadout; stats?: { wins: number; gamesPlayed: number; fastestSeconds: number | null; totalSignalsEarned: number } } }>(session, 'CloudCode', 'Execute', { FunctionName: 'fragmentProfile' });
  if (cloud.Error || !cloud.FunctionResult) throw new Error('iDos profile service unavailable / Профиль iDos недоступен');
  const currencies = await platformCall<CurrencyDefinitions>(session, 'Title', 'GetCurrencyDefinitions');
  const ready = process.env.FRAGMENT_SIGNALS_ENABLED === 'true' && currencies.VirtualCurrencies?.SI?.Status === 'Active';
  const signals = inventory.VirtualCurrencies?.SI?.Amount ?? 0;
  const quests = ready ? await platformCall<GetUserQuestStateResponse>(session, 'Quest', 'GetUserQuestState') : null;
  const cycle = quests?.State?.Cycles?.fragment_signals_daily;
  const today = new Date().toISOString().slice(0, 10);
  const earnedToday = cycle?.CycleStartUtc?.slice(0, 10) === today ? Math.max(0, ...Object.values(cycle.Quests ?? {}).map(q => q.Objectives?.verified?.CurrentValue ?? 0)) : 0;
  if (!Number.isSafeInteger(Number(signals)) || Number(signals) < 0) throw new Error('Invalid Signals balance');
  return { capturedAt, stakesReady: ready && process.env.FRAGMENT_STAKES_ENABLED === 'true' && cloud.FunctionResult.stakesReady === true, nickname: cloud.FunctionResult.nickname, earnedToday: Math.min(50, earnedToday), stats: cloud.FunctionResult.stats, ...inventoryLook(inventory, cloud.FunctionResult), balance: ready ? String(signals) : '0', ready };
}

export async function executePlatformStake(session: PlatformSession, receipt: string, call = platformCall) {
  if (!/^[a-f0-9]{64}$/.test(receipt)) throw new Error('Invalid stake receipt');
  const result = await call<{ Error?: unknown; FunctionResult?: import('./economy').PlatformStakeReply }>(session, 'CloudCode', 'Execute', { FunctionName: 'fragmentStake', FunctionParameter: { receipt } });
  const value = result.FunctionResult;
  if (result.Error || !value || typeof value.applied !== 'boolean' || (value.rejected !== undefined && typeof value.rejected !== 'boolean') || (value.applied && value.rejected) || !Number.isSafeInteger(value.balance) || value.balance < 0) throw new Error('iDos stake confirmation pending');
  return value;
}

// The platform owns the grant and replay protection. Never credit a cached snapshot.
export async function claimPlatformBotReward(session: PlatformSession, receipt: string, tier: number, call = platformCall): Promise<number> {
  const confirmed = await call<{ Error?: unknown }>(session, 'CloudCode', 'Execute', { FunctionName: 'fragmentMatch', FunctionParameter: { receipt } });
  if (confirmed.Error) throw new Error('Rating confirmation pending / Рейтинг ожидает подтверждения');
  const questID = 'fragment_bot_rating_' + tier;
  const readStatus = async () => (await call<GetUserQuestStateResponse>(session, 'Quest', 'GetUserQuestState')).State?.PermanentQuests?.[questID]?.Status;
  const status = await readStatus();
  if (status !== 'Claimed') {
    if (status !== 'Completed') throw new Error('Rating reward is locked / Награда ещё недоступна');
    try { await call(session, 'Quest', 'ClaimQuestReward', { QuestID: questID }); }
    catch { /* A reply may be lost after commit. Reconcile authoritative state below. */ }
    if (await readStatus() !== 'Claimed') throw new Error('iDos reward not confirmed / iDos не подтвердил награду');
  }
  const inventory = await call<UserInventoryState>(session, 'User', 'GetInventory');
  const balance = Number(inventory.VirtualCurrencies?.SI?.Amount ?? 0);
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Invalid iDos balance');
  return balance;
}
