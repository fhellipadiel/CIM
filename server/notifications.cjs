const {fail}=require('./core.cjs');
const crypto=require('node:crypto');
const key=/^[a-zA-Z0-9_-]{1,128}$/;
module.exports=async function notifications(db,user,body,dependencies={}){
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
 const updates={};let emailRecipients=[],recipientNames={};
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
  const emailSubject=(typeof body.emailSubject==='string'?body.emailSubject.trim():'')||title;
  const sourceDesign=body.emailDesign&&typeof body.emailDesign==='object'&&!Array.isArray(body.emailDesign)?body.emailDesign:{};
  const safeHttps=value=>{value=typeof value==='string'?value.trim():'';if(!value)return'';try{const url=new URL(value);return url.protocol==='https:'&&value.length<=500?value:''}catch{return''}};
  const validColor=(value,fallback)=>/^#[0-9a-fA-F]{6}$/.test(value||'')?value:fallback;
  const emailDesign={layout:'brand',showHeader:true,contentColor:'#080808',productCardColor:'#080808',titleColor:'#ffffff',textColor:'#ffffff',footerColor:'#b8b8b8',useBanner:false,bannerUrl:'',accent:'#ff3601',showLink:sourceDesign.showLink!==false,buttonText:'',buttonUrl:safeHttps(sourceDesign.buttonUrl),productIds:[],products:[]};
  if(!emailSubject||emailSubject.length>150||!title||title.length>150||!message||message.length>1000)fail('Preencha assunto, título e mensagem dentro do limite.');
  let recipients=existing?.recipients||{},target=existing?.target||body.target;
  if(false&&emailDesign.productIds.length){
   const [productSnap,promoSnap]=await Promise.all([db.ref('products').get(),db.ref('promocoes').get()]),productMap=productSnap.val()||{},promos=promoSnap.val()||{},now=Date.now();
   emailDesign.products=emailDesign.productIds.map(pid=>{const product=productMap[pid]||Object.values(productMap).find(item=>item?.id===pid);if(!product?.name)return null;const base=Number(product.prices?.[emailDesign.priceAudience])||0;let discount=0;Object.values(promos).forEach(promo=>{if(!promo?.ativa||(promo.dataExpiracao&&Number(promo.dataExpiracao)<=now)||!['ambos',emailDesign.priceAudience].includes(promo.tipoCliente||'ambos'))return;const match=(promo.tipo==='produto'&&promo.alvoId===pid)||(promo.tipo==='categoria'&&promo.alvoId===product.category)||(promo.tipo==='sessao'&&promo.alvoId===product.sessionId)||(promo.tipo==='todas_sessoes'&&product.sessionId)||(promo.tipo==='todas_categorias'&&product.category);if(match)discount=Math.max(discount,Math.max(0,Math.min(100,Number(promo.descontoPercentual)||0)))});return{id:pid,name:String(product.name).slice(0,160),image:safeHttps(product.image),base,promotional:discount&&base?Math.round(base*(1-discount/100)*100)/100:0,discount,url:'https://www.cimautoparts.com.br/cim.html?p='+encodeURIComponent(pid)}}).filter(Boolean);
  }else emailDesign.products=[];
  if(!existing){
   const users=(await db.ref('users').get()).val()||{};
   if(target!=='all'&&(!key.test(target||'')||!users[target]||users[target].isAdmin))fail('Selecione um cliente válido.');
   recipients=Object.fromEntries(Object.entries(users).filter(([uid,u])=>!u.isAdmin&&(target==='all'||uid===target)).map(([uid])=>[uid,true]));
   emailRecipients=Object.entries(users).filter(([uid,u])=>recipients[uid]&&!u.isAdmin).map(([uid,u])=>({uid,email:u.email,name:u.name}));
   recipientNames=Object.fromEntries(Object.entries(users).map(([uid,u])=>[uid,String(u.name||'Cliente').trim()||'Cliente']));
   if(!Object.keys(recipients).length)fail('Nenhum cliente cadastrado para receber.');
  }
  const now=Date.now();
  updates[root+'/'+id]={emailSubject,title,message,target,recipients,emailDesign,createdAt:existing?.createdAt||now,createdBy:existing?.createdBy||user.uid,updatedAt:now};
  for(const uid of Object.keys(recipients)){
   const path='notifications/'+uid+'/campaign_'+id;
   if(existing){updates[path+'/title']=title;updates[path+'/message']=message;updates[path+'/updatedAt']=now;}
   else{const name=recipientNames[uid]||'Cliente',replaceName=value=>value.replace(/\[nome\]/gi,name);updates[path]={type:'info',campaignId:id,title:replaceName(title),message:replaceName(message),createdAt:now,read:false};}
  }
 }
 await db.ref().update(updates);
 if(body.action==='save'&&!existing){
  const sendEmail=dependencies.sendEmail||require('./brevo-email.cjs').sendNotificationEmail;
  const campaign=updates[root+'/'+id];
  const email=await sendEmail({campaignId:id,subject:campaign.emailSubject,title:campaign.title,message:campaign.message,recipients:emailRecipients,design:campaign.emailDesign});
  await db.ref().update({[root+'/'+id+'/email']:{...email,updatedAt:Date.now()}});
  return {saved:true,id,email};
 }
 return {saved:true,id};
};
