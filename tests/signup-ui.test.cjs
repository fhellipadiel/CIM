const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const html=fs.readFileSync(require('node:path').join(__dirname,'../login.html'),'utf8');
test('requisitos de senha sao texto sem fundo e aparecem apenas durante foco',()=>{
 const input={value:''},list={hidden:true},items=['length','uppercase','lowercase','number','symbol'].map(key=>({dataset:{passwordRule:key},met:false,classList:{toggle(_class,value){items.find(item=>item.dataset.passwordRule===key).met=value;}}}));
 const ctx=vm.createContext({SignupPolicy:require('../assets/signup-policy.js'),document:{getElementById:id=>id==='regPassword'?input:list,querySelectorAll:()=>items}});
 const source=html.slice(html.indexOf('        function updateRegistrationPasswordRules()'),html.indexOf('        function registrationDocumentError()'));vm.runInContext(source,ctx);
 ctx.showRegistrationPasswordRules();assert.equal(list.hidden,false);assert.equal(items.some(i=>i.met),false);input.value='Senha1#!';ctx.updateRegistrationPasswordRules();assert.equal(items.every(i=>i.met),true);ctx.hideRegistrationPasswordRules();assert.equal(list.hidden,true);
 assert.match(html,/.password-rules li\{color:#fb7185\}/);assert.match(html,/.password-rules li.is-met\{color:#34d399\}/);
});
