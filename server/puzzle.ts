// The radio's trials. In every trial each player owns their own control on the radio
// (a knob, a digit wheel, a place in the code, a vote) and sets it themselves.
// The right setting of your control is known only to someone else: knowledge goes around the
// table in a circle, so everybody has to explain something and everybody has to listen.
// The radio checks the answer only when every player has pressed "I'm sure".

import { ITEM_SETS, type Glyph, type ItemSet, type Knowledge, type L, type TrialKind, type Value } from '../shared/protocol';

export interface Control {
  id: string;
  ownerId: string;
  label: L;
  options: Value[];
  target: Value;
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

export const TRIAL_KINDS: TrialKind[] = ['tuning', 'frequency', 'code', 'missing'];

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
    knows[knower].push({ controlId: c.id, value: c.target });
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
      'Each of you has a knob with pictures. Where your knob must point, your neighbour knows; where theirs must point, you know. Explain it without naming the picture, set your knob and press “I’m sure”.',
      'У каждого своя ручка с картинками. Куда повернуть вашу, знает сосед, а вы знаете, куда повернуть его. Объясните друг другу, не называя картинку, выставьте свою ручку и нажмите «Я уверен».',
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
      'Catch the station: each of you has a wheel with one digit. Your neighbour knows your digit, you know theirs. The radio hears numbers, so explain them differently: “as many as days in a week”. Set your digit and press “I’m sure”.',
      'Поймайте волну: у каждого своё колесо с одной цифрой. Вашу цифру знает сосед, а вы знаете его. Цифры радио слышит, поэтому объясняйте иначе: «сколько дней в неделе». Выставьте свою цифру и нажмите «Я уверен».',
    ),
    ...circle(players, controls),
  };
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
    title: both('The Code', 'Код'),
    prompt: pick([
      both('…a chain of pictures. Only one order opens me.', '…цепочка картинок. Открывает меня только один порядок.'),
      both('…I am locked. You each hold a link of my code.', '…я заперт. У каждого из вас звено моего кода.'),
    ]),
    task: both(
      'The code is a chain of pictures, and each of you is responsible for one place in it. What stands in your place, your neighbour knows; you know what stands in theirs. Explain it, set your picture and press “I’m sure”.',
      'Код — это цепочка картинок, каждый отвечает за своё место в ней. Что стоит на вашем месте, знает сосед, а вы знаете, что на месте соседа. Объясните, выставьте свою картинку и нажмите «Я уверен».',
    ),
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
      both('…one is missing. I can feel the empty place.', '…одного не хватает. Я чувствую пустое место.'),
    ]),
    task: both(
      'One of the eight pictures has gone missing. Each of you has a few of the others. Tell each other what you have and find the one nobody has. Everyone votes on their own: it counts only if you all choose the same.',
      'Из восьми картинок одна пропала. У каждого есть несколько оставшихся. Расскажите, что у вас есть, и найдите ту, которой нет ни у кого. Каждый голосует сам: засчитается, только если все выберут одно и то же.',
    ),
    controls: players.map((p, i) => ({ id: `vote${i}`, ownerId: p, label: both('Your vote', 'Ваш голос'), options: items, target: lost })),
    knows: Object.fromEntries(players.map((p) => [p, []])),
    hands: Object.fromEntries(players.map((p, i) => [p, shuffle(hands[i])])),
  };
}

// ---------- building a game ----------

export function generateTrial(kind: TrialKind, set: ItemSet, players: string[]): Trial {
  switch (kind) {
    case 'tuning':
      return tuningTrial(set, players);
    case 'frequency':
      return frequencyTrial(players);
    case 'code':
      return codeTrial(set, players);
    case 'missing':
      return missingTrial(set, players);
  }
}

export interface TrialPlan {
  kind: TrialKind;
  set: ItemSet;
}

// Three different trials, each picture trial on a different set of pictures
export function trialSequence(count: number): TrialPlan[] {
  const sets = shuffle(Object.keys(ITEM_SETS) as ItemSet[]);
  return shuffle(TRIAL_KINDS)
    .slice(0, count)
    .map((kind, i) => ({ kind, set: sets[i % sets.length] }));
}

// ---------- what the whole table knows (used by the tests and the test bots) ----------

// Pool everybody's knowledge: the value every control must be set to, or null if nobody knows it
export function solveFromKnowledge(trial: { kind: TrialKind; controls: { id: string; options: Value[] }[] }, knows: Knowledge[][], hands: Glyph[][] = []) {
  const answer = new Map<string, Value | null>(trial.controls.map((c) => [c.id, null]));
  if (trial.kind === 'missing') {
    const seen = new Set(hands.flat());
    const left = (trial.controls[0]?.options ?? []).filter((x) => !seen.has(x as Glyph));
    if (left.length === 1) trial.controls.forEach((c) => answer.set(c.id, left[0]));
    return answer;
  }
  for (const k of knows.flat()) answer.set(k.controlId, k.value);
  return answer;
}
