const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'public');
fs.mkdirSync(output,{recursive:true});
const files=['index.html','cim.html','adm.html','login.html','leads.html','recuperar-acesso.html','robots.txt','sitemap.xml'];
for(const file of files)fs.copyFileSync(path.join(root,file),path.join(output,file));
fs.cpSync(path.join(root,'assets'),path.join(output,'assets'),{recursive:true,filter:source=>!fs.lstatSync(source).isSymbolicLink()});
console.log('Arquivos públicos preparados. Configurações e código do servidor ficam fora da pasta pública.');
