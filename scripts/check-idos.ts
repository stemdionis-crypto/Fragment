
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { inventoryLook, platformCall } from '../server/idos';
const inv = { Items: { fragment_operator: { TotalAmount: 1, StackableAmount: 1, UnstackableAmount: 0 } } };
const look = inventoryLook(inv, { equipped: 'phantom', loadout: { face: 'mask-oni' } });
assert(look.owned.includes('operator'));
assert(!look.owned.includes('phantom'));
assert.equal(look.equipped, 'classic');
assert.equal(look.loadout.face, 'face-none');
await assert.rejects(platformCall({userId:'../victim',ticket:'x'.repeat(32)}, 'User', 'GetInventory'), /Invalid/);
const data: Record<string,{Value:string}> = {};
let earned = 0;
let receipt = { userId:'player',ready:true,day:new Date().toISOString().slice(0,10),earned:25 };
const handlers: Record<string,(args:unknown,context:{UserID:string})=>unknown> = {};
runInNewContext(readFileSync(new URL('../idos/cloud-code.js', import.meta.url),'utf8'), { handlers, server:{
  ReadUserData:()=>({InventoryV2:inv}),
  GetUserCustomData:()=>({Success:true,Data:{ReadOnly:data}}),
  SetUserCustomData:(_bucket:string,key:string,value:string)=>{data[key]={Value:value};return {Success:true};},
  HttpRequest:()=>({Success:true,Data:{Ok:true,Body:JSON.stringify(receipt)}}),
  AddQuestProgress:(_metric:string,value:number)=>{earned=Math.max(earned,value);return {Success:true};},
}});
assert.throws(()=>handlers.fragmentEquip({id:'phantom'},{UserID:'player'}),/not owned/);
handlers.fragmentEquip({id:'operator'},{UserID:'player'});
assert.equal((handlers.fragmentProfile({}, {UserID:'player'}) as {equipped:string}).equipped,'operator');
assert.throws(()=>handlers.fragmentMatch({receipt:'a'.repeat(64)},{UserID:'other'}),/not active/);
handlers.fragmentMatch({receipt:'a'.repeat(64)},{UserID:'player'});
handlers.fragmentMatch({receipt:'a'.repeat(64)},{UserID:'player'});
assert.equal(earned,25);
receipt.ready=false;
assert.throws(()=>handlers.fragmentMatch({receipt:'a'.repeat(64)},{UserID:'player'}),/not active/);
receipt.ready=true;receipt.earned=101;
assert.throws(()=>handlers.fragmentMatch({receipt:'a'.repeat(64)},{UserID:'player'}),/Invalid reward/);
console.log('iDos: ownership, profile persistence, receipt binding, replay and activation guards passed');
