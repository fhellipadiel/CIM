const {fail}=require('./core.cjs');
function activeMode(env=process.env){
  const mode=env.MP_ENVIRONMENT||'test';
  if(!['test','production'].includes(mode))fail('Ambiente de pagamento inválido.',503);
  return mode;
}
function settings(mode=activeMode(),env=process.env){
  if(!['test','production'].includes(mode))fail('Ambiente de pagamento inválido.',503);
  const production=mode==='production';
  const token=production?env.MP_PRODUCTION_ACCESS_TOKEN:env.MP_ACCESS_TOKEN;
  const sellerId=production?env.MP_PRODUCTION_SELLER_ID:env.MP_SELLER_ID;
  const webhookSecret=production?env.MP_PRODUCTION_WEBHOOK_SECRET:env.MP_ORDERS_WEBHOOK_SECRET;
  const base=production?env.CHECKOUT_PRODUCTION_BASE_URL:(env.CHECKOUT_BASE_URL||'http://localhost:3000');
  if(!token||!/^\d+$/.test(sellerId||''))fail('Configure as credenciais do ambiente de pagamento no servidor.',503);
  let url;try{url=new URL(base);}catch{fail('Configure o domínio de retorno no servidor.',503);}
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')fail('O endereço de retorno deve conter somente a origem do site.',503);
  if(production){
    if(!webhookSecret)fail('Configure a assinatura do webhook de produção.',503);
    if(url.protocol!=='https:'||['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname)||url.hostname.endsWith('.trycloudflare.com'))fail('Produção exige o domínio definitivo com HTTPS.',503);
  }else if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))fail('Endereço de teste inválido.',503);
  return {mode,testMode:!production,root:production?'orders':'paymentTests',token,sellerId,webhookSecret,base:url.origin};
}
function orderMode(order){return order.testMode===false?'production':'test';}
function validOrderId(id,mode){
  return mode==='test'?/^ORDTST[A-Z0-9]+$/.test(id||''):/^ORD(?!TST)[A-Z0-9]+$/.test(id||'');
}
function verifySeller(seller,cfg){
  const test=seller.tags?.includes('test_user')===true;
  if(String(seller.id)!==String(cfg.sellerId)||test!==cfg.testMode)fail('A conta recebedora não corresponde ao ambiente configurado.',409);
}
module.exports={activeMode,settings,orderMode,validOrderId,verifySeller};
