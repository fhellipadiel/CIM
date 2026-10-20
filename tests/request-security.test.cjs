const {test}=require('node:test');
const assert=require('node:assert/strict');
const {originAllowed,rateLimit}=require('../server/request-security.cjs');
function db(){let value;return{ref:()=>({transaction:async fn=>{const next=fn(value);if(next===undefined)return{committed:false};value=next;return{committed:true}}})}}
test('origem externa é recusada e domínio oficial é aceito',()=>{const env={CHECKOUT_PRODUCTION_BASE_URL:'https://www.cimautoparts.com.br'};assert.throws(()=>originAllowed({headers:{origin:'https://evil.example'}},'checkout',env),e=>e.status===403);assert.equal(originAllowed({headers:{origin:'https://www.cimautoparts.com.br'}},'checkout',env),true);assert.equal(originAllowed({headers:{origin:'https://evil.example'}},'webhook',env),true)});
test('limite distribuído bloqueia excesso sem armazenar IP puro',async()=>{const store=db(),req={headers:{'x-forwarded-for':'203.0.113.7'}};await rateLimit(store,req,'checkout','user',{limit:2,now:1});await rateLimit(store,req,'checkout','user',{limit:2,now:2});await assert.rejects(rateLimit(store,req,'checkout','user',{limit:2,now:3}),e=>e.status===429)});
