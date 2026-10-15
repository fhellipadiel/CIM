const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../cim.html'),'utf8');
const match=html.match(/function catalogPresentationSignature\(value\)\{[\s\S]*?\n        \}/);
if(!match)throw Error('Assinatura do catálogo não encontrada.');
const signature=vm.runInNewContext('('+match[0]+')');
test('cliques de visitantes não invalidam a apresentação do catálogo',()=>{
 const raw={one:{id:'one',name:'Peça',prices:{PF:100},clicks:1},two:{id:'two',name:'Outra peça',clicks:5}};
 const updated=structuredClone(raw);updated.one.clicks=2;updated.two.clicks=50;
 assert.equal(signature(raw),signature(updated));
});
test('mudanças de produto, preço, imagem e disponibilidade invalidam o catálogo',()=>{
 const raw={one:{id:'one',name:'Peça A',image:'a.webp',prices:{PF:100},soldOut:false,featured:false}};
 for(const patch of [{name:'Peça B'},{image:'b.webp'},{prices:{PF:101}},{soldOut:true},{featured:true}]){
  assert.notEqual(signature(raw),signature({one:{...raw.one,...patch}}));
 }
});
