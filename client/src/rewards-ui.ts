import { RATING_REWARD_STEP, RATING_REWARD_SIGNALS, PLATFORM_RATING_TIERS, type ProfileView } from '../../shared/economy';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';
import { lang } from './i18n';

let profile: ProfileView | null = null;
let send: (message: ClientMessage) => void;
let trigger: HTMLButtonElement;
let dialog: HTMLDialogElement;
let pending = false;
let feedback = '';
const text = (ru: string, en: string) => lang === 'ru' ? ru : en;

export function initRewardsUI(sender: typeof send) {
  send = sender;
  trigger = document.createElement('button');
  trigger.className = 'rewards-launcher';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.onclick = () => { feedback = ''; render(); dialog.showModal(); };
  dialog = document.createElement('dialog');
  dialog.className = 'profile-dialog rewards-dialog';
  dialog.setAttribute('aria-labelledby', 'rewards-title');
  document.body.append(dialog);
  dialog.addEventListener('close', () => trigger.focus());
  window.addEventListener('fragment:language', () => { placeRewardsButton(); if (dialog.open) render(); });
}

export function placeRewardsButton() {
  const slot = document.querySelector('.home-account');
  if (!slot) { trigger?.remove(); if (dialog?.open) dialog.close(); return; }
  if (trigger.parentElement !== slot) slot.append(trigger);
  const available = Math.max(0, Math.floor((profile?.botRatingPeak ?? 0) / RATING_REWARD_STEP) - (profile?.botRewardClaimed ?? 0));
  trigger.textContent = text('Награды', 'Rewards') + (available ? ` · ${available}` : '');
}

export function handleRewardsMessage(message: ServerMessage) {
  if (message.t === 'profile') { profile = message.profile; placeRewardsButton(); }
  if (message.t === 'rating_reward') {
    pending = false;
    feedback = message.amount ? text(`Получено ${message.amount} Сигналов`, `${message.amount} Signals received`) : text('Эта награда уже получена', 'Already claimed');
  }
  if (message.t === 'error' && pending) { pending = false; feedback = lang === 'ru' && message.ru ? message.ru : message.message; }
  if (dialog?.open) render();
}

function render() {
  const peak = profile?.botRatingPeak ?? 0, claimed = profile?.botRewardClaimed ?? 0;
  const authenticated = Boolean(profile?.wallet || profile?.platform);
  const available = authenticated && (!profile?.platform || profile.signalsLocal || profile.ratingRewardsReady);
  dialog.replaceChildren();
  const header = document.createElement('div'); header.className = 'settings-heading';
  const title = document.createElement('h2'); title.id = 'rewards-title'; title.textContent = text('Награды за рейтинг', 'Rating rewards');
  const close = document.createElement('button'); close.textContent = text('Закрыть', 'Close'); close.onclick = () => dialog.close();
  header.append(title, close); dialog.append(header);
  const info = document.createElement('p'); info.className = 'fine';
  info.textContent = text('Каждые новые 200 рейтинга с ботами дают 200 Сигналов. Каждый порог можно забрать один раз. Падение рейтинга не отменяет достигнутый порог.', 'Every new 200 bot rating unlocks 200 Signals. Each milestone can be claimed once. A rating drop does not remove an unlocked milestone.');
  dialog.append(info);
  const summary = document.createElement('div'); summary.className = 'profile-stats';
  for (const [value, label] of [[profile?.botPoints ?? 0, text('Текущий рейтинг', 'Current rating')], [peak, text('Лучший рейтинг', 'Best rating')], [profile?.balance ?? 0, text('Доступно Сигналов', 'Available Signals')]]) {
    const card = document.createElement('div'), number = document.createElement('b'), caption = document.createElement('span');
    number.textContent = String(value); caption.textContent = String(label); card.append(number, caption); summary.append(card);
  }
  dialog.append(summary);
  if (profile?.signalsSyncPending) {
    const confirmation = document.createElement('p'); confirmation.className = 'fine'; confirmation.setAttribute('role', 'status');
    confirmation.textContent = text('Расчёт ставки ожидает подтверждения iDos. Повторно платить не нужно.', 'Stake settlement is awaiting iDos confirmation. No repeat payment is needed.') + (profile.pendingSignals ? text(` К зачислению: ${profile.pendingSignals} SI.`, ` Pending credit: ${profile.pendingSignals} SI.`) : '');
    dialog.append(confirmation);
  }
  const list = document.createElement('div'); list.className = 'rating-rewards';
  for (let tier = claimed + 1; tier <= Math.min(claimed + 4, PLATFORM_RATING_TIERS); tier++) {
    const row = document.createElement('div'); row.className = 'rating-reward';
    const detail = document.createElement('div'), name = document.createElement('strong'), progress = document.createElement('progress');
    name.textContent = text(`${tier * RATING_REWARD_STEP} рейтинга`, `${tier * RATING_REWARD_STEP} rating`);
    progress.max = RATING_REWARD_STEP; progress.value = Math.max(0, Math.min(RATING_REWARD_STEP, peak - (tier - 1) * RATING_REWARD_STEP));
    progress.setAttribute('aria-label', name.textContent); detail.append(name, progress);
    const claim = document.createElement('button'); claim.dataset.tier = String(tier);
    claim.disabled = !available || pending || tier !== claimed + 1 || peak < tier * RATING_REWARD_STEP;
    claim.textContent = peak >= tier * RATING_REWARD_STEP ? text(`Забрать ${RATING_REWARD_SIGNALS} Сигналов`, `Claim ${RATING_REWARD_SIGNALS} Signals`) : text(`${RATING_REWARD_SIGNALS} Сигналов`, `${RATING_REWARD_SIGNALS} Signals`);
    claim.onclick = () => { pending = true; feedback = ''; send({ t: 'claim_rating_reward', tier }); render(); };
    row.append(detail, claim); list.append(row);
  }
  dialog.append(list);
  if (profile?.lastStakeResult) {
    const result = profile.lastStakeResult;
    const receipt = document.createElement('p');
    receipt.textContent = text(`Последний расчёт ставки: поставлено ${result.stake}, возвращено ${result.payout}, из них ${result.bonus} из ставок выбывших.`, `Last stake settlement: staked ${result.stake}, returned ${result.payout}, including ${result.bonus} from eliminated players.`);
    dialog.append(receipt);
  }
  const note = document.createElement('p'); note.className = 'fine';
  note.textContent = !authenticated ? text('Войдите через iDos или подтвердите кошелёк, чтобы получать Сигналы.', 'Sign in with iDos or verify your wallet to claim Signals.') : profile?.signalsLocal ? text('Локальный баланс. Живой баланс iDos не изменяется.', 'Local balance. The live iDos balance is unchanged.') : !available ? text('Новые награды iDos ожидают публикации расчётов.', 'New iDos rewards await settlement activation.') : '';
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = feedback;
  dialog.append(note, status);
}
