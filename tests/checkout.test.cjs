const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {quote,shippingFee,shippingProfile,productWeight,validSignature,verifiedPayment}=require('../server/core.cjs');
const user={uid:'u',userType:'PF',cep:'01512000',cidade:'São Paulo',uf:'SP'};
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
test('frete segue faixas por quantidade e oferece gratuidade por modalidade',()=>{
assert.equal(shippingFee('Motoboy',100,1,user),18.90);
assert.equal(shippingFee('Motoboy',100,10,user,{weightKg:5}),24.40);
assert.equal(shippingFee('Motoboy',100,1,{cep:'01310930',cidade:'São Paulo',uf:'SP'}),27.90);
assert.equal(shippingFee('Motoboy',100,1,{cep:'04538132',cidade:'São Paulo',uf:'SP'}),39.90);
assert.equal(shippingFee('Motoboy',100,1,{cep:'06000000',cidade:'Osasco',uf:'SP'}),49.90);
assert.equal(shippingFee('Motoboy',100,1,{cep:'13000000',cidade:'Campinas',uf:'SP'}),60.90);
assert.equal(shippingFee('Motoboy',100,1,{cep:'20000000',cidade:'Rio de Janeiro',uf:'RJ'}),null);
assert.equal(shippingFee('Transportadora',100,10,user,{weightKg:5}),54.30);
assert.equal(shippingFee('Transportadora',100,1,{uf:'RJ'},{weightKg:.5}),59.90);
assert.equal(shippingFee('Transportadora',100,1,{uf:'BA'},{weightKg:.5}),79.90);
assert.equal(shippingFee('Transportadora',100,1,{uf:'BA'},{weightKg:12,voluminous:true}),171.10);
assert.equal(shippingFee('Motoboy',1000,1,user),0);
assert.equal(shippingFee('Motoboy',999.99,1,user),18.90);
assert.equal(shippingFee('Transportadora',2500,1,{uf:'BA'}),0);
assert.equal(shippingFee('Transportadora',2499.99,1,{uf:'BA'},{weightKg:.5}),79.90);
assert.equal(shippingFee('Retirar',100,100),0);
assert.equal(shippingProfile({name:'Filtro de combustível'}),'leve');assert.equal(productWeight({name:'Filtro de combustível'}),.5);
assert.equal(shippingProfile({name:'Amortecedor dianteiro'}),'pesado');assert.equal(productWeight({shippingProfile:'leve',shippingWeightKg:.3}),.3);
const motoboy=quote({...input,mode:'Motoboy',expectedTotal:226.82},user,data);
assert.equal(motoboy.subtotal,200);assert.equal(motoboy.shipping,26.82);assert.equal(motoboy.total,226.82);
});
test('frete gratis considera o valor bruto antes do desconto no Pix',()=>{
const discountedData={products:{p:{name:'Peca',prices:{PF:2704,PJ:2704}}},promocoes:{a:{ativa:true,tipo:'produto',alvoId:'p',tipoCliente:'PF',descontoPercentual:10}}};
const result=quote({items:[{id:'p',quantity:1}],method:'pix',mode:'Transportadora',expectedTotal:2433.60},user,discountedData);
assert.equal(result.subtotal,2433.60);assert.equal(result.shipping,0);assert.equal(result.total,2433.60);
});
