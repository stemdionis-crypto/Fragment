
import { createIDosGamesClient, beginSsoRedirect, readSsoCodeFromUrl } from '@idosgames/core';
import type { ClientMessage } from '../../shared/protocol';
import { SIGNAL_TOPUPS_ENABLED } from '../../shared/economy';
const TITLE = '49HLIN0J';
export const idos = createIDosGamesClient({ titleID: TITLE });
let enabled = false;
let busy = false;
export const platformPrices = new Map<string, number>();
export async function signalPackages() {
  if (!SIGNAL_TOPUPS_ENABLED) return [];
  const r = await idos.store.getStorefront({ forceRefresh: true });
  if (!r.ok) throw new Error('iDos shop unavailable / Магазин iDos недоступен');
  const packages = [];
  for (const store of r.data.Stores ?? []) for (const section of store.Sections ?? []) for (const slot of section.Slots ?? []) {
    const offer = slot.Offer;
    if (!offer?.OfferID.startsWith('fragment_signal_pack_') || offer.State?.SoldOut) continue;
    const option = offer.PriceOptions?.find(o => o.OptionID === 'frag');
    const cost = option?.Cost?.Standard?.Entries;
    const grants = offer.Rewards?.Standard?.Entries;
    if (cost?.length !== 1 || cost[0].Type !== 'CryptoCurrency' || cost[0].CurrencyID !== 'Main' || grants?.length !== 1 || grants[0].Type !== 'VirtualCurrency' || grants[0].CurrencyID !== 'SI') continue;
    const frag = Number(cost[0].Amount); const signals = Number(grants[0].Amount);
    if (!Number.isFinite(frag) || frag <= 0 || !Number.isSafeInteger(signals) || signals <= 0) continue;
    packages.push({ offerID: offer.OfferID, frag, signals, slot: { storeID: store.StoreID, sectionID: section.SectionID, slotID: slot.SlotID } });
  }
  return packages;
}
export async function buySignalPackage(offerID: string, expectedFrag: number, expectedSignals: number, send: (m: ClientMessage) => void) {
  if (!SIGNAL_TOPUPS_ENABLED) throw new Error('FRAG top-ups are disabled / Пополнение за FRAG отключено');
  if (busy) return;
  busy = true;
  try {
    const pack = (await signalPackages()).find(p => p.offerID === offerID);
    if (!pack) throw new Error('Package unavailable / Пакет недоступен');
    if (pack.frag !== expectedFrag || pack.signals !== expectedSignals) throw new Error('Package changed; reopen top-ups / Пакет изменился; откройте пополнение снова');
    const r = await idos.store.purchase(pack.offerID, 1, { selectedOptionID: 'frag', slot: pack.slot });
    if (!r.ok) throw new Error('Purchase not confirmed; refresh your profile / Покупка не подтверждена; обновите профиль');
  } finally {
    busy = false;
    const identity = await platformIdentity(); if (identity) send(identity);
  }
}
export async function refreshPlatformShop() {
  platformPrices.clear();
  const r = await idos.store.getStorefront({ forceRefresh: true });
  if (!r.ok) return;
  for (const store of r.data.Stores ?? []) for (const section of store.Sections ?? []) for (const slot of section.Slots ?? []) {
    const offer = slot.Offer; const option = offer?.PriceOptions?.find(o => o.OptionID === 'signal');
    const entries = option?.Cost?.Standard?.Entries;
    if (!offer || offer.State?.SoldOut || entries?.length !== 1 || entries[0].Type !== 'VirtualCurrency' || entries[0].CurrencyID !== 'SI') continue;
    const price = entries[0].Amount;
    if (typeof price === 'number' && Number.isSafeInteger(price) && price > 0) platformPrices.set(offer.OfferID.replace(/^fragment_/, ''), price);
  }
}
export function platformLogin() {
  localStorage.setItem('fragment.idos-enabled', 'true');
  beginSsoRedirect({ titleID: TITLE });
}
export async function platformIdentity(): Promise<ClientMessage | null> {
  const code = readSsoCodeFromUrl();
  enabled = Boolean(code || localStorage.getItem('fragment.idos-enabled') === 'true');
  if (!enabled) return null;
  if (code) {
    const r = await idos.auth.loginWithSsoCode(code.code);
    if (!r.ok) throw new Error('iDos login failed / Не удалось войти в iDos');
  } else if (!idos.auth.context) {
    const r = await idos.auth.autoLogin();
    if (!r.ok) throw new Error('Sign in to iDos again / Войдите в iDos снова');
  }
  await refreshPlatformShop();
  const context = idos.auth.context;
  if (!context) throw new Error('iDos session missing');
  const expected = localStorage.getItem('fragment.idos-user');
  if (!code && expected && expected !== context.userID) throw new Error('Sign in to your iDos account again / Войдите в свой аккаунт iDos снова');
  localStorage.setItem('fragment.idos-user', context.userID);
  return { t: 'idos_identify', userId: context.userID, ticket: context.clientSessionTicket };
}
export async function platformAction(action: string, id: string, ready: boolean, send: (m: ClientMessage) => void) {
  if (busy) return;
  busy = true;
  try {
    if (action.startsWith('buy')) {
      if (!ready) throw new Error('Signals economy is not active / Экономика Сигналов ещё не активна');
      const storefront = await idos.store.getStorefront({ forceRefresh: true });
      if (!storefront.ok) throw new Error('iDos shop unavailable / Магазин iDos недоступен');
      let purchased = false;
      for (const store of storefront.data.Stores ?? []) for (const section of store.Sections ?? []) for (const slot of section.Slots ?? []) {
        if (purchased) continue;
        if (slot.Offer?.OfferID !== 'fragment_' + id) continue;
        const option = slot.Offer.PriceOptions?.find(o => o.OptionID === 'signal');
        if (!option || slot.Offer.State?.SoldOut) throw new Error('Offer unavailable / Предложение недоступно');
        const r = await idos.store.purchase(slot.Offer.OfferID, 1, { selectedOptionID: option.OptionID, slot: { storeID: store.StoreID, sectionID: section.SectionID, slotID: slot.SlotID } });
        if (!r.ok) throw new Error('Purchase was not confirmed. Refresh before retrying / Покупка не подтверждена. Обновите профиль перед повтором');
        purchased = true;
        break;
      }
      if (!purchased) throw new Error('Signals shop awaits activation / Магазин Сигналов ожидает активации');
    } else {
      const r = await idos.cloudCode.execute('fragmentEquip', { id });
      if (!r.ok || r.data.Error) throw new Error('Item could not be equipped / Не удалось надеть предмет');
    }
  } finally {
    busy = false;
    const identity = await platformIdentity();
    if (identity) send(identity);
  }
}
export async function platformReward(receipt: string, send: (m: ClientMessage) => void) {
  const r = await idos.cloudCode.execute('fragmentMatch', { receipt });
  if (!r.ok || r.data.Error) throw new Error('Reward pending / Награда ожидает подтверждения');
  const state = await idos.quest.getUserQuestState();
  if (!state.ok) throw new Error('Reward state unavailable');
  const claims = Object.entries(state.data.State?.Cycles?.fragment_signals_daily?.Quests ?? {})
    .filter(([id, q]) => id.startsWith('fragment_reward_') && q.Status === 'Completed')
    .map(([QuestID]) => ({ QuestID, CycleID: 'fragment_signals_daily' }));
  if (claims.length) {
    const claim = await idos.quest.claimQuestRewardsBatch(claims);
    if (!claim.ok || claim.data.some(i => !i.Success)) throw new Error('Reward claim pending / Получение награды ожидает подтверждения');
  }
  const identity = await platformIdentity();
  if (identity) send(identity);
}
