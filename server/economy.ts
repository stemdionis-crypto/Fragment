import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SKINS, COSMETICS, DEFAULT_ITEMS, DEFAULT_LOADOUT, type ProfileView, type RewardView, type SkinId } from '../shared/economy';

interface Account extends ProfileView { receipt?: string; id: string; token: string; rounds: string[]; completedRounds: string[]; day: string; earnedToday: number; publicName?: string; }
const directory = resolve(process.env.FRAGMENT_DATA_DIR || '.data');
const file = join(directory, 'profiles.json');
const accounts = new Map<string, Account>();
export const profileListeners = new Set<(id: string) => void>();
if (existsSync(file)) {
  const saved = JSON.parse(readFileSync(file, 'utf8')) as Account[];
  let migrated = false;
  const retiredEmotes: Record<string, number> = { 'emote-think': 0, 'emote-wave': 0, 'emote-wow': 15, 'emote-laugh': 20, 'emote-love': 25 };
  for (const account of saved) {
    const retired = [...new Set(account.items ?? [])].filter(id => Object.hasOwn(retiredEmotes, id));
    if (retired.length) {
      account.balance += retired.reduce((sum, id) => sum + retiredEmotes[id], 0);
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
  if (migrated) persist();
}
function persist() {
  mkdirSync(directory, { recursive: true });
  writeFileSync(file + '.tmp', JSON.stringify([...accounts.values()]), { mode: 0o600 });
  renameSync(file + '.tmp', file);
}
function change<T>(account: Account, fn: () => T): T {
  const previous = structuredClone(account);
  try { const result = fn(); persist(); for (const listener of profileListeners) listener(account.id); return result; }
  catch (error) { Object.assign(account, previous); throw error; }
}
export function identify(token?: string) {
  const known = typeof token === 'string' ? [...accounts.values()].find((a) => a.token === token) : undefined;
  if (known) return known;
  const account: Account = { id: randomUUID(), token: randomBytes(32).toString('hex'), balance: 0, owned: ['classic'], equipped: 'classic', items: [...DEFAULT_ITEMS], loadout: { ...DEFAULT_LOADOUT }, wins: 0, gamesPlayed: 0, fastestSeconds: null, totalSignalEarned: 0, completedRounds: [], rounds: [], day: '', earnedToday: 0 };
  accounts.set(account.id, account);
  try { persist(); } catch (error) { accounts.delete(account.id); throw error; }
  return account;
}
export function profile(id: string): ProfileView {
  const a = accounts.get(id)!;
  return { nickname: a.nickname, platform: a.platform, balance: a.balance, owned: [...a.owned], equipped: a.equipped, wins: a.wins, gamesPlayed: a.gamesPlayed, fastestSeconds: a.fastestSeconds, totalSignalEarned: a.totalSignalEarned, wallet: a.wallet, items: [...a.items], loadout: { ...a.loadout } };
}
export function recordMatch(id: string, round: string, won: boolean, seconds: number, name: string, practice: boolean) {
  const a = accounts.get(id)!;
  if (a.completedRounds.includes(round)) return;
  change(a, () => {
    a.completedRounds.push(round);
    a.gamesPlayed++;
    if (won) a.wins++;
    a.publicName = a.nickname || name.trim().slice(0, 16);
    if (won && !practice && (a.fastestSeconds === null || seconds < a.fastestSeconds)) a.fastestSeconds = seconds;
  });
}
export type LadderMetric = 'speed' | 'signal' | 'games';
export function leaderboard(metric: LadderMetric) {
  return [...accounts.values()]
    .filter((a) => a.wallet && (metric !== 'speed' || a.fastestSeconds !== null))
    .sort((a, b) => metric === 'speed' ? (a.fastestSeconds ?? Infinity) - (b.fastestSeconds ?? Infinity) : metric === 'signal' ? b.totalSignalEarned - a.totalSignalEarned : b.gamesPlayed - a.gamesPlayed)
    .slice(0, 20)
    .map((a) => ({ name: a.publicName || `${a.wallet!.slice(0, 4)}…${a.wallet!.slice(-4)}`, wallet: `${a.wallet!.slice(0, 4)}…${a.wallet!.slice(-4)}`, value: metric === 'speed' ? a.fastestSeconds! : metric === 'signal' ? a.totalSignalEarned : a.gamesPlayed }));
}
export function walletAccount(address: string) {
  return [...accounts.values()].find((a) => a.wallet === address);
}
export function bindWallet(id: string, address: string) {
  const a = accounts.get(id)!;
  const existing = walletAccount(address);
  if (existing && existing.id !== id) throw new Error('Wallet already linked / Кошелёк уже привязан');
  if (a.wallet && a.wallet !== address) throw new Error('Profile already has a wallet / У профиля уже есть кошелёк');
  change(a, () => { a.wallet = address; });
  return a;
}
export function buy(id: string, skinId: string) {
  const a = accounts.get(id)!;
  if (a.platform) throw new Error('Use iDos for platform inventory / Используйте инвентарь iDos');
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) throw new Error('Unknown skin / Неизвестный скин');
  if (a.owned.includes(skin.id)) return;
  if (a.balance < skin.price) throw new Error('Not enough FRAG / Недостаточно FRAG');
  change(a, () => { a.balance -= skin.price; a.owned.push(skin.id); });
}
export function equip(id: string, skin: string) {
  const a = accounts.get(id)!;
  if (a.platform) throw new Error('Use iDos for platform inventory / Используйте инвентарь iDos');
  if (!a.owned.includes(skin as SkinId)) throw new Error('Skin is not owned / Скин не куплен');
  change(a, () => { a.equipped = skin as SkinId; });
}
export function reward(id: string, round: string, practice: boolean): RewardView {
  const a = accounts.get(id)!;
  if (a.platform && !a.platform.ready) return { amount: 0, balance: 0 };
  if (a.rounds.includes(round)) return { amount: 0, balance: a.balance, receipt: a.platform ? a.receipt : undefined };
  return change(a, () => {
    const day = new Date().toISOString().slice(0, 10);
    if (a.day !== day) { a.day = day; a.earnedToday = 0; }
    const amount = Math.max(0, Math.min(practice ? 10 : 25, 100 - a.earnedToday));
    if (!a.platform) a.balance += amount;
    a.totalSignalEarned += amount;
    a.earnedToday += amount;
    a.rounds.push(round);
    return { amount: a.platform ? 0 : amount, balance: a.balance, receipt: a.platform ? a.receipt : undefined };
  });
}

export function buyItem(id: string, itemId: string) {
  const a = accounts.get(id)!;
  if (a.platform) throw new Error('Use iDos for platform inventory / Используйте инвентарь iDos');
  const item = COSMETICS.find(i => i.id === itemId);
  if (!item) throw new Error('Unknown item / Неизвестный предмет');
  if (a.items.includes(itemId)) return;
  if (a.balance < item.price) throw new Error('Not enough FRAG / Недостаточно FRAG');
  change(a, () => { a.balance -= item.price; a.items.push(itemId); });
}
export function equipItem(id: string, itemId: string) {
  const a = accounts.get(id)!;
  if (a.platform) throw new Error('Use iDos for platform inventory / Используйте инвентарь iDos');
  const item = COSMETICS.find(i => i.id === itemId);
  if (!item || !a.items.includes(itemId)) throw new Error('Item is not owned / Предмет не куплен');
  change(a, () => { a.loadout[item.category as keyof typeof a.loadout] = itemId; });
}

export function syncPlatform(userId: string, state: Pick<ProfileView, 'owned' | 'items' | 'equipped' | 'loadout'> & { stats?: { wins: number; gamesPlayed: number; fastestSeconds: number | null; totalEarned: number } }, balance: string, ready: boolean) {
  let a = [...accounts.values()].find(a => a.platform?.userId === userId);
  if (!a) { a = identify(); a.platform = { userId, balance, ready }; a.receipt = randomBytes(32).toString('hex'); }
  const account = a;
  change(account, () => { Object.assign(account, { owned: state.owned, items: state.items, equipped: state.equipped, loadout: state.loadout });
    if (state.stats) { account.wins = Math.max(account.wins,state.stats.wins); account.gamesPlayed = Math.max(account.gamesPlayed,state.stats.gamesPlayed); account.totalSignalEarned = Math.max(account.totalSignalEarned,state.stats.totalEarned); if (state.stats.fastestSeconds !== null) account.fastestSeconds = Math.min(account.fastestSeconds ?? Infinity,state.stats.fastestSeconds); }
    account.platform = { userId, balance, ready }; account.balance = 0; });
  return account;
}
export function platformReceipt(key: string) {
  const a = [...accounts.values()].find(a => a.platform && a.receipt === key);
  if (!a) return null;
  const day = new Date().toISOString().slice(0,10);
  return { userId: a.platform!.userId, ready: a.platform!.ready, day, earned: a.day === day ? a.earnedToday : 0,
    wins: a.wins, gamesPlayed: a.gamesPlayed, fastestSeconds: a.fastestSeconds, totalEarned: a.totalSignalEarned };
}

export function setNickname(id: string, value: string) {
  if (typeof value !== 'string') throw new Error('Invalid nickname / Неверный ник');
  const nickname = value.trim().normalize('NFC');
  if (!nickname || nickname.length > 16 || /[\u0000-\u001f\u007f]/u.test(nickname)) throw new Error('Use 1–16 characters / Введите от 1 до 16 символов');
  const a = accounts.get(id);
  if (!a || (!a.platform && !a.wallet)) throw new Error('Sign in first / Сначала войдите в аккаунт');
  change(a, () => { a.nickname = nickname; a.publicName = nickname; });
  return nickname;
}
