const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const support=fs.readFileSync(path.join(root,'assets','support-chat.js'),'utf8');

test('pagina publica mantem conteudo visivel sem IntersectionObserver',()=>{
  assert.match(index,/if \('IntersectionObserver' in window\)/);
  assert.match(index,/reveals\.forEach\(el => el\.classList\.add\('active'\)\)/);
});

test('requisicoes publicas nao dependem de AbortSignal.timeout',()=>{
  assert.doesNotMatch(index,/AbortSignal\.timeout/);
  assert.match(index,/window\.cimFetchWithTimeout/);
});

test('chat possui identificador alternativo sem crypto.randomUUID',()=>{
  assert.match(support,/typeof window\.crypto\.randomUUID==='function'/);
  assert.match(support,/'support-'\+Date\.now\(\)\.toString\(36\)/);
});
