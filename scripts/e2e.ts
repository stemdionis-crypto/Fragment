import { TRIALS_PER_GAME } from '../shared/protocol';
// End-to-end check against a running server (npm run dev):
// 3 clients create/join a room, chat in turns, each sets their own control, a wrong check,
// then all five trials passed with "I'm sure", and a Fragment at the end.
//   npm run e2e
import WebSocket from 'ws';
import type { ClientMessage, PrivateInfo, PublicState, ServerMessage, Value } from '../shared/protocol';
import { solveFromKnowledge } from '../server/puzzle';

const url = process.env.SERVER_URL ?? 'ws://localhost:2567';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Client {
  ws: WebSocket;
  state: PublicState | null = null;
  info: PrivateInfo | null = null;
  heard: string[][] = [];
  errors: string[] = [];
  code = '';
  id = '';
  constructor(public name: string) {
    this.ws = new WebSocket(url);
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMessage;
      if (m.t === 'state') this.state = m.state;
      if (m.t === 'private') this.info = m.info;
      if (m.t === 'joined') [this.code, this.id] = [m.code, m.playerId];
      if (m.t === 'heard') this.heard.push(m.words);
      if (m.t === 'error') this.errors.push(m.message);
    });
  }
  open() {
    return new Promise((r) => this.ws.once('open', r));
  }
  send(m: ClientMessage) {
    this.ws.send(JSON.stringify(m));
  }
}

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.log(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok   ${msg}`);
}

const [a, b, c] = [new Client('Ash'), new Client('Bone'), new Client('Slate')];
const all = [a, b, c];
await Promise.all(all.map((cl) => cl.open()));
a.send({ t: 'create', name: 'Ash', color: '#c9c4b8' });
await sleep(200);
b.send({ t: 'join', code: a.code, name: 'Bone', color: '#8d9499' });
c.send({ t: 'join', code: a.code, name: 'Slate', color: '#7d93a3' });
await sleep(300);
assert(a.state?.players.length === 3, 'three players in the lobby');

a.send({ t: 'start' });
await sleep(300);
assert(a.state?.phase === 'playing', 'game started');

// Turns: only the player holding the floor can speak
const speaker = all.find((cl) => cl.id === a.state!.turnId)!;
const silent = all.find((cl) => cl !== speaker)!;
const before = a.state!.chat.length;
silent.send({ t: 'chat', text: 'can I talk?' });
await sleep(300);
assert(a.state!.chat.length === before, `${silent.name} cannot speak during ${speaker.name}'s turn`);

// The radio hears plain names
speaker.send({ t: 'chat', text: 'mine is a cat that looks like a triangle' });
await sleep(300);
const last = a.state!.chat.filter((m) => m.kind === 'player').at(-1)!;
assert(last.heard && !/cat|triangle/.test(last.text), `radio masked plain words: "${last.text}"`);
assert(speaker.heard.length === 1, `only the speaker is told what was heard: ${speaker.heard[0]}`);
speaker.send({ t: 'pass' });
await sleep(300);
assert(a.state!.turnId !== speaker.id, 'pass gives the floor to the next player');

const kinds: string[] = [];
for (let round = 0; round < TRIALS_PER_GAME; round++) {
  const trial = a.state!.trial!;
  kinds.push(trial.kind);
  const answer = solveFromKnowledge(
    trial,
    all.map((cl) => cl.info!.knows),
    all.map((cl) => cl.info!.hand ?? []),
  );
  const mine = (cl: Client) => trial.controls.filter((x) => x.ownerId === cl.id);
  assert(
    all.every((cl) => mine(cl).length === 1),
    `trial ${round + 1} (${trial.title.en} / ${trial.title.ru}): everyone owns their own control`,
  );
  assert(
    all.every((cl) => cl.info!.knows.every((k) => !mine(cl).some((x) => x.id === k.controlId))),
    'nobody is told the setting of their own control',
  );
  assert([...answer.values()].every((v) => v !== null), 'together the table knows every answer');

  if (round === 0) {
    // "I'm sure" needs your control set first
    a.send({ t: 'ready', on: true });
    await sleep(200);
    assert(!a.state!.players.find((p) => p.id === a.id)!.ready && a.errors.length > 0, '“I’m sure” is refused until your control is set');
    // Everyone sets their control, but Ash gets it wrong
    for (const cl of all) {
      const ctl = mine(cl)[0];
      const right = answer.get(ctl.id)!;
      const value: Value = cl === a ? ctl.options.find((o) => o !== right)! : right;
      cl.send({ t: 'set', control: ctl.id, value });
    }
    await sleep(200);
    assert(b.state!.trial!.controls.every((x) => x.isSet), 'everyone sees that controls are set, not their values');
    for (const cl of all) cl.send({ t: 'ready', on: true });
    await sleep(1200);
    assert(a.state!.attemptsLeft === 2 && a.state!.trial!.lastWrong === 1, 'a wrong check costs a try and says how many were wrong (1)');
    assert(a.state!.players.every((p) => !p.ready), 'after a wrong check everyone has to be sure again');
  }

  for (const cl of all) {
    const ctl = mine(cl)[0];
    cl.send({ t: 'set', control: ctl.id, value: answer.get(ctl.id)! });
  }
  await sleep(200);
  for (const cl of all) cl.send({ t: 'ready', on: true });
  await sleep(1200);
  if (round < TRIALS_PER_GAME - 1) assert(a.state!.trial!.index === round + 1 && a.state!.attemptsLeft === 3, `trial ${round + 1} passed when everyone was sure`);
}
assert(new Set(kinds).size === TRIALS_PER_GAME, `five different trials: ${kinds.join(', ')}`);
assert(a.state!.phase === 'won', 'the fifth trial opens the radio');
const f = a.state!.fragment!;
assert(f.trials.length === TRIALS_PER_GAME && f.wrong === 1 && f.heard === 1, `fragment ${f.id}: ${f.trials.map((x) => x.ru).join(', ')}`);

a.send({ t: 'again' });
await sleep(300);
assert(a.state!.phase === 'lobby', 'host can bring everyone back to the room');
console.log('\nALL PASSED');
process.exit(0);
