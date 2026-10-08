// Bots for testing alone. They explain what they know in simple descriptions (Russian by default,
// BOT_LANG=en for English), set their own control and press "I'm sure".
// To stand in for a teammate who understood you, a bot on a development server is allowed to peek at
// its own answer, but it waits until someone has spoken in the trial before using it.
//   npm run bots -- new 2      bots create a room (prints the code), the host bot starts once a human joins
//   npm run bots -- ABCD 2     bots join an existing room
import WebSocket from 'ws';
import type { Glyph, PrivateInfo, PublicState, ServerMessage, Value } from '../shared/protocol';

const [target = 'new', countArg] = process.argv.slice(2);
const count = Math.max(1, Math.min(3, Number(countArg ?? 2)));
const url = process.env.SERVER_URL ?? 'ws://localhost:2567';
const LANG: 'ru' | 'en' = process.env.BOT_LANG === 'en' ? 'en' : 'ru';
const names = LANG === 'ru' ? ['Эхо', 'Ива', 'Тень'] : ['Echo', 'Wren', 'Shade'];
const colors = ['#8d9499', '#7d93a3', '#86906c'];

// Simple descriptions a normal person understands, without naming the thing
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
  microphone: 'то, во что говорят на сцене', headphones: 'то, что надевают на уши для музыки', record: 'чёрная виниловая вещь с музыкой', dial: 'регулятор, который поворачивают пальцами',
  speaker: 'коробка, из которой звучит музыка', battery: 'маленький источник питания', wire: 'тонкий шнур, по которому идёт ток', switch: 'то, чем включают свет',
};
const EN: Record<Glyph, string> = {
  triangle: 'a roof', circle: 'a wheel', square: 'a window', cross: 'a plus', star: 'what goes on top of a Christmas tree',
  moon: 'what shines at night', eye: 'what you look with', key: 'what opens a door', candle: 'what you blow out on a cake',
  cup: 'what you drink tea from', clock: 'what ticks on the wall', knife: 'what you cut bread with', book: 'what you read before bed',
  coin: 'small change in your pocket', feather: 'what falls off a bird', bottle: 'what you pour water into', cat: 'the one who purrs',
  owl: 'the night bird that hoots', fish: 'the one in the aquarium', spider: 'the one who weaves a web', crow: 'the black bird that caws',
  snake: 'the one that hisses and crawls', rabbit: 'the one who hops and loves carrots', moth: 'the one that flies to the lamp at night',
  antenna: 'a wire catching distant stations', cassette: 'a box with two reels', bell: 'what rings at the door',
  hourglass: 'sand measuring time', compass: 'the needle that finds north', lantern: 'a carried light',
  gear: 'a toothed wheel', lock: 'a metal clasp on a door',
  cloud: 'a grey veil across the sky', sun: 'the bright source of warmth above us', rain: 'water falling from the sky', snowflake: 'a tiny ice pattern falling in winter',
  lightning: 'a bright flash during a storm', wind: 'what makes trees sway', umbrella: 'what you open over your head in bad weather', thermometer: 'what shows the temperature',
  microphone: 'what a singer speaks into', headphones: 'what you wear over your ears for music', record: 'a black vinyl thing that holds music', dial: 'the regulator you turn with your fingers',
  speaker: 'a box that plays sound', battery: 'a small power source', wire: 'a thin cord that carries electricity', switch: 'what you use to turn on a light',
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
const describeValue = (v: Value) =>
  typeof v === 'number' ? (LANG === 'ru' ? DIGITS_RU : DIGITS_EN)[v] : `«${(LANG === 'ru' ? RU : EN)[v]}»`;
const tr = (ru: string, en: string) => (LANG === 'ru' ? ru : en);

// What the bot says about what it knows, addressed to whoever owns each control
function linesFor(info: PrivateInfo, s: PublicState): string[] {
  const t = s.trial;
  if (!t) return [];
  const lines = info.knows.map((k) => {
    const c = t.controls.find((x) => x.id === k.controlId);
    const owner = s.players.find((p) => p.id === c?.ownerId)?.name ?? '?';
    const label = c ? (LANG === 'ru' ? c.label.ru : c.label.en).toLowerCase() : '';
    if (t.kind === 'frequency') return tr(`${owner}, твоя цифра — ${describeValue(k.value)}.`, `${owner}, your digit: ${describeValue(k.value)}.`);
    if (t.kind === 'code') return tr(`${owner}, у тебя (${label}) стоит ${describeValue(k.value)}.`, `${owner}, in your place (${label}): ${describeValue(k.value)}.`);
    return tr(`${owner}, твоя ${label} — на ${describeValue(k.value)}.`, `${owner}, your ${label}: ${describeValue(k.value)}.`);
  });
  if (info.hand?.length) lines.push(tr(`У меня есть: ${info.hand.map(describeValue).join('; ')}.`, `I have: ${info.hand.map(describeValue).join('; ')}.`));
  return lines;
}

function bot(i: number, create: boolean, code?: string) {
  return new Promise<string>((resolve) => {
    const ws = new WebSocket(url);
    const send = (m: object) => ws.send(JSON.stringify(m));
    let state: PublicState | null = null;
    let info: PrivateInfo | null = null;
    let myId = '';
    let trialKey = '';
    let spoken: string[] = [];
    let queue: string[] | null = null;
    let actAt = 0; // when the bot will set its control
    let trialStartMsg = 0; // chat id when the current trial began
    let startTimer: NodeJS.Timeout | null = null;
    let againTimer: NodeJS.Timeout | null = null;

    ws.on('open', () =>
      send(create ? { t: 'create', name: names[i], color: colors[i], bot: true } : { t: 'join', code, name: names[i], color: colors[i], bot: true }),
    );
    ws.on('message', (data) => {
      const m = JSON.parse(String(data)) as ServerMessage;
      if (m.t === 'joined') {
        myId = m.playerId;
        console.log(`[${names[i]}] in room ${m.code}`);
        resolve(m.code);
      }
      if (m.t === 'error') console.log(`[${names[i]}] ${m.message}`);
      if (m.t === 'private') info = m.info;
      if (m.t !== 'state') return;
      state = m.state;
      const s = m.state;

      // A new trial (or a retune): forget what was said, plan what to say
      const key = `${s.trial?.index}:${s.trial?.controls.map((c) => c.id).join()}:${s.retunes}`;
      if (s.phase === 'playing' && key !== trialKey) {
        trialKey = key;
        queue = null;
        spoken = [];
        actAt = 0;
        trialStartMsg = s.chat.at(-1)?.id ?? 0;
      }

      // Someone spoke in this trial: a teammate would now act on it
      if (s.phase === 'playing' && !actAt && s.chat.some((c) => c.kind === 'player' && c.from !== myId && c.id > trialStartMsg))
        actAt = Date.now() + 3000 + i * 1500;

      // Host bot: start when enough people are in, go back to the room after a round
      const needed = Math.max(3, count + 1);
      if (create && s.phase === 'lobby' && s.players.length >= needed && !startTimer)
        startTimer = setTimeout(() => {
          startTimer = null;
          if (state?.phase === 'lobby' && state.players.length >= needed) send({ t: 'start' });
        }, 4000);
      if (create && (s.phase === 'won' || s.phase === 'lost') && !againTimer)
        againTimer = setTimeout(() => {
          againTimer = null;
          send({ t: 'again' });
        }, 20000);
    });

    // Set my control and say I'm sure (again after a wrong check, since that clears everyone)
    setInterval(() => {
      const s = state;
      if (!s || s.phase !== 'playing' || !info?.targets || !actAt || Date.now() < actAt) return;
      for (const [control, value] of Object.entries(info.targets)) if (info.mine[control] !== value) send({ t: 'set', control, value });
      const me = s.players.find((p) => p.id === myId);
      if (me && !me.ready && Object.entries(info.targets).every(([c, v]) => info!.mine[c] === v)) send({ t: 'ready', on: true });
    }, 1500);

    // Speak only on my turn: up to two lines, then pass the floor
    let myTurn = '';
    setInterval(() => {
      const s = state;
      if (!s || s.phase !== 'playing' || s.turnId !== myId || myTurn === `${s.turnEndsAt}` || !info) return;
      myTurn = `${s.turnEndsAt}`;
      queue ??= linesFor(info, s);
      // Everything said already: now and then remind the table of one line
      if (!queue.length && spoken.length && Math.random() < 0.5) queue = [spoken[Math.floor(Math.random() * spoken.length)]];
      const lines = queue.splice(0, 2);
      lines.forEach((line, k) =>
        setTimeout(() => {
          send({ t: 'chat', text: line });
          if (!spoken.includes(line)) spoken.push(line);
        }, 2200 + k * 2600),
      );
      setTimeout(() => send({ t: 'pass' }), 2200 + lines.length * 2600 + 800);
    }, 500);
  });
}

if (target === 'new') {
  const code = await bot(0, true);
  for (let i = 1; i < count; i++) await bot(i, false, code);
  console.log(`\nROOM ${code}  →  http://localhost:5174/?room=${code}\n`);
} else {
  for (let i = 0; i < count; i++) await bot(i, false, target.toUpperCase());
}
