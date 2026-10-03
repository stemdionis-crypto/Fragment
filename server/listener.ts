// The radio listens to every message.
//
// 1. It understands plain words: the names of the items (signs, objects, animals) and numbers, in English and Russian.
// 2. It is not fooled by spelling tricks a human would read straight through:
//    mixed alphabets ("звезdа"), transliteration ("zvezda", "ред"), digits for letters ("st4r", "3везда"),
//    stretched letters ("звееезда"), spelled-out letters ("з в е з д а", "з.в.е.з.д.а") and typos ("зведза").
// 3. It learns: a word the team keeps repeating becomes a word the radio understands too,
//    so the team has to keep inventing new language.
//
// Next step: an LLM judge for semantic leaks ("three corners and a sharp top").

type Matcher = { exact?: string[]; prefix?: string[]; words?: string[] };

// exact: whole-word forms · prefix: Russian stems (cover all endings) · words: full forms used for typo matching
const CATEGORIES: Record<string, Matcher> = {
  signs: {
    exact: [
      'triangle', 'triangles', 'circle', 'circles', 'ring', 'square', 'squares', 'box', 'cross', 'crosses', 'x', 'star', 'stars',
      'moon', 'moons', 'crescent', 'eye', 'eyes', 'key', 'keys', 'око',
    ],
    prefix: ['треуг', 'круг', 'кружо', 'кольц', 'квадр', 'крест', 'звезд', 'лун', 'месяц', 'полумесяц', 'глаз', 'ключ'],
    words: [
      'треугольник', 'кружок', 'кольцо', 'квадрат', 'крестик', 'звезда', 'звездочка', 'полумесяц', 'месяц', 'triangle', 'circle', 'square',
      'crescent', 'crosses',
    ],
  },
  objects: {
    exact: [
      'candle', 'candles', 'cup', 'cups', 'mug', 'clock', 'clocks', 'watch', 'knife', 'knives', 'book', 'books', 'coin', 'coins', 'feather',
      'feathers', 'quill', 'bottle', 'bottles',
      'нож', 'ножа', 'ножу', 'ножом', 'ноже', 'ножи', 'ножик', 'ножичек', 'перо', 'пера', 'перу', 'пером', 'перья', 'перышко', 'часы', 'часов',
      'часам', 'часами', 'часики',
    ],
    prefix: ['свеч', 'свечк', 'кружк', 'чашк', 'чашеч', 'книг', 'книж', 'монет', 'бутыл', 'бутылоч'],
    words: ['свеча', 'свечка', 'кружка', 'чашка', 'книга', 'книжка', 'монета', 'монетка', 'бутылка', 'candle', 'feather', 'bottle'],
  },
  animals: {
    exact: [
      'cat', 'cats', 'kitten', 'kitty', 'owl', 'owls', 'fish', 'fishes', 'spider', 'spiders', 'crow', 'crows', 'raven', 'snake', 'snakes',
      'rabbit', 'rabbits', 'bunny', 'hare', 'moth', 'moths',
      'кот', 'кота', 'коту', 'котом', 'коте', 'коты', 'котик', 'котика', 'котенок', 'котята', 'кошка', 'кошку', 'кошки', 'кошкой', 'киса', 'кису',
      'сова', 'сову', 'совы', 'совой', 'сове', 'совушка', 'моль', 'заяц', 'зайца', 'зайцу', 'зайчик', 'зайка',
    ],
    prefix: ['рыб', 'паук', 'паучо', 'ворон', 'змея', 'змей', 'змеи', 'змею', 'кролик', 'кролич', 'мотыл', 'бабочк'],
    words: ['рыбка', 'паучок', 'ворона', 'кролик', 'мотылек', 'бабочка', 'spider', 'rabbit', 'kitten'],
  },
  numbers: {
    exact: [
      'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'first', 'second', 'third', 'fourth', 'fifth',
      'sixth', 'seventh', 'eighth', 'ninth', 'last', 'once', 'twice', 'nought', 'nil',
      'ноль', 'нуль', 'нуля', 'нулю', 'один', 'одна', 'одно', 'два', 'две', 'три', 'трое', 'четыре', 'пять', 'пяти', 'пятью', 'пятый', 'пятая',
      'пятое', 'шесть', 'шести', 'шестью', 'шестой', 'шестая', 'семь', 'сем', 'семи', 'семью', 'седьмой', 'седьмая',
      'восемь', 'восьми', 'восемью', 'восьмой', 'восьмая', 'девять', 'девяти', 'девятью', 'девятый', 'девятая', 'десять',
      'десяти',
    ],
    prefix: ['перв', 'втор', 'трет', 'четв', 'четыр', 'послед', 'нулев'],
    words: ['первый', 'второй', 'третий', 'четвертый', 'четыре', 'последний', 'восемь', 'девять', 'десять', 'шестой', 'седьмой', 'second', 'fourth', 'seven', 'eight'],
  },
};

const ALL_EXACT = new Set(Object.values(CATEGORIES).flatMap((m) => m.exact ?? []));
const ALL_PREFIX = Object.values(CATEGORIES).flatMap((m) => m.prefix ?? []);
const ALL_WORDS = [...new Set(Object.values(CATEGORIES).flatMap((m) => [...(m.words ?? []), ...(m.exact ?? [])]))].filter((w) => w.length >= 5);

// Common words the radio never "learns", so it doesn't punish normal talk.
const STOPWORDS = new Set(
  `looks look mine like sequence goes idea this that with have what when where which there their they them then than these those just like very really maybe yeah okay sure think know does dont didnt cant wont your yours mine ours will would could should about into from only also some same other more most much many here press button buttons code radio sign signs tone tones order rule wait sorry what's it's i'm you're let's
   это этот эта эти тот там тут так как что чтобы когда где кто какой какая какое какие который которая которые если тоже только очень может можно нужно надо есть было будет буду будем будешь давай давайте хорошо ладно понял поняла понятно думаю знаю кнопка кнопку кнопки нажми нажать нажимай нажимаю радио код знак знаки порядок правило подожди сейчас уже ещё еще меня тебя тебе мне него нее неё него наш ваш свой своя свои всех всем всё все похож похожа похоже
   пришел пришла пришли пришло пришлa вошел вошла вошли раньше позже после перед сразу прямо начале начала конце конца кода стоит стоят обязательно комнате комнату кто-то кого-то загадано подсказка подсказки показания есть мене меня нету ничего угадал угадала думаю наверно наверное может значит тогда
   came before after start right very code there someone already room clue another hidden have think maybe guess your yours knob digit place vote
   твоя твой твое твои твою твоей твоего твоим мой моя мое мои мою моей моего ваша ваше ваши вашу вашей ручка ручку ручки цифра цифру цифры место месте голос голосую`.split(
    /\s+/,
  ),
);

const LEARN_AFTER = 3; // uses before the radio understands a word
const LEARN_COOLDOWN_MS = 40_000;

// ---------- normalisation: how a human would read the word ----------

const CYR = /[а-я]/;
const LAT = /[a-z]/;

// Latin letters that look like Cyrillic ones (and back)
const LAT_TO_CYR_LOOK: Record<string, string> = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у' };
const CYR_TO_LAT_LOOK: Record<string, string> = Object.fromEntries(Object.entries(LAT_TO_CYR_LOOK).map(([l, c]) => [c, l]));

// Sound-based transliteration (longest first)
const LAT_TO_CYR_SOUND: [string, string][] = [
  ['shch', 'щ'], ['sch', 'щ'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['ch', 'ч'], ['sh', 'ш'], ['yu', 'ю'], ['ya', 'я'], ['yo', 'е'],
  ['iy', 'ий'], ['yi', 'ый'], ['a', 'а'], ['b', 'б'], ['c', 'к'], ['d', 'д'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], ['i', 'и'],
  ['j', 'й'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['q', 'к'], ['r', 'р'], ['s', 'с'], ['t', 'т'],
  ['u', 'у'], ['v', 'в'], ['w', 'в'], ['x', 'кс'], ['y', 'ы'], ['z', 'з'],
];
const CYR_TO_LAT_SOUND: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', ь: '', ъ: '', э: 'e', ю: 'yu', я: 'ya',
};

// Digits and symbols used as letters
const LEET_LAT: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };
const LEET_CYR: Record<string, string> = { '0': 'о', '3': 'з', '4': 'ч', '6': 'б', '@': 'а' };

const mapChars = (s: string, table: Record<string, string>) => [...s].map((c) => table[c] ?? c).join('');

function translitLatToCyr(s: string) {
  let out = '';
  for (let i = 0; i < s.length; ) {
    const hit = LAT_TO_CYR_SOUND.find(([l]) => s.startsWith(l, i));
    if (hit) {
      out += hit[1];
      i += hit[0].length;
    } else out += s[i++];
  }
  return out;
}

const collapseRepeats = (s: string) => s.replace(/(.)\1+/g, '$1');

// Every way a human could read this word
export function readings(raw: string): { forms: string[]; obfuscated: boolean } {
  const base = raw.toLowerCase().replace(/ё/g, 'е').replace(/[.\-_*'’·]/g, '');
  const forms = new Set<string>([base]);
  const hasCyr = CYR.test(base);
  const hasLat = LAT.test(base);
  const hasDigit = /[\d@$!]/.test(base);

  if (hasCyr) {
    // Cyrillic word with stray Latin letters / digits: "звезdа", "3везда"
    const cyr = mapChars(mapChars(base, LEET_CYR), LAT_TO_CYR_LOOK);
    forms.add(cyr);
    forms.add(translitLatToCyr(cyr));
  }
  if (hasLat || hasDigit) {
    const lat = mapChars(mapChars(base, LEET_LAT), CYR_TO_LAT_LOOK);
    forms.add(lat);
    // Russian written in Latin: "zvezda", "krasniy"
    if (!hasCyr) forms.add(translitLatToCyr(lat));
  }
  if (hasCyr && !hasLat) {
    // English written in Cyrillic: "ред", "стар"
    forms.add(mapChars(base, CYR_TO_LAT_SOUND));
  }
  for (const f of [...forms]) forms.add(collapseRepeats(f));
  forms.delete('');
  // Only real disguises (mixed alphabets, digits, separators, stretched letters) unlock typo matching on short words
  const obfuscated = (hasCyr && hasLat) || hasDigit || /[.\-_*]/.test(raw) || /(.)\1\1/.test(base);
  return { forms: [...forms], obfuscated };
}

// Damerau–Levenshtein (optimal string alignment)
function distance(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

// Is `form` a typo of a forbidden word? The word may carry an ending, so compare against the form's prefixes.
function nearForbidden(form: string, allowShort: boolean) {
  for (const w of ALL_WORDS) {
    if (w.length < (allowShort ? 5 : 6)) continue;
    const limit = w.length >= 8 ? 2 : 1;
    for (let len = w.length - 1; len <= w.length + 1; len++) {
      if (len > form.length || len < 4) continue;
      if (distance(form.slice(0, len), w) <= limit && Math.abs(form.length - w.length) <= 3) return true;
    }
  }
  return false;
}

function isForbiddenForm(form: string) {
  if (/^\d+$/.test(form)) return true;
  if (ALL_EXACT.has(form)) return true;
  return ALL_PREFIX.some((p) => form.startsWith(p));
}

export function isPlainWord(raw: string) {
  const { forms, obfuscated } = readings(raw);
  if (forms.some(isForbiddenForm)) return true;
  // Typos only count for longer words, or when the word was clearly disguised
  return forms.some((f) => f.length >= 5 && nearForbidden(f, obfuscated));
}

// ---------- stemming (for learning the team's metaphors) ----------

// Crude stemming so "крыша / крышу / крыши" or "roof / roofs" count as one word
const ENDINGS = /(ами|ями|ого|его|ому|ему|ыми|ими|ая|яя|ое|ее|ые|ие|ой|ей|ою|ею|ую|юю|ом|ем|ам|ям|ах|ях|ов|ев|ы|и|а|я|у|ю|е|о|ь|s|es)$/;
export function stem(token: string) {
  const s = collapseRepeats(token.toLowerCase().replace(/ё/g, 'е').replace(/[.\-_*'’·]/g, ''));
  const cut = s.replace(ENDINGS, '');
  return cut.length >= 3 ? cut : s;
}

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^a-zа-я0-9']+/i)
    .filter(Boolean);
}

// Letters spelled out one by one: "з в е з д а", "з.в.е.з.д.а", "s-t-a-r"
const SPELLED = /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}][\s.\-_*·,]+){2,}[\p{L}\p{N}](?![\p{L}\p{N}])/gu;
// A word, allowing separators and lookalike symbols inside it: "зв*зда", "st4r", "m00n"
const WORD = /[\p{L}\p{N}@$!]+(?:[.\-_*'’·][\p{L}\p{N}@$!]+)*/gu;

export interface ListenResult {
  masked: string;
  heardWords: string[];
  heardLearned: boolean;
  newlyLearned?: string;
}

const staticFor = (s: string) => '▓'.repeat(Math.max(3, Math.min(12, s.replace(/\s/g, '').length)));

export class Listener {
  private learnedStems = new Map<string, string>(); // stem -> the form the radio first understood
  private counts = new Map<string, { n: number; form: string }>();
  private lastLearnAt = 0;
  private names = new Set<string>(); // players' names are never heard or learned

  setNames(names: string[]) {
    this.names = new Set(names.flatMap((n) => tokenize(n)).map(stem));
  }

  learnedWords() {
    return [...this.learnedStems.values()];
  }

  isLearned(word: string) {
    return readings(word).forms.some((f) => this.learnedStems.has(stem(f)));
  }

  listen(text: string, now = Date.now()): ListenResult {
    const heard: string[] = [];
    let heardLearned = false;

    // 1. Spelled-out words first: "з в е з д а" is still a star
    let masked = text.replace(SPELLED, (span) => {
      const joined = span.replace(/[\s.\-_*·,]+/g, '');
      if (joined.length >= 3 && (isPlainWord(joined) || this.isLearned(joined))) {
        heard.push(span);
        if (!isPlainWord(joined)) heardLearned = true;
        return staticFor(joined);
      }
      return span;
    });

    // 2. Then every word, disguised or not
    masked = masked.replace(WORD, (word) => {
      if (word.includes('▓')) return word;
      if (isPlainWord(word)) {
        heard.push(word);
        return staticFor(word);
      }
      if (word.length >= 4 && !this.names.has(stem(word)) && this.isLearned(word)) {
        heard.push(word);
        heardLearned = true;
        return staticFor(word);
      }
      return word;
    });

    // 3. Learn from what got through
    let newlyLearned: string | undefined;
    const seen = new Set<string>();
    for (const t of tokenize(masked)) {
      if (t.length < 4 || STOPWORDS.has(t) || t.includes('▓') || this.names.has(stem(t))) continue;
      const s = stem(t);
      if (seen.has(s)) continue;
      seen.add(s);
      const entry = this.counts.get(s) ?? { n: 0, form: t };
      entry.n++;
      this.counts.set(s, entry);
      if (!newlyLearned && entry.n >= LEARN_AFTER && now - this.lastLearnAt > LEARN_COOLDOWN_MS) {
        newlyLearned = entry.form;
        this.learnedStems.set(s, entry.form);
        this.lastLearnAt = now;
      }
    }

    return { masked, heardWords: heard, heardLearned, newlyLearned };
  }

  // The team's own language: the words they kept using, cracked by the radio or not
  lexicon(limit = 8) {
    return [...this.counts.values()]
      .filter((e) => e.n >= 2)
      .sort((a, b) => b.n - a.n)
      .slice(0, limit)
      .map((e) => e.form);
  }
}
