// Only the exact window opened by this sign-in attempt may return its one-use code.
export function popupAuthCode(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, popup: Window, origin: string, nonce: string): string | null {
  const data = event.data;
  if (event.source !== popup || event.origin !== origin || !data || data.type !== 'fragment:idos-sso' || data.nonce !== nonce) return null;
  return typeof data.code === 'string' && data.code.length > 0 && data.code.length <= 4096 ? data.code : null;
}
