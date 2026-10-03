import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SKINS, type ProfileView, type RewardView, type SkinId } from '../shared/economy';

interface Account extends ProfileView { id: string; token: string; rounds: string[]; day: string; earnedToday: number; }
const directory = resolve(process.env.FRAGMENT_DATA_DIR || '.data');
const file = join(directory, 'profiles.json');
const accounts = new Map<string, Account>();
export const profileListeners = new Set<(id: string) => void>();
if (existsSync(file)) {
  const saved = JSON.parse(readFileSync(file, 'utf8')) as Account[];
  for (const account of saved) accounts.set(account.id, account);
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
  const account: Account = { id: randomUUID(), token: randomBytes(32).toString('hex'), balance: 0, owned: ['classic'], equipped: 'classic', wins: 0, rounds: [], day: '', earnedToday: 0 };
  accounts.set(account.id, account);
  try { persist(); } catch (error) { accounts.delete(account.id); throw error; }
  return account;
}
export function profile(id: string): ProfileView {
  const a = accounts.get(id)!;
  return { balance: a.balance, owned: [...a.owned], equipped: a.equipped, wins: a.wins, wallet: a.wallet };
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
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) throw new Error('Unknown skin / Неизвестный скин');
  if (a.owned.includes(skin.id)) return;
  if (a.balance < skin.price) throw new Error('Not enough Signal / Недостаточно Сигнала');
  change(a, () => { a.balance -= skin.price; a.owned.push(skin.id); });
}
export function equip(id: string, skin: string) {
  const a = accounts.get(id)!;
  if (!a.owned.includes(skin as SkinId)) throw new Error('Skin is not owned / Скин не куплен');
  change(a, () => { a.equipped = skin as SkinId; });
}
export function reward(id: string, round: string, practice: boolean): RewardView {
  const a = accounts.get(id)!;
  if (a.rounds.includes(round)) return { amount: 0, balance: a.balance };
  return change(a, () => {
    const day = new Date().toISOString().slice(0, 10);
    if (a.day !== day) { a.day = day; a.earnedToday = 0; }
    const amount = Math.max(0, Math.min(practice ? 10 : 25, 100 - a.earnedToday));
    a.balance += amount;
    a.earnedToday += amount;
    a.wins++;
    a.rounds.push(round);
    return { amount, balance: a.balance };
  });
}
