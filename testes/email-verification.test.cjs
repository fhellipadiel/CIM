const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

test('login não exige confirmação de e-mail para liberar a conta',()=>{
  const login=fs.readFileSync(path.join(__dirname,'../login.html'),'utf8');
  assert.ok(!login.includes('id="emailVerificationPanel"'));
  assert.ok(!login.includes('sendEmailVerification'));
  assert.ok(!login.includes('isManualEmailAccount'));
  assert.ok(login.includes("signInWithPopup(provider)"));
});

test('login Google tem retorno por redirecionamento quando o popup não é utilizável',()=>{
 const login=fs.readFileSync(path.join(__dirname,'../login.html'),'utf8');
 assert.ok(login.includes('auth.signInWithRedirect(provider)'));
 assert.ok(login.includes('auth.getRedirectResult()'));
 assert.ok(login.includes("error.code === 'auth/popup-blocked'"));
 assert.ok(login.includes("error.code === 'auth/unauthorized-domain'"));
 assert.ok(login.includes('completeGoogleAuthentication(result)'));
});

test('catálogo não bloqueia sessão de conta sem confirmação de e-mail',()=>{
  const catalog=fs.readFileSync(path.join(__dirname,'../cim.html'),'utf8');
  assert.ok(!catalog.includes("login.html?verification=required"));
});
