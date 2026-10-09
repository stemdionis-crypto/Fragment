
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
  if (!response.ok) throw new Error('iDos request failed; sign in again / Войдите в iDos снова');
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
  const inventory = await platformCall<UserInventoryState>(session, 'User', 'GetInventory');
  const cloud = await platformCall<{ Error?: unknown; FunctionResult?: { nickname?: string; equipped?: string; loadout?: Loadout; stats?: { wins: number; gamesPlayed: number; fastestSeconds: number | null; totalSignalsEarned: number } } }>(session, 'CloudCode', 'Execute', { FunctionName: 'fragmentProfile' });
  if (cloud.Error || !cloud.FunctionResult) throw new Error('iDos profile service unavailable / Профиль iDos недоступен');
  const currencies = await platformCall<CurrencyDefinitions>(session, 'Title', 'GetCurrencyDefinitions');
  const ready = process.env.FRAGMENT_SIGNALS_ENABLED === 'true' && currencies.VirtualCurrencies?.SI?.Status === 'Active';
  const signals = inventory.VirtualCurrencies?.SI?.Amount ?? 0;
  const quests = ready ? await platformCall<GetUserQuestStateResponse>(session, 'Quest', 'GetUserQuestState') : null;
  const cycle = quests?.State?.Cycles?.fragment_signals_daily;
  const today = new Date().toISOString().slice(0, 10);
  const earnedToday = cycle?.CycleStartUtc?.slice(0, 10) === today ? Math.max(0, ...Object.values(cycle.Quests ?? {}).map(q => q.Objectives?.verified?.CurrentValue ?? 0)) : 0;
  if (!Number.isSafeInteger(Number(signals)) || Number(signals) < 0) throw new Error('Invalid Signals balance');
  return { nickname: cloud.FunctionResult.nickname, earnedToday: Math.min(50, earnedToday), stats: cloud.FunctionResult.stats, ...inventoryLook(inventory, cloud.FunctionResult), balance: ready ? String(signals) : '0', ready };
}
