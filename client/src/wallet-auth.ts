import type { ClientMessage, ServerMessage } from '../../shared/protocol';
import { lang } from './i18n';

interface Provider {
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey?: { toString(): string } }>;
  signMessage(message: Uint8Array, encoding?: string): Promise<Uint8Array | { signature: Uint8Array }>;
}
let provider: Provider | null = null;
let address = '';
let busy = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let send: (message: ClientMessage) => void;
let notice: (message: string, error?: boolean) => void;
const local = (ru: string, en: string) => lang === 'ru' ? ru : en;
function finish() { busy = false; clearTimeout(timer); window.dispatchEvent(new Event('fragment:wallet-status')); }
export function walletBusy() { return busy; }
export function initWalletAuth(sender: typeof send, notify: typeof notice) { send = sender; notice = notify; }
export async function connectWallet() {
  if (busy) return;
  const wallets = window as unknown as { phantom?: { solana?: Provider }; solflare?: Provider; backpack?: Provider };
  provider = wallets.phantom?.solana ?? wallets.solflare ?? wallets.backpack ?? null;
  if (!provider?.signMessage) {
    notice(local('Нужен кошелёк Phantom, Solflare или Backpack с поддержкой подписи сообщений.', 'Use Phantom, Solflare or Backpack with message signing.'), true);
    return;
  }
  busy = true;
  window.dispatchEvent(new Event('fragment:wallet-status'));
  timer = setTimeout(() => { finish(); notice(local('Время ожидания подписи истекло. Попробуйте снова.', 'Signature request timed out. Try again.'), true); }, 120_000);
  try {
    const result = await provider.connect();
    address = (result.publicKey ?? provider.publicKey)?.toString() ?? '';
    send({ t: 'wallet_challenge', address });
  } catch {
    finish();
    notice(local('Подключение отменено. Гостевой профиль сохранён.', 'Connection cancelled. Your guest profile is unchanged.'), true);
  }
}
export async function handleWalletMessage(message: ServerMessage) {
  if (message.t === 'wallet_challenge') {
    if (!busy || !provider || message.address !== address) return;
    try {
      const signed = await provider.signMessage(new TextEncoder().encode(message.message), 'utf8');
      if (!busy) return;
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      send({ t: 'wallet_proof', signature: Array.from(signature).map((byte) => byte.toString(16).padStart(2, '0')).join('') });
    } catch {
      send({ t: 'wallet_use', accept: false });
      finish();
      notice(local('Подпись отменена. Гостевой профиль сохранён.', 'Signature cancelled. Your guest profile is unchanged.'), true);
    }
  } else if (message.t === 'wallet_conflict') {
    const accept = confirm(local(
      `У кошелька уже есть профиль: ${message.profile.balance} Сигнала, предметов: ${message.profile.owned.length}. Перейти в него? Прогресс текущего гостевого профиля не объединяется. Отмена сохранит текущий профиль.`,
      `This wallet has a profile: ${message.profile.balance} Signal and ${message.profile.owned.length} items. Restore it? Current guest progress will not be merged. Cancel keeps the current profile.`,
    ));
    send({ t: 'wallet_use', accept });
    if (!accept) finish();
  } else if (message.t === 'wallet_verified') {
    finish();
    notice(message.restored ? local('Профиль восстановлен через кошелёк.', 'Wallet profile restored.') : local('Кошелёк привязан. Баланс и скины сохранены.', 'Wallet linked. Balance and skins are saved.'));
  } else if (message.t === 'error' && busy) finish();
}
