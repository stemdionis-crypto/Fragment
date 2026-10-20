import assert from 'node:assert/strict';
import { popupAuthCode } from '../client/src/popup-auth-guard';
const popup = {} as Window, stranger = {} as Window, origin = 'https://49hlin0j.idos.games', nonce = 'a'.repeat(32);
const good = { origin, source: popup, data: { type: 'fragment:idos-sso', nonce, code: 'one-use-test-code' } };
assert.equal(popupAuthCode(good, popup, origin, nonce), 'one-use-test-code');
for (const bad of [{...good,source:stranger}, {...good,origin:'https://example.com'}, {...good,data:{...good.data,nonce:'b'.repeat(32)}}, {...good,data:{...good.data,type:'another'}}, {...good,data:{...good.data,code:''}}, {...good,data:{...good.data,code:'x'.repeat(4097)}}, {...good,data:null}]) assert.equal(popupAuthCode(bad,popup,origin,nonce),null);
console.log('PASS: popup SSO exact window, origin, attempt nonce and one-use code bounds');
