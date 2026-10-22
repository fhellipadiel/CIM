const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const admin=fs.readFileSync(path.join(__dirname,'../adm.html'),'utf8');
const start=admin.indexOf('function parseCSVLine(');
const end=admin.indexOf('function normalizeImageUrl(',start);
const context=vm.createContext({});
vm.runInContext(admin.slice(start,end),context);

test('importação lê CSV brasileiro sem quebrar a vírgula dos preços',()=>{
  const columns=Array.from(context.parseCSVLine('Coxim Honda;1.234,56;999,90;Coxim;ABC-123;CIM;https://example.com/foto.webp;A'));
  assert.equal(columns.length,8);
  assert.equal(columns[1],'1.234,56');
  assert.equal(columns[2],'999,90');
  assert.equal(context.parseImportPriceAdm(columns[1]),1234.56);
  assert.equal(context.parseImportPriceAdm(columns[2]),999.90);
});

test('importação aceita CSV com vírgula, campos entre aspas e valores variados',()=>{
  const columns=Array.from(context.parseCSVLine('"Bandeja, dianteira","R$ 1.234,56",950.25,Suspensão,CIM-9'));
  assert.equal(columns[0],'Bandeja, dianteira');
  assert.equal(context.parseImportPriceAdm(columns[1]),1234.56);
  assert.equal(context.parseImportPriceAdm(columns[2]),950.25);
  assert.equal(context.parseImportPriceAdm('R$ 2.345,67'),2345.67);
});

test('falha no envio mantém a prévia disponível para tentar novamente',()=>{
  const catchStart=admin.indexOf('} catch(err){',admin.indexOf('async function importNamesAdm'));
  const cleanupStart=admin.indexOf("document.getElementById('importPreviewAdm').style.display = 'none'",catchStart);
  const failureBlock=admin.slice(catchStart,cleanupStart);
  assert.match(failureBlock,/importButton\.disabled/);
  assert.match(failureBlock,/return;/);
});

test('servidor confirma uma importação de peça e grava produto e histórico juntos',async()=>{
  const data={};
  const read=key=>key.split('/').filter(Boolean).reduce((value,part)=>value?.[part],data)??null;
  const write=(key,value)=>{const parts=key.split('/').filter(Boolean);let target=data;for(const part of parts.slice(0,-1))target=target[part]??={};if(value===null)delete target[parts.at(-1)];else target[parts.at(-1)]=structuredClone(value);};
  const snap=value=>({val:()=>structuredClone(value),exists:()=>value!==null&&value!==undefined});
  const db={ref:(base='')=>({
    get:async()=>snap(read(base)),once:async()=>snap(read(base)),on:()=>{},off:()=>{},set:async value=>write(base,value),
    update:async changes=>{for(const [key,value]of Object.entries(changes))write([base,key].filter(Boolean).join('/'),value);},
    transaction:async fn=>{const next=fn(structuredClone(read(base)));if(next===undefined)return{committed:false,snapshot:snap(read(base))};write(base,next);return{committed:true,snapshot:snap(next)};}
  })};
  const {handle}=require('../server/checkout.cjs');
  let status=200,response;
  const res={setHeader(){},status(code){status=code;return this;},json(value){response=value;return this;}};
  const history={fileName:'teste.csv',timestamp:Date.now(),totalItems:1,newItems:1,productIds:['produto_teste']};
  const updates={'products/produto_teste':{id:'produto_teste',name:'Coxim teste',codigo:'TESTE-1',prices:{PF:123.45,PJ:110}}};
  await handle('admin-import-history',{method:'POST',url:'/api/admin-import-history',headers:{authorization:'Bearer admin','x-forwarded-for':'127.0.0.1'},body:{historyId:'historico_teste',history,updates}},res,{services:()=>({auth:{verifyIdToken:async()=>({uid:'admin'})},db}),requireAdminWriteAccess:async()=>{}});
  assert.equal(status,200);
  assert.equal(response.saved,true);
  assert.equal(data.products.produto_teste.prices.PF,123.45);
  assert.equal(data.importHistory.historico_teste.totalItems,1);
});
