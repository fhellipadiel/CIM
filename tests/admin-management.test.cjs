const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {handleAdminManagement}=require('../server/admin-management.cjs');

function fixture(){
 const data={accessControl:{admins:{primary:{enabled:true,canRead:true,canWrite:true},secondary:{enabled:true,canRead:true,canWrite:true}}},users:{secondary:{name:'Secundário',isAdmin:true}},adminMfaPolicy:{secondary:{required:true}}},deleted=[];
 const read=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data);
 const write=(path,value)=>{const keys=path.split('/').filter(Boolean),last=keys.pop();let node=data;for(const key of keys)node=node[key]??={};if(value===null)delete node[last];else node[last]=structuredClone(value)};
 const db={data,ref:path=>({get:async()=>({val:()=>structuredClone(read(path))}),set:async value=>write(path,value),update:async updates=>{if(path){const current=read(path)||{};write(path,{...current,...updates})}else for(const [target,value]of Object.entries(updates))write(target,value)}})};
 const auth={createUser:async input=>({uid:'created-admin',...input}),deleteUser:async uid=>deleted.push(uid),revokeRefreshTokens:async uid=>deleted.push('revoked:'+uid)};
 const call=(body,uid='primary')=>handleAdminManagement({auth,db,caller:{uid},body,primaryUid:'primary'});
 return{call,data,deleted};
}

test('somente o principal cria administrador no Auth e registro privado',async()=>{
 const f=fixture();
 await assert.rejects(f.call({op:'create',name:'Novo Admin',email:'novo@example.com',password:'SenhaForte#123'},'secondary'),error=>error.status===403);
 const result=await f.call({op:'create',name:'Novo Admin',email:'novo@example.com',password:'SenhaForte#123'});
 assert.equal(result.uid,'created-admin');
 assert.equal(f.data.users['created-admin'].isAdmin,true);
 assert.equal(f.data.accessControl.admins['created-admin'].canWrite,true);
});

test('principal exclui secundario mas nunca pode excluir a propria conta',async()=>{
 const f=fixture();
 await assert.rejects(f.call({op:'delete',uid:'primary'}),error=>error.status===409);
 await f.call({op:'delete',uid:'secondary'});
 assert.deepEqual(f.deleted,['secondary']);
 assert.equal(f.data.users.secondary,undefined);
 assert.equal(f.data.accessControl.admins.secondary,undefined);
 assert.equal(f.data.adminMfaPolicy.secondary,undefined);
});

test('configuracoes e lista possuem gestao visual de administradores',()=>{
 const html=fs.readFileSync('adm.html','utf8');
 assert.match(html,/id="adminManagementCard"/);
 assert.match(html,/id="modalCreateAdmin"/);
  assert.match(html,/id="usersCreateAdminOption"/);
 assert.match(html,/deleteAdministratorAdm/);
 assert.match(html,/currentAdminIsPrimary/);
 assert.match(html,/onlineAdminsBadge/);
 assert.match(html,/modalAdminPermissions/);
 const login=html.match(/async function doLogin\(\)\{[\s\S]*?\n\}/)?.[0]||'';
 assert.doesNotMatch(login,/initializeAdminSession\(/);
});

test('principal define abas e modo somente visualizacao',async()=>{
 const f=fixture();
 const result=await f.call({op:'permissions',uid:'secondary',accessMode:'view',allowedPanels:['dashboard','usuarios','invalida']});
 assert.equal(result.canWrite,false);
 assert.deepEqual(result.allowedPanels,['dashboard','usuarios']);
 assert.equal(f.data.accessControl.admins.secondary.canWrite,false);
 assert.deepEqual(f.data.accessControl.admins.secondary.allowedPanels,['dashboard','usuarios']);
 assert.ok(f.deleted.includes('revoked:secondary'));
});

test('administrador autorizado registra presenca sem poder gerenciar outros',async()=>{
 const f=fixture();
 await f.call({op:'presence'},'secondary');
 assert.equal(typeof f.data.adminPresence.secondary.lastActiveAt,'number');
 await assert.rejects(f.call({op:'permissions',uid:'secondary',accessMode:'view'},'secondary'),error=>error.status===403);
});
