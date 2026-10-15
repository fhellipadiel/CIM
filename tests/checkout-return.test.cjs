const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../cim.html'),'utf8');
const start=html.indexOf('        function showVerifiedCheckoutSuccess(');
const end=html.indexOf('        const checkoutReturnId =',start);
function setup(){
 const calls=[];const elements={cartMainView:{style:{}},cartSuccessScreen:{style:{}}};
 const context={sessionStorage:{removeItem:k=>calls.push(k)},clearCartAfterOrder:()=>calls.push('clear'),document:{getElementById:id=>elements[id]},cartPanel:{classList:{add:v=>calls.push(v)}},URL,location:{href:'http://localhost:3000/cim.html?checkout_test=abc&status=approved'},history:{replaceState:(a,b,v)=>calls.push(v)}};
 vm.createContext(context);vm.runInContext(html.slice(start,end),context);return {context,calls,elements};
}
test('retorno pendente ou cancelado nao confirma nem limpa carrinho',()=>{
 for(const status of ['pendente','cancelado']){const {context,calls}=setup();assert.equal(context.showVerifiedCheckoutSuccess({status}),false);assert.deepEqual(calls,[]);}
});
test('retorno verificado como pago abre confirmacao e remove parametros',()=>{
 const {context,calls,elements}=setup();assert.equal(context.showVerifiedCheckoutSuccess({status:'pago'}),true);
 assert.equal(elements.cartMainView.style.display,'none');assert.equal(elements.cartSuccessScreen.style.display,'flex');
 assert.deepEqual(calls,['cim_checkout_attempt','open','/cim.html']);
});
