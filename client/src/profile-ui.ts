import { COSMETICS, SKINS, CATEGORY_NAMES, type ProfileView } from '../../shared/economy';
import type { ClientMessage, LadderEntry, LadderMetric, ServerMessage } from '../../shared/protocol';
import { lang } from './i18n';

let profile: ProfileView | null = null;
let send: (message: ClientMessage) => void;
let button: HTMLButtonElement;
let dialog: HTMLDialogElement;
let tab: 'stats' | 'inventory' | 'ladder' = 'stats';
let metric: LadderMetric = 'speed';
let entries: LadderEntry[] = [];
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const label = (ru: string, en: string) => lang === 'ru' ? ru : en;

export function initProfileUI(sender: (message: ClientMessage) => void) {
  send = sender;
  button = document.createElement('button');
  button.className = 'profile-launcher';
  button.onclick = () => { tab = 'stats'; render(); dialog.showModal(); };
  dialog = document.createElement('dialog');
  dialog.className = 'profile-dialog';
  document.body.append(dialog);
}

export function placeProfileButton() {
  const slot = document.querySelector('.home-account');
  if (!slot) { button?.remove(); if (dialog?.open) dialog.close(); return; }
  if (button.parentElement !== slot) slot.append(button);
  button.textContent = label('Профиль и рейтинг', 'Profile & rankings');
  if (dialog.open) render();
}

export function handleProfileMessage(message: ServerMessage) {
  if (message.t === 'profile') profile = message.profile;
  if (message.t === 'leaderboard' && message.metric === metric) entries = message.entries;
  if (dialog?.open) render();
}

function render() {
  if (!dialog) return;
  const tabs = [
    ['stats', label('Статистика', 'Stats')],
    ['inventory', label('Инвентарь', 'Inventory')],
    ['ladder', label('Рейтинг', 'Rankings')],
  ] as const;
  const stats = profile ? `<div class="profile-stats">
    <div><b>${profile.gamesPlayed}</b><span>${label('Матчей', 'Matches')}</span></div>
    <div><b>${profile.wins}</b><span>${label('Побед', 'Wins')}</span></div>
    <div><b>${profile.fastestSeconds === null ? '—' : formatTime(profile.fastestSeconds)}</b><span>${label('Лучший матч с людьми', 'Fastest human match')}</span></div>
    <div><b>${profile.totalSignalEarned}</b><span>${label('Сигнала заработано', 'Signal earned')}</span></div>
    <div><b>${profile.balance}</b><span>${label('Текущий баланс', 'Current balance')}</span></div>
  </div><p class="fine">${profile.wallet ? `◎ ${esc(profile.wallet)}` : label('Привяжите кошелёк в главном меню для восстановления профиля и участия в рейтинге.', 'Link a wallet in the main menu to restore your profile and enter the rankings.')}</p>` : `<p class="fine">${label('Подключаем профиль…', 'Loading profile…')}</p>`;
  const inventory = profile ? `<div class="inventory-grid">${[
    ...SKINS.filter(s => profile!.owned.includes(s.id)).map(s => ({ name: s.name[lang], slot: label('Персонаж', 'Character'), selected: profile!.equipped === s.id })),
    ...COSMETICS.filter(i => profile!.items.includes(i.id)).map(i => ({ name: i.name[lang], slot: CATEGORY_NAMES[i.category][lang], selected: profile!.loadout[i.category] === i.id })),
  ].map(item => `<div class="inventory-item"><b>${esc(item.name)}</b><span>${esc(item.slot)}${item.selected ? ` · ${label('надето', 'equipped')}` : ''}</span></div>`).join('')}</div>` : '';
  const names: Record<LadderMetric, string> = { speed: label('Скорость', 'Speed'), signal: label('Сигнал', 'Signal'), games: label('Игры', 'Games') };
  const ladder = `<div class="profile-metrics">${(['speed','signal','games'] as const).map(m => `<button data-metric="${m}" aria-pressed="${metric === m}">${names[m]}</button>`).join('')}</div><p class="fine">${label('В рейтинге только профили с кошельком. Скорость — матчи с людьми; Сигнал — всего заработано, не текущий баланс.', 'Only wallet-linked profiles are ranked. Speed counts human matches; Signal is total earned, not current balance.')}</p><ol class="ladder-list">${entries.map(e => `<li><span>${esc(e.name)} <small>${esc(e.wallet)}</small></span><b>${metric === 'speed' ? formatTime(e.value) : e.value}</b></li>`).join('') || `<li>${label('Пока нет результатов', 'No results yet')}</li>`}</ol>`;
  dialog.innerHTML = `<div class="settings-heading"><div><p class="eyebrow">FRAGMENT</p><h2>${label('Профиль', 'Profile')}</h2></div><button id="profile-close" aria-label="${label('Закрыть', 'Close')}">×</button></div><div class="profile-tabs">${tabs.map(([id, name]) => `<button data-tab="${id}" aria-pressed="${tab === id}">${name}</button>`).join('')}</div>${tab === 'stats' ? stats : tab === 'inventory' ? inventory : ladder}${import.meta.env.VITE_DEMO_MODE === 'true' ? `<p class="fine">${label('Демо: данные пока могут сброситься после перезапуска сервера.', 'Demo: data may reset when the server restarts.')}</p>` : ''}`;
  dialog.querySelector<HTMLButtonElement>('#profile-close')!.onclick = () => dialog.close();
  dialog.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab as typeof tab; if (tab === 'ladder') requestLadder(); render(); });
  dialog.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach(b => b.onclick = () => { metric = b.dataset.metric as LadderMetric; entries = []; requestLadder(); render(); });
}
function requestLadder() { send({ t: 'leaderboard', metric }); }
