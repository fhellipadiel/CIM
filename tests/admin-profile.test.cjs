const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../adm.html'),'utf8');
test('administrador exibe editor e historico no lugar do endereco',()=>{
 let rendered='';const user={uid:'admin',isAdmin:true,name:'Admin',logradouro:'PRIVATE ADDRESS',cep:'12345678'};
 const ctx=vm.createContext({usersCache:[user],currentAdmin:{uid:'admin'},document:{getElementById:id=>id==='usersListAdm'?{set innerHTML(value){rendered=value;}}:{value:''}},filteredUsersForCsv:()=>[user],fmtDate:()=>'',fmtTime:()=>'',esc:value=>String(value),getUserOrigin:()=> 'manual',userHasRealPhoto:()=>false,Date});
 const source=html.match(/function renderUsers\(\)\{[\s\S]*?\n\}/)[0];vm.runInContext(source,ctx);ctx.renderUsers();
 assert.match(rendered,/openAdminProfileEditor/);assert.match(rendered,/admin-history-admin/);assert.equal(rendered.includes('PRIVATE ADDRESS'),false);assert.equal(rendered.includes('toggleUserNameEditingAdm'),false);
});
test('editor salva apenas nome e foto e nao altera permissoes',async()=>{
 const uploads=[],updates=[],inputs={adminProfileName:{value:' Updated Admin '},adminProfilePhoto:{files:[{type:'image/png',size:10}]},saveAdminProfileButton:{disabled:false},cfgAdminName:{}};
 const ctx=vm.createContext({editingAdminUid:'admin',usersCache:[{uid:'admin',isAdmin:true}],currentAdmin:{uid:'admin'},auth:{currentUser:{uid:'editor'}},document:{getElementById:id=>inputs[id]},uploadImg:async(file,folder)=>{uploads.push(folder);return 'https://example.com/photo.png';},database:{ref:target=>({update:async value=>updates.push({target,value:JSON.parse(JSON.stringify(value))})})},closeModal:()=>{},showToast:()=>{}});
 vm.runInContext(html.match(/async function saveAdminProfileEditor\(\)\{[\s\S]*?\n\}/)[0],ctx);await ctx.saveAdminProfileEditor();
 assert.deepEqual(updates,[{target:'users/admin',value:{name:'Updated Admin',photoURL:'https://example.com/photo.png'}}]);assert.equal(inputs.saveAdminProfileButton.disabled,false);assert.deepEqual(uploads,['avatars/editor']);
});

