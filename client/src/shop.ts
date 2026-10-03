import { SKINS, type ProfileView } from '../../shared/economy';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';
import { lang } from './i18n';
import { skinPortrait } from './scene';

let account: ProfileView | null = null;
let launcher: HTMLButtonElement;
let dialog: HTMLDialogElement;
let send: (message: ClientMessage) => void;
let lastReward = 0;
let pending = false;
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
  if (!dialog.open) return;
  dialog.innerHTML = `<div class="settings-heading"><h2 id="shop-title">${w.shop}</h2><button id="shop-close" aria-label="${w.close}">×</button></div><p class="shop-balance">${w.balance}: <b>${account?.balance ?? 0} ${w.currency}</b></p>${lastReward ? `<p class="shop-reward">${w.reward}: +${lastReward}</p>` : ''}<div class="skin-grid">${SKINS.map((skin) => {
    const owned = account?.owned.includes(skin.id);
    const equipped = account?.equipped === skin.id;
    return `<article class="skin-card ${equipped ? 'equipped' : ''}">${skinPortrait(skin.id)}<h3>${skin.name[lang]}</h3><p>${owned ? w.owned : `${skin.price} ${w.currency}`}</p><button data-skin="${skin.id}" data-action="${owned ? 'equip' : 'buy'}" ${pending || !account || equipped || !owned && account.balance < skin.price ? 'disabled' : ''}>${equipped ? w.equipped : owned ? w.equip : w.buy}</button></article>`;
  }).join('')}</div><p id="shop-feedback" role="status"></p><p class="fine">${w.note}</p><p class="fine">${w.saved}</p>`;
  dialog.querySelector<HTMLButtonElement>('#shop-close')!.onclick = () => dialog.close();
  dialog.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach((button) => {
    button.onclick = () => {
      pending = true;
      send({ t: button.dataset.action as 'buy' | 'equip', skin: button.dataset.skin! });
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
