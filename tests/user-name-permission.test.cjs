const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../cim.html'),'utf8');
const save=html.match(/async function saveUserSettings\(\) \{[\s\S]*?\n        \}\n/)[0];
async function run(user,name='Changed name'){
 const writes=[];const values={setName:name,setTelefone:'11999999999',setCep:'12345678',setLogradouro:'Street',setNumero:'1',setComplemento:'',setBairro:'Area',setCidade:'City',setUf:'SP'};
 const context=vm.createContext({currentUser:{uid:'customer',name:'Original',...user},document:{getElementById:id=>({value:values[id]||'',disabled:false})},database:{ref:()=>({update:async data=>writes.push(JSON.parse(JSON.stringify(data)))})},showToast:()=>{},showLoading:()=>{},hideLoading:()=>{}});
 vm.runInContext(save,context);await context.saveUserSettings();return writes;
}
test('PF sem permissao salva contato sem alterar nome',async()=>{const writes=await run({userType:'PF',canEditName:false});assert.equal(writes.length,1);assert.equal('name' in writes[0],false);assert.equal(writes[0].telefone,'11999999999');});
test('PJ liberado pode alterar somente nome',async()=>{assert.deepEqual(await run({userType:'PJ',canEditName:true}),[{name:'Changed name'}]);});
test('PJ bloqueado nao salva e nome vazio e recusado',async()=>{assert.deepEqual(await run({userType:'PJ',canEditName:false}),[]);assert.deepEqual(await run({userType:'PF',canEditName:true},' '),[]);});
test('abas de clientes excluem administradores',()=>{
 const admin=fs.readFileSync(require('node:path').join(__dirname,'../adm.html'),'utf8');const source=admin.match(/function filteredUsersForCsv\(\)\{[\s\S]*?\n\}/)[0];
 const now=Date.now();const users=[{uid:'admin',isAdmin:true,userType:'PF',lastAccess:now},{uid:'pf',userType:'PF',lastAccess:now},{uid:'pj',userType:'PJ',lastAccess:now}];
 const ctx=vm.createContext({usersCache:users,currentAdmin:{uid:'admin'},usersTab:'PF',document:{getElementById:()=>({value:''})},getUserOrigin:()=> 'manual',window:{},Date});vm.runInContext(source,ctx);
 assert.deepEqual(Array.from(ctx.filteredUsersForCsv(),u=>u.uid),['pf']);ctx.usersTab='online';assert.equal(ctx.filteredUsersForCsv().some(u=>u.uid==='admin'),false);ctx.usersTab='admins';assert.deepEqual(Array.from(ctx.filteredUsersForCsv(),u=>u.uid),['admin']);
});

