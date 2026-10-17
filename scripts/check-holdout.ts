// Held-out phrases: written after tuning, never used to adjust the companions.
// This is the honest number for "how well do bots understand new ways of saying things".
import { understandFor } from '../server/bot-lines';
import { dialOptions, waveValue, isDial, type DialKind } from '../shared/dials';
import { ITEM_SETS, type Glyph, type TrialKind, type Value } from '../shared/protocol';

const W = waveValue;
const CASES: [TrialKind, string, Value][] = [
  // wave
  ['wave', 'волна как у осциллографа быстрая, но низенькая', W(0, 2)], ['wave', 'высоко подпрыгивает, горбы редко', W(2, 0)],
  ['wave', 'пологая и неторопливая', W(0, 0)], ['wave', 'горбики мелкие и частые', W(0, 2)], ['wave', 'огромные медленные холмы', W(2, 0)],
  ['wave', 'средне по высоте, зубчики впритирку', W(1, 2)], ['wave', 'высокая как пик, широкие перерывы между горбами', W(2, 0)],
  ['wave', 'обычная высота, обычный шаг', W(1, 1)], ['wave', 'маленькая и спокойная', W(0, 1)], ['wave', 'здоровенная, как пила', W(2, 2)],
  // antenna
  ['antenna', 'тыкни её в люстру', 0], ['antenna', 'в сторону подоконника', 2], ['antenna', 'на коврик', 4], ['antenna', 'на выход из комнаты', 6],
  ['antenna', 'в угол между окном и потолком', 1], ['antenna', 'к плинтусу у двери', 5], ['antenna', 'смотрит туда где шторы и пол', 3],
  ['antenna', 'на лампу у потолка', 0], ['antenna', 'в порог', 6], ['antenna', 'к окошку и чуть к люстре', 1],
  // wires
  ['wires', 'нижний у двери', 3], ['wires', 'под люстрой посерединке', 1], ['wires', 'возле подоконника внизу у пола', 5],
  ['wires', 'у порога ближе к полу', 3], ['wires', 'центр, высоко у потолка', 1], ['wires', 'ближе к окну и к потолку', 2],
  // cassette
  ['cassette', 'как ног у табуретки', 4], ['cassette', 'как у кошки лап плюс одна', 5], ['cassette', 'колёс у велосипеда', 2],
  ['cassette', 'как глаз у паука', 8], ['cassette', 'столько же сколько ног у таракана', 6], ['cassette', 'дней в неделе без выходных', 5],
  ['cassette', 'как пальцев на одной руке минус один', 4], ['cassette', 'как цветов в радуге', 7], ['cassette', 'до среды не включая', 2],
  ['cassette', 'как у человека ушей', 2], ['cassette', 'до упора, все клетки', 8], ['cassette', 'одну клетку всего', 1],
  // equalizer
  ['equalizer', 'бас торчком, остальные лёжа', 4], ['equalizer', 'середина вверх, края вниз', 2], ['equalizer', 'писк и бас подняты, середина опущена', 5],
  ['equalizer', 'всё легло кроме писка', 1], ['equalizer', 'только голос лежит', 5], ['equalizer', 'низы лежат, голос и писк стоят', 3],
  ['equalizer', 'ни одна не торчит', 0], ['equalizer', 'писк лежит, а бас и голос подняты', 6],
  // morse
  ['morse', 'пип пиип пип', 2], ['morse', 'туук тук туук', 5], ['morse', 'длинный длинный короткий', 6], ['morse', '- . -', 5],
  ['morse', 'тик тиик тик', 2], ['morse', 'бип бип бииип', 1],
  // lamp
  ['lamp', 'как у светофора стоп', 0], ['lamp', 'как пчела', 1], ['lamp', 'как мох в лесу', 2], ['lamp', 'как джинсовка', 3],
  ['lamp', 'как спелая черника', 3], ['lamp', 'как свёкла', 4], ['lamp', 'как зубная паста', 5], ['lamp', 'как мандарин', 1],
  ['lamp', 'как арбуз внутри', 0], ['lamp', 'как простокваша', 5],
  // pictures
  ['code', 'как знак в шахматах у короля сверху', 'cross'], ['code', 'похоже на парус лодки', 'triangle'], ['code', 'как пуговица без дырок', 'circle'],
  ['code', 'как экран у телефона', 'square'], ['code', 'у неё бывают фазы', 'moon'], ['code', 'им подмигивают', 'eye'],
  ['code', 'в торте на день рождения', 'candle'], ['code', 'туда наливают компот', 'cup'], ['code', 'висит на стене и тикает', 'clock'],
  ['code', 'им мажут масло', 'knife'], ['code', 'в ней много букв', 'book'], ['code', 'бросают чтобы решить орёл или решка', 'coin'],
  ['code', 'у гуся на хвосте', 'feather'], ['code', 'в неё запихивают записку и бросают в море', 'bottle'],
  ['code', 'гоняет мышей', 'cat'], ['code', 'сидит на ветке ночью и крутит головой', 'owl'], ['code', 'живёт в реке', 'fish'],
  ['code', 'сидит в паутине', 'spider'], ['code', 'чёрная, ворует блестящее', 'crow'], ['code', 'сбрасывает кожу', 'snake'],
  ['code', 'у него длинные уши и он грызёт морковь', 'rabbit'], ['code', 'кружит у лампы', 'moth'],
  ['code', 'ловит радио на крыше', 'antenna'], ['code', 'в неё записывали песни на магнитофон', 'cassette'], ['code', 'бьют в него в церкви', 'bell'],
  ['code', 'песок течёт вниз', 'hourglass'], ['code', 'с ним ходят в поход чтобы найти север', 'compass'], ['code', 'с ним ходят в темноте по лесу', 'lantern'],
  ['code', 'в часах крутятся с зубчиками', 'gear'], ['code', 'висит на сарае', 'lock'],
  ['code', 'серая на небе перед дождём', 'cloud'], ['code', 'от него жарко летом', 'sun'], ['code', 'идёт осенью и всё мокрое', 'rain'],
  ['code', 'падает зимой и тает на ладони', 'snowflake'], ['code', 'сверкает в грозу', 'lightning'], ['code', 'от него шумят деревья', 'wind'],
  ['code', 'складывают и носят в сумке на случай дождя', 'umbrella'], ['code', 'суют под мышку когда болеешь', 'thermometer'],
  ['code', 'в него поёт певица', 'microphone'], ['code', 'надевают на голову чтобы слушать', 'headphones'], ['code', 'крутится под иглой', 'record'],
  ['code', 'им прибавляют громкость', 'dial'], ['code', 'из неё орёт музыка', 'speaker'], ['code', 'садится в пульте', 'battery'],
  ['code', 'тянется от зарядки к розетке', 'wire'], ['code', 'щёлкают чтобы включить свет', 'switch'],
];

const setOf = (g: Glyph) => Object.values(ITEM_SETS).find((s) => (s as readonly string[]).includes(g))!;
const byKind = new Map<string, { ok: number; n: number; bad: string[] }>();
for (const [kind, text, want] of CASES) {
  const options: Value[] = isDial(kind) ? dialOptions(kind as DialKind) : [...setOf(want as Glyph)];
  const got = understandFor(kind, text, options);
  const s = byKind.get(kind) ?? { ok: 0, n: 0, bad: [] };
  s.n++; if (got === want) s.ok++; else s.bad.push(`"${text}" → ${got} (нужно ${want})`);
  byKind.set(kind, s);
}
let ok = 0, n = 0;
for (const [k, s] of byKind) { ok += s.ok; n += s.n; console.log(`${k.padEnd(10)} ${(100 * s.ok / s.n).toFixed(0).padStart(3)}%  ${s.ok}/${s.n}`); if (process.env.VERBOSE) s.bad.forEach((b) => console.log('    ', b)); }
console.log(`ВСЕГО      ${(100 * ok / n).toFixed(1)}%  ${ok}/${n}`);
