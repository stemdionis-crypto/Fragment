import assert from 'node:assert/strict';
import type {Glyph,ChatMessage} from '../shared/protocol';
import type {WebSocket} from 'ws';
import {Room} from '../server/room';
import {understandClue,visibleHandDecision} from '../server/bot-lines';
import {Listener} from '../server/listener';
const options:Glyph[]=['antenna','cassette','bell','hourglass','compass','lantern','gear','lock'];
assert.equal(understandClue('слово это то что звенит',options),'bell');
assert.equal(understandClue('то что показывает на север',options),'compass');
const reports:ChatMessage[]=[];
let id=1;
function report(from:string,text:string){reports.push({id:id++,from,text,kind:'player',at:Date.now()} as ChatMessage);}
report('human','у меня есть то что показывает направление, то что крутится и то что светится');
report('echo','У меня есть свет, который можно нести.');report('echo','У меня есть железная скважина на двери.');report('echo','У меня есть песок, который меряет время.');
report('wren','У меня есть зубчатое колесо.');report('wren','У меня есть коробочка с двумя катушками.');report('wren','У меня есть стрелка, которая ищет север.');
report('shade','У меня есть железная скважина на двери.');report('shade','У меня есть то, что ловит далёкие станции.');
assert.equal(visibleHandDecision('missing',options,reports,['human','echo','wren','shade'],'echo',['lantern','lock','hourglass']),'bell');
assert.equal(visibleHandDecision('missing',options,[],['human','echo','wren','shade'],'echo',['lantern','lock','hourglass']),null,'own private cards are insufficient to guess');
const socket={OPEN:1,readyState:1,send:()=>{}} as unknown as WebSocket;
const room=new Room('CHAT',true,'ru');const human=room.addPlayer('Human','#c9c4b8',socket);room.addCompanions();room.start(human);room.stopTimer();
try{
 const players=room.players;
 room.trial={...room.trial!,kind:'missing',controls:players.map((p,i)=>({id:'vote'+i,ownerId:p.id,label:{ru:'Ваш голос',en:'Your vote'},options,target:'bell'})),knows:Object.fromEntries(players.map(p=>[p.id,[]])),hands:{[human.id]:['compass','gear','lantern'],[players[1].id]:['lantern','lock','hourglass'],[players[2].id]:['gear','cassette','compass'],[players[3].id]:['lock','antenna','hourglass']}};
 room.values=new Map(room.trial.controls.map(c=>[c.id,null]));room.ready.clear();room.turnId=human.id;human.lastChat=0;
 room.chatFrom(human,'слово это то что звенит');
 (room as unknown as {tickCompanions(now:number):void}).tickCompanions(Date.now()+5000);
 for(const bot of players.filter(p=>p.companion)){
  assert(room.ready.has(bot.id),'natural answer proposal confirms every bot');
  assert.equal(room.values.get(room.trial.controls.find(c=>c.ownerId===bot.id)!.id),'bell');
 }
 const listener=new Listener();listener.setNames(['Тень','Эхо','Ива']);assert.deepEqual(listener.listen('Тень, это то что читают').heardWords,[]);
 console.log('PASS: PJGU wording confirms all bots, missing inferred from visible card reports, no hidden guessing, teammate names not censored');
}finally{room.stopTimer();}
