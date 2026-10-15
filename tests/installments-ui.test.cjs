const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const policy=require('../assets/payment-policy.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../cim.html'),'utf8');
function fn(name){const a=source.indexOf('        function '+name+'('),b=source.indexOf('\n        function ',a+1);assert.ok(a>=0&&b>a);return source.slice(a,b);}
test('simulação usa tabela fixa, mas checkout recebe preço original',()=>{
const select={innerHTML:''};const c={CimPaymentPolicy:policy,cardInterestFreeInstallments:{},paymentMethod:'card',installments:6,cart:[{quantity:1,base:507.65}],getBasePriceForItem:i=>i.base,getCartSubtotalBase:()=>507.65,getCartSubtotalPix:()=>456.89,fmtBRL:v=>'R$ '+v.toFixed(2),document:{getElementById:()=>select}};
vm.createContext(c);for(const n of ['getCurrentTax','getFinalTotal','buildInstallmentsOptions'])vm.runInContext(fn(n),c);
assert.equal(c.getFinalTotal(),552.02);c.buildInstallmentsOptions();assert.ok(select.innerHTML.includes('6x de R$ 92.00 (Total R$ 552.02 com juros)'));
c.cardInterestFreeInstallments={6:true};assert.equal(c.getFinalTotal(),552.02);
c.installments=1;assert.equal(c.getCurrentTax(),0);assert.equal(c.getFinalTotal(),507.65);
c.cardInterestFreeInstallments={2:false};c.installments=2;assert.equal(c.getCurrentTax(),6.32);
assert.ok(source.includes("expectedTotal:(paymentMethod === 'pix' ? getCartSubtotalPix() : getCartSubtotalBase())"));
c.paymentMethod='pix';assert.equal(c.getFinalTotal(),456.89);
});