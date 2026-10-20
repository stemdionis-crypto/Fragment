import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { openAccountStore } from './account-store';
import { SKINS, COSMETICS, DEFAULT_ITEMS, DEFAULT_LOADOUT, RATING_REWARD_STEP, RATING_REWARD_SIGNALS, PLATFORM_RATING_TIERS, type ProfileView, type RewardView, type SkinId } from '../shared/economy';

interface Stake { amount: number; status: 'reserved' | 'active' | 'lost' | 'settled' | 'refunded'; }
interface Account extends ProfileView { localSignalsBalance?: number; stakes?: Record<string, Stake>; economyVersion?: number; legacyDemoBalance?: number; legacyDemoEarned?: number; receipt?: string; id: string; tokenHash: string; rounds: string[]; completedRounds: string[]; day: string; earnedToday: number; publicName?: string; syncPending?: boolean; }
const LOCAL_SIGNALS = process.env.FRAGMENT_LOCAL_PREVIEW === 'true' && !process.argv.includes('--prod');
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
    account.botPoints ??= 0;
    if (account.botPoints < 0) { account.botPoints = 0; migrated = true; }
    account.botGamesPlayed ??= 0;
    account.botRatingPeak = Math.max(account.botRatingPeak ?? 0, account.botPoints);
    account.botRewardClaimed ??= 0;
    // Rooms are in memory. An unfinished match is void after a server restart.
    for (const stake of Object.values(account.stakes ?? {})) {
      if (!['reserved', 'active', 'lost'].includes(stake.status)) continue;
      if (account.localSignalsBalance !== undefined && account.platform) account.localSignalsBalance += stake.amount;
      else account.balance += stake.amount;
      stake.status = 'refunded'; migrated = true;
    }
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
  return { matchmakingBlockedUntil: a.matchmakingBlockedUntil, botRatingPeak: a.botRatingPeak ?? a.botPoints ?? 0, botRewardClaimed: a.botRewardClaimed ?? 0, reservedSignals: Object.values(a.stakes ?? {}).filter(s => s.status === 'reserved' || s.status === 'active').reduce((n, s) => n + s.amount, 0), signalsLocal: LOCAL_SIGNALS, ratingRewardsReady: Boolean(a.platform?.ready), lastStakeResult: a.lastStakeResult, botPoints: a.botPoints ?? 0, botGamesPlayed: a.botGamesPlayed ?? 0, nickname: a.nickname, platform: a.platform, balance: signalsBalance(a), owned: [...a.owned], equipped: a.equipped, wins: a.wins, gamesPlayed: a.gamesPlayed, fastestSeconds: a.fastestSeconds, totalSignalEarned: a.totalSignalEarned, wallet: a.wallet, items: [...a.items], loadout: { ...a.loadout } };
}
export function recordMatch(id: string, round: string, won: boolean, seconds: number, name: string, practice: boolean, botMatch = false) {
  return change(id, a => {
    if (a.completedRounds.includes(round)) return;
    a.completedRounds.push(round);
    a.gamesPlayed++;
    if (won) a.wins++;
    if (botMatch) {
      a.botPoints = Math.max(0, (a.botPoints ?? 0) + (won ? 10 : -10));
      a.botGamesPlayed = (a.botGamesPlayed ?? 0) + 1;
      a.botRatingPeak = Math.max(a.botRatingPeak ?? 0, a.botPoints);
    }
    a.publicName = a.nickname || name.trim().slice(0, 16);
    if (won && !practice && seconds > 0 && (a.fastestSeconds === null || seconds < a.fastestSeconds)) a.fastestSeconds = seconds;
    if (a.platform) a.syncPending = true;
  });
}
export type LadderMetric = import('../shared/protocol').LadderMetric;

function signalsBalance(a: Account) {
  return LOCAL_SIGNALS && a.platform ? a.localSignalsBalance ?? a.balance : a.balance;
}
function requireSignals(a: Account) {
  if (!a.wallet && !a.platform) throw new Error('Sign in first / Войдите через iDos или подтвердите кошелёк');
  if (a.platform && !LOCAL_SIGNALS) throw new Error('iDos settlement is not published / Расчёты iDos для новых наград и ставок ещё не опубликованы');
}
function adjustSignals(a: Account, delta: number) {
  const balance = signalsBalance(a) + delta;
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Not enough Signals / Недостаточно Сигналов');
  if (LOCAL_SIGNALS && a.platform) a.localSignalsBalance = balance;
  else a.balance = balance;
}
export function claimRatingReward(id: string, tier: number) {
  return change(id, a => {
    requireSignals(a);
    const claimed = a.botRewardClaimed ?? 0;
    if (!Number.isSafeInteger(tier) || tier < 1) throw new Error('Invalid reward / Неверная награда');
    if (tier <= claimed) return { amount: 0, tier };
    if (tier !== claimed + 1 || tier > Math.floor((a.botRatingPeak ?? 0) / RATING_REWARD_STEP)) throw new Error('Reward is locked / Порог рейтинга ещё не достигнут');
    adjustSignals(a, RATING_REWARD_SIGNALS);
    a.botRewardClaimed = tier;
    a.totalSignalEarned += RATING_REWARD_SIGNALS;
    return { amount: RATING_REWARD_SIGNALS, tier };
  });
}
export function validatePlatformRatingReward(id: string, tier: number) {
  const a = committedAccounts.get(id);
  if (!a?.platform?.ready) throw new Error('Sign in to iDos / Войдите в iDos');
  if (!Number.isSafeInteger(tier) || tier < 1 || tier > PLATFORM_RATING_TIERS) throw new Error('Invalid reward / Неверная награда');
  const claimed = a.botRewardClaimed ?? 0;
  if (tier > claimed && (tier !== claimed + 1 || tier * RATING_REWARD_STEP > (a.botRatingPeak ?? 0))) throw new Error('Reward is locked / Порог рейтинга ещё не достигнут');
  return { alreadyClaimed: tier <= claimed, receipt: a.receipt! };
}
export function confirmPlatformRatingReward(id: string, tier: number, balance: number) {
  return change(id, a => {
    validatePlatformRatingReward(id, tier);
    if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Invalid iDos balance');
    const amount = tier > (a.botRewardClaimed ?? 0) ? RATING_REWARD_SIGNALS : 0;
    a.botRewardClaimed = Math.max(a.botRewardClaimed ?? 0, tier);
    a.balance = balance; a.platform!.balance = String(balance);
    a.totalSignalEarned += amount; a.syncPending = true;
    return { amount, tier };
  });
}
export function reserveStake(id: string, key: string, amount: number) {
  return change(id, a => {
    requireSignals(a);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000) throw new Error('Invalid stake / Ставка должна быть целым числом от 0 до 1000000');
    const old = a.stakes?.[key];
    if (old && !['reserved', 'refunded'].includes(old.status)) throw new Error('Stake is locked / Ставка уже зафиксирована');
    adjustSignals(a, (old?.status === 'reserved' ? old.amount : 0) - amount);
    a.stakes ??= {};
    a.stakes[key] = { amount, status: amount ? 'reserved' : 'refunded' };
  });
}
export function activateStakes(key: string, entries: { id: string; amount: number }[]) {
  return transaction(() => {
    if (new Set(entries.map(e => e.id)).size !== entries.length) throw new Error('Duplicate stake account');
    for (const entry of entries) {
      const a = accounts.get(entry.id);
      if (!a) throw new Error('Profile not found');
      requireSignals(a);
      const stake = a.stakes?.[key];
      if (!stake || stake.status !== 'reserved' || stake.amount !== entry.amount) throw new Error('Reserve your stake again / Подтвердите ставку заново');
    }
    for (const entry of entries) accounts.get(entry.id)!.stakes![key].status = 'active';
  });
}
export function refundStakes(key: string, id?: string) {
  return transaction(() => {
    for (const a of accounts.values()) {
      if (id && a.id !== id) continue;
      const stake = a.stakes?.[key];
      if (!stake || !['reserved', 'active'].includes(stake.status)) continue;
      adjustSignals(a, stake.amount); stake.status = 'refunded';
    }
  });
}
export function forfeitStake(id: string, key: string) {
  return change(id, a => {
    const stake = a.stakes?.[key];
    if (stake?.status === 'active') stake.status = 'lost';
  });
}
export function settleStakes(key: string, winnerIds: string[]) {
  return transaction(() => {
    const rows = [...accounts.values()].filter(a => ['active', 'lost'].includes(a.stakes?.[key]?.status ?? ''));
    const winners = rows.filter(a => a.stakes![key].status === 'active' && winnerIds.includes(a.id));
    const pool = rows.filter(a => !winners.includes(a)).reduce((n, a) => n + a.stakes![key].amount, 0);
    const total = winners.reduce((n, a) => n + a.stakes![key].amount, 0);
    const shares = winners.map(a => ({ a, share: total ? Math.floor(pool * a.stakes![key].amount / total) : 0, remainder: total ? pool * a.stakes![key].amount % total : 0 }));
    shares.sort((a, b) => b.remainder - a.remainder || a.a.id.localeCompare(b.a.id));
    let left = pool - shares.reduce((n, share) => n + share.share, 0);
    for (const share of shares) if (left > 0) { share.share++; left--; }
    for (const a of rows) {
      const stake = a.stakes![key];
      const share = shares.find(share => share.a === a);
      const payout = share ? stake.amount * 2 + share.share : 0;
      adjustSignals(a, payout);
      a.lastStakeResult = { stake: stake.amount, payout, bonus: share?.share ?? 0, won: Boolean(share) };
      stake.status = 'settled';
    }
  });
}

export function leaderboard(metric: LadderMetric) {
  if (metric === 'bots') return [...committedAccounts.values()]
    .filter(a => (a.wallet || a.platform) && (a.botGamesPlayed ?? 0) > 0)
    .sort((a, b) => (b.botPoints ?? 0) - (a.botPoints ?? 0) || (a.botGamesPlayed ?? 0) - (b.botGamesPlayed ?? 0) || a.id.localeCompare(b.id))
    .slice(0, 20)
    .map(a => ({ name: a.nickname || a.publicName || 'Player', wallet: a.wallet ? `${a.wallet.slice(0, 4)}…${a.wallet.slice(-4)}` : 'iDos', value: a.botPoints ?? 0 }));
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
    wins: a.wins, gamesPlayed: a.gamesPlayed, fastestSeconds: a.fastestSeconds, totalSignalsEarned: a.totalSignalEarned, botRatingPeak: a.botRatingPeak ?? 0 };
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
