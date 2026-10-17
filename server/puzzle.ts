// The radio's trials. In every trial each player owns their own control on the radio
// (a knob, a digit wheel, a place in the code, a vote) and sets it themselves.
// The right setting of your control is known only to someone else: knowledge goes around the
// table in a circle, so everybody has to explain something and everybody has to listen.
// The radio checks the answer only when every player has pressed "I'm sure".

import { ITEM_SETS, type Glyph, type ItemSet, type Knowledge, type L, type TrialKind, type Value } from '../shared/protocol';
import { NUMBER_CIPHERS, SYMBOL_CIPHERS, HAND_TRIALS, decodeClue, handCandidates } from '../shared/trial-rules';
import { ANTENNA_OPTIONS, BITS_OPTIONS, CASSETTE_OPTIONS, LAMP_OPTIONS, SCALE_STOPS, WAVE_OPTIONS, WIRE_OPTIONS } from '../shared/dials';

export interface Control {
  id: string;
  ownerId: string;
  label: L;
  options: Value[];
  target: Value;
  clue?: Value;
  scale?: Glyph[];
}

export interface Trial {
  kind: TrialKind;
  set?: ItemSet;
  title: L;
  prompt: L; // the radio's line (atmosphere)
  task: L; // what to actually do, in plain words
  controls: Control[];
  knows: Record<string, Knowledge[]>; // by player id
  hands?: Record<string, Glyph[]>; // "Missing": the items each player holds
}

// The current catalogue: hands-on radio parts plus the code lock and the missing card.
// A match takes four of them; the older rule trials stay in the code for later chapters.
export const TRIAL_CATALOG: readonly TrialKind[] = ['wave', 'cassette', 'antenna', 'equalizer', 'morse', 'scale', 'wires', 'lamp', 'code', 'missing'];
const OPENERS: readonly TrialKind[] = ['wave', 'cassette', 'antenna', 'equalizer', 'wires'];
// Trials built on picture sets; two of them in a row feel the same
const PICTURE_TRIALS: readonly TrialKind[] = ['code', 'missing', 'scale'];

// Legacy chapters (15-trial route), kept for reference and older checks
export const TRIAL_CHAPTERS: readonly (readonly TrialKind[])[] = [
  ['tuning'],
  ['missing', 'frequency', 'code'],
  ['common', 'next', 'echo'],
  ['duplicate', 'previous', 'pairs', 'crowd'],
  ['rare', 'leap', 'opposite', 'reflection'],
];
export const TRIAL_KINDS: TrialKind[] = [...TRIAL_CATALOG];

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const both = (en: string, ru: string): L => ({ en, ru });
const itemsOf = (set: ItemSet) => [...ITEM_SETS[set]] as Glyph[];

// One control per player; each player learns the target of the next player's control
function circle(players: string[], controls: Omit<Control, 'ownerId'>[]): Pick<Trial, 'controls' | 'knows'> {
  const order = shuffle(players);
  const owned: Control[] = controls.map((c, i) => ({ ...c, ownerId: order[i % order.length] }));
  const knows: Record<string, Knowledge[]> = Object.fromEntries(players.map((p) => [p, []]));
  for (const c of owned) {
    // The player before the owner in the circle knows it (alone at the table, you know your own: test mode only)
    const knower = order.length > 1 ? order[(order.indexOf(c.ownerId) + order.length - 1) % order.length] : c.ownerId;
    knows[knower].push({ controlId: c.id, value: c.clue ?? c.target });
  }
  return { controls: owned, knows };
}

// ---------- 1. Tuning: everyone has a knob with pictures ----------

const KNOBS: L[] = [
  both('Volume knob', 'Ручка громкости'),
  both('Tone knob', 'Ручка тембра'),
  both('Antenna knob', 'Ручка антенны'),
  both('Band knob', 'Ручка диапазона'),
];

function tuningTrial(set: ItemSet, players: string[]): Trial {
  const items = itemsOf(set);
  const controls = players.map((_, i) => {
    const options = shuffle(items).slice(0, 6);
    return { id: `knob${i}`, label: KNOBS[i % KNOBS.length], options, target: pick(options) };
  });
  return {
    kind: 'tuning',
    set,
    title: both('Tuning', 'Настройка'),
    prompt: pick([
      both('…too much static. Turn my knobs. Carefully.', '…слишком много шума. Покрутите мои ручки. Осторожно.'),
      both('…I can almost hear you. Tune me in.', '…я почти слышу вас. Настройте меня.'),
    ]),
    task: both(
      'Describe the picture on your “You know” card without naming it. A teammate will describe yours. Select that picture on your knob, then press “I’m sure”.',
      'Опишите картинку в блоке «Вы знаете», не называя её. Напарник так же подскажет вашу. Выберите её на своём пульте и нажмите «Я уверен».',
    ),
    ...circle(players, controls),
  };
}

// ---------- 2. Frequency: everyone has one digit of the station ----------

function frequencyTrial(players: string[]): Trial {
  const controls = players.map((_, i) => ({
    id: `digit${i}`,
    label: both(`Digit ${i + 1} of the frequency`, `${i + 1}-я цифра частоты`),
    options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    target: Math.floor(Math.random() * 10),
  }));
  return {
    kind: 'frequency',
    title: both('Frequency', 'Частота'),
    prompt: pick([
      both('…somewhere there is a station only I can hear. Find it.', '…где-то есть станция, которую слышу только я. Найдите её.'),
      both('…a number. Say it without saying it.', '…число. Скажите его, не говоря.'),
    ]),
    task: both(
      'Describe your teammate’s digit without saying a number. Listen for your own digit, select it and confirm.',
      'Опишите цифру напарника, не называя число. Узнайте свою цифру по его подсказке, выберите её и подтвердите.',
    ),
    ...circle(players, controls),
  };
}

// ---------- Hands-on parts: a wave, a tape, an antenna ----------

const WAVE_LABELS: L[] = [both('Upper wave', 'Верхняя волна'), both('Lower wave', 'Нижняя волна'), both('Left wave', 'Левая волна'), both('Right wave', 'Правая волна')];

function waveTrial(players: string[]): Trial {
  const controls = players.map((_, i) => ({ id: `wave${i}`, label: WAVE_LABELS[i % WAVE_LABELS.length], options: [...WAVE_OPTIONS], target: pick(WAVE_OPTIONS) }));
  return {
    kind: 'wave',
    title: both('The Wave', 'Волна'),
    prompt: pick([
      both('…I hear you, but crooked. Straighten my wave.', '…слышу вас, но криво. Выровняйте мне волну.'),
      both('…the signal is shaking. Draw it for me.', '…сигнал дрожит. Нарисуйте мне его.'),
    ]),
    task: both('Describe the wave on your card. Set yours by height and spacing.', 'Опиши волну с карточки. Свою выставь по высоте и частоте.'),
    ...circle(players, controls),
  };
}

function cassetteTrial(players: string[]): Trial {
  const controls = players.map((_, i) => ({ id: `tape${i}`, label: both(`Cassette ${i + 1}`, `Кассета ${i + 1}`), options: [...CASSETTE_OPTIONS], target: pick(CASSETTE_OPTIONS) }));
  return {
    kind: 'cassette',
    title: both('The Tape', 'Кассета'),
    prompt: pick([
      both('…wind my tape. Exactly as much as needed.', '…отмотайте плёнку. Ровно сколько надо.'),
      both('…one frame too long and I forget everything.', '…лишний кадр, и я всё забуду.'),
    ]),
    task: both('Say how long the tape on your card is. Wind yours to the same length.', 'Скажи, какой длины плёнка на карточке. Свою отмотай так же.'),
    ...circle(players, controls),
  };
}

function antennaTrial(players: string[]): Trial {
  const controls = players.map((_, i) => ({ id: `antenna${i}`, label: both(`Antenna ${i + 1}`, `Антенна ${i + 1}`), options: [...ANTENNA_OPTIONS], target: pick(ANTENNA_OPTIONS) }));
  return {
    kind: 'antenna',
    title: both('Antennas', 'Антенны'),
    prompt: pick([
      both('…turn me. No, the other way.', '…поверните меня. Нет, в другую сторону.'),
      both('…somewhere out there a station is calling. Point me at it.', '…где-то там зовёт станция. Наведите меня.'),
    ]),
    task: both('Say where the antenna on your card points. Turn yours the same way.', 'Скажи, куда смотрит антенна на карточке. Свою поверни так же.'),
    ...circle(players, controls),
  };
}

function simpleTrial(kind: TrialKind, title: L, prompts: L[], task: L, label: (i: number) => L, options: number[], players: string[], extra: Partial<Control> = {}): Trial {
  const controls = players.map((_, i) => ({ id: `${kind}${i}`, label: label(i), options: [...options], target: pick(options), ...extra }));
  return { kind, title, prompt: pick(prompts), task, ...circle(players, controls) };
}

function equalizerTrial(players: string[]) {
  return simpleTrial('equalizer', both('Equalizer', 'Эквалайзер'),
    [both('…my voice is lopsided. Even it out.', '…голос у меня кривой. Подровняйте.'), both('…too much bass. Or too little. You decide.', '…то басов много, то мало. Решайте.')],
    both('Describe the three bars on your card. Raise or lower yours to match.', 'Опиши три полоски с карточки. Свои подними или опусти так же.'),
    (i) => both(`Equalizer ${i + 1}`, `Эквалайзер ${i + 1}`), BITS_OPTIONS, players);
}
function morseTrial(players: string[]) {
  return simpleTrial('morse', both('Morse', 'Морзе'),
    [both('…tap me a message. Three signals.', '…отстучите мне сообщение. Три сигнала.'), both('…short, long… I forget which.', '…коротко, длинно… я забыл, как там было.')],
    both('Say the rhythm on your card out loud. Tap yours: short or long.', 'Произнеси ритм с карточки. Свой отстучи: коротко или длинно.'),
    (i) => both(`Key ${i + 1}`, `Ключ ${i + 1}`), BITS_OPTIONS, players);
}
function scaleTrial(set: ItemSet, players: string[]) {
  const scale = shuffle(itemsOf(set)).slice(0, 5);
  const t = simpleTrial('scale', both('Station Scale', 'Шкала станций'),
    [both('…somewhere between two stations. Find the spot.', '…где-то между станциями. Найдите место.'), both('…left a little. No, right.', '…чуть левее. Нет, правее.')],
    both('Say where the pointer stands: on which picture or between which two. Move yours there.', 'Скажи, где стоит стрелка: на какой картинке или между какими. Свою поставь туда же.'),
    (i) => both(`Pointer ${i + 1}`, `Стрелка ${i + 1}`), SCALE_STOPS, players, { scale });
  return { ...t, set };
}
function wiresTrial(players: string[]) {
  return simpleTrial('wires', both('Wires', 'Провода'),
    [both('…plug me in. The right socket.', '…воткните меня. В нужное гнездо.'), both('…wrong socket and I scream.', '…не то гнездо, и я закричу.')],
    both('Say which socket the plug is in. Plug yours into the same one.', 'Скажи, в каком гнезде штекер. Свой воткни в такое же.'),
    (i) => both(`Plug ${i + 1}`, `Штекер ${i + 1}`), WIRE_OPTIONS, players);
}
function lampTrial(players: string[]) {
  return simpleTrial('lamp', both('The Lamp', 'Лампа'),
    [both('…I hear colours. Do not say them.', '…я слышу цвета. Не называйте их.'), both('…what colour is my light? Whisper it.', '…какого цвета мой свет? Только шёпотом.')],
    both('Describe the colour without naming it. Pick the same colour for your lamp.', 'Опиши цвет, не называя его. Свою лампу зажги таким же.'),
    (i) => both(`Lamp ${i + 1}`, `Лампа ${i + 1}`), LAMP_OPTIONS, players);
}

// ---------- 3. The Code: a chain of pictures, everyone owns one place in it ----------

const PLACES: Record<number, L[]> = {
  1: [both('the only place', 'единственное место')],
  2: [both('at the start', 'в начале'), both('at the end', 'в конце')],
  3: [both('at the start', 'в начале'), both('in the middle', 'в середине'), both('at the end', 'в конце')],
  4: [
    both('at the very start', 'в самом начале'),
    both('right after the start', 'сразу после начала'),
    both('right before the end', 'прямо перед концом'),
    both('at the very end', 'в самом конце'),
  ],
};

function codeTrial(set: ItemSet, players: string[]): Trial {
  const items = itemsOf(set);
  const chain = shuffle(items).slice(0, players.length);
  const places = PLACES[Math.min(4, Math.max(1, players.length))];
  const controls = chain.map((target, i) => ({ id: `place${i}`, label: places[i], options: items, target }));
  return {
    kind: 'code',
    set,
    title: both('Code Lock', 'Кодовый замок'),
    prompt: pick([
      both('…I am locked. Each of you holds one wheel.', '…я заперт. У каждого из вас одно колёсико.'),
      both('…four pictures, one order. Do not rush.', '…четыре картинки, один порядок. Не спешите.'),
    ]),
    task: both('Describe the picture for your neighbour’s wheel without naming it. Set your own wheel.', 'Опиши картинку для колёсика соседа, не называя её. Своё выставь по его подсказке.'),
    ...circle(players, controls),
  };
}

// ---------- 4. Missing: everyone votes for the picture nobody has ----------

function missingTrial(set: ItemSet, players: string[]): Trial {
  const items = itemsOf(set);
  const lost = pick(items);
  const rest = shuffle(items.filter((x) => x !== lost));
  const n = players.length;
  // Each remaining picture is held by someone; everybody holds at least 3, nobody holds all 7
  const hands: Glyph[][] = Array.from({ length: n }, () => []);
  rest.forEach((x, i) => hands[i % n].push(x));
  for (const hand of hands) {
    while (hand.length < Math.min(3, rest.length)) {
      const extra = pick(rest);
      if (!hand.includes(extra)) hand.push(extra);
    }
  }
  return {
    kind: 'missing',
    set,
    title: both('Missing', 'Пропажа'),
    prompt: pick([
      both('…something of mine is gone. Find out what.', '…у меня что-то пропало. Узнайте что.'),
      both('…one is missing. I can feel the empty spot.', '…одного не хватает. Чувствую пустое место.'),
    ]),
    task: both('Tell each other your cards. Pick the picture nobody has.', 'Расскажите друг другу свои карточки. Выберите ту, которой нет ни у кого.'),
    controls: players.map((p, i) => ({ id: `vote${i}`, ownerId: p, label: both('Your vote', 'Ваш голос'), options: items, target: lost })),
    knows: Object.fromEntries(players.map((p) => [p, []])),
    hands: Object.fromEntries(players.map((p, i) => [p, shuffle(hands[i])])),
  };
}

// ---------- building a game ----------

const CIPHERS: Partial<Record<TrialKind, { title: L; rule: L }>> = {
  echo: { title: both('Echo', 'Эхо сигнала'), rule: both('Move one digit forward. After nine comes zero.', 'Сдвиньте цифру на шаг вперёд. После девяти идёт ноль.') },
  next: { title: both('Next station', 'Следующая станция'), rule: both('Choose the picture one step to the right of the clue on the shared scale. The scale wraps around.', 'Выберите картинку справа от подсказки на общей шкале. После последней идёт первая.') },
  previous: { title: both('Return signal', 'Обратный сигнал'), rule: both('Choose the picture one step to the left of the clue on the shared scale. Before the first comes the last.', 'Выберите картинку слева от подсказки на общей шкале. Перед первой идёт последняя.') },
  opposite: { title: both('Opposite pole', 'Другой полюс'), rule: both('Move four pictures to the right of the clue on the eight-picture scale, wrapping around.', 'От картинки подсказки отсчитайте четыре шага вправо по шкале. После последней идёт первая.') },
  reflection: { title: both('Reflected scale', 'Отражение'), rule: both('Find the clue picture on the scale. Count the same number of places from the other end: first becomes last, second becomes second-to-last.', 'Найдите подсказку на шкале. Отсчитайте столько же мест с другого края: первая станет последней, вторая — предпоследней.') },
  pairs: { title: both('Paired keys', 'Парные ключи'), rule: both('The scale is split into adjacent pairs. Choose the other picture in your clue’s pair.', 'Шкала разбита на соседние пары. Выберите другую картинку из пары, в которой находится подсказка.') },
  leap: { title: both('Signal jump', 'Скачок сигнала'), rule: both('Move two pictures to the right of the clue on the shared scale, wrapping around.', 'От картинки подсказки сделайте два шага вправо по шкале. После последней идёт первая.') },
};

function cipherTrial(kind: TrialKind, set: ItemSet, players: string[]): Trial {
  const numeric = NUMBER_CIPHERS.includes(kind);
  const options: Value[] = numeric ? [0,1,2,3,4,5,6,7,8,9] : shuffle(itemsOf(set));
  const definition = CIPHERS[kind]!;
  const controls = players.map((_, i) => {
    const clue = pick(options);
    return { id: `cipher${i}`, label: both(`Receiver ${i + 1}`, `Приёмник ${i + 1}`), options: [...options], clue, target: decodeClue(kind, clue, options) };
  });
  return {
    kind, set: numeric ? undefined : set, title: definition.title,
    prompt: both('…I changed the signal. Work out what reaches your receiver.', '…я изменил сигнал. Разберитесь, что придёт в ваш приёмник.'),
    task: both(
      `${definition.rule.en} Describe your teammate’s clue. Apply this rule to the clue they give you and select the result.`,
      `${definition.rule.ru} Опишите подсказку напарника. К полученной от него подсказке примените это правило и выберите результат.`,
    ),
    ...circle(players, controls),
  };
}

const COLLECTIONS: Partial<Record<TrialKind, { title: L; task: L }>> = {
  common: { title: both('Common ground', 'Общее звено'), task: both('Find the only picture held by every player.', 'Найдите единственную картинку, которая есть у каждого игрока.') },
  duplicate: { title: both('Double trace', 'Двойной след'), task: both('Find the only picture held by exactly two players. Every other picture is held by one.', 'Найдите единственную картинку, которая есть ровно у двух игроков. Остальные есть только у одного.') },
  rare: { title: both('Lone witness', 'Одинокий свидетель'), task: both('Find the only picture held by just one player. Every other picture is held by two.', 'Найдите единственную картинку, которая есть только у одного игрока. Остальные есть у двух.') },
  crowd: { title: both('Most voices', 'Большинство голосов'), task: both('Find the picture held by the most players. There is exactly one such picture.', 'Найдите картинку, которая встречается у наибольшего числа игроков. Такая картинка только одна.') },
};

function collectionTrial(kind: TrialKind, set: ItemSet, players: string[]): Trial {
  const items = shuffle(itemsOf(set)), target = items[0], n = players.length;
  const hands: Glyph[][] = Array.from({ length: n }, () => []);
  let cursor = 0;
  for (const item of items) {
    const count = item === target ? (kind === 'duplicate' ? 2 : kind === 'rare' ? 1 : n)
      : kind === 'common' ? n - 1 : kind === 'rare' ? 2 : 1;
    for (let i = 0; i < count; i++) hands[(cursor++) % n].push(item);
  }
  const definition = COLLECTIONS[kind]!;
  return {
    kind, set, title: definition.title,
    prompt: both('…compare your evidence. None of you sees the whole picture.', '…сравните свои улики. Никто из вас не видит всей картины.'),
    task: both(`${definition.task.en} Compare all cards, select that picture and confirm together.`, `${definition.task.ru} Сравните карточки, выберите эту картинку и подтвердите ответ вместе.`),
    controls: players.map((p, i) => ({ id: `vote${i}`, ownerId: p, label: both('Your vote', 'Ваш голос'), options: [...items], target })),
    knows: Object.fromEntries(players.map((p) => [p, []])),
    hands: Object.fromEntries(shuffle(players).map((p, i) => [p, shuffle(hands[i])])),
  };
}

export function generateTrial(kind: TrialKind, set: ItemSet, players: string[]): Trial {
  if (NUMBER_CIPHERS.includes(kind) || SYMBOL_CIPHERS.includes(kind)) return cipherTrial(kind, set, players);
  if (HAND_TRIALS.includes(kind) && kind !== 'missing') return collectionTrial(kind, set, players);
  switch (kind) {
    case 'wave':
      return waveTrial(players);
    case 'cassette':
      return cassetteTrial(players);
    case 'antenna':
      return antennaTrial(players);
    case 'equalizer':
      return equalizerTrial(players);
    case 'morse':
      return morseTrial(players);
    case 'scale':
      return scaleTrial(set, players);
    case 'wires':
      return wiresTrial(players);
    case 'lamp':
      return lampTrial(players);
    case 'tuning':
      return tuningTrial(set, players);
    case 'frequency':
      return frequencyTrial(players);
    case 'code':
      return codeTrial(set, players);
    case 'missing':
      return missingTrial(set, players);
    default: throw new Error(`Unknown trial: ${kind}`);
  }
}

export interface TrialPlan {
  kind: TrialKind;
  set: ItemSet;
}

// Four different trials per match, in a new order every time.
// A hands-on part always opens, and the two picture trials never come back to back.
export function trialSequence(count: number): TrialPlan[] {
  if (!Number.isInteger(count) || count < 1 || count > TRIAL_CATALOG.length) throw new Error('Invalid trial count');
  const first = pick(OPENERS);
  let route: TrialKind[] = [];
  for (let tries = 0; tries < 30; tries++) {
    route = [first, ...shuffle(TRIAL_CATALOG.filter((k) => k !== first))].slice(0, count);
    if (!route.some((k, i) => i > 0 && PICTURE_TRIALS.includes(k) && PICTURE_TRIALS.includes(route[i - 1]))) break;
  }
  const openingSet = pick<ItemSet>(['objects', 'animals']);
  const sets = [openingSet, ...shuffle((Object.keys(ITEM_SETS) as ItemSet[]).filter((set) => set !== openingSet))];
  return route.map((kind, i) => ({ kind, set: sets[i % sets.length] }));
}

// ---------- what the whole table knows (used by the tests and the test bots) ----------

// Pool everybody's knowledge: the value every control must be set to, or null if nobody knows it
export function solveFromKnowledge(trial: { kind: TrialKind; controls: { id: string; options: Value[] }[] }, knows: Knowledge[][], hands: Glyph[][] = []) {
  const answer = new Map<string, Value | null>(trial.controls.map((c) => [c.id, null]));
  if (HAND_TRIALS.includes(trial.kind)) {
    const left = handCandidates(trial.kind, trial.controls[0]?.options ?? [], hands);
    if (left.length === 1) trial.controls.forEach((c) => answer.set(c.id, left[0]));
    return answer;
  }
  for (const k of knows.flat()) {
    const control = trial.controls.find((c) => c.id === k.controlId);
    if (control) answer.set(k.controlId, decodeClue(trial.kind, k.value, control.options));
  }
  return answer;
}
