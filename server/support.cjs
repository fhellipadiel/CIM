const crypto=require('node:crypto');
const {fail}=require('./core.cjs');
const MAX_TEXT=2000,PAGE_SIZE=50;
const key=/^[A-Za-z0-9_-]{8,200}$/;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function transaction(ref,update){const retain=()=>{};ref.on('value',retain);try{await ref.once('value');return await ref.transaction(update);}finally{ref.off('value',retain);}}
function cleanMeta(meta){return {type:meta.type,name:meta.type==='visitor'?'Visitante':meta.name||'Cliente',email:meta.type==='customer'?meta.email||'':'',photoURL:meta.type==='customer'?meta.photoURL||'':'',createdAt:meta.createdAt,deleted:!!meta.deleted};}
function profilePhoto(value){return typeof value==='string'&&/^https:\/\//.test(value)&&!/(default-avatar|assets\/logo\.)/i.test(value)?value.slice(0,500):'';}
async function publishSummary(db,id,meta,text){
 const info={chatId:id,type:meta.type,name:meta.type==='visitor'?'Visitante':meta.name||'Cliente',email:meta.type==='customer'?meta.email||'':'',photoURL:meta.type==='customer'?meta.photoURL||'':'',updatedAt:meta.updatedAt||meta.createdAt,lastText:String(text||'').slice(0,180),lastRole:meta.lastRole||'',lastSeq:meta.seq||0,lastCustomerSeq:meta.lastCustomerSeq||0,adminReadSeq:meta.adminReadSeq||0,unread:(meta.lastCustomerSeq||0)>(meta.adminReadSeq||0),deleted:false};
 await transaction(db.ref('supportInbox/'+id),current=>{if(current?.deleted)return;if(current&&(current.lastSeq||0)>info.lastSeq)return;const adminReadSeq=Math.max(current?.adminReadSeq||0,info.adminReadSeq);return {...info,adminReadSeq,unread:info.lastCustomerSeq>adminReadSeq};});
}
async function handleSupport({db,req,body,verifyCaller,requireAdmin,now=Date.now()}){
 if(!body||typeof body!=='object'||Array.isArray(body))fail('Solicitacao invalida.',400);
 const op=body.op,channel=body.channel;
 if(!['visitor','customer','admin'].includes(channel))fail('Solicitacao de suporte invalida.',400);
 let caller=null,profile=null;
 if(channel!=='visitor'){
  caller=await verifyCaller();
  if(channel==='admin')await requireAdmin();
  profile=(await db.ref('users/'+caller.uid).get()).val();
  if(!profile)fail('Conclua seu cadastro para conversar com o suporte.',403);
 }
 if(op==='open'){
  if(channel==='admin')fail('Selecione uma conversa.',400);
  if(channel==='visitor'){
   const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
   const window=Math.floor(now/600000),rate=await transaction(db.ref('supportRateLimits/'+hash(ip)),previous=>{
    const next=previous?.window===window?previous:{window,count:0};if(next.count>=12)return;return {...next,count:next.count+1};
   });
   if(!rate.committed)fail('Muitas tentativas. Aguarde alguns minutos e tente novamente.',429);
   const id='visitor_'+crypto.randomUUID().replace(/-/g,''),visitorToken=crypto.randomBytes(32).toString('base64url');
   const meta={type:'visitor',name:'Visitante',visitorHash:hash(visitorToken),createdAt:now,updatedAt:now,seq:0,adminReadSeq:0,customerReadSeq:0,deleted:false};
   await db.ref('supportRooms/'+id).set({meta});
   return {chatId:id,visitorToken,meta:cleanMeta(meta),messages:[]};
  }
  const id='customer_'+hash(caller.uid);
  const result=await transaction(db.ref('supportRooms/'+id),current=>{
   if(current){if(current.meta?.type==='customer'&&current.meta.ownerUid===caller.uid&&!current.meta.deleted)return {...current,meta:{...current.meta,name:String(profile.name||'Cliente').slice(0,200),email:caller.email||profile.email||'',photoURL:profilePhoto(profile.photoURL)}};return current;}
   return {meta:{type:'customer',ownerUid:caller.uid,name:String(profile.name||'Cliente').slice(0,200),email:caller.email||profile.email||'',photoURL:profilePhoto(profile.photoURL),createdAt:now,updatedAt:now,seq:0,adminReadSeq:0,customerReadSeq:0,deleted:false}};
  });
  const meta=result.snapshot.val().meta;
  if(meta.seq)await publishSummary(db,id,meta,meta.lastText||'');
  return {chatId:id,meta:cleanMeta(meta)};
 }
 if(op==='list'){
  if(channel!=='admin')fail('Acesso restrito.',403);
  const raw=(await db.ref('supportInbox').orderByChild('deleted').equalTo(false).get()).val()||{};
  return {chats:Object.values(raw).sort((a,b)=>b.updatedAt-a.updatedAt)};
 }
 if(!key.test(body.chatId||''))fail('Conversa invalida.',400);
 const id=body.chatId,roomRef=db.ref('supportRooms/'+id);
 const meta=(await db.ref('supportRooms/'+id+'/meta').get()).val();
 if(!meta)fail('Conversa indisponivel.',404);
 if(channel==='visitor'){
  if(meta.type!=='visitor'||typeof body.visitorToken!=='string'||body.visitorToken.length>100)fail('Conversa indisponivel.',403);
  if(meta.deleted)fail('Este atendimento foi encerrado pela equipe.',410);
  const stored=Buffer.from(meta.visitorHash||'','hex'),provided=Buffer.from(hash(body.visitorToken),'hex');
  if(stored.length!==provided.length||!crypto.timingSafeEqual(stored,provided))fail('Conversa indisponivel.',403);
 }else if(channel==='customer'&&(meta.type!=='customer'||meta.ownerUid!==caller.uid))fail('Conversa indisponivel.',403);
 if(meta.deleted&&op!=='delete')fail('Este atendimento foi encerrado pela equipe.',410);
 if(op==='delete'){
  if(channel!=='admin'||meta.type!=='visitor')fail('Conversas de clientes nao podem ser excluidas.',403);
  const result=await transaction(roomRef,current=>current?.meta?.type==='visitor'?{meta:{type:'visitor',deleted:true,deletedAt:now}}:undefined);
  if(!result.committed)fail('Nao foi possivel excluir esta conversa.',409);
  await transaction(db.ref('supportInbox/'+id),()=>({chatId:id,type:'visitor',deleted:true,updatedAt:now}));
  return {deleted:true};
 }
 if(op==='sync'||op==='older'){
  let query=db.ref('supportRooms/'+id+'/messages').orderByChild('seq');
  if(op==='older'){if(!Number.isSafeInteger(body.before)||body.before<1)fail('Pagina invalida.',400);query=query.endAt(body.before-1);}
  const messages=Object.values((await query.limitToLast(PAGE_SIZE).get()).val()||{}).sort((a,b)=>a.seq-b.seq);
  return {chatId:id,meta:cleanMeta(meta),messages,hasMore:messages.length===PAGE_SIZE&&messages[0].seq>1};
 }
 if(op==='read'){
  if(!Number.isSafeInteger(body.seq)||body.seq<0)fail('Leitura invalida.',400);
  const field=channel==='admin'?'adminReadSeq':'customerReadSeq';
  const result=await transaction(db.ref('supportRooms/'+id+'/meta'),current=>{
   if(!current||current.deleted)return;
   return {...current,[field]:Math.max(current[field]||0,Math.min(current.seq||0,body.seq))};
  });
  if(result.committed&&channel==='admin'){
   const updated=result.snapshot.val();
   await transaction(db.ref('supportInbox/'+id),current=>current&&!current.deleted?{...current,adminReadSeq:Math.max(current.adminReadSeq||0,updated.adminReadSeq),unread:(current.lastCustomerSeq||updated.lastCustomerSeq||0)>Math.max(current.adminReadSeq||0,updated.adminReadSeq)}:undefined);
  }
  return {read:true};
 }
 if(op==='send'){
  const text=typeof body.text==='string'?body.text.trim():'';
  if(!text||text.length>MAX_TEXT||!key.test(body.requestId||''))fail('Escreva uma mensagem de ate 2000 caracteres.',400);
  let reason='Conversa indisponivel.',status=409;
  const result=await transaction(roomRef,current=>{
   if(!current?.meta||current.meta.deleted){reason='Este atendimento foi encerrado pela equipe.';status=410;return;}
   const old=current.messages?.[body.requestId];
   const role=channel==='admin'?'admin':current.meta.type;
   if(old){if(old.role===role&&old.text===text)return current;return;}
   const window=Math.floor(now/60000),rate=current.meta.messageWindow===window?(current.meta.messageCount||0):0;
   if(rate>=30){reason='Aguarde um momento antes de enviar mais mensagens.';status=429;return;}
   const seq=(current.meta.seq||0)+1;
   const updated={...current.meta,...(channel==='customer'?{name:String(profile.name||'Cliente').slice(0,200),email:caller.email||profile.email||'',photoURL:profilePhoto(profile.photoURL)}:{}),seq,updatedAt:now,lastRole:role,lastText:text,messageWindow:window,messageCount:rate+1,...(role==='admin'?{lastAdminSeq:seq}:{lastCustomerSeq:seq})};
   const message={id:body.requestId,seq,role,text,createdAt:now};
   return {...current,meta:updated,messages:{...current.messages,[body.requestId]:message}};
  });
  if(!result.committed)fail(reason,status);
  const room=result.snapshot.val(),message=room.messages[body.requestId];
  await publishSummary(db,id,room.meta,room.meta.lastText||message.text);
  return {message};
 }
 fail('Operacao de suporte invalida.',400);
}
module.exports={handleSupport};
