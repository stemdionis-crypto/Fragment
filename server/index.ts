import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/protocol';
import { GameError, Room, type Player } from './room';
import { translationEngine } from './translate';
import { identify, profile, buy, equip, buyItem, equipItem, profileListeners, walletAccount, bindWallet } from './economy';
import { challenge, verifyChallenge } from './wallet-auth';

// Hosting platforms pass PORT in production; in dev the client expects the server on 2567
const PROD = process.argv.includes('--prod');
const PORT = Number((PROD && process.env.PORT) || process.env.SERVER_PORT || 2567);
const DIST = fileURLToPath(new URL('../client/dist', import.meta.url));
const rooms = new Map<string, Room>();

function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  do code = Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
  while (rooms.has(code));
  return code;
}

// In production the same server also serves the built client
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const http = createServer((req, res) => {
  if (req.url === '/health') return res.end('ok');
  if (!existsSync(DIST)) return res.writeHead(404).end('Client not built. Run `npm run dev` for development.');
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^([/\\])+/, '');
  let file = join(DIST, path);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (socket: WebSocket, request) => {
  let room: Room | null = null;
  let me: Player | null = null;
  let accountId = '';
  let walletProof: ReturnType<typeof challenge> | null = null;
  let pendingWallet: { address: string; expiresAt: number } | null = null;
  let lastChallenge = 0;
  const send = (msg: ServerMessage) => socket.send(JSON.stringify(msg));
  const requireWallet = () => {
    if (!accountId || !profile(accountId).wallet) throw new GameError('Sign in with a verified Solana wallet to play with others', 'Для игры с друзьями и случайного подбора войдите через Solana-кошелёк и подтвердите подпись');
  };
  const onProfile = (id: string) => {
    if (id !== accountId || socket.readyState !== socket.OPEN) return;
    send({ t: 'profile', profile: profile(id) });
    room?.broadcast();
  };
  profileListeners.add(onProfile);

  socket.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    try {
      switch (msg.t) {
        case 'wallet_challenge': {
          walletProof = null;
          pendingWallet = null;
          if (!accountId) throw new GameError('Profile not connected', 'Профиль не подключён');
          if (Date.now() - lastChallenge < 2000) throw new GameError('Please wait before retrying', 'Подождите перед повторной попыткой');
          lastChallenge = Date.now();
          const origin = request.headers.origin;
          const expected = process.env.FRAGMENT_PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://${request.headers.host}`;
          const allowed = [expected, ...(!PROD ? ['http://localhost:5174', 'http://127.0.0.1:5174'] : [])];
          if (!origin || !allowed.includes(origin)) throw new GameError('Wallet login origin is not allowed', 'Этот адрес сайта не разрешён для входа через кошелёк');
          walletProof = challenge(msg.address, origin, accountId);
          send({ t: 'wallet_challenge', message: walletProof.message, address: walletProof.address });
          break;
        }
        case 'wallet_proof': {
          const proof = walletProof;
          walletProof = null;
          if (!proof) throw new GameError('Request a new signature first', 'Сначала запросите новую подпись');
          verifyChallenge(proof, msg.signature, accountId);
          const existing = walletAccount(proof.address);
          if (existing && existing.id !== accountId) {
            if (room) throw new GameError('Return to the main menu to restore a profile', 'Вернитесь в главное меню для восстановления другого профиля');
            pendingWallet = { address: proof.address, expiresAt: Date.now() + 120_000 };
            send({ t: 'wallet_conflict', profile: profile(existing.id) });
          } else {
            bindWallet(accountId, proof.address);
            if (me) me.wallet = proof.address;
            room?.broadcast();
            send({ t: 'wallet_verified', restored: false });
          }
          break;
        }
        case 'wallet_use': {
          const pending = pendingWallet;
          pendingWallet = null;
          walletProof = null;
          if (!msg.accept) break;
          if (!pending || pending.expiresAt <= Date.now() || room) throw new GameError('Request a new wallet signature from the main menu', 'Запросите новую подпись кошелька из главного меню');
          const target = walletAccount(pending.address);
          if (!target) throw new GameError('Profile not found', 'Профиль не найден');
          accountId = target.id;
          send({ t: 'profile', token: target.token, profile: profile(accountId) });
          send({ t: 'wallet_verified', restored: true });
          break;
        }
        case 'identify': {
          if (!accountId) {
            const account = identify(msg.token);
            accountId = account.id;
            send({ t: 'profile', token: account.token, profile: profile(accountId) });
          } else send({ t: 'profile', profile: profile(accountId) });
          if (me) me.accountId = accountId;
          room?.broadcast();
          break;
        }
        case 'buy_item':
        case 'equip_item': {
          if (!accountId) throw new GameError('Profile not connected', 'Профиль не подключён');
          if (msg.t === 'buy_item') buyItem(accountId, String(msg.item));
          else equipItem(accountId, String(msg.item));
          send({ t: 'profile', profile: profile(accountId) });
          room?.broadcast();
          break;
        }
        case 'buy':
        case 'equip': {
          if (!accountId) throw new GameError('Profile not connected', 'Профиль не подключён');
          if (msg.t === 'buy') buy(accountId, msg.skin);
          else equip(accountId, msg.skin);
          send({ t: 'profile', profile: profile(accountId) });
          room?.broadcast();
          break;
        }
        case 'match': {
          requireWallet();
          if (room && me) {
            if (!room.matchmaking) throw new GameError('Already in a room', 'Вы уже в комнате');
            send({ t: 'joined', playerId: me.id, code: room.code });
            room.broadcast();
            break;
          }
          const available = [...rooms.values()].filter((r) => r.matchmaking && r.phase === 'lobby' && r.players.length > 0 && r.players.length < 4);
          room = available[Math.floor(Math.random() * available.length)] ?? new Room(newCode());
          room.matchmaking = true;
          rooms.set(room.code, room);
          me = room.addPlayer(msg.name, msg.color, socket);
          me.accountId = accountId || undefined;
          send({ t: 'joined', playerId: me.id, code: room.code });
          room.updateMatchmaking();
          break;
        }
        case 'leave': {
          if (room && me) room.disconnect(me);
          room = null;
          me = null;
          send({ t: 'left' });
          break;
        }
        case 'create': {
          if (msg.practice !== true) requireWallet();
          if (room && me) throw new GameError('Already in a room', 'Вы уже в комнате');
          room = new Room(newCode(), msg.practice === true, msg.lang === 'en' ? 'en' : 'ru');
          rooms.set(room.code, room);
          me = room.addPlayer(msg.name, msg.color, socket, !!msg.bot);
          me.accountId = accountId || undefined;
          if (room.practice) room.addCompanions();
          send({ t: 'joined', playerId: me.id, code: room.code });
          room.broadcast();
          break;
        }
        case 'join': {
          requireWallet();
          if (room && me) throw new GameError('Already in a room', 'Вы уже в комнате');
          const r = rooms.get(String(msg.code).toUpperCase().trim());
          if (!r) throw new GameError('No room with this code', 'Комнаты с таким кодом нет');
          if (r.practice) throw new GameError('This is a solo practice room', 'Это комната для одиночной тренировки');
          me = r.addPlayer(msg.name, msg.color, socket, !r.matchmaking && !!msg.bot);
          me.accountId = accountId || undefined;
          room = r;
          send({ t: 'joined', playerId: me.id, code: r.code });
          r.broadcast();
          r.updateMatchmaking();
          break;
        }
        case 'resume': {
          const r = rooms.get(String(msg.code).toUpperCase());
          if (!r) throw new GameError('This room no longer exists', 'Этой комнаты больше нет');
          if (!r.practice) requireWallet();
          const returning = r.players.find((p) => p.id === msg.playerId);
          if (returning?.accountId && returning.accountId !== accountId) throw new GameError('This player belongs to another profile', 'Этот игрок принадлежит другому профилю');
          me = r.resume(msg.playerId, socket);
          me.accountId = accountId || undefined;
          room = r;
          send({ t: 'joined', playerId: me.id, code: r.code });
          r.broadcast();
          break;
        }
        default: {
          if (!room || !me) return;
          if (msg.t === 'start') room.start(me);
          else if (msg.t === 'emote') room.emoteFrom(me, String(msg.item));
          else if (msg.t === 'chat') room.chatFrom(me, String(msg.text ?? ''));
          else if (msg.t === 'set') room.setControl(me, String(msg.control), msg.value);
          else if (msg.t === 'ready') room.setReady(me, !!msg.on);
          else if (msg.t === 'pass') room.pass(me);
          else if (msg.t === 'wallet') {
            const linked = accountId ? profile(accountId).wallet : undefined;
            if (linked) { me.wallet = linked; room.broadcast(); }
          }
          else if (msg.t === 'again') room.again(me);
        }
      }
    } catch (e) {
      send({ t: 'error', message: (e as Error).message, ru: e instanceof GameError ? e.ru : undefined });
    }
  });

  socket.on('close', () => {
    profileListeners.delete(onProfile);
    if (room && me && me.socket === socket) room.disconnect(me);
  });
});

// Forget rooms nobody has been connected to for 10 minutes
setInterval(() => {
  for (const [code, r] of rooms)
    if ((r.emptySince && Date.now() - r.emptySince > 10 * 60_000) || (r.players.length === 0 && r.phase === 'lobby')) {
      r.stopTimer();
      rooms.delete(code);
    }
}, 60_000);

http.listen(PORT, () => console.log(`FRAGMENT server listening on :${PORT} · chat translation: ${translationEngine}`));
