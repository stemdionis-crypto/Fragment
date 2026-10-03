// Messages and types shared by the server and the client.
import type { ProfileView, RewardView, SkinId } from './economy';

// Item pictures, in sets of 8. A trial uses one set.
export const ITEM_SETS = {
  signs: ['triangle', 'circle', 'square', 'cross', 'star', 'moon', 'eye', 'key'],
  objects: ['candle', 'cup', 'clock', 'knife', 'book', 'coin', 'feather', 'bottle'],
  animals: ['cat', 'owl', 'fish', 'spider', 'crow', 'snake', 'rabbit', 'moth'],
} as const;
export type ItemSet = keyof typeof ITEM_SETS;
export type Glyph = (typeof ITEM_SETS)[ItemSet][number];
export const ALL_ITEMS = Object.values(ITEM_SETS).flat() as Glyph[];

// Text the server writes is sent in both languages; each client shows its own
export type Lang = 'en' | 'ru';
export interface L {
  en: string;
  ru: string;
}

// Every trial gives each player their own control on the radio.
// The right setting of your control is known to someone else.
export type TrialKind = 'tuning' | 'frequency' | 'code' | 'missing'
  | 'common' | 'duplicate' | 'rare' | 'crowd'
  | 'mirror' | 'echo' | 'countdown' | 'amplifier' | 'half' | 'balance'
  | 'next' | 'previous' | 'opposite' | 'reflection' | 'pairs' | 'leap';

// A control's value: an item picture, or a digit 0–9
export type Value = Glyph | number;

export const PLAYER_COLORS = ['#c9c4b8', '#8d9499', '#7d93a3', '#a8655a', '#86906c', '#8f7d91', '#a8946a', '#6d7f96'] as const;

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 4;
export const MAX_ATTEMPTS = 3; // per trial
export const TRIALS_PER_GAME = 5;
export const ROUND_SECONDS = 10 * 60;
export const CHAT_MAX = 140;
export const TURN_SECONDS = 30;
export const TURN_MESSAGES = 3;

export type Phase = 'lobby' | 'playing' | 'won' | 'lost';

export interface PlayerView {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  ready: boolean; // pressed "I'm sure" in the current trial
  wallet?: string;
  bot?: boolean;
  skin?: SkinId;
}

export interface ChatMessage {
  id: number;
  kind: 'player' | 'radio' | 'system';
  from?: string; // player id
  text: string; // already masked by the radio if it heard something
  ru?: string; // Russian version of radio / system lines
  lang?: Lang; // language a player wrote in
  tr?: string; // the player's message translated into the other language (arrives a moment later)
  heard?: boolean;
  t: number;
}

export interface FragmentRecord {
  id: string;
  room: string;
  solvedAt: number;
  seconds: number;
  players: { name: string; color: string; wallet?: string }[];
  trials: L[]; // titles of the trials the team went through
  lexicon: string[]; // the words the team invented and kept using
  cracked: string[]; // the ones the radio learned to understand
  heard: number; // how many times the radio caught them
  retunes: number;
  wrong: number;
}

// A control everyone can see exists, but only its owner sees (and sets) its value
export interface ControlView {
  id: string;
  ownerId: string;
  label: L; // "Volume knob", "2nd digit", "right after the start"…
  options: Value[];
  isSet: boolean;
}

export interface TrialView {
  kind: TrialKind;
  index: number; // 0-based
  total: number;
  title: L;
  prompt: L; // what the radio says (atmosphere)
  task: L; // what the players actually have to do, in plain words
  set?: ItemSet;
  controls: ControlView[];
  lastWrong?: number; // after a failed check: how many controls were wrong
}

export interface PublicState {
  code: string;
  practice: boolean;
  matchmaking: boolean;
  matchStartsAt: number;
  phase: Phase;
  hostId: string;
  players: PlayerView[];
  trial?: TrialView;
  attemptsLeft: number;
  suspicion: number; // 0..100
  endsAt: number; // epoch ms
  retunes: number;
  learned: string[]; // words the radio has learned to understand
  turnId: string; // whose turn it is to speak
  turnEndsAt: number;
  turnMessagesLeft: number;
  chat: ChatMessage[];
  fragment?: FragmentRecord;
  lostReason?: 'time' | 'attempts';
}

// What you know about someone else's control
export interface Knowledge {
  controlId: string;
  value: Value;
}

// Only its owner ever receives this
export interface PrivateInfo {
  knows: Knowledge[]; // the right setting of other players' controls
  hand?: Glyph[]; // "Missing": the items you have
  mine: Record<string, Value | null>; // the current value of your own controls
  targets?: Record<string, Value>; // test bots only, never sent in production
}

export type ClientMessage =
  | { t: 'wallet_challenge'; address: string }
  | { t: 'wallet_proof'; signature: string }
  | { t: 'wallet_use'; accept: boolean }
  | { t: 'identify'; token?: string }
  | { t: 'buy'; skin: string }
  | { t: 'equip'; skin: string }
  | { t: 'match'; name: string; color: string }
  | { t: 'leave' }
  | { t: 'create'; name: string; color: string; bot?: boolean; practice?: boolean; lang?: Lang }
  | { t: 'join'; code: string; name: string; color: string; bot?: boolean }
  | { t: 'resume'; code: string; playerId: string }
  | { t: 'start' }
  | { t: 'chat'; text: string }
  | { t: 'set'; control: string; value: Value }
  | { t: 'ready'; on: boolean }
  | { t: 'pass' }
  | { t: 'wallet'; address: string }
  | { t: 'again' };

export type ServerMessage =
  | { t: 'wallet_challenge'; message: string; address: string }
  | { t: 'wallet_conflict'; profile: ProfileView }
  | { t: 'wallet_verified'; restored: boolean }
  | { t: 'profile'; profile: ProfileView; token?: string }
  | { t: 'reward'; reward: RewardView }
  | { t: 'left' }
  | { t: 'joined'; playerId: string; code: string }
  | { t: 'state'; state: PublicState }
  | { t: 'private'; info: PrivateInfo }
  | { t: 'error'; message: string; ru?: string }
  | { t: 'heard'; words: string[] } // sent only to the player who was overheard
  | { t: 'fx'; kind: 'wrong' | 'retune' | 'learned' | 'heard' | 'open' | 'turn' | 'trial' };
