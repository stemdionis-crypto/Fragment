export const SKINS = [
  { id: 'classic', name: { ru: 'Незнакомец', en: 'Stranger' }, price: 0, cloth: '#45464a', accent: '#aaa69d' },
  { id: 'operator', name: { ru: 'Оператор', en: 'Operator' }, price: 20, cloth: '#365a50', accent: '#a9c7bd' },
  { id: 'wanderer', name: { ru: 'Странник', en: 'Wanderer' }, price: 60, cloth: '#714a36', accent: '#e0bc83' },
  { id: 'phantom', name: { ru: 'Призрак эфира', en: 'Airwave Ghost' }, price: 120, cloth: '#514175', accent: '#c5b1ef' },
] as const;
export type SkinId = typeof SKINS[number]['id'];
export interface ProfileView { balance: number; owned: SkinId[]; equipped: SkinId; wins: number; wallet?: string; }
export interface RewardView { amount: number; balance: number; }
