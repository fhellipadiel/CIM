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

test('pedido integrado arquivado fica fora da lista e do faturamento ap?s atualiza??o de pagamento',()=>{
 const order={provider:'orders',testMode:false,status:'pago',paymentStatus:'accredited',total:100,archivedAt:123,archivedBy:'admin',archiveReason:'test_order'};
 assert.equal(policy.isOrderVisible(order),false);
 assert.equal(policy.isPaidOrder(order),false);
 assert.equal(policy.isOrderVisible({...order,status:'enviado'}),false);
 assert.equal(policy.isPaidOrder({...order,status:'enviado'}),false);
});
