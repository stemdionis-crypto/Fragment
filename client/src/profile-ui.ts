import { COSMETICS, SKINS, CATEGORY_NAMES, type ProfileView } from '../../shared/economy';
import type { ClientMessage, LadderEntry, LadderMetric, ServerMessage } from '../../shared/protocol';
import { lang } from './i18n';
import { skinPortrait, sceneSvg } from './scene';
import { platformAction } from './idos';

let profile: ProfileView | null = null;
let send: (message: ClientMessage) => void;
let button: HTMLButtonElement;
let dialog: HTMLDialogElement;
let tab: 'stats' | 'inventory' | 'ladder' = 'stats';
let metric: LadderMetric = 'speed';
let entries: LadderEntry[] = [];
let category = 'all';
let selected = '';
let pending = false;
let feedback = '';
let nicknameDialog: HTMLDialogElement;
let nicknamePending = false;
let inventoryButton: HTMLButtonElement;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const label = (ru: string, en: string) => lang === 'ru' ? ru : en;

export function initProfileUI(sender: (message: ClientMessage) => void) {
  send = sender;
  button = document.createElement('button');
  button.className = 'profile-launcher';
  inventoryButton = document.createElement('button');
  inventoryButton.className = 'inventory-launcher';
  inventoryButton.onclick = () => { tab = 'inventory'; render(); dialog.showModal(); };
  for (const trigger of [button, inventoryButton]) trigger.setAttribute('aria-haspopup', 'dialog');
  button.onclick = () => { tab = 'stats'; render(); dialog.showModal(); };
  dialog = document.createElement('dialog');
  dialog.className = 'profile-dialog';
  dialog.setAttribute('aria-labelledby', 'profile-title');
  document.body.append(dialog);
  nicknameDialog = document.createElement('dialog');
  nicknameDialog.className = 'profile-dialog';
  nicknameDialog.setAttribute('aria-labelledby', 'nickname-title');
  document.body.append(nicknameDialog);
  nicknameDialog.addEventListener('cancel', event => { if (!profile?.nickname || nicknamePending) event.preventDefault(); });
  dialog.addEventListener('close', () => (tab === 'inventory' ? inventoryButton : button).focus());
  window.addEventListener('fragment:language', () => { placeProfileButton(); });
}

export function placeProfileButton() {
  const slot = document.querySelector('.home-account');
  if (!slot) { button?.remove(); inventoryButton?.remove(); if (dialog?.open) dialog.close(); return; }
  if (button.parentElement !== slot) slot.append(button);
  if (inventoryButton.parentElement !== slot) slot.append(inventoryButton);
  button.textContent = label('Профиль', 'Profile');
  inventoryButton.textContent = label('Инвентарь', 'Inventory');
  if (dialog.open) render();
}

export function handleProfileMessage(message: ServerMessage) {
  if (message.t === 'profile') {
    profile = message.profile; pending = false; feedback = '';
    if (nicknamePending && profile.nickname) { nicknamePending = false; nicknameDialog.close(); }
    if ((profile.platform || profile.wallet) && !profile.nickname && !nicknameDialog.open) showNickname();
  }
  if (message.t === 'error' && nicknamePending) {
    nicknamePending = false;
    nicknameDialog.querySelector('[role=status]')!.textContent = lang === 'ru' && message.ru ? message.ru : message.message;
    nicknameDialog.querySelector<HTMLButtonElement>('[type=submit]')!.disabled = false;
  }
  if (message.t === 'error' && pending) { pending = false; feedback = lang === 'ru' && message.ru ? message.ru : message.message; }
  if (message.t === 'leaderboard' && message.metric === metric) entries = message.entries;
  if (dialog?.open) render();
}


const groups = [ ['all','Всё','All'], ['characters','Персонажи','Characters'], ['accessories','Аксессуары','Accessories'], ['room','Комната','Room'], ['victory','Победа','Victory'] ];
function ownedItems() {
  if (!profile) return [];
  return [
    ...SKINS.filter(s => profile!.owned.includes(s.id)).map(s => ({id:s.id, name:s.name[lang], category:'characters', slot:label('Персонаж','Character'), equipped:profile!.equipped === s.id, icon:''})),
    ...COSMETICS.filter(i => profile!.items.includes(i.id)).map(i => ({id:i.id,name:i.name[lang],category:i.category,slot:CATEGORY_NAMES[i.category][lang],equipped:profile!.loadout[i.category] === i.id,icon:i.icon})),
  ];
}
function art(id: string, large = false) {
  if (!profile) return '';
  const skin = SKINS.find(s => s.id === id);
  const item = COSMETICS.find(i => i.id === id);
  const look = {...profile.loadout, ...(item ? {[item.category]:id} : {})};
  let svg = skin || item && ['head','face'].includes(item.category)
    ? skinPortrait(skin?.id ?? profile.equipped,look)
    : item?.category === 'victory' ? '<div class="victory-preview '+id+'"><span>'+item.icon+'</span>'+(large ? '<i></i><i></i><i></i>' : '')+'</div>'
    : sceneSvg([], 'preview',look);
  // Every card has its own SVG definitions; previews must not share gradients.
  const prefix = 'inv-'+(large ? 'large-' : 'card-')+id+'-';
  return svg.replaceAll('id="','id="'+prefix).replaceAll('url(#','url(#'+prefix);
}
function render() {
  if (!dialog) return;
  const name = profile?.nickname || (document.querySelector<HTMLInputElement>('#name')?.value || label('Незнакомец','Stranger')).trim();
  const tabs = [['stats',label('Обзор','Overview')],['inventory',label('Инвентарь','Inventory')],['ladder',label('Рейтинг','Rankings')]];
  const items = ownedItems();
  const matches = items.filter(i => category === 'all' || category === 'characters' && i.category === 'characters' || category === 'accessories' && ['head','face'].includes(i.category) || category === 'room' && ['table','wallpaper','lighting','poster','decor'].includes(i.category) || category === 'victory' && i.category === 'victory');
  if (!matches.some(i => i.id === selected)) selected = matches[0]?.id ?? '';
  const chosen = matches.find(i => i.id === selected);
  const balance = profile?.platform?.balance ?? profile?.balance ?? 0;
  const identity = profile?.platform ? 'iDos · '+profile.platform.userId : profile?.wallet ? label('Аккаунт с кошельком','Wallet account') : label('Гостевой профиль','Guest profile');
  const shortWallet = profile?.wallet ? profile.wallet.slice(0,6)+'…'+profile.wallet.slice(-4) : label('Не подключён','Not connected');
  const stats = profile ? '<div class="account-overview"><div class="account-portrait">'+skinPortrait(profile.equipped,profile.loadout)+'<span>'+esc(SKINS.find(s=>s.id===profile!.equipped)?.name[lang] ?? '')+'</span></div><div><p class="eyebrow">'+label('ВАША ИСТОРИЯ В ЭФИРЕ','YOUR STORY ON AIR')+'</p><div class="profile-stats">'+[
    [profile.gamesPlayed,label('Сыграно матчей','Matches played')], [profile.wins,label('Побед','Wins')], [profile.gamesPlayed ? Math.round(profile.wins/profile.gamesPlayed*100)+'%' : '—',label('Доля побед','Win rate')], [profile.fastestSeconds === null ? '—' : formatTime(profile.fastestSeconds),label('Лучшее время с людьми','Best human match')], [profile.totalSignalEarned,label('Всего заработано FRAG','Total FRAG earned')], [items.length,label('Вещей в коллекции','Collection items')]
  ].map(([value,title])=>'<div><b>'+value+'</b><span>'+title+'</span></div>').join('')+'</div></div></div><div class="account-links"><div><span>'+label('Кошелёк Solana','Solana wallet')+'</span><b title="'+esc(profile.wallet ?? '')+'">'+esc(shortWallet)+'</b></div><div><span>'+label('Хранение инвентаря','Inventory storage')+'</span><b>'+ (profile.platform ? 'iDos Games' : label('Игровой сервер','Game server'))+'</b></div></div>' : '<p class="fine">'+label('Подключаем профиль…','Loading profile…')+'</p>';
  const inventory = '<div class="inventory-filters" aria-label="'+label('Категории вещей','Item categories')+'">'+groups.map(([id,ru,en])=>'<button data-category="'+id+'" aria-pressed="'+(category===id)+'">'+label(ru,en)+'</button>').join('')+'</div><div class="wardrobe-layout"><div class="inventory-grid">'+matches.map(i=>'<button class="collection-card '+(selected===i.id?'selected':'')+'" data-select="'+i.id+'" aria-pressed="'+(selected===i.id)+'"><div class="collection-art">'+art(i.id)+'</div><span class="collection-slot">'+esc(i.slot)+'</span><strong>'+esc(i.name)+'</strong><span class="collection-state">'+(i.equipped ? '✓ '+label('Используется','Equipped') : label('В коллекции','Owned'))+'</span></button>').join('')+(matches.length ? '' : '<p class="inventory-empty">'+label('В этой категории пока нет вещей. Новые образы можно найти в магазине.','No items in this category yet. Find new looks in the shop.')+'</p>')+'</div><aside class="inventory-detail">'+(chosen ? '<div class="inventory-big-art">'+art(chosen.id,true)+'</div><p class="eyebrow">'+esc(chosen.slot)+'</p><h3>'+esc(chosen.name)+'</h3><p class="fine">'+(['head','face','characters'].includes(chosen.category) ? label('Образ видят все в комнате. Новая маска заменяет маску скина.','Everyone in the room sees your look. A new mask replaces the skin mask.') : chosen.category==='victory' ? label('Появится на экране победы вашей команды.','Appears on your team victory screen.') : label('Оформление вашей комнаты. Команда увидит его, когда вы создадите лобби.','Your room decor. The team sees it when you create a lobby.'))+'</p><button id="inventory-equip" class="primary" '+(chosen.equipped || pending ? 'disabled' : '')+'>'+ (pending ? label('Сохраняем…','Saving…') : chosen.equipped ? '✓ '+label('Используется','Equipped') : label('Применить','Equip'))+'</button>' : '<p class="fine">'+label('Выберите вещь для просмотра','Select an item to preview')+'</p>')+'<p role="status" class="inventory-feedback">'+esc(feedback)+'</p></aside></div>';
  const names: Record<LadderMetric,string> = {speed:label('Быстрейшие матчи','Fastest matches'),signal:label('Заработано FRAG','FRAG earned'),games:label('Сыграно матчей','Matches played')};
  const ladder = '<div class="profile-metrics">'+(['speed','signal','games'] as const).map(m=>'<button data-metric="'+m+'" aria-pressed="'+(metric===m)+'">'+names[m]+'</button>').join('')+'</div><p class="fine">'+label('В рейтинге участвуют профили с кошельком. Лучшее время учитывает матчи с людьми.','Rankings include wallet-linked profiles. Best times count matches with people.')+'</p><ol class="ladder-list">'+(entries.map(e=>'<li><span>'+esc(e.name)+' <small>'+esc(e.wallet)+'</small></span><b>'+(metric==='speed'?formatTime(e.value):e.value)+'</b></li>').join('') || '<li>'+label('Пока нет результатов','No results yet')+'</li>')+'</ol>';
  dialog.innerHTML = '<div class="settings-heading"><div><p class="eyebrow">FRAGMENT · '+label('ЛИЧНЫЙ ЭФИР','PERSONAL FREQUENCY')+'</p><h2 id="profile-title">'+label('Профиль и коллекция','Profile & collection')+'</h2></div><button id="profile-close" aria-label="'+label('Закрыть','Close')+'">×</button></div><div class="account-banner"><div><h3>'+esc(name)+'</h3>'+((profile?.platform || profile?.wallet) ? '<button id=edit-nickname>'+label('Изменить ник','Change nickname')+'</button>' : '')+'<p>'+esc(identity)+'</p></div><div class="account-balance"><b>'+esc(String(balance))+'</b><span>FRAG'+(!profile?.platform ? ' · '+label('демо','demo') : '')+'</span></div></div><nav class="profile-tabs" aria-label="'+label('Разделы профиля','Profile sections')+'">'+tabs.map(([id,title])=>'<button data-tab="'+id+'" aria-pressed="'+(tab===id)+'">'+title+'</button>').join('')+'</nav>'+(tab==='stats'?stats:tab==='inventory'?inventory:ladder)+'<p class="account-storage fine">'+(profile?.platform ? (profile.platform.ready ? label('Инвентарь и баланс связаны с аккаунтом iDos Games.','Inventory and balance are linked to your iDos Games account.') : label('Инвентарь связан с аккаунтом iDos. Реальные FRAG-покупки и награды ожидают активации токена.','Inventory is linked to your iDos account. Real FRAG purchases and rewards await token activation.')) : label('Демо: прогресс на сервере может сброситься при перезапуске. Кошелёк подключается в главном меню.','Demo: server progress may reset on restart. Connect your wallet in the main menu.'))+'</p>';
  const editNickname = dialog.querySelector<HTMLButtonElement>('#edit-nickname');
  if (editNickname) editNickname.onclick = showNickname;
  dialog.querySelector<HTMLButtonElement>('#profile-close')!.onclick = ()=>dialog.close();
  dialog.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab as typeof tab;feedback='';if(tab==='ladder')requestLadder();render();});
  dialog.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category!;render();});
  dialog.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(b=>b.onclick=()=>{selected=b.dataset.select!;feedback='';render();});
  dialog.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach(b=>b.onclick=()=>{metric=b.dataset.metric as LadderMetric;entries=[];requestLadder();render();});
  const equip = dialog.querySelector<HTMLButtonElement>('#inventory-equip');
  if (equip && chosen) equip.onclick = ()=> {
    if (pending || !profile || chosen.equipped) return;
    pending=true;feedback='';
    const action = chosen.category==='characters' ? 'equip' : 'equip_item';
    if (profile.platform) void platformAction(action,chosen.id,profile.platform.ready,send).catch(error=>{pending=false;feedback=error instanceof Error ? error.message : label('Не удалось сохранить','Could not save');render();});
    else if (action==='equip') send({t:'equip',skin:chosen.id});
    else send({t:'equip_item',item:chosen.id});
    render();
  };
}
function requestLadder() { send({t:'leaderboard',metric}); }

function showNickname() {
  nicknameDialog.innerHTML = '<form><h2 id="nickname-title">'+label(profile?.nickname ? 'Изменить ник' : 'Как вас называть?', profile?.nickname ? 'Change nickname' : 'Choose your nickname')+'</h2><p>'+label('Ник сохранится в вашем профиле. Его можно изменить позже.','Your nickname will be saved to your profile. You can change it later.')+'</p><label for="profile-nickname">'+label('Ваш ник','Nickname')+'</label><input id="profile-nickname" name="nickname" minlength="1" maxlength="16" required autocomplete="nickname" value="'+esc(profile?.nickname || '')+'"><p class="fine">'+label('От 1 до 16 символов','1–16 characters')+'</p><p role="status"></p><button type="submit" class="primary">'+label('Сохранить','Save')+'</button>'+(profile?.nickname ? '<button type="button" id="nickname-cancel">'+label('Отмена','Cancel')+'</button>' : '')+'</form>';
  const saveNickname = (event: Event) => {
    event.preventDefault();
    if (nicknamePending) return;
    const nickname = nicknameDialog.querySelector<HTMLInputElement>('input')!.value.trim().normalize('NFC');
    if (!nickname || nickname.length > 16) { nicknameDialog.querySelector('[role=status]')!.textContent = label('Введите от 1 до 16 символов','Use 1–16 characters'); return; }
    nicknamePending = true;
    nicknameDialog.querySelector<HTMLButtonElement>('[type=submit]')!.disabled = true;
    send({ t: 'set_nickname', nickname });
  };
  // iDos embeds the game without allow-forms; submit events never fire there.
  const saveButton = nicknameDialog.querySelector<HTMLButtonElement>('[type=submit]')!;
  saveButton.onclick = saveNickname;
  nicknameDialog.querySelector('form')!.onsubmit = saveNickname;
  nicknameDialog.querySelector('input')!.onkeydown = event => { if (event.key === 'Enter') saveNickname(event); };
  const cancel = nicknameDialog.querySelector<HTMLButtonElement>('#nickname-cancel');
  if (cancel) cancel.onclick = () => nicknameDialog.close();
  if (!nicknameDialog.open) nicknameDialog.showModal();
}
