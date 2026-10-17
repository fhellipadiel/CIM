const crypto=require('node:crypto');const {fail}=require('./core.cjs');
const validKey=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$\[\]\/\x00-\x1f]/.test(value);
const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function transaction(ref,fn){const retain=()=>{};ref.on('value',retain);try{await ref.once('value');return await ref.transaction(fn);}finally{ref.off('value',retain);}}
async function recordAnalytics({db,req,body,verifyCaller,now=Date.now()}){
 if(!body||typeof body!=='object'||Array.isArray(body)||!['product','whatsapp','phone','campaign'].includes(body.type))fail('Evento invalido.',400);
 let caller=null,user=null;if(req.headers.authorization){caller=await verifyCaller();user=(await db.ref('users/'+caller.uid).get()).val();if(!user)fail('Conclua seu cadastro.',403);}
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,200);
 const actor=hash(caller?'account:'+caller.uid:'visitor:'+ip),window=Math.floor(now/60000);
 const limit=await transaction(db.ref('analyticsRateLimits/'+actor),old=>{const next=old?.window===window?old:{window,count:0};if(next.count>=120)return;return {...next,count:next.count+1};});
 if(!limit.committed)fail('Aguarde antes de tentar novamente.',429);
 const source=/^[a-zA-Z0-9_-]{1,60}$/.test(body.source||'')?body.source:'unknown';
 let product=null,campaign=null;
 if(body.type==='product'){if(!validKey(body.productId))fail('Peca invalida.',400);product=(await db.ref('products/'+body.productId).get()).val();if(!product)fail('Peca indisponivel.',404);}
 if(body.campaignRef){if(!/^[a-zA-Z0-9_-]{2,40}$/.test(body.campaignRef))fail('Campanha invalida.',400);const raw=(await db.ref('trackingLinks').orderByChild('slug').equalTo(body.campaignRef).limitToFirst(1).get()).val();const entry=Object.entries(raw||{})[0];if(entry)campaign={...entry[1],id:entry[0]};}
 if(body.type==='campaign'&&!campaign)return {recorded:false};
 const dedupKey=hash(actor+':'+body.type+':'+(body.productId||'')+':'+(campaign?.id||'')+':'+source);
 const accepted=await transaction(db.ref('analyticsDedup/'+dedupKey),old=>old&&now-old.at<10000?undefined:{at:now});
 if(!accepted.committed)return {recorded:false};
 const stamp=new Date(now),when={timestamp:now,date:stamp.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}),time:stamp.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})};
 const identity={userId:caller?.uid||null,userName:caller?text(user.name||caller.email||'Cliente'):'Visitante',userType:caller?(['PF','PJ'].includes(user.userType)?user.userType:null):'visitante'};
 const campaignFields={campaignRef:campaign?.slug||null,campaignName:campaign?text(campaign.name||campaign.slug):null};
 if(body.type==='campaign'){
  await db.ref('trackingLinkLogs').push({linkId:campaign.id,slug:campaign.slug,name:text(campaign.name||campaign.slug),...when});
  await transaction(db.ref('trackingLinks/'+campaign.id+'/entries'),v=>(Number(v)||0)+1);return {recorded:true};
 }
 const log={type:body.type,source,...campaignFields,...identity,...when};
 if(product){
  Object.assign(log,{productId:body.productId,productName:text(product.name||'Sem nome'),category:text(product.category),brand:text(product.brand),sessionId:product.sessionId||null,sessionName:'',origem:['detalhes','carrinho'].includes(source)?source:'detalhes'});
  if(validKey(product.sessionId)){const session=(await db.ref('sessions/'+product.sessionId).get()).val();log.sessionName=text(session?.name);}
  await db.ref('clickLogs').push(log);
  const result=await transaction(db.ref('products/'+body.productId+'/clicks'),v=>(Number(v)||0)+1);
  for(const [path,id]of [['categoryClicks',product.category],['sessionClicks',product.sessionId],['brandClicks',product.brand]])if(validKey(id))await transaction(db.ref(path+'/'+id),v=>(Number(v)||0)+1);
  const clicks=result.snapshot.val(),meta=Number(product.metaClicks)||0;
  if(meta>0&&clicks===meta){await db.ref('metaAchievements').push({productId:body.productId,productName:log.productName,category:log.category,...when});}
 }else await db.ref('contactClicks').push(log);
 return {recorded:true};
}
module.exports={recordAnalytics};
