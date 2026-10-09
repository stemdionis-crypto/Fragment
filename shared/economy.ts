// Re-enable only after publisher approval and reviewed FRAG package prices.
export const SIGNAL_TOPUPS_ENABLED = false;
export const SKINS = [
  { id: 'classic', name: { ru: 'Незнакомец', en: 'Stranger' }, price: 0, cloth: '#45464a', accent: '#aaa69d' },
  { id: 'operator', name: { ru: 'Гоблин в маске', en: 'Masked Goblin' }, price: 1000, cloth: '#394e4b', accent: '#a8b9a5' },
  { id: 'wanderer', name: { ru: 'Геймер', en: 'Gamer' }, price: 1500, cloth: '#69584b', accent: '#c9b89a' },
  { id: 'phantom', name: { ru: 'Тёмный человек', en: 'Shadow Figure' }, price: 2500, cloth: '#444b61', accent: '#a6b6c7' },
] as const;
export type SkinId = typeof SKINS[number]['id'];
export interface ProfileView { nickname?: string; platform?: { userId: string; balance: string; ready: boolean }; balance: number; owned: SkinId[]; equipped: SkinId; wins: number; gamesPlayed: number; fastestSeconds: number | null; totalSignalEarned: number; wallet?: string; items: string[]; loadout: Loadout; }
export interface RewardView { receipt?: string; amount: number; balance: number; }

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
  item('headphones', 'head', 300, 'Студийные наушники', 'Studio headphones', '🎧'),
  item('beanie', 'head', 300, 'Вязаная шапка', 'Knitted beanie', '◒'),
  item('beret', 'head', 400, 'Берет архивиста', 'Archivist beret', '◓'),
  item('face-none', 'face', 0, 'Облик скина', 'Original skin face', '◯'),
  item('mask-skull', 'face', 450, 'Костяная маска', 'Bone mask', '◈'),
  item('mask-plague', 'face', 600, 'Чумной доктор', 'Plague doctor', '◇'),
  item('mask-oni', 'face', 750, 'Маска демона', 'Demon mask', '◆'),
  item('mask-welder', 'face', 500, 'Сварочная маска', 'Welding mask', '▣'),
  item('mask-respirator', 'face', 400, 'Респиратор', 'Respirator', '◎'),
  item('glasses', 'face', 300, 'Круглые очки', 'Round glasses', '◎'),
  item('scarf', 'face', 350, 'Шарф странника', 'Traveller scarf', '〰'),
  item('table-default', 'table', 0, 'Старый стол', 'Old table', '▱'),
  item('table-walnut', 'table', 400, 'Ореховый стол', 'Walnut table', '▱'),
  item('table-studio', 'table', 600, 'Студийный пульт', 'Studio desk', '▦'),
  item('wallpaper-default', 'wallpaper', 0, 'Тёмные полосы', 'Dark stripes', '▥'),
  item('wallpaper-botanical', 'wallpaper', 400, 'Ботанический узор', 'Botanical pattern', '❧'),
  item('wallpaper-artdeco', 'wallpaper', 600, 'Геометрия эфира', 'Airwave geometry', '◇'),
  item('lighting-default', 'lighting', 0, 'Ночной свет', 'Night light', '☾'),
  item('lighting-amber', 'lighting', 300, 'Тёплый янтарь', 'Warm amber', '☀'),
  item('lighting-moon', 'lighting', 400, 'Лунный эфир', 'Moonlit airwaves', '☽'),
  item('poster-default', 'poster', 0, 'Старый портрет', 'Old portrait', '▣'),
  item('poster-signal', 'poster', 300, 'Плакат «Сигнал»', 'Signal poster', '⌁'),
  item('poster-moon', 'poster', 350, 'Лунная экспедиция', 'Moon expedition', '☽'),
  item('decor-none', 'decor', 0, 'Пустой стол', 'Clear desk', '—'),
  item('decor-lantern', 'decor', 350, 'Маленький фонарь', 'Little lantern', '♧'),
  item('decor-plant', 'decor', 300, 'Растение', 'Plant', '❧'),
  item('decor-tapes', 'decor', 300, 'Кассеты архива', 'Archive tapes', '▤'),
  item('victory-default', 'victory', 0, 'Тихая победа', 'Quiet victory', '✧'),
  item('victory-sparks', 'victory', 500, 'Искры эфира', 'Airwave sparks', '✦'),
  item('victory-rings', 'victory', 600, 'Волны сигнала', 'Signal waves', '◎'),
  item('victory-stars', 'victory', 750, 'Созвездие', 'Constellation', '⋆'),
];
export const DEFAULT_ITEMS = COSMETICS.filter(i => i.price === 0).map(i => i.id);
export const DEFAULT_LOADOUT: Loadout = Object.fromEntries(COSMETICS.filter(i => i.price === 0).map(i => [i.category, i.id]));
