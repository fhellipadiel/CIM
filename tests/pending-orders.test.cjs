const {test}=require('node:test');
const assert=require('node:assert/strict');
const {expiresAt,visibleOrder,notifyOrder}=require('../server/checkout.cjs');
const {payload}=require('../server/orders.cjs');
test('pedido pendente vence exatamente apos uma hora; pagos permanecem',()=>{
 const order={status:'pendente',createdAt:1000};
 assert.equal(expiresAt(order),3601000);assert.equal(visibleOrder(order,3600999),true);assert.equal(visibleOrder(order,3601000),false);
 assert.equal(visibleOrder({...order,status:'pago'},3601001),true);
 assert.equal(visibleOrder({...order,status:'cancelado',paymentStatus:'expired'},3601001),false);
});
test('checkout configura validade de uma hora na API',()=>{
 const order=payload({method:'card',total:1,items:[]},'id','http://localhost:3000/cim.html');assert.equal(order.expiration_time,'PT1H');
});
test('notificacoes de pendente e pago sao distintas e nao reaparecem como nao lidas',async()=>{
 const data={};const db={ref:path=>({transaction:async callback=>{data[path]=callback(data[path]||null);}})};
 const order={status:'pendente',createdAt:Date.now()};
 await notifyOrder(db,'u','o',order);const key='notifications/u/checkout_o_pendente';assert.equal(data[key].title,'Pagamento pendente');
 data[key].read=true;await notifyOrder(db,'u','o',order);assert.equal(data[key].read,true);
 await notifyOrder(db,'u','o',{...order,status:'pago'});assert.equal(data['notifications/u/checkout_o_pago'].type,'order_confirmed');assert.equal(Object.keys(data).length,2);
 await notifyOrder(db,'u','expired',{status:'pendente',createdAt:1});assert.equal(Object.keys(data).length,2);
});
