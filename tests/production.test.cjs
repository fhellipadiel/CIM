const {test}=require('node:test');
const assert=require('node:assert/strict');
const {settings,activeMode,verifySeller}=require('../server/payment-config.cjs');
const {verify,applyPayment}=require('../server/orders.cjs');
const {handle}=require('../server/checkout.cjs');
const production={MP_ENVIRONMENT:'production',MP_PRODUCTION_ACCESS_TOKEN:'production-secret',MP_PRODUCTION_SELLER_ID:'900',MP_PRODUCTION_WEBHOOK_SECRET:'webhook-secret',CHECKOUT_PRODUCTION_BASE_URL:'https://www.cimautoparts.com.br',MP_ACCESS_TOKEN:'test-secret',MP_SELLER_ID:'100',CHECKOUT_BASE_URL:'http://localhost:3000'};
test('produção exige configuração própria e rejeita localhost e túnel temporário',()=>{
 assert.equal(activeMode({}),'test');assert.throws(()=>activeMode({MP_ENVIRONMENT:'prod'}));
 const cfg=settings('production',production);assert.equal(cfg.root,'orders');assert.equal(cfg.token,'production-secret');
 for(const field of ['MP_PRODUCTION_ACCESS_TOKEN','MP_PRODUCTION_SELLER_ID','MP_PRODUCTION_WEBHOOK_SECRET','CHECKOUT_PRODUCTION_BASE_URL'])assert.throws(()=>settings('production',{...production,[field]:''}));
 for(const base of ['http://www.cimautoparts.com.br','https://localhost','https://a.trycloudflare.com','https://www.cimautoparts.com.br/path','https://u:p@www.cimautoparts.com.br'])assert.throws(()=>settings('production',{...production,CHECKOUT_PRODUCTION_BASE_URL:base}));
 assert.equal(settings('test',production).token,'test-secret');
 assert.throws(()=>verifySeller({id:900,tags:['test_user']},cfg));
 assert.throws(()=>verifySeller({id:901,tags:[]},cfg));
 verifySeller({id:900,tags:[]},cfg);
});
function approved(){
 const local={provider:'orders',testMode:false,mercadoOrderId:'ORDREAL1',reference:'local',method:'card',installments:6,total:100};
 const remote={id:'ORDREAL1',user_id:'900',type:'online',processing_mode:'manual',currency:'BRL',external_reference:'local',total_amount:'100',total_paid_amount:'110',status:'processed',transactions:{payments:[{id:'PAY1',status:'processed',status_detail:'accredited',amount:'100',paid_amount:'110',payment_method:{id:'visa',type:'credit_card',installments:6}}]}};
 return {local,remote};
}
test('produção valida vendedor, valor, referência e separação de teste',()=>{
 const {local,remote}=approved();assert.equal(verify(remote,local,'900','production').status,'pago');
 assert.throws(()=>verify(remote,local,'900','test'));
 for(const change of [{live_mode:false},{id:'ORDTST123'},{user_id:'901'},{total_amount:'1'},{external_reference:'other'}])assert.throws(()=>verify({...remote,...change},local,'900','production'));
 assert.throws(()=>verify(remote,{...local,testMode:true},'900','production'));
});
test('webhooks repetidos não regridem logística nem sobrescrevem estorno com aprovação',()=>{
 for(const status of ['confirmado','preparando','enviado','entregue']){
  const current={status,paymentUpdatedAt:10,paymentStatus:'accredited'};
  assert.equal(applyPayment(current,{status:'pago',paymentStatus:'accredited'},11).status,status);
  assert.equal(applyPayment(current,{status:'pendente'},11),undefined);
  assert.equal(applyPayment(current,{status:'cancelado',paymentStatus:'refunded'},11).status,'cancelado');
 }
 assert.equal(applyPayment({status:'pago',paymentUpdatedAt:10},{status:'pendente'},11),undefined);
 assert.equal(applyPayment({status:'pago',paymentUpdatedAt:10},{status:'cancelado'},9),undefined);
 assert.equal(applyPayment({status:'cancelado',paymentUpdatedAt:10},{status:'pago'},11),undefined);
});
function memoryDb(initial={}){
 const data=structuredClone(initial);const reads=[];
 const read=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data)??null;
 const write=(path,value)=>{const keys=path.split('/').filter(Boolean);let node=data;for(const key of keys.slice(0,-1))node=node[key]??={};node[keys.at(-1)]=structuredClone(value);};
 const snap=value=>({val:()=>structuredClone(value)});
 const ref=path=>({get:async()=>{reads.push(path);return snap(read(path));},once:async()=>snap(read(path)),on:()=>{},off:()=>{},set:async value=>write(path,value),update:async changes=>{for(const [key,value]of Object.entries(changes))write([path,key].filter(Boolean).join('/'),value);},transaction:async fn=>{const next=fn(structuredClone(read(path)));if(next===undefined)return {committed:false,snapshot:snap(read(path))};write(path,next);return {committed:true,snapshot:snap(next)};}});
 return {data,reads,ref:(path='')=>ref(path)};
}
async function withProduction(run){
 const saved={};for(const [key,value]of Object.entries(production)){saved[key]=process.env[key];process.env[key]=value;}
 try{return await run();}finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
async function call(action,body,db,options={}){
 let code=200,result;
 const res={setHeader:()=>{},status:value=>{code=value;return res;},json:value=>{result=value;return res;}};
 const auth={verifyIdToken:async token=>({uid:token==='admin'?'admin':'alice'})};
 await handle(action,{method:'POST',url:options.url||'/api/'+action,headers:{authorization:'Bearer '+(options.token||'alice'),...(options.headers||{})},body},res,{services:()=>({auth,db}),mp:options.mp||(()=>{throw Error('Unexpected provider call');}),refreshOrder:options.refresh||asyncNoop,reconcileOrder:options.reconcile});
 return {code,body:result};
}
async function asyncNoop(){}
test('checkout real recalcula preços e escreve somente em orders, nunca paymentTests',()=>withProduction(async()=>{
 const db=memoryDb({users:{alice:{userType:'PF',name:'Cliente',email:'a@example.com',telefone:'11999999999',cep:'01001000',logradouro:'Rua',numero:'1',bairro:'Centro',cidade:'SP',uf:'SP'}},products:{piece:{id:'piece',name:'Peça',prices:{PF:100}}}});
 let creates=0;
 const mp=async(path,options)=>{
  if(path==='/users/me')return {id:900,tags:[]};
  assert.equal(path,'/v1/orders');creates++;
  const payload=JSON.parse(options.body);assert.equal(payload.total_amount,'100.00');assert.equal(payload.expiration_time,'PT1H');assert.equal(payload.config.online.success_url,'https://www.cimautoparts.com.br/cim.html?checkout_order=attempt1');
  return {id:'ORDREAL1',user_id:900,checkout_url:'https://www.mercadopago.com.br/checkout/one'};
 };
 const body={items:[{id:'piece',quantity:1}],method:'card',installments:6,mode:'Retirar',expectedTotal:100,requestId:'attempt1'};
 const first=await call('checkout',body,db,{mp});assert.equal(first.code,200);assert.equal(first.body.testMode,false);
 assert.equal(db.data.orders.alice.attempt1.total,100);assert.equal(db.data.orders.alice.attempt1.status,'pendente');assert.equal(db.data.paymentTests,undefined);
 assert.equal(db.data.paymentOrderIndex.ORDREAL1.environment,'production');assert.deepEqual(db.data.customerCarts.alice.items,[]);
 const again=await call('checkout',body,db,{mp});assert.equal(again.code,200);assert.equal(creates,1);
 const tampered=await call('checkout',{...body,requestId:'attempt2',expectedTotal:1},db,{mp});assert.equal(tampered.code,400);assert.equal(creates,1);
}));
test('status de produção consulta o pedido do cliente; outro cliente não é acessível',()=>withProduction(async()=>{
 const db=memoryDb({users:{alice:{}},orders:{alice:{mine:{status:'pendente',provider:'orders',testMode:false,total:100}},bob:{theirs:{status:'pago',total:200}}}});
 const result=await call('payment-status',{orderId:'mine'},db,{refresh:async()=>{db.data.orders.alice.mine.status='pago';db.data.orders.alice.mine.paymentStatus='accredited';}});
 assert.equal(result.code,200);assert.equal(result.body.status,'pago');assert.ok(db.reads.every(path=>!path.startsWith('paymentTests')));
 assert.equal((await call('payment-status',{orderId:'theirs'},db)).code,404);
 assert.equal((await call('resume-payment',{orderId:'theirs'},db)).code,404);
}));
test('admin não consegue confirmar pendente como pago nem cancelar pago sem estorno',()=>withProduction(async()=>{
 const db=memoryDb({users:{alice:{},admin:{isAdmin:true}},orders:{alice:{mine:{provider:'orders',testMode:false,status:'pendente'}}}});
 assert.equal((await call('admin-order-status',{uid:'alice',orderId:'mine',status:'pago'},db,{token:'admin'})).code,409);
 assert.equal((await call('admin-order-status',{uid:'alice',orderId:'mine',status:'pago'},db)).code,403);
 db.data.orders.alice.mine.status='pago';db.data.orders.alice.mine.paymentStatus='accredited';
 assert.equal((await call('admin-order-status',{uid:'alice',orderId:'mine',status:'cancelado'},db,{token:'admin'})).code,409);
 const advance=await call('admin-order-status',{uid:'alice',orderId:'mine',status:'preparando'},db,{token:'admin'});
 assert.equal(advance.code,200);assert.equal(db.data.orders.alice.mine.status,'preparando');
}));

test('webhook de produção exige assinatura própria, aprova e mantém a etapa de entrega',()=>withProduction(async()=>{
 const crypto=require('node:crypto');
 const {reconcileOrder}=require('../server/checkout.cjs');
 const {local,remote}=approved();remote.last_updated_date=new Date().toISOString();
 const db=memoryDb({users:{alice:{}},orders:{alice:{mine:{...local,status:'pendente',createdAt:Date.now()}}},paymentOrderIndex:{ORDREAL1:{uid:'alice',orderId:'mine',environment:'production'}}});
 const mp=async path=>path==='/users/me'?{id:900,tags:[]}:remote;
 const headers={'x-request-id':'request1','x-signature':'ts=123,v1='+crypto.createHmac('sha256','webhook-secret').update('id:ordreal1;request-id:request1;ts:123;').digest('hex')};
 const options={mp,url:'/api/webhook?environment=production&data.id=ORDREAL1',headers,reconcile:(db,remote,mode)=>reconcileOrder(db,remote,mode,{mp})};
 const invalid=await call('webhook',{type:'order',data:{id:'ORDREAL1'}},db,{...options,headers:{...headers,'x-signature':'invalid'}});
 assert.equal(invalid.code,401);assert.equal(db.data.orders.alice.mine.status,'pendente');
 const ok=await call('webhook',{type:'order',data:{id:'ORDREAL1'}},db,options);
 assert.equal(ok.code,200);assert.equal(db.data.orders.alice.mine.status,'pago');assert.equal(db.data.orders.alice.mine.financingCost,10);
 assert.ok(db.data.notifications.alice.checkout_production_mine_pago);
 db.data.orders.alice.mine.status='enviado';
 const replay=await call('webhook',{type:'order',data:{id:'ORDREAL1'}},db,options);
 assert.equal(replay.code,200);assert.equal(db.data.orders.alice.mine.status,'enviado');
 assert.equal(Object.keys(db.data.notifications.alice).length,1);
}));

test('somente admin exclui pedido antigo; cliente e dados do pedido ficam preservados',()=>withProduction(async()=>{
 const db=memoryDb({users:{alice:{name:'Cliente'},admin:{isAdmin:true}},orders:{alice:{old:{status:'pago',total:334.5,createdAt:1,items:[{id:'piece',quantity:1}]}}}});
 const body={uid:'alice',orderId:'old'};
 assert.equal((await call('admin-archive-legacy-order',body,db)).code,403);
 assert.equal(db.data.orders.alice.old.archivedAt,undefined);
 const result=await call('admin-archive-legacy-order',body,db,{token:'admin'});
 assert.equal(result.code,200);assert.equal(result.body.archived,true);
 assert.ok(db.data.orders.alice.old.archivedAt);assert.equal(db.data.orders.alice.old.total,334.5);assert.equal(db.data.users.alice.name,'Cliente');
 assert.equal(require('../assets/payment-policy.js').isOrderVisible(db.data.orders.alice.old),false);
 const timestamp=db.data.orders.alice.old.archivedAt;
 await call('admin-archive-legacy-order',body,db,{token:'admin'});
 assert.equal(db.data.orders.alice.old.archivedAt,timestamp);
}));
test('admin arquiva teste integrado e preserva dados de pagamento',()=>withProduction(async()=>{
 for(const change of [{provider:'orders'},{paymentId:'123'},{mercadoOrderId:'ORDREAL1'},{paymentStatus:'accredited'},{checkoutUrl:'https://www.mercadopago.com.br/checkout'},{testMode:false},{preferenceId:'abc'},{reference:'abc'}]){
  const order={status:'pago',total:100,...change};
  const db=memoryDb({users:{admin:{isAdmin:true}},orders:{alice:{real:order}}});
  const result=await call('admin-archive-legacy-order',{uid:'alice',orderId:'real'},db,{token:'admin'});
  assert.equal(result.code,200);
  const archived=db.data.orders.alice.real;
  assert.ok(archived.archivedAt);assert.equal(archived.archivedBy,'admin');assert.equal(archived.archiveReason,'test_order');
  for(const [key,value] of Object.entries(order))assert.deepEqual(archived[key],value);
  const policy=require('../assets/payment-policy.js');assert.equal(policy.isOrderVisible(archived),false);assert.equal(policy.isPaidOrder(archived),false);
 }
}));
