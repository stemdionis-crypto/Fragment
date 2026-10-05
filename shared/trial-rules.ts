import type { Glyph, TrialKind, Value } from './protocol';

export const NUMBER_CIPHERS: TrialKind[] = ['echo'];
export const SYMBOL_CIPHERS: TrialKind[] = ['next', 'previous', 'opposite', 'reflection', 'pairs', 'leap'];
export const HAND_TRIALS: TrialKind[] = ['missing', 'common', 'duplicate', 'rare', 'crowd'];
export const isCipher = (kind: TrialKind) => NUMBER_CIPHERS.includes(kind) || SYMBOL_CIPHERS.includes(kind);

// Public rules: the private clue is an input, rather than the final answer.
export function decodeClue(kind: TrialKind, value: Value, options: Value[]): Value {
  if (NUMBER_CIPHERS.includes(kind)) {
    if (typeof value !== 'number') throw new Error('Numeric clue required');
    return (value + 1) % 10;
  }
  if (SYMBOL_CIPHERS.includes(kind)) {
    const i = options.indexOf(value), n = options.length;
    if (i < 0 || n !== 8) throw new Error('Eight-picture scale required');
    const index = kind === 'next' ? (i + 1) % n
      : kind === 'previous' ? (i + n - 1) % n
      : kind === 'opposite' ? (i + n / 2) % n
      : kind === 'reflection' ? n - 1 - i
      : kind === 'pairs' ? i ^ 1 : (i + 2) % n;
    return options[index];
  }
  return value;
}

export function handCandidates(kind: TrialKind, options: Value[], hands: Glyph[][]): Value[] {
  const counts = options.map((v) => hands.filter((h) => h.includes(v as Glyph)).length);
  const positive = counts.filter((n) => n > 0);
  return options.filter((_, i) => kind === 'missing' ? counts[i] === 0
    : kind === 'common' ? hands.length > 0 && counts[i] === hands.length
    : kind === 'duplicate' ? counts[i] === 2
    : kind === 'rare' ? counts[i] > 0 && counts[i] === Math.min(...positive)
    : kind === 'crowd' ? counts[i] > 0 && counts[i] === Math.max(...positive) : false);
}
