const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {distributeLeads}=require('../server/employees.cjs');

const employeeHtml=fs.readFileSync('funcionario.html','utf8');
const landingHtml=fs.readFileSync('index.html','utf8');
const employeeServer=fs.readFileSync('server/employees.cjs','utf8');
const adminHtml=fs.readFileSync('adm.html','utf8');

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

test('clientes atendidos ficam separados dos leads e visiveis ao funcionario e ADM',()=>{
  assert.match(employeeHtml,/id="clientModal"/);
  assert.match(employeeHtml,/api\('add-client'/);
  assert.match(employeeHtml,/id="clients"/);
  assert.match(employeeServer,/employeeClients\/'\+caller\.uid/);
  assert.match(employeeServer,/action==='add-client'/);
  assert.match(adminHtml,/employeeClientsAdmList/);
  assert.match(adminHtml,/Todos os funcionários/);
});

test('administrador escolhe entre dividir ou liberar todos os leads',()=>{
  assert.match(adminHtml,/id="employeeLeadAccessMode"/);
  assert.match(adminHtml,/value="assigned">Dividir leads/);
  assert.match(adminHtml,/value="all">Receber todos os leads/);
  assert.match(employeeServer,/employee\.leadAccessMode==='all'/);
  assert.match(employeeServer,/action==='admin-lead-mode'/);
});

test('administrador pode ocultar contatos de leads no acesso do funcionario',()=>{
  assert.match(adminHtml,/id="employeeHideLeadContacts"/);
  assert.match(adminHtml,/Ocultar aba de Leads/);
  assert.match(adminHtml,/hideLeadContacts:employeeHideLeadContacts\.value==='true'/);
  assert.match(adminHtml,/servidor não confirmou a visibilidade da aba Leads/);
  assert.match(employeeServer,/leadAccessMode:body\.leadAccessMode==='all'\?'all':'assigned',hideLeadContacts:body\.hideLeadContacts===true/);
  assert.match(employeeServer,/next\.leadAccessMode=body\.leadAccessMode==='all'\?'all':'assigned';next\.hideLeadContacts=body\.hideLeadContacts===true/);
  assert.match(employeeServer,/hideLeadContacts===true/);
  assert.match(employeeServer,/Os contatos de leads estão ocultos/);
  assert.match(employeeHtml,/button\[data-view="allClients"\]/);
  assert.match(employeeHtml,/hideLeadContacts===true/);
});

test('ADM mostra foto do responsavel e atualiza situacao da mensagem confirmada',()=>{
  assert.match(adminHtml,/class="lead-assignee"/);
  assert.match(adminHtml,/item\.employee\?\.photoURL/);
  assert.match(adminHtml,/item\.contacted\?'Mensagem enviada'/);
  assert.match(adminHtml,/contactedBy:record\.contactedBy/);
  assert.match(employeeServer,/contactedBy:contacted\?caller\.uid:null/);
  assert.match(adminHtml,/ref\.on\('value',callback/);
});

test('rodizio usa apenas funcionarios divididos e esconde quem nao pode ver leads',()=>{
  assert.match(employeeServer,/e\.leadAccessMode!==\'all\'&&e\.hideLeadContacts!==true/);
  assert.match(employeeServer,/employee\.leadAccessMode!==\'all\'&&employee\.hideLeadContacts!==true/);
  assert.match(adminHtml,/accessAll\?'Acesso a todos':'Divisão de leads'/);
  assert.match(adminHtml,/employee\.hideLeadContacts!==true/);
});

test('rodizio preserva enviados, divide pendentes e compartilha somente o impar',async()=>{
  const leads=Object.fromEntries(Array.from({length:11},(_,index)=>['lead'+index,{contacted:index<6,captures:{one:{capturedAt:index+1}}}]));
  leads.lead0.assignedEmployeeId='one';
  const writes={};
  const db={ref:path=>({update:async updates=>{for(const [key,value]of Object.entries(updates))writes[path+'/'+key]=value}})};
  await distributeLeads(db,leads,{one:{enabled:true,leadAccessMode:'assigned'},two:{enabled:true,leadAccessMode:'assigned'},all:{enabled:true,leadAccessMode:'all'},hidden:{enabled:true,hideLeadContacts:true}});
  assert.equal(leads.lead0.assignedEmployeeId,'one');
  const pending=Object.values(leads).slice(6),shared=pending.filter(lead=>lead.assignedEmployeeIds?.length===2);
  assert.equal(shared.length,1);
  assert.deepEqual(shared[0].assignedEmployeeIds,['one','two']);
  assert.equal(pending.filter(lead=>lead.assignedEmployeeIds?.length===1&&lead.assignedEmployeeId==='one').length,2);
  assert.equal(pending.filter(lead=>lead.assignedEmployeeIds?.length===1&&lead.assignedEmployeeId==='two').length,2);
  assert.ok(!JSON.stringify(pending).includes('hidden'));
  assert.ok(!JSON.stringify(pending).includes('all'));
});

test('lead sem atribuicao mostra foto de quem possui acesso a todos',()=>{
  assert.match(adminHtml,/allAccessEmployee=Object\.values\(leadEmployees\)\.find/);
  assert.match(adminHtml,/leadAccessMode==='all'&&employee\.hideLeadContacts!==true/);
  assert.match(adminHtml,/Acesso a todos/);
  assert.match(adminHtml,/item\.employee\?\.photoURL/);
});
