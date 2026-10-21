
import { createIDosGamesClient, beginSsoRedirect, readSsoCodeFromUrl } from '@idosgames/core';
import type { ClientMessage } from '../../shared/protocol';
import { SIGNAL_TOPUPS_ENABLED } from '../../shared/economy';
import { popupAuthCode } from './popup-auth-guard';
const TITLE = '49HLIN0J';
export const idos = createIDosGamesClient({ titleID: TITLE });
let enabled = false;
let busy = false;
export const platformPrices = new Map<string, number>();
export let platformFragBalance: string | null = null;
export async function signalPackages() {
  if (!SIGNAL_TOPUPS_ENABLED) return [];
  if (idos.auth.context) {
    const state = await idos.user.getUserState(['InventoryV2']);
    platformFragBalance = state.ok ? idos.data.user.getCryptoCurrencyAmount('Main') : null;
  }
  let r = await idos.store.getStorefront({ forceRefresh: true });
  // Opening the shop also refreshes cosmetics; the SDK throttles adjacent reads.
  // Retry only this read, never the purchase itself.
  if (!r.ok && r.reason === 'throttled') {
    await new Promise(resolve => setTimeout(resolve, 650));
    r = await idos.store.getStorefront({ forceRefresh: true });
  }
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
  return packages.sort((a, b) => a.signals - b.signals);
}
export async function buySignalPackage(offerID: string, expectedFrag: number, expectedSignals: number, send: (m: ClientMessage) => void) {
  if (!SIGNAL_TOPUPS_ENABLED) throw new Error('FRAG top-ups are disabled / Пополнение за FRAG отключено');
  if (busy) return;
  busy = true;
  try {
    const pack = (await signalPackages()).find(p => p.offerID === offerID);
    if (!pack) throw new Error('Package unavailable / Пакет недоступен');
    if (pack.frag !== expectedFrag || pack.signals !== expectedSignals) throw new Error('Package changed; reopen top-ups / Пакет изменился; откройте пополнение снова');
    if (platformFragBalance !== null && Number(platformFragBalance) < pack.frag && !idos.checkout.topUpAvailable) {
      throw new Error(`На игровом балансе iDos ${platformFragBalance} FRAG. Откройте игру на idosgames.com и пополните приложение через кошелёк. / Open the game on idosgames.com and deposit FRAG into the app.`);
    }
    const r = await idos.store.purchase(pack.offerID, 1, { selectedOptionID: 'frag', slot: pack.slot });
    if (!r.ok) {
      const detail = r.error || r.reason;
      throw new Error(`iDos: ${detail}. Покупка не подтверждена; проверьте баланс перед повтором. / Purchase not confirmed; check your balance before retrying.`);
    }
  } finally {
    busy = false;
    // A failed refresh must not replace the actual purchase error.
    try { const identity = await platformIdentity(); if (identity) send(identity); } catch { /* keep the purchase result */ }
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
let loginPopup: Window | null = null;
export const platformAuthPopup = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fragment_auth');
export function runPlatformAuthPopup() {
  const nonce = new URLSearchParams(location.search).get('fragment_auth') ?? '';
  const status = document.createElement('p');
  status.style.cssText = 'padding:40px;color:#d9d3c5;text-align:center';
  document.getElementById('app')!.replaceChildren(status);
  if (!/^[a-f0-9]{32}$/.test(nonce) || !window.opener) {
    status.textContent = 'Откройте вход из игры. / Start sign-in from the game.'; return;
  }
  const hadCode = location.hash.includes('idos_sso=');
  const code = readSsoCodeFromUrl();
  if (code) {
    window.opener.postMessage({ type: 'fragment:idos-sso', nonce, code: code.code }, location.origin);
    status.textContent = 'Возвращаемся в игру. / Returning to the game.';
    window.close();
  } else if (hadCode) status.textContent = 'Повторите вход из игры. / Retry sign-in from the game.';
  else beginSsoRedirect({ titleID: TITLE });
}
export function platformLogin(send: (message: ClientMessage) => void, error: (message: string) => void) {
  if (window.self === window.top) {
    localStorage.setItem('fragment.idos-enabled', 'true');
    beginSsoRedirect({ titleID: TITLE }); return;
  }
  if (loginPopup && !loginPopup.closed) { loginPopup.focus(); return; }
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('fragment_auth', nonce);
  const popup = window.open(url.href, 'fragment-idos-signin', 'popup,width=560,height=720');
  if (!popup) { error('Разрешите всплывающее окно для входа iDos. / Allow the iDos sign-in popup.'); return; }
  loginPopup = popup;
  const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); if (loginPopup === popup) loginPopup = null; };
  const receive = (event: MessageEvent) => {
    const code = popupAuthCode(event, popup, location.origin, nonce);
    if (!code) return;
    cleanup();
    void (async () => {
      const result = await idos.auth.loginWithSsoCode(code);
      if (!result.ok) throw new Error('Не удалось войти в iDos. Повторите вход. / iDos sign-in failed.');
      localStorage.setItem('fragment.idos-enabled', 'true');
      if (idos.auth.context) localStorage.setItem('fragment.idos-user', idos.auth.context.userID);
      const identity = await platformIdentity();
      if (identity) send(identity);
    })().catch(reason => error(reason instanceof Error ? reason.message : 'iDos sign-in failed'));
  };
  const timer = setTimeout(() => { cleanup(); error('Вход не завершён. Повторите попытку. / Sign-in timed out. Please retry.'); }, 180_000);
  window.addEventListener('message', receive);
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
      const inventory = await idos.user.getUserState(['InventoryV2']);
      if (!inventory.ok) throw new Error('Refresh your iDos balance before buying / Не удалось обновить баланс iDos перед покупкой');
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
