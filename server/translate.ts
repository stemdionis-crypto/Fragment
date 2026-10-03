// Chat translation between Russian and English, so players (and bots) at one table can
// each read the game in their own language.
//
// With Anthropic credentials (ANTHROPIC_API_KEY, or an `ant auth login` profile) Claude translates:
// it keeps metaphors as metaphors and never "explains" what a hint means.
// Without them, a free public translation service is used so translation works out of the box.

import Anthropic from '@anthropic-ai/sdk';
import type { Lang } from '../shared/protocol';

const MODEL = 'claude-opus-5-5';

const SYSTEM = `You translate chat messages in a word-guessing party game between Russian and English.
Players describe hidden signs and colours with metaphors because plain words are forbidden.
Rules:
- Translate literally and naturally. Keep every metaphor a metaphor; never reveal or explain what it hints at.
- Never add plain colour names, shape names or numbers that are not in the original.
- Keep tokens like [[1]], [[2]] exactly as they are, in the right place.
- Reply with the translation only, nothing else.`;

const hasClaude = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
const client = hasClaude ? new Anthropic() : null;

export const translationEngine = hasClaude ? 'claude' : 'mymemory';

export function detectLang(text: string): Lang {
  const cyr = (text.match(/[а-яё]/gi) ?? []).length;
  const lat = (text.match(/[a-z]/gi) ?? []).length;
  return cyr > lat ? 'ru' : 'en';
}

async function viaClaude(text: string, to: Lang) {
  const response = await client!.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Translate into ${to === 'ru' ? 'Russian' : 'English'}:\n\n${text}` }],
  });
  if (response.stop_reason === 'refusal') return null;
  const out = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return out || null;
}

async function viaMyMemory(text: string, from: Lang, to: Lang) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { responseStatus: number; responseData?: { translatedText?: string } };
  const out = data.responseData?.translatedText?.trim();
  return data.responseStatus === 200 && out ? out : null;
}

const cache = new Map<string, string | null>();

// Translate a chat line. Static (▓▓▓) is protected with [[n]] tokens and restored afterwards.
export async function translate(text: string, from: Lang, to: Lang): Promise<string | null> {
  if (from === to) return text;
  const key = `${from}>${to}:${text}`;
  if (cache.has(key)) return cache.get(key)!;

  const statics: string[] = [];
  const protectedText = text.replace(/▓+/g, (s) => `[[${statics.push(s)}]]`);
  // Nothing but static and punctuation: nothing to translate
  if (!/[\p{L}]/u.test(protectedText.replace(/\[\[\d+\]\]/g, ''))) return text;

  let out: string | null = null;
  try {
    out = client ? await viaClaude(protectedText, to) : await viaMyMemory(protectedText, from, to);
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.warn(`[translate] Claude API error ${e.status}: ${e.message}`);
    else console.warn('[translate] failed:', (e as Error).message);
  }
  if (out) out = out.replace(/\[\[\s*(\d+)\s*\]\]/g, (_, n: string) => statics[Number(n) - 1] ?? '▓▓▓');
  cache.set(key, out);
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return out;
}
