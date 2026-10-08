
import { createIDosGamesClient, beginSsoRedirect, readSsoCodeFromUrl } from '@idosgames/core';
import type { ClientMessage } from '../../shared/protocol';
const TITLE = '49HLIN0J';
export const idos = createIDosGamesClient({ titleID: TITLE });
let enabled = false;
let busy = false;
export const platformPrices = new Map<string, number>();
export async function refreshPlatformShop() {
  platformPrices.clear();
  const r = await idos.store.getStorefront({ forceRefresh: true });
  if (!r.ok) return;
  for (const store of r.data.Stores ?? []) for (const section of store.Sections ?? []) for (const slot of section.Slots ?? []) {
    const offer = slot.Offer; const option = offer?.PriceOptions?.find(o => o.OptionID === 'frag');
    const entries = option?.Cost?.Standard?.Entries;
    if (!offer || offer.State?.SoldOut || entries?.length !== 1 || entries[0].Type !== 'CryptoCurrency' || entries[0].CurrencyID !== 'Main') continue;
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
      if (!ready) throw new Error('FRAG is not connected yet / Токен FRAG ещё не подключён');
      const storefront = await idos.store.getStorefront({ forceRefresh: true });
      if (!storefront.ok) throw new Error('iDos shop unavailable / Магазин iDos недоступен');
      let purchased = false;
      for (const store of storefront.data.Stores ?? []) for (const section of store.Sections ?? []) for (const slot of section.Slots ?? []) {
        if (purchased) continue;
        if (slot.Offer?.OfferID !== 'fragment_' + id) continue;
        const option = slot.Offer.PriceOptions?.find(o => o.OptionID === 'frag');
        if (!option || slot.Offer.State?.SoldOut) throw new Error('Offer unavailable / Предложение недоступно');
        const r = await idos.store.purchase(slot.Offer.OfferID, 1, { selectedOptionID: option.OptionID, slot: { storeID: store.StoreID, sectionID: section.SectionID, slotID: slot.SlotID } });
        if (!r.ok) throw new Error('Purchase was not confirmed. Refresh before retrying / Покупка не подтверждена. Обновите профиль перед повтором');
        purchased = true;
        break;
      }
      if (!purchased) throw new Error('FRAG shop is awaiting activation / Магазин FRAG ожидает активации');
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
  const claims = Object.entries(state.data.State?.Cycles?.fragment_daily?.Quests ?? {})
    .filter(([id, q]) => id.startsWith('fragment_reward_') && q.Status === 'Completed')
    .map(([QuestID]) => ({ QuestID, CycleID: 'fragment_daily' }));
  if (claims.length) {
    const claim = await idos.quest.claimQuestRewardsBatch(claims);
    if (!claim.ok || claim.data.some(i => !i.Success)) throw new Error('Reward claim pending / Получение награды ожидает подтверждения');
  }
  const identity = await platformIdentity();
  if (identity) send(identity);
}
