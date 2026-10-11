import { idos, platformAction, platformPrices, platformFragBalance, refreshPlatformShop, signalPackages, buySignalPackage } from './idos';
import { SKINS, COSMETICS, CATEGORY_NAMES, SIGNAL_TOPUPS_ENABLED, type CosmeticCategory, type ProfileView } from '../../shared/economy';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';
import { lang } from './i18n';
import { skinPortrait, sceneSvg } from './scene';

let account: ProfileView | null = null;
let launcher: HTMLButtonElement;
let dialog: HTMLDialogElement;
let send: (message: ClientMessage) => void;
let lastReward = 0;
let pending = false;
let section = 'characters';
let selected = 'classic';
const sections = ['characters', 'accessories', 'room', 'victory', 'signals'];
const sectionNames: Record<string, string[]> = { characters: ['Персонажи','Characters'], accessories: ['Аксессуары','Accessories'], room: ['Комната','Room'], victory: ['Победа','Victory'], signals: ['Сигналы','Signals'] };
// The same token artwork used by the title's public iDos page.
const fragIcon = 'https://cloud.idosgames.com/drive/img/49HLIN0J/hard-token.png?v=63927080354';
const signalMark = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="M17 28v8m10-15v22m10-28v34m10-24v14"/></svg>';
let packages: Awaited<ReturnType<typeof signalPackages>> | null = null;
let loadingPackages = false;
let payingOffer: string | null = null;
let topupStatus = '';
const number = (value: number) => new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US').format(value);
const shopTabs = () => `<nav class="shop-tabs" aria-label="${words().shop}">${sections.map(id => `<button data-section="${id}" aria-pressed="${section === id}" ${payingOffer ? 'disabled' : ''}>${sectionNames[id][lang === 'ru' ? 0 : 1]}</button>`).join('')}</nav>`;
function bindShopNavigation() {
  dialog.querySelector<HTMLButtonElement>('#shop-close')!.onclick = () => dialog.close();
  dialog.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(b => b.onclick = () => {
    if (payingOffer) return;
    section = b.dataset.section!;
    if (section === 'signals') { packages = null; topupStatus = ''; }
    render(); dialog.scrollTop = 0;
  });
}
async function loadSignalPackages() {
  if (loadingPackages || payingOffer) return;
  loadingPackages = true;
  try { packages = await signalPackages(); }
  catch (error) { packages = []; topupStatus = error instanceof Error ? error.message : 'iDos unavailable'; }
  finally { loadingPackages = false; if (section === 'signals') render(); }
}
function renderSignals() {
  const ru = lang === 'ru';
  const ready = Boolean(account?.platform?.ready && SIGNAL_TOPUPS_ENABLED);
  dialog.innerHTML = `<div class="settings-heading"><div><p class="eyebrow">FRAGMENT · ${ru ? 'КОЛЛЕКЦИЯ' : 'COLLECTION'}</p><h2 id="shop-title">${words().shop}</h2></div><button id="shop-close" aria-label="${words().close}">×</button></div>
    <div class="shop-summary"><p class="shop-balance">${words().balance}: <b>${number(account?.balance ?? 0)} ${words().currency}</b></p></div>${shopTabs()}
    <section class="signals-shop" aria-labelledby="signals-title">
      <p class="fine">${ru ? 'Игровой баланс в iDos' : 'In-game iDos balance'}: <b>${platformFragBalance === null ? '—' : number(Number(platformFragBalance))} FRAG</b></p>
      <div class="signals-intro"><div><p class="eyebrow">${ru ? 'НАСТРОЙСЯ НА СВОЮ ВОЛНУ' : 'FIND YOUR FREQUENCY'}</p><h3 id="signals-title">${ru ? 'Больше Сигналов. Больше образов.' : 'More Signals. More looks.'}</h3><p>${ru ? 'Выбери пакет и пополни баланс для скинов, аксессуаров и оформления комнаты.' : 'Pick a pack for skins, accessories and room decor.'}</p></div><div class="signals-token"><img src="${fragIcon}" alt="FRAG" width="52" height="52"><span>FRAG <span aria-hidden="true">→</span> ${ru ? 'Сигналы' : 'Signals'}</span></div></div>
      <div class="signal-packs" aria-busy="${loadingPackages || (ready && !packages) || Boolean(payingOffer)}">${ready ? (packages ?? []).map((pack, index) => `<article class="signal-pack"><p class="eyebrow">${ru ? 'ПАКЕТ' : 'PACK'} ${String(index + 1).padStart(2, '0')}</p><div class="signal-pack-art">${signalMark}</div><h4>${number(pack.signals)}</h4><p class="signal-pack-unit">${ru ? 'Сигналов' : 'Signals'}</p><div class="signal-pack-price"><img src="${fragIcon}" alt="" width="24" height="24"><span>${number(pack.frag)} <b>FRAG</b></span></div><button type="button" data-pack="${pack.offerID}" ${payingOffer ? 'disabled' : ''} aria-label="${ru ? 'Купить' : 'Buy'} ${number(pack.signals)} ${ru ? 'Сигналов за' : 'Signals for'} ${number(pack.frag)} FRAG">${payingOffer === pack.offerID ? (ru ? 'Ожидаем оплату…' : 'Awaiting payment…') : words().buy}<span aria-hidden="true">↗</span></button></article>`).join('') : ''}</div>
      <p id="topup-feedback" class="signals-feedback" role="status"></p><button id="topup-retry" class="signals-retry" ${!ready || !packages || loadingPackages || payingOffer ? 'hidden' : ''}>${ru ? 'Обновить пакеты' : 'Refresh packs'}</button>
      ${!idos.checkout.topUpAvailable ? `<p><a class="signal-platform-link" href="https://idosgames.com/app/49HLIN0J/" target="_blank" rel="noopener noreferrer">${ru ? 'Открыть на iDos для оплаты через кошелёк ↗' : 'Open on iDos for wallet payments ↗'}</a></p>` : ''}<div class="signals-payment-note"><span aria-hidden="true">↗</span><p>${ru ? 'Оплата с баланса FRAG в iDos. Если токенов не хватает, iDos предложит пополнить его через кошелёк. Сигналы сохраняются в твоём профиле.' : 'Pay with your FRAG balance in iDos. If you need more tokens, iDos will offer a wallet top-up. Signals stay in your profile.'}</p></div>
      <p class="fine">${ru ? 'Сигналы — игровая валюта для косметики. Их нельзя вывести или обменять обратно на FRAG.' : 'Signals are in-game currency for cosmetics. They cannot be withdrawn or exchanged back to FRAG.'}</p>
    </section>`;
  const feedback = dialog.querySelector<HTMLElement>('#topup-feedback')!;
  feedback.textContent = payingOffer ? (ru ? 'Подтверди оплату в окне iDos. Не закрывай страницу до результата.' : 'Confirm payment in iDos. Keep this page open until it finishes.') : !ready ? (ru ? 'Войди через iDos, чтобы покупать Сигналы.' : 'Sign in with iDos to buy Signals.') : topupStatus || (!packages || loadingPackages ? (ru ? 'Загружаем пакеты…' : 'Loading packs…') : !packages.length ? (ru ? 'Сейчас нет доступных пакетов.' : 'No packs available right now.') : '');
  bindShopNavigation();
  dialog.querySelector<HTMLButtonElement>('#topup-retry')!.onclick = () => { packages = null; topupStatus = ''; render(); };
  dialog.querySelectorAll<HTMLButtonElement>('[data-pack]').forEach(button => button.onclick = async () => {
    if (payingOffer || pending) return;
    const pack = packages?.find(p => p.offerID === button.dataset.pack);
    if (!pack) return;
    payingOffer = pack.offerID; pending = true; topupStatus = ''; render();
    try { await buySignalPackage(pack.offerID, pack.frag, pack.signals, send); topupStatus = lang === 'ru' ? 'Покупка подтверждена iDos. Баланс обновляется.' : 'Purchase confirmed by iDos. Your balance is refreshing.'; }
    catch (error) { topupStatus = error instanceof Error ? error.message : 'iDos unavailable'; }
    finally { payingOffer = null; pending = false; render(); }
  });
  if (ready && !packages && !loadingPackages) void loadSignalPackages();
}
const inSection = (category: CosmeticCategory) => section === 'accessories' ? ['head','face'].includes(category) : section === 'room' ? ['table','wallpaper','lighting','poster','decor'].includes(category) : category === 'victory';
const words = () => lang === 'ru'
  ? { shop: 'Магазин', currency: 'Сигналов', buy: 'Купить', equip: 'Надеть', equipped: 'Надет', owned: 'В коллекции', close: 'Закрыть', balance: 'Баланс', note: '10 за победу с людьми, 3 за поражение при полноценном участии. С ботами: 0. От минуты, два сообщения, минимум два человека. Лимит: 50 Сигналов в сутки (UTC).' , saved: 'Профиль сохраняется на сервере. Этот браузер хранит ключ доступа: при очистке данных доступ потеряется. Это игровые очки, пока не токен Solana.', reward: 'Последняя награда' }
  : { shop: 'Shop', currency: 'Signals', buy: 'Buy', equip: 'Equip', equipped: 'Equipped', owned: 'Owned', close: 'Close', balance: 'Balance', note: 'Human win: 10, qualifying loss: 3, bots: 0. At least a minute, two messages, two participating people. Daily UTC cap: 50 Signals.' , saved: 'Your profile is stored on the server. This browser holds its access key; clearing browser data loses access. These are game points, not a Solana token yet.', reward: 'Latest reward' };

export function placeShopButton() {
  const slot = document.querySelector('.home-account');
  if (!slot) {
    launcher?.remove();
    if (dialog?.open) dialog.close();
    return;
  }
  if (slot && launcher && launcher.parentElement !== slot) slot.append(launcher);
}
function render() {
  const w = words();
  launcher.textContent = `${w.shop} · ${account?.balance ?? 0} ${w.currency}`;
  w.saved = lang === 'ru' ? 'Сигналы нельзя вывести, передать или обменять обратно на FRAG. Платформенный баланс хранится в iDos после активации; гостевой прогресс — на сервере.' : 'Signals cannot be withdrawn, transferred or exchanged back to FRAG. Platform balance is stored in iDos after activation; guest progress is stored on the server.';
  if (!dialog.open) return;
  if (section === 'signals') { renderSignals(); return; }
  const list = section === 'characters' ? SKINS : COSMETICS.filter(i => inSection(i.category));
  if (!list.some(i => i.id === selected)) selected = list[0].id;
  const chosen = COSMETICS.find(i => i.id === selected);
  const chosenSkin = SKINS.find(i => i.id === selected);
  const previewLook = { ...account?.loadout, ...(chosen ? { [chosen.category]: chosen.id } : {}) };
  const preview = section === 'room' ? sceneSvg([{ id: 'preview', name: 'Fragment', color: '#b8b09e', connected: true, ready: false, skin: account?.equipped ?? 'classic', cosmetics: account?.loadout }], 'preview', previewLook)
    : section === 'victory' ? `<div class="victory-preview ${selected}"><span>${chosen?.icon}</span><i></i><i></i><i></i></div>`
    : skinPortrait(chosenSkin?.id ?? account?.equipped ?? 'classic', previewLook);
  const roomNote = lang === 'ru' ? 'Все видят оформление создателя комнаты. Ваш набор используется, когда комнату создаёте вы.' : 'Everyone sees the room creator’s decor. Your set is used when you create the room.';
  dialog.innerHTML = `<div class="settings-heading"><div><p class="eyebrow">FRAGMENT · ${lang === 'ru' ? 'КОЛЛЕКЦИЯ' : 'COLLECTION'}</p><h2 id="shop-title">${w.shop}</h2></div><button id="shop-close" aria-label="${w.close}">×</button></div><div class="shop-summary"><p class="shop-balance">${w.balance}: <b>${account?.balance ?? 0} ${w.currency}</b></p>${lastReward ? `<p class="shop-reward">${w.reward}: +${lastReward}</p>` : ''}</div><button id="signal-topup" class="signal-topup-link" type="button" ${!SIGNAL_TOPUPS_ENABLED ? 'disabled' : ''}><img src="${fragIcon}" alt="" width="24" height="24"><span>${lang === 'ru' ? 'Купить Сигналы за FRAG' : 'Buy Signals with FRAG'}</span><span aria-hidden="true">↗</span></button>${shopTabs()}<div class="shop-preview"><div class="preview-art">${preview}</div><div><p class="eyebrow">${lang === 'ru' ? 'ПРЕДПРОСМОТР' : 'PREVIEW'}</p><h3>${chosen?.name[lang] ?? chosenSkin?.name[lang]}</h3><p class="fine">${section === 'room' ? roomNote : section === 'victory' ? (lang === 'ru' ? 'Ваш эффект на экране командной победы.' : 'Your effect on the team victory screen.') : (lang === 'ru' ? 'Выбранная маска заменяет родную маску персонажа. «Облик скина» возвращает исходный вариант. Ваш образ виден всем участникам комнаты.' : 'An equipped mask replaces the character’s original mask. Original skin face restores the default. Everyone sees your look.')}</p></div></div><div class="skin-grid ${section === 'characters' ? 'character-grid' : ''}">${list.map(entry => {
    const price = account?.platform ? platformPrices.get(entry.id) : entry.price;
    const cosmetic = COSMETICS.find(i => i.id === entry.id);
    const owned = cosmetic ? account?.items?.includes(entry.id) : account?.owned.includes(entry.id as typeof SKINS[number]['id']);
    const equipped = cosmetic ? account?.loadout?.[cosmetic.category] === entry.id : account?.equipped === entry.id;
    const cardLook = { ...account?.loadout, ...(cosmetic ? { [cosmetic.category]: cosmetic.id } : {}) };
    const roomItem = cosmetic && ['table','wallpaper','lighting','poster','decor'].includes(cosmetic.category);
    const art = roomItem ? sceneSvg([], 'preview', cardLook).replaceAll('id="', `id="${entry.id}-`).replaceAll('url(#', `url(#${entry.id}-`) : cosmetic && ['head','face'].includes(cosmetic.category) ? skinPortrait(account?.equipped ?? 'classic', cardLook) : cosmetic ? `<span class="item-icon">${cosmetic.icon}</span>` : skinPortrait(entry.id as typeof SKINS[number]['id'], account?.loadout);
    const category = cosmetic ? CATEGORY_NAMES[cosmetic.category][lang] : sectionNames.characters[lang === 'ru' ? 0 : 1];
    return `<article class="skin-card ${equipped ? 'equipped' : ''} ${selected === entry.id ? 'selected' : ''}"><button class="item-preview" data-preview="${entry.id}" aria-label="${entry.name[lang]}">${art}</button><p class="eyebrow">${category}</p><h3>${entry.name[lang]}</h3><p>${owned ? w.owned : `${price ?? '—'} ${w.currency}`}</p><button data-item="${entry.id}" data-action="${owned ? cosmetic ? 'equip_item' : 'equip' : cosmetic ? 'buy_item' : 'buy'}" ${pending || !account || equipped || !owned && (account.platform ? !account.platform.ready || price === undefined : account.balance < entry.price) ? 'disabled' : ''}>${equipped ? (lang === 'ru' ? 'Выбрано' : 'Selected') : owned ? cosmetic && !['head','face'].includes(cosmetic.category) ? (lang === 'ru' ? 'Применить' : 'Apply') : w.equip : w.buy}</button></article>`;
  }).join('')}</div><p id="shop-feedback" role="status"></p><p class="fine">${w.note}</p><p class="fine">${w.saved}</p>`;
  dialog.querySelector<HTMLButtonElement>('#signal-topup')!.onclick = () => { if (pending || payingOffer) return; section = 'signals'; packages = null; topupStatus = ''; render(); dialog.scrollTop = 0; };
  bindShopNavigation();
  dialog.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(b => b.onclick = () => { selected = b.dataset.preview!; render(); dialog.scrollTop = 0; });
  dialog.querySelectorAll<HTMLButtonElement>('[data-item]').forEach(button => {
    button.onclick = () => {
      pending = true;
      const action = button.dataset.action!;
      const id = button.dataset.item!;
      if (account?.platform) {
        void platformAction(action, id, account.platform.ready, send).catch(error => {
          pending = false; render();
          dialog.querySelector('#shop-feedback')!.textContent = error instanceof Error ? error.message : 'iDos unavailable';
        });
      } else if (action === 'buy_item' || action === 'equip_item') send({ t: action, item: id });
      else send({ t: action as 'buy' | 'equip', skin: id });
      render();
    };
  });
}
export function initShop(sender: typeof send) {
  send = sender;
  launcher = document.createElement('button');
  launcher.className = 'shop-launcher';
  launcher.setAttribute('aria-haspopup', 'dialog');
  dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog shop-dialog';
  dialog.setAttribute('aria-labelledby', 'shop-title');
  document.body.append(dialog);
  launcher.onclick = () => { dialog.showModal(); render(); if (account?.platform) void refreshPlatformShop().then(render); };
  dialog.addEventListener('close', () => launcher.focus());
  window.addEventListener('fragment:language', render);
  render();
}
export function handleShopMessage(message: ServerMessage) {
  if (message.t === 'profile') {
    account = message.profile;
    pending = false;
    if (message.token) try { localStorage.setItem('fragment.profile-token', message.token); } catch { /* session only */ }
    render();
  } else if (message.t === 'reward') {
    lastReward = message.reward.amount;
    render();
  } else if (message.t === 'error' && dialog.open) {
    pending = false;
    render();
    dialog.querySelector('#shop-feedback')!.textContent = lang === 'ru' && message.ru ? message.ru : message.message;
  }
}
