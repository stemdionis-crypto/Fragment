import { SKINS, COSMETICS, CATEGORY_NAMES, type CosmeticCategory, type ProfileView } from '../../shared/economy';
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
const sections = ['characters', 'accessories', 'room', 'victory'];
const sectionNames: Record<string, string[]> = { characters: ['Персонажи','Characters'], accessories: ['Аксессуары','Accessories'], room: ['Комната','Room'], victory: ['Победа','Victory'] };
const inSection = (category: CosmeticCategory) => section === 'accessories' ? ['head','face'].includes(category) : section === 'room' ? ['table','wallpaper','lighting','poster','decor'].includes(category) : category === 'victory';
const words = () => lang === 'ru'
  ? { shop: 'Магазин', currency: 'Сигнал', buy: 'Купить', equip: 'Надеть', equipped: 'Надет', owned: 'В коллекции', close: 'Закрыть', balance: 'Баланс', note: 'Победа с ботами: 10 Сигнала. С людьми: 25, если партия длится от минуты. Для награды отправьте хотя бы два сообщения. Лимит: 100 Сигнала в сутки (UTC). Косметика не даёт преимуществ.', saved: 'Профиль сохраняется на сервере. Этот браузер хранит ключ доступа: при очистке данных доступ потеряется. Это игровые очки, пока не токен Solana.', reward: 'Последняя награда' }
  : { shop: 'Shop', currency: 'Signal', buy: 'Buy', equip: 'Equip', equipped: 'Equipped', owned: 'Owned', close: 'Close', balance: 'Balance', note: 'Bot win: 10 Signal. Human win: 25 if the match lasts at least a minute. Send at least two messages to qualify. Daily cap: 100 Signal (UTC). Cosmetics give no gameplay advantage.', saved: 'Your profile is stored on the server. This browser holds its access key; clearing browser data loses access. These are game points, not a Solana token yet.', reward: 'Latest reward' };

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
  w.saved = lang === 'ru'
    ? account?.wallet ? 'Профиль сохранён на сервере и привязан к кошельку. Его можно восстановить на другом устройстве. Сигнал пока является игровыми очками.' : 'Профиль сохраняется на сервере. Привяжите кошелёк, чтобы восстановить прогресс после очистки браузера или на другом устройстве. Сигнал пока является игровыми очками.'
    : account?.wallet ? 'Profile saved on the server and linked to your wallet. Restore it on another device. Signal is currently game points.' : 'Profile saved on the server. Link a wallet to restore progress on another device or after clearing browser data. Signal is currently game points.';
  launcher.textContent = `${w.shop} · ${account?.balance ?? 0} ${w.currency}`;
  if (import.meta.env.VITE_DEMO_MODE === 'true') w.saved = lang === 'ru'
    ? 'Это демо: баланс, скины и привязка кошелька могут сброситься после перезапуска сервера. Сигнал — тестовые игровые очки.'
    : 'Demo: balance, skins and wallet links may reset when the server restarts. Signal is test game points.';
  if (!dialog.open) return;
  const list = section === 'characters' ? SKINS : COSMETICS.filter(i => inSection(i.category));
  if (!list.some(i => i.id === selected)) selected = list[0].id;
  const chosen = COSMETICS.find(i => i.id === selected);
  const chosenSkin = SKINS.find(i => i.id === selected);
  const previewLook = { ...account?.loadout, ...(chosen ? { [chosen.category]: chosen.id } : {}) };
  const preview = section === 'room' ? sceneSvg([{ id: 'preview', name: 'Fragment', color: '#b8b09e', connected: true, ready: false, skin: account?.equipped ?? 'classic', cosmetics: account?.loadout }], 'preview', previewLook)
    : section === 'victory' ? `<div class="victory-preview ${selected}"><span>${chosen?.icon}</span><i></i><i></i><i></i></div>`
    : skinPortrait(chosenSkin?.id ?? account?.equipped ?? 'classic', previewLook);
  const roomNote = lang === 'ru' ? 'Все видят оформление создателя комнаты. Ваш набор используется, когда комнату создаёте вы.' : 'Everyone sees the room creator’s decor. Your set is used when you create the room.';
  dialog.innerHTML = `<div class="settings-heading"><div><p class="eyebrow">FRAGMENT · ${lang === 'ru' ? 'КОЛЛЕКЦИЯ' : 'COLLECTION'}</p><h2 id="shop-title">${w.shop}</h2></div><button id="shop-close" aria-label="${w.close}">×</button></div><div class="shop-summary"><p class="shop-balance">${w.balance}: <b>${account?.balance ?? 0} ${w.currency}</b></p>${lastReward ? `<p class="shop-reward">${w.reward}: +${lastReward}</p>` : ''}</div><nav class="shop-tabs" aria-label="${w.shop}">${sections.map(id => `<button data-section="${id}" aria-pressed="${section === id}">${sectionNames[id][lang === 'ru' ? 0 : 1]}</button>`).join('')}</nav><div class="shop-preview"><div class="preview-art">${preview}</div><div><p class="eyebrow">${lang === 'ru' ? 'ПРЕДПРОСМОТР' : 'PREVIEW'}</p><h3>${chosen?.name[lang] ?? chosenSkin?.name[lang]}</h3><p class="fine">${section === 'room' ? roomNote : section === 'victory' ? (lang === 'ru' ? 'Ваш эффект на экране командной победы.' : 'Your effect on the team victory screen.') : (lang === 'ru' ? 'Выбранная маска заменяет родную маску персонажа. «Облик скина» возвращает исходный вариант. Ваш образ виден всем участникам комнаты.' : 'An equipped mask replaces the character’s original mask. Original skin face restores the default. Everyone sees your look.')}</p></div></div><div class="skin-grid ${section === 'characters' ? 'character-grid' : ''}">${list.map(entry => {
    const cosmetic = COSMETICS.find(i => i.id === entry.id);
    const owned = cosmetic ? account?.items?.includes(entry.id) : account?.owned.includes(entry.id as typeof SKINS[number]['id']);
    const equipped = cosmetic ? account?.loadout?.[cosmetic.category] === entry.id : account?.equipped === entry.id;
    const cardLook = { ...account?.loadout, ...(cosmetic ? { [cosmetic.category]: cosmetic.id } : {}) };
    const roomItem = cosmetic && ['table','wallpaper','lighting','poster','decor'].includes(cosmetic.category);
    const art = roomItem ? sceneSvg([], 'preview', cardLook).replaceAll('id="', `id="${entry.id}-`).replaceAll('url(#', `url(#${entry.id}-`) : cosmetic && ['head','face'].includes(cosmetic.category) ? skinPortrait(account?.equipped ?? 'classic', cardLook) : cosmetic ? `<span class="item-icon">${cosmetic.icon}</span>` : skinPortrait(entry.id as typeof SKINS[number]['id'], account?.loadout);
    const category = cosmetic ? CATEGORY_NAMES[cosmetic.category][lang] : sectionNames.characters[lang === 'ru' ? 0 : 1];
    return `<article class="skin-card ${equipped ? 'equipped' : ''} ${selected === entry.id ? 'selected' : ''}"><button class="item-preview" data-preview="${entry.id}" aria-label="${entry.name[lang]}">${art}</button><p class="eyebrow">${category}</p><h3>${entry.name[lang]}</h3><p>${owned ? w.owned : `${entry.price} ${w.currency}`}</p><button data-item="${entry.id}" data-action="${owned ? cosmetic ? 'equip_item' : 'equip' : cosmetic ? 'buy_item' : 'buy'}" ${pending || !account || equipped || !owned && account.balance < entry.price ? 'disabled' : ''}>${equipped ? (lang === 'ru' ? 'Выбрано' : 'Selected') : owned ? cosmetic && !['head','face'].includes(cosmetic.category) ? (lang === 'ru' ? 'Применить' : 'Apply') : w.equip : w.buy}</button></article>`;
  }).join('')}</div><p id="shop-feedback" role="status"></p><p class="fine">${w.note}</p><p class="fine">${w.saved}</p>`;
  dialog.querySelector<HTMLButtonElement>('#shop-close')!.onclick = () => dialog.close();
  dialog.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(b => b.onclick = () => { section = b.dataset.section!; render(); dialog.scrollTop = 0; });
  dialog.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(b => b.onclick = () => { selected = b.dataset.preview!; render(); dialog.scrollTop = 0; });
  dialog.querySelectorAll<HTMLButtonElement>('[data-item]').forEach(button => {
    button.onclick = () => {
      pending = true;
      const action = button.dataset.action!;
      const id = button.dataset.item!;
      if (action === 'buy_item' || action === 'equip_item') send({ t: action, item: id });
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
  launcher.onclick = () => { dialog.showModal(); render(); };
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
