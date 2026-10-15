const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {quote,validSignature,verifiedPayment}=require('../server/core.cjs');
const user={uid:'u',userType:'PF'};
const data={products:{p:{name:'Peça',prices:{PF:100,PJ:80}}}};
const input={items:[{id:'p',quantity:2}],method:'pix',mode:'Retirar',expectedTotal:200};
test('ignora preços enviados pelo navegador e recusa total adulterado',()=>{assert.equal(quote({...input,items:[{id:'p',quantity:2,unitPrice:1}]},user,data).total,200);assert.throws(()=>quote({...input,expectedTotal:2},user,data));});
test('recusa produtos ocultos, inexistentes e quantidades inválidas',()=>{assert.throws(()=>quote({...input,items:[{id:'x',quantity:1}]},user,data));assert.throws(()=>quote({...input,items:[{id:'p',quantity:0}]},user,data));assert.throws(()=>quote(input,user,{...data,pricesHidden:'PF'}));});
test('aplica maior desconto elegível no Pix e cartão sem acréscimo local',()=>{const promo={ativa:true,tipo:'produto',alvoId:'p',tipoCliente:'PF',descontoPercentual:10};assert.equal(quote({...input,expectedTotal:180},user,{...data,promocoes:{a:promo}}).total,180);assert.equal(quote({...input,method:'card',installments:6,expectedTotal:200},user,data).total,200);});
test('rejeita assinatura ausente ou falsificada',()=>{const header='ts=123,v1='+crypto.createHmac('sha256','secret').update('id:1;request-id:r;ts:123;').digest('hex');assert.ok(validSignature('1','r',header,'secret'));assert.equal(validSignature('2','r',header,'secret'),false);assert.equal(validSignature('1','r',header,''),false);});
test('aprovação exige contas de teste confirmadas, vendedor, comprador, valor e pedido corretos',()=>{
const order={reference:'cimtest:u:o',total:200,method:'pix',installments:1};
const payment={live_mode:true,collector_id:123,payer:{id:456},currency_id:'BRL',external_reference:order.reference,transaction_amount:200,status:'approved',payment_method_id:'pix'};
const accounts={sellerIsTest:true,buyerIsTest:true,buyerId:456};
assert.equal(verifiedPayment(payment,order,123,accounts),'pago');
assert.throws(()=>verifiedPayment(payment,order,123));
assert.throws(()=>verifiedPayment(payment,order,123,{...accounts,buyerIsTest:false}));
assert.throws(()=>verifiedPayment(payment,order,123,{...accounts,sellerIsTest:false}));
for(const mutation of [{payer:{id:789}},{collector_id:124},{transaction_amount:1},{external_reference:'outro'},{currency_id:'USD'}])assert.throws(()=>verifiedPayment({...payment,...mutation},order,123,accounts));
assert.equal(verifiedPayment({...payment,payment_method_id:'account_money',payment_type_id:'account_money'},order,123,accounts),'pago');
assert.throws(()=>verifiedPayment({...payment,payment_method_id:'account_money',payment_type_id:'account_money'},{...order,method:'card',installments:6},123,accounts));
});

test('cartão envia preço original mesmo com juros configurados no ADM',()=>{
for(const installments of [1,2,6,12]){
const result=quote({...input,method:'card',installments,expectedTotal:200},user,{...data,cardInterestFreeInstallments:{[installments]:false}});
assert.equal(result.total,200);assert.equal(result.interestRate,0);
}
assert.throws(()=>quote({...input,method:'card',installments:6,expectedTotal:217.48},user,data));
});
test('juros da conta não alteram desconto do Pix',()=>{
const promo={ativa:true,tipo:'produto',alvoId:'p',tipoCliente:'PF',descontoPercentual:10};
assert.equal(quote({...input,expectedTotal:180},user,{...data,promocoes:{a:promo}}).total,180);
assert.equal(quote({...input,method:'card',installments:6},user,{...data,promocoes:{a:promo}}).total,200);
});