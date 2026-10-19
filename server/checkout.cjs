const ordersApi=require('./orders.cjs');
const {quote,validSignature,verifiedPayment,fail}=require('./core.cjs');
const crypto=require('node:crypto');
const paymentConfig=require('./payment-config.cjs');
const orderPolicy=require('../assets/payment-policy.js');
const {requireAdminAccess,requireAdminSetupAccess,requireAdminWriteAccess}=require('./admin-access.cjs');
let app;
function services() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) fail('Falta configurar a credencial do servidor Firebase de pagamentos.',503);
  const {initializeApp,cert,applicationDefault}=require('firebase-admin/app');
  const {getAuth}=require('firebase-admin/auth');
  const {getDatabase}=require('firebase-admin/database');
  if (!app) app=initializeApp({credential:process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault(),databaseURL:process.env.FIREBASE_DATABASE_URL||'https://redx-6b53f-default-rtdb.firebaseio.com'});
  return {auth:getAuth(app),db:getDatabase(app)};
}
async function mp(path, options={},mode=paymentConfig.activeMode()) {
  const cfg=paymentConfig.settings(mode);
  const res=await fetch('https://api.mercadopago.com'+path,{...options,headers:{Authorization:'Bearer '+cfg.token,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(15000)});
  if (!res.ok) fail('O Mercado Pago não conseguiu processar esta solicitação.',502);
  return res.json();
}
async function identity(req, auth) {
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
  if (!token) fail('Entre na sua conta para continuar.',401);
  try { return await auth.verifyIdToken(token,true); } catch { fail('Faça login novamente para continuar.',401); }
}
const key=/^[a-zA-Z0-9_-]{1,128}$/;
async function reconcile(db, payment) {
  const ref=String(payment.external_reference||'').split(':');
  if (ref.length!==3 || ref[0]!=='cimtest' || !key.test(ref[1]) || !key.test(ref[2])) fail('Pedido de teste não encontrado.',404);
  const path=db.ref(`paymentTests/${ref[1]}/${ref[2]}`);
  const retain=()=>{};
  path.on('value',retain);
  try {
  const order=(await path.once('value')).val();
  if (!order) fail('Pedido de teste não encontrado.',404);
  const buyerId=process.env.MP_BUYER_ID;
  if (!buyerId || String(payment.payer?.id)!==buyerId) fail('Comprador diferente da conta de teste configurada.',409);
  const [seller,buyer]=await Promise.all([mp('/users/me',{},'test'),mp('/users/'+encodeURIComponent(buyerId),{},'test')]);
  const status=verifiedPayment(payment,order,process.env.MP_SELLER_ID,{sellerIsTest:seller.tags?.includes('test_user')===true,buyerIsTest:buyer.tags?.includes('test_user')===true || /^TESTUSER/i.test(buyer.nickname||''),buyerId});
  const result=await path.transaction(current=>{
    if (!current) return;
    if (current.paymentId && String(current.paymentId)!==String(payment.id)) return;
    const incoming=Date.parse(payment.date_last_updated||payment.date_created);
    if (!Number.isFinite(incoming)) return;
    if (current.paymentUpdatedAt && incoming<current.paymentUpdatedAt) return;
    if (current.status==='pago' && status==='pendente') return;
    return {...current,status,paymentId:String(payment.id),paymentStatus:payment.status,actualPaymentMethod:payment.payment_method_id,actualInstallments:Number(payment.installments)||1,paidTotal:Number(payment.transaction_details?.total_paid_amount)||Number(payment.transaction_amount),financingCost:Math.max(0,Math.round(((Number(payment.transaction_details?.total_paid_amount)||Number(payment.transaction_amount))-Number(payment.transaction_amount))*100)/100),paymentUpdatedAt:incoming,updatedAt:Date.now()};
  });
  const updated=result.snapshot.val();
  await notifyOrder(db,ref[1],ref[2],updated);
  return updated;
  } finally { path.off('value',retain); }
}
async function reconcileOrder(db,remote,mode=paymentConfig.activeMode(),dependencies={}){
  const requestMp=dependencies.mp||mp;
  if(!paymentConfig.validOrderId(remote.id,mode))fail('Order incompatível com o ambiente.',409);
  const index=(await db.ref('paymentOrderIndex/'+remote.id).get()).val();
  if(!index || !key.test(index.uid)||!key.test(index.orderId)||(index.environment||'test')!==mode)fail('Pedido não encontrado neste ambiente.',404);
  const cfg=paymentConfig.settings(mode);
  paymentConfig.verifySeller(await requestMp('/users/me',{},mode),cfg);
  const ref=db.ref(cfg.root+'/'+index.uid+'/'+index.orderId);
  const retain=()=>{};ref.on('value',retain);
  try{
    const existing=(await ref.once('value')).val();
    if(!existing)fail('Pedido não encontrado.',404);
    const details=ordersApi.verify(remote,existing,cfg.sellerId,mode);
    const incoming=Date.parse(remote.last_updated_date||remote.created_date);
    if(!Number.isFinite(incoming))fail('Data da Order inválida.',409);
    const result=await ref.transaction(current=>{
      if(!current || current.mercadoOrderId!==remote.id)return;
      return ordersApi.applyPayment(current,details,incoming);
    });
    const updated=result.snapshot.val();
    await notifyOrder(db,index.uid,index.orderId,updated);
    return updated;
  }finally{ref.off('value',retain);}
}

const PAYMENT_WINDOW=60*60*1000;
function expiresAt(order){return Number(order.expiresAt)||Number(order.createdAt)+PAYMENT_WINDOW;}
function visibleOrder(order,now=Date.now()){return orderPolicy.isOrderVisible(order,now);}
async function notifyOrder(db,uid,id,order){
  if(!order || !['pago','pendente'].includes(order.status))return;
  if(order.status==='pendente' && !visibleOrder(order))return;
  const paid=order.status==='pago';
  const prefix=order.testMode===false?'production_':'';
  await db.ref('notifications/'+uid+'/checkout_'+prefix+id+'_'+order.status).transaction(current=>current||{type:paid?'order_confirmed':'order_updated',title:paid?'Pagamento aprovado':'Pagamento pendente',message:paid?'Seu pedido foi confirmado com sucesso. Acesse o menu > Pedidos.':'Seu pedido está aguardando pagamento. Você tem até uma hora para pagar pelo menu > Pedidos.',orderId:id,createdAt:Date.now(),read:false});
}
async function refreshOrder(db,order){
  if(order.provider==='orders' && order.mercadoOrderId){const mode=paymentConfig.orderMode(order);await reconcileOrder(db,await mp('/v1/orders/'+encodeURIComponent(order.mercadoOrderId),{},mode),mode);return;}
  // Mantém o histórico das preferências antigas; não usa a nova aplicação para conciliá-las.
}

async function handle(action,req,res,dependencies={}) {
  const getServices=dependencies.services||services;
  const requestMp=dependencies.mp||mp;
  const refresh=dependencies.refreshOrder||refreshOrder;
  const reconcileRemote=dependencies.reconcileOrder||reconcileOrder;
  res.setHeader('Cache-Control','no-store');
  try {
    if (req.method!=='POST') fail('Método não permitido.',405);
    const bodyLimit=action==='admin-media'?4250000:65536;
    if(Number(req.headers['content-length']||0)>bodyLimit)fail('Solicitacao muito grande.',413);
    const body=typeof req.body==='string' ? JSON.parse(req.body) : req.body||{};
    if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>bodyLimit)fail('Solicitacao invalida.',400);
    if(action==='analytics'){const {auth,db}=getServices();return res.status(200).json(await require('./analytics.cjs').recordAnalytics({db,req,body,verifyCaller:()=>identity(req,auth)}));}
    if(action==='support'){
      const {auth,db}=getServices();
      return res.status(200).json(await require('./support.cjs').handleSupport({db,req,body,verifyCaller:()=>identity(req,auth),requireAdmin:()=> (['list','sync','older','read'].includes(body.op)?(dependencies.requireAdminAccess||requireAdminAccess):(dependencies.requireAdminWriteAccess||dependencies.requireAdminAccess||requireAdminWriteAccess))(req,db)}));
    }
    if(action==='company-lookup')return res.status(200).json(await require('./company-lookup.cjs').lookupCompany(body.cnpj,dependencies.fetch||fetch));
    if (action==='webhook') {
      const webhookMode=new URL(req.url,'http://localhost').searchParams.get('environment')||paymentConfig.activeMode();
      const cfg=paymentConfig.settings(webhookMode);
      const secret=body.type==='order' ? cfg.webhookSecret : webhookMode==='test'?process.env.MP_WEBHOOK_SECRET:null;
      if (!secret) fail('Falta configurar a assinatura do webhook desta aplicação.',503);
      const url=new URL(req.url,'http://localhost');
      const id=url.searchParams.get('data.id');
      if (!validSignature(id,req.headers['x-request-id'],req.headers['x-signature'],secret)) fail('Assinatura inválida.',401);
      if(!['payment','order'].includes(body.type) || String(body.data?.id)!==id)fail('Notificação inválida.');
      const {db}=getServices();
      if(body.type==='order'){
        if(!paymentConfig.validOrderId(id,webhookMode))fail('Order inválida.',400);
        const remote=await requestMp('/v1/orders/'+encodeURIComponent(id),{},webhookMode);
        const updated=await reconcileRemote(db,remote,webhookMode);
        if(!updated)fail('Confirmação não aplicada.',409);
        const index=(await db.ref('paymentOrderIndex/'+id).get()).val();
        await db.ref(cfg.root+'/'+index.uid+'/'+index.orderId).update({webhookReceivedAt:Date.now(),webhookOrderId:id});
      }else{
        const payment=await requestMp('/v1/payments/'+encodeURIComponent(id),{},'test');
        const updated=await reconcile(db,payment);
        if(!updated)fail('Confirmação não aplicada.',409);
        const [,uid,orderId]=payment.external_reference.split(':');
        await db.ref(`paymentTests/${uid}/${orderId}`).update({webhookReceivedAt:Date.now(),webhookPaymentId:String(payment.id)});
      }
      return res.status(200).json({received:true});
    }
    const {auth,db}=getServices();
    const caller=await identity(req,auth);
    if(action==='admin-recovery')return res.status(200).json(await require('./admin-recovery.cjs').handleRecovery({auth,db,caller,body}));
    if(action==='admin-access'){
      const registry=require('./access-registry.cjs');
      if(dependencies.requireAdminAccess)await dependencies.requireAdminAccess(req,db);
      else await registry.requireRegistryAdmin(db,caller);
      return res.status(200).json({authorized:true,admins:await registry.adminDirectory(db)});
    }
    if(action==='admin-media')return res.status(200).json(await require('./admin-media.cjs').handleMedia({auth,caller,body,requireRead:()=> (dependencies.requireAdminAccess||requireAdminAccess)(req,db),requireWrite:()=> (dependencies.requireAdminWriteAccess||dependencies.requireAdminAccess||requireAdminWriteAccess)(req,db)}));
    if(action==='admin-mfa')return res.status(200).json(await require('./admin-mfa.cjs').handleAdminMfa({auth,db,caller,body,requireSetup:()=> (dependencies.requireAdminSetupAccess||requireAdminSetupAccess)(req,db),requireAdmin:()=> (dependencies.requireAdminAccess||requireAdminAccess)(req,db)}));
    if(action==='register-profile')return res.status(200).json(await require('./registration.cjs').registerProfile(db,caller,body));
    const user={...((await db.ref('users/'+caller.uid).get()).val()||{}),uid:caller.uid};
    if(['admin-notifications','admin-tests','admin-archive-legacy-order','admin-order-status','admin-session'].includes(action)){
      await ((['admin-order-status','admin-archive-legacy-order'].includes(action)||(action==='admin-notifications'&&body.action!=='list'))?(dependencies.requireAdminWriteAccess||dependencies.requireAdminAccess||requireAdminWriteAccess):(dependencies.requireAdminAccess||requireAdminAccess))(req,db);
      user.isAdmin=true;
    }
    if(action==='admin-session')return res.status(200).json(await require('./admin-sessions.cjs').recordAdminSession(db,caller,req.headers['user-agent']));
    if(action==='admin-notifications')return res.status(200).json(await require('./notifications.cjs')(db,user,body));
    if (action==='admin-tests') {
      if (user.isAdmin!==true) fail('Acesso restrito ao administrador.',403);
      let raw=(await db.ref('paymentTests').get()).val()||{};
      const pending=Object.values(raw).flatMap(list=>Object.values(list)).filter(o=>o.status==='pendente' && o.provider==='orders' && o.mercadoOrderId && visibleOrder(o)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,10);
      await Promise.all(pending.map(order=>refresh(db,order)));
      raw=(await db.ref('paymentTests').get()).val()||{};
      const orders=Object.entries(raw).flatMap(([uid,list])=>Object.entries(list).map(([id,o])=>({...o,uid,id})));
      return res.status(200).json({orders:orders.sort((a,b)=>b.createdAt-a.createdAt).slice(0,100)});
    }
    if(action==='cart-save' || action==='cart-load'){
      const cartRef=db.ref('customerCarts/'+caller.uid);
      if(action==='cart-save'){
        if(!Array.isArray(body.items)||body.items.length>100)fail('Carrinho inválido.');
        const items=body.items.map(item=>{if(!key.test(item.id||'')||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999)fail('Item inválido.');return {id:item.id,quantity:item.quantity};});
        await cartRef.set({items,updatedAt:Date.now()});
        return res.status(200).json({saved:true});
      }
      const saved=(await cartRef.get()).val();
      if(!saved)return res.status(200).json({items:null});
      const products=Object.values((await db.ref('products').get()).val()||{});
      const items=(saved.items||[]).flatMap(item=>{const product=products.find(p=>p.id===item.id);return product?[{...product,quantity:item.quantity}]:[];});
      return res.status(200).json({items});
    }
    if(action==='admin-archive-legacy-order'){
      if(user.isAdmin!==true)fail('Acesso restrito ao administrador.',403);
      if(!key.test(body.uid||'')||!key.test(body.orderId||''))fail('Pedido inválido.');
      const ref=db.ref('orders/'+body.uid+'/'+body.orderId);
      const retain=()=>{};ref.on('value',retain);
      try{
        const current=(await ref.once('value')).val();
        if(!current)fail('Pedido não encontrado.',404);
        const result=await ref.transaction(order=>order?{...order,archivedAt:order.archivedAt||Date.now(),archivedBy:caller.uid,archiveReason:order.archiveReason||'test_order'}:undefined);
        if(!result.committed)fail('O pedido mudou. Atualize a lista.',409);
        return res.status(200).json({archived:true});
      }finally{ref.off('value',retain);}
    }
    const cfg=paymentConfig.settings();
    if (action==='admin-order-status') {
      if(user.isAdmin!==true)fail('Acesso restrito ao administrador.',403);
      if(!key.test(body.uid||'')||!key.test(body.orderId||''))fail('Pedido inválido.');
      const ref=db.ref('orders/'+body.uid+'/'+body.orderId);
      let order=(await ref.get()).val();
      if(!order||order.provider!=='orders'||order.testMode!==false)fail('Pedido de produção não encontrado.',404);
      await refresh(db,order);order=(await ref.get()).val();
      const next=body.status;
      if(next==='cancelado'){
        if(order.status!=='pendente')fail('Pagamento aprovado exige estorno antes do cancelamento.',409);
        await requestMp('/v1/orders/'+encodeURIComponent(order.mercadoOrderId)+'/cancel',{method:'POST',headers:{'X-Idempotency-Key':'cancel-'+body.orderId}},'production');
        await refresh(db,order);
        return res.status(200).json({updated:true});
      }
      const flow={pago:'preparando',confirmado:'preparando',preparando:'enviado',enviado:'entregue'};
      if(order.paymentStatus!=='accredited'||flow[order.status]!==next)fail('Aguarde a aprovação e siga as etapas do pedido.',409);
      const retain=()=>{};ref.on('value',retain);
      try{await ref.once('value');
        const result=await ref.transaction(current=>current?.status===order.status&&current.paymentStatus==='accredited'?{...current,status:next,updatedAt:Date.now()}:undefined);
        if(!result.committed)fail('O pedido mudou. Atualize a tela.',409);
      }finally{ref.off('value',retain);}
      return res.status(200).json({updated:true});
    }
    if (action==='resume-payment') {
      if(!key.test(body.orderId||''))fail('Pedido inválido.');
      const ref=db.ref(cfg.root+'/'+caller.uid+'/'+body.orderId);
      let order=(await ref.get()).val();
      if(!order)fail('Pedido não encontrado.',404);
      await refresh(db,order);order=(await ref.get()).val();
      if(order.status!=='pendente'||!visibleOrder(order))fail('O pedido já foi pago, cancelado ou o prazo terminou.',409);
      if(!order.checkoutUrl)fail('Pagamento indisponível.',409);
      return res.status(200).json({checkoutUrl:order.checkoutUrl});
    }
    if (action==='customer-orders') {
      const path=db.ref(cfg.root+'/'+caller.uid);
      let raw=(await path.get()).val()||{};
      const pending=Object.values(raw).filter(o=>o.status==='pendente' && o.provider==='orders' && o.mercadoOrderId).sort((a,b)=>b.createdAt-a.createdAt).slice(0,100);
      await Promise.all(pending.map(order=>refresh(db,order)));
      raw=(await path.get()).val()||{};
      await Promise.all(Object.entries(raw).map(([id,o])=>notifyOrder(db,caller.uid,id,o)));
      const orders=Object.entries(raw).filter(([,o])=>o.provider==='orders' && visibleOrder(o)).map(([id,o])=>({...o,id,expiresAt:expiresAt(o),installments:o.actualInstallments||o.installments,total:o.paidTotal||o.total}));
      return res.status(200).json({orders:orders.sort((a,b)=>b.createdAt-a.createdAt)});
    }
    if (action==='payment-status') {
      if (!key.test(body.orderId||'')) fail('Pedido inválido.');
      const order=(await db.ref(cfg.root+'/'+caller.uid+'/'+body.orderId).get()).val();
      if (!order) fail('Pedido não encontrado.',404);
      await refresh(db,order);
      const updated=(await db.ref(cfg.root+'/'+caller.uid+'/'+body.orderId).get()).val();
      return res.status(200).json({status:updated.status,paymentStatus:updated.paymentStatus||'',total:updated.total,orderId:body.orderId});
    }
    if (action!=='checkout') fail('Rota inválida.',404);
    for (const field of ['telefone','cep','logradouro','numero','bairro','cidade','uf']) if (!String(user[field]||'').trim()) fail('Complete os dados de entrega antes de continuar.');
    if (!key.test(body.requestId||'')) fail('Solicitação inválida.');
    paymentConfig.verifySeller(await requestMp('/users/me'),cfg);
    const names=['products','sessions','promocoes','cupons','categoryHidePF','categoryHidePJ','settings/pricesHidden'];
    const values=await Promise.all(names.map(n=>db.ref(n).get()));
    const data=Object.fromEntries(names.map((n,i)=>[n.startsWith('settings/')?n.slice('settings/'.length):n,values[i].val()||{}]));
    const priced=quote(body,user,data);
    const ref=db.ref(cfg.root+'/'+caller.uid+'/'+body.requestId);
    const reference=body.requestId;
    const fingerprint=crypto.createHash('sha256').update(cfg.mode+':orders-v2:'+JSON.stringify(priced)).digest('hex');
    const base=new URL(cfg.base);
    if (base.protocol!=='https:' && !['localhost','127.0.0.1'].includes(base.hostname)) fail('Endereço de teste inválido.',503);
    const returnUrl=new URL('/cim.html',base);
    returnUrl.searchParams.set(cfg.testMode?'checkout_test':'checkout_order',body.requestId);
    const created=await ref.transaction(current=>current||{...priced,reference,fingerprint,provider:'orders',status:'pendente',testMode:cfg.testMode,environment:cfg.mode,uid:caller.uid,customerName:String(user.name||''),customerEmail:String(user.email||''),createdAt:Date.now(),expiresAt:Date.now()+PAYMENT_WINDOW,deliveryAddress:Object.fromEntries(['cep','logradouro','numero','complemento','bairro','cidade','uf'].map(k=>[k,String(user[k]||'')]))});
    const existing=created.snapshot.val();
    if (existing.fingerprint!==fingerprint && !(cfg.testMode && existing.fingerprint===crypto.createHash('sha256').update('orders-v2:'+JSON.stringify(priced)).digest('hex'))) fail('Revise o carrinho e tente novamente.',409);
    if (!visibleOrder(existing)) fail('Prazo de pagamento encerrado. Monte um novo pedido.',409);
    if (existing.checkoutUrl && existing.status==='pendente') { await notifyOrder(db,caller.uid,body.requestId,existing); await db.ref('customerCarts/'+caller.uid).set({items:[],updatedAt:Date.now()}); return res.status(200).json({checkoutUrl:existing.checkoutUrl,orderId:body.requestId,testMode:cfg.testMode}); }
    if (existing.status==='pago') fail('Este pedido já foi pago.',409);
    const request=ordersApi.payload(priced,reference,returnUrl.href);
    const remote=await requestMp('/v1/orders',{method:'POST',headers:{'X-Idempotency-Key':body.requestId},body:JSON.stringify(request)});
    if(!paymentConfig.validOrderId(remote.id,cfg.mode) || String(remote.user_id)!==cfg.sellerId || (!cfg.testMode && remote.live_mode===false))fail('A API não retornou um pedido da conta recebedora configurada.',502);
    const target=new URL(remote.checkout_url);
    if(target.protocol!=='https:' || target.hostname!=='www.mercadopago.com.br')fail('Endereço de checkout inesperado.',502);
    await db.ref().update({[`paymentOrderIndex/${remote.id}`]:{uid:caller.uid,orderId:body.requestId,environment:cfg.mode},[cfg.root+'/'+caller.uid+'/'+body.requestId+'/mercadoOrderId']:remote.id,[cfg.root+'/'+caller.uid+'/'+body.requestId+'/checkoutUrl']:target.href});
    await notifyOrder(db,caller.uid,body.requestId,existing);
    await db.ref('customerCarts/'+caller.uid).set({items:[],updatedAt:Date.now()});
    res.status(200).json({checkoutUrl:target.href,orderId:body.requestId,testMode:cfg.testMode});
  } catch(e) { if(!e.status){let message=String(e.message||'').replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g,'[redacted]');for(const [name,value]of Object.entries(process.env))if(/TOKEN|SECRET|CREDENTIAL|PRIVATE_KEY/.test(name)&&value&&value.length>3)message=message.split(value).join('[redacted]');console.error('[checkout-error]',JSON.stringify({action,name:e.name,code:e.code||'',message:message.slice(0,350)}));} res.status(e.status||500).json({error:e.status ? e.message : 'Não foi possível concluir a operação. Confira a configuração do servidor.'}); }
}
module.exports={handle,reconcile,reconcileOrder,expiresAt,visibleOrder,notifyOrder};