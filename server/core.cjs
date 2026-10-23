const crypto = require('node:crypto');
const policy = require('../assets/payment-policy.js');
function fail(message, status=400) { const e = new Error(message); e.status=status; throw e; }
function discount(p, user, promos, now) {
  for (const promo of Object.values(promos || {})) {
    if (!promo.ativa || (promo.dataExpiracao && promo.dataExpiracao <= now)) continue;
    const match = (promo.tipo==='produto' && promo.alvoId===p.id) || (promo.tipo==='categoria' && promo.alvoId===p.category) || (promo.tipo==='sessao' && promo.alvoId===p.sessionId) || (promo.tipo==='todas_sessoes' && p.sessionId) || (promo.tipo==='todas_categorias' && p.category) || (promo.tipo==='usuario' && promo.alvoId===user.uid);
    if (match && (promo.tipoCliente==='ambos' || promo.tipoCliente===user.userType || promo.tipo==='usuario')) return Math.max(0, Math.min(100, Number(promo.descontoPercentual)||0));
  }
  return 0;
}
function shippingProfile(product={}) {
  if(['leve','medio','pesado','volumoso'].includes(product.shippingProfile))return product.shippingProfile;
  const text=String([product.name,product.category].filter(Boolean).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/para-choque|parachoque|escapamento|radiador|tanque|capo|porta|paralama/.test(text))return 'volumoso';
  if(/amortecedor|disco|bandeja|caixa de direcao|semi eixo|virabrequim|cabecote/.test(text))return 'pesado';
  if(/pastilha|coxim|pivo|rolamento|bieleta|terminal|correia|polia/.test(text))return 'medio';
  if(/filtro|vela|sensor|lampada|fusivel|rele|interruptor|bucha/.test(text))return 'leve';
  return 'medio';
}
function productWeight(product={}) {
  const exact=Number(product.shippingWeightKg);if(Number.isFinite(exact)&&exact>0)return exact;
  return {leve:.5,medio:3,pesado:8,volumoso:12}[shippingProfile(product)];
}
function shippingFee(mode, subtotal, quantity, destination={},shipment={}) {
  if (mode==='Retirar') return 0;
  const uf=String(destination.uf||'').trim().toUpperCase(),city=String(destination.cidade||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(),cep=Number(String(destination.cep||'').replace(/\D/g,''));
  if(mode==='Motoboy'&&uf&&uf!=='SP')return null;
  const freeFrom=mode==='Motoboy'?1000:2500;
  if (subtotal>=freeFrom) return 0;
  const weight=Math.max(.1,Number(shipment.weightKg)||quantity*.5)*1.1;
  if (mode==='Motoboy') {
    const prefix3=Math.floor(cep/100000),prefix2=Math.floor(cep/1000000);
    const base=prefix3===15?18.90:prefix2===1?27.90:(Number.isFinite(cep)&&cep>=1000000&&cep<6000000?39.90:Number.isFinite(cep)&&cep<10000000?49.90:60.90);
    return Math.round((base+Math.max(0,weight-3)*2.2)*100)/100;
  }
  const southeast=new Set(['SP','RJ','MG','ES']),south=new Set(['PR','SC','RS']);
  const base=uf==='SP'?39.90:(southeast.has(uf)||south.has(uf)?59.90:79.90),rate=uf==='SP'?3.2:(southeast.has(uf)||south.has(uf)?4.5:6);
  return Math.round((base+Math.max(0,weight-1)*rate+(shipment.voluminous?18:0))*100)/100;
}
function quote(input, user, data, now=Date.now()) {
  if (!['PF','PJ'].includes(user.userType)) fail('Complete seu cadastro antes de pagar.');
  if (!['pix','card'].includes(input.method)) fail('Forma de pagamento inválida.');
  if (!['Transportadora','Motoboy','Retirar'].includes(input.mode)) fail('Entrega inválida.');
  const installments = input.method==='pix' ? 1 : Number(input.installments);
  if (!Number.isInteger(installments) || installments<1 || installments>12) fail('Parcelamento inválido.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length>100) fail('Carrinho inválido.');
  let coupon=0;
  const applied=user.cupomAtivo;
  if (applied) {
    const c=(data.cupons||{})[applied.cupomId];
    if (!c || !c.ativo || (c.expiracao && c.expiracao<=now) || (c.tipoCliente && !['ambos',user.userType].includes(c.tipoCliente)) || c.codigo!==applied.codigo || Number(c.desconto)!==Number(applied.desconto)) fail('O cupom mudou ou expirou. Revise o carrinho.');
    coupon=Math.max(0,Math.min(100,Number(c.desconto)||0));
  }
  const interestRate=0;
  const seen=new Set();
  let subtotalBeforeDiscounts=0;
  const items=input.items.map(item=>{
    if (typeof item.id!=='string' || !/^[^.#$\[\]/]{1,128}$/.test(item.id) || seen.has(item.id)) fail('Produto inválido ou duplicado.');
    seen.add(item.id);
    if (!Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>1000) fail('Quantidade inválida.');
    const raw=(data.products||{})[item.id];
    if (!raw || raw.soldOut) fail('Uma peça está indisponível. Revise o carrinho.');
    const p={...raw,id:item.id};
    const session=(data.sessions||{})[p.sessionId]||{};
    if (data.pricesHidden==='both' || data.pricesHidden===user.userType || session['hide'+user.userType] || (data['categoryHide'+user.userType]||{})[p.category] || p['hidePrice'+user.userType]) fail('Uma peça precisa de orçamento antes do pagamento.');
    const base=Number(p.prices?.[user.userType]);
    if (!Number.isFinite(base) || base<=0) fail('Uma peça precisa de orçamento antes do pagamento.');
    subtotalBeforeDiscounts+=base*item.quantity;
    const off=input.method==='pix' ? Math.max(discount(p,user,data.promocoes,now),coupon) : 0;
    const unitPrice=policy.unitPrice(base,interestRate,off);
    if (unitPrice<=0) fail('Valor inválido para pagamento.');
    return {id:p.id,name:String(p.name||'Peça').slice(0,200),codigo:p.codigo||'',image:p.image||'',category:p.category||'',brand:p.brand||'',shippingProfile:shippingProfile(p),shippingWeightKg:productWeight(p),quantity:item.quantity,unitPrice,subtotal:Math.round(unitPrice*item.quantity*100)/100};
  });
  const subtotal=Math.round(items.reduce((s,p)=>s+p.subtotal,0)*100)/100;
  subtotalBeforeDiscounts=Math.round(subtotalBeforeDiscounts*100)/100;
  const quantity=items.reduce((sum,item)=>sum+item.quantity,0),shipment={weightKg:items.reduce((sum,item)=>sum+item.shippingWeightKg*item.quantity,0),voluminous:items.some(item=>item.shippingProfile==='volumoso')},shipping=shippingFee(input.mode,subtotalBeforeDiscounts,quantity,user,shipment);
  if(shipping===null)fail('Motoboy está disponível somente para entregas no estado de São Paulo. Escolha transportadora.',400);
  const total=Math.round((subtotal+shipping)*100)/100;
  if (!Number.isFinite(input.expectedTotal) || policy.cents(total)!==policy.cents(input.expectedTotal)) fail('O valor mudou. Atualize e confira o carrinho antes de pagar.');
  return {items,subtotal,shipping,total,method:input.method,installments,interestRate,interestFree:interestRate===0,mode:input.mode,couponCode:applied?.codigo||null,couponDiscount:coupon};
}
function validSignature(id, requestId, header, secret) {
  if (!secret || !id || !requestId || !header) return false;
  const fields=Object.fromEntries(header.split(',').map(p=>p.trim().split('=')));
  if (!/^\d+$/.test(fields.ts||'') || !/^[a-f0-9]{64}$/i.test(fields.v1||'')) return false;
  const expected=crypto.createHmac('sha256',secret).update(`id:${String(id).toLowerCase()};request-id:${requestId};ts:${fields.ts};`).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(fields.v1,'hex'));
}
function verifiedPayment(payment, order, seller, testAccounts) {
  if (!testAccounts?.sellerIsTest || !testAccounts?.buyerIsTest || String(payment.payer?.id)!==String(testAccounts.buyerId)) fail('As contas de teste não foram confirmadas.',409);
  if ( String(payment.collector_id)!==String(seller) || payment.currency_id!=='BRL' || payment.external_reference!==order.reference || Math.round(Number(payment.transaction_amount)*100)!==Math.round(order.total*100)) fail('O pagamento não corresponde ao pedido de teste.',409);
  const balance = payment.payment_method_id==='account_money' && payment.payment_type_id==='account_money' && order.installments===1;
  if (!balance && ((order.method==='pix' && payment.payment_method_id!=='pix') || (order.method==='card' && (payment.payment_type_id!=='credit_card' || Number(payment.installments)!==order.installments)))) fail('Forma de pagamento diferente do pedido.',409);
  return payment.status==='approved' ? 'pago' : ['cancelled','refunded','charged_back'].includes(payment.status) ? 'cancelado' : 'pendente';
}
module.exports={quote,shippingFee,shippingProfile,productWeight,validSignature,verifiedPayment,fail};
