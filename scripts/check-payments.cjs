const {activeMode,settings}=require('../server/payment-config.cjs');
console.log('Ambiente ativo: '+activeMode());
for(const mode of ['test','production']){
 try{const cfg=settings(mode);console.log(mode+': configuração de credenciais/domínio presente; conta e webhook ainda exigem validação externa.');}
 catch(error){console.log(mode+': '+error.message);}
}
const needed=['MP_PRODUCTION_ACCESS_TOKEN','MP_PRODUCTION_SELLER_ID','MP_PRODUCTION_WEBHOOK_SECRET','CHECKOUT_PRODUCTION_BASE_URL'];
const missing=needed.filter(key=>!process.env[key]);
if(missing.length)console.log('Pendências de produção: '+missing.join(', '));
console.log('Nenhuma cobrança criada. Nenhum segredo exibido.');
