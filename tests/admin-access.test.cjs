const {test}=require('node:test');
const assert=require('node:assert/strict');
const {requireAdminAccess}=require('../server/admin-access.cjs');
const db={ref:path=>({toString:()=> 'https://example.firebaseio.com/'+path})};
const req={headers:{authorization:'Bearer fake-id-token'}};
test('API verifica permissao usando token do usuario e as regras publicadas',async()=>{
 let requested;
 assert.equal(await requireAdminAccess(req,db,async url=>{requested=url;return {ok:true,status:200};}),true);
 assert.equal(requested.pathname,'/adminAccess.json');assert.equal(requested.searchParams.get('auth'),'fake-id-token');
});
test('API nega acesso sem token, negado pelas regras e em falha de rede',async()=>{
 await assert.rejects(requireAdminAccess({headers:{}},db),e=>e.status===401);
 for(const status of [401,403])await assert.rejects(requireAdminAccess(req,db,async()=>({ok:false,status})),e=>e.status===403);
 await assert.rejects(requireAdminAccess(req,db,async()=>{throw Error('network');}),e=>e.status===503);
 await assert.rejects(requireAdminAccess(req,db,async()=>({ok:false,status:500})),e=>e.status===503);
});
