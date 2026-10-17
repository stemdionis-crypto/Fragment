import type { ChatMessage, Glyph, Lang, PrivateInfo, PublicState, TrialKind, Value } from '../shared/protocol';
import { isCipher, handCandidates, decodeClue } from '../shared/trial-rules';
import { scorePictures } from './picture-keys';
import { describeDial, isDial, readAntenna, readEqualizer, readLamp, readMorse, readTape, readWave, readWires, waveValue } from '../shared/dials';

const RU: Record<Glyph, string> = {
  triangle: 'крыша домика',
  circle: 'колесо',
  square: 'окно',
  cross: 'плюс',
  star: 'то, что ставят на верхушку ёлки',
  moon: 'то, что светит ночью',
  eye: 'то, чем смотрят',
  key: 'то, чем открывают дверь',
  candle: 'то, что задувают на торте',
  cup: 'то, из чего пьют чай',
  clock: 'то, что тикает на стене',
  knife: 'то, чем режут хлеб',
  book: 'то, что читают перед сном',
  coin: 'мелочь в кармане',
  feather: 'то, что падает с птицы',
  bottle: 'то, во что наливают воду',
  cat: 'тот, кто мурлычет',
  owl: 'ночная птица, которая ухает',
  fish: 'та, что плавает в аквариуме',
  spider: 'тот, кто плетёт паутину',
  crow: 'чёрная птица, которая каркает',
  snake: 'та, что шипит и ползает',
  rabbit: 'тот, кто прыгает и любит морковку',
  moth: 'тот, кто ночью летит на лампу',
  antenna: 'то, что ловит далёкие станции',
  cassette: 'коробочка с двумя катушками',
  bell: 'то, что звенит у двери',
  hourglass: 'песок, который меряет время',
  compass: 'стрелка, которая ищет север',
  lantern: 'свет, который можно нести',
  gear: 'зубчатое колесо',
  lock: 'железная скважина на двери',
  cloud: 'то, что закрывает небо серой пеленой', sun: 'яркий источник тепла над нами', rain: 'вода, падающая с неба', snowflake: 'ледяной узор, падающий зимой',
  lightning: 'яркая вспышка во время грозы', wind: 'то, что качает деревья', umbrella: 'то, что раскрывают над головой в непогоду', thermometer: 'прибор, который показывает температуру',
  microphone: 'то, во что говорят на сцене', headphones: 'то, что надевают на уши для музыки', record: 'плоская вещь с канавками для музыки', dial: 'регулятор, который поворачивают пальцами',
  speaker: 'коробка, из которой звучит музыка', battery: 'маленький источник питания', wire: 'тонкий шнур, по которому идёт ток', switch: 'то, чем включают свет',
};
const EN: Record<Glyph, string> = {
  triangle: 'a roof', circle: 'a wheel', square: 'a window', cross: 'a plus', star: 'what goes on top of a Christmas tree',
  moon: 'what shines at night', eye: 'what you look with', key: 'what opens a door', candle: 'what you blow out on a cake',
  cup: 'what you drink tea from', clock: 'what ticks on the wall', knife: 'what you cut bread with', book: 'what you read before bed',
  coin: 'small change in your pocket', feather: 'what falls off a bird', bottle: 'what you pour water into', cat: 'something that purrs',
  owl: 'the night bird that hoots', fish: 'something in the aquarium', spider: 'what weaves a web', crow: 'the black bird that caws',
  snake: 'something that hisses and crawls', rabbit: 'a hopper that loves carrots', moth: 'a night visitor drawn to a lamp',
  antenna: 'what receives distant stations', cassette: 'wound magnetic ribbon in a case', bell: 'what rings at the door',
  hourglass: 'sand measuring time', compass: 'the needle that finds north', lantern: 'a carried light',
  gear: 'a toothed wheel', lock: 'a metal clasp on a door',
  cloud: 'a grey veil across the sky', sun: 'the bright source of warmth above us', rain: 'water falling from the sky', snowflake: 'a tiny ice pattern falling in winter',
  lightning: 'a bright flash during a storm', wind: 'what makes trees sway', umbrella: 'what you open over your head in bad weather', thermometer: 'what shows the temperature',
  microphone: 'what a singer speaks into', headphones: 'what you wear over your ears for music', record: 'a flat grooved thing that holds music', dial: 'the regulator you turn with your fingers',
  speaker: 'a cabinet that plays sound', battery: 'a small power source', wire: 'a thin cord that carries electricity', switch: 'what you use to turn on a light',
};
// Numbers without number words
const DIGITS_RU = [
  'пусто, как в кармане перед зарплатой', 'сколько носов у человека', 'количество в обычной паре', 'сколько медведей в сказке про Машу',
  'сколько лап у собаки', 'сколько пальцев на руке', 'сколько ног у жука', 'сколько дней в неделе', 'сколько щупалец у осьминога',
  'все пальцы на руках, кроме мизинца',
];
const DIGITS_EN = [
  'nothing at all', 'how many noses you have', 'the size of a pair', 'the bears in Goldilocks', 'the legs of a dog',
  'the fingers on a hand', 'the legs of a beetle', 'the days in a week', 'the arms of an octopus', 'your fingers except a pinky',
];
const describeValue = (v: Value, LANG: Lang) =>
  typeof v === 'number' ? (LANG === 'ru' ? DIGITS_RU : DIGITS_EN)[v] : (LANG === 'ru' ? RU : EN)[v];
export const describeClue=describeValue;
// Kind-aware: hands-on parts are described by shape, length or direction
export function describeFor(kind: TrialKind, v: Value, lang: Lang, scale?: Glyph[]): string {
  if (kind === 'scale' && typeof v === 'number' && scale?.length) {
    const say = (g: Glyph) => (lang === 'ru' ? RU : EN)[g];
    return v % 2 === 0
      ? (lang === 'ru' ? `стрелка прямо на картинке: ${say(scale[v / 2])}` : `the pointer is right on the picture: ${say(scale[v / 2])}`)
      : (lang === 'ru' ? `стрелка между двумя картинками: ${say(scale[(v - 1) / 2])}; и ${say(scale[(v + 1) / 2])}` : `the pointer is between two pictures: ${say(scale[(v - 1) / 2])}; and ${say(scale[(v + 1) / 2])}`);
  }
  return isDial(kind) && typeof v === 'number' ? describeDial(kind, v, lang) : describeValue(v, lang);
}

// The station scale: which printed pictures the message points at, and whether it says "between"
function readScale(text: string, scale: Glyph[]): number | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const between = /между|посередине|between/.test(t);
  const body = t.includes(':') ? t.slice(t.indexOf(':') + 1) : t;
  const unique = (p: string) => { const v = understandClue(p, scale); return v === null ? -1 : scale.indexOf(v as Glyph); };
  const parts = body.split(/;|(?:^|\s)и(?:\s|$)|(?:^|\s)and(?:\s|$)/).filter((p) => p.trim());
  if (parts.length >= 2) {
    const idx = [...new Set(parts.map(unique).filter((i) => i >= 0))];
    if (idx.length === 2 && Math.abs(idx[0] - idx[1]) === 1) return Math.min(...idx) * 2 + 1;
  }
  const whole = unique(body);
  if (whole >= 0 && !between) return whole * 2;
  const hits = scale.map((g, i) => understandClue(body, [g]) === g ? i : -1).filter((i) => i >= 0);
  if (hits.length === 2 && Math.abs(hits[0] - hits[1]) === 1) return Math.min(...hits) * 2 + 1;
  if (hits.length === 1 && !between) return hits[0] * 2;
  if (!hits.length && /(самый|самом|крайн).{0,8}(лев|начал)|left edge|far left/.test(t)) return 0;
  if (!hits.length && /(самый|самом|крайн).{0,8}(прав|конц)|right edge|far right/.test(t)) return 8;
  return null;
}
const pickLine = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

// Read a teammate's message for a given trial. Hands-on parts have their own vocabulary.
export function understandFor(kind: TrialKind, text: string, options: Value[], scale?: Glyph[]): Value | null {
  if (kind === 'antenna') return readAntenna(text);
  if (kind === 'equalizer') return readEqualizer(text);
  if (kind === 'morse') return readMorse(text);
  if (kind === 'wires') return readWires(text);
  if (kind === 'lamp') return readLamp(text);
  if (kind === 'scale') return scale?.length ? readScale(text, scale) : null;
  if (kind === 'cassette') { const v = readTape(text) ?? understandClue(text, options); return v !== null && options.includes(v) ? v : null; }
  if (kind === 'wave') { const w = readWave(text); return w.height !== undefined && w.density !== undefined ? waveValue(w.height, w.density) : null; }
  return understandClue(text, options) ?? gridPick(text, options);
}


// What the bot says about what it knows, addressed to whoever owns each control
export function linesFor(info: PrivateInfo, s: PublicState, LANG: Lang): string[] {
  const tr = (ru: string, en: string) => LANG === 'ru' ? ru : en;
  const t = s.trial;
  if (!t) return [];
  const lines = info.knows.map((k) => {
    const c = t.controls.find((x) => x.id === k.controlId);
    const owner = s.players.find((p) => p.id === c?.ownerId)?.name ?? '?';
    const label = c ? (LANG === 'ru' ? c.label.ru : c.label.en).toLowerCase() : '';
    const what = describeFor(t.kind, k.value, LANG, c?.scale);
    if (isDial(t.kind)) return pickLine(LANG === 'ru'
      ? [`${owner}, у тебя ${what}.`, `${owner}, смотри: ${what}.`, `${owner}, у тебя так: ${what}.`]
      : [`${owner}, yours is ${what}.`, `${owner}, look: ${what}.`]);
    if (isCipher(t.kind)) return tr(`${owner}, тебе пришло ${what}. Дальше по правилу.`, `${owner}, your input is ${what}. Apply the rule.`);
    if (t.kind === 'frequency') return tr(`${owner}, твоя цифра: ${what}.`, `${owner}, your digit: ${what}.`);
    if (t.kind === 'code') return pickLine(LANG === 'ru'
      ? [`${owner}, у тебя ${label} ${what}.`, `${owner}, ${label} у тебя ${what}.`]
      : [`${owner}, your wheel (${label}) is ${what}.`, `${owner}, for ${label}: ${what}.`]);
    return tr(`${owner}, у тебя ${what}.`, `${owner}, yours is ${what}.`);
  });
  // Send each item separately so a clue cannot be cut off by CHAT_MAX.
  if (info.hand?.length) {
    for (const item of info.hand) lines.push(tr(`У меня есть ${describeValue(item, LANG)}.`, `I have ${describeValue(item, LANG)}.`));
    lines.push(pickLine(LANG === 'ru' ? ['Всё, это все мои карточки.', 'Больше у меня ничего, это все мои карточки.'] : ['That is it, those are all my cards.']));
  }
  return lines;
}


// Resolve a clue only from its visible words, never from the hidden answer.
const ALIASES: Record<Glyph, string[]> = {
  triangle: ['треугольник','три угла','крыша','triangle','three corners'],
  circle: ['круг','круглый','колесико','circle','round shape'],
  square: ['квадрат','четыре угла','окошко','square','four corners'],
  cross: ['крест','плюсик','cross','plus sign'],
  star: ['звезда','звездочка','верхушка елки','star','christmas tree topper'],
  moon: ['луна','месяц','полумесяц','ночное светило','moon','crescent'],
  eye: ['глаз','глазик','зрение','смотрит','eye','vision'],
  key: ['ключ','ключик','открывает дверь','открыть дверь','key','opens doors'],
  candle: ['свеча','свечка','задувают','торт огонь','candle','birthday cake flame'],
  cup: ['чашка','кружка','пьют чай','пить чай','cup','mug','drink tea'],
  clock: ['часы','часики','тикает','циферблат','clock','ticking'],
  knife: ['нож','ножик','режет хлеб','резать хлеб','knife','cuts bread'],
  book: ['книга','книжка','страницы','читают','book','pages','reading'],
  coin: ['монета','монетка','денежка','мелочь','coin','pocket change'],
  feather: ['перо','перышко','оперение','feather','bird plumage'],
  bottle: ['бутылка','бутылочка','сосуд горлышко','bottle','narrow neck container'],
  cat: ['кот','котик','кошка','котенок','мурчит','мурлычет','мяукает','cat','kitten','purrs','meows'],
  owl: ['сова','филин','ухает','owl','hooting'],
  fish: ['рыба','рыбка','аквариум','жабры','fish','aquarium','gills'],
  spider: ['паук','паучок','паутина','плетет сеть','spider','web weaving'],
  crow: ['ворона','ворон','каркает','crow','raven','caws'],
  snake: ['змея','змейка','шипит ползает','snake','slithers','hisses crawls'],
  rabbit: ['заяц','зайчик','кролик','ушастый','любит морковку','rabbit','bunny','loves carrots'],
  moth: ['мотылек','моль','летит лампу','moth','flies lamp'],
  antenna: ['антенна','ловит станции','ловит сигнал','antenna','receives stations'],
  cassette: ['кассета','кассетка','две катушки','магнитная лента','cassette','two reels','tape'],
  bell: ['колокол','колокольчик','звонок','звенит','bell','rings door'],
  hourglass: ['песочные часы','песок время','песок пересыпается','hourglass','sand timer'],
  compass: ['компас','ищет север','стрелка север','показывает на север','показывает направление','указывает направление','compass','finds north'],
  lantern: ['фонарь','фонарик','переносной свет','можно нести','светится','светиться','lantern','flashlight','portable light'],
  gear: ['шестерня','шестеренка','зубчатое колесико','колесо зубья','зубья','gear','cog','wheel teeth','wheel with teeth'],
  lock: ['замок','замочек','скважина','lock','padlock','keyhole'],
  cloud: ['облако','туча','тучка','серая пелена','cloud','grey sky veil'],
  sun: ['солнце','солнышко','греет неба','sun','sunshine'],
  rain: ['дождь','дождик','капли неба','rain','raindrops'],
  snowflake: ['снежинка','ледяной узор','snowflake','ice crystal'],
  lightning: ['молния','гроза вспышка','lightning','storm flash'],
  wind: ['ветер','ветерок','качает деревья','дует','wind','breeze','trees sway'],
  umbrella: ['зонт','зонтик','защищает дождя','umbrella','rain protection'],
  thermometer: ['термометр','градусник','меряет температуру','thermometer','measures temperature'],
  microphone: ['микрофон','поют него','microphone','mic','sing into'],
  headphones: ['наушники','музыка уши','headphones','earphones','music ears'],
  record: ['пластинка','винил','виниловый диск','record','vinyl'],
  dial: ['регулятор','крутилка','ручка настройки','dial','tuning knob'],
  speaker: ['динамик','колонка','музыка коробки','speaker','loudspeaker'],
  battery: ['батарея','батарейка','источник питания','battery','power source'],
  wire: ['провод','проводок','шнур ток','wire','electric cord'],
  switch: ['выключатель','переключатель','включает свет','switch','turns light on'],
};
// How the drawings look: players often describe the picture, not the thing
const LOOKS: Partial<Record<Glyph, string[]>> = {
  record: ['диск', 'круг с точкой', 'шар с точкой', 'пончик', 'бублик', 'кругляш с дыркой', 'disc', 'donut', 'circle with a dot'],
  dial: ['спидометр', 'стрелка в круге', 'круг со стрелкой', 'speedometer', 'gauge'],
  speaker: ['рупор', 'громкоговоритель', 'звуковые волны', 'megaphone', 'sound waves'],
  battery: ['аккумулятор', 'заряд', 'плюс и минус', 'charge'],
  wire: ['зигзаг', 'ломаная линия', 'шнур', 'zigzag', 'cord'],
  switch: ['тумблер', 'рычажок', 'кнопка включения', 'toggle'],
  headphones: ['дуга с чашками', 'на уши', 'для музыки', 'на голову для музыки', 'over the ears'],
  microphone: ['палка с шариком', 'караоке', 'на сцене', 'говорят в него', 'karaoke'],
  antenna: ['усы', 'мачта', 'вышка', 'для телевизора', 'на крыше', 'mast', 'tower'],
  gear: ['зубчики', 'колесо с зубьями', 'cog'],
  lock: ['навесной', 'дужка', 'вешают на дверь', 'shackle'],
  lantern: ['керосинка', 'лампа с ручкой'],
  hourglass: ['два треугольника', 'песок сыплется'],
  cassette: ['две катушки', 'магнитофон', 'tape recorder', 'фильм', 'фильмы', 'смотрят фильмы', 'смотреть фильмы', 'видео', 'видик', 'видак', 'двд', 'dvd', 'vhs', 'кассетник', 'видеокассета', 'старое кино', 'movies', 'video'],
  moth: ['бабочка', 'butterfly'],
  cloud: ['облачко', 'тучка'],
  thermometer: ['ртуть', 'температура', 'простуда', 'при простуде'],
  umbrella: ['от дождя', 'раскрывают'],
};
// Everyday associations people reach for first
const ASSOCIATIONS: Partial<Record<Glyph, string[]>> = {
  triangle: ['пирамидка', 'пирамида'], circle: ['кружочек', 'кружок'], square: ['коробка', 'коробочка'],
  cross: ['аптека', 'как в аптеке', 'кладбище', 'на кладбище', 'крестик'], star: ['с лучами', 'лучи', 'пять концов', 'пятиконечная', 'много на небе', 'их много на небе', 'очень много ночью', 'больше всего углов', 'на погонах'],
  moon: ['серп', 'серп в небе'], key: ['отпирает', 'в замок вставляют'], candle: ['воск', 'восковая', 'фитиль', 'фитилем', 'с фитилем'], cup: ['кофе', 'для кофе', 'кружечка'],
  knife: ['острое', 'острое на кухне', 'ножом', 'ножиком', 'для хлеба'], clock: ['тикающий', 'тикающим', 'тикающие', 'тикающая'], book: ['библиотека', 'в библиотеке'], coin: ['копейка', 'копеечка'], feather: ['птичье', 'лёгкое птичье'],
  bottle: ['стеклянная', 'для вина', 'вино'], cat: ['мышей', 'ловит мышей'], owl: ['большими глазами', 'большие глаза'],
  crow: ['черная птица', 'кар кар', 'кар'], snake: ['ядовитая', 'без ног'], moth: ['одежду', 'в шкафу', 'моль'],
  bell: ['динь динь', 'церковь', 'в церкви', 'звон'], gear: ['механизм', 'в механизме', 'в механизме часов'],
  rain: ['капает', 'капли', 'мокро'], snowflake: ['снег', 'снежок'], lightning: ['бьет с неба', 'гроза'], wind: ['сдувает', 'дует'],
  umbrella: ['над головой', 'в дождь'], speaker: ['из нее звук', 'звук идет'], wire: ['ток идет', 'по нему ток'], switch: ['щелкаешь', 'щелкать', 'щелкаешь на стене'],
};
for (const map of [LOOKS, ASSOCIATIONS]) for (const [g, extra] of Object.entries(map)) ALIASES[g as Glyph].push(...extra!);
const NUMBER_ALIASES = [
  ['ноль','ничего','пусто','zero','nothing'], ['один','нос человека','one','human nose'],
  ['два','пара','глаза человека','two','pair','human eyes'], ['три','медведи','медведя','медведи маша','three','goldilocks bears'],
  ['четыре','лапы собаки','four','dog legs'], ['пять','пальцы руке','five','fingers hand'],
  ['шесть','ноги жука','six','beetle legs'], ['семь','дни недели','дней неделе','seven','days week'],
  ['восемь','щупальца осьминога','eight','octopus arms'], ['девять','пальцы без мизинца','nine','fingers without pinky'],
];
const normalizeClue = (value: string) => value.toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim();
const STOP_WORDS = new Set('то та тот что чем из во на у в и а как для по с со не это меня тебя него нее the a an what that which of in on with from you your it is to'.split(' '));
function closeWord(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  // Russian endings and one typo; short, generic words never get fuzzy matching.
  if (a.slice(0,5) === b.slice(0,5)) return true;
  if (Math.abs(a.length-b.length)>1) return false;
  if(a.length===b.length) {
    const mismatch=[...a].findIndex((char,index)=>char!==b[index]);
    if(mismatch>=0 && a[mismatch]===b[mismatch+1] && a[mismatch+1]===b[mismatch] && a.slice(mismatch+2)===b.slice(mismatch+2))return true;
  }
  let i=0,j=0,edits=0;
  while(i<a.length && j<b.length) {
    if(a[i]===b[j]) {i++;j++;continue;}
    if(++edits>1)return false;
    if(a.length>=b.length)i++;
    if(b.length>=a.length)j++;
  }
  return edits+(a.length-i)+(b.length-j)<=1;
}
export function understandClue(text: string, options: Value[]): Value | null {
  const normalize = normalizeClue;
  const normalized = normalize(text);
  const contextual:Partial<Record<Glyph,RegExp[]>>={
    sun:[/днем|дневн|daytime|day light/,/свет|ярк|тепл|гре|shin|warm|light/],
    moon:[/ноч|night/,/свет|неб|светил|shin|sky/],
    star:[/ноч|night/,/неб|sky/],
    candle:[/воск|фитил|торт|wax|wick|cake/,/огон|гор|задув|flame|burn|blow/],
    lantern:[/нести|перенос|руке|carry|portable|hand/,/свет|ламп|light|lamp/],
    gear:[/зуб|teeth|tooth/,/колес|крут|wheel|turn/],
    compass:[/север|направлен|north|direction/,/стрел|показы|указыва|ищет|needle|point|find/],
    hourglass:[/песок|песоч|пересып|sand/,/врем|час|меря|time|hour/],
    headphones:[/уши|ушах|ears/,/музык|звук|слуш|music|sound|listen/],
    wire:[/ток|электр|electric/,/шнур|тонк|cord|thin/],
    battery:[/питани|энерги|energy|power/,/источ|маленьк|source|small/],
    thermometer:[/температур|temperature/,/меря|показы|measure|show/],
    umbrella:[/дожд|непогод|rain/,/раскры|голов|защит|open|head|protect/],
  };
  const contextMatches=options.filter(value=>typeof value==='string' && contextual[value]?.every(pattern=>pattern.test(normalized)));
  const descriptionsFor = (value: Value) => typeof value === 'number'
    ? [DIGITS_RU[value],DIGITS_EN[value],...NUMBER_ALIASES[value],String(value)]
    : [RU[value],EN[value],...ALIASES[value]];
  const negated = (start: number) => /(?:^| )(?:не|нет|not|no)(?: (?:это|the|a|an))? $/.test(normalized.slice(0,start));
  const contains = (phrase: string) => {
    let start=normalized.indexOf(phrase);
    while(start>=0) {
      if((start===0 || normalized[start-1]===' ') && (start+phrase.length===normalized.length || normalized[start+phrase.length]===' ') && !negated(start)) return true;
      start=normalized.indexOf(phrase,start+1);
    }
    return false;
  };
  const exact = options.flatMap(value => {
    return descriptionsFor(value).map(normalize).filter(contains).map(description => ({value,description}));
  });
  if (exact.length) {
    const terms=(phrase:string)=>phrase.split(' ').filter(word=>!STOP_WORDS.has(word));
    const specific = exact.filter(match => !exact.some(other => {
      if(other.description===match.description)return false;
      const a=terms(match.description),b=terms(other.description);
      return other.description.includes(match.description) || (a.length>0 && b.length>a.length && a.every(word=>b.includes(word)));
    }));
    const values = [...new Set(specific.map(match => match.value))];
    return values.length === 1 ? values[0] : null;
  }
  if(contextMatches.length===1 && !/(?:^| )(?:не|not|no)(?: |$)/.test(normalized))return contextMatches[0];
  if(/светит|светится|светиться|shines|glows/.test(normalized) && !/торт|воск|фитил|север|cake|wax|wick|north/.test(normalized)){
    const lights=options.filter(value=>['sun','moon','candle','lantern'].includes(String(value)));
    if(lights.length>1)return null;
    if(lights.length===1)return lights[0];
  }
  const matches = options.filter(value => {
    const descriptions = descriptionsFor(value);
    return descriptions.some(description => {
      const phrase=normalize(description);
      const input = [...normalized.matchAll(/\S+/g)].filter(match=>!negated(match.index!) && !STOP_WORDS.has(match[0])).map(match=>match[0]);
      const words=phrase.split(' ').filter(word=>!STOP_WORDS.has(word));
      // Synonym phrases can be reordered, with inflected forms or a small typo.
      if(words.length && words.every(word=>input.some(token=>closeWord(word,token))))return true;
      if (typeof value === 'number') return false;
      const ignored = new Set(['котор', 'ночью', 'мален', 'птицы', 'предм', 'пальц', 'which', 'night', 'thing', 'small', 'black', 'water']);
      const canonical = normalize(description).match(/[a-zа-я]{5,}/g) ?? [];
      return canonical.some(word => !ignored.has(word.slice(0,5)) && input.some(token => closeWord(word,token)));
    });
  });
  if (matches.length === 1) return matches[0];
  // Nothing matched a known phrase: fall back to what the words make people think of
  return scorePictures(text, options);
}

export function explainClues(info:PrivateInfo,s:PublicState,lang:Lang,recipientId?:string):string[]{
  if(!s.trial)return [];
  const lines:string[]=[];
  for(const knowledge of info.knows){
    const control=s.trial.controls.find(c=>c.id===knowledge.controlId);
    if(!control || (recipientId && control.ownerId!==recipientId))continue;
    const owner=s.players.find(p=>p.id===control.ownerId)?.name ?? '?';
    lines.push(lang==='ru'?`${owner}, ещё раз: ${describeFor(s.trial.kind,knowledge.value,lang,control.scale)}.`:`${owner}, once more: ${describeFor(s.trial.kind,knowledge.value,lang,control.scale)}.`);
    if(isCipher(s.trial.kind)){
      const result=decodeClue(s.trial.kind,knowledge.value,control.options);
      lines.push(lang==='ru'?`Это исходная подсказка. После правила выбирай ${describeValue(result,lang)}.`:`That is the input clue. After the rule choose ${describeValue(result,lang)}.`);
    }else lines.push(lang==='ru'?pickLine(['Ставь так и жми «Я уверен».','Выставь это у себя и подтверждай.']):'Set that and press “I’m sure”.');
  }
  return lines.map(line=>line.slice(0,140));
}

// "слева снизу", "справа сверху": a place on the shared 4×2 button grid
export function gridPick(text: string, options: Value[]): Value | null {
  if (options.length !== 8) return null;
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const row = /верх|сверху|top/.test(t) ? 0 : /низ|ниж|снизу|bottom/.test(t) ? 1 : -1;
  const col = /(^|\s)(слева|левая|левую|левой|самая левая|left)/.test(t) ? 0 : /(^|\s)(справа|правая|правую|правой|right)/.test(t) ? 3
    : /левее середины|left of the middle/.test(t) ? 1 : /правее середины|right of the middle/.test(t) ? 2 : -1;
  return row >= 0 && col >= 0 ? options[row * 4 + col] : null;
}
// A teammate telling everyone what to pick, not describing their own cards
export const CHOOSE_WORDS = /выбир|выбер|выбор|ответ|слово это|(^|\s)это (то|та|тот)(\s|$)|жм[иё]|нажм|нажим|став(ь|им|ьте)|тыка|клика|choose|pick|answer|press|select|it's the/i;
export const NEGATION = /^(нет|не то|не так|не та|неправ|не угадал|wrong|no)(?:[\s,.!]|$)/i;

export const isInventoryClue = (text:string)=> /у меня|мои карточки|i have|my cards/i.test(text) && !/ответ|мой выбор|answer|choose|pick/i.test(text);
export function visibleHandDecision(kind:TrialKind, options:Value[], messages:ChatMessage[], players:string[], ownId:string, ownHand:Glyph[]):Value|null {
  const hands=new Map(players.map(id=>[id,new Set<Glyph>()]));
  hands.set(ownId,new Set(ownHand));
  const complete=new Set([ownId]);
  for(const message of messages){
    if(message.kind!=='player' || !message.from || !hands.has(message.from))continue;
    if(/все мои карточки|больше нет|all my cards|no more cards/i.test(message.text))complete.add(message.from);
    if(!isInventoryClue(message.text))continue;
    const pieces=message.text.split(/[,;]|\s+(?:и|and)\s+/i);
    for(const piece of pieces){
      const understood=understandClue(piece,options);
      const values=understood!==null?[understood]:options.filter(value=>understandClue(piece,[value])===value);
      for(const value of values)if(typeof value==='string')hands.get(message.from)!.add(value);
    }
  }
  const publicHands=[...hands.values()].map(hand=>[...hand]);
  const candidates=handCandidates(kind,options,publicHands);
  // Missing has a public guarantee: exactly one of the eight pictures is absent.
  // Seeing seven distinct cards is enough; other collection rules need complete reports.
  const enough=kind==='missing'?new Set(publicHands.flat()).size===options.length-1:complete.size===players.length;
  return enough && candidates.length===1?candidates[0]:null;
}
