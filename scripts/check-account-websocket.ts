import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
const directory = mkdtempSync(join(tmpdir(),'fragment-ws-account-'));
const environment = {...process.env,SERVER_PORT:'2599',FRAGMENT_DATA_DIR:directory};
delete environment.DATABASE_URL; delete environment.RENDER;
const server = spawn(process.execPath,['--import','tsx','server/index.ts'],{env:environment,stdio:['ignore','pipe','pipe']});
const connections: WebSocket[] = [];
const keys=generateKeyPairSync('ed25519');
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bytes=keys.publicKey.export({type:'spki',format:'der'}).subarray(-32);
let number=BigInt('0x'+bytes.toString('hex')),address='';
while(number){address=alphabet[Number(number%58n)]+address;number/=58n;}
for(const byte of bytes){if(byte)break;address='1'+address;}
const connect = async () => {
  const ws=new WebSocket('ws://localhost:2599',{origin:'http://localhost:5174'}); connections.push(ws);
  const messages: any[]=[]; ws.on('message',raw=>messages.push(JSON.parse(String(raw))));
  await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  return {ws,request:async (message:unknown,type:string) => {
    messages.length=0; ws.send(JSON.stringify(message)); const start=Date.now();
    while(Date.now()-start<5000){const found=messages.find(m=>m.t===type);if(found)return found;await new Promise(r=>setTimeout(r,10));}
    throw new Error('Missing '+type+' response');
  }};
};
try {
  await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10_000);
    server.stdout.on('data',data=>{if(String(data).includes('listening')){clearTimeout(timer);resolve();}});
    server.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});
  });
  const a=await connect(); const initial=await a.request({t:'identify'},'profile');
  await a.request({t:'wallet_proof',signature:'00'.repeat(64)},'error');
  const proof=await a.request({t:'wallet_challenge',address},'wallet_challenge');
  await a.request({t:'wallet_proof',signature:sign(null,Buffer.from(proof.message),keys.privateKey).toString('hex')},'wallet_verified');
  const named=await a.request({t:'set_nickname',nickname:'Socket player'},'profile');
  assert.equal(named.profile.nickname,'Socket player');
  const unchanged=await a.request({t:'set_nickname',nickname:'Socket player'},'profile');
  assert.equal(unchanged.profile.nickname,'Socket player');
  const restored=await connect();
  const same=await restored.request({t:'identify',token:initial.token},'profile');
  assert.equal(same.profile.nickname,'Socket player'); assert.equal(same.profile.wallet,address);
  const b=await connect(); await b.request({t:'identify'},'profile');
  const secondProof=await b.request({t:'wallet_challenge',address},'wallet_challenge');
  const conflict=await b.request({t:'wallet_proof',signature:sign(null,Buffer.from(secondProof.message),keys.privateKey).toString('hex')},'wallet_conflict');
  assert.equal(conflict.profile.nickname,'Socket player');
  const accepted=await b.request({t:'wallet_use',accept:true},'profile');
  assert.equal(accepted.profile.nickname,'Socket player'); assert.notEqual(accepted.token,initial.token);
  console.log('PASS: WebSocket signed login, nickname save, device restoration, wallet conflict and token rotation');
} finally {
  connections.forEach(ws=>ws.terminate());server.kill();
  await new Promise<void>(resolve=>{if(server.exitCode!==null)resolve();else server.once('exit',()=>resolve());});
  rmSync(directory,{recursive:true,force:true});
}
