import './style.css';
import {
  CHAT_MAX,
  MIN_PLAYERS,
  PLAYER_COLORS,
  TURN_SECONDS,
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
import { SKINS } from '../../shared/economy';
import { connectWallet, initWalletAuth, handleWalletMessage, walletBusy } from './wallet-auth';
import { glyphSvg } from './glyphs';
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
  const { name, color } = prefs();
  const params = new URLSearchParams(location.search);
  const codeFromUrl = (params.get('room') ?? '').toUpperCase();

  app.innerHTML = `
    <section class="home">
      <div class="home-radio">${radioSvg()}</div>
      <div class="home-panel">
        <div class="home-top">${langSwitchHtml()}</div>
        <h1 class="title">Fragment</h1>
        <p class="lead">${t('lead')}</p>
        ${import.meta.env.VITE_DEMO_MODE === 'true' ? `<p class="fine demo-note">${lang === 'ru' ? 'Демо концепции · Прогресс временный и может сброситься после перезапуска сервера.' : 'Concept demo · Progress is temporary and may reset when the server restarts.'}</p>` : ''}
        <div class="home-account"><button id="wallet-home"></button></div>
        <p id="wallet-hint" class="fine"></p>

        <label for="name">${t('yourName')}</label>
        <input id="name" maxlength="16" placeholder="${t('stranger')}" value="${esc(name)}" autocomplete="off" />

        <label>${t('yourColour')}</label>
        <div class="swatches" role="radiogroup">
          ${PLAYER_COLORS.map(
            (c) => `<button class="swatch" role="radio" aria-checked="${c === color}" data-color="${c}" style="--c:${c}" title="${c}"></button>`,
          ).join('')}
        </div>

        <div class="home-actions">
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
  app.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) => {
    b.onclick = () => {
      chosen = b.dataset.color!;
      app.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    };
  });
  const nameInput = $<HTMLInputElement>('#name');
  const codeInput = $<HTMLInputElement>('#code');
  codeInput.oninput = () => (codeInput.value = normalizeCode(codeInput.value));

  $('#practice').onclick = () => {
    savePrefs(nameInput.value, chosen);
    net.send({ t: 'create', name: nameInput.value, color: chosen, practice: true, lang });
  };
  $('#match').onclick = () => {
    savePrefs(nameInput.value, chosen);
    $<HTMLButtonElement>('#match').disabled = true;
    net.send({ t: 'match', name: nameInput.value, color: chosen });
  };
  $('#create').onclick = () => {
    savePrefs(nameInput.value, chosen);
    net.send({ t: 'create', name: nameInput.value, color: chosen });
  };
  const join = () => {
    if (codeInput.value.length !== 4) return toast(t('enterCode'), 'error');
    savePrefs(nameInput.value, chosen);
    net.send({ t: 'join', code: codeInput.value, name: nameInput.value, color: chosen });
  };
  $('#join').onclick = join;
  // Must not return `false` here: an on* handler returning false cancels the keystroke
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
  bindLangSwitch();
  $('#wallet-home').onclick = () => void connectWallet();
  updateHomeWallet();
  nameInput.focus();
}

function updateHomeWallet() {
  if (mounted !== 'home') return;
  const button = $<HTMLButtonElement>('#wallet-home');
  button.textContent = walletBusy()
    ? (lang === 'ru' ? 'Ожидаем подпись…' : 'Waiting for signature…')
    : wallet ? `◎ ${shortAddr(wallet)}` : (lang === 'ru' ? 'Войти через кошелёк' : 'Sign in with wallet');
  button.disabled = walletBusy() || !!wallet;
  $('#wallet-hint').textContent = import.meta.env.VITE_DEMO_MODE === 'true'
    ? (lang === 'ru' ? 'Можно играть без кошелька. В демо привязка и прогресс действуют до сброса сервера.' : 'Play without a wallet. Demo wallet links and progress last until the server resets.')
    : wallet
    ? (lang === 'ru' ? 'Профиль привязан к кошельку. Прогресс сохранён.' : 'Profile linked to your wallet. Progress saved.')
    : (lang === 'ru' ? 'Играйте гостем или привяжите кошелёк, чтобы восстановить прогресс на другом устройстве.' : 'Play as a guest or link a wallet to restore progress on another device.');
}

// ---------- lobby ----------

function playerChip(p: PlayerView) {
  return `<li class="player ${p.connected ? '' : 'away'}">
    <span class="dot" style="--c:${p.color}"></span>
    <span class="pname" style="color:${p.color}">${esc(p.name)}</span>
    ${p.id === state?.hostId ? `<span class="tag">${t('host')}</span>` : ''}
    ${p.id === myId ? `<span class="tag">${t('you')}</span>` : ''}
    ${p.bot ? `<span class="tag">${t('bot')}</span>` : ''}
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
        </div>
        <p id="startHint" class="fine"></p>
        <button id="home">${state!.matchmaking ? t('cancelSearch') : t('mainMenu')}</button>
      </div>
      <div class="lobby-rules">
        <h2>${t('howItWorks')}</h2>
        <ol>${t('rules').map((r) => `<li>${r}</li>`).join('')}</ol>
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
  const isHost = state.hostId === myId;
  const enough = state.players.length >= MIN_PLAYERS;
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
          <div class="trial-intro" id="trialIntro" hidden></div>
        </div>
        <div class="controls">
          <div class="controls-left">
            <div class="prompt" id="prompt"></div>
            <div class="suspicion" aria-label="Suspicion">
              <span>${t('attention')}</span>
              <div class="bar"><div id="susBar"></div></div>
            </div>
          </div>
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
        <div class="mine" id="mine"></div>
        <div class="chat">
          <div class="chat-log" id="chatLog" aria-live="polite"></div>
          <div class="learned" id="learned"></div>
          <p class="listen-hint">${t('listenHint')}</p>
          <form class="chat-form" id="chatForm" autocomplete="off">
            <input id="chatInput" maxlength="${CHAT_MAX}" placeholder="${t('speakCarefully')}" />
            <button class="primary" id="sendBtn">${t('send')}</button>
            <button type="button" class="ghost" id="passBtn" title="${t('passTitle')}">${t('pass')}</button>
          </form>
        </div>
        <ul class="players compact" id="gamePlayers"></ul>
      </aside>
      <div id="overlay" hidden></div>
    </section>`;

  $('#readyBtn').onclick = () => net.send({ t: 'ready', on: !me()?.ready });
  $('#passBtn').onclick = () => net.send({ t: 'pass' });
  sceneKey = '';
  lastTurnId = '';
  introKey = '';
  lastBubbleId = state!.chat.at(-1)?.id ?? 0;
  $<HTMLFormElement>('#chatForm').onsubmit = (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>('#chatInput');
    if (!input.value.trim()) return;
    net.send({ t: 'chat', text: input.value });
    input.value = '';
  };
  bindLangSwitch();
  renderMine();
  updateGame();
  $<HTMLInputElement>('#chatInput').focus();
}

const me = () => state?.players.find((p) => p.id === myId);
const myControls = () => (state?.trial?.controls ?? []).filter((c) => c.ownerId === myId);
const valueHtml = (v: Value, size = 34) => (typeof v === 'number' ? `<span class="digit">${v}</span>` : glyphSvg(v, '#e3ddcf', size));

// Your own control(s): pick a picture, or turn a digit wheel. Only you see what you set.
function renderMyControls() {
  const s = state!;
  const playing = s.phase === 'playing';
  $('#myControls').innerHTML = myControls()
    .map((c) => {
      const current = priv?.mine[c.id] ?? null;
      let body: string;
      if (typeof c.options[0] === 'number') {
        const v = typeof current === 'number' ? current : null;
        body = `<div class="wheel">
          <button class="ghost wheel-btn" data-control="${c.id}" data-value="${v === null ? 9 : (v + 9) % 10}" ${playing ? '' : 'disabled'} aria-label="−">‹</button>
          <span class="wheel-digit ${v === null ? 'empty' : ''}">${v === null ? '?' : v}</span>
          <button class="ghost wheel-btn" data-control="${c.id}" data-value="${v === null ? 0 : (v + 1) % 10}" ${playing ? '' : 'disabled'} aria-label="+">›</button>
        </div>`;
      } else {
        body = `<div class="options">${c.options
          .map(
            (o) =>
              `<button class="opt ${o === current ? 'chosen' : ''}" data-control="${c.id}" data-value="${o}" ${playing ? '' : 'disabled'}>${glyphSvg(o as Glyph, o === current ? '#121212' : '#d9d3c5', 30)}</button>`,
          )
          .join('')}</div>`;
      }
      const label = s.trial?.kind === 'code' ? (lang === 'ru' ? `Ваше место в коде: ${tl(c.label)}` : `Your position in the code: ${tl(c.label)}`) : tl(c.label);
      return `<div class="my-control"><p class="control-label">${esc(label)}</p><p class="fine">${lang === 'ru' ? 'Здесь выставляйте свой ответ по подсказке другого игрока. Карточка «Вы знаете» предназначена для соседа.' : 'Set your own answer here using another player’s clue. The “You know” card is for your teammate.'}</p>${body}</div>`;
    })
    .join('');
  app.querySelectorAll<HTMLButtonElement>('#myControls [data-control]').forEach((b) => {
    b.onclick = () => {
      const raw = b.dataset.value!;
      const value: Value = /^\d$/.test(raw) ? Number(raw) : (raw as Glyph);
      sfx.key();
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
  const s = state;
  if (!priv || !s?.trial) return;
  const parts: string[] = [];
  if (priv.knows.length) {
    const rows = priv.knows
      .map((k) => {
        const c = s.trial!.controls.find((x) => x.id === k.controlId);
        const owner = s.players.find((p) => p.id === c?.ownerId);
        return `<li class="know-row">
          <span class="know-who"><span class="fine">${lang === 'ru' ? 'Подсказка для' : 'Clue for'}</span><span class="pname" style="color:${owner?.color ?? '#999'}">${esc(owner?.name ?? '?')} ${owner?.bot ? `<span class="tag">${t('bot')}</span>` : ''}</span><span class="fine">${s.trial!.kind === 'code' ? (lang === 'ru' ? 'Место в коде' : 'Position in the code') : (lang === 'ru' ? 'Пульт' : 'Control')}: ${c ? esc(tl(c.label)) : ''}</span></span>
          <span class="know-value">${valueHtml(k.value, 40)}<span class="fine">${lang === 'ru' ? 'Ответ соседа' : 'Teammate’s answer'}</span></span>
        </li>`;
      })
      .join('');
    parts.push(`<div class="piece"><p class="eyebrow">${t('youKnow')}</p><p class="fine">${t('youKnowHint')}</p><ul class="know-list">${rows}</ul></div>`);
  }
  if (priv.hand?.length)
    parts.push(
      `<div class="piece"><p class="eyebrow">${t('knowHand')}</p><p class="fine">${t('knowHandHint')}</p><div class="glyph-row">${priv.hand
        .map((g) => glyphSvg(g, '#e3ddcf', 38))
        .join('')}</div></div>`,
    );
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
  return `<div class="msg ${m.heard ? 'heard' : ''}"><span class="who" style="color:${p?.color ?? '#999'}">${esc(p?.name ?? '?')}</span><span class="txt">${withStatic(text)}${mark}</span></div>`;
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
  $('#susBar').classList.toggle('hot', s.suspicion >= 70);

  const tr = s.trial;
  if (tr) {
    $('#hudTrial').innerHTML = `${Array.from({ length: tr.total }, (_, i) => `<span class="step ${i < tr.index ? 'done' : i === tr.index ? 'now' : ''}"></span>`).join('')} <b>${esc(tl(tr.title))}</b>`;
    $('#prompt').innerHTML = `<span class="eyebrow">${t('trialOf')(tr.index + 1, tr.total)}</span>
      <span class="trial-name">${esc(tl(tr.title))}</span>
      <span class="task">${esc(tl(tr.task))}</span>
      <span class="q">${esc(tl(tr.prompt))}</span>${tr.kind === 'code' ? `<div class="code-order">${tr.controls.map((c) => { const owner = s.players.find((p) => p.id === c.ownerId); return `<span class="code-seat ${c.ownerId === myId ? 'mine' : ''}"><b>${esc(owner?.name ?? '?')}${c.ownerId === myId ? ` · ${t('you')}` : owner?.bot ? ` · ${t('bot')}` : ''}</b><span>${esc(tl(c.label))}</span></span>`; }).join('<span class="code-arrow" aria-hidden="true">→</span>')}</div>` : ''}`;
    maybeShowIntro(tr);
  }

  // Re-draw your controls only when they change (keeps clicks snappy)
  const panelKey = JSON.stringify([s.phase, tr?.index, tr?.controls.map((c) => c.id), priv?.mine]);
  if ($('#myControls').dataset.key !== panelKey) {
    renderMyControls();
    renderMine();
    $('#myControls').dataset.key = panelKey;
  }
  renderReady();

  $('#gamePlayers').innerHTML = s.players
    .map(
      (p) =>
        `<li class="player ${p.connected ? '' : 'away'}"><span class="dot" style="--c:${p.color}"></span><span class="pname" style="color:${p.color}">${esc(p.name)}</span>${p.bot ? `<span class="tag">${t('bot')}</span>` : ''}<span class="tag">${p.ready ? '✓ ' + t('sure') : '…'}</span></li>`,
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

// ---------- scene, camera, turns ----------

let camera: Camera | null = null;
let sceneKey = '';
let lastTurnId = '';
let lastBubbleId = 0;
const bubbles = new Map<string, { el: HTMLDivElement; until: number }>(); // by seat id or 'radio'
const translatedShown = new Set<number>();

// ---------- trial intro: a clear card each time a new trial starts ----------

let introKey = '';
let introTimer = 0;

function maybeShowIntro(tr: NonNullable<PublicState['trial']>) {
  if (state?.phase !== 'playing') return;
  const key = `${tr.index}:${tr.kind}`;
  if (key === introKey) return;
  introKey = key;
  const box = $('#trialIntro');
  const mine = myControls().map((c) => esc(tl(c.label))).join(' + ');
  box.innerHTML = `
    <p class="eyebrow">${t('introTrial')(tr.index + 1, tr.total)}</p>
    <h2>${esc(tl(tr.title))}</h2>
    <p class="intro-task">${esc(tl(tr.task))}</p>
    ${mine ? `<p class="intro-part">${t('yourPart')} <b>${mine}</b></p>` : ''}
    <button class="primary" id="introOk">${t('gotIt')}</button>`;
  box.hidden = false;
  const close = () => {
    box.hidden = true;
    clearTimeout(introTimer);
  };
  box.querySelector<HTMLButtonElement>('#introOk')!.onclick = close;
  clearTimeout(introTimer);
  introTimer = window.setTimeout(close, 14000);
}

function seatOf(id: string) {
  const i = state!.players.findIndex((p) => p.id === id);
  return i < 0 ? null : seatsFor(state!.players.length)[i];
}

function updateScene() {
  const s = state!;
  const key = s.players.map((p) => `${p.id}${p.name}${p.color}${p.skin}`).join('|');
  if (key !== sceneKey) {
    sceneKey = key;
    $('#sceneHost').innerHTML = sceneSvg(s.players, myId);
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
  input.disabled = !mine;
  $<HTMLButtonElement>('#sendBtn').disabled = !mine;
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
  if (!state || state.phase !== 'playing') return;
  const left = Math.max(0, state.turnEndsAt - Date.now()) / (TURN_SECONDS * 1000);
  app.querySelector<SVGCircleElement>(`.seat.active .turn-ring`)?.setAttribute('stroke-dashoffset', String(452 * (1 - left)));
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
    ov.innerHTML = `
      <div class="lost-card">
        <p class="eyebrow">${s.lostReason === 'time' ? t('timeUp') : t('noTries')}</p>
        <h2>${t('keepsVoices')}</h2>
        <p class="fine">${t('lostStats')(s.retunes, s.learned.length)}</p>
        ${again}
      </div>`;
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
  if (!state) {
    if (mounted !== 'home') mountHome();
    placeSettingsButton();
    placeShopButton();
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
}

net.onMessage = (m) => {
  handleShopMessage(m);
  void handleWalletMessage(m);
  switch (m.t) {
    case 'profile':
      wallet = m.profile.wallet ?? '';
      updateHomeWallet();
      break;
    case 'reward':
      toast(`+${m.reward.amount} ${lang === 'ru' ? 'Сигнала' : 'Signal'} · ${lang === 'ru' ? 'Баланс' : 'Balance'}: ${m.reward.balance}`);
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
      setSoundscape(state.phase === 'playing', state.suspicion);
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
      toast(`${t('heardYou')} <b>${m.words.map(esc).join(', ')}</b>`, 'radio');
      break;
    case 'fx':
      handleFx(m.kind);
      break;
    case 'error':
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
setInterval(() => {
  if (settings.reducedMotion) return;
  document.getElementById('boilNoise')?.setAttribute('seed', String((boilSeed = (boilSeed % 4) + 1)));
}, 140);

function frame(t: number) {
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
      el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      el.classList.toggle('low', left <= 60);
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
