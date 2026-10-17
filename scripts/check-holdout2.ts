// Second held-out set: written after all tuning, kept untouched. The honest number.
import { understandFor } from '../server/bot-lines';
import { dialOptions, waveValue, isDial, type DialKind } from '../shared/dials';
import { ITEM_SETS, type Glyph, type TrialKind, type Value } from '../shared/protocol';

const W = waveValue;
const CASES: [TrialKind, string, Value][] = [
  ['wave', 'ну такая невысокая и спокойненькая', W(0, 1)], ['wave', 'горы высоченные и редкие', W(2, 0)], ['wave', 'средняя, горбы почти вплотную', W(1, 2)],
  ['wave', 'малюсенькая и медленная', W(0, 0)], ['wave', 'крупная, горбов много', W(2, 2)], ['wave', 'низкая и горбы как у пилы', W(0, 2)],
  ['wave', 'высокая и плавная как качели', W(2, 0)], ['wave', 'всё по середине', W(1, 1)],
  ['antenna', 'смотрит прям на потолок', 0], ['antenna', 'на подоконник', 2], ['antenna', 'в паркет', 4], ['antenna', 'на прихожую', 6],
  ['antenna', 'в угол между полом и окном', 3], ['antenna', 'между дверью и люстрой', 7], ['antenna', 'на плинтус под окном', 3], ['antenna', 'в чердак', 0],
  ['wires', 'гнездо у потолка у самой двери', 0], ['wires', 'внизу по центру', 4], ['wires', 'у пола под окном', 5], ['wires', 'сверху посреди', 1],
  ['cassette', 'как ног у стула', 4], ['cassette', 'как колёс у мотоцикла', 2], ['cassette', 'сколько у осьминога ног', 8], ['cassette', 'как дней недели', 7],
  ['cassette', 'как лап у курицы', 2], ['cassette', 'до вторника', 1], ['cassette', 'как ног у муравья без одной', 5], ['cassette', 'всю закрась', 8],
  ['cassette', 'как пальцев на ноге', 5], ['cassette', 'как богатырей', 3],
  ['equalizer', 'бас и голос лежат, писк торчит', 1], ['equalizer', 'все три стоят', 7], ['equalizer', 'горбик посередине', 2], ['equalizer', 'писк задран, остальные опущены', 1],
  ['equalizer', 'голос поднят, бас лежит, писк поднят', 3], ['equalizer', 'все лежат кроме баса', 4],
  ['morse', 'бип бииип бип', 2], ['morse', 'пиип пиип пип', 6], ['morse', 'туу ту туу', 5], ['morse', '. . .', 0], ['morse', 'длинный короткий короткий', 4],
  ['lamp', 'как огонь пожарной машины', 0], ['lamp', 'как цыплёнок', 1], ['lamp', 'как трава весной', 2], ['lamp', 'как небо летом', 3],
  ['lamp', 'как спелая слива', 4], ['lamp', 'как свежий снег', 5], ['lamp', 'как лимонная корка', 1], ['lamp', 'как ёлочка', 2],
  ['code', 'фигура как у дорожного знака уступи', 'triangle'], ['code', 'как монета но фигура', 'circle'], ['code', 'у неё четыре одинаковых стороны', 'square'],
  ['code', 'значок на машине скорой', 'cross'], ['code', 'падает и загадывают желание', 'star'], ['code', 'ночью на небе одна большая', 'moon'],
  ['code', 'им плачут', 'eye'], ['code', 'потерял его и не можешь попасть домой', 'key'], ['code', 'горит на столе при ужине', 'candle'],
  ['code', 'из неё пьют горячий чай', 'cup'], ['code', 'будит утром', 'clock'], ['code', 'режет колбасу', 'knife'], ['code', 'стоит на полке в библиотеке', 'book'],
  ['code', 'лежит в кошельке', 'coin'], ['code', 'выпадает у голубя', 'feather'], ['code', 'из неё пьют газировку', 'bottle'],
  ['code', 'точит когти об диван', 'cat'], ['code', 'сова', 'owl'], ['code', 'плавает в пруду', 'fish'], ['code', 'восемь ног', 'spider'],
  ['code', 'чёрная и каркает', 'crow'], ['code', 'шипит и ползёт', 'snake'], ['code', 'грызёт капусту', 'rabbit'], ['code', 'прилетает к фонарю ночью', 'moth'],
  ['code', 'ловит телевизор', 'antenna'], ['code', 'её перематывали карандашом', 'cassette'], ['code', 'звенит перед уроком', 'bell'],
  ['code', 'отмеряет минуты песком', 'hourglass'], ['code', 'стрелка указывает на север', 'compass'], ['code', 'светит у шахтёра', 'lantern'],
  ['code', 'деталь из часов с зубцами', 'gear'], ['code', 'висит на гараже', 'lock'],
  ['code', 'закрывает солнце', 'cloud'], ['code', 'светит летом', 'sun'], ['code', 'после неё лужи', 'rain'], ['code', 'кружится зимой', 'snowflake'],
  ['code', 'бьёт в громоотвод', 'lightning'], ['code', 'гнёт деревья', 'wind'], ['code', 'прячешься под ним от дождя', 'umbrella'], ['code', 'меряют жар', 'thermometer'],
  ['code', 'в него говорят на концерте', 'microphone'], ['code', 'слушаешь музыку и никого не слышишь', 'headphones'], ['code', 'старый чёрный диск', 'record'],
  ['code', 'крутишь и становится громче', 'dial'], ['code', 'из него идёт звук', 'speaker'], ['code', 'вставляешь в пульт', 'battery'],
  ['code', 'по нему бежит ток', 'wire'], ['code', 'щёлкнул и свет загорелся', 'switch'],
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
