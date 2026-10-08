// Offline model only: no wallets, API calls or game balance writes.
import assert from 'node:assert/strict';
export function points({wins,activeDays}) {
  assert(Number.isSafeInteger(wins) && wins >= 0);
  assert(Number.isSafeInteger(activeDays) && activeDays >= 0 && activeDays <= 28);
  return (wins >= 3 ? 1 : 0) + (wins >= 10 ? 2 : 0) + (wins >= 25 ? 4 : 0) + (activeDays >= 5 ? 3 : 0);
}
export function allocate(budget,accounts) {
  assert(typeof budget === 'bigint' && budget >= 0n);
  assert(new Set(accounts.map(a=>a.id)).size === accounts.length,'Duplicate account');
  assert(accounts.every(a=>typeof a.id === 'string' && a.id && Number.isSafeInteger(a.points) && a.points >= 0 && a.points <= 10),'Invalid points');
  const sum=accounts.reduce((n,a)=>n+BigInt(a.points),0n);
  const rewards=accounts.map(a=>({id:a.id,amount:sum ? budget*BigInt(a.points)/sum : 0n}));
  const spent=rewards.reduce((n,a)=>n+a.amount,0n);
  assert(spent<=budget);
  return {rewards,spent,remainder:budget-spent};
}
// 1000 FRAG and 6 decimals are examples, not production parameters.
const unit=1000000n,budget=1000n*unit;
for(const n of [100,1000,10000]) {
  const result=allocate(budget,Array.from({length:n},(_,i)=>({id:String(i),points:10})));
  console.log(JSON.stringify({participants:n,poolFRAG:1000,perPlayerFRAG:Number(result.rewards[0].amount)/Number(unit),spentFRAG:Number(result.spent)/Number(unit)}));
}
assert.equal(points({wins:10,activeDays:5}),6);
assert.equal(points({wins:25,activeDays:5}),10);
assert.equal(allocate(123n,[]).remainder,123n);
const mixed=allocate(1000n,[{id:'a',points:10},{id:'b',points:6},{id:'c',points:3}]);
assert.equal(mixed.spent+mixed.remainder,1000n);
assert.equal(mixed.rewards[0].amount,526n);
assert.equal(mixed.rewards[1].amount,315n);
assert.equal(mixed.rewards[2].amount,157n);
assert.equal(mixed.remainder,2n);
assert.throws(()=>allocate(1n,[{id:'a',points:10},{id:'a',points:3}]));
assert.throws(()=>allocate(-1n,[]));
const integerOnly=allocate(1000n,Array.from({length:10000},(_,i)=>({id:String(i),points:10})));
assert.equal(integerOnly.spent,0n);
console.log('OK: budget cap, rounding, empty season, duplicate accounts and precision checks');
