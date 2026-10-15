const {test}=require('node:test');const assert=require('node:assert/strict');const policy=require('../assets/payment-policy.js');
test('ADM e cliente ocultam pendentes no prazo e preservam pagamentos aprovados',()=>{
 const order={provider:'orders',status:'pendente',createdAt:1000,expiresAt:3601000};
 assert.equal(policy.isOrderVisible(order,3600999),true);assert.equal(policy.isOrderVisible(order,3601000),false);
 assert.equal(policy.isOrderVisible({...order,status:'pago',paymentStatus:'accredited'},3601001),true);
 assert.equal(policy.isOrderVisible({...order,archivedAt:100},2000),false);
 assert.equal(policy.isOrderVisible({...order,status:'cancelado',paymentStatus:'expired'},2000),false);
});
test('faturamento não inclui pedido pendente, cancelado ou excluído',()=>{
 assert.equal(policy.isPaidOrder({status:'pendente',total:100}),false);
 assert.equal(policy.isPaidOrder({status:'cancelado',total:100}),false);
 assert.equal(policy.isPaidOrder({status:'pago',archivedAt:123}),false);
 assert.equal(policy.isPaidOrder({status:'pago',provider:'orders',paymentStatus:'created'}),false);
 assert.equal(policy.isPaidOrder({status:'enviado',provider:'orders',paymentStatus:'accredited'}),true);
 assert.equal(policy.isPaidOrder({status:'pago'}),true);
});
