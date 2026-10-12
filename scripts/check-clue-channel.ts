import assert from 'node:assert/strict';
import {ALL_ITEMS,ITEM_SETS} from '../shared/protocol';
import {describeClue,understandClue} from '../server/bot-lines';
import {Listener} from '../server/listener';
for(const lang of ['ru','en'] as const){
 for(const value of [...ALL_ITEMS,0,1,2,3,4,5,6,7,8,9]){
  const phrase=describeClue(value,lang);
  const listener=new Listener();
  const read=listener.listen(phrase);
  assert.deepEqual(read.heardWords,[],`${lang} clue for ${value} must survive radio: ${phrase}`);
  const options=typeof value==='number'?[0,1,2,3,4,5,6,7,8,9]:Object.values(ITEM_SETS).find(items=>(items as readonly string[]).includes(value))!;
  assert.equal(understandClue(read.masked,[...options]),value,`${lang} clue for ${value} must remain understandable`);
 }
}
console.log('PASS: all picture and digit clues in RU/EN survive the real radio and remain understandable');
