const {fail}=require('./core.cjs');
const crypto=require('node:crypto');
const key=/^[a-zA-Z0-9_-]{1,128}$/;
module.exports=async function notifications(db,user,body){
 if(user.isAdmin!==true)fail('Acesso restrito ao administrador.',403);
 const root='adminNotificationCampaigns';
 if(body.action==='list'){
  const raw=(await db.ref(root).get()).val()||{};
  return {campaigns:Object.entries(raw).map(([id,n])=>({...n,id})).sort((a,b)=>b.createdAt-a.createdAt)};
 }
 if(!['save','delete'].includes(body.action))fail('Ação inválida.');
 const id=body.id||crypto.randomUUID();
 if(!key.test(id))fail('Notificação inválida.');
 const existing=(await db.ref(root+'/'+id).get()).val();
 if(body.id&&!existing)fail('Notificação não encontrada.',404);
 const updates={};
 if(body.action==='delete'){
  if(!existing)fail('Notificação não encontrada.',404);
  if(body.uid){
   if(!key.test(body.uid)||!existing.recipients?.[body.uid])fail('Destinatário inválido.');
   updates['notifications/'+body.uid+'/campaign_'+id]=null;
   updates[root+'/'+id+'/recipients/'+body.uid]=null;
  }else{
   for(const uid of Object.keys(existing.recipients||{}))updates['notifications/'+uid+'/campaign_'+id]=null;
   updates[root+'/'+id]=null;
  }
 }else{
  const title=typeof body.title==='string'?body.title.trim():'';
  const message=typeof body.message==='string'?body.message.trim():'';
  if(!title||title.length>150||!message||message.length>1000)fail('Preencha título e mensagem dentro do limite.');
  let recipients=existing?.recipients||{},target=existing?.target||body.target;
  if(!existing){
   const users=(await db.ref('users').get()).val()||{};
   if(target!=='all'&&(!key.test(target||'')||!users[target]||users[target].isAdmin))fail('Selecione um cliente válido.');
   recipients=Object.fromEntries(Object.entries(users).filter(([uid,u])=>!u.isAdmin&&(target==='all'||uid===target)).map(([uid])=>[uid,true]));
   if(!Object.keys(recipients).length)fail('Nenhum cliente cadastrado para receber.');
  }
  const now=Date.now();
  updates[root+'/'+id]={title,message,target,recipients,createdAt:existing?.createdAt||now,createdBy:existing?.createdBy||user.uid,updatedAt:now};
  for(const uid of Object.keys(recipients)){
   const path='notifications/'+uid+'/campaign_'+id;
   if(existing){updates[path+'/title']=title;updates[path+'/message']=message;updates[path+'/updatedAt']=now;}
   else updates[path]={type:'info',campaignId:id,title,message,createdAt:now,read:false};
  }
 }
 await db.ref().update(updates);
 return {saved:true,id};
};
