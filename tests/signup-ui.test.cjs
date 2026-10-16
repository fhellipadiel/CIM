const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const html=fs.readFileSync(require('node:path').join(__dirname,'../login.html'),'utf8');
test('requisitos de senha sao texto sem fundo e aparecem apenas durante foco',()=>{
 const input={value:''},list={hidden:true},items=['length','uppercase','lowercase','number','symbol'].map(key=>({dataset:{passwordRule:key},met:false,classList:{toggle(_class,value){items.find(item=>item.dataset.passwordRule===key).met=value;}}}));
 const ctx=vm.createContext({SignupPolicy:require('../assets/signup-policy.js'),document:{getElementById:id=>id==='regPassword'?input:list,querySelectorAll:()=>items}});
 const source=html.slice(html.indexOf('        function updateRegistrationPasswordRules()'),html.indexOf('        function registrationDocumentError()'));vm.runInContext(source,ctx);
 ctx.showRegistrationPasswordRules();assert.equal(list.hidden,false);assert.equal(items.some(i=>i.met),false);input.value='Senha1#!';ctx.updateRegistrationPasswordRules();assert.equal(items.every(i=>i.met),true);ctx.hideRegistrationPasswordRules();assert.equal(list.hidden,true);
 assert.match(html,/.password-rules li\{color:#fb7185\}/);assert.match(html,/.password-rules li.is-met\{color:#34d399\}/);
});

test('cadastro recusa email sem revelar se ha conta vinculada',async()=>{
 const shown=[],fields={regName:{value:'Customer'},regDoc:{value:'52998224725'},regPhone:{value:'11999999999'},regEmail:{value:'person@example.com'},regPassword:{value:'Senha1#!'},regPasswordConfirm:{value:'Senha1#!'},registerBtn:{}};
 const ctx=vm.createContext({currentPersonType:'fisica',modoGoogleCadastro:false,usuarioGoogle:null,auth:{currentUser:null,createUserWithEmailAndPassword:async()=>{throw {code:'auth/email-already-in-use',message:'EMAIL_EXISTS'};}},database:{},document:{getElementById:id=>fields[id]},SignupPolicy:require('../assets/signup-policy.js'),hideMessage:()=>{},showMessage:value=>shown.push(value),registrationDocumentError:()=>{throw Error('unexpected document error');},console:{error:()=>{}}});
 vm.runInContext(html.match(/async function handleRegister\(event\) \{[\s\S]*?\n        \}/)[0],ctx);await ctx.handleRegister({preventDefault:()=>{}});
 assert.equal(shown.length,1);assert.doesNotMatch(shown[0],/cadastrad|em uso|EMAIL_EXISTS|email-already|existe/i);assert.match(shown[0],/dados informados/);
});
test('consulta publica de CNPJ nao mostra aprovacao do cadastro',async()=>{
 const cnpj='11222333000181',fields={regDoc:{value:cnpj},docLoading:{classList:{remove:()=>{},add:()=>{}}},docApiFeedback:{}};
 for(const key of ['regName','regFantasia','regSituacao','regLogradouro','regNumero','regBairro','regMunicipio','regUf','regCep'])fields[key]={value:''};
 const ctx=vm.createContext({currentPersonType:'juridica',SignupPolicy:require('../assets/signup-policy.js'),document:{getElementById:id=>fields[id]},AbortSignal,fetch:async()=>({ok:true,json:async()=>({razao_social:'Public company'})})});
 fields.docApiFeedback.classList={add:()=>{}};
 vm.runInContext(html.match(/async function fetchCnpjData\(cnpj\) \{[\s\S]*?\n        \}/)[0],ctx);await ctx.fetchCnpjData(cnpj);
 assert.match(fields.docApiFeedback.textContent,/cadastro ainda/);assert.equal(fields.docApiFeedback.className.includes('emerald'),false);
});
