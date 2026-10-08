
import type { UserInventoryState, CurrencyDefinitions } from '@idosgames/core';
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
  const cloud = await platformCall<{ Error?: unknown; FunctionResult?: { equipped?: string; loadout?: Loadout; stats?: { wins: number; gamesPlayed: number; fastestSeconds: number | null; totalEarned: number } } }>(session, 'CloudCode', 'Execute', { FunctionName: 'fragmentProfile' });
  if (cloud.Error || !cloud.FunctionResult) throw new Error('iDos profile service unavailable / Профиль iDos недоступен');
  const currencies = await platformCall<CurrencyDefinitions>(session, 'Title', 'GetCurrencyDefinitions');
  const main = currencies.CryptoCurrencies?.Main;
  const mint = process.env.FRAGMENT_FRAG_MINT;
  const ready = Boolean(mint && process.env.FRAGMENT_IDOS_ECONOMY_ENABLED === 'true' && main?.DisplayName === 'FRAG' &&
    main.Networks?.some(n => n.NetworkID === 'solana' && n.ContractAddress === mint));

  return { stats: cloud.FunctionResult.stats, ...inventoryLook(inventory, cloud.FunctionResult), balance: ready ? inventory.CryptoCurrencies?.Main?.Amount ?? '0' : '0', ready };
}
