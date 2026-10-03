import type { Glyph, Lang, PrivateInfo, PublicState, Value } from '../shared/protocol';
import { isCipher } from '../shared/trial-rules';

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
};
const EN: Record<Glyph, string> = {
  triangle: 'a roof', circle: 'a wheel', square: 'a window', cross: 'a plus', star: 'what goes on top of a Christmas tree',
  moon: 'what shines at night', eye: 'what you look with', key: 'what opens a door', candle: 'what you blow out on a cake',
  cup: 'what you drink tea from', clock: 'what ticks on the wall', knife: 'what you cut bread with', book: 'what you read before bed',
  coin: 'small change in your pocket', feather: 'what falls off a bird', bottle: 'what you pour water into', cat: 'the one who purrs',
  owl: 'the night bird that hoots', fish: 'the one in the aquarium', spider: 'the one who weaves a web', crow: 'the black bird that caws',
  snake: 'the one that hisses and crawls', rabbit: 'the one who hops and loves carrots', moth: 'the one that flies to the lamp at night',
};
// Numbers without number words
const DIGITS_RU = [
  'пусто, как в кармане перед зарплатой', 'сколько носов у человека', 'сколько глаз у человека', 'сколько медведей в сказке про Машу',
  'сколько лап у собаки', 'сколько пальцев на руке', 'сколько ног у жука', 'сколько дней в неделе', 'сколько щупалец у осьминога',
  'все пальцы на руках, кроме мизинца',
];
const DIGITS_EN = [
  'nothing at all', 'how many noses you have', 'how many eyes you have', 'the bears in Goldilocks', 'the legs of a dog',
  'the fingers on a hand', 'the legs of a beetle', 'the days in a week', 'the arms of an octopus', 'all your fingers but the little one',
];
const describeValue = (v: Value, LANG: Lang) =>
  typeof v === 'number' ? (LANG === 'ru' ? DIGITS_RU : DIGITS_EN)[v] : `«${(LANG === 'ru' ? RU : EN)[v]}»`;


// What the bot says about what it knows, addressed to whoever owns each control
export function linesFor(info: PrivateInfo, s: PublicState, LANG: Lang): string[] {
  const tr = (ru: string, en: string) => LANG === 'ru' ? ru : en;
  const t = s.trial;
  if (!t) return [];
  const lines = info.knows.map((k) => {
    const c = t.controls.find((x) => x.id === k.controlId);
    const owner = s.players.find((p) => p.id === c?.ownerId)?.name ?? '?';
    const label = c ? (LANG === 'ru' ? c.label.ru : c.label.en).toLowerCase() : '';
    if (isCipher(t.kind)) return tr(`${owner}, исходная подсказка для тебя: ${describeValue(k.value, LANG)}. Примени правило испытания.`, `${owner}, your input clue: ${describeValue(k.value, LANG)}. Apply the trial rule.`);
    if (t.kind === 'frequency') return tr(`${owner}, твоя цифра — ${describeValue(k.value, LANG)}.`, `${owner}, your digit: ${describeValue(k.value, LANG)}.`);
    if (t.kind === 'code') return tr(`${owner}, у тебя (${label}) стоит ${describeValue(k.value, LANG)}.`, `${owner}, in your place (${label}): ${describeValue(k.value, LANG)}.`);
    return tr(`${owner}, твоя ${label} — на ${describeValue(k.value, LANG)}.`, `${owner}, your ${label}: ${describeValue(k.value, LANG)}.`);
  });
  // Send each item separately so a clue cannot be cut off by CHAT_MAX.
  if (info.hand?.length) {
    for (const item of info.hand) lines.push(tr(`У меня есть ${describeValue(item, LANG)}.`, `I have ${describeValue(item, LANG)}.`));
  }
  return lines;
}

