(function(){
'use strict';
const role=document.currentScript?.dataset.supportRole||'visitor';
const svg={chat:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',headset:'<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 13h4v7H5a2 2 0 0 1-2-2v-5Zm18 0h-4v7h2a2 2 0 0 0 2-2v-5ZM17 21h-5"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',back:'<path d="m15 18-6-6 6-6"/>'};
function icon(name){const span=document.createElement('span');span.innerHTML='<svg class="cs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(svg[name]||svg.chat)+'</svg>';return span.firstChild;}
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function iconButton(name,label,className='cs-icon-button'){const button=element('button',className);button.type='button';button.title=label;button.setAttribute('aria-label',label);button.append(icon(name));return button;}
function avatar(profile){const box=element('span','cs-avatar');box.append(icon('user'));if(profile.type!=='visitor'&&/^https:\/\//.test(profile.photoURL||'')){const img=element('img');img.src=profile.photoURL;img.alt='';img.onerror=()=>img.remove();box.append(img);}return box;}
function labelDate(value,full=false){if(!value)return '';return new Date(value).toLocaleString('pt-BR',full?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}:{hour:'2-digit',minute:'2-digit'});}
let app,wantsOpen=false;
window.CimSupport={open:function(){if(app)app.open();else wantsOpen=true;}};
function init(){
 const admin=role==='admin',host=admin?document.getElementById('supportCenter'):document.body;
 if(!host)return;
 const shell=element('section',admin?'cs-center':'cs-widget');
 if(!admin){shell.hidden=true;shell.setAttribute('role','dialog');shell.setAttribute('aria-label','Chat com o suporte CIM');}
 host.append(shell);
 let listNode,searchNode,centerEmpty;
 if(admin){
  const pane=element('aside','cs-list-pane'),head=element('div','cs-list-head');
  head.append(element('h3','', 'Conversas'),element('p','','Atenda clientes e visitantes em um só lugar.'));
  searchNode=element('input','cs-search');searchNode.placeholder='Buscar por nome ou e-mail';searchNode.setAttribute('aria-label','Buscar conversas');head.append(searchNode);
  listNode=element('div','cs-list');pane.append(head,listNode);shell.append(pane);
 }
 const chatPane=element('div','cs-chat-pane'),top=element('header','cs-top'),back=iconButton('back','Voltar para conversas','cs-icon-button cs-back');
 back.hidden=!admin;top.append(back);const identity=element('span','cs-brand'),brandPhoto=element('img');brandPhoto.src='assets/logo.webp';brandPhoto.alt='CIM Global Parts';identity.append(brandPhoto);top.append(identity);
 const info=element('div','cs-top-info'),title=element('strong','cs-title',admin?'Selecione uma conversa':'CIM Global Parts'),subtitle=element('span','cs-subtitle',admin?'Clientes e visitantes':role==='visitor'?'':'Histórico salvo na sua conta');
 const verified=element('span','cs-verified');verified.setAttribute('role','img');verified.setAttribute('aria-label','Perfil oficial CIM');verified.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 1 2.8 2 3.4-.1 1 3.2L22 8l-.6 3.4L23 14.3l-2.5 2.3-.5 3.3-3.4.4L14 22.5l-3-1.4-3.2.7-1.7-2.9L3 17.5l.2-3.4L1 11.5l1.8-2.9.3-3.3 3.3-.8L8.5 2z"/><path d="m7.5 12 3 3 6-6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';const titleRow=element('div','cs-title-row');titleRow.append(title);if(!admin)titleRow.append(verified);subtitle.hidden=!subtitle.textContent;info.append(titleRow,subtitle);top.append(info);
 const remove=iconButton('trash','Excluir atendimento do visitante','cs-icon-button cs-delete');remove.hidden=true;
 if(admin)top.append(remove);
 const close=iconButton('close','Fechar suporte');if(!admin)top.append(close);
 const intro=element('div','cs-intro',role==='visitor'?'Ao atualizar ou sair desta página, um novo atendimento será iniciado.':admin?'':'Suas mensagens ficam salvas nesta conta para você continuar depois.');intro.hidden=admin;
 const messages=element('div','cs-messages');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');messages.setAttribute('aria-label','Mensagens do atendimento');
 const older=element('button','cs-older','Carregar mensagens anteriores');older.type='button';older.hidden=true;messages.append(older);
 const empty=element('div','cs-empty');empty.append(icon('chat'),element('strong','',admin?'Sua central de atendimento':'Como podemos ajudar?'),element('span','',admin?'Selecione uma conversa para ler e responder.':'Escreva sua mensagem para falar com a equipe CIM.'));messages.append(empty);
 const form=element('form','cs-composer'),input=element('textarea'),send=iconButton('send','Enviar mensagem','cs-send');
 input.rows=1;input.maxLength=2000;input.placeholder='Escreva uma mensagem...';input.setAttribute('aria-label','Sua mensagem');send.type='submit';send.disabled=true;form.append(input,send);
 const status=element('div','cs-status');status.setAttribute('role','status');
 const retry=element('button','cs-new','Tentar novamente');retry.type='button';retry.hidden=true;
 chatPane.append(top,intro,messages,form,status,retry);shell.append(chatPane);if(admin)form.hidden=true;
 let generation=0,roomId=null,visitorToken=null,connected=false,opened=false,busy=false,pending=null,lastFocus=null,all=new Map(),nodes=new Map(),messagesRef=null,timer=null,syncBusy=false,lastRead=0,inboxRef=null,chats=[],activeUser=null,auth=null,db=null;
 if(role!=='visitor'){try{auth=firebase.auth();db=firebase.database();}catch{}}
 function statusText(value){status.textContent=value||'';}
 function isVisible(){return !document.hidden&&(admin?document.getElementById('panel-suporte')?.classList.contains('active'):opened);}
 function clearMessages(){all.clear();nodes.clear();messages.replaceChildren(older,empty);older.hidden=true;empty.hidden=false;lastRead=0;}
 function detach(){if(messagesRef)messagesRef.off();messagesRef=null;if(timer)clearInterval(timer);timer=null;}
 function reset(){generation++;detach();roomId=null;visitorToken=null;connected=false;busy=false;pending=null;syncBusy=false;clearMessages();input.value='';input.disabled=false;send.disabled=true;remove.hidden=true;retry.hidden=true;statusText('');}
 async function api(op,extra={},id=roomId){
  const body={op,channel:role,chatId:id,...(role==='visitor'?{visitorToken}:{}),...extra},headers={'Content-Type':'application/json'};
  if(role!=='visitor'){const user=auth?.currentUser;if(!user)throw Error('Entre na sua conta para acessar o suporte.');headers.Authorization='Bearer '+await user.getIdToken();}
  const response=await fetch('/api/support',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok){const error=Error(data?.error||'Não foi possível acessar o suporte agora.');error.status=response.status;throw error;}
  if(!data)throw Error('Não foi possível acessar o suporte agora.');
  return data;
 }
 function roomIdentity(meta){
  title.textContent=admin?(meta.type==='visitor'?'Visitante':meta.name||'Cliente'):'CIM Global Parts';
  subtitle.textContent=admin?(meta.type==='visitor'?'Visitante · Atendimento temporário':meta.email||'Cliente cadastrado'):(role==='visitor'?'':'Histórico salvo na sua conta');
  subtitle.hidden=!subtitle.textContent;if(admin){identity.className='';identity.replaceChildren(avatar(meta));remove.hidden=meta.type!=='visitor';}
 }
 function ack(){
  if(!roomId||!isVisible()||!all.size)return;
  const seq=Math.max(...Array.from(all.values(),m=>m.seq));if(seq<=lastRead)return;
  const id=roomId,g=generation;lastRead=seq;
  api('read',{seq},id).catch(()=>{if(g===generation)lastRead=0;});
 }
 function showMessages(incoming,keepPosition=false){
  const nearBottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<120,oldHeight=messages.scrollHeight,oldTop=messages.scrollTop;
  const added=incoming.filter(message=>!all.has(message.id));if(!added.length){ack();return;}
  for(const message of incoming)all.set(message.id,message);
  empty.hidden=all.size>0;
  for(const message of added.sort((a,b)=>a.seq-b.seq)){
   const own=admin?message.role==='admin':message.role!=='admin',bubble=element('article','cs-message'+(message.role==='admin'?' cs-admin-message':'')+(own?' cs-own':''));
   bubble.dataset.seq=String(message.seq);bubble.append(element('span','cs-message-author',message.role==='admin'?'Equipe CIM':admin?(role==='admin'?(message.role==='visitor'?'Visitante':title.textContent):'Cliente'):'Você'),element('p','cs-message-text',message.text));
   const time=element('time','',labelDate(message.createdAt,true));time.dateTime=new Date(message.createdAt).toISOString();time.title=labelDate(message.createdAt,true);bubble.append(time);
   const after=Array.from(nodes.values()).reduce((found,node)=>Number(node.dataset.seq)>message.seq&&(!found||Number(node.dataset.seq)<Number(found.dataset.seq))?node:found,null);
   if(after)messages.insertBefore(bubble,after);else messages.append(bubble);nodes.set(message.id,bubble);
  }
  older.hidden=Math.min(...Array.from(all.values(),m=>m.seq))<=1;
  if(keepPosition)messages.scrollTop=oldTop+(messages.scrollHeight-oldHeight);else if(nearBottom||all.size===added.length)messages.scrollTop=messages.scrollHeight;
  ack();
 }
 function ended(){
  detach();connected=false;clearMessages();empty.hidden=false;empty.replaceChildren(icon('chat'),element('strong','','Atendimento encerrado'),element('span','','Esta conversa foi encerrada pela equipe CIM.'));
  input.disabled=true;send.disabled=true;statusText('');
  if(role==='visitor'){retry.textContent='Iniciar novo atendimento';retry.hidden=false;}
 }
 async function sync(){
  if(!roomId||syncBusy)return;
  const g=generation;syncBusy=true;
  try{const data=await api('sync');if(g!==generation)return;roomIdentity(data.meta);showMessages(data.messages);statusText('');}
  catch(error){if(g!==generation)return;if(error.status===410)ended();else statusText(error.message);}
  finally{if(g===generation)syncBusy=false;}
 }
 function listen(){
  detach();
  if(role==='visitor'){timer=setInterval(()=>{if(isVisible())sync();},2500);return;}
  if(!db)return;
  const g=generation;
  messagesRef=db.ref('supportRooms/'+roomId+'/messages').orderByChild('seq').limitToLast(50);
  messagesRef.on('value',snap=>{if(g===generation)showMessages(Object.values(snap.val()||{}).sort((a,b)=>a.seq-b.seq));},()=>{if(g===generation)statusText('Não foi possível acompanhar as mensagens. Feche e abra o atendimento para tentar novamente.');});
 }
 async function connect(selected){
  const g=++generation;detach();syncBusy=false;connected=false;send.disabled=true;statusText('');retry.hidden=true;
  try{
   if(selected){roomId=selected.chatId;roomIdentity(selected);}
   else if(!roomId){const data=await api('open',{channel:role});if(g!==generation)return;roomId=data.chatId;visitorToken=data.visitorToken||null;roomIdentity(data.meta);}
   const data=await api('sync');if(g!==generation)return;roomIdentity(data.meta);showMessages(data.messages);
   connected=true;input.disabled=false;send.disabled=false;statusText('');listen();ack();
  }catch(error){if(g!==generation)return;if(error.status===410)ended();else{statusText(error.message);retry.textContent='Tentar novamente';retry.hidden=false;}}
 }
 function open(){
  if(admin){document.querySelector('.sb-item[data-panel="suporte"]')?.click();return;}
  lastFocus=document.activeElement;if(typeof window.closeBottomMenu==='function')window.closeBottomMenu();
  opened=true;shell.hidden=false;
  if(connected){listen();sync();ack();}else connect();
  input.focus();
 }
 function shut(){opened=false;shell.hidden=true;detach();lastFocus?.focus?.();}
 app={open};close.addEventListener('click',shut);
 form.addEventListener('submit',async event=>{
  event.preventDefault();const text=input.value.trim();if(!text||!connected||busy)return;
  if(!pending||pending.text!==text)pending={text,requestId:crypto.randomUUID()};
  const outgoing={...pending},g=generation,id=roomId;busy=true;send.disabled=true;statusText('');
  try{const data=await api('send',outgoing,id);if(g!==generation)return;showMessages([data.message]);input.value='';pending=null;messages.scrollTop=messages.scrollHeight;input.focus();}
  catch(error){if(g===generation){if(error.status===410)ended();else statusText(error.message);}}
  finally{if(g===generation){busy=false;send.disabled=!connected;}}
 });
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
 input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,110)+'px';});
 older.addEventListener('click',async()=>{
  if(!all.size||older.disabled)return;older.disabled=true;const g=generation;
  try{const before=Math.min(...Array.from(all.values(),m=>m.seq)),data=await api('older',{before});if(g!==generation)return;showMessages(data.messages,true);if(!data.hasMore)older.hidden=true;}
  catch(error){if(g===generation)statusText(error.message);}finally{older.disabled=false;}
 });
 retry.addEventListener('click',()=>{if(role==='visitor'&&!connected&&input.disabled){reset();empty.replaceChildren(icon('chat'),element('strong','','Como podemos ajudar?'));}connect();});
 document.addEventListener('visibilitychange',()=>{if(isVisible()){if(role==='visitor')sync();ack();}});
 if(!admin){
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.stopPropagation();shut();}});
  window.addEventListener('pagehide',()=>{shut();if(role==='visitor')reset();});
 }
 back.addEventListener('click',()=>shell.classList.remove('cs-selected'));
 if(admin){
  searchNode.addEventListener('input',renderList);
  const panel=document.getElementById('panel-suporte');
  if(panel)new MutationObserver(()=>{if(panel.classList.contains('active'))ack();}).observe(panel,{attributes:true,attributeFilter:['class']});
  remove.addEventListener('click',async()=>{
   const selected=chats.find(chat=>chat.chatId===roomId);if(!selected||selected.type!=='visitor')return;
   if(!confirm('Excluir este atendimento de visitante e suas mensagens?'))return;
   remove.disabled=true;const id=roomId;
   try{await api('delete',{},id);if(id===roomId){reset();form.hidden=true;shell.classList.remove('cs-selected');title.textContent='Selecione uma conversa';subtitle.textContent='Clientes e visitantes';}statusText('Atendimento do visitante excluído.');}
   catch(error){statusText(error.message);}finally{remove.disabled=false;}
  });
 }
 function renderList(){
  if(!admin)return;
  const query=searchNode.value.trim().toLocaleLowerCase('pt-BR'),filtered=chats.filter(chat=>[chat.name,chat.email,chat.type==='visitor'?'Visitante':'Cliente'].join(' ').toLocaleLowerCase('pt-BR').includes(query));
  const fragment=document.createDocumentFragment();
  if(!filtered.length){const note=element('div','cs-empty');note.append(icon('chat'),element('strong','','Nenhuma conversa'),element('span','','Os novos atendimentos aparecerão aqui.'));fragment.append(note);}
  for(const chat of filtered){
   const button=element('button','cs-thread'+(roomId===chat.chatId?' is-selected':''));button.type='button';button.setAttribute('aria-pressed',String(roomId===chat.chatId));
   button.append(avatar(chat));const body=element('span','cs-thread-body'),row=element('span','cs-thread-top');
   row.append(element('strong','cs-thread-name',chat.type==='visitor'?'Visitante':chat.name||'Cliente'),element('time','cs-thread-time',labelDate(chat.updatedAt)));
   body.append(row);if(chat.type==='customer'&&chat.email)body.append(element('span','cs-thread-email',chat.email));else body.append(element('span','cs-thread-email','Visitante · Sem conta'));
   body.append(element('span','cs-thread-preview',(chat.lastRole==='admin'?'Equipe CIM: ':'')+chat.lastText));button.append(body);
   if(chat.unread){const dot=element('span','cs-unread-dot');dot.setAttribute('role','img');dot.setAttribute('aria-label','Mensagem não lida');button.append(dot);}
   button.addEventListener('click',()=>{if(roomId===chat.chatId){shell.classList.add('cs-selected');ack();return;}reset();roomId=chat.chatId;form.hidden=false;shell.classList.add('cs-selected');renderList();connect(chat);});
   fragment.append(button);
  }
  listNode.replaceChildren(fragment);
  const badge=document.getElementById('supportUnreadBadge');if(badge){const count=chats.filter(chat=>chat.unread).length;badge.textContent=String(count);badge.hidden=count===0;}
 }
 if(auth){
  auth.onAuthStateChanged(user=>{
   if(activeUser===user?.uid)return;activeUser=user?.uid||null;reset();
   if(inboxRef)inboxRef.off();inboxRef=null;
   if(admin){chats=[];renderList();form.hidden=true;if(user){inboxRef=db.ref('supportInbox').orderByChild('deleted').equalTo(false);inboxRef.on('value',snap=>{
    chats=Object.values(snap.val()||{}).sort((a,b)=>b.updatedAt-a.updatedAt);
    if(roomId&&!chats.some(chat=>chat.chatId===roomId)){reset();form.hidden=true;shell.classList.remove('cs-selected');}
    renderList();
   },()=>{listNode.replaceChildren(element('div','cs-empty','Não foi possível carregar as conversas. Entre novamente no ADM.'));});}}
   else if(opened&&user)connect();
  });
 }
 function fitSupport(){const viewport=window.visualViewport;shell.style.setProperty('--cs-viewport-height',(viewport?.height||window.innerHeight)+'px');shell.style.setProperty('--cs-viewport-top',(viewport?.offsetTop||0)+'px');if(admin&&host.getBoundingClientRect().width)shell.style.setProperty('--cs-center-height',Math.max(280,window.innerHeight-host.getBoundingClientRect().top-26)+'px');}fitSupport();window.addEventListener('resize',fitSupport);window.visualViewport?.addEventListener('resize',fitSupport);window.visualViewport?.addEventListener('scroll',fitSupport);if(admin){const panel=document.getElementById('panel-suporte');if(panel)new MutationObserver(fitSupport).observe(panel,{attributes:true,attributeFilter:['class']});}if(wantsOpen)open();
}
if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();
