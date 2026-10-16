const {test}=require('node:test');const assert=require('node:assert/strict');
const {recordAdminSession}=require('../server/admin-sessions.cjs');
function memory(){const data={};return {data,ref:path=>({transaction:async fn=>{data[path]=fn(data[path]||null);return {snapshot:{val:()=>data[path]}};},set:async value=>{data[path]=value;}})};}
test('recarregar com o mesmo login nao duplica entrada nem altera a hora',async()=>{
 const db=memory(),caller={uid:'admin',auth_time:100};await recordAdminSession(db,caller,'Browser',100001);
 await recordAdminSession(db,caller,'Other browser',200000);
 const entries=Object.values(db.data['adminLoginHistory/admin']);assert.equal(entries.length,1);assert.equal(entries[0].enteredAt,100001);assert.equal(entries[0].browser,'Browser');assert.equal(db.data['users/admin/lastAdminLoginAt'],100001);
});
test('logins diferentes ficam separados e o historico guarda as 30 ultimas entradas',async()=>{
 const db=memory();for(let n=1;n<=35;n++)await recordAdminSession(db,{uid:'admin',auth_time:n},'B',n*1000);
 const entries=Object.values(db.data['adminLoginHistory/admin']);assert.equal(entries.length,30);assert.equal(Math.min(...entries.map(e=>e.enteredAt)),6000);assert.equal(db.data['users/admin/lastAdminLoginAt'],35000);
 await recordAdminSession(db,{uid:'another-admin',auth_time:50},'B',50000);assert.equal(Object.keys(db.data['adminLoginHistory/another-admin']).length,1);
});
test('entrada exige data autenticada e limita texto do navegador',async()=>{
 const db=memory();await assert.rejects(recordAdminSession(db,{uid:'admin'},'B'),e=>e.status===401);
 await recordAdminSession(db,{uid:'admin',auth_time:1},'X'.repeat(1000),1000);assert.equal(Object.values(db.data['adminLoginHistory/admin'])[0].browser.length,256);
});
