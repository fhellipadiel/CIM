const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
test('rotas de cadastro compartilham funcao sem permitir acoes arbitrarias',()=>{
 const forwarded=[],module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../api/checkout.js'),'utf8'),{module,URL,require:()=>({handle:action=>forwarded.push(action)})});
 module.exports({url:'/api/checkout',query:{signupAction:'company-lookup'}},{});
 module.exports({url:'/api/checkout?signupAction=register-profile'},{});
 module.exports({url:'/api/checkout?signupAction=webhook'},{});
 module.exports({url:'/api/checkout'},{});
 module.exports({url:'/api/checkout?signupAction=support'},{});
 module.exports({url:'/api/checkout?signupAction=analytics'},{});
 assert.deepEqual(forwarded,['company-lookup','register-profile','checkout','checkout','support','analytics']);
 const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
 for(const route of ['company-lookup','register-profile','support','analytics'])assert.ok(config.rewrites.some(r=>r.source==='/api/'+route&&r.destination==='/api/checkout?signupAction='+route));
 assert.ok(fs.readdirSync(path.join(__dirname,'../api')).filter(f=>f.endsWith('.js')).length<=12);
});
