const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../cim.html'),'utf8');
function setup(randoms){const calls=[],scrolls=[],ctx=vm.createContext({Math:{random:()=>{if(!randoms.length)throw Error('Unexpected new random rank');return randoms.shift();}},filterProducts:force=>calls.push(force),window:{scrollTo:value=>scrolls.push(value)}});vm.runInContext(html.match(/const catalogRandomRanks=new Map\(\);[\s\S]*?let renderToken = 0;/)[0],ctx);return {ctx,calls,scrolls};}
const products=[{id:'a',prices:{PF:100}},{id:'b',prices:{PF:50}},{id:'sold',soldOut:true,topPriority:true,featured:true},{id:'sold2',soldOut:true}];
const ids=values=>Array.from(values,p=>p.id);
test('pecas disponiveis sao aleatorias e esgotadas ficam sempre no fim',()=>{const {ctx}=setup([.9,.2,.1,.3]);assert.deepEqual(ids(ctx.randomlyOrderCatalog(products)),['b','a','sold','sold2']);assert.deepEqual(ids(products),['a','b','sold','sold2']);assert.deepEqual(ids(ctx.randomlyOrderCatalog(products.map(p=>({...p})))),['b','a','sold','sold2']);});
test('logo renova sorteio, atualiza o catalogo e mantem esgotadas no fim',()=>{const {ctx,calls,scrolls}=setup([.9,.2,.1,.3,.1,.9,.6,.4]);ctx.randomlyOrderCatalog(products);ctx.reshuffleCatalog();assert.deepEqual(calls,[true]);assert.equal(scrolls[0].top,0);assert.deepEqual(ids(ctx.randomlyOrderCatalog(products)),['a','b','sold2','sold']);assert.match(html,/<button[^>]*class="logo"[^>]*onclick="reshuffleCatalog\(\)"/);});
test('nova abertura recebe novo sorteio e filtros preservam a ordem relativa',()=>{const first=setup([.9,.2,.1,.3]).ctx,second=setup([.1,.9,.6,.4]).ctx;assert.notDeepEqual(ids(first.randomlyOrderCatalog(products)),ids(second.randomlyOrderCatalog(products)));assert.deepEqual(ids(first.randomlyOrderCatalog([products[2],products[0]])),['a','sold']);});

test('pecas sem preco ficam depois das precificadas e antes das esgotadas',()=>{
 const list=[{id:'priced',prices:{PF:10}},{id:'pj',prices:{PF:0,PJ:20}},{id:'zero',prices:{PF:0,PJ:0}},{id:'missing'},{id:'sold',soldOut:true,prices:{PF:100}}];
 const {ctx}=setup([.9,.8,.1,.2,0]);
 assert.deepEqual(ids(ctx.randomlyOrderCatalog(list)),['pj','priced','zero','missing','sold']);
 list[2].prices.PF=5;
 assert.deepEqual(ids(ctx.randomlyOrderCatalog(list)),['zero','pj','priced','missing','sold']);
});
