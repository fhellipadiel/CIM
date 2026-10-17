const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../adm.html'),'utf8');
test('historico apresenta dispositivo e navegador sem inventar modelo',()=>{
 const ctx=vm.createContext({});vm.runInContext(html.match(/function adminDeviceLabel\(userAgent\)\{[\s\S]*?\n\}/)[0],ctx);
 assert.equal(ctx.adminDeviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36'),'Windows · Chrome');
 assert.equal(ctx.adminDeviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'),'iPhone · Safari');
 assert.equal(ctx.adminDeviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/155 Safari/537 Edg/155.0'),'Windows · Edge');
 assert.equal(ctx.adminDeviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome/155 Safari/537'),'Android · Chrome');
 assert.equal(ctx.adminDeviceLabel(''),'Dispositivo não identificado');
});
test('produtos entram em lotes sem duplicar e a busca reinicia a lista inteira',()=>{
 let content='';const filters={prodFilterText:{value:''},prodFilterCategory:{value:''},prodFilterStatus:{value:''}};
 const body={get innerHTML(){return content;},set innerHTML(value){content=value;},insertAdjacentHTML:(_position,value)=>{content+=value;}};
 let observer;
 const context=vm.createContext({products:Array.from({length:95},(_,n)=>({id:'id'+n,name:'Product '+String(n).padStart(3,'0'),prices:{PF:1,PJ:1}})),document:{getElementById:id=>id==='productsTableBody'?body:id==='adminProductsMoreRow'?(content.includes('id="adminProductsMoreRow"')?{remove:()=>{content=content.replace(/<tr id="adminProductsMoreRow">[\s\S]*?<\/tr>/,'');}}:null):filters[id]},safeAdminImage:require('../assets/admin-security.js').image,escJs:require('../assets/admin-security.js').escapeJs,esc:value=>String(value||''),matchTokens:(value,query)=>value.toLowerCase().includes(query),isProductNoCategory:()=>false,PLACEHOLDER_IMG:'placeholder.png',IntersectionObserver:class{constructor(callback){this.callback=callback;observer=this;}observe(){}disconnect(){}}});
 const start=html.indexOf('const ADMIN_PRODUCTS_BATCH=40;'),end=html.indexOf('\nfunction openProductModal()',start);vm.runInContext(html.slice(start,end),context);
 const count=()=> (content.match(/class="td-name"/g)||[]).length;
 context.renderProducts();assert.equal(count(),40);observer.callback([{isIntersecting:true}]);assert.equal(count(),80);context.appendAdminProductsBatch();assert.equal(count(),95);assert.equal(content.includes('adminProductsMoreRow'),false);
 filters.prodFilterText.value='Product 094';context.renderProducts();assert.equal(count(),1);assert.match(content,/Product 094/);
 filters.prodFilterText.value='missing';context.renderProducts();assert.equal(count(),0);assert.match(content,/empty-state/);
 filters.prodFilterText.value='';context.renderProducts();assert.equal(count(),40);
});
