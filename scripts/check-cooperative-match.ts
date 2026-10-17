import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocket} from 'ws';
import type {PrivateInfo,PublicState,Value} from '../shared/protocol';
import {linesFor,understandFor,visibleHandDecision} from '../server/bot-lines';
import {decodeClue,HAND_TRIALS} from '../shared/trial-rules';
const directory=mkdtempSync(join(tmpdir(),'fragment-coop-'));
const environment={...process.env,SERVER_PORT:'2614',FRAGMENT_DATA_DIR:directory,FRAGMENT_LOCAL_PREVIEW:'true',FRAGMENT_REQUIRE_DATABASE:'false'};
delete environment.DATABASE_URL;delete environment.RENDER;
const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:environment,stdio:['ignore','pipe','pipe']});
let ws:WebSocket|undefined;
try{
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);server.stdout.on('data',data=>{if(String(data).includes('listening')){clearTimeout(timer);resolve();}});server.once('exit',()=>reject(Error('server exited')));});
 ws=new WebSocket('ws://127.0.0.1:2614');
 let state:PublicState|undefined,info:PrivateInfo|undefined,myId='',identified=false;
 const errors:string[]=[];
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.t==='state')state=m.state;if(m.t==='private'){info=m.info;assert(!info?.targets,'no hidden answer access');}if(m.t==='joined')myId=m.playerId;if(m.t==='profile')identified=true;if(m.t==='error')errors.push(m.message);});
 await new Promise<void>((resolve,reject)=>{ws!.once('open',resolve);ws!.once('error',reject);});
 const send=(message:unknown)=>ws!.send(JSON.stringify(message));
 send({t:'identify'});while(!identified)await new Promise(r=>setTimeout(r,50));
 send({t:'create',name:'Проверяющий',color:'#c9c4b8',practice:true,lang:'ru'});
 while(!myId || state?.phase!=='lobby')await new Promise(r=>setTimeout(r,50));send({t:'start'});
 let key='',startId=0,pending:string[]=[],lastSpeech=0,lastSet=0,lastReady=0,passed='',lastReport=0;
 const started=Date.now(),seenKinds:string[]=[];
 while(Date.now()-started<180000){
  assert.equal(errors.length,0,errors.join('; '));
  const current=state as PublicState|undefined;
  if(current?.phase==='won'){assert.equal(seenKinds.length,4);console.log('PASS: full four-trial match solved through real WebSocket chat and own private clues only: '+seenKinds.join(', '));break;}
  assert(current?.phase!=='lost','match must remain playable');
  if(!current?.trial || !info || current.phase!=='playing'){await new Promise(r=>setTimeout(r,100));continue;}
  const trial=current.trial;
  if(key!==`${trial.index}:${trial.kind}`){
   key=`${trial.index}:${trial.kind}`;startId=current.chat.at(-1)?.id ?? 0;pending=linesFor(info,current,'ru');passed='';seenKinds.push(trial.kind);console.log('PLAY '+key+' using visible chat');
  }
  const recent=current.chat.filter(m=>m.id>startId);
  if(Date.now()-lastReport>20000){lastReport=Date.now();console.log(JSON.stringify({trial:key,ready:current.players.map(p=>[p.name,p.ready,p.botStatus]),lastChat:recent.slice(-6).map(m=>m.text)}));}
  for(const control of trial.controls.filter(c=>c.ownerId===myId)){
   let input:Value|null=HAND_TRIALS.includes(trial.kind)
    ?visibleHandDecision(trial.kind,control.options,recent,current.players.map(p=>p.id),myId,info.hand ?? [])
    :recent.filter(m=>m.kind==='player' && m.from!==myId && m.text.includes('Проверяющий')).map(m=>understandFor(trial.kind,m.text,control.options,control.scale)).filter(v=>v!==null).at(-1) ?? null;
   if(input!==null){const answer=HAND_TRIALS.includes(trial.kind)?input:decodeClue(trial.kind,input,control.options);
    if(info.mine[control.id]!==answer && Date.now()-lastSet>700){send({t:'set',control:control.id,value:answer});lastSet=Date.now();}
   }
  }
  const own=trial.controls.filter(c=>c.ownerId===myId);
  if(own.every(c=>info!.mine[c.id]!=null) && !current.players.find(p=>p.id===myId)?.ready && Date.now()-lastReady>800){send({t:'ready',on:true});lastReady=Date.now();}
  if(current.turnId===myId && Date.now()-lastSpeech>750){
   const line=pending.shift();
   if(line){send({t:'chat',text:line});lastSpeech=Date.now();}
   else if(passed!==String(current.turnEndsAt)){send({t:'pass'});passed=String(current.turnEndsAt);lastSpeech=Date.now();}
  }
  await new Promise(r=>setTimeout(r,100));
 }
 assert.equal((state as PublicState|undefined)?.phase,'won','cooperative match timed out: '+JSON.stringify({info,state}));
}finally{ws?.terminate();server.kill();await new Promise<void>(resolve=>server.exitCode!==null?resolve():server.once('exit',()=>resolve()));rmSync(directory,{recursive:true,force:true});}
