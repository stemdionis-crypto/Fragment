import type { ServerMessage } from '../../shared/protocol';
import { lang } from './i18n';

let previous: { identity: string; games: number; points: number } | null = null;

// Profile updates arrive only after the server has committed the result.
// Comparing completed bot matches avoids notifications for login, claims or purchases.
export function handleRatingMessage(message: ServerMessage) {
  if (message.t !== 'profile') return;
  const profile = message.profile;
  let token = message.token ?? '';
  if (!token) { try { token = localStorage.getItem('fragment.profile-token') ?? ''; } catch { /* memory-only guest */ } }
  const identity = profile.platform ? `idos:${profile.platform.userId}` : profile.wallet ? `wallet:${profile.wallet}` : `guest:${token}`;
  const next = { identity, games: profile.botGamesPlayed ?? 0, points: profile.botPoints ?? 0 };
  const before = previous;
  previous = next;
  if (!before || before.identity !== next.identity || next.games <= before.games) return;
  showRatingNotice(next.points - before.points, next.points);
}

export function showRatingNotice(delta: number, points: number) {
  let host = document.getElementById('rating-notices');
  if (!host) {
    host = document.createElement('div'); host.id = 'rating-notices';
    host.setAttribute('aria-live', 'polite'); host.setAttribute('aria-relevant', 'additions');
    document.body.append(host);
  }
  const notice = document.createElement('div');
  notice.className = `rating-notice ${delta > 0 ? 'rating-gain' : delta < 0 ? 'rating-loss' : 'rating-unchanged'}`;
  notice.setAttribute('role', 'status'); notice.setAttribute('aria-atomic', 'true');
  const close = document.createElement('button'); close.className = 'rating-notice-close';
  close.textContent = '×'; close.setAttribute('aria-label', lang === 'ru' ? 'Закрыть уведомление о рейтинге' : 'Dismiss rating notification');
  const title = document.createElement('p'); title.className = 'fine';
  title.textContent = lang === 'ru' ? 'Матч с ботами завершён' : 'Bot match completed';
  const change = document.createElement('strong');
  change.textContent = `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta)} ${lang === 'ru' ? 'к рейтингу' : 'rating'}`;
  const total = document.createElement('p');
  total.textContent = lang === 'ru' ? `Ваш рейтинг: ${points}` : `Your rating: ${points}`;
  if (!delta && !points) total.textContent += lang === 'ru' ? '. Ниже нуля не опускается.' : '. Rating cannot go below zero.';
  notice.append(close, title, change, total);
  const timer = setTimeout(() => notice.remove(), 8000);
  close.onclick = () => { clearTimeout(timer); notice.remove(); };
  while (host.children.length >= 3) host.firstElementChild?.remove();
  host.append(notice);
}
