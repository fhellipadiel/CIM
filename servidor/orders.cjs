const {fail}=require('./core.cjs');
const policy=require('../assets/payment-policy.js');
const {validOrderId}=require('./payment-config.cjs');
function payload(priced,reference,returnUrl){
  const card=priced.method==='card';
  const payment_method={max_installments:card?12:1,not_allowed_types:card?['debit_card','ticket','bank_transfer']:['credit_card','debit_card','ticket']};

  const online={success_url:returnUrl,failure_url:returnUrl,pending_url:returnUrl};
  if(new URL(returnUrl).protocol==='https:')online.auto_return='approved';
  const items=priced.items.map(i=>({external_code:i.id,title:i.name,quantity:i.quantity,unit_price:i.unitPrice.toFixed(2)}));
  if(Number(priced.shipping)>0)items.push({external_code:'frete',title:`Frete — ${priced.mode}`,quantity:1,unit_price:Number(priced.shipping).toFixed(2)});
  return {type:'online',processing_mode:'manual',expiration_time:'PT1H',total_amount:priced.total.toFixed(2),external_reference:reference,items,config:{online,payment_method}};
}
function applyPayment(current,details,incoming){
  if(!current||!Number.isFinite(incoming))return;
  if(current.paymentUpdatedAt && incoming<current.paymentUpdatedAt)return;
  const fulfilled=['confirmado','preparando','enviado','entregue'].includes(current.status);
  if((['pago','cancelado'].includes(current.status)||fulfilled) && details.status==='pendente')return;
  if(current.status==='cancelado' && details.status==='pago')return;
  return {...current,...details,status:fulfilled&&details.status==='pago'?current.status:details.status,paymentUpdatedAt:incoming,updatedAt:Date.now()};
}
function verify(remote,local,seller,mode='test'){
  if(local.provider!=='orders' || local.testMode!==(mode==='test') || !validOrderId(remote.id,mode) || (mode==='production' && remote.live_mode===false) || remote.id!==local.mercadoOrderId || String(remote.user_id)!==String(seller) || remote.type!=='online' || remote.processing_mode!=='manual' || remote.currency!=='BRL' || remote.external_reference!==local.reference || !Number.isFinite(Number(remote.total_amount)) || policy.cents(remote.total_amount)!==policy.cents(local.total))fail('O pagamento não corresponde ao pedido.',409);
  if(['refunded','charged_back','cancelled','canceled','expired'].includes(remote.status))return {status:'cancelado',paymentStatus:remote.status};
  if(remote.status!=='processed')return {status:'pendente',paymentStatus:remote.status||'created'};
  const payments=remote.transactions?.payments||[];
  const successful=payments.filter(p=>p.status==='processed' && p.status_detail==='accredited');
  if(successful.length!==1)fail('A Order ainda não tem uma transação aprovada única.',409);
  const p=successful[0],m=p.payment_method||{};
  const actualInstallments=Number(m.installments||1);
  const balance=m.id==='account_money' && m.type==='account_money' && local.installments===1;
  if(!balance && ((local.method==='card' && (m.type!=='credit_card' || !Number.isInteger(actualInstallments) || actualInstallments<1 || actualInstallments>12)) || (local.method==='pix' && m.id!=='pix')))fail('Meio de pagamento diferente do pedido.',409);
  const paid=Number(remote.total_paid_amount ?? p.paid_amount);
  if(!Number.isFinite(paid)||policy.cents(paid)<policy.cents(local.total) || policy.cents(p.amount)!==policy.cents(local.total))fail('O total efetivamente pago diverge do pedido; é necessária conferência.',409);
  return {status:'pago',paymentStatus:'accredited',paymentId:String(p.id),actualPaymentMethod:m.id,actualInstallments,paidTotal:paid,financingCost:(policy.cents(paid)-policy.cents(local.total))/100};
}
module.exports={payload,verify,applyPayment};
