// A small meaning dictionary for the companions: word stems grouped by what they mean.
// Phrases are not stored; a message is cut into words, each word is matched to a concept
// by its stem, and the hands-on parsers reason over the concepts. A few kilobytes, built once.

const STEMS: Record<string, string[]> = {
  // states of a bar
  up: ['торч', 'верх', 'стоит', 'поднята', 'стоят', 'стоя', 'подня', 'поднят', 'вверх', 'высок', 'выше', 'столб', 'вытян', 'тянет', 'растет', 'большая', 'больши', 'полная', 'полные', 'up', 'high', 'tall', 'raised', 'stand', 'stick', 'full'],
  down: ['лежит', 'вниз', 'низ', 'ниж', 'лежат', 'опущен', 'опущено', 'легл', 'легли', 'лег', 'упали', 'свалил', 'спуще', 'лежа', 'лёжа', 'плашм', 'опущ', 'опуст', 'низк', 'ниже', 'упал', 'упав', 'пуст', 'спит', 'спят', 'маленьк', 'малая', 'down', 'low', 'flat', 'lying', 'lies', 'empty', 'small'],
  // positions along a row: by the door, the middle, by the window
  pos0: ['басов', 'бас', 'низы', 'низов', 'гул', 'bass', 'двер', 'вход', 'выход', 'порог', 'начал', 'перв', 'левая', 'левой', 'левую', 'левый', 'левее', 'слева', 'door', 'entrance', 'first', 'start', 'left'],
  pos1: ['голос', 'voice', 'vocal', 'средн', 'середин', 'центр', 'посередин', 'между', 'middle', 'centre', 'center', 'between'],
  pos2: ['писклив', 'пискляв', 'писк', 'свист', 'тонк', 'звон', 'treble', 'squeak', 'окн', 'окош', 'стекл', 'форточ', 'конц', 'конец', 'последн', 'правая', 'правой', 'правую', 'правый', 'правее', 'справа', 'window', 'end', 'last', 'right'],
  edges: ['крайн', 'края', 'краю', 'боков', 'бокам', 'edge', 'outer', 'sides'],
  // quantifiers
  all: ['все', 'всё', 'весь', 'вся', 'каждая', 'каждой', 'каждый', 'all', 'every', 'each', 'both'],
  except: ['кроме', 'исключ', 'except', 'but'],
  only: ['только', 'тольк', 'лишь', 'единствен', 'одна', 'only', 'just', 'single'],
  rest: ['остальн', 'другие', 'прочие', 'оставш', 'rest', 'others', 'remaining'],
  not: ['не', 'нет', 'not', "don't", 'no'],
};

// Landmarks around the antenna dial and the socket panel
const LANDMARKS = {
  ceiling: ['потол', 'люстр', 'небо', 'небу', 'небе', 'крыш', 'чердак', 'ceiling', 'sky', 'roof', 'attic'],
  floor: ['пол', 'полу', 'полом', 'пола', 'поле', 'земл', 'ковер', 'ковр', 'плинтус', 'паркет', 'подвал', 'ноги', 'ногами', 'ногам', 'ступн', 'floor', 'ground', 'carpet', 'basement', 'feet'],
  window: ['окн', 'окош', 'стекл', 'подокон', 'форточ', 'улиц', 'штор', 'занавес', 'window', 'glass', 'curtain', 'street'],
  door: ['двер', 'дверк', 'вход', 'выход', 'порог', 'коридор', 'прихож', 'door', 'entrance', 'exit', 'hall'],
};
// Short stems must be whole words ("пол", not "половина"); longer stems forgive one slip ("потоолк")
export function landmark(text: string, which: keyof typeof LANDMARKS): boolean {
  const words = text.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я]+/).filter(Boolean);
  if (which === 'floor' && words.some((w) => /^пол(а|у|ом|е)?$/.test(w))) return true;
  return LANDMARKS[which].some((stem) => !stem.startsWith('пол') && words.some((w) => stem.length <= 4 ? w.startsWith(stem) : stemMatch(w, stem)));
}
export const CEILING = /потол|люстр|(^|[^а-я])неб(о|у|а|е|ом)|крыш|чердак|птиц|облак|ceiling|sky|roof|attic/;
export const FLOOR = /(^|[^а-я])пол(у|а|ом)?([^а-я]|$)|земл|ковер|ковр|плинтус|паркет|подвал|ног(и|ам)( |$)|ступн|floor|ground|carpet|basement|feet/;
export const WINDOW = /окн|окош|стекл|подокон|форточ|улиц|штор|занавес|window|glass|curtain|street/;
export const DOOR = /двер|вход|выход|порог|коридор|прихож|door|entrance|exit|hall/;

const ENTRIES: [string, string][] = Object.entries(STEMS).flatMap(([concept, stems]) => stems.map((s) => [s, concept] as [string, string]));
// Longest stems first, so "посередин" wins over shorter look-alikes
ENTRIES.sort((a, b) => b[0].length - a[0].length);
const SHORT_EXACT = new Set(['не', 'нет', 'вся', 'все', 'всё', 'весь', 'низ', 'no', 'not', 'but', 'up', 'all', 'end']);

export function concept(word: string): string | null {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  for (const [stem, c] of ENTRIES) {
    const s = stem.replace(/ё/g, 'е');
    if (SHORT_EXACT.has(s) ? w === s : w.startsWith(s)) return c;
  }
  // a one-letter slip ("поднта", "толкьо") on longer stems
  for (const [stem, c] of ENTRIES) {
    const s = stem.replace(/ё/g, 'е');
    if (s.length >= 5 && !SHORT_EXACT.has(s) && stemMatch(w, s)) return c;
  }
  return null;
}

const words = (text: string) => text.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я'▓]+/).filter(Boolean);

// Three bars: what each one does, as far as the message says. undefined = not said.
export function readBarsParts(text: string, prior: (0 | 1 | undefined)[] = [undefined, undefined, undefined]): (0 | 1 | undefined)[] {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const bits = [...prior];
  if (/ни одна не (торч|стоит|подня)|ничего не (торч|стоит)|none (stick|stand)/.test(t)) return [0, 0, 0];
  if (/ни одна не (лежит|опущ)|ничего не лежит/.test(t)) return [1, 1, 1];
  if (/горк|бугор|холм|домик|hill|bump/.test(t)) return [0, 1, 0];
  if (/(^|[^а-я])ям(а|ка|у|ой)|впадин|долин|(^|\s)pit|valley|dip/.test(t)) return [1, 0, 1];
  if (/раст[её]т к (окну|писку)|towards the (window|treble)/.test(t)) return [0, 1, 1];
  if (/раст[её]т к (двери|басу)|towards the (door|bass)/.test(t)) return [1, 1, 0];
  if (/лесенк.*(окн|писк)|ступеньк.*(окн|писк)|лесенк[а-я]* вверх|stairs up/.test(t)) return [0, 1, 1];
  if (/лесенк.*(двер|бас)|ступеньк.*(двер|бас)|лесенк[а-я]* вниз|stairs down/.test(t)) return [1, 1, 0];

  // Every word becomes a token; places and quantifiers belong to the nearest state word ("лежит", "торчат")
  type Tok = { c: string; lv?: 0 | 1; afterExcept: boolean; clause: number };
  const toks: Tok[] = [];
  t.split(/[,;.!?:]|\s(?:а|но|while)\s/).forEach((piece, clause) => {
    let negate = false, afterExcept = false;
    for (const w of words(piece)) {
      const c = concept(w);
      if (!c) continue;
      if (c === 'not') { negate = true; continue; }
      if ((c === 'up' || c === 'down') && /^низы|^низов/.test(w)) { toks.push({ c: 'pos0', afterExcept, clause }); continue; }
      if (c === 'up' || c === 'down') { toks.push({ c: 'level', lv: ((c === 'up') !== negate ? 1 : 0) as 0 | 1, afterExcept: false, clause }); negate = false; continue; }
      negate = false;
      if (c === 'except') { afterExcept = true; continue; }
      toks.push({ c, afterExcept, clause });
    }
  });
  const levels = toks.map((x, i) => (x.c === 'level' ? i : -1)).filter((i) => i >= 0);
  if (!levels.length) return bits;
  // "низ, верх, низ": three states and nothing else is a door-to-window list
  if (levels.length === 3 && toks.length === 3) return toks.map((x) => x.lv!) as (0 | 1)[];
  type Scope = { lv: 0 | 1; pos: Set<number>; except: Set<number>; all: boolean; only: boolean; rest: boolean };
  const scopes: Scope[] = levels.map((i) => ({ lv: toks[i].lv!, pos: new Set(), except: new Set(), all: false, only: false, rest: false }));
  toks.forEach((x, i) => {
    if (x.c === 'level') return;
    // nearest state word, preferring the same comma piece, then the closer one, then the one after
    const owner = levels.map((li, k) => ({ k, d: (toks[li].clause === x.clause ? 0 : 100) + Math.abs(li - i) - (li > i ? 0.5 : 0) })).sort((a, b) => a.d - b.d)[0].k;
    const sc = scopes[owner], target = x.afterExcept ? sc.except : sc.pos;
    if (x.c === 'pos0') target.add(0);
    else if (x.c === 'pos1') target.add(1);
    else if (x.c === 'pos2') target.add(2);
    else if (x.c === 'edges') { target.add(0); target.add(2); }
    else if (x.c === 'all') sc.all = true;
    else if (x.c === 'only') sc.only = true;
    else if (x.c === 'rest') sc.rest = true;
  });
  // Places first, then "the rest" fills whatever is still unknown
  const named = new Set(scopes.flatMap((sc) => [...sc.pos]));
  for (const sc of [...scopes].sort((a, b) => Number(a.rest) - Number(b.rest))) {
    const other = (1 - sc.lv) as 0 | 1;
    if (sc.all && sc.except.size) [0, 1, 2].forEach((i) => { bits[i] = sc.except.has(i) ? other : sc.lv; });
    else if (sc.only && sc.pos.size) [0, 1, 2].forEach((i) => { bits[i] = sc.pos.has(i) ? sc.lv : other; });
    // "остальные" means nothing until some bar has been named, here or earlier
    else if (sc.rest) { if (named.size || prior.some((b) => b !== undefined)) [0, 1, 2].forEach((i) => { if (bits[i] === undefined && !named.has(i)) bits[i] = sc.lv; }); }
    else if (sc.all && !sc.pos.size) [0, 1, 2].forEach((i) => { bits[i] = sc.lv; });
    else sc.pos.forEach((i) => { bits[i] = sc.lv; });
  }
  return bits;
}

// Counting without numbers: things everyone knows the number of. Most specific rules first.
// Things everyone knows the number of. Keys are stems; most specific first.
const COUNT_KEYS: [string[], number][] = [
  [['трехколес', 'tricycle'], 3],
  [['велосипед', 'велик', 'bicycle', 'bike'], 2],
  [['осьминог', 'паук', 'щупал', 'octopus', 'spider'], 8],
  [['недел', 'радуг', 'гном', 'week', 'rainbow', 'dwarf'], 7],
  [['жук', 'насеком', 'муравь', 'мух', 'таракан', 'бабочк', 'пчел', 'струн', 'кубик', 'граней', 'грани', 'beetle', 'insect', 'cockroach', 'guitar', 'dice'], 6],
  [['пальц', 'пальч', 'луч', 'лучей', 'fingers', 'toes'], 5],
  [['мушкет', 'поросен', 'поросят', 'богатыр', 'медвед', 'светофор', 'bears', 'pigs', 'musketeer'], 3],
  [['машин', 'автомоб', 'стол', 'стул', 'табурет', 'кроват', 'лошад', 'корова', 'собак', 'кошк', 'кот', 'кота', 'лап', 'времен года', 'сторон света', 'колес', 'нас', 'вас', 'игрок', 'car', 'table', 'chair', 'dog', 'cat', 'paws', 'seasons', 'wheels', 'players'], 4],
  [['глаз', 'уши', 'ушей', 'руки', 'рук', 'крыл', 'близнец', 'сапог', 'носк', 'eyes', 'ears', 'hands', 'wings', 'twins', 'boots', 'socks'], 2],
  [['нос', 'рот', 'рта', 'голов', 'сердц', 'пупок', 'nose', 'mouth', 'head', 'heart'], 1],
];
// stems of 3 letters that may carry endings (лапы, мухи, лучи, носа, жука, руки); the rest are whole words
const SHORT_WITH_ENDINGS = new Set(['лап', 'мух', 'луч', 'нос', 'жук', 'рук', 'кот']);
const WEEKDAYS: [RegExp, number][] = [[/понедельн|monday/, 1], [/вторник|tuesday/, 2], [/сред(а|у|ы|е)|wednesday/, 3], [/четверг|thursday/, 4], [/пятниц|friday/, 5], [/суббот|saturday/, 6], [/воскресен|sunday/, 7]];

function baseCount(t: string): number | null {
  const words = t.split(/[^a-zа-я]+/).filter(Boolean);
  const hit = (k: string) => k.includes(' ') ? keyHit(words, k)
    : k.length <= 3 ? words.some((w) => w === k || (SHORT_WITH_ENDINGS.has(k) && w.startsWith(k) && w.length <= k.length + 3))
    : k.length === 4 ? words.some((w) => w.startsWith(k) && w.length <= k.length + 3 && !/^(столь|глазн|носи|рука)/.test(w))
    : words.some((w) => stemMatch(w, k));
  for (const [keys, n] of COUNT_KEYS) if (keys.some(hit)) return n;
  return null;
}

// "без одной", "и ещё одна", "без двух": corrections on top of a count
export function applyCorrections(t: string, n: number): number {
  if (/без (двух|пары)|без выходн|кроме выходн|рабоч\S* дн|кроме (двух|пары)|минус (два|две)|на (два|две) меньше|two less|weekdays|working days/.test(t)) return n - 2;
  if (/(^|\s)(без|кроме|минус|за вычетом)\s|на (одну|один|одно) меньше|не считая|one less|minus|except|but one|without/.test(t)) n -= 1;
  if (/и ещ[её] (одн|один)|плюс (одн|один)|на (одну|один|одно) больше|\+ ?1|one more|plus one/.test(t)) n += 1;
  return n;
}

// Counting without numbers, with the corrections people add:
// "дней в неделе без воскресенья" = 6, "до среды" = 2, "лапы собаки без одной" = 3, "сколько вас без меня" = 3, "среда" = 3
export function countIn(text: string): number | null {
  // idioms whose "без" is part of the name, not a correction
  const t = text.toLowerCase().replace(/ё/g, 'е').replace(/без д\S?\s?артаньян\S*/g, ' ').replace(/без пуст\S*( (клет|кадр)\S*)?/g, ' ') + ' ';
  const day = WEEKDAYS.find(([re]) => re.test(t));
  if (day && /(^|\s)до\s/.test(t) && (!/включ/.test(t) || /не включ/.test(t))) return day[1] - 1;
  if (day && /(^|\s)(по|включая|включительно)\s/.test(t)) return day[1];
  const n = baseCount(t);
  if (n === null && day && !/без|кроме/.test(t)) return day[1];
  return n === null ? null : applyCorrections(t, n);
}

// ---------- typo-tolerant matching ----------
// A word matches a stem if it starts with it, or (for stems of 5+ letters) its beginning is one edit away:
// "неысокая" still reads as "невысок", "бнаан" as "банан".
function oneEdit(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length && b.length >= 6 && a.slice(i + 1) === b.slice(i + 1)) return true; // substitution, long stems only
  if (a.slice(i + 1) === b.slice(i)) return true; // a has an extra letter
  if (a.slice(i) === b.slice(i + 1)) return true; // b has an extra letter
  return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swapped neighbours
}
// Everyday chat words are never "corrected" into something else ("понял" is not "поднял")
const CHAT_WORDS = new Set('понял поняла понятно понял ладно давай кажется вроде смотри слушай короче кароче значит типа просто потом тоже тогда сейчас можно нужно хорошо отлично спасибо привет точно правильно неправильно стоп подожди погоди ставь ставлю поставь выставь выбирай сделай давайте молодец норм ок окей'.split(' '));
export function stemMatch(word: string, stem: string) {
  if (word.startsWith(stem)) return true;
  if (CHAT_WORDS.has(word)) return false;
  // a slip never touches the first letter: "поверни" must not read as "ковер"
  if (stem.length < 5 || word.length < stem.length - 1 || word[0] !== stem[0]) return false;
  return [stem.length - 1, stem.length, stem.length + 1].some((n) => oneEdit(word.slice(0, n), stem));
}
export const normalizeText = (text: string) => ' ' + text.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim() + ' ';
export const wordsOf = (text: string) => normalizeText(text).trim().split(' ').filter(Boolean);
// A key is one stem ("пицц") or several in a row ("три угл"); several must appear next to each other
export function keyHit(words: string[], key: string): boolean {
  const parts = key.split(' ');
  for (let i = 0; i + parts.length <= words.length; i++) if (parts.every((p, k) => stemMatch(words[i + k], p))) return true;
  return false;
}
