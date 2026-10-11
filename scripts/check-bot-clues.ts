import assert from 'node:assert/strict';
import { understandClue } from '../server/bot-lines';
assert.equal(understandClue('бурмалда',['key','lock']),null);
assert.equal(understandClue('чёрная птица, которая каркает',['owl','crow']), 'crow');
assert.equal(understandClue('зубчатое колесо',['circle','gear']), 'gear');
assert.equal(understandClue('то, чем открывают дверь',['key','lock']), 'key');
assert.equal(understandClue('то, чем открывают дверь или то, что задувают на торте',['key','candle']),null);
assert.equal(understandClue('пусто, как в кармане перед зарплатой',[0,1,2]),0);
console.log('PASS: punctuation, specific clues, ambiguity and unrelated words');
