(function(root,factory){
  const policy=factory();
  if(typeof module==='object' && module.exports) module.exports=policy;
  else root.CimPaymentPolicy=policy;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const taxes=Object.freeze({1:0,2:6.32,3:6.91,4:7.54,5:8.14,6:8.74,7:9.26,8:9.95,9:10.63,10:11.12,11:11.81,12:12.50});
  function interestFree(installment){ return Number(installment)===1; }
  function rate(installment){ return taxes[installment]||0; }
  function cents(value){return Math.round((Number(value)+Number.EPSILON)*100);}
  function unitPrice(base,percent=0,discount=0){return cents(Number(base)*(1-Number(discount)/100)*(1+Number(percent)/100))/100;}
  function total(items,price){return items.reduce((sum,item)=>sum+cents(price(item))*item.quantity,0)/100;}
  function orderExpiresAt(order){return Number(order.expiresAt)||Number(order.createdAt)+60*60*1000;}
  function isOrderVisible(order,now=Date.now()){return !order.archivedAt && order.paymentStatus!=='expired' && !(order.status==='pendente' && orderExpiresAt(order)<=now);}
  function isLegacyOrder(order){return !!order && order.testMode!==false && !['provider','mercadoOrderId','paymentId','mercadoPaymentId','paymentStatus','checkoutUrl','preferenceId','external_reference','reference'].some(key=>order[key]);}
  function isPaidOrder(order){return !order.archivedAt && ['pago','confirmado','preparando','enviado','entregue'].includes(order.status) && (order.provider!=='orders'||order.paymentStatus==='accredited');}
  return Object.freeze({taxes,interestFree,rate,cents,unitPrice,total,orderExpiresAt,isOrderVisible,isLegacyOrder,isPaidOrder});
});