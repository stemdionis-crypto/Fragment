// The radio must catch disguised item names and numbers, and leave ordinary talk and metaphors alone.
//   npm run check
import { Listener } from '../server/listener';

const CAUGHT = [
  // signs
  'звезда', 'звезду', 'звёздочка', 'звезdа', 'zvezda', 'зведза', 'звееезда', 'з в е з д а', 'з.в.е.з.д.а', 'з-в-е-з-д-а', '3везда', 'зв*зда',
  'треугольник', 'треугольнек', 'triangle', 'trianlge', 'tr1angle', 't r i a n g l e', 'st4r', 'm00n', 'квадрат', 'kvadrat', 'квадрт',
  'circle', 'cirlce', 'ключ', 'klyuch', 'глаз', 'glaz', 'луна', 'luna',
  // objects
  'свеча', 'свечку', 'svecha', 'свеЧа', 'кружка', 'чашку', 'часы', 'chasy', 'нож', 'ножик', 'книга', 'kniga', 'монетка', 'перо', 'бутылка',
  'бутылко', 'candle', 'cnadle', 'bottle', 'b0ttle', 'feather', 'coin', 'clock', 'knife',
  // animals
  'кот', 'кошка', 'k0шка', 'котик', 'сова', 'sova', 'рыбка', 'паук', 'паучок', 'ворона', 'змея', 'zmeya', 'кролик', 'krolik', 'заяц',
  'мотылёк', 'бабочка', 'spider', 'spyder', 'rabbit', 'owl', 'snake', 'moth', 'cat',
  // numbers
  'первый', 'pervyi', '1', '7', 'четыре', 'second', 'last', 'семь', 'sem', 'восемь', 'vosem', 'девять', 'пять', 'шесть', 'ноль', 'seven', 'eight', 's3ven', 'н о л ь',
];
const IGNORED = [
  'крыша', 'старая рана', 'круто', 'крутой', 'красивый', 'белка', 'небо', 'кровь', 'зимнее небо', 'то, чем открывают дверь', 'roof',
  'old wound', 'winter sky', 'grin', 'bell', 'glass', 'secret', 'starting', 'привет', 'ок давай подумаем', 'стрелка',
  // colours are allowed now
  'красный', 'чёрная птица', 'белый', 'red', 'black bird',
  // common words that look like item names
  'который', 'совсем', 'совет', 'ножка', 'часто', 'котёл', 'сейчас', 'в начале', 'в самом конце', 'сразу после начала', 'перед', 'после',
  'то, что тикает на стене', 'тот, кто мурлычет', 'то, из чего пьют чай', 'твоя ручка громкости', 'моя цифра',
  'сколько дней в неделе', 'сколько пальцев на руке', 'семья', 'пятно', 'пятница', 'шестерёнка', 'девятиэтажка', 'восьмиугольник',
];

let failed = 0;
for (const w of CAUGHT) {
  const r = new Listener().listen(`у меня ${w} вроде`);
  if (!r.heardWords.length) {
    failed++;
    console.log(`MISSED   "${w}" -> ${r.masked}`);
  }
}
for (const w of IGNORED) {
  const r = new Listener().listen(w);
  if (r.heardWords.length) {
    failed++;
    console.log(`FALSE    "${w}" -> ${r.masked}`);
  }
}
console.log(failed ? `\n${failed} problems` : `ok   all ${CAUGHT.length} disguises caught, ${IGNORED.length} normal phrases left alone`);
process.exit(failed ? 1 : 0);
