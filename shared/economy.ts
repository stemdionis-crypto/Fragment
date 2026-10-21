// Publisher-approved package: 250,000 FRAG -> 1,000 Signals; prices resolved by iDos.
export const SIGNAL_TOPUPS_ENABLED = true;
export const SKINS = [
  { id: 'classic', name: { ru: 'Незнакомец', en: 'Stranger' }, price: 0, cloth: '#45464a', accent: '#aaa69d' },
  { id: 'operator', name: { ru: 'Гоблин в маске', en: 'Masked Goblin' }, price: 2000, cloth: '#394e4b', accent: '#a8b9a5' },
  { id: 'wanderer', name: { ru: 'Геймер', en: 'Gamer' }, price: 3000, cloth: '#69584b', accent: '#c9b89a' },
  { id: 'phantom', name: { ru: 'Тёмный человек', en: 'Shadow Figure' }, price: 5000, cloth: '#444b61', accent: '#a6b6c7' },
] as const;
export type SkinId = typeof SKINS[number]['id'];
export interface ProfileView { nickname?: string; platform?: { userId: string; balance: string; ready: boolean; stakesReady?: boolean }; balance: number; owned: SkinId[]; equipped: SkinId; wins: number; gamesPlayed: number; fastestSeconds: number | null; totalSignalEarned: number; wallet?: string; items: string[]; loadout: Loadout; }
export interface RewardView { receipt?: string; amount: number; balance: number; }
export interface ProfileView { matchmakingBlockedUntil?: number; }
export interface ProfileView { botPoints?: number; botGamesPlayed?: number; }
export interface StakeResult { stake: number; payout: number; bonus: number; won: boolean; }
export interface ProfileView {
  botRatingPeak?: number; botRewardClaimed?: number; reservedSignals?: number;
  signalsLocal?: boolean; signalsSyncPending?: boolean; pendingSignals?: number; ratingRewardsReady?: boolean; lastStakeResult?: StakeResult;
}
export const RATING_REWARD_STEP = 200;
export const RATING_REWARD_SIGNALS = 200;
export const PLATFORM_RATING_TIERS = 1000;

export type CosmeticSlot = 'head' | 'face' | 'table' | 'wallpaper' | 'lighting' | 'poster' | 'decor' | 'victory';
export type Loadout = Partial<Record<CosmeticSlot, string>>;
export type CosmeticCategory = CosmeticSlot;
export const CATEGORY_NAMES: Record<CosmeticCategory, { ru: string; en: string }> = {
  head: { ru: 'Головные уборы', en: 'Headwear' }, face: { ru: 'Маски и аксессуары', en: 'Masks and accessories' },
  table: { ru: 'Стол', en: 'Table' }, wallpaper: { ru: 'Обои', en: 'Wallpaper' },
  lighting: { ru: 'Освещение', en: 'Lighting' }, poster: { ru: 'Плакаты', en: 'Posters' },
  decor: { ru: 'Декор', en: 'Decor' }, victory: { ru: 'Победа', en: 'Victory' },
};
const item = (id: string, category: CosmeticCategory, price: number, ru: string, en: string, icon: string) => ({ id, category, price, name: { ru, en }, icon });
export const COSMETICS = [
  item('head-none', 'head', 0, 'Без головного убора', 'No headwear', '◯'),
  item('headphones', 'head', 600, 'Студийные наушники', 'Studio headphones', '🎧'),
  item('beanie', 'head', 600, 'Вязаная шапка', 'Knitted beanie', '◒'),
  item('beret', 'head', 800, 'Берет архивиста', 'Archivist beret', '◓'),
  item('face-none', 'face', 0, 'Облик скина', 'Original skin face', '◯'),
  item('mask-skull', 'face', 900, 'Костяная маска', 'Bone mask', '◈'),
  item('mask-plague', 'face', 1200, 'Чумной доктор', 'Plague doctor', '◇'),
  item('mask-oni', 'face', 1500, 'Маска демона', 'Demon mask', '◆'),
  item('mask-welder', 'face', 1000, 'Сварочная маска', 'Welding mask', '▣'),
  item('mask-respirator', 'face', 800, 'Респиратор', 'Respirator', '◎'),
  item('glasses', 'face', 600, 'Круглые очки', 'Round glasses', '◎'),
  item('scarf', 'face', 700, 'Шарф странника', 'Traveller scarf', '〰'),
  item('table-default', 'table', 0, 'Старый стол', 'Old table', '▱'),
  item('table-walnut', 'table', 800, 'Ореховый стол', 'Walnut table', '▱'),
  item('table-studio', 'table', 1200, 'Студийный пульт', 'Studio desk', '▦'),
  item('wallpaper-default', 'wallpaper', 0, 'Тёмные полосы', 'Dark stripes', '▥'),
  item('wallpaper-botanical', 'wallpaper', 800, 'Ботанический узор', 'Botanical pattern', '❧'),
  item('wallpaper-artdeco', 'wallpaper', 1200, 'Геометрия эфира', 'Airwave geometry', '◇'),
  item('lighting-default', 'lighting', 0, 'Ночной свет', 'Night light', '☾'),
  item('lighting-amber', 'lighting', 600, 'Тёплый янтарь', 'Warm amber', '☀'),
  item('lighting-moon', 'lighting', 800, 'Лунный эфир', 'Moonlit airwaves', '☽'),
  item('poster-default', 'poster', 0, 'Старый портрет', 'Old portrait', '▣'),
  item('poster-signal', 'poster', 600, 'Плакат «Сигнал»', 'Signal poster', '⌁'),
  item('poster-moon', 'poster', 700, 'Лунная экспедиция', 'Moon expedition', '☽'),
  item('decor-none', 'decor', 0, 'Пустой стол', 'Clear desk', '—'),
  item('decor-lantern', 'decor', 700, 'Маленький фонарь', 'Little lantern', '♧'),
  item('decor-plant', 'decor', 600, 'Растение', 'Plant', '❧'),
  item('decor-tapes', 'decor', 600, 'Кассеты архива', 'Archive tapes', '▤'),
  item('victory-default', 'victory', 0, 'Тихая победа', 'Quiet victory', '✧'),
  item('victory-sparks', 'victory', 1000, 'Искры эфира', 'Airwave sparks', '✦'),
  item('victory-rings', 'victory', 1200, 'Волны сигнала', 'Signal waves', '◎'),
  item('victory-stars', 'victory', 1500, 'Созвездие', 'Constellation', '⋆'),
];
export const DEFAULT_ITEMS = COSMETICS.filter(i => i.price === 0).map(i => i.id);
export const DEFAULT_LOADOUT: Loadout = Object.fromEntries(COSMETICS.filter(i => i.price === 0).map(i => [i.category, i.id]));
