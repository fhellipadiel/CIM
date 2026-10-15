const {test}=require('node:test'),assert=require('node:assert/strict');
const notifications=require('../server/notifications.cjs');
function memory(){
 const data={users:{admin:{isAdmin:true},alice:{name:'Alice'},bob:{name:'Bob'}}};
 const read=path=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data)||null;
 const write=(path,value)=>{const keys=path.split('/');let node=data;for(const k of keys.slice(0,-1))node=node[k]??={};if(value===null)delete node[keys.at(-1)];else node[keys.at(-1)]=structuredClone(value);};
 return {data,ref:(path='')=>({get:async()=>({val:()=>structuredClone(read(path))}),update:async updates=>{for(const [k,v]of Object.entries(updates))write([path,k].filter(Boolean).join('/'),v);}})};
}
const admin={uid:'admin',isAdmin:true};
test('notificações exigem admin, cliente existente e mensagem válida',async()=>{
 const db=memory();
 await assert.rejects(notifications(db,{uid:'alice'},{action:'list'}),e=>e.status===403);
 await assert.rejects(notifications(db,admin,{action:'save',target:'missing',title:'Olá',message:'Texto'}));
 await assert.rejects(notifications(db,admin,{action:'save',target:'all',title:'',message:'Texto'}));
 assert.equal(db.data.notifications,undefined);
});
test('notificação individual não chega a outro cliente; edição preserva leitura e exclusão remove cópia',async()=>{
 const db=memory();
 const {id}=await notifications(db,admin,{action:'save',target:'alice',title:'Olá',message:'Uma mensagem'});
 assert.equal(db.data.notifications.bob,undefined);db.data.notifications.alice['campaign_'+id].read=true;
 await notifications(db,admin,{action:'save',id,target:'all',title:'Alterado',message:'Texto novo'});
 assert.equal(db.data.notifications.alice['campaign_'+id].read,true);
 assert.equal(db.data.notifications.alice['campaign_'+id].message,'Texto novo');
 assert.equal(db.data.notifications.bob,undefined);
 await notifications(db,admin,{action:'delete',id});
 assert.equal(db.data.notifications.alice['campaign_'+id],undefined);
});
test('envio geral, exclusão individual e edição não reenviam para destinatário removido',async()=>{
 const db=memory();
 const {id}=await notifications(db,admin,{action:'save',target:'all',title:'Geral',message:'Para todos'});
 assert.equal(db.data.notifications.admin,undefined);
 assert.ok(db.data.notifications.alice['campaign_'+id]);assert.ok(db.data.notifications.bob['campaign_'+id]);
 await notifications(db,admin,{action:'delete',id,uid:'alice'});
 await notifications(db,admin,{action:'save',id,title:'Novo título',message:'Outro texto'});
 assert.equal(db.data.notifications.alice['campaign_'+id],undefined);
 assert.equal(db.data.notifications.bob['campaign_'+id].title,'Novo título');
 const list=await notifications(db,admin,{action:'list'});assert.equal(list.campaigns.length,1);
 await notifications(db,admin,{action:'delete',id});assert.equal(db.data.notifications.bob['campaign_'+id],undefined);
});
