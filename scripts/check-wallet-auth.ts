import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { challenge, verifyChallenge } from '../server/wallet-auth';

// Synthetic keys remain in memory; no real wallet or transaction is used.
function base58(bytes: Uint8Array) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = BigInt('0x' + Buffer.from(bytes).toString('hex'));
  let result = '';
  while (n) { result = alphabet[Number(n % 58n)] + result; n /= 58n; }
  for (const byte of bytes) { if (byte) break; result = '1' + result; }
  return result;
}
const keys = generateKeyPairSync('ed25519');
const other = generateKeyPairSync('ed25519');
const address = base58(keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32));
const proof = challenge(address, 'http://localhost:5174', 'test-account', 1000);
const signature = sign(null, Buffer.from(proof.message), keys.privateKey).toString('hex');
verifyChallenge(proof, signature, 'test-account', 2000);
assert.throws(() => verifyChallenge(proof, signature, 'other-account', 2000));
assert.throws(() => verifyChallenge(proof, signature, 'test-account', proof.expiresAt));
assert.throws(() => verifyChallenge({ ...proof, message: proof.message + 'changed' }, signature, 'test-account', 2000));
assert.throws(() => verifyChallenge(proof, sign(null, Buffer.from(proof.message), other.privateKey).toString('hex'), 'test-account', 2000));
assert.throws(() => verifyChallenge(proof, 'bad', 'test-account', 2000));
assert.throws(() => challenge('invalid-address', 'http://localhost:5174', 'test-account'));
assert.notEqual(challenge(address, 'http://localhost:5174', 'test-account').message, proof.message);
console.log('PASS: valid Ed25519 signature, wrong signer/message/account, expired and malformed proofs, random nonces');
