import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {WebSocket} from 'ws';
const directory=mkdtempSync(join(tmpdir(),'fragment-flow-'));
process.env.FRAGMENT_DATA_DIR=directory;delete process.env.DATABASE_URL;delete process.env.RENDER;
const {Room}=await import('../server/room');
const {Listener}=await import('../server/listener');
const {identify,penalizeMatchLeave,matchLeaveRemaining,profile,closeAccountStore}=await import('../server/economy');
const socket={OPEN:1,readyState:1,send:()=>{}} as unknown as WebSocket;
const room=new Room('FLOW',true,'ru');const human=room.addPlayer('Tester','#c9c4b8',socket);
room.addCompanions();room.start(human);room.stopTimer();
try{
 assert.equal(room.endsAt,0,'practice has no countdown');
 const bot=room.players.find(p=>p.companion)!;
 for(let i=0;i<12;i++){room.turnId=bot.id;bot.lastChat=0;room.chatFrom(bot,'Мне нужна подсказка, сколько воды нужно?');}
 assert.equal(room.suspicion,0,'bot requests never raise suspicion');assert.deepEqual(room.listener.learnedWords(),[]);
 const listener=new Listener();
 for(let i=0;i<20;i++)listener.listen('Сколько нужно воды? Мне нужна подсказка.',100000+i*50000);
 assert.deepEqual(listener.learnedWords(),[],'helper words never become censored');
 const control=room.trial!.controls[0];room.values.set(control.id,control.options[0]);
 room.trialIndex=2;room.trialsDone=[{en:'First',ru:'Первый'},{en:'Second',ru:'Второй'}];
 const oldTrial=room.trial,oldValues=[...room.values];room.suspicion=100;
 (room as unknown as {checkSuspicion():void}).checkSuspicion();
 assert.equal(room.trial,oldTrial);assert.equal(room.trialIndex,2);assert.deepEqual([...room.values],oldValues);assert.equal(room.trialsDone.length,2);
 const a=await identify();await penalizeMatchLeave(a.id,100000);
 assert.equal(matchLeaveRemaining(a.id,100001),299999);assert.equal(matchLeaveRemaining(a.id,400001),0);
 assert.equal(profile(a.id).matchmakingBlockedUntil,400000);
 assert(JSON.parse(readFileSync(join(directory,'profiles.json'),'utf8')).some((p:any)=>p.id===a.id&&p.matchmakingBlockedUntil===400000));
 const before=room.trial;room.abandon(human);assert(human.companion);assert.equal(human.accountId,undefined);assert.equal(room.trial,before);
 console.log('PASS: no practice timer, bot radio isolation, protected words, retune preserves progress, durable 5-minute restriction, companion replacement');
}finally{room.stopTimer();await closeAccountStore();rmSync(directory,{recursive:true,force:true});}
