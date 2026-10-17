// Real conversations: clues arrive in pieces, with corrections, the way people actually type.
// Each dialogue is fed message by message to a fresh companion; the last answer must be right.
import { CompanionBrain } from '../server/bot-brain';
import type { ChatMessage, TrialKind, Value } from '../shared/protocol';
import { dialOptions, waveValue, type DialKind } from '../shared/dials';

let failed = 0, total = 0;
function dialogue(kind: DialKind, lines: string[], want: Value) {
  total++;
  const brain = new CompanionBrain();
  const control = { id: 'c', label: { en: 'x', ru: 'x' }, options: dialOptions(kind) };
  const messages: ChatMessage[] = [];
  let value: Value | undefined, asked: string[] = [];
  lines.forEach((text, i) => {
    messages.push({ id: i + 1, kind: 'player', from: 'h', text, t: 0 } as ChatMessage);
    const thought = brain.think(control, kind as TrialKind, messages, 'Женя', 'ru');
    value = thought.value; asked = thought.lines;
  });
  if (value !== want) { failed++; console.log(`FAIL ${kind}: ${lines.map((l) => `"${l}"`).join(' → ')} gave ${value}, want ${want}; bot said: ${asked.join(' / ')}`); }
}

// Equalizer: the match that got stuck, then other ways people say it
dialogue('equalizer', ['Ива лежит у двери', 'остальные торчат'], 3);
dialogue('equalizer', ['та полоска что в начале лежит', 'а остальные стоят'], 3);
dialogue('equalizer', ['Ива все полоски кроме той что у двери торчат'], 3);
dialogue('equalizer', ['Ива все полоски кроме двери стоят'], 3);
dialogue('equalizer', ['у окна торчит', 'у двери тоже торчит', 'в середине лежит'], 5);
dialogue('equalizer', ['в середине торчит', 'по краям лежат'], 2);
dialogue('equalizer', ['у двери стоит', 'остальные лежат'], 4);
dialogue('equalizer', ['все лежат'], 0);
dialogue('equalizer', ['все торчат кроме средней'], 5);
dialogue('equalizer', ['у окна лежит, две другие стоят'], 6);
dialogue('equalizer', ['у двери не торчит', 'в середине тоже не торчит', 'у окна торчит'], 1);
// Equalizer bands: bass, voice, treble
dialogue('equalizer', ['бас лежит', 'остальные торчат'], 3);
dialogue('equalizer', ['торчит только писк'], 1);
dialogue('equalizer', ['басы и писк стоят, голос лежит'], 5);
dialogue('equalizer', ['всё торчит кроме баса'], 3);
dialogue('equalizer', ['голос торчит', 'бас и писк лежат'], 2);
dialogue('equalizer', ['лесенка к писку'], 3);
// Wires: row and side in separate messages
dialogue('wires', ['у двери', 'ближе к полу'], 3);
dialogue('wires', ['под потолком', 'у окна'], 2);
dialogue('wires', ['посередине', 'внизу у пола'], 4);
dialogue('wires', ['возле двери под самым потолком'], 0);
// Wave: height first, spacing later
dialogue('wave', ['высокая', 'горбы как пила'], waveValue(2, 2));
dialogue('wave', ['низкая волна', 'растянутая, горбы далеко'], waveValue(0, 0));
dialogue('wave', ['средняя', 'обычные горбы'], waveValue(1, 1));
// Antenna, cassette, morse, lamp in one go
dialogue('antenna', ['смотрит в окно'], 2);
dialogue('antenna', ['между дверью и плинтусом'], 5);
dialogue('antenna', ['к люстре'], 0);
dialogue('antenna', ['туда где форточка и потолок'], 1);
dialogue('cassette', ['закрась сколько ног у жука'], 6);
dialogue('cassette', ['как колёс у машины'], 4);
dialogue('cassette', ['сколько цветов у радуги'], 7);
dialogue('cassette', ['сколько глаз у человека'], 2);
dialogue('morse', ['тук тууук тук'], 2);
dialogue('morse', ['пик пииик пииик'], 3);
dialogue('lamp', ['цвета травы'], 2);
dialogue('lamp', ['как спелая вишня'], 0);

console.log(failed ? `${failed}/${total} dialogues misread` : `PASS: all ${total} piecewise dialogues understood`);
process.exit(failed ? 1 : 0);
