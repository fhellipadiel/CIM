const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

test('login exige confirmação de e-mail antes de liberar a conta',()=>{
  const login=fs.readFileSync(path.join(__dirname,'../login.html'),'utf8');
  assert.ok(login.includes('id="emailVerificationPanel"'));
  assert.ok(login.includes('user.sendEmailVerification()'));
  assert.ok(login.includes('auth.currentUser.emailVerified'));
  assert.ok(login.includes("signInWithPopup(provider)"));
  assert.ok(login.includes('linkWithCredential(pendingGoogleCredential)'));
  assert.ok(login.includes('O Google não confirmou este e-mail'));
});

test('catálogo não aceita sessão de e-mail pendente de confirmação',()=>{
  const catalog=fs.readFileSync(path.join(__dirname,'../cim.html'),'utf8');
  assert.ok(catalog.includes('await user.reload()'));
  assert.ok(catalog.includes("login.html?verification=required"));
});
