// Hand-tuned radio parts: a wave, a strip of tape and an antenna.
// Their values are small numbers, but players never see a digit: they see a picture
// and describe it in their own words (height, length, direction).
import type { L, Lang, TrialKind, Value } from './protocol';
import { countIn, applyCorrections, keyHit, landmark, readBarsParts, stemMatch, wordsOf } from './lexicon';
export { readBarsParts };

export type DialKind = 'wave' | 'cassette' | 'antenna' | 'equalizer' | 'morse' | 'scale' | 'wires' | 'lamp';
export const DIAL_TRIALS: TrialKind[] = ['wave', 'cassette', 'antenna', 'equalizer', 'morse', 'scale', 'wires', 'lamp'];
export const isDial = (kind: TrialKind): kind is DialKind => DIAL_TRIALS.includes(kind);

// wave: 0..8 = height (0 low, 1 medium, 2 high) * 3 + density (0 sparse, 1 medium, 2 dense)
export const WAVE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const waveHeight = (v: number) => Math.floor(v / 3);
export const waveDensity = (v: number) => v % 3;
export const waveValue = (height: number, density: number) => height * 3 + density;
// cassette: how many of the eight frames the tape covers
export const TAPE_FRAMES = 8;
export const CASSETTE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
// antenna: eight directions, 0 = straight up, clockwise in 45° steps
export const ANTENNA_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

// equalizer: three bars, bit 2 = left … bit 0 = right, 1 = raised
// morse: three signals, bit 2 = first … bit 0 = last, 1 = long
export const BITS_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];
export const bitAt = (v: number, i: number) => (v >> (2 - i)) & 1;
export const bitsValue = (bits: number[]) => (bits[0] << 2) | (bits[1] << 1) | bits[2];
// scale: nine stops; five pictures stand on the even stops, odd stops are between two pictures
export const SCALE_STOPS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
// wires: six sockets, row * 3 + column (row 0 = top)
export const WIRE_OPTIONS = [0, 1, 2, 3, 4, 5];
// lamp: six colours; their names are jammed in this trial
export const LAMP_COLORS = ['#c4554d', '#dcc55a', '#6fae5c', '#5a86c4', '#8d62b0', '#ece7dc'];
export const LAMP_OPTIONS = [0, 1, 2, 3, 4, 5];
// The obvious words of each trial are jammed, so teams have to find images instead.
// Patterns are matched against single lowercase words (ё already folded into е).
const SIDES: RegExp[] = [
  /^(вверх|наверх|вниз|книзу|влево|налево|вправо|направо|левее|правее|выше|ниже|сверху|снизу|слева|справа)$/,
  /^(лев|прав)(ая|ый|ую|ой|ое|ом|ые|ых|о)$/, /^(верх|низ)(у|а|ом|ний|няя|нюю|нее|нем|них|ние)?$/,
  /^(up|down|left|right|upper|lower|top|bottom|above|below)$/,
];
export const TRIAL_JAMS: Partial<Record<TrialKind, RegExp[]>> = {
  wave: [/^(част|редк|густ|плотн)/, /^(frequent|dense|sparse|often|rare)/],
  antenna: [...SIDES, /^(север|юг|запад|восток|диагонал|наискос)/, /^(north|south|east|west|diagonal)/],
  wires: [...SIDES, /^(ряд|row)/],
  cassette: [/^половин/, /^(целиком|полностью)$/, /^середин/, /^(half|whole|entire|middle)$/],
  equalizer: [...SIDES, /^(высок|низк|подня|опущ)/, /^(high|low|tall|raised|lowered)$/],
  morse: [/^(коротк|длинн|долг|точк|тире)/, /^(short|long|dot|dash)/],
  lamp: [/^(красн|желт|зелен|син|голуб|фиолет|сиренев|бел|оранж|розов|черн|сер(ый|ая|ое|ого))/, /^(red|yellow|green|blue|purple|violet|white|orange|pink|black|grey|gray)$/],
};
export const LAMP_JAMMED = TRIAL_JAMS.lamp!;

export const dialOptions = (kind: DialKind) => kind === 'wave' ? WAVE_OPTIONS : kind === 'cassette' ? CASSETTE_OPTIONS
  : kind === 'antenna' ? ANTENNA_OPTIONS : kind === 'scale' ? SCALE_STOPS : kind === 'wires' ? WIRE_OPTIONS : kind === 'lamp' ? LAMP_OPTIONS : BITS_OPTIONS;

const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

const HEIGHT_RU = [['низкая', 'почти плоская', 'еле дышит'], ['средней высоты', 'обычная по высоте'], ['высокая', 'горбы как горы', 'здоровая такая']];
const HEIGHT_EN = [['low', 'almost flat', 'barely there'], ['medium height', 'normal height'], ['tall', 'peaks like mountains', 'big']];
const DENSITY_RU = [['горбы далеко друг от друга', 'ленивая, растянутая, как шарф'], ['горбы обычные, без крайностей', 'горбы как у спокойного моря'], ['как пила', 'зубцы впритык, как у расчёски']];
const DENSITY_EN = [['the humps are far apart', 'lazy and stretched like a scarf'], ['ordinary humps, nothing extreme', 'humps like a calm sea'], ['like a saw', 'teeth packed like a comb']];
const DIRECTION_RU = ['прямо в потолок', 'между потолком и окном', 'прямо на окно', 'между окном и полом', 'прямо в пол', 'между полом и дверью', 'прямо на дверь', 'между дверью и потолком'];
const DIRECTION_EN = ['straight at the ceiling', 'between the ceiling and the window', 'straight at the window', 'between the window and the floor', 'straight at the floor', 'between the floor and the door', 'straight at the door', 'between the door and the ceiling'];
const TAPE_RU: Record<number, string[]> = {
  8: ['до самого края, ни одной пустой клетки'],
  7: ['почти до края, не хватает самой крайней клетки'],
};
const TAPE_EN: Record<number, string[]> = {
  8: ['right to the edge, no empty frames'],
  7: ['almost to the edge, the very end frame is empty'],
};
const COUNT_RU = ['', 'сколько носов у человека', 'сколько колёс у велосипеда', 'сколько медведей в сказке про Машу', 'сколько лап у собаки', 'сколько пальцев на руке', 'сколько ног у жука', 'сколько дней в неделе', 'сколько щупалец у осьминога'];
const COUNT_EN = ['', 'how many noses you have', 'the wheels on a bicycle', 'the bears in Goldilocks', 'the legs of a dog', 'the fingers on a hand', 'the legs of a beetle', 'the days in a week', 'the arms of an octopus'];

const EQ_RU: Record<number, string[]> = {
  0: ['все полоски лежат плашмя'], 7: ['все полоски торчат столбом'],
  2: ['горка: торчит только голос'], 5: ['яма: бас и писк торчат, голос лежит'],
  4: ['торчит только бас'], 1: ['торчит только писк'],
  3: ['лесенка, растёт к писку: бас лежит, остальные торчат'], 6: ['лесенка, растёт к басу: писк лежит, остальные торчат'],
};
const EQ_EN: Record<number, string[]> = {
  0: ['every bar lies flat'], 7: ['every bar stands like a pillar'], 2: ['a hill: only the voice sticks out'], 5: ['a pit: bass and treble stick out, the voice lies flat'],
  4: ['only the bass sticks out'], 1: ['only the treble sticks out'],
  3: ['stairs growing towards the treble: bass flat, the rest stick out'], 6: ['stairs growing towards the bass: treble flat, the rest stick out'],
};
const ROW_RU = ['ближе к потолку', 'ближе к полу'], COL_RU = ['у двери', 'посередине', 'у окна'];
const ROW_EN = ['nearer the ceiling', 'nearer the floor'], COL_EN = ['by the door', 'in the middle', 'by the window'];
const LAMP_RU = [['как спелый помидор', 'как кровь', 'как клубника'], ['как лимон', 'как цыплёнок', 'как банан'], ['как трава', 'как огурец', 'как лягушка'],
  ['как небо днём', 'как море', 'как джинсы'], ['как баклажан', 'как слива', 'как виноград'], ['как молоко', 'как чистый лист бумаги', 'как сахар']];
const LAMP_EN = [['like a ripe tomato', 'like a strawberry'], ['like a lemon', 'like a banana'], ['like grass', 'like a cucumber'],
  ['like the daytime sky', 'like the sea'], ['like an aubergine', 'like a plum'], ['like milk', 'like a sheet of paper']];

// A natural description of a value, the way a teammate would say it in chat
export function describeDial(kind: DialKind, v: number, lang: Lang): string {
  const ru = lang === 'ru';
  if (kind === 'equalizer') return pick((ru ? EQ_RU : EQ_EN)[v]);
  if (kind === 'morse') {
    const s = [0, 1, 2].map((i) => bitAt(v, i));
    return ru ? `стучи так: ${s.map((b) => b ? 'тууук' : 'тук').join(', ')}` : `tap it like this: ${s.map((b) => b ? 'beeeep' : 'beep').join(', ')}`;
  }
  if (kind === 'wires') return ru ? `${ROW_RU[Math.floor(v / 3)]}, ${COL_RU[v % 3]}` : `${ROW_EN[Math.floor(v / 3)]}, ${COL_EN[v % 3]}`;
  if (kind === 'lamp') return ru ? `горит ${pick(LAMP_RU[v])}` : `it glows ${pick(LAMP_EN[v])}`;
  if (kind === 'wave') {
    const h = pick((ru ? HEIGHT_RU : HEIGHT_EN)[waveHeight(v)]), d = pick((ru ? DENSITY_RU : DENSITY_EN)[waveDensity(v)]);
    return ru ? `волна ${h}, ${d}` : `the wave is ${h}, ${d}`;
  }
  if (kind === 'antenna') return (ru ? DIRECTION_RU : DIRECTION_EN)[v];
  const fixed = (ru ? TAPE_RU : TAPE_EN)[v];
  if (fixed && Math.random() < 0.5) return pick(fixed);
  return ru ? `закрась столько клеток, ${COUNT_RU[v]}` : `fill as many frames as ${COUNT_EN[v]}`;
}

const has = (text: string, re: RegExp) => re.test(text);

// Partial understanding: what the bot could read from a message (undefined = not mentioned)
const WAVE_WORDS: [string, string][] = [
  ['полог', 'H0'], ['неторопл', 'D0'], ['торопл', 'D2'], ['сутул', 'H0'], ['подпрыг', 'H2'], ['прыга', 'H2'], ['гребен', 'D2'], ['перерыв', 'D0'], ['промежут', 'D0'],
  ['ровн', 'H0'], ['линия', 'H0'],
  ['невысок', 'H0'], ['небольш', 'H0'], ['нечаст', 'D0'], ['нередк', 'D2'], ['barely', 'H0'], ['peak', 'H2'], ['far', 'D0'], ['apart', 'D0'], ['часто', 'D2'], ['редко', 'D0'],
  // height
  ['высок', 'H2'], ['высоч', 'H2'], ['больш', 'H2'], ['огромн', 'H2'], ['здоров', 'H2'], ['гигант', 'H2'], ['пики', 'H2'], ['tall', 'H2'], ['high', 'H2'], ['big', 'H2'], ['huge', 'H2'],
  ['низк', 'H0'], ['низен', 'H0'], ['маленьк', 'H0'], ['мален', 'H0'], ['крошечн', 'H0'], ['крохотн', 'H0'], ['плоск', 'H0'], ['еле', 'H0'], ['незаметн', 'H0'], ['слаб', 'H0'], ['тих', 'H0'], ['low', 'H0'], ['small', 'H0'], ['tiny', 'H0'], ['flat', 'H0'],
  // spacing
  ['пил', 'D2'], ['впритык', 'D2'], ['близко', 'D2'], ['дерган', 'D2'], ['быстр', 'D2'], ['зубч', 'D2'], ['зубц', 'D2'], ['расческ', 'D2'], ['нервн', 'D2'], ['тесн', 'D2'], ['густ', 'D2'], ['saw', 'D2'], ['comb', 'D2'], ['fast', 'D2'], ['dense', 'D2'],
  ['далеко', 'D0'], ['растянут', 'D0'], ['вытянут', 'D0'], ['ленив', 'D0'], ['медлен', 'D0'], ['плавн', 'D0'], ['широк', 'D0'], ['редк', 'D0'], ['шарф', 'D0'], ['stretched', 'D0'], ['lazy', 'D0'], ['slow', 'D0'], ['sparse', 'D0'], ['wide', 'D0'],
  ['спокойн', 'DM'], ['calm', 'DM'],
  // words whose meaning depends on what they describe
  ['средн', 'M'], ['обычн', 'M'], ['нормальн', 'M'], ['норм', 'M'], ['умерен', 'M'], ['medium', 'M'], ['normal', 'M'], ['ordinary', 'M'], ['average', 'M'],
  ['мелк', 'SMALL'], ['много', 'MANY'], ['мало', 'FEW'], ['горб', 'HUMP'], ['зубья', 'HUMP'], ['пик', 'HUMP'], ['humps', 'HUMP'], ['волн', 'WAVE'], ['высот', 'HEIGHT'], ['частот', 'SPACING'],
  ['не', 'NOT'], ['горы', 'H2'], ['гора', 'H2'], ['mountain', 'H2'], ['ripple', 'H0'], ['рябь', 'H0'],
];
WAVE_WORDS.sort((a, b) => b[0].length - a[0].length);
// Exact stems first; a one-letter slip is only forgiven when nothing matches exactly
const waveTag = (w: string) => {
  if (/^пил(а|ы|у|ой|ой)?$/.test(w)) return 'D2';
  for (const [stem, tag] of WAVE_WORDS) if (stem.length <= 3 ? w === stem : w.startsWith(stem)) return tag;
  for (const [stem, tag] of WAVE_WORDS) if (stem.length >= 5 && stemMatch(w, stem)) return tag;
  return null;
};

// Height and spacing of a wave, each undefined when the message does not say
export function readWave(text: string): { height?: number; density?: number } {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  if (/вс[её] средн|all medium/.test(t)) return { height: 1, density: 1 };
  let height: number | undefined, density: number | undefined;
  if (/не высок\S* и не низк|не низк\S* и не высок/.test(t)) height = 1;
  // Words are read inside their own comma piece: "средняя, горбы обычные" = medium height, medium humps
  const tokens = t.split(/[,;:]|\s(?:а|но)\s/).flatMap((piece, clause) => wordsOf(piece).map((w) => ({ w, tag: waveTag(w), clause })));
  const tagAt = (j: number, clause: number) => (tokens[j] && tokens[j].clause === clause ? tokens[j].tag : null);
  let extremes = 0;
  for (let i = 0; i < tokens.length; i++) {
    let tag = tokens[i].tag;
    const cl = tokens[i].clause;
    if (!tag || tag === 'NOT') continue;
    const prev = tagAt(i - 1, cl), next = tagAt(i + 1, cl), near = [tagAt(i - 2, cl), prev, next, tagAt(i + 2, cl)];
    if (prev === 'NOT') tag = tag === 'H2' ? 'H0' : tag === 'H0' ? 'H2' : tag === 'D2' ? 'D0' : tag === 'D0' ? 'D2' : tag;
    // "частота большая": a size word next to the spacing word is about spacing
    if ((tag === 'H2' || tag === 'H0') && prev !== 'HEIGHT' && (prev === 'SPACING' || next === 'SPACING')) tag = tag === 'H2' ? 'D2' : 'D0';
    if (tag === 'SMALL') tag = next === 'HUMP' || next === 'D2' ? 'D2' : 'H0';
    if (tag === 'MANY' || tag === 'FEW') { if (near.includes('HUMP')) tag = tag === 'MANY' ? 'D2' : 'D0'; else continue; }
    if (tag === 'M') tag = prev === 'HUMP' || next === 'HUMP' || near.includes('SPACING') ? 'DM' : near.includes('HEIGHT') || near.includes('WAVE') ? 'HM' : height === undefined ? 'HM' : 'DM';
    if (tag === 'H2' || tag === 'H0' || tag === 'D2' || tag === 'D0') extremes++;
    if (tag === 'H2' && height === undefined) height = 2;
    else if (tag === 'H0' && height === undefined) height = 0;
    else if (tag === 'HM' && height === undefined) height = 1;
    else if (tag === 'D2' && density === undefined) density = 2;
    else if (tag === 'D0' && density === undefined) density = 0;
    else if (tag === 'DM' && density === undefined) density = 1;
  }
  // "обычная волна" with nothing extreme anywhere: medium on both counts
  if (!extremes && (height === 1 || density === 1)) { height ??= 1; density ??= 1; }
  // "обычная волна, без крайностей": whatever is still unsaid is the middle
  if (/без крайност|nothing extreme/.test(t)) { height ??= 1; density ??= 1; }
  return { height, density };
}

// Landmark vocabulary lives in the shared lexicon
export function readAntenna(text: string): number | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const up = has(t, /вверх|наверх|(^|\s)верх|север|\bup\b|north/) || landmark(t, 'ceiling');
  const down = has(t, /вниз|книзу|(^|\s)низ|юг|down|south/) || landmark(t, 'floor');
  const right = has(t, /вправ|направо|(^|\s)право|(^|\s)прав(ую|ой|ая|ый)|восток|right|east/) || landmark(t, 'window');
  const left = has(t, /влев|налев|(^|\s)лево|(^|\s)лев(ую|ой|ая|ый)|запад|left|west/) || landmark(t, 'door');
  if (!up && !down && !right && !left && /час/.test(t)) {
    const hour = clockHour(t);
    if (hour !== null) return [0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7, 0][hour];
  }
  if (up && down || left && right) return null;
  if (up) return right ? 1 : left ? 7 : 0;
  if (down) return right ? 3 : left ? 5 : 4;
  if (right) return 2;
  if (left) return 6;
  return null;
}

const NUMBER_WORDS: [RegExp, number][] = [
  [/двенадцат/, 12], [/одиннадцат/, 11], [/десят/, 10], [/девят/, 9], [/восем|восьм/, 8], [/(?<![а-я])сем(ь|и)(?![а-я])|седьм/, 7], [/шест/, 6], [/пят(ь|и|ая|ую)/, 5],
  [/четыр|четвер/, 4], [/(?<![а-я])тр(и|ое|ех)(?![а-я])|трет/, 3], [/(?<![а-я])дв(а|е|ух)(?![а-я])|втор|(?<![а-я])пар(а|у)(?![а-я])/, 2], [/(?<![а-я])одн(а|у|ой|о)(?![а-я])|(?<![а-я])один(?![а-я])|перв/, 1],
  [/twelve/, 12], [/eleven/, 11], [/\bten\b/, 10], [/nine/, 9], [/eight/, 8], [/seven/, 7], [/\bsix\b/, 6], [/five/, 5], [/four/, 4], [/three/, 3], [/\btwo\b/, 2], [/\bone\b|first/, 1],
];
function numberIn(t: string): number | null {
  const digit = t.match(/\b(1[0-2]|[0-9])\b/);
  if (digit) return Number(digit[1]);
  for (const [re, n] of NUMBER_WORDS) if (re.test(t)) return n;
  return null;
}
function clockHour(t: string): number | null {
  const n = numberIn(t);
  return n === null ? null : n % 12 === 0 ? 0 : n;
}

export function readTape(text: string): number | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  // A counted thing ("ног у жука", "дней в неделе без воскресенья") beats the generic "все"/"без одной" phrasing
  const counted = countIn(t);
  if (counted !== null) return counted >= 1 && counted <= TAPE_FRAMES ? counted : null;
  if (has(t, /почти (вся|все|до конца|целиком|полн)|без (самой )?(крайн|последн|одной)|кроме (самой )?(крайн|последн|одной)|не хватает (самой )?(крайн|последн|одной)|almost all|almost to the edge|почти до края|крайняя пуст|nearly to the end|a frame short|all but one|minus the (very )?(last|end)/)) return 7;
  if (has(t, /(^|\s)вся(\s|$)|(^|\s)все(\s|$)|вся (лента|пленка)|все клетк|целиком|до (самого )?(конца|края)|полностью|без пуст|ни одной пуст|right to the edge|whole|all the way|entire|all of it/)) return 8;
  if (has(t, /половин|середин|half|middle/)) {
    if (has(t, /меньше|без|не доходя|less|short of/)) return 3;
    if (has(t, /больше|плюс|и ещ|more|plus/)) return 5;
    return 4;
  }
  if (has(t, /чуть[\s-]*чуть|совсем немного|самый край|самая перв|только перв|минимум|a little|just the first/)) return 1;
  let n = numberIn(t);
  if (n !== null) n = applyCorrections(t, n);
  return n !== null && n >= 1 && n <= TAPE_FRAMES ? n : null;
}

// Three bars: an ordered list of levels, a named shape or "only the left one is high"
export function readEqualizer(text: string): number | null {
  const bits = readBarsParts(text);
  return bits.every((b) => b !== undefined) ? bitsValue(bits as number[]) : null;
}

// Three signals in order: short/long words, "тук"/"тууук", dots and dashes
export function readMorse(text: string): number | null {
  // A full stop after a word ends the sentence; only free-standing dots are Morse dots
  const t = text.toLowerCase().replace(/ё/g, 'е').replace(/([а-яa-z)»"])\.+/g, '$1');
  if (has(t, /все (три )?(сигнала )?(коротк)|all short/)) return 0;
  if (has(t, /все (три )?(сигнала )?(длинн|долг)|all long/)) return 7;
  const marks: number[] = [];
  const tokens = t.split(/[\s,;!?()]+/).filter(Boolean);
  // with sound words present, dashes between them are just separators: "тук - тууук - тук"
  const SOUND = /^[тпбдк][иаоуеыэ]+[кпмнт]?$/;
  const sounds = tokens.some((w) => SOUND.test(w) || /^(be+p)$/.test(w) || /^(длинн|долг|коротк|тире|точк|long|short|dash|dot)/.test(w));
  for (const w of tokens) {
    if (/^[.\-–—·]+$/.test(w)) { if (!sounds) for (const c of w) marks.push(c === '.' || c === '·' ? 0 : 1); continue; }
    if (/^(длинн|долг|тире|long|dash)/.test(w) || /^be{3,}p$/.test(w)) marks.push(1);
    else if (/^(коротк|точк|short|dot)/.test(w) || w === 'beep') marks.push(0);
    else if (SOUND.test(w) && !['так', 'там', 'тот', 'тут', 'как', 'кот', 'пот', 'да', 'до', 'по', 'то', 'ты', 'бы', 'ну', 'ок'].includes(w)) marks.push(/([иаоуеыэ])\1/.test(w) ? 1 : 0);
  }
  // ".--." closing a sentence: the last dot is the full stop
  if (!sounds && marks.length === 4 && marks[3] === 0) marks.length = 3;
  return marks.length === 3 ? bitsValue(marks) : null;
}

export function readWiresParts(text: string): { row?: number; col?: number } {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const row = has(t, /верх|сверху|top|upper/) || landmark(t, 'ceiling') ? 0 : has(t, /низ|ниж|снизу|bottom|lower/) || landmark(t, 'floor') ? 1 : undefined;
  const col = has(t, /(^|\s)лев|слева|left/) || landmark(t, 'door') ? 0 : has(t, /(^|\s)прав|справа|right/) || landmark(t, 'window') ? 2 : has(t, /средн|центр|посередин|середин|между|middle|centre|center/) || wordsOf(t).some((w) => stemMatch(w, 'посередин') || stemMatch(w, 'середин')) ? 1 : undefined;
  return { row, col };
}
export function readWires(text: string): number | null {
  const { row, col } = readWiresParts(text);
  return row !== undefined && col !== undefined ? row * 3 + col : null;
}

// Things of each lamp colour, as stems; typos are forgiven on longer ones
const LAMP_KEYS: string[][] = [
  ['помидор', 'томат', 'кров', 'клубник', 'вишн', 'пожар', 'малин', 'рак', 'кетчуп', 'перец', 'перч', 'арбуз', 'мак', 'роз', 'стоп', 'светофор стоп', 'губ', 'свекольн', 'флаг', 'знак стоп', 'божья коровк', 'рябин', 'tomato', 'blood', 'strawberr', 'cherry', 'ketchup', 'fire truck'],
  ['лимон', 'цыпл', 'банан', 'желток', 'подсолнух', 'солныш', 'солнц', 'одуванч', 'кукуруз', 'сыр', 'мед', 'песок', 'пчел', 'мандарин', 'апельсин', 'тыкв', 'такси', 'золот', 'горчиц', 'канарейк', 'lemon', 'banana', 'chick', 'yolk', 'sunflower', 'sun', 'cheese'],
  ['трав', 'огур', 'листь', 'листв', 'листик', 'лягуш', 'крокодил', 'салат', 'елк', 'ёлк', 'киви', 'газон', 'мох', 'мха', 'горох', 'кузнечик', 'светофор ид', 'изумруд', 'кабачок', 'укроп', 'хвоя', 'зелень', 'grass', 'cucumber', 'leaf', 'leaves', 'frog', 'lime', 'lawn', 'moss'],
  ['небо', 'небу', 'неба', 'море', 'моря', 'морск', 'океан', 'джинс', 'вода', 'воды', 'васил', 'бассейн', 'черник', 'голубик', 'незабуд', 'сапфир', 'полицейск', 'мигалк', 'смурф', 'аватар', 'sky', 'sea', 'ocean', 'jeans', 'water', 'blueberr'],
  ['баклажан', 'слив', 'виноград', 'лаванд', 'ежевик', 'фиалк', 'свекл', 'сирен', 'аметист', 'бузин', 'синяк', 'фиолет', 'лилов', 'aubergine', 'eggplant', 'plum', 'grape', 'lavender', 'violet', 'beet'],
  ['молок', 'бумаг', 'сахар', 'снег', 'простын', 'зефир', 'облак', 'мел', 'вата', 'соль', 'зубн паст', 'простокваш', 'кефир', 'сметан', 'фарфор', 'привидени', 'призрак', 'лебед', 'халат врач', 'чистый лист', 'milk', 'paper', 'sugar', 'snow', 'cloud', 'chalk', 'salt'],
];
export function readLamp(text: string): number | null {
  const words = wordsOf(text);
  // exact stems count double: "лист бумаги" is paper, not a misspelt "листья"
  const score = (k: string) => k.includes(' ') ? (keyHit(words, k) ? 2 : 0)
    : k.length <= 3 ? (words.some((w) => w === k || (w.startsWith(k) && w.length <= k.length + 2)) ? 2 : 0)
    : words.some((w) => w.startsWith(k)) ? 2 : words.some((w) => stemMatch(w, k)) ? 1 : 0;
  const totals = LAMP_KEYS.map((keys) => Math.max(0, ...keys.map(score)));
  const top = Math.max(...totals);
  return top > 0 && totals.filter((x) => x === top).length === 1 ? totals.indexOf(top) : null;
}

// How to describe it: ways of talking, never the answer
export const DESCRIBE_HINTS: Partial<Record<TrialKind, L[]>> = {
  wave: [
    { en: 'Height is fine, spacing words are jammed', ru: 'Высоту можно, частоту радио глушит' },
    { en: 'Spacing: a saw, a comb, a scarf', ru: 'Частота: пила, расчёска, шарф' },
  ],
  cassette: [
    { en: 'Half, whole and numbers are jammed', ru: 'Половину, целиком и числа глушит' },
    { en: 'Count: legs, fingers, wheels, days', ru: 'Считай: лапы, пальцы, колёса, дни' },
  ],
  antenna: [
    { en: 'Up, down, left, right are jammed', ru: 'Вверх, вниз, влево, вправо глушит' },
    { en: 'Landmarks: ceiling, floor, window, door', ru: 'Ориентиры: потолок, пол, окно, дверь' },
  ],
  equalizer: [
    { en: 'High, low, left, right are jammed', ru: 'Высокая, низкая, лево, право глушит' },
    { en: 'Sticks out or lies flat: bass, voice, treble', ru: 'Торчит или лежит: бас, голос, писк' },
  ],
  morse: [
    { en: 'Short, long, dot, dash are jammed', ru: 'Коротко, длинно, точку, тире глушит' },
    { en: 'Tap it with sounds: beep, beeeep', ru: 'Простучи звуком: тук, тууук' },
  ],
  scale: [
    { en: 'Between which two pictures?', ru: 'Между какими картинками?' },
    { en: 'Describe pictures without names', ru: 'Картинки описывай без названий' },
  ],
  wires: [
    { en: 'Up, down, left, right are jammed', ru: 'Верх, низ, лево, право глушит' },
    { en: 'Landmarks: ceiling, floor, window, door', ru: 'Ориентиры: потолок, пол, окно, дверь' },
  ],
  lamp: [
    { en: 'Colour names are jammed', ru: 'Цвета радио глушит' },
    { en: 'What else is that colour?', ru: 'Что ещё бывает такого цвета?' },
  ],
  code: [
    { en: 'What it does, where you meet it', ru: 'Что делает и где встречается' },
    { en: 'Shape, sound, material', ru: 'Форма, звук, материал' },
  ],
  missing: [
    { en: 'Describe each of your cards', ru: 'Опиши каждую свою карточку' },
    { en: 'Then say that is all', ru: 'В конце скажи, что это всё' },
  ],
};

export const isDialValue = (kind: TrialKind, v: Value): v is number => isDial(kind) && typeof v === 'number';
