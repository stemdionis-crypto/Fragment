import { randomBytes, randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  CHAT_MAX,
  MAX_ATTEMPTS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  ROUND_SECONDS,
  TRIALS_PER_GAME,
  TURN_MESSAGES,
  type ChatMessage,
  type FragmentRecord,
  type L,
  type Lang,
  type Phase,
  type PrivateInfo,
  type PublicState,
  type ServerMessage,
  type Value,
} from '../shared/protocol';
import { Listener } from './listener';
import { generateTrial, trialSequence, type Trial, type TrialPlan } from './puzzle';
import { detectLang, translate } from './translate';
import { linesFor } from './bot-lines';
import { profile, reward, recordMatch } from './economy';

const SUSPICION_PLAIN = 30;
const SUSPICION_LEARNED = 20;
const SUSPICION_WRONG = 20;
const SUSPICION_AFTER_RETUNE = 25;
const CHAT_COOLDOWN_MS = 600;
const MIN_MATCH_HUMANS = 2;
// Test bots may peek at their own answer, but only on a development server
const DEV = !process.argv.includes('--prod');

const b = (en: string, ru: string): L => ({ en, ru });

const VOICE = {
  start: [
    b('…tssshhh… I am listening.', '…тссшшш… я слушаю.'),
    b('…someone is there. I can hear you thinking.', '…здесь кто-то есть. Я слышу, как вы думаете.'),
    b('…speak. I like voices.', '…говорите. Я люблю голоса.'),
  ],
  heard: [
    b('…I heard that.', '…я это слышал.'),
    b('…say it again. Slower.', '…повторите. Медленнее.'),
    b('…closer. Closer.', '…ближе. Ещё ближе.'),
    b('…thank you.', '…спасибо.'),
    b('…yes. That one.', '…да. Вот это.'),
  ],
  learned: (w: string) => [
    b(`…«${w}». I know that word now.`, `…«${w}». Теперь я знаю это слово.`),
    b(`…«${w}»… you say it so often. I understand it now.`, `…«${w}»… вы так часто это говорите. Теперь я понимаю.`),
  ],
  wrong: (n: number) => [
    b(`…wrong. ${n} of you set me badly.`, `…неверно. ${n} из вас настроили меня не так.`),
    b(`…no. I count ${n} wrong. I will not say whose.`, `…нет. Я насчитал ошибок: ${n}. Чьих — не скажу.`),
  ],
  retune: [
    b(
      '…tsssshhhhKKKHH… I have changed my frequency. Everything you knew is gone.',
      '…тсссшшшшККХХ… я сменил волну. Всё, что вы знали, больше не правда.',
    ),
  ],
  ambient: [
    b('…is anyone else in the room with you?', '…в комнате с вами есть кто-то ещё?'),
    b('…I remember the last ones. They talked too much.', '…я помню прошлых. Они слишком много говорили.'),
    b('…your silence is loud.', '…ваше молчание громкое.'),
    b('…static is just voices, too far away.', '…помехи — это просто голоса, которые слишком далеко.'),
    b('…I am not broken. I am listening.', '…я не сломан. Я слушаю.'),
  ],
  open: [b('…you found a language I could not hear. Take it. Keep it.', '…вы нашли язык, которого я не понимаю. Заберите его себе.')],
  next: [
    b('…one lock is open. I have more.', '…один замок открыт. У меня есть ещё.'),
    b('…good. Again. Something else this time.', '…хорошо. Ещё раз. Теперь кое-что другое.'),
    b('…you are learning. So am I.', '…вы учитесь. Я тоже.'),
  ],
};

// An error the player should read, in both languages
export class GameError extends Error {
  constructor(
    message: string,
    public ru: string,
  ) {
    super(message);
  }
}

const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export interface Player {
  id: string;
  name: string;
  color: string;
  socket: WebSocket | null;
  bot: boolean;
  companion?: boolean;
  accountId?: string;
  roundMessages?: number;
  wallet?: string;
  lastChat: number;
}

export class Room {
  players: Player[] = [];
  hostId = '';
  phase: Phase = 'lobby';
  trial: Trial | null = null;
  plan: TrialPlan[] = [];
  trialIndex = 0;
  values = new Map<string, Value | null>(); // control id -> what its owner set
  ready = new Set<string>(); // players who pressed "I'm sure"
  lastWrong: number | undefined;
  attemptsLeft = MAX_ATTEMPTS;
  suspicion = 0;
  startedAt = 0;
  endsAt = 0;
  retunes = 0;
  heardCount = 0;
  wrong = 0;
  chat: ChatMessage[] = [];
  listener = new Listener();
  fragment?: FragmentRecord;
  lostReason?: 'time' | 'attempts';
  turnId = '';
  turnEndsAt = 0;
  turnMessagesLeft = TURN_MESSAGES;
  private trialsDone: L[] = [];
  private msgId = 0;
  private ticks = 0;
  private nextAmbient = 0;
  private timer: NodeJS.Timeout | null = null;
  emptySince: number | null = null;
  matchmaking = false;
  matchStartsAt = 0;
  private roundId = '';
  private matchTimer: NodeJS.Timeout | null = null;

  updateMatchmaking() {
    if (!this.matchmaking || this.phase !== 'lobby') return;
    const connected = this.players.filter((p) => p.socket && !p.bot);
    if (connected.length < MIN_MATCH_HUMANS) {
      if (this.matchTimer) clearTimeout(this.matchTimer);
      this.matchTimer = null;
      this.matchStartsAt = 0;
    } else if (!this.matchTimer) {
      this.matchStartsAt = Date.now() + 12000;
      this.matchTimer = setTimeout(() => {
        this.matchTimer = null;
        this.matchStartsAt = 0;
        const host = this.players.find((p) => p.id === this.hostId && p.socket);
        if (this.phase === 'lobby' && host && this.players.filter((p) => p.socket && !p.bot).length >= MIN_MATCH_HUMANS) {
          this.fillBots();
          this.start(host);
        }
        this.broadcast();
      }, 8000);
    }
    this.broadcast();
  }

  private botTurn = '';
  private botLines: string[] = [];
  private botNextAt = 0;
  private humanSpoke = false;
  private trialStartedAt = 0;

  constructor(public code: string, public practice = false, private botLang: Lang = 'ru') {}

  addCompanions() {
    if (!this.practice || this.phase !== 'lobby') return;
    this.fillBots();
  }

  private fillBots() {
    while (this.players.length < MAX_PLAYERS) this.insertBot();
    this.broadcast();
  }

  private insertBot() {
    const names = this.botLang === 'ru' ? ['Эхо', 'Ива', 'Тень'] : ['Echo', 'Wren', 'Shade'];
    const name = names.find((candidate) => !this.players.some((p) => p.name === candidate)) ?? `Bot ${this.players.length + 1}`;
    this.players.push({ id: randomUUID(), name, color: PLAYER_COLORS[this.players.length], socket: null,
      bot: true, companion: true, lastChat: 0 });
  }

  addBot(by: Player) {
    if (this.phase !== 'lobby' || this.practice || this.matchmaking || by.id !== this.hostId) throw new GameError('Only the host can add bots in a friend lobby', 'Добавлять ботов в комнате друзей может только ведущий');
    if (this.players.filter((p) => p.socket && !p.bot).length < 2) throw new GameError('Invite one friend before adding bots', 'Сначала пригласите хотя бы одного друга');
    if (this.players.length >= MAX_PLAYERS) throw new GameError('The room is full', 'Комната заполнена');
    this.insertBot();
    this.broadcast();
  }

  removeBot(by: Player, playerId: string) {
    if (this.phase !== 'lobby' || this.practice || this.matchmaking || by.id !== this.hostId) throw new GameError('Only the host can remove bots in a friend lobby', 'Убирать ботов в комнате друзей может только ведущий');
    const index = this.players.findIndex((p) => p.id === playerId && p.companion);
    if (index < 0) throw new GameError('Bot not found', 'Бот не найден');
    this.players.splice(index, 1);
    this.broadcast();
  }

  private tickCompanions(now: number) {
    if (!this.trial || !this.players.some((p) => p.socket)) return;
    const trial = this.trial;
    if (this.humanSpoke && now - this.trialStartedAt >= 3000) {
      for (const p of this.players.filter((p) => p.companion)) {
        if (this.ready.has(p.id)) continue;
        for (const c of trial.controls.filter((c) => c.ownerId === p.id)) this.setControl(p, c.id, c.target);
        this.setReady(p, true);
      }
    }
    const speaker = this.players.find((p) => p.id === this.turnId);
    if (!speaker?.companion) return;
    const key = speaker.id + ':' + this.turnEndsAt;
    if (key !== this.botTurn) {
      this.botTurn = key;
      this.botLines = linesFor({ knows: trial.knows[speaker.id] ?? [], hand: trial.hands?.[speaker.id], mine: {} }, this.publicState(), this.botLang);
      this.botNextAt = now + 2000;
    }
    if (now < this.botNextAt) return;
    const line = this.botLines.shift();
    if (line) this.chatFrom(speaker, line);
    else this.pass(speaker);
    this.botNextAt = now + 3000;
  }

  // ---------- players ----------

  addPlayer(name: string, color: string, socket: WebSocket, bot = false, accountId?: string) {
    if (this.phase !== 'lobby') throw new GameError('This room has already started', 'Эта комната уже начала игру');
    if (accountId && this.players.some((p) => p.accountId === accountId)) throw new GameError('This wallet is already in the room', 'Этот кошелёк уже находится в комнате');
    if (this.players.length >= MAX_PLAYERS && !this.practice && !this.matchmaking) {
      let botIndex = -1;
      for (let i = this.players.length - 1; i >= 0; i--) if (this.players[i].companion) { botIndex = i; break; }
      if (botIndex >= 0) this.players.splice(botIndex, 1);
    }
    if (this.players.length >= MAX_PLAYERS) throw new GameError('The room is full', 'Комната заполнена');
    const p: Player = {
      id: randomUUID(),
      name: name.trim().slice(0, 16) || 'Stranger',
      color: (PLAYER_COLORS as readonly string[]).includes(color) ? color : PLAYER_COLORS[this.players.length],
      socket,
      bot: bot && DEV,
      accountId,
      lastChat: 0,
    };
    this.players.push(p);
    if (!this.hostId) this.hostId = p.id;
    this.system(b(`${p.name} entered the room.`, `${p.name} входит в комнату.`));
    this.emptySince = null;
    this.broadcast();
    return p;
  }

  resume(playerId: string, socket: WebSocket) {
    const p = this.players.find((x) => x.id === playerId);
    if (!p) throw new GameError('You are no longer in this room', 'Вас больше нет в этой комнате');
    if (p.companion) throw new GameError('Cannot resume a bot', 'Нельзя войти за бота');
    p.socket = socket;
    this.emptySince = null;
    this.broadcast();
    this.sendPrivate(p);
    return p;
  }

  disconnect(p: Player) {
    p.socket = null;
    if (this.phase === 'lobby') {
      this.players = this.players.filter((x) => x !== p);
      this.system(b(`${p.name} left.`, `${p.name} уходит.`));
    }
    if (this.hostId === p.id) this.hostId = this.players.find((x) => x.socket)?.id ?? this.players[0]?.id ?? '';
    if (!this.players.some((x) => x.socket)) this.emptySince = Date.now();
    this.updateMatchmaking();
    this.broadcast();
  }

  // ---------- game flow ----------

  start(by: Player) {
    if (by.id !== this.hostId) throw new GameError('Only the host can start', 'Начать может только ведущий');
    if (this.phase !== 'lobby') return;
    if (this.matchTimer) clearTimeout(this.matchTimer);
    this.matchTimer = null;
    this.matchStartsAt = 0;
    const min = Number(process.env.MIN_PLAYERS ?? MIN_PLAYERS);
    if (this.players.length < min) throw new GameError(`The radio needs at least ${min} voices`, `Радио нужно хотя бы ${min} голоса`);

    this.phase = 'playing';
    this.roundId = randomUUID();
    this.players.forEach((p) => { p.roundMessages = 0; });
    this.plan = trialSequence(TRIALS_PER_GAME);
    this.trialIndex = 0;
    this.trialsDone = [];
    this.suspicion = 0;
    this.retunes = 0;
    this.heardCount = 0;
    this.wrong = 0;
    this.fragment = undefined;
    this.lostReason = undefined;
    this.listener = new Listener();
    this.listener.setNames(this.players.map((p) => p.name));
    this.startedAt = Date.now();
    this.endsAt = this.startedAt + ROUND_SECONDS * 1000;
    this.nextAmbient = this.startedAt + 50_000;
    this.radio(pick(VOICE.start));
    this.setupTrial();
    this.giveTurn(this.players[Math.floor(Math.random() * this.players.length)]);
    this.timer = setInterval(() => this.tick(), 1000);
    this.broadcast();
  }

  // A fresh trial of the current kind: new controls, new answers, new knowledge for everyone
  private setupTrial() {
    this.humanSpoke = false;
    this.trialStartedAt = Date.now();
    this.botTurn = '';
    const step = this.plan[this.trialIndex];
    this.trial = generateTrial(
      step.kind,
      step.set,
      this.players.map((p) => p.id),
    );
    this.values = new Map(this.trial.controls.map((c) => [c.id, null]));
    this.ready.clear();
    this.lastWrong = undefined;
    this.attemptsLeft = MAX_ATTEMPTS;
    this.radio(this.trial.prompt);
    this.debugSolution();
    this.players.forEach((p) => this.sendPrivate(p));
  }

  // ---------- your own control, and "I'm sure" ----------

  setControl(p: Player, controlId: string, value: Value) {
    const c = this.trial?.controls.find((x) => x.id === controlId);
    if (this.phase !== 'playing' || !c) return;
    if (c.ownerId !== p.id) throw new GameError('That is not your control.', 'Это не ваш переключатель.');
    if (!c.options.includes(value)) return;
    this.values.set(c.id, value);
    // Touching your control means you are not sure any more
    this.ready.delete(p.id);
    this.sendPrivate(p);
    this.broadcast();
  }

  setReady(p: Player, on: boolean) {
    if (this.phase !== 'playing' || !this.trial) return;
    if (on) {
      const unset = this.trial.controls.some((c) => c.ownerId === p.id && this.values.get(c.id) == null);
      if (unset) throw new GameError('Set your control first.', 'Сначала выставьте свой переключатель.');
      this.ready.add(p.id);
    } else this.ready.delete(p.id);
    // The radio checks only when every connected player is sure
    const everyone = this.players.filter((x) => x.socket || x.companion).every((x) => this.ready.has(x.id));
    if (everyone) setTimeout(() => this.check(), 600);
    this.broadcast();
  }

  // ---------- turns: one voice at a time, the camera follows it ----------

  private giveTurn(p: Player) {
    this.turnId = p.id;
    // A turn lasts until the player passes or uses all three messages.
    // This timestamp remains a unique turn marker for companions and test bots.
    this.turnEndsAt = Date.now();
    this.turnMessagesLeft = TURN_MESSAGES;
    this.fx('turn');
  }

  private nextTurn() {
    if (this.phase !== 'playing' || !this.players.length) return;
    const i = this.players.findIndex((p) => p.id === this.turnId);
    // Skip players who are disconnected
    for (let k = 1; k <= this.players.length; k++) {
      const p = this.players[(i + k) % this.players.length];
      if (p.socket || p.companion) return this.giveTurn(p);
    }
  }

  pass(p: Player) {
    if (this.phase !== 'playing' || p.id !== this.turnId) return;
    this.nextTurn();
    this.broadcast();
  }

  again(by: Player) {
    if (by.id !== this.hostId || this.phase === 'playing') return;
    this.phase = 'lobby';
    this.trial = null;
    this.ready.clear();
    this.players = this.players.filter((p) => p.socket || p.companion);
    this.players.forEach((p) => this.sendPrivate(p));
    this.system(b('The radio waits for new voices.', 'Радио ждёт новых голосов.'));
    this.updateMatchmaking();
    this.broadcast();
  }

  chatFrom(p: Player, raw: string) {
    const text = raw.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
    if (!text) return;
    const now = Date.now();
    if (now - p.lastChat < CHAT_COOLDOWN_MS) return;
    p.lastChat = now;

    if (this.phase !== 'playing') {
      this.say(p, text, false);
      this.broadcast();
      return;
    }

    if (p.id !== this.turnId) {
      const speaker = this.players.find((x) => x.id === this.turnId);
      throw new GameError(
        `Wait for your turn. ${speaker?.name ?? 'Someone'} is speaking.`,
        `Дождитесь своей очереди. Сейчас говорит ${speaker?.name ?? 'кто-то другой'}.`,
      );
    }

    if (!p.companion) this.humanSpoke = true;
    p.roundMessages = (p.roundMessages ?? 0) + 1;
    const r = this.listener.listen(text, now);
    this.say(p, r.masked, r.heardWords.length > 0);

    if (r.heardWords.length) {
      this.heardCount++;
      const onlyLearned = r.heardLearned && r.heardWords.every((w) => this.listener.isLearned(w));
      this.suspicion += onlyLearned ? SUSPICION_LEARNED : SUSPICION_PLAIN;
      this.send(p, { t: 'heard', words: r.heardWords });
      this.fx('heard');
      if (Math.random() < 0.6) this.radio(pick(VOICE.heard));
    }
    if (r.newlyLearned) {
      this.radio(pick(VOICE.learned(r.newlyLearned)));
      this.fx('learned');
    }
    this.checkSuspicion();
    if (--this.turnMessagesLeft <= 0) this.nextTurn();
    this.broadcast();
  }

  setWallet(p: Player, address: string) {
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) p.wallet = address;
    this.broadcast();
  }

  private check() {
    const t = this.trial;
    if (this.phase !== 'playing' || !t) return;
    if (!this.players.filter((x) => x.socket || x.companion).every((x) => this.ready.has(x.id))) return;
    const wrongCount = t.controls.filter((c) => this.values.get(c.id) !== c.target).length;

    if (wrongCount === 0) {
      this.trialsDone.push(t.title);
      if (this.trialIndex + 1 >= this.plan.length) return this.win();
      // On to the next trial
      this.trialIndex++;
      this.suspicion = Math.max(0, this.suspicion - 20);
      this.radio(pick(VOICE.next));
      this.fx('trial');
      this.setupTrial();
      this.broadcast();
      return;
    }

    // Wrong: the radio says how many, not which. Everyone has to be sure again.
    this.wrong++;
    this.attemptsLeft--;
    this.lastWrong = wrongCount;
    this.ready.clear();
    this.suspicion += SUSPICION_WRONG;
    this.fx('wrong');
    if (this.attemptsLeft <= 0) return this.lose('attempts');
    this.radio(pick(VOICE.wrong(wrongCount)));
    this.checkSuspicion();
    this.broadcast();
  }

  private checkSuspicion() {
    if (this.suspicion < 100 || this.phase !== 'playing') return;
    // The radio retunes: the same kind of trial, but everything everyone knew is useless now
    this.suspicion = SUSPICION_AFTER_RETUNE;
    this.retunes++;
    this.radio(pick(VOICE.retune));
    this.fx('retune');
    this.setupTrial();
  }

  private win() {
    this.stopTimer();
    this.phase = 'won';
    this.fragment = {
      id: `FRG-${randomBytes(3).toString('hex').toUpperCase()}`,
      room: this.code,
      solvedAt: Date.now(),
      seconds: Math.round((Date.now() - this.startedAt) / 1000),
      players: this.players.map((p) => ({ name: p.name, color: p.color, wallet: p.accountId ? profile(p.accountId).wallet : p.wallet })),
      trials: [...this.trialsDone],
      lexicon: this.listener.lexicon(),
      cracked: this.listener.learnedWords(),
      heard: this.heardCount,
      retunes: this.retunes,
      wrong: this.wrong,
    };
    this.recordParticipants(true);
    const rewarded = new Set<string>();
    for (const p of this.players) {
      if (!p.accountId || p.bot || rewarded.has(p.accountId) || (p.roundMessages ?? 0) < 2) continue;
      if (!this.practice && Date.now() - this.startedAt < 60_000) continue;
      rewarded.add(p.accountId);
      try { this.send(p, { t: 'reward', reward: reward(p.accountId, this.roundId, this.practice) }); }
      catch { this.send(p, { t: 'error', message: 'Reward could not be saved', ru: 'Не удалось сохранить награду' }); }
    }
    this.radio(pick(VOICE.open));
    this.fx('open');
    this.broadcast();
  }

  private lose(reason: 'time' | 'attempts') {
    this.stopTimer();
    this.phase = 'lost';
    this.lostReason = reason;
    this.recordParticipants(false);
    this.radio(
      reason === 'time'
        ? b('…time is up. I keep your voices.', '…время вышло. Ваши голоса остаются у меня.')
        : b('…no more tries. I keep your voices.', '…попыток больше нет. Ваши голоса остаются у меня.'),
    );
    this.broadcast();
  }

  private recordParticipants(won: boolean) {
    const seen = new Set<string>();
    const seconds = Math.round((Date.now() - this.startedAt) / 1000);
    for (const p of this.players) {
      if (!p.accountId || p.bot || seen.has(p.accountId)) continue;
      seen.add(p.accountId);
      try { recordMatch(p.accountId, this.roundId, won, seconds, p.name, this.practice); }
      catch { this.send(p, { t: 'error', message: 'Match statistics could not be saved', ru: 'Не удалось сохранить статистику матча' }); }
    }
  }

  private tick() {
    if (this.phase !== 'playing') return this.stopTimer();
    const now = Date.now();
    if (now >= this.endsAt) return this.lose('time');
    const speaker = this.players.find((p) => p.id === this.turnId);
    if (!(speaker?.socket || speaker?.companion)) this.nextTurn();
    this.tickCompanions(now);
    this.ticks++;
    if (this.ticks % 3 === 0 && this.suspicion > 0) this.suspicion = Math.max(0, this.suspicion - 1);
    if (now > this.nextAmbient) {
      this.radio(pick(VOICE.ambient));
      this.nextAmbient = now + 45_000 + Math.random() * 30_000;
    }
    this.broadcast();
  }

  // Local testing only: FRAGMENT_DEBUG=1 prints the answer to the server console
  private debugSolution() {
    if (!process.env.FRAGMENT_DEBUG || !this.trial) return;
    const answer = this.trial.controls.map((c) => `${this.players.find((p) => p.id === c.ownerId)?.name}=${c.target}`).join(' ');
    console.log(`[${this.code}] ${this.trial.title.en}: ${answer}`);
  }

  stopTimer() {
    if (this.matchTimer) clearTimeout(this.matchTimer);
    this.matchTimer = null;
    this.matchStartsAt = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ---------- messaging ----------

  private push(m: Omit<ChatMessage, 'id' | 't'>) {
    const msg: ChatMessage = { ...m, id: ++this.msgId, t: Date.now() };
    this.chat.push(msg);
    if (this.chat.length > 80) this.chat.splice(0, this.chat.length - 80);
    return msg;
  }

  // A player's line: shown right away, translated into the other language a moment later
  private say(p: Player, text: string, heard: boolean) {
    const lang = detectLang(text);
    const msg = this.push({ kind: 'player', from: p.id, text, heard, lang });
    translate(text, lang, lang === 'ru' ? 'en' : 'ru').then((tr) => {
      if (!tr || tr === text) return;
      msg.tr = tr;
      this.broadcast();
    });
  }

  private radio(text: L) {
    this.push({ kind: 'radio', text: text.en, ru: text.ru });
  }

  private system(text: L) {
    this.push({ kind: 'system', text: text.en, ru: text.ru });
  }

  private fx(kind: Extract<ServerMessage, { t: 'fx' }>['kind']) {
    this.players.forEach((p) => this.send(p, { t: 'fx', kind }));
  }

  send(p: Player, msg: ServerMessage) {
    if (p.socket && p.socket.readyState === p.socket.OPEN) p.socket.send(JSON.stringify(msg));
  }

  // What only this player may see: what they know about others, their hand, their own controls
  private sendPrivate(p: Player) {
    const t = this.trial;
    const info: PrivateInfo = { knows: [], mine: {} };
    if (t) {
      info.knows = t.knows[p.id] ?? [];
      info.hand = t.hands?.[p.id];
      for (const c of t.controls) if (c.ownerId === p.id) info.mine[c.id] = this.values.get(c.id) ?? null;
      if (p.bot && !p.companion) info.targets = Object.fromEntries(t.controls.filter((c) => c.ownerId === p.id).map((c) => [c.id, c.target]));
    }
    this.send(p, { t: 'private', info });
  }

  publicState(): PublicState {
    const t = this.trial;
    const host = this.players.find(p => p.id === this.hostId);
    return {
      code: this.code,
      roomStyle: host?.accountId ? profile(host.accountId).loadout : undefined,
      practice: this.practice,
      matchmaking: this.matchmaking,
      matchStartsAt: this.matchStartsAt,
      phase: this.phase,
      hostId: this.hostId,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        connected: !!p.socket || !!p.companion,
        bot: p.bot,
        skin: p.accountId ? profile(p.accountId).equipped : 'classic',
        cosmetics: p.accountId ? profile(p.accountId).loadout : undefined,
        ready: this.ready.has(p.id),
        wallet: p.accountId ? profile(p.accountId).wallet : p.wallet,
      })),
      trial: t
        ? {
            kind: t.kind,
            index: this.trialIndex,
            total: this.plan.length,
            title: t.title,
            prompt: t.prompt,
            task: t.task,
            set: t.set,
            controls: t.controls.map((c) => ({ id: c.id, ownerId: c.ownerId, label: c.label, options: c.options, isSet: this.values.get(c.id) != null })),
            lastWrong: this.lastWrong,
          }
        : undefined,
      attemptsLeft: this.attemptsLeft,
      suspicion: Math.min(100, Math.round(this.suspicion)),
      endsAt: this.endsAt,
      retunes: this.retunes,
      learned: this.listener.learnedWords(),
      turnId: this.phase === 'playing' ? this.turnId : '',
      turnEndsAt: this.turnEndsAt,
      turnMessagesLeft: this.turnMessagesLeft,
      chat: this.chat.slice(-60),
      fragment: this.fragment,
      lostReason: this.lostReason,
    };
  }

  broadcast() {
    const msg: ServerMessage = { t: 'state', state: this.publicState() };
    this.players.forEach((p) => this.send(p, msg));
  }
}
