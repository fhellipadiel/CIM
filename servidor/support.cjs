const crypto=require('node:crypto');
const {fail}=require('./core.cjs');
const MAX_TEXT=2000,PAGE_SIZE=50;
const key=/^[A-Za-z0-9_-]{8,200}$/;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function findProducts(raw,query){const terms=normalize(query).split(' ').filter(term=>term.length>1);if(!terms.length)return[];return Object.entries(raw||{}).map(([id,item])=>{const text=normalize([item?.name,item?.codigo,item?.brand,item?.category].join(' '));const score=terms.reduce((total,term)=>total+(text.includes(term)?3:text.split(' ').some(word=>word.startsWith(term)||term.startsWith(word))?1:0),0);return{id,name:String(item?.name||'Peça'),code:String(item?.codigo||''),image:typeof item?.image==='string'?item.image:'',score};}).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR')).slice(0,4);}
async function transaction(ref,update){const retain=()=>{};ref.on('value',retain);try{await ref.once('value');return await ref.transaction(update);}finally{ref.off('value',retain);}}
function cleanMeta(meta){return {type:meta.type,name:meta.type==='visitor'?(meta.contactName||'Visitante'):meta.name||'Cliente',customerType:meta.customerType==='PF'||meta.customerType==='PJ'?meta.customerType:'',email:meta.type==='customer'?meta.email||'':'',photoURL:meta.type==='customer'?meta.photoURL||'':'',createdAt:meta.createdAt,deleted:!!meta.deleted};}
function profilePhoto(value){return typeof value==='string'&&/^https:\/\//.test(value)&&!/(default-avatar|assets\/logo\.)/i.test(value)?value.slice(0,500):'';}
async function publicStaff(db){
 const employees=(await db.ref('employees').get()).val()||{};
 return Object.values(employees).filter(employee=>employee?.enabled===true&&profilePhoto(employee.photoURL)).slice(0,8).map(employee=>({name:String(employee.name||'Atendente').trim().split(/\s+/)[0].slice(0,40)||'Atendente',photoURL:profilePhoto(employee.photoURL)}));
}
async function publishSummary(db,id,meta,text){
 const info={chatId:id,type:meta.type,name:meta.type==='visitor'?(meta.contactName||'Visitante'):meta.name||'Cliente',customerType:meta.customerType==='PF'||meta.customerType==='PJ'?meta.customerType:'',email:meta.type==='customer'?meta.email||'':'',photoURL:meta.type==='customer'?meta.photoURL||'':'',updatedAt:meta.updatedAt||meta.createdAt,lastText:String(text||'').slice(0,180),lastRole:meta.lastRole||'',lastSeq:meta.seq||0,messageCount:meta.seq||0,lastCustomerSeq:meta.lastCustomerSeq||0,adminReadSeq:meta.adminReadSeq||0,unread:(meta.lastCustomerSeq||0)>(meta.adminReadSeq||0),deleted:false};
 await transaction(db.ref('supportInbox/'+id),current=>{if(current?.deleted)return;if(current&&(current.lastSeq||0)>info.lastSeq)return;const adminReadSeq=Math.max(current?.adminReadSeq||0,info.adminReadSeq);return {...info,adminReadSeq,unread:info.lastCustomerSeq>adminReadSeq};});
}
function typeFromMessage(text){const normalized=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(/\bpessoa\s*fisica\b/.test(normalized))return 'PF';if(/\bpessoa\s*juridica\b/.test(normalized))return 'PJ';return '';}
function typeFromMessages(messages){for(const message of Object.values(messages||{}).sort((a,b)=>(b.seq||0)-(a.seq||0))){const type=message?.role==='admin'?'':typeFromMessage(message.text);if(type)return type;}return '';}
async function restoreCustomerType(db,id,room){
 const current=room?.meta;if(!current||current.deleted)return current;
 const customerType=current.customerType==='PF'||current.customerType==='PJ'?current.customerType:typeFromMessages(room.messages);
 if(!customerType)return current;
 if(current.customerType===customerType)return current;
 const result=await transaction(db.ref('supportRooms/'+id+'/meta'),meta=>meta&&!meta.deleted?{...meta,customerType}:undefined);
 if(!result.committed)return result.snapshot.val()||current;
 const updated=result.snapshot.val();await publishSummary(db,id,updated,updated.lastText||'');return updated;
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
  const chats=await Promise.all(Object.values(raw).map(async chat=>{
   if(chat.customerType==='PF'||chat.customerType==='PJ')return chat;
   const room=(await db.ref('supportRooms/'+chat.chatId).get()).val();const meta=await restoreCustomerType(db,chat.chatId,room);
   return meta?.customerType?{...chat,name:meta.type==='visitor'?(meta.contactName||chat.name):meta.name||chat.name,customerType:meta.customerType}:chat;
  }));
  return {chats:chats.sort((a,b)=>b.updatedAt-a.updatedAt)};
 }
 if(!key.test(body.chatId||''))fail('Conversa invalida.',400);
 const id=body.chatId,roomRef=db.ref('supportRooms/'+id);
 let meta=(await db.ref('supportRooms/'+id+'/meta').get()).val();
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
  if(op==='sync'&&meta.customerType!=='PF'&&meta.customerType!=='PJ'){
   const room=(await roomRef.get()).val();meta=await restoreCustomerType(db,id,room);
  }
  if(op==='sync'&&meta.awaitingSalesEscalation&&Number(meta.salesEscalationAt)<=now){
   const escalationText='Sua solicitação foi encaminhada para o setor de vendas. Nossa equipe continuará o atendimento por aqui.';
   const escalated=await transaction(roomRef,current=>{
    if(!current?.meta||current.meta.deleted||!current.meta.awaitingSalesEscalation||Number(current.meta.salesEscalationAt)>now)return;
    const seq=(current.meta.seq||0)+1,id='sales_'+String(current.meta.salesEscalationAt);
    return {...current,meta:{...current.meta,seq,updatedAt:now,lastAdminSeq:seq,lastRole:'admin',lastText:escalationText,awaitingSalesEscalation:false},messages:{...current.messages,[id]:{id,seq,role:'admin',kind:'sales_forwarded',text:escalationText,createdAt:now}}};
   });
   if(escalated.committed){meta=escalated.snapshot.val().meta;await publishSummary(db,id,meta,escalationText);}
  }
  if(op==='sync'&&meta.awaitingVendor&&Number(meta.vendorFallbackAt)<=now){
   const text='Encontramos 2 vendedores online agora. Clique aqui para falar pelo nosso canal oficial do WhatsApp.';
   const result=await transaction(roomRef,current=>{if(!current?.meta||current.meta.deleted||!current.meta.awaitingVendor||Number(current.meta.vendorFallbackAt)>now)return;const seq=(current.meta.seq||0)+1,messageId='vendor_'+String(current.meta.vendorFallbackAt);return {...current,meta:{...current.meta,seq,updatedAt:now,lastAdminSeq:seq,lastRole:'admin',lastText:text,awaitingVendor:false},messages:{...current.messages,[messageId]:{id:messageId,seq,role:'admin',kind:'vendor_whatsapp',text,href:'https://wa.me/5511986866888',createdAt:now}}};});
   if(result.committed){meta=result.snapshot.val().meta;await publishSummary(db,id,meta,text);}
  }
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
  const catalog=channel==='admin'?null:(await db.ref('products').get()).val()||{};
  let reason='Conversa indisponivel.',status=409;
  const result=await transaction(roomRef,current=>{
   if(!current?.meta||current.meta.deleted){reason='Este atendimento foi encerrado pela equipe.';status=410;return;}
   const old=current.messages?.[body.requestId];
   const role=channel==='admin'?'admin':current.meta.type;
   if(old){if(old.role===role&&old.text===text)return current;return;}
   const window=Math.floor(now/60000),rate=current.meta.messageWindow===window?(current.meta.messageCount||0):0;
   if(rate>=30){reason='Aguarde um momento antes de enviar mais mensagens.';status=429;return;}
   const seq=(current.meta.seq||0)+1,normalized=normalize(text),selectedType=/^pessoa\s*fisica$/.test(normalized)?'PF':/^pessoa\s*juridica$/.test(normalized)?'PJ':'';
   const shouldPrompt=role!=='admin'&&!current.meta.customerTypePrompted&&!selectedType;
   const shouldAskName=role!=='admin'&&!!selectedType&&!current.meta.contactName;
   const shouldConfirmName=role!=='admin'&&current.meta.awaitingContactName&&!selectedType;
   const choice=current.meta.awaitingServiceChoice&&['falar com vendedor','consultar pecas','relatar problema'].includes(normalized)?normalized:'';
   const shouldSearch=role!=='admin'&&current.meta.awaitingPartSearch;
   const shouldReceiveProblem=role!=='admin'&&current.meta.awaitingProblem;
   const hasAutoReply=shouldPrompt||shouldAskName||shouldConfirmName||choice||shouldSearch||shouldReceiveProblem,finalSeq=hasAutoReply?seq+1:seq;
   const contactName=shouldConfirmName?text.replace(/\s+/g,' ').slice(0,120):current.meta.contactName;
   const updated={...current.meta,...(channel==='customer'?{name:String(profile.name||'Cliente').slice(0,200),email:caller.email||profile.email||'',photoURL:profilePhoto(profile.photoURL)}:{}),seq:finalSeq,updatedAt:now,lastRole:role,lastText:text,messageWindow:window,messageCount:rate+1,...(role==='admin'?{lastAdminSeq:seq,lastHumanAdminSeq:seq,awaitingSalesEscalation:false,awaitingVendor:false}:{lastCustomerSeq:seq}),...(selectedType?{customerType:selectedType,customerTypePrompted:true,awaitingContactName:true}:{}),...(shouldPrompt?{customerTypePrompted:true}:{}),...(shouldConfirmName?{contactName,awaitingContactName:false,awaitingServiceChoice:true}:{}),...(choice==='falar com vendedor'?{awaitingServiceChoice:false,awaitingVendor:true,vendorFallbackAt:now+60000}:{}),...(choice==='consultar pecas'?{awaitingServiceChoice:false,awaitingPartSearch:true}:{}),...(choice==='relatar problema'?{awaitingServiceChoice:false,awaitingProblem:true}:{}),...(shouldSearch?{awaitingPartSearch:false}:{}),...(shouldReceiveProblem?{awaitingProblem:false}:{}),...(hasAutoReply?{lastAdminSeq:finalSeq}:{})};
   const message={id:body.requestId,seq,role,text,createdAt:now};
   const messages={...current.messages,[body.requestId]:message};
   if(hasAutoReply){const results=shouldSearch?findProducts(catalog,text):[],suffix=shouldPrompt?'_type':shouldAskName?'_name':shouldConfirmName?'_service':choice==='falar com vendedor'?'_seller':choice==='consultar pecas'?'_parts':choice==='relatar problema'?'_problem':shouldSearch?'_results':'_admin',autoId=(body.requestId+suffix).slice(0,200),kind=shouldPrompt?'customer_type_prompt':shouldAskName?'customer_name_prompt':shouldConfirmName?'service_choice':choice==='falar com vendedor'?'vendor_waiting':choice==='consultar pecas'?'part_prompt':choice==='relatar problema'?'problem_prompt':shouldSearch?'product_results':'problem_forwarded',autoText=shouldPrompt?'Olá! Para direcionarmos seu atendimento à equipe certa, você poderia informar como deseja ser atendido?':shouldAskName?'Perfeito! Agora, por favor, informe seu nome para continuarmos o atendimento.':shouldConfirmName?'Como você deseja ser atendido?':choice==='falar com vendedor'?'Estamos encaminhando você para um vendedor online.':choice==='consultar pecas'?'Quais peças você precisa? Descreva o nome, código, marca ou veículo.':choice==='relatar problema'?'Qual problema você deseja relatar?':shouldSearch?(results.length?'Encontramos estas opções no catálogo:':'Não encontramos essa peça no catálogo no momento. Tente informar código, marca, veículo ou outra descrição.'):'Seu relato foi encaminhado para o setor de Administração.';messages[autoId]={id:autoId,seq:finalSeq,role:'admin',kind,text:autoText,createdAt:now+1,...(kind==='service_choice'?{options:['Falar com vendedor','Consultar peças','Relatar problema']}:{}),...(kind==='product_results'?{products:results}: {})};}
   return {...current,meta:updated,messages};
  });
  if(!result.committed)fail(reason,status);
  const room=result.snapshot.val(),message=room.messages[body.requestId];
  await publishSummary(db,id,room.meta,room.meta.lastText||message.text);
  const autoMessage=Object.values(room.messages).find(item=>item.seq===message.seq+1&&item.role==='admin')||null;
  return {message,autoMessage,...(autoMessage?.kind==='customer_forwarded'?{staff:await publicStaff(db)}:{})};
 }
 fail('Operacao de suporte invalida.',400);
}
module.exports={handleSupport};
