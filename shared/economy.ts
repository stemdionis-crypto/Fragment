export const SKINS = [
  { id: 'classic', name: { ru: 'Незнакомец', en: 'Stranger' }, price: 0, cloth: '#45464a', accent: '#aaa69d' },
  { id: 'operator', name: { ru: 'Оператор', en: 'Operator' }, price: 20, cloth: '#394e4b', accent: '#a8b9a5' },
  { id: 'wanderer', name: { ru: 'Странник', en: 'Wanderer' }, price: 60, cloth: '#69584b', accent: '#c9b89a' },
  { id: 'phantom', name: { ru: 'Призрак эфира', en: 'Airwave Ghost' }, price: 120, cloth: '#444b61', accent: '#a6b6c7' },
] as const;
export type SkinId = typeof SKINS[number]['id'];
export interface ProfileView { balance: number; owned: SkinId[]; equipped: SkinId; wins: number; wallet?: string; items: string[]; loadout: Loadout; }
export interface RewardView { amount: number; balance: number; }

export type CosmeticSlot = 'head' | 'face' | 'table' | 'wallpaper' | 'lighting' | 'poster' | 'decor' | 'victory';
export type Loadout = Partial<Record<CosmeticSlot, string>>;
export type CosmeticCategory = CosmeticSlot | 'emote';
export const CATEGORY_NAMES: Record<CosmeticCategory, { ru: string; en: string }> = {
  head: { ru: 'Головные уборы', en: 'Headwear' }, face: { ru: 'Аксессуары', en: 'Accessories' },
  table: { ru: 'Стол', en: 'Table' }, wallpaper: { ru: 'Обои', en: 'Wallpaper' },
  lighting: { ru: 'Освещение', en: 'Lighting' }, poster: { ru: 'Плакаты', en: 'Posters' },
  decor: { ru: 'Декор', en: 'Decor' }, victory: { ru: 'Победа', en: 'Victory' }, emote: { ru: 'Эмоции', en: 'Emotes' },
};
const item = (id: string, category: CosmeticCategory, price: number, ru: string, en: string, icon: string) => ({ id, category, price, name: { ru, en }, icon });
export const COSMETICS = [
  item('head-none', 'head', 0, 'Без головного убора', 'No headwear', '◯'),
  item('headphones', 'head', 30, 'Студийные наушники', 'Studio headphones', '🎧'),
  item('beanie', 'head', 25, 'Вязаная шапка', 'Knitted beanie', '◒'),
  item('beret', 'head', 40, 'Берет архивиста', 'Archivist beret', '◓'),
  item('face-none', 'face', 0, 'Без аксессуара', 'No accessory', '◯'),
  item('glasses', 'face', 20, 'Круглые очки', 'Round glasses', '◎'),
  item('scarf', 'face', 35, 'Шарф странника', 'Traveller scarf', '〰'),
  item('table-default', 'table', 0, 'Старый стол', 'Old table', '▱'),
  item('table-walnut', 'table', 40, 'Ореховый стол', 'Walnut table', '▱'),
  item('table-studio', 'table', 60, 'Студийный пульт', 'Studio desk', '▦'),
  item('wallpaper-default', 'wallpaper', 0, 'Тёмные полосы', 'Dark stripes', '▥'),
  item('wallpaper-botanical', 'wallpaper', 40, 'Ботанический узор', 'Botanical pattern', '❧'),
  item('wallpaper-artdeco', 'wallpaper', 60, 'Геометрия эфира', 'Airwave geometry', '◇'),
  item('lighting-default', 'lighting', 0, 'Ночной свет', 'Night light', '☾'),
  item('lighting-amber', 'lighting', 30, 'Тёплый янтарь', 'Warm amber', '☀'),
  item('lighting-moon', 'lighting', 40, 'Лунный эфир', 'Moonlit airwaves', '☽'),
  item('poster-default', 'poster', 0, 'Старый портрет', 'Old portrait', '▣'),
  item('poster-signal', 'poster', 25, 'Плакат «Сигнал»', 'Signal poster', '⌁'),
  item('poster-moon', 'poster', 35, 'Лунная экспедиция', 'Moon expedition', '☽'),
  item('decor-none', 'decor', 0, 'Пустой стол', 'Clear desk', '—'),
  item('decor-lantern', 'decor', 35, 'Маленький фонарь', 'Little lantern', '♧'),
  item('decor-plant', 'decor', 25, 'Растение', 'Plant', '❧'),
  item('decor-tapes', 'decor', 30, 'Кассеты архива', 'Archive tapes', '▤'),
  item('victory-default', 'victory', 0, 'Тихая победа', 'Quiet victory', '✧'),
  item('victory-sparks', 'victory', 50, 'Искры эфира', 'Airwave sparks', '✦'),
  item('victory-rings', 'victory', 60, 'Волны сигнала', 'Signal waves', '◎'),
  item('victory-stars', 'victory', 75, 'Созвездие', 'Constellation', '⋆'),
  item('emote-think', 'emote', 0, 'Думаю', 'Thinking', '🤔'),
  item('emote-wave', 'emote', 0, 'Привет', 'Hello', '👋'),
  item('emote-wow', 'emote', 15, 'Удивление', 'Surprise', '😮'),
  item('emote-laugh', 'emote', 20, 'Смех', 'Laughing', '😄'),
  item('emote-love', 'emote', 25, 'Нравится', 'Love it', '♥'),
];
export const DEFAULT_ITEMS = COSMETICS.filter(i => i.price === 0).map(i => i.id);
export const DEFAULT_LOADOUT: Loadout = Object.fromEntries(COSMETICS.filter(i => i.price === 0 && i.category !== 'emote').map(i => [i.category, i.id]));
export const EMOTE_COOLDOWN_MS = 3000;
export const EMOTE_DURATION_MS = 2500;
