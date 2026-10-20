import { platformIdentity } from './idos';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';

const SESSION_KEY = 'fragment.session';

function serverUrl() {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  if (import.meta.env.DEV) return `ws://${location.hostname}:2567`;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}

export interface Session {
  code: string;
  playerId: string;
}

export function savedSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

// WebSocket with a send queue and automatic resume after a reconnect
export class Net {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private retry = 0;
  private authenticated = false;
  private preferGuest = false;
  onMessage: (m: ServerMessage) => void = () => {};
  onStatus: (online: boolean) => void = () => {};

  connect() {
    const ws = new WebSocket(serverUrl());
    this.ws = ws;
    this.authenticated = false;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    const guestFallback = () => {
      if (ws !== this.ws || this.authenticated || this.preferGuest) return;
      this.preferGuest = true;
      this.connect();
      ws.close();
    };
    ws.onopen = async () => {
      this.retry = 0;
      this.onStatus(true);
      let token: string | undefined;
      try { token = localStorage.getItem('fragment.profile-token') ?? undefined; } catch { /* guest profile */ }
      try {
        // A stale platform login must never block a guest practice session.
        if (!this.preferGuest) authTimer = setTimeout(guestFallback, 6000);
        const identity = this.preferGuest || import.meta.env.VITE_LOCAL_PREVIEW==='true' ? null : await platformIdentity();
        if (ws !== this.ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify(identity ?? { t: 'identify', token } satisfies ClientMessage));
      } catch {
        guestFallback();
      }
    };
    ws.onmessage = (e) => {
      if (ws !== this.ws) return;
      const message = JSON.parse(e.data) as ServerMessage;
      if (message.t === 'error' && !this.authenticated && !this.preferGuest) {
        guestFallback();
        return;
      }
      if (message.t === 'profile' && message.profile.platform) this.preferGuest = false;
      this.onMessage(message);
      if (message.t === 'profile' && !this.authenticated) {
        clearTimeout(authTimer);
        this.authenticated = true;
        const s = savedSession();
        if (s) ws.send(JSON.stringify({ t: 'resume', code: s.code, playerId: s.playerId } satisfies ClientMessage));
        this.queue.splice(0).forEach(m => ws.send(m));
      }
      if ((message.t === 'left' || message.t === 'eliminated') && this.preferGuest) {
        this.preferGuest = false;
        this.connect();
        ws.close();
      }
    };
    ws.onclose = () => {
      clearTimeout(authTimer);
      if (ws !== this.ws) return;
      this.authenticated = false;
      this.onStatus(false);
      setTimeout(() => { if (ws === this.ws) this.connect(); }, Math.min(5000, 500 * 2 ** this.retry++));
    };
  }

  send(msg: ClientMessage) {
    const data = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) this.ws.send(data);
    else {
      this.queue.push(data);
      if (msg.t === 'create' && msg.practice === true && !this.preferGuest) {
        this.preferGuest = true;
        // If SSO or its server-side verification is already in progress,
        // use a fresh guest connection rather than queue behind that work.
        if (this.ws?.readyState === WebSocket.OPEN) {
          const previous = this.ws;
          this.connect();
          previous.close();
        }
      }
    }
  }
}
