const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const employeeHtml=fs.readFileSync('funcionario.html','utf8');
const landingHtml=fs.readFileSync('index.html','utf8');

test('link pessoal identifica explicitamente o funcionario',()=>{
  assert.match(employeeHtml,/employeeReferralUrl=slug=>location\.origin\+'\/\?funcionario='\+encodeURIComponent\(slug\)/);
  assert.match(employeeHtml,/copyLink\.textContent=employeeReferralUrl\(e\.slug\)/);
});

test('falha ao carregar painel nao encerra a sessao automaticamente',()=>{
  const authHandler=employeeHtml.match(/auth\.onAuthStateChanged\(async user=>\{if\(!user\)[\s\S]*?\}\);/g)?.at(-1)||'';
  assert.ok(authHandler);
  assert.doesNotMatch(authHandler,/auth\.signOut\(/);
});

test('links pessoais antigos por slug continuam reconhecidos',()=>{
  assert.match(landingHtml,/employees\.json/);
  assert.match(landingHtml,/sessionStorage\.setItem\('employeeRef', pathSlug\)/);
});
