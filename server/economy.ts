import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { openAccountStore } from './account-store';
import { SKINS, COSMETICS, DEFAULT_ITEMS, DEFAULT_LOADOUT, type ProfileView, type RewardView, type SkinId } from '../shared/economy';

interface Account extends ProfileView { economyVersion?: number; legacyDemoBalance?: number; legacyDemoEarned?: number; receipt?: string; id: string; tokenHash: string; rounds: string[]; completedRounds: string[]; day: string; earnedToday: number; publicName?: string; syncPending?: boolean; }
const directory = resolve(process.env.FRAGMENT_DATA_DIR || '.data');
const file = join(directory, 'profiles.json');
const accounts = new Map<string, Account>();
let committedAccounts = new Map<string, Account>();
const store = await openAccountStore(file);
export const durableAccounts = store.durable;
export const closeAccountStore = () => store.close();
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const profileListeners = new Set<(id: string) => void>();
{
  const saved = await store.load() as (Account & {token?: string})[];
  let migrated = false;
  const retiredEmotes: Record<string, number> = { 'emote-think': 0, 'emote-wave': 0, 'emote-wow': 15, 'emote-laugh': 20, 'emote-love': 25 };
  for (const account of saved) {
    if (account.token) { account.tokenHash = hashToken(account.token); delete account.token; migrated = true; }
    if (account.economyVersion !== 2) {
      account.legacyDemoBalance = account.balance;
      account.legacyDemoEarned = account.totalSignalEarned;
      account.balance = 0; account.totalSignalEarned = 0; account.earnedToday = 0; account.day = ''; account.rounds = [];
      account.economyVersion = 2; migrated = true;
    }
    const retired = [...new Set(account.items ?? [])].filter(id => Object.hasOwn(retiredEmotes, id));
    if (retired.length) {
      account.legacyDemoBalance = (account.legacyDemoBalance ?? 0) + retired.reduce((sum, id) => sum + retiredEmotes[id], 0);
      migrated = true;
    }
    account.items = [...new Set([...DEFAULT_ITEMS, ...(account.items ?? []).filter(id => COSMETICS.some(i => i.id === id))])];
    account.loadout = { ...DEFAULT_LOADOUT, ...account.loadout };
    account.gamesPlayed ??= account.wins ?? 0;
    account.fastestSeconds ??= null;
    account.totalSignalEarned ??= 0;
    account.completedRounds ??= [...account.rounds];
    for (const [slot, id] of Object.entries(account.loadout)) {
      if (!COSMETICS.some(i => i.id === id && i.category === slot) || !account.items.includes(id)) delete account.loadout[slot as keyof typeof account.loadout];
    }
    accounts.set(account.id, account);
  }
  if (migrated || store.durable) await persist();
  committedAccounts = new Map([...accounts].map(([id,a])=>[id,structuredClone(a)]));
}
function persist() { return store.save([...accounts.values()]); }
let writes = Promise.resolve();
async function transaction<T>(fn: () => T): Promise<T> {
  const previousWrite = writes;
  let release!: () => void;
  writes = new Promise<void>(resolve => { release = resolve; });
  await previousWrite;
  const previous = new Map([...accounts].map(([id,a]) => [id,structuredClone(a)]));
  try {
    const result = fn();
    await persist();
    committedAccounts = new Map([...accounts].map(([id,a])=>[id,structuredClone(a)]));
    for (const [id,a] of accounts) if (JSON.stringify(a) !== JSON.stringify(previous.get(id))) {
      for (const listener of profileListeners) { try { listener(id); } catch { /* committed state is authoritative */ } }
    }
    return result;
  } catch (error) { accounts.clear(); for (const [id,a] of previous) accounts.set(id,a); throw error; }
  finally { release(); }
}
function newAccount(token = randomBytes(32).toString('hex')) {
  const account: Account = { id: randomUUID(), tokenHash: hashToken(token), balance: 0, owned: ['classic'], equipped: 'classic', items: [...DEFAULT_ITEMS], loadout: { ...DEFAULT_LOADOUT }, wins: 0, gamesPlayed: 0, fastestSeconds: null, totalSignalEarned: 0, completedRounds: [], rounds: [], day: '', earnedToday: 0 };
  account.economyVersion = 2;
  accounts.set(account.id, account);
  return {account,token};
}
export function identify(token?: string) { return transaction(() => {
  const known = typeof token === 'string' ? [...accounts.values()].find(a => a.tokenHash === hashToken(token)) : undefined;
  if (known) return {...known,token:token!};
  const created = newAccount(); return {...created.account,token:created.token};
}); }
function change<T>(id: string, fn: (account: Account) => T) { return transaction(() => {
  const account = accounts.get(id); if (!account) throw new Error('Profile not connected / Профиль не подключён');
  return fn(account);
}); }
export function profile(id: string): ProfileView {
  const a = committedAccounts.get(id)!;
  return { matchmakingBlockedUntil: a.matchmakingBlockedUntil, nickname: a.nickname, platform: a.platform, balance: a.balance, owned: [...a.owned], equipped: a.equipped, wins: a.wins, gamesPlayed: a.gamesPlayed, fastestSeconds: a.fastestSeconds, totalSignalEarned: a.totalSignalEarned, wallet: a.wallet, items: [...a.items], loadout: { ...a.loadout } };
}
export function recordMatch(id: string, round: string, won: boolean, seconds: number, name: string, practice: boolean) {
  return change(id, a => {
    if (a.completedRounds.includes(round)) return;
    a.completedRounds.push(round);
    a.gamesPlayed++;
    if (won) a.wins++;
    a.publicName = a.nickname || name.trim().slice(0, 16);
    if (won && !practice && seconds > 0 && (a.fastestSeconds === null || seconds < a.fastestSeconds)) a.fastestSeconds = seconds;
    if (a.platform) a.syncPending = true;
  });
}
export type LadderMetric = 'speed' | 'signal' | 'games';
export function leaderboard(metric: LadderMetric) {
  return [...committedAccounts.values()]
    .filter((a) => (a.wallet || a.platform) && (metric === 'speed' ? a.fastestSeconds !== null : metric === 'signal' ? a.totalSignalEarned > 0 : a.gamesPlayed > 0))
    .sort((a, b) => metric === 'speed' ? (a.fastestSeconds ?? Infinity) - (b.fastestSeconds ?? Infinity) : metric === 'signal' ? b.totalSignalEarned - a.totalSignalEarned : b.gamesPlayed - a.gamesPlayed)
    .slice(0, 20)
    .map((a) => ({ name: a.nickname || a.publicName || 'Player', wallet: a.wallet ? `${a.wallet.slice(0, 4)}…${a.wallet.slice(-4)}` : 'iDos', value: metric === 'speed' ? a.fastestSeconds! : metric === 'signal' ? a.totalSignalEarned : a.gamesPlayed }));
}
export function walletAccount(address: string) {
  return [...committedAccounts.values()].find((a) => a.wallet === address);
}
export function bindWallet(id: string, address: string) {
  return change(id, a => {
  const existing = [...accounts.values()].find(a => a.wallet === address);
  if (existing && existing.id !== id) throw new Error('Wallet already linked / Кошелёк уже привязан');
  if (a.wallet && a.wallet !== address) throw new Error('Profile already has a wallet / У профиля уже есть кошелёк');
  a.wallet = address;
  return a;
  });
}
export function restoreWalletProfile(address: string) { return transaction(() => {
  const account = [...accounts.values()].find(a => a.wallet === address); if (!account) throw new Error('Profile not found');
  const token = randomBytes(32).toString('hex'); account.tokenHash = hashToken(token);
  return {id:account.id,token};
}); }
export function buy(id: string, skinId: string) {
  return change(id, a => {
  if (a.platform) throw new Error('Use iDos for platform inventory / Используйте инвентарь iDos');
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) throw new Error('Unknown skin / Неизвестный скин');
  if (a.owned.includes(skin.id)) return;
  if (a.balance < skin.price) throw new Error('Not enough Signals / Недостаточно Сигналов');
  a.balance -= skin.price; a.owned.push(skin.id);
  });
}
export function equip(id: string, skin: string) {
  return change(id, a => {
  if (a.platform) throw new Error('Use iDos for platform inventory / Используйте инвентарь iDos');
  if (!a.owned.includes(skin as SkinId)) throw new Error('Skin is not owned / Скин не куплен');
  a.equipped = skin as SkinId;
  });
}
export function reward(id: string, round: string, practice: boolean, won = true): Promise<RewardView> {
  return change(id, a => {
  if (practice || (a.platform && !a.platform.ready)) return { amount: 0, balance: a.balance }; 
  if (a.rounds.includes(round)) return { amount: 0, balance: a.balance, receipt: a.platform ? a.receipt : undefined };
    const day = new Date().toISOString().slice(0, 10);
    if (a.day !== day) { a.day = day; a.earnedToday = 0; }
    const amount = Math.max(0, Math.min(won ? 10 : 3, 50 - a.earnedToday));
    if (!a.platform) a.balance += amount;
    a.totalSignalEarned += amount;
    a.earnedToday += amount;
    a.rounds.push(round);
    if (a.platform) a.syncPending = true;
    return { amount: a.platform ? 0 : amount, balance: a.balance, receipt: a.platform ? a.receipt : undefined };
  });
}

export function buyItem(id: string, itemId: string) {
  return change(id, a => {
  if (a.platform) throw new Error('Use iDos for platform inventory / Используйте инвентарь iDos');
  const item = COSMETICS.find(i => i.id === itemId);
  if (!item) throw new Error('Unknown item / Неизвестный предмет');
  if (a.items.includes(itemId)) return;
  if (a.balance < item.price) throw new Error('Not enough Signals / Недостаточно Сигналов');
  a.balance -= item.price; a.items.push(itemId);
  });
}
export function equipItem(id: string, itemId: string) {
  return change(id, a => {
  if (a.platform) throw new Error('Use iDos for platform inventory / Используйте инвентарь iDos');
  const item = COSMETICS.find(i => i.id === itemId);
  if (!item || !a.items.includes(itemId)) throw new Error('Item is not owned / Предмет не куплен');
  a.loadout[item.category as keyof typeof a.loadout] = itemId;
  });
}

export function syncPlatform(userId: string, state: Pick<ProfileView, 'owned' | 'items' | 'equipped' | 'loadout'> & { nickname?: string; earnedToday?: number; stats?: { wins: number; gamesPlayed: number; fastestSeconds: number | null; totalSignalsEarned: number } }, balance: string, ready: boolean) {
  return transaction(() => {
  let a = [...accounts.values()].find(a => a.platform?.userId === userId);
  if (!a) { a = newAccount().account; a.platform = { userId, balance, ready }; a.receipt = randomBytes(32).toString('hex'); }
  const account = a;
  Object.assign(account, { owned: state.owned, items: state.items, equipped: state.equipped, loadout: state.loadout });
    if (state.nickname) { account.nickname = state.nickname; account.publicName = state.nickname; }
    const day = new Date().toISOString().slice(0,10);
    if (account.day !== day) { account.day = day; account.earnedToday = 0; }
    account.earnedToday = Math.max(account.earnedToday, state.earnedToday ?? 0);
    if (state.stats) { account.wins = Math.max(account.wins,state.stats.wins); account.gamesPlayed = Math.max(account.gamesPlayed,state.stats.gamesPlayed); account.totalSignalEarned = Math.max(account.totalSignalEarned,(state.stats.totalSignalsEarned ?? 0)); if (state.stats.fastestSeconds !== null) account.fastestSeconds = Math.min(account.fastestSeconds ?? Infinity,state.stats.fastestSeconds); }
    account.platform = { userId, balance, ready }; account.balance = Number(balance);
  return account;
  });
}
export function platformSyncState(id: string) {
  const a = committedAccounts.get(id);
  return a?.platform && a.receipt ? {receipt:a.receipt,pending:Boolean(a.syncPending)} : null;
}
export function platformSyncComplete(id: string, gamesPlayed: number, totalSignalEarned: number) {
  return change(id, a => { if (a.gamesPlayed === gamesPlayed && a.totalSignalEarned === totalSignalEarned) a.syncPending = false; });
}
export function platformReceipt(key: string) {
  const a = [...committedAccounts.values()].find(a => a.platform && a.receipt === key);
  if (!a) return null;
  const day = new Date().toISOString().slice(0,10);
  return { userId: a.platform!.userId, ready: a.platform!.ready, day, earned: a.day === day ? a.earnedToday : 0,
    wins: a.wins, gamesPlayed: a.gamesPlayed, fastestSeconds: a.fastestSeconds, totalSignalsEarned: a.totalSignalEarned };
}

export function setNickname(id: string, value: string) {
  if (typeof value !== 'string') throw new Error('Invalid nickname / Неверный ник');
  const nickname = value.trim().normalize('NFC');
  if (!nickname || nickname.length > 16 || /[\u0000-\u001f\u007f]/u.test(nickname)) throw new Error('Use 1–16 characters / Введите от 1 до 16 символов');
  return change(id, a => {
    if (!a.platform && !a.wallet) throw new Error('Sign in first / Сначала войдите в аккаунт');
    a.nickname = nickname; a.publicName = nickname;
    return nickname;
  });
}

export function penalizeMatchLeave(id: string, now = Date.now()) {
  return change(id, a => { a.matchmakingBlockedUntil = now + 5 * 60_000; });
}
export function matchLeaveRemaining(id: string, now = Date.now()) {
  return Math.max(0, (committedAccounts.get(id)?.matchmakingBlockedUntil ?? 0) - now);
}
