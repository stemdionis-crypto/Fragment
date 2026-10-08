
import { createIDosGamesClient } from '@idosgames/core';
import assert from 'node:assert/strict';
const data=new Map();const device='fragment-test-'+crypto.randomUUID();const platform={storage:{getString:k=>data.get(k)??null,setString:(k,v)=>data.set(k,v),remove:k=>data.delete(k)},getPlatform:()=> 'Web',getFullURL:()=>'',getStartParameter:()=>null,getTelegramInitDataRaw:()=>null,getDeviceID:()=>device,getDeviceModel:()=> 'integration test',shareLink:()=>{},openInvoice:()=>{},showAd:async()=>{},copyToClipboard:async()=>{}};const c=createIDosGamesClient({titleID:'49HLIN0J-DEV',platform});
const log=(step,r)=>{console.log(JSON.stringify({step,ok:r.ok,error:r.ok?r.data.Error:r.error}));if(!r.ok||r.data.Error)throw Error(step+' failed');return r.data;};
try{
 log('login',await c.auth.loginWithDeviceID());
 const denied = await c.cloudCode.execute('fragmentEquip',{id:'phantom'}); assert(denied.ok && denied.data.Error, 'unowned skin must be rejected');
 const sf=log('storefront',await c.store.getStorefront({forceRefresh:true}));
 console.log(JSON.stringify({stores:sf.Stores?.map(s=>({id:s.StoreID,slots:s.Sections?.flatMap(x=>x.Slots?.map(y=>y.Offer?.OfferID))}))}));
 log('purchase-virtual-CO',await c.store.purchase('fragment_test_operator',1,{selectedOptionID:'test',slot:{storeID:'fragment_test',sectionID:'items',slotID:'operator'}}));
 await new Promise(r=>setTimeout(r,700));log('equip',await c.cloudCode.execute('fragmentEquip',{id:'operator'},'Latest'));
 await new Promise(r=>setTimeout(r,700));const profile=log('reload-protected-profile',await c.cloudCode.execute('fragmentProfile',undefined,'Latest'));
 const inv=log('reload-inventory',await c.user.getUserInventory());
 console.log(JSON.stringify({owned:inv.Items?.fragment_operator?.TotalAmount,equipped:profile.FunctionResult?.equipped}));
 assert.equal(inv.Items?.fragment_operator?.TotalAmount,1); assert.equal(profile.FunctionResult?.equipped,'operator');
 const second=createIDosGamesClient({titleID:'49HLIN0J-DEV',platform});
 const relog=await second.auth.autoLogin();console.log(JSON.stringify({step:'new-client-session',ok:relog.ok,sameUser:second.auth.context?.userID===c.auth.context?.userID}));
 assert(relog.ok && second.auth.context?.userID===c.auth.context?.userID, 'account must be restored');
 if(relog.ok)console.log(JSON.stringify({step:'restore-loadout',result:(await second.cloudCode.execute('fragmentProfile')).data?.FunctionResult}));
 process.exit(0);
}catch(e){console.error(e.message);process.exit(1);}
