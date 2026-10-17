import { platformLogin, platformReward } from './idos';
import './style.css';
import './preview.css';
import { openTutorial } from './tutorial';
import {
  CHAT_MAX,
  MIN_PLAYERS,
  PLAYER_COLORS,
  type ChatMessage,
  type FragmentRecord,
  type Glyph,
  type PlayerView,
  type PrivateInfo,
  type PublicState,
  type ServerMessage,
  type Value,
} from '../../shared/protocol';
import { sfx, unlockAudio, setSoundscape } from './audio';
import { settings } from './settings';
import { initSettingsUI, placeSettingsButton } from './settings-ui';
import { initShop, placeShopButton, handleShopMessage } from './shop';
import { initProfileUI, placeProfileButton, handleProfileMessage } from './profile-ui';
import { SKINS, type ProfileView } from '../../shared/economy';
import { isCipher, SYMBOL_CIPHERS } from '../../shared/trial-rules';
import { DESCRIBE_HINTS, isDial, waveDensity, waveHeight, waveValue, TAPE_FRAMES, bitAt, LAMP_COLORS } from '../../shared/dials';
import { dialArt, waveSvg, tapeSvg, antennaSvg, waveMeter, equalizerSvg, morseSvg, scaleSvg, wiresSvg, lampSvg, setArtLang } from './dial-art';
import { GLYPH_NAMES } from '../../shared/glyph-names';
const glyphName = (g: Glyph) => GLYPH_NAMES[g] ? (lang === 'ru' ? GLYPH_NAMES[g].ru : GLYPH_NAMES[g].en) : g;
import { connectWallet, initWalletAuth, handleWalletMessage, walletBusy } from './wallet-auth';
import { glyphSvg } from './glyphs';
import { trialBanner, trialExample } from './trial-presentation';
import { Net, saveSession, savedSession } from './net';
import { radioSvg, shakeNeedle, updateRadio } from './radio';
import { Camera, sceneSvg, seatsFor } from './scene';
import { langSwitchHtml, lang, setLang, t, tl } from './i18n';

// ---------- state ----------

const net = new Net();
let state: PublicState | null = null;
let priv: PrivateInfo | null = null;
let myId = '';
let mounted: 'home' | 'lobby' | 'game' | null = null;
let lastChatId = -1;
let wallet = '';
let account: ProfileView | null = null;

const app = document.getElementById('app')!;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

function prefs() {
  try {
    return { name: localStorage.getItem('fragment.name') ?? '', color: localStorage.getItem('fragment.color') ?? PLAYER_COLORS[0] };
  } catch {
    return { name: '', color: PLAYER_COLORS[0] as string };
  }
}
function savePrefs(name: string, color: string) {
  try {
    localStorage.setItem('fragment.name', name);
    localStorage.setItem('fragment.color', color);
  } catch {
    /* ignore */
  }
}

export function toast(html: string, kind: '' | 'error' | 'radio' = '', ms = 4500) {
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.innerHTML = html;
  document.getElementById('toasts')!.append(node);
  setTimeout(() => node.remove(), ms);
}

// ---------- home ----------

// Room codes are Latin letters. If the keyboard is on the Russian layout, map keys by position
// (й→Q, ц→W, …) instead of silently dropping what the player typed.
const RU_KEYS = 'йцукенгшщзфывапролдячсмить';
const EN_KEYS = 'QWERTYUIOPASDFGHJKLZXCVBNM';
function normalizeCode(raw: string) {
  return [...raw.toLowerCase()]
    .map((ch) => {
      const i = RU_KEYS.indexOf(ch);
      return i >= 0 ? EN_KEYS[i] : ch.toUpperCase();
    })
    .join('')
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

function mountHome() {
  mounted = 'home';
  const { color } = prefs();
  const params = new URLSearchParams(location.search);
  const codeFromUrl = (params.get('room') ?? '').toUpperCase();

  app.innerHTML = `
    <section class="home">
      <div class="home-radio">${radioSvg()}</div>
      <div class="home-panel">
        <div class="home-top">${langSwitchHtml()}</div>
        <h1 class="title">Fragment</h1>
        ${import.meta.env.VITE_LOCAL_PREVIEW==='true'?'<p class="preview-badge">ЛОКАЛЬНЫЙ ПРЕДПРОСМОТР · НЕ ОПУБЛИКОВАНО</p>':''}
        <p class="lead">${t('lead')}</p>
        ${import.meta.env.VITE_DEMO_MODE === 'true' ? `<p class="fine demo-note">${lang === 'ru' ? 'Демо концепции · Прогресс временный и может сброситься после перезапуска сервера.' : 'Concept demo · Progress is temporary and may reset when the server restarts.'}</p>` : ''}
        <div class="home-account"><button id="idos-login">iDos · Войти / Sign in</button><button id="wallet-home"></button></div>
        <p id="wallet-hint" class="fine"></p>


        <label>${t('yourColour')}</label>
        <div class="swatches" role="radiogroup">
          ${PLAYER_COLORS.map(
            (c) => `<button class="swatch" role="radio" aria-checked="${c === color}" data-color="${c}" style="--c:${c}" title="${c}"></button>`,
          ).join('')}
        </div>

        <div class="home-actions">
          <button id="tutorial">${lang==='ru'?'Попробовать правила · 3 шага':'Try the rules · 3 steps'}</button>
          <button id="match" class="primary">${t('findMatch')}</button>
          <p class="fine">${t('matchNote')}</p>
          <button id="practice">${t('playBots')}</button>
          <p class="fine">${t('botsNote')}</p>
<button id="create">${t('createRoom')}</button>
          <div class="join">
            <input id="code" maxlength="4" placeholder="${t('codePlaceholder')}" value="${esc(codeFromUrl)}" autocomplete="off" />
            <button id="join">${t('join')}</button>
          </div>
        </div>
        <p class="fine">${t('betaNote')}</p>
      </div>
    </section>`;

  let chosen = color;
  $('#tutorial').onclick=()=>openTutorial();
  app.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) => {
    b.onclick = () => {
      chosen = b.dataset.color!;
      app.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    };
  });
  const playerName = () => account?.nickname || prefs().name || t('stranger');
  const codeInput = $<HTMLInputElement>('#code');
  codeInput.oninput = () => (codeInput.value = normalizeCode(codeInput.value));

  $('#practice').onclick = () => {
    $<HTMLButtonElement>('#practice').disabled = true;
    $('#practice').textContent = lang === 'ru' ? 'Подключаем тренировку…' : 'Connecting to practice…';
    savePrefs(playerName(), chosen);
    net.send({ t: 'create', name: playerName(), color: chosen, practice: true, lang });
  };
  $('#match').onclick = () => {
    if((account?.matchmakingBlockedUntil ?? 0)>Date.now())return toast(lang==='ru'?'Подождите окончания ограничения поиска.':'Wait for the matchmaking restriction to end.');
    if (!canPlayOnline()) return;
    savePrefs(playerName(), chosen);
    $<HTMLButtonElement>('#match').disabled = true;
    net.send({ t: 'match', name: playerName(), color: chosen, lang });
  };
  $('#create').onclick = () => {
    if (!canPlayOnline()) return;
    savePrefs(playerName(), chosen);
    net.send({ t: 'create', name: playerName(), color: chosen, lang });
  };
  const join = () => {
    if (!canPlayOnline()) return;
    if (codeInput.value.length !== 4) return toast(t('enterCode'), 'error');
    savePrefs(playerName(), chosen);
    net.send({ t: 'join', code: codeInput.value, name: playerName(), color: chosen });
  };
  $('#join').onclick = join;
  // Must not return `false` here: an on* handler returning false cancels the keystroke
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
  bindLangSwitch();
  $('#wallet-home').onclick = () => void connectWallet();
  updateHomeWallet();
  codeInput.focus();
}

function canPlayOnline() {
  if(import.meta.env.VITE_LOCAL_PREVIEW==='true')return true;
  if (wallet || account?.platform) return true;
  toast(lang === 'ru' ? 'Для игры с людьми войдите через iDos или Solana-кошелёк.' : 'Sign in with iDos or a Solana wallet to play with people.');
  void connectWallet();
  return false;
}

function updateHomeWallet() {
  if (mounted !== 'home') return;
  const idosButton = $<HTMLButtonElement>('#idos-login');
  idosButton.textContent = account?.platform
    ? (lang === 'ru' ? '✓ Вы вошли в iDos' : '✓ Signed in to iDos')
    : (lang === 'ru' ? 'iDos · Войти' : 'iDos · Sign in');
  idosButton.disabled = Boolean(account?.platform);
  if(import.meta.env.VITE_LOCAL_PREVIEW==='true'){idosButton.disabled=true;idosButton.textContent='Предпросмотр · iDos отключён';}
  const button = $<HTMLButtonElement>('#wallet-home');
  button.textContent = walletBusy()
    ? (lang === 'ru' ? 'Ожидаем подпись…' : 'Waiting for signature…')
    : wallet ? `◎ ${shortAddr(wallet)}` : (lang === 'ru' ? 'Войти через кошелёк' : 'Sign in with wallet');
  button.disabled = walletBusy() || !!wallet;
  if(import.meta.env.VITE_LOCAL_PREVIEW==='true'){button.disabled=true;button.textContent='Кошелёк отключён в предпросмотре';}
  $('#wallet-hint').textContent = account?.platform
    ? (lang === 'ru' ? 'Вы вошли через iDos. Можно играть с людьми; покупки сохраняются в профиле iDos.' : 'Signed in with iDos. Play with people; purchases stay in your iDos profile.')
    : wallet
    ? (lang === 'ru' ? 'Профиль привязан к кошельку. Прогресс сохранён.' : 'Profile linked to your wallet. Progress saved.')
    : (lang === 'ru' ? 'С ботами можно играть гостем. Для игры с людьми войдите через iDos или кошелёк.' : 'Play with bots as a guest. Sign in with iDos or a wallet to play with people.');
  $<HTMLButtonElement>('#match').textContent = t('findMatch') + (wallet || account?.platform ? '' : ' · ◎');
  const blocked=Math.max(0,Math.ceil(((account?.matchmakingBlockedUntil ?? 0)-Date.now())/1000));
  if(blocked){$<HTMLButtonElement>('#match').textContent=(lang==='ru'?'Поиск через ':'Matchmaking in ')+`${Math.floor(blocked/60)}:${String(blocked%60).padStart(2,'0')}`;}
  $<HTMLButtonElement>('#match').disabled=blocked>0;
  $<HTMLButtonElement>('#create').textContent = t('createRoom') + (wallet || account?.platform ? '' : ' · ◎');
  $<HTMLButtonElement>('#join').title = wallet || account?.platform ? '' : (lang === 'ru' ? 'Войдите через iDos или кошелёк' : 'Sign in with iDos or a wallet');
  if(import.meta.env.VITE_LOCAL_PREVIEW==='true'){
    $('#wallet-hint').textContent='Отдельный тестовый профиль. Можно пробовать все игровые режимы без входа.';
    if(!blocked)$<HTMLButtonElement>('#match').textContent=t('findMatch');
    $<HTMLButtonElement>('#create').textContent=t('createRoom');
    $<HTMLButtonElement>('#join').title='';
  }
}

// ---------- lobby ----------

function playerChip(p: PlayerView) {
  return `<li class="player ${p.connected ? '' : 'away'}">
    <span class="dot" style="--c:${p.color}"></span>
    <span class="pname" style="color:${p.color}">${esc(p.name)}</span>
    ${p.id === state?.hostId ? `<span class="tag">${t('host')}</span>` : ''}
    ${p.id === myId ? `<span class="tag">${t('you')}</span>` : ''}
    ${p.bot ? `<span class="tag">${t('bot')}</span>` : ''}
    ${p.bot && state?.phase === 'lobby' && !state.practice && !state.matchmaking && state.hostId === myId ? `<button class="remove-bot" data-bot-id="${p.id}" title="${t('removeBot')}" aria-label="${t('removeBot')}: ${esc(p.name)}">×</button>` : ''}
    ${p.skin && p.skin !== 'classic' ? `<span class="tag">${SKINS.find((s) => s.id === p.skin)?.name[lang] ?? ''}</span>` : ''}
    ${p.wallet ? `<span class="tag wallet" title="${p.wallet}">◎ ${shortAddr(p.wallet)}</span>` : ''}
  </li>`;
}

function mountLobby() {
  mounted = 'lobby';
  app.innerHTML = `
    <section class="lobby">
      <div class="lobby-card">
        <div class="card-top"><p class="eyebrow">${state!.matchmaking ? t('searchingMatch') : t('roomCode')}</p>${langSwitchHtml()}</div>
        <button id="codeBtn" class="room-code" title="${t('copyInvite')}"></button>
        <p class="fine">${state!.matchmaking ? t('matchLobbyNote') : state!.practice ? t('practiceNote') : t('shareCode')}</p>
        <ul id="players" class="players"></ul>
        <div class="lobby-actions">
          <button id="start" class="primary">${t('turnOn')}</button>
          <button id="addBot">${t('addBot')}</button>
        </div>
        <p id="startHint" class="fine"></p>
        <p id="botHint" class="fine">${t('friendBotsHint')}</p>
        <button id="home">${state!.matchmaking ? t('cancelSearch') : t('mainMenu')}</button>
      </div>
      <div class="lobby-rules">
        <h2>${lang==='ru'?'Попробуйте, а не читайте':'Learn by trying'}</h2><button id="lobbyTutorial">${lang==='ru'?'Открыть мини-тренировку':'Open mini tutorial'}</button><p class="fine">${lang==='ru'?'Пульт → подсказка соседу → реакция радио. Три коротких шага.':'Your control → teammate clue → radio feedback. Three short steps.'}</p><details><summary>${lang==='ru'?'Полные правила':'Full rules'}</summary>
        ${!account || account.gamesPlayed < 3 ? `<div class="quickstart"><p class="eyebrow">${lang === 'ru' ? 'ПЕРВЫЕ ШАГИ' : 'FIRST STEPS'}</p><p>${lang === 'ru' ? '1. Посмотрите карточку «Вы знаете»: это подсказка для другого игрока. 2. В свой ход опишите её намёком, не называя предмет или число. 3. По подсказке команды выставьте свой пульт и нажмите «Я уверен». Ход можно передать вручную; таймера хода нет.' : '1. Read “You know”: that clue belongs to another player. 2. On your turn, describe it without naming the item or number. 3. Set your own control using the team’s clue, then press “I’m sure”. You can pass your turn; turns have no countdown.'}</p></div>` : ''}
        <ol>${t('rules').map((r) => `<li>${r}</li>`).join('')}</ol>
        </details>
      </div>
    </section>`;
  $('#codeBtn').onclick = async () => {
    const url = `${location.origin}${location.pathname}?room=${state!.code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t('inviteCopied'));
    } catch {
      toast(url);
    }
  };
  $('#start').onclick = () => net.send({ t: 'start' });
  $('#lobbyTutorial').onclick=()=>openTutorial();
  $('#addBot').onclick = () => net.send({ t: 'add_bot' });
  $('#home').onclick = () => {
    net.send({ t: 'leave' });
  };
  bindLangSwitch();
  updateLobby();
}

function updateLobby() {
  if (!state) return;
  $('#codeBtn').textContent = state.code;
  $('#players').innerHTML = state.players.map(playerChip).join('');
  app.querySelectorAll<HTMLButtonElement>('.remove-bot').forEach((button) => {
    button.onclick = () => net.send({ t: 'remove_bot', playerId: button.dataset.botId! });
  });
  const isHost = state.hostId === myId;
  const enough = state.players.length >= MIN_PLAYERS;
  const canManageBots = isHost && !state.practice && !state.matchmaking;
  const addBot = $<HTMLButtonElement>('#addBot');
  addBot.hidden = !canManageBots;
  addBot.disabled = state.players.length >= MIN_PLAYERS || state.players.filter((p) => !p.bot && p.connected).length < 2;
  $('#botHint').hidden = state.practice || state.matchmaking;
  const start = $<HTMLButtonElement>('#start');
  start.hidden = !isHost || state.matchmaking;
  start.disabled = !enough;
  $('#startHint').textContent = state.matchmaking
    ? state.matchStartsAt ? t('matchCountdown')(Math.max(0, Math.ceil((state.matchStartsAt - Date.now()) / 1000))) : t('matchWaiting')(state.players.length)
    : isHost
    ? enough
      ? t('ready')
      : t('waitingPlayers')(MIN_PLAYERS, state.players.length)
    : t('waitingHost');
}

// ---------- game ----------

function mountGame() {
  mounted = 'game';
  lastChatId = -1;
  app.innerHTML = `
    <section class="game">
      <header class="hud">
        <span class="hud-title">Fragment</span>
        <button id="leaveGame">${lang==='ru'?'Выйти':'Leave'}</button><button id="gameTutorial" aria-label="${lang==='ru'?'Открыть обучение':'Open tutorial'}">?</button>
        <span class="hud-item">${t('room')} <b id="hudCode"></b></span>
        <span class="hud-item trial-steps" id="hudTrial"></span>
        <span class="hud-item">${t('tries')} <b id="hudTries"></b></span>
        <span class="hud-item">${t('retunes')} <b id="hudRetunes"></b></span>
        <span class="hud-item timer"><b id="hudTime">--:--</b></span>
        ${langSwitchHtml()}
      </header>

      <div class="stage">
        <div class="scene-wrap" id="sceneWrap">
          <div id="sceneHost"></div>
          <div class="bubbles" id="bubbles"></div>
          <div class="turn-banner" id="turnBanner"></div>
        </div>
        <div class="controls play-row">
          <div class="controls-left">
            <div class="prompt" id="prompt"></div>
            <div class="game-guide" id="gameGuide" aria-live="polite"></div>
            <div class="suspicion" aria-label="Suspicion" title="${lang==='ru'?'Название или число +30 · Ошибка +20 · Решённый этап −20':'Name or digit +30 · Wrong answer +20 · Solved trial −20'}">
              <span>${t('attention')} · <b id="susPercent"></b></span>
              <div class="bar"><div id="susBar"></div></div>
            </div>
          </div>
          <div class="mine describe" id="mine"></div>
          <div class="pult">
            <p class="eyebrow">${t('yourPanel')}</p>
            <div id="myControls"></div>
            <button id="readyBtn" class="primary ready-btn"></button>
            <div class="team-ready" id="teamReady"></div>
            <p class="check-note" id="checkNote"></p>
          </div>
        </div>
      </div>

      <aside class="side">
        <div class="chat">
          <div class="chat-log" id="chatLog" aria-live="polite"></div>
          <div class="learned" id="learned"></div>
          <p class="listen-hint">${lang==='ru'?'Радио глушит названия, числа и очевидные слова испытания. Говорите образами.':'The radio jams names, numbers and the obvious words of each trial. Use images.'}</p>
          <form class="chat-form" id="chatForm" autocomplete="off">
            <input id="chatInput" maxlength="${CHAT_MAX}" placeholder="${t('speakCarefully')}" />
            <button type="submit" class="primary" id="sendBtn">${t('send')}</button>
            <button type="button" class="ghost" id="passBtn" title="${t('passTitle')}">${t('pass')}</button>
            <button type="button" class="ghost" id="askBot">${lang==='ru'?'Помощь напарника':'Teammate help'}</button>
          </form>
        </div>
        <ul class="players compact" id="gamePlayers"></ul>
      </aside>
      <div id="overlay" hidden></div>
    </section>`;

  $('#readyBtn').onclick = () => { sfx.confirm(); net.send({ t: 'ready', on: !me()?.ready }); };
  $('#leaveGame').onclick=()=>confirmLeave();
  $('#gameTutorial').onclick=()=>openTutorial();
  $('#askBot').onclick=()=>{
    const input=$<HTMLInputElement>('#chatInput');input.value=lang==='ru'?'Не понял, объясни ещё раз по-другому.':'Did not get it, explain it another way.';input.focus();
  };
  $('#passBtn').onclick = () => { sfx.pass(); net.send({ t: 'pass' }); };
  sceneKey = '';
  lastTurnId = '';
  lastBubbleId = state!.chat.at(-1)?.id ?? 0;
  const sendChat = (e: Event) => {
    e.preventDefault();
    const input = $<HTMLInputElement>('#chatInput');
    if (!input.value.trim() || state?.turnId !== myId) return;
    net.send({ t: 'chat', text: input.value });
    input.value = '';
    try { sfx.send(); } catch { /* Audio must not block chat. */ }
  };
  $<HTMLFormElement>('#chatForm').onsubmit = sendChat;
  $('#sendBtn').onclick = sendChat;
  $<HTMLInputElement>('#chatInput').onkeydown = event => { if (event.key === 'Enter') sendChat(event); };
  bindLangSwitch();
  renderMine();
  updateGame();
  $<HTMLInputElement>('#chatInput').focus();
}

const me = () => state?.players.find((p) => p.id === myId);
const myControls = () => (state?.trial?.controls ?? []).filter((c) => c.ownerId === myId);
function confirmLeave(){
  const penalty=Boolean(state?.matchmaking && state.phase==='playing');
  const dialog=document.createElement('dialog');dialog.className='tutorial-dialog';
  dialog.innerHTML=`<h2>${lang==='ru'?'Выйти из матча?':'Leave this match?'}</h2><p>${penalty?(lang==='ru'?'Новый поиск будет недоступен 5 минут. Бот займёт ваше место.':'Matchmaking will be unavailable for 5 minutes. A companion takes your place.'):(lang==='ru'?'Можно выйти без штрафа.':'You can leave without a penalty.')}</p><button data-stay>${lang==='ru'?'Остаться':'Stay'}</button><button data-leave class="primary">${lang==='ru'?'Выйти':'Leave'}</button>`;
  document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector<HTMLButtonElement>('[data-stay]')!.onclick=()=>dialog.close();
  dialog.querySelector<HTMLButtonElement>('[data-leave]')!.onclick=()=>{dialog.close();net.send({t:'leave'});};dialog.showModal();
}
const valueHtml = (v: Value, size = 34) => {
  const kind = state?.trial?.kind;
  if (kind && isDial(kind) && typeof v === 'number') return dialArt(kind, v, size / 40);
  return typeof v === 'number' ? `<span class="digit">${v}</span>` : glyphSvg(v, '#e3ddcf', size);
};
// A wave is set in two halves; keep the half you picked until the other one is chosen
const wavePicks = new Map<string, { h?: number; d?: number }>();

// Your own control(s): pick a picture, or turn a digit wheel. Only you see what you set.
function renderMyControls() {
  setArtLang(lang === 'ru');
  const s = state!;
  const playing = s.phase === 'playing';
  $('#myControls').innerHTML = myControls()
    .map((c) => {
      const current = priv?.mine[c.id] ?? null;
      let body: string;
      const kind = s.trial!.kind;
      const dis = playing ? '' : 'disabled';
      if (kind === 'wave') {
        const pickNow = wavePicks.get(c.id) ?? (typeof current === 'number' ? { h: waveHeight(current), d: waveDensity(current) } : {});
        const preview = pickNow.h !== undefined && pickNow.d !== undefined ? waveValue(pickNow.h, pickNow.d) : null;
        const row = (part: 'h' | 'd', names: string[]) => `<div class="seg">${names.map((n, i) => `<button class="seg-btn ${pickNow[part] === i ? 'chosen' : ''}" data-wave="${c.id}" data-part="${part}" data-value="${i}" ${dis}>${n}</button>`).join('')}</div>`;
        body = `<div class="wave-control">${waveSvg(preview, 300, 110)}
          <span class="seg-label">${lang === 'ru' ? 'Высота' : 'Height'}</span>${row('h', lang === 'ru' ? ['низкая', 'средняя', 'высокая'] : ['low', 'medium', 'tall'])}
          <span class="seg-label">${lang === 'ru' ? 'Частота' : 'Spacing'}</span>${row('d', lang === 'ru' ? ['редкая', 'средняя', 'частая'] : ['sparse', 'medium', 'dense'])}</div>`;
      } else if (kind === 'cassette') {
        const n = typeof current === 'number' ? current : null;
        body = `<div class="tape-control">${tapeSvg(n, 320)}<div class="tape-hits">${Array.from({ length: TAPE_FRAMES }, (_, i) => `<button class="tape-hit" data-control="${c.id}" data-value="${i + 1}" ${dis} aria-label="${i + 1}"></button>`).join('')}</div></div>
          <p class="fine center">${lang === 'ru' ? 'Нажми на кадр, до которого мотать' : 'Tap the frame to wind up to'}</p>`;
      } else if (kind === 'antenna') {
        const d = typeof current === 'number' ? current : null;
        body = `<div class="antenna-control">${antennaSvg(d, 180)}${Array.from({ length: 8 }, (_, i) => {
          // the dial is drawn with a margin for its landmarks, so the ring is 180/256 of the box
          const a = (i * Math.PI) / 4, x = 50 + 31 * Math.sin(a), y = 50 - 31 * Math.cos(a);
          return `<button class="antenna-hit ${d === i ? 'chosen' : ''}" style="left:${x}%;top:${y}%" data-control="${c.id}" data-value="${i}" ${dis} aria-label="${i}"></button>`;
        }).join('')}</div>`;
      } else if (kind === 'equalizer' || kind === 'morse') {
        // Each click flips one bar or one signal; an untouched panel starts all low / all short
        const v = typeof current === 'number' ? current : 0;
        const art = kind === 'equalizer' ? equalizerSvg(typeof current === 'number' ? current : null, 240) : morseSvg(typeof current === 'number' ? current : null, 260);
        const names = kind === 'equalizer' ? (lang === 'ru' ? ['бас', 'голос', 'писк'] : ['bass', 'voice', 'treble']) : (lang === 'ru' ? ['первый', 'второй', 'третий'] : ['first', 'second', 'third']);
        body = `<div class="bits-control ${kind}">${art}<div class="bits-row">${[0, 1, 2].map((i) => {
          const on = typeof current === 'number' && bitAt(current, i) === 1;
          const word = kind === 'equalizer' ? (on ? (lang === 'ru' ? '▲ выше' : '▲ up') : (lang === 'ru' ? '▼ ниже' : '▼ down')) : (on ? (lang === 'ru' ? '— длинно' : '— long') : (lang === 'ru' ? '• коротко' : '• short'));
          return `<button class="seg-btn ${on ? 'chosen' : ''}" data-control="${c.id}" data-value="${v ^ (4 >> i)}" ${dis}><small>${names[i]}</small><br>${word}</button>`;
        }).join('')}</div></div>`;
      } else if (kind === 'scale') {
        const v = typeof current === 'number' ? current : null;
        body = `<div class="scale-control">${scaleSvg(v, c.scale ?? [], 300, '#e3ddcf', (c.scale ?? []).map(glyphName))}<div class="scale-hits">${Array.from({ length: 9 }, (_, i) => `<button class="scale-hit ${v === i ? 'chosen' : ''}" data-control="${c.id}" data-value="${i}" ${dis} aria-label="${i}"></button>`).join('')}</div></div>
          <p class="fine center">${lang === 'ru' ? 'Нажми под картинкой или между ними' : 'Tap under a picture or between two'}</p>`;
      } else if (kind === 'wires') {
        const v = typeof current === 'number' ? current : null;
        body = `<div class="wires-control">${wiresSvg(v, 200)}${Array.from({ length: 6 }, (_, i) => `<button class="socket-hit ${v === i ? 'chosen' : ''}" style="left:${(44 + (200 / 3) * ((i % 3) + 0.5)) / 288 * 100}%;top:${(18 + 38 + Math.floor(i / 3) * 62) / 176 * 100}%" data-control="${c.id}" data-value="${i}" ${dis} aria-label="${i}"></button>`).join('')}</div>`;
      } else if (kind === 'lamp') {
        const v = typeof current === 'number' ? current : null;
        body = `<div class="lamp-control">${lampSvg(v, 120)}<div class="lamp-swatches">${LAMP_COLORS.map((col, i) => `<button class="lamp-swatch ${v === i ? 'chosen' : ''}" style="--sw:${col}" data-control="${c.id}" data-value="${i}" ${dis} aria-label="${i}"></button>`).join('')}</div></div>`;
      } else if (typeof c.options[0] === 'number') {
        const v = typeof current === 'number' ? current : null;
        body = `<div class="wheel">
          <button class="ghost wheel-btn" data-control="${c.id}" data-value="${v === null ? 9 : (v + 9) % 10}" ${dis} aria-label="−">‹</button>
          <span class="wheel-digit ${v === null ? 'empty' : ''}">${v === null ? '?' : v}</span>
          <button class="ghost wheel-btn" data-control="${c.id}" data-value="${v === null ? 0 : (v + 1) % 10}" ${dis} aria-label="+">›</button>
        </div>`;
      } else {
        body = `<div class="options ${kind === 'code' ? 'lock-wheel' : ''}">${c.options
          .map(
            (o) =>
              `<button class="opt ${o === current ? 'chosen' : ''}" data-control="${c.id}" data-value="${o}" ${dis} title="${esc(glyphName(o as Glyph))}">${glyphSvg(o as Glyph, o === current ? '#121212' : '#d9d3c5', 30)}<small>${esc(glyphName(o as Glyph))}</small></button>`,
          )
          .join('')}</div>`;
      }
      const label = s.trial?.kind === 'code' ? (lang === 'ru' ? `Ваше место в коде: ${tl(c.label)}` : `Your position in the code: ${tl(c.label)}`) : tl(c.label);
      return `<div class="my-control"><p class="control-label">${esc(label)}</p>${body}</div>`;
    })
    .join('');
  app.querySelectorAll<HTMLButtonElement>('#myControls [data-wave]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.wave!, part = b.dataset.part as 'h' | 'd', cur = priv?.mine[id];
      const pickNow = { ...(wavePicks.get(id) ?? (typeof cur === 'number' ? { h: waveHeight(cur), d: waveDensity(cur) } : {})), [part]: Number(b.dataset.value) };
      wavePicks.set(id, pickNow);
      sfx.dial();
      if (pickNow.h !== undefined && pickNow.d !== undefined) {
        const value = waveValue(pickNow.h, pickNow.d);
        if (priv) priv.mine[id] = value;
        net.send({ t: 'set', control: id, value });
      }
      renderMyControls();
    };
  });
  app.querySelectorAll<HTMLButtonElement>('#myControls [data-control]').forEach((b) => {
    b.onclick = () => {
      if(!myControls().some(c=>c.id===b.dataset.control))return;
      const raw = b.dataset.value!;
      const value: Value = /^\d$/.test(raw) ? Number(raw) : (raw as Glyph);
      sfx.dial();
      // Show it right away; the server confirms
      if (priv) priv.mine[b.dataset.control!] = value;
      renderMyControls();
      net.send({ t: 'set', control: b.dataset.control!, value });
    };
  });
}

// Who is sure, and what the last check said
function renderReady() {
  const s = state!;
  const tr = s.trial;
  const mine = me();
  const allSet = myControls().every((c) => priv?.mine[c.id] != null);
  const btn = $<HTMLButtonElement>('#readyBtn');
  btn.textContent = mine?.ready ? t('notSure') : t('imSure');
  btn.classList.toggle('primary', !mine?.ready);
  btn.disabled = s.phase !== 'playing' || (!mine?.ready && !allSet);
  $('#teamReady').innerHTML = s.players
    .map((p) => `<span class="tr-chip ${p.ready ? 'on' : ''}" style="--c:${p.color}">${p.ready ? '✓' : '…'} ${esc(p.name)}</span>`)
    .join('');
  $('#checkNote').textContent = tr?.lastWrong ? t('lastWrong')(tr.lastWrong, tr.controls.length) : t('readyHint');
}


function renderMine() {
  setArtLang(lang === 'ru');
  const s = state;
  if (!priv || !s?.trial) return;
  const kind = s.trial.kind;
  // "How to say it" helps when playing with companions; tables of humans find their own words
  const withBots = s.practice || s.players.some((p) => p.bot);
  const hints = withBots ? (DESCRIBE_HINTS[kind] ?? []).map((h) => `<span class="hint-chip">${esc(tl(h))}</span>`).join('') : '';
  const parts: string[] = [];
  for (const k of priv.knows) {
    const c = s.trial.controls.find((x) => x.id === k.controlId);
    const owner = s.players.find((p) => p.id === c?.ownerId);
    const big = isDial(kind) && typeof k.value === 'number' ? dialArt(kind, k.value, kind === 'lamp' ? 1.3 : 1.6, '#e3ddcf', c?.scale ?? [], (c?.scale ?? []).map(glyphName)) : valueHtml(k.value, 96);
    parts.push(`<div class="describe-card" style="--owner:${owner?.color ?? '#999'}">
      <p class="describe-to">${lang === 'ru' ? 'Опиши для' : 'Describe for'} <b>${esc(owner?.name ?? '?')}</b>${owner?.bot ? ` <span class="tag">${t('bot')}</span>` : ''}</p>
      <div class="describe-art">${big}</div>${typeof k.value === 'string' ? `<p class="describe-name">${lang === 'ru' ? 'это' : 'it is'} <b>${esc(glyphName(k.value as Glyph))}</b></p>` : ''}${kind === 'wave' && typeof k.value === 'number' ? waveMeter(k.value, lang === 'ru') : ''}
      ${c && kind === 'code' ? `<p class="describe-sub">${esc(tl(c.label))}</p>` : ''}
      ${isCipher(kind) ? `<p class="describe-sub">${lang === 'ru' ? 'Это исходная подсказка, сосед применит правило' : 'Input clue, they apply the rule'}</p>` : ''}
    </div>`);
  }
  if (priv.hand?.length)
    parts.push(`<div class="describe-card"><p class="describe-to">${lang === 'ru' ? 'Твои карточки' : 'Your cards'}</p><div class="describe-art hand">${priv.hand.map((g) => `<span class="hand-card">${glyphSvg(g, '#e3ddcf', 50)}<small>${esc(glyphName(g))}</small></span>`).join('')}</div></div>`);
  if (parts.length && hints) parts.push(`<div class="hint-row"><span class="hint-title">${lang === 'ru' ? 'Как описать' : 'How to say it'}</span>${hints}</div>`);
  $('#mine').innerHTML = parts.join('');
}

// Radio and system lines come in both languages; players' own words are shown as typed
const msgText = (m: ChatMessage) => (lang === 'ru' && m.ru ? m.ru : m.text);

// A player's line in my language: their original, or its translation once it arrives
function playerText(m: ChatMessage) {
  const translated = !!(m.lang && m.lang !== lang && m.tr);
  return { text: translated ? m.tr! : m.text, translated };
}

const withStatic = (text: string) => esc(text).replace(/▓+/g, (x) => `<span class="static">${x}</span>`);

function formatChat(m: ChatMessage) {
  if (m.kind === 'radio') return `<div class="msg radio"><span class="who">${t('radio')}</span><span class="txt">${esc(msgText(m))}</span></div>`;
  if (m.kind === 'system') return `<div class="msg system">${esc(msgText(m))}</div>`;
  const p = state!.players.find((x) => x.id === m.from);
  const { text, translated } = playerText(m);
  const mark = translated ? ` <span class="tr-mark" title="${t('original')}: ${esc(m.text)}">${t('translated')}</span>` : '';
  // Lines that name me are for me: they are drawn green so they never get lost in the chat
  const myName = me()?.name?.trim().toLowerCase();
  const toMe = !!myName && m.from !== myId && text.toLowerCase().includes(myName);
  return `<div class="msg ${m.heard ? 'heard' : ''} ${toMe ? 'to-me' : ''}"><span class="who" style="color:${p?.color ?? '#999'}">${esc(p?.name ?? '?')}</span><span class="txt">${withStatic(text)}${mark}</span></div>`;
}

function updateChat() {
  const log = $('#chatLog');
  const last = state!.chat.at(-1)?.id ?? 0;
  if (last === lastChatId) return;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  log.innerHTML = state!.chat.map(formatChat).join('');
  if (nearBottom || lastChatId === -1) log.scrollTop = log.scrollHeight;
  lastChatId = last;
}

function updateGame() {
  const s = state!;
  $('#hudCode').textContent = s.code;
  $('#hudTries').textContent = `${s.attemptsLeft}`;
  $('#hudRetunes').textContent = `${s.retunes}`;
  $<HTMLDivElement>('#susBar').style.width = `${s.suspicion}%`;
  $('#susPercent').textContent=`${s.suspicion}%`;
  $('#susBar').classList.toggle('hot', s.suspicion >= 70);

  const tr = s.trial;
  if (tr) {
    $('#hudTrial').innerHTML = `${Array.from({ length: tr.total }, (_, i) => `<span class="step ${i < tr.index ? 'done' : i === tr.index ? 'now' : ''}"></span>`).join('')} <b>${esc(tl(tr.title))}</b>`;
    $('#prompt').innerHTML = `${trialBanner(tr, lang === 'ru')}
      <span class="task">${esc(tl(tr.task))}</span>${trialExample(tr, lang === 'ru')}${tr.kind === 'code' ? `<div class="code-order">${tr.controls.map((c) => { const owner = s.players.find((p) => p.id === c.ownerId); return `<span class="code-seat ${c.ownerId === myId ? 'mine' : ''}"><b>${esc(owner?.name ?? '?')}${c.ownerId === myId ? ` · ${t('you')}` : owner?.bot ? ` · ${t('bot')}` : ''}</b><span>${esc(tl(c.label))}</span></span>`; }).join('<span class="code-arrow" aria-hidden="true">→</span>')}</div>` : ''}`;
    if (SYMBOL_CIPHERS.includes(tr.kind)) $('#prompt').insertAdjacentHTML('beforeend', `<div class="cipher-scale"><span class="fine">${lang === 'ru' ? 'Общая шкала · слева направо' : 'Shared scale · left to right'}</span><div class="glyph-row">${tr.controls[0].options.map((g, i) => `<span class="scale-item">${glyphSvg(g as Glyph, '#e3ddcf', 25)}<small>${i + 1}</small></span>`).join('')}</div></div>`);
  }

  // Re-draw your controls only when they change (keeps clicks snappy)
  const panelKey = JSON.stringify([myId, s.phase, tr?.index, tr?.controls.map((c) => [c.id, c.ownerId]), priv?.mine, priv?.knows]);
  if ($('#myControls').dataset.trial !== `${tr?.index}:${tr?.kind}`) { wavePicks.clear(); $('#myControls').dataset.trial = `${tr?.index}:${tr?.kind}`; }
  if ($('#myControls').dataset.key !== panelKey) {
    renderMyControls();
    renderMine();
    $('#myControls').dataset.key = panelKey;
  }
  renderReady();
  updateGuide();

  $('#gamePlayers').innerHTML = s.players
    .map(
      (p) =>
        `<li class="player ${p.connected ? '' : 'away'}"><span class="dot" style="--c:${p.color}"></span><span class="pname" style="color:${p.color}">${esc(p.name)}</span>${p.bot ? `<span class="tag">${t('bot')}</span>` : ''}<span class="tag">${p.ready ? '✓ ' + t('sure') : p.botStatus==='clarifying' ? (lang==='ru'?'Уточняет подсказку':'Clarifying') : p.botStatus==='comparing' ? (lang==='ru'?'Сравнивает карточки':'Comparing cards') : p.botStatus==='waiting-clue' ? (lang==='ru'?'Ждёт описания':'Waiting for clue') : '…'}</span></li>`,
    )
    .join('');

  $('#learned').innerHTML = s.learned.length
    ? `${t('understands')} ${s.learned.map((w) => `<span class="lw">${esc(w)}</span>`).join(' ')}`
    : '';

  updateScene();
  updateTurnUi();
  updateChat();
  updateOverlay();
}

// The task line and the card to describe already say what to do; no extra step-by-step tip
function updateGuide() {
  const box = app.querySelector<HTMLElement>('#gameGuide');
  if (box) box.hidden = true;
}

// ---------- scene, camera, turns ----------

let camera: Camera | null = null;
let sceneKey = '';
let lastTurnId = '';
let lastBubbleId = 0;
const bubbles = new Map<string, { el: HTMLDivElement; until: number }>(); // by seat id or 'radio'
const translatedShown = new Set<number>();

function seatOf(id: string) {
  const i = state!.players.findIndex((p) => p.id === id);
  return i < 0 ? null : seatsFor(state!.players.length)[i];
}

function updateScene() {
  const s = state!;
  const key = s.players.map((p) => `${p.id}${p.name}${p.color}${p.skin}${JSON.stringify(p.cosmetics)}`).join('|') + JSON.stringify(s.roomStyle);
  if (key !== sceneKey) {
    sceneKey = key;
    $('#sceneHost').innerHTML = sceneSvg(s.players, myId, s.roomStyle);
    camera = new Camera($('#sceneHost').querySelector('svg')!);
    camera.focusSeat(seatOf(s.turnId));
    bubbles.forEach((b) => b.el.remove());
    bubbles.clear();
  }
  app.querySelectorAll<SVGGElement>('.seat').forEach((g) => {
    const p = s.players.find((x) => x.id === g.dataset.id);
    g.classList.toggle('active', g.dataset.id === s.turnId);
    g.classList.toggle('away', !p?.connected);
  });

  if (s.turnId !== lastTurnId) {
    lastTurnId = s.turnId;
    camera?.focusSeat(s.phase === 'playing' ? seatOf(s.turnId) : null);
    if (s.turnId === myId) setTimeout(() => app.querySelector<HTMLInputElement>('#chatInput')?.focus(), 0);
  }

  // A translation that arrived late replaces the bubble text
  for (const m of s.chat) {
    if (m.kind !== 'player' || !m.from || !m.tr || translatedShown.has(m.id) || m.id > lastBubbleId) continue;
    translatedShown.add(m.id);
    const b = bubbles.get(m.from);
    if (b && performance.now() < b.until && playerText(m).translated) b.el.innerHTML = withStatic(m.tr);
  }

  // New lines: close-up on whoever said them, and a speech bubble
  for (const m of s.chat) {
    if (m.id <= lastBubbleId) continue;
    lastBubbleId = m.id;
    if (m.kind === 'player' && m.from) {
      const seat = seatOf(m.from);
      if (seat) camera?.punchSeat(seat);
      showBubble(m.from, withStatic(playerText(m).text), false);
    } else if (m.kind === 'radio') {
      camera?.punchRadio();
      showBubble('radio', esc(msgText(m)), true);
    }
  }
}

function showBubble(id: string, html: string, radio: boolean) {
  let b = bubbles.get(id);
  if (!b) {
    const el = document.createElement('div');
    el.className = `bubble ${radio ? 'radio' : ''}`;
    $('#bubbles').append(el);
    b = { el, until: 0 };
    bubbles.set(id, b);
  }
  b.el.innerHTML = html;
  b.el.classList.remove('show');
  void b.el.offsetWidth;
  b.el.classList.add('show');
  b.until = performance.now() + 4200 + html.length * 25;
}

// Keep bubbles pinned above heads while the camera moves
function placeBubbles(now: number) {
  const wrap = app.querySelector<HTMLElement>('#sceneWrap');
  if (!wrap) return;
  const box = wrap.getBoundingClientRect();
  bubbles.forEach((b, id) => {
    const anchor =
      id === 'radio'
        ? app.querySelector('#sceneHost .radio')
        : app.querySelector(`.seat[data-id="${CSS.escape(id)}"] .head`);
    const visible = now < b.until && !!anchor;
    b.el.classList.toggle('show', visible);
    app.querySelector(`.seat[data-id="${CSS.escape(id)}"]`)?.classList.toggle('speaking', visible);
    if (!anchor || !visible) return;
    const r = anchor.getBoundingClientRect();
    const half = b.el.offsetWidth / 2 + 10;
    const x = Math.min(Math.max(r.left + r.width / 2 - box.left, half), box.width - half);
    const y = Math.max(r.top - box.top - 10, 60);
    b.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  });
}

function updateTurnUi() {
  const s = state!;
  const speaker = s.players.find((p) => p.id === s.turnId);
  const mine = s.turnId === myId && s.phase === 'playing';
  const input = $<HTMLInputElement>('#chatInput');
  input.disabled = false;
  $<HTMLButtonElement>('#sendBtn').disabled = !mine;
  $<HTMLButtonElement>('#sendBtn').textContent = mine ? t('send') : (lang === 'ru' ? 'Ждём своего хода' : 'Waiting for your turn');
  $('#passBtn').hidden = !mine;
  input.placeholder = mine ? t('yourTurnLeft')(s.turnMessagesLeft) : speaker ? t('hasFloor')(speaker.name) : t('speakCarefully');
  const banner = $('#turnBanner');
  banner.innerHTML =
    s.phase === 'playing' && speaker
      ? mine
        ? `<b>${t('yourTurn')}</b>`
        : `<span style="color:${speaker.color}">${esc(speaker.name)}</span> ${t('isSpeaking')}`
      : '';
}

function updateTurnRing() {
  // The active seat stays highlighted; there is no countdown on a player's turn.
}

function fragmentArt(f: FragmentRecord) {
  // A broken shard, unique to this fragment id
  let h = 0;
  for (const c of f.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
    const r = 70 + rnd() * 38;
    return `${(120 + r * Math.cos(a)).toFixed(1)},${(120 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const cracks = Array.from({ length: 5 }, () => {
    const a = rnd() * Math.PI * 2;
    return `<path d="M120 120 L${(120 + 95 * Math.cos(a)).toFixed(1)} ${(120 + 95 * Math.sin(a)).toFixed(1)}" />`;
  }).join('');
  const marks = f.players
    .map((p, i) => {
      const a = (i / f.players.length) * Math.PI * 2 + 0.5;
      return `<circle cx="${(120 + 42 * Math.cos(a)).toFixed(1)}" cy="${(120 + 42 * Math.sin(a)).toFixed(1)}" r="7" fill="${p.color}" />`;
    })
    .join('');
  const clip = `clip-${f.id}`;
  return `<svg class="shard sketch" viewBox="0 0 240 240"><defs><clipPath id="${clip}"><polygon points="${pts}"/></clipPath></defs><polygon points="${pts}" fill="#1c1e1f"/><g stroke="#4a4e51" stroke-width="1.4" clip-path="url(#${clip})">${cracks}</g><polygon points="${pts}" fill="none" stroke="#e3ddcf" stroke-width="2.4"/>${marks}<circle cx="120" cy="120" r="12" fill="none" stroke="#e3ddcf" stroke-width="2"/></svg>`;
}

function updateOverlay() {
  const s = state!;
  const ov = $('#overlay');
  if (s.phase === 'playing') {
    ov.hidden = true;
    ov.dataset.phase = '';
    return;
  }
  if (ov.dataset.phase === s.phase && ov.dataset.host === String(s.hostId === myId)) return;
  ov.dataset.phase = s.phase;
  ov.dataset.host = String(s.hostId === myId);
  const again = s.hostId === myId ? `<button id="again" class="primary">${t('backToRoom')}</button>` : `<p class="fine">${t('waitingHostShort')}</p>`;

  if (s.phase === 'won' && s.fragment) {
    const victory = me()?.cosmetics?.victory ?? 'victory-default';
    ov.dataset.victory = victory;
    const f = s.fragment;
    const mm = `${Math.floor(f.seconds / 60)}:${String(f.seconds % 60).padStart(2, '0')}`;
    ov.innerHTML = `
      <div class="fragment-card">
        ${fragmentArt(f)}
        <div>
          <p class="eyebrow">${t('radioOpen')}</p>
          <h2>${t('fragment')} ${esc(f.id)}</h2>
          <p class="fine">${t('openedBy')}</p>
          <ul class="players compact">${f.players.map((p) => `<li class="player"><span class="dot" style="--c:${p.color}"></span><span class="pname" style="color:${p.color}">${esc(p.name)}</span>${p.wallet ? `<span class="tag wallet">◎ ${shortAddr(p.wallet)}</span>` : ''}</li>`).join('')}</ul>
          <p class="fine">${t('trialsPassed')} ${f.trials.map((x) => esc(tl(x))).join(' · ')}</p>
          <p class="fine">${t('language_')}</p>
          <div class="lexicon">${
            f.lexicon.length
              ? f.lexicon
                  .map((w) => (f.cracked.includes(w) ? `<span class="lw cracked" title="${t('crackedTitle')}">${esc(w)}</span>` : `<span class="lw">${esc(w)}</span>`))
                  .join('')
              : `<span class="fine">${t('barelySpoke')}</span>`
          }</div>
          <div class="stats">
            <div><b>${mm}</b><span>${t('time')}</span></div>
            <div><b>${f.heard}</b><span>${t('overheard')}</span></div>
            <div><b>${f.retunes}</b><span>${t('retunesStat')}</span></div>
            <div><b>${f.wrong}</b><span>${t('wrongAnswers')}</span></div>
          </div>
          <p class="seal">${t('seal')}</p>
          ${again}
        </div>
      </div>`;
  } else {
    delete ov.dataset.victory;
    ov.innerHTML = `
      <div class="lost-card">
        <p class="eyebrow">${s.lostReason === 'time' ? t('timeUp') : t('noTries')}</p>
        <h2>${t('keepsVoices')}</h2>
        <p class="fine">${t('lostStats')(s.retunes, s.learned.length)}</p>
        ${again}
      </div>`;
  }
  if (s.phase === 'won' && ov.dataset.victory !== 'victory-default') {
    const effect = document.createElement('div'); effect.className = 'victory-particles'; effect.setAttribute('aria-hidden', 'true');
    effect.innerHTML = Array.from({length:18},(_,i)=>`<i style="--x:${(i * 37) % 100}%;--y:${(i * 23) % 100}%;--delay:${i * .12}s">${ov.dataset.victory === 'victory-stars' ? '✧' : ov.dataset.victory === 'victory-rings' ? '◯' : '·'}</i>`).join('');
    ov.append(effect);
  }
  ov.hidden = false;
  const btn = ov.querySelector<HTMLButtonElement>('#again');
  if (btn) btn.onclick = () => net.send({ t: 'again' });
}

// ---------- effects ----------

function flashStatic(ms: number, strong = false) {
  if (!settings.flashes || settings.reducedMotion) return;
  const el = document.getElementById('static')!;
  el.classList.add(strong ? 'strong' : 'on');
  setTimeout(() => el.classList.remove('on', 'strong'), ms);
}

function handleFx(kind: Extract<ServerMessage, { t: 'fx' }>['kind']) {
  const wrap = app.querySelector('#sceneWrap');
  if (kind === 'heard') {
    sfx.heard();
    if (!settings.reducedMotion) shakeNeedle();
    flashStatic(250);
  } else if (kind === 'learned') {
    sfx.learned();
    if (!settings.reducedMotion) shakeNeedle(500);
  } else if (kind === 'wrong') {
    sfx.wrong();
    wrap?.classList.remove('shake');
    void (wrap as HTMLElement | null)?.offsetWidth;
    if (!settings.reducedMotion) wrap?.classList.add('shake');
  } else if (kind === 'retune') {
    sfx.retune();
    if (!settings.reducedMotion) shakeNeedle(1600);
    flashStatic(1300, true);
  } else if (kind === 'open') {
    sfx.open();
  } else if (kind === 'turn') {
    sfx.turn();
  } else if (kind === 'trial') {
    sfx.open();
    flashStatic(700, true);
    toast(t('nextTrial'), 'radio');
  }
}

// ---------- language ----------

function bindLangSwitch() {
  app.querySelectorAll<HTMLButtonElement>('.lang-switch button').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.lang === lang) return;
      setLang(b.dataset.lang as 'en' | 'ru');
      window.dispatchEvent(new Event('fragment:language'));
    };
  });
}

// ---------- routing ----------

function render() {
  setSoundscape(state?.phase === 'playing', state?.suspicion ?? 0);
  if (!state) {
    if (mounted !== 'home') mountHome();
    placeSettingsButton();
    placeShopButton();
    placeProfileButton();
    return;
  }
  if (state.phase === 'lobby') {
    if (mounted !== 'lobby') mountLobby();
    else updateLobby();
  } else {
    if (mounted !== 'game') mountGame();
    else updateGame();
  }
  placeSettingsButton();
  placeShopButton();
  placeProfileButton();
}

net.onMessage = (m) => {
  handleShopMessage(m);
  handleProfileMessage(m);
  void handleWalletMessage(m);
  switch (m.t) {
    case 'profile':
      wallet = m.profile.wallet ?? '';
      account = m.profile;
      if (m.profile.nickname) {
        savePrefs(m.profile.nickname, prefs().color);
        const input = document.querySelector<HTMLInputElement>('#name');
        if (input) input.value = m.profile.nickname;
      }
      updateHomeWallet();
      break;
    case 'reward':
      if (m.reward.receipt) void platformReward(m.reward.receipt, message => net.send(message)).catch(() => toast(lang === 'ru' ? 'Награда в Сигналах ожидает активации или подтверждения' : 'Signals reward awaits activation or confirmation'));
      if (m.reward.amount > 0) toast(`+${m.reward.amount} ${lang === 'ru' ? 'Сигналов' : 'Signals'} · ${lang === 'ru' ? 'Баланс' : 'Balance'}: ${m.reward.balance}`);
      break;
    case 'left':
      saveSession(null);
      state = null;
      priv = null;
      myId = '';
      mounted = null;
      history.replaceState(null, '', location.pathname);
      render();
      break;
    case 'joined':
      myId = m.playerId;
      saveSession({ code: m.code, playerId: m.playerId });
      history.replaceState(null, '', `${location.pathname}?room=${m.code}`);
      if (wallet) net.send({ t: 'wallet', address: wallet });
      break;
    case 'state':
      state = m.state;
      render();
      break;
    case 'private': {
      priv = m.info;
      if (mounted === 'game') {
        renderMine();
        updateGame();
      }
      break;
    }
    case 'heard':
      toast(`${t('heardYou')} <b>${m.words.map(esc).join(', ')}</b><br>${lang==='ru'?'Запретное слово: +30. Скажите образом или через ориентир.':'Direct item name or number: +30. Describe it indirectly.'}`, 'radio');
      break;
    case 'fx':
      handleFx(m.kind);
      break;
    case 'error':
      const practiceButton = app.querySelector<HTMLButtonElement>('#practice');
      if (practiceButton) { practiceButton.disabled = false; practiceButton.textContent = t('playBots'); }
      const matchButton = app.querySelector<HTMLButtonElement>('#match');
      if (matchButton) matchButton.disabled = false;
      if (/no longer|no room/i.test(m.message) && savedSession()) {
        saveSession(null);
        state = null;
        render();
      }
      toast(esc(lang === 'ru' && m.ru ? m.ru : m.message), 'error');
      break;
  }
};

net.onStatus = (online) => {
  document.body.dataset.offlineText = t('offline');
  document.body.classList.toggle('offline', !online);
};

// ---------- loops ----------

let boilSeed = 1;
let lastUrgency = -1;
setInterval(() => {
  if (settings.reducedMotion) return;
  document.getElementById('boilNoise')?.setAttribute('seed', String((boilSeed = (boilSeed % 4) + 1)));
}, 140);

function frame(t: number) {
  if(mounted==='home' && account?.matchmakingBlockedUntil)updateHomeWallet();
  if (mounted === 'lobby' && state?.matchmaking && state.matchStartsAt) {
    const hint = app.querySelector('#startHint');
    if (hint) hint.textContent = tMatchCountdown(state.matchStartsAt);
  }
  const radio = app.querySelector<HTMLElement>('#sceneWrap, .home-radio');
  if (radio) updateRadio(radio, state?.phase === 'playing' ? state.suspicion : mounted === 'home' ? 35 : 10, t);
  if (mounted === 'game') {
    camera?.update(t);
    placeBubbles(t);
    updateTurnRing();
  }
  if (state?.phase === 'playing' && mounted === 'game') {
    const left = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
    const el = app.querySelector('#hudTime');
    if (el) {
      el.textContent = state.endsAt ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `∞ · ${lang==='ru'?'тренировка':'practice'}`;
      el.classList.toggle('low', Boolean(state.endsAt) && left <= 60);
    }
    if (left > 0 && left <= 60 && left % 30 === 0 && lastUrgency !== left) {
      lastUrgency = left;
      sfx.hurry();
    }
  }
  requestAnimationFrame(frame);
}

function tMatchCountdown(startsAt: number) {
  return t('matchCountdown')(Math.max(0, Math.ceil((startsAt - Date.now()) / 1000)));
}

unlockAudio();
initSettingsUI();
initShop((message) => net.send(message));
initProfileUI((message) => net.send(message));
initWalletAuth((message) => net.send(message), (message, error) => {
  toast(esc(message), error ? 'error' : '');
  window.dispatchEvent(new CustomEvent('fragment:wallet-notice', { detail: message }));
});
window.addEventListener('fragment:wallet-status', updateHomeWallet);
window.addEventListener('fragment:language', () => {
  mounted = null;
  document.body.dataset.offlineText = t('offline');
  render();
});
document.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('button')) sfx.key();
});
render();
net.connect();
requestAnimationFrame(frame);

document.addEventListener('click', e => { if ((e.target as HTMLElement).closest('#idos-login') && !account?.platform) platformLogin(); });
