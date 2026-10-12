import type { ChatMessage, Glyph, Lang, PrivateInfo, PublicState, TrialKind, Value } from '../shared/protocol';
import { isCipher, handCandidates, decodeClue } from '../shared/trial-rules';

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
  typeof v === 'number' ? (LANG === 'ru' ? DIGITS_RU : DIGITS_EN)[v] : `«${(LANG === 'ru' ? RU : EN)[v]}»`;
export const describeClue=describeValue;


// What the bot says about what it knows, addressed to whoever owns each control
export function linesFor(info: PrivateInfo, s: PublicState, LANG: Lang): string[] {
  const tr = (ru: string, en: string) => LANG === 'ru' ? ru : en;
  const t = s.trial;
  if (!t) return [];
  const lines = info.knows.map((k) => {
    const c = t.controls.find((x) => x.id === k.controlId);
    const owner = s.players.find((p) => p.id === c?.ownerId)?.name ?? '?';
    const label = c ? (LANG === 'ru' ? c.label.ru : c.label.en).toLowerCase() : '';
    if (isCipher(t.kind)) return tr(`${owner}, исходная подсказка для тебя: ${describeValue(k.value, LANG)}.`, `${owner}, your input clue: ${describeValue(k.value, LANG)}.`);
    if (t.kind === 'frequency') return tr(`${owner}, твоя цифра — ${describeValue(k.value, LANG)}.`, `${owner}, your digit: ${describeValue(k.value, LANG)}.`);
    if (t.kind === 'code') return tr(`${owner}, у тебя (${label}) стоит ${describeValue(k.value, LANG)}.`, `${owner}, in your place (${label}): ${describeValue(k.value, LANG)}.`);
    return tr(`${owner}, твоя ${label} — на ${describeValue(k.value, LANG)}.`, `${owner}, your ${label}: ${describeValue(k.value, LANG)}.`);
  });
  // Send each item separately so a clue cannot be cut off by CHAT_MAX.
  if (info.hand?.length) {
    for (const item of info.hand) lines.push(tr(`У меня есть ${describeValue(item, LANG)}.`, `I have ${describeValue(item, LANG)}.`));
    lines.push(tr('Это все мои карточки.', 'Those are all my cards.'));
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
  return matches.length === 1 ? matches[0] : null;
}

export function explainClues(info:PrivateInfo,s:PublicState,lang:Lang,recipientId?:string):string[]{
  if(!s.trial)return [];
  const lines:string[]=[];
  for(const knowledge of info.knows){
    const control=s.trial.controls.find(c=>c.id===knowledge.controlId);
    if(!control || (recipientId && control.ownerId!==recipientId))continue;
    const owner=s.players.find(p=>p.id===control.ownerId)?.name ?? '?';
    lines.push(lang==='ru'?`${owner}, для твоего пульта: ${describeValue(knowledge.value,lang)}.`:`${owner}, for your control: ${describeValue(knowledge.value,lang)}.`);
    if(isCipher(s.trial.kind)){
      const result=decodeClue(s.trial.kind,knowledge.value,control.options);
      lines.push(lang==='ru'?`Это исходная подсказка. После правила выбирай ${describeValue(result,lang)}.`:`That is the input clue. After the rule choose ${describeValue(result,lang)}.`);
    }else lines.push(lang==='ru'?'Выбери эту картинку на своём пульте и подтверди ответ.':'Choose that picture on your control and confirm.');
  }
  return lines.map(line=>line.slice(0,140));
}

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
