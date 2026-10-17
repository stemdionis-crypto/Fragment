import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the real client connection state machine with controlled SSO/network timing.
const source = readFileSync(new URL('../client/src/net.ts', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replaceAll('import.meta.env.VITE_LOCAL_PREVIEW', 'false')
  .replaceAll('import.meta.env.VITE_SERVER_URL', 'undefined')
  .replaceAll('import.meta.env.DEV', 'false');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const practice = { t: 'create', name: 'Guest', color: '#c9c4b8', practice: true, lang: 'en' };
function setup(identity) {
  const sockets = [], timers = new Map();
  let timerId = 0;
  class Socket {
    static OPEN = 1;
    readyState = 0;
    sent = [];
    constructor() { sockets.push(this); }
    open() { this.readyState = 1; return this.onopen(); }
    send(data) { this.sent.push(JSON.parse(data)); }
    receive(message) { this.onmessage({ data: JSON.stringify(message) }); }
    close() { this.readyState = 3; this.onclose(); }
  }
  const exports = {};
  new Function('exports', 'WebSocket', 'platformIdentity', 'localStorage', 'sessionStorage', 'location', 'setTimeout', 'clearTimeout', compiled)(
    exports, Socket, identity, { getItem: () => 'existing-profile-token' }, { getItem: () => null },
    { protocol: 'https:', host: 'test.invalid' },
    (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    id => timers.delete(id),
  );
  const net = new exports.Net();
  net.connect();
  return { net, sockets, timers };
}
const profile = { t: 'profile', profile: {} };
{
  const { net, sockets } = setup(async () => null);
  await sockets[0].open();
  assert.equal(sockets[0].sent[0].t, 'identify');
  sockets[0].receive(profile);
  net.send(practice);
  assert.deepEqual(sockets[0].sent.at(-1), practice);
  assert.equal(sockets.length, 1);
}
{
  let finishIdentity;
  const { net, sockets } = setup(() => new Promise(resolve => { finishIdentity = resolve; }));
  const oldAuth = sockets[0].open();
  net.send(practice);
  assert.equal(sockets.length, 2, 'practice must bypass a hanging SSO request immediately');
  await sockets[1].open();
  sockets[1].receive(profile);
  assert.deepEqual(sockets[1].sent.map(m => m.t), ['identify', 'create']);
  finishIdentity({ t: 'idos_identify', userId: 'late-user', ticket: 'late-ticket' });
  await oldAuth;
  assert.equal(sockets[0].sent.length, 0, 'late login must not switch an active guest match');
  sockets[1].close();
  net.connect();
  await sockets[2].open();
  assert.equal(sockets[2].sent[0].t, 'identify', 'practice reconnect must stay a guest');
  sockets[2].receive(profile);
  sockets[2].receive({ t: 'left' });
  assert.equal(sockets.length, 4, 'leaving practice retries the normal account connection');
}
for (const mode of ['expired', 'server-error', 'timeout']) {
  const { sockets, timers } = setup(mode === 'expired' ? async () => { throw Error('expired'); }
    : mode === 'timeout' ? () => new Promise(() => {})
    : async () => ({ t: 'idos_identify', userId: 'user', ticket: 'ticket' }));
  if (mode === 'timeout') {
    void sockets[0].open();
    [...timers.values()].find(t => t.delay === 6000).callback();
  } else {
    await sockets[0].open();
    if (mode === 'server-error') sockets[0].receive({ t: 'error', message: 'iDos unavailable' });
  }
  assert.equal(sockets.length, 2, `${mode}: guest fallback must connect`);
  await sockets[1].open();
  assert.equal(sockets[1].sent[0].t, 'identify');
  sockets[1].receive(profile);
}
{
  const { net, sockets } = setup(() => { throw Error('SSO must not start'); });
  net.send(practice);
  await sockets[0].open();
  sockets[0].receive(profile);
  assert.deepEqual(sockets[0].sent.map(m => m.t), ['identify', 'create']);
}
console.log('PASS: guest practice, stalled/expired/rejected SSO, auth timeout, late-response isolation, reconnect and account retry after leaving');
