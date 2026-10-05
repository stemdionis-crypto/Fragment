// Interface language. The server sends its own text (radio lines, trials, clues) in both
// languages, so every player sees the whole game in the language they picked.

import type { L, Lang } from '../../shared/protocol';

const STORAGE_KEY = 'fragment.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export let lang: Lang = initialLang();
document.documentElement.lang = lang;

export function setLang(next: Lang) {
  lang = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable */
  }
}

// Pick the right side of a bilingual server string
export const tl = (l: L | undefined) => (l ? l[lang] : '');

const en = {
  // home
  lead: 'Four voices and an old radio.<br/>Each of you knows only part of how to open it.<br/><b>And it hears everything you write.</b>',
  yourName: 'Your name',
  stranger: 'Stranger',
  yourColour: 'Your colour',
  createRoom: 'Play with friends',
  playBots: 'Play with bots',
  mainMenu: 'Main menu',
  findMatch: 'Find a random match',
  matchNote: 'Find teammates · four seats, bots fill empty places',
  searchingMatch: 'Finding teammates',
  matchLobbyNote: 'Once two players join, a 12-second countdown starts. Others may join; bots fill any empty seats. A linked wallet is required.',
  cancelSearch: 'Cancel search',
  matchWaiting: (n: number) => `Players found: ${n}/4. Waiting for another player…`,
  matchCountdown: (n: number) => `Team found! Starting in ${n}s…`,
  botsNote: 'Solo practice · three bot teammates · no wallet needed',
  bot: 'bot',
  practiceNote: 'Practice with three bot teammates. They share clues and set their controls after you write a message. Bots use preset answers; they do not interpret your hints.',
  codePlaceholder: 'CODE',
  join: 'Join',
  betaNote: 'Beta · text chat only · four players',
  enterCode: 'Enter the 4-letter room code',
  language: 'Language',
  // lobby
  roomCode: 'Room code',
  copyInvite: 'Copy invite link',
  shareCode: 'Send this code to your friends. Click it to copy an invite link.',
  addBot: 'Add bot',
  removeBot: 'Remove bot',
  friendBotsHint: 'Invite a friend, then add bots to fill the four seats. Friends who join later replace bots.',
  connectWallet: 'Link wallet',
  turnOn: 'Turn the radio on',
  host: 'host',
  you: 'you',
  ready: 'Everyone ready? The radio is waiting.',
  waitingPlayers: (min: number, n: number) => `Waiting for at least ${min} players (${n}/${min}).`,
  waitingHost: 'Waiting for the host to turn the radio on…',
  inviteCopied: 'Invite link copied',
  howItWorks: 'How it works',
  rules: [
    'A match has <b>five trials of increasing difficulty</b>, drawn from fifteen. The first teaches you to exchange clues; later trials add one new rule at a time. Every trial brings a fresh set of pictures.',
    'Share your clues in the chat, <b>in turns</b>: up to three messages, then the floor passes on. There is no turn timer; you can pass early.',
    '<b>The radio reads every message.</b> The names of the items (“cat”, “candle”, “star”) and numbers turn into static and make it suspicious. Even misspelled or in another alphabet.',
    'So <b>describe</b> instead of naming: not “cat” but “the one who purrs”, not “clock” but “what ticks on the wall”.',
    'The radio <b>learns</b>: repeat a metaphor too often and it understands it too. Keep inventing.',
    'When its eye is fully open, it <b>retunes</b>: the trial starts over with new clues.',
    'Pass all five trials and your team receives a <b>Fragment</b>: a record of the language you invented. Solana NFT minting is planned.',
  ],
  installPhantom: 'Install <a href="https://phantom.app" target="_blank" rel="noopener">Phantom</a> to receive your Fragment on Solana.',
  walletConnected: (a: string) => `Wallet connected: ${a}`,
  walletRejected: 'Wallet connection was rejected',
  // game
  room: 'Room',
  tries: 'Tries',
  retunes: 'Retunes',
  attention: "The radio's attention",
  clear: 'Clear',
  speakCarefully: 'Speak carefully…',
  send: 'Send',
  pass: 'Pass',
  passTitle: 'Give the floor to the next player',
  yourFragment: 'Only you see this',
  trueTones: 'The keys on the radio show you their true tones.',
  radio: 'RADIO',
  trialOf: (i: number, n: number) => `Trial ${i} of ${n}`,
  understands: 'The radio understands:',
  yourTurnLeft: (n: number) => `Your turn · ${n} ${n === 1 ? 'message' : 'messages'} left`,
  hasFloor: (name: string) => `${name} has the floor…`,
  yourTurn: 'Your turn to speak',
  isSpeaking: 'is speaking',
  heardYou: 'The radio heard you say',
  nextTrial: 'The lock gave way. The radio has another trial for you.',
  // end
  backToRoom: 'Back to the room',
  waitingHostShort: 'Waiting for the host…',
  radioOpen: 'The radio is open',
  fragment: 'Fragment',
  openedBy: 'Opened by',
  trialsPassed: 'Trials passed:',
  language_: 'The language you invented',
  crackedTitle: 'The radio learned this one',
  barelySpoke: 'You barely spoke. The radio is impressed.',
  time: 'time',
  overheard: 'overheard',
  retunesStat: 'retunes',
  wrongAnswers: 'wrong answers',
  seal: '◎ Sealing on Solana devnet arrives in the next build. Your Fragment will be minted to every connected wallet.',
  timeUp: 'Time is up',
  noTries: 'No tries left',
  keepsVoices: 'The radio keeps your voices.',
  lostStats: (r: number, w: number) => `${r} retunes · it learned ${w} of your words.`,
  offline: 'Connection lost… reconnecting',
  // clarity
  task: 'Your task',
  radioSays: 'The radio',
  answerOne: 'Answer: 1 picture',
  answerMany: (n: number) => `Answer: ${n} pictures, in order`,
  listenHint: 'The radio hears the names of the items and numbers, even misspelled. Describe instead: not “cat” but “the one who purrs”.',
  introTrial: (i: number, n: number) => `Trial ${i} of ${n}`,
  yourPart: 'Your part:',
  gotIt: 'Got it',
  translated: 'translated',
  original: 'Original',
  seerLock: 'You see the answer: the others press it',
  yourPanel: 'Your control',
  imSure: 'I’m sure',
  notSure: 'Not sure any more',
  sure: 'sure',
  readyHint: 'The radio checks the answer when everyone presses “I’m sure”.',
  lastWrong: (n: number, total: number) => `Last try: ${n} of ${total} were wrong. The radio won’t say which.`,
  youKnow: 'You know',
  youKnowHint: 'This is your teammate’s answer, not yours. Tell the named player what to choose using a description instead of the item’s name.',
  knowHand: 'What you have',
  knowHandHint: 'These are your cards. Compare them with the other players’ cards using the trial rule.',
};

type Dict = typeof en;

const ru: Dict = {
  lead: 'Четыре голоса и старое радио.<br/>Каждый знает только часть того, как его открыть.<br/><b>И оно слышит всё, что вы пишете.</b>',
  yourName: 'Как вас зовут',
  stranger: 'Незнакомец',
  yourColour: 'Ваш цвет',
  createRoom: 'Играть с друзьями',
  playBots: 'Играть с ботами',
  mainMenu: 'Главное меню',
  findMatch: 'Найти случайную игру',
  matchNote: 'Подбор команды · четыре места, пустые займут боты',
  searchingMatch: 'Ищем напарников',
  matchLobbyNote: 'Когда найдутся двое, начнётся отсчёт на 12 секунд. Остальные могут присоединиться; свободные места займут боты. Нужен привязанный кошелёк.',
  cancelSearch: 'Отменить поиск',
  matchWaiting: (n: number) => `Найдено игроков: ${n}/4. Ждём ещё одного…`,
  matchCountdown: (n: number) => `Команда найдена! Начало через ${n} с…`,
  botsNote: 'Тренировка одному · три бота-напарника · кошелёк не нужен',
  bot: 'бот',
  practiceNote: 'Тренировка с тремя ботами. Они дают подсказки и выставляют свои пульты после вашего сообщения. Боты используют готовые ответы, а не понимают ваши подсказки.',
  codePlaceholder: 'КОД',
  join: 'Войти',
  betaNote: 'Бета · общение только в чате · четыре игрока',
  enterCode: 'Введите код комнаты: 4 буквы',
  language: 'Язык',
  roomCode: 'Код комнаты',
  copyInvite: 'Скопировать ссылку-приглашение',
  shareCode: 'Отправьте код друзьям. Нажмите на него, чтобы скопировать ссылку.',
  addBot: 'Добавить бота',
  removeBot: 'Убрать бота',
  friendBotsHint: 'Пригласите друга, затем заполните четыре места ботами. Новые друзья смогут заменить ботов.',
  connectWallet: 'Привязать кошелёк',
  turnOn: 'Включить радио',
  host: 'ведущий',
  you: 'это вы',
  ready: 'Все на месте? Радио ждёт.',
  waitingPlayers: (min, n) => `Нужно минимум ${min} игрока, сейчас ${n}.`,
  waitingHost: 'Ждём, когда ведущий включит радио…',
  inviteCopied: 'Ссылка скопирована',
  howItWorks: 'Как играть',
  rules: [
    'В матче <b>пять испытаний по нарастающей сложности</b> из пятнадцати. Первое учит обмениваться подсказками, затем постепенно добавляются новые правила. В каждом испытании свой набор картинок.',
    'Делитесь подсказками в чате. Пишут <b>по очереди</b>: до трёх сообщений, потом ход переходит дальше. Таймера хода нет; можно передать слово раньше.',
    '<b>Радио читает каждое сообщение.</b> Названия того, что на картинках («кот», «свеча», «звезда»), и числа оно глушит помехами, и его подозрение растёт. Даже если написать с ошибкой или латиницей.',
    'Поэтому <b>описывайте</b>, а не называйте: не «кот», а «тот, кто мурлычет», не «часы», а «то, что тикает на стене».',
    'Радио <b>учится</b>: если повторять одну метафору, оно её запомнит. Придумывайте новые.',
    'Когда глаз радио откроется полностью, оно <b>сменит волну</b>: испытание начнётся заново с другими подсказками.',
    'Пройдите все пять испытаний, и команда получит <b>Фрагмент</b>: запись языка, который вы придумали. Выпуск NFT в Solana запланирован.',
  ],
  installPhantom: 'Установите <a href="https://phantom.app" target="_blank" rel="noopener">Phantom</a>, чтобы получить Фрагмент в Solana.',
  walletConnected: (a) => `Кошелёк подключён: ${a}`,
  walletRejected: 'Вы отменили подключение кошелька',
  room: 'Комната',
  tries: 'Попытки',
  retunes: 'Смены волны',
  attention: 'Подозрение радио',
  clear: 'Стереть ответ',
  speakCarefully: 'Пишите осторожно…',
  send: 'Отправить',
  pass: 'Передать ход',
  passTitle: 'Отдать слово следующему игроку',
  yourFragment: 'Видите только вы',
  trueTones: 'Клавиши на вашем радио подсвечены их настоящими цветами.',
  radio: 'РАДИО',
  trialOf: (i, n) => `Испытание ${i} из ${n}`,
  understands: 'Радио уже понимает:',
  yourTurnLeft: (n) => `Ваш ход · можно написать ещё ${n}`,
  hasFloor: (name) => `Сейчас пишет ${name}…`,
  yourTurn: 'Ваш ход',
  isSpeaking: 'пишет',
  heardYou: 'Радио услышало:',
  nextTrial: 'Получилось! Радио готовит следующее испытание.',
  backToRoom: 'Вернуться в комнату',
  waitingHostShort: 'Ждём ведущего…',
  radioOpen: 'Радио открыто',
  fragment: 'Фрагмент',
  openedBy: 'Открыли',
  trialsPassed: 'Пройдено:',
  language_: 'Язык, который вы придумали',
  crackedTitle: 'Это слово радио успело выучить',
  barelySpoke: 'Вы почти не говорили. Радио под впечатлением.',
  time: 'время',
  overheard: 'подслушано',
  retunesStat: 'смен волны',
  wrongAnswers: 'ошибок',
  seal: '◎ Запись Фрагмента в Solana devnet появится в следующей версии: его получит каждый, кто подключил кошелёк.',
  timeUp: 'Время вышло',
  noTries: 'Попытки кончились',
  keepsVoices: 'Радио оставило ваши голоса себе.',
  lostStats: (r, w) => `Смен волны: ${r} · выучено ваших слов: ${w}.`,
  offline: 'Нет связи… переподключаемся',
  task: 'Что нужно сделать',
  radioSays: 'Радио',
  answerOne: 'Ответ: одна картинка',
  answerMany: (n) => `Ответ: ${n} картинки по порядку`,
  listenHint: 'Радио слышит названия того, что на картинках, и числа, даже с ошибками и латиницей. Описывайте: не «кот», а «тот, кто мурлычет».',
  introTrial: (i, n) => `Испытание ${i} из ${n}`,
  yourPart: 'Ваша часть:',
  gotIt: 'Понятно',
  translated: 'перевод',
  original: 'Оригинал',
  seerLock: 'Вы видите ответ: нажимают другие',
  yourPanel: 'Ваш пульт',
  imSure: 'Я уверен',
  notSure: 'Я передумал',
  sure: 'уверен',
  readyHint: 'Радио проверит ответ, когда все нажмут «Я уверен».',
  lastWrong: (n, total) => `Прошлая попытка: неверно ${n} из ${total}. Какие именно, радио не скажет.`,
  youKnow: 'Вы знаете',
  youKnowHint: 'Это ответ соседа, не ваш. Объясните указанному игроку, что выбрать: опишите картинку, не называя её прямо.',
  knowHand: 'Что у вас есть',
  knowHandHint: 'Это ваши карточки. Сравните их с карточками других игроков по правилу испытания.',
};

const DICTS: Record<Lang, Dict> = { en, ru };

export function t<K extends keyof Dict>(key: K): Dict[K] {
  return DICTS[lang][key];
}

// Small EN | RU switcher, wired by the caller
export function langSwitchHtml() {
  return `<div class="lang-switch" role="group" aria-label="${t('language')}">
    <button data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
    <button data-lang="ru" aria-pressed="${lang === 'ru'}">RU</button>
  </div>`;
}
