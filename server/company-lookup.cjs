const {fail}=require('./core.cjs');const {validDocument,digits}=require('../assets/signup-policy.js');
const cache=new Map(),pending=new Map();const FIELDS=['razao_social','nome_fantasia','descricao_situacao_cadastral','logradouro','numero','bairro','municipio','uf','email','cep'];
async function lookupCompany(value,request=fetch,now=Date.now()){
 const cnpj=digits(value);if(!validDocument('PJ',cnpj))fail('Confira o CNPJ informado.',400);
 const saved=cache.get(cnpj);if(saved&&saved.until>now)return saved.data;
 if(pending.has(cnpj))return pending.get(cnpj);
 const promise=(async()=>{
  let notFound=false;
  for(const provider of ['brasilapi','receitaws']){
   try{
    const url=provider==='brasilapi'?'https://brasilapi.com.br/api/cnpj/v1/'+cnpj:'https://receitaws.com.br/v1/cnpj/'+cnpj;
    const response=await request(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
    if(response.status===404){notFound=true;continue;}if(!response.ok)continue;
    const raw=await response.json();if(raw.status==='ERROR'){notFound=true;continue;}
    if(raw.cnpj&&digits(raw.cnpj)!==cnpj)continue;
    const mapped=provider==='brasilapi'?raw:{razao_social:raw.nome,nome_fantasia:raw.fantasia,descricao_situacao_cadastral:raw.situacao,logradouro:raw.logradouro,numero:raw.numero,bairro:raw.bairro,municipio:raw.municipio,uf:raw.uf,email:raw.email,cep:raw.cep};
    if(typeof mapped.razao_social!=='string'||!mapped.razao_social.trim())continue;
    const data=Object.fromEntries(FIELDS.map(field=>[field,String(mapped[field]||'').slice(0,200)]));
    if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(cnpj,{data,until:now+15*60*1000});return data;
   }catch{}
  }
  if(notFound)fail('Nao foi possivel localizar os dados deste CNPJ.',404);
  fail('A consulta de CNPJ esta indisponivel no momento. Tente novamente em instantes.',503);
 })();
 pending.set(cnpj,promise);try{return await promise;}finally{pending.delete(cnpj);}
}
module.exports={lookupCompany};
