import { createPublicKey, randomBytes, verify } from 'node:crypto';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function walletKey(address: string) {
  if (typeof address !== 'string' || address.length < 32 || address.length > 44) throw new Error('Invalid wallet address / Неверный адрес кошелька');
  let value = 0n;
  for (const char of address) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('Invalid wallet address / Неверный адрес кошелька');
    value = value * 58n + BigInt(digit);
  }
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = Buffer.concat([Buffer.alloc(address.match(/^1*/)?.[0].length ?? 0), value ? Buffer.from(hex, 'hex') : Buffer.alloc(0)]);
  if (bytes.length !== 32) throw new Error('Invalid wallet address / Неверный адрес кошелька');
  return createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), bytes]), format: 'der', type: 'spki' });
}
export function challenge(address: string, origin: string, accountId: string, now = Date.now()) {
  walletKey(address);
  const nonce = randomBytes(24).toString('hex');
  const expiresAt = now + 120_000;
  const message = `${new URL(origin).host} wants you to sign in with your Solana account:\n${address}\n\nLink or restore your Fragment game profile. No transaction, payment, or token approval.\n\nURI: ${origin}\nVersion: 1\nNonce: ${nonce}\nIssued At: ${new Date(now).toISOString()}\nExpiration Time: ${new Date(expiresAt).toISOString()}\nRequest ID: ${accountId}`;
  return { address, accountId, message, expiresAt };
}
export function verifyChallenge(proof: ReturnType<typeof challenge>, signature: string, accountId: string, now = Date.now()) {
  if (proof.accountId !== accountId || now >= proof.expiresAt) throw new Error('Signature request expired / Запрос подписи истёк');
  if (typeof signature !== 'string' || !/^[0-9a-f]{128}$/i.test(signature)) throw new Error('Invalid signature / Неверная подпись');
  if (!verify(null, Buffer.from(proof.message, 'utf8'), walletKey(proof.address), Buffer.from(signature, 'hex'))) throw new Error('Invalid signature / Неверная подпись');
}
