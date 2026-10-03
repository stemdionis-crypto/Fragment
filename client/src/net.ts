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
  onMessage: (m: ServerMessage) => void = () => {};
  onStatus: (online: boolean) => void = () => {};

  connect() {
    const ws = new WebSocket(serverUrl());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus(true);
      let token: string | undefined;
      try { token = localStorage.getItem('fragment.profile-token') ?? undefined; } catch { /* guest profile */ }
      ws.send(JSON.stringify({ t: 'identify', token } satisfies ClientMessage));
      const s = savedSession();
      if (s) ws.send(JSON.stringify({ t: 'resume', code: s.code, playerId: s.playerId } satisfies ClientMessage));
      this.queue.splice(0).forEach((m) => ws.send(m));
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      this.onStatus(false);
      setTimeout(() => this.connect(), Math.min(5000, 500 * 2 ** this.retry++));
    };
  }

  send(msg: ClientMessage) {
    const data = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
    else this.queue.push(data);
  }
}
