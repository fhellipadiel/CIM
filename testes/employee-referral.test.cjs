const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {distributeLeads,handleEmployees}=require('../servidor/employees.cjs');

const employeeHtml=fs.readFileSync('funcionario.html','utf8');
const landingHtml=fs.readFileSync('index.html','utf8');
const employeeServer=fs.readFileSync('servidor/employees.cjs','utf8');
const adminHtml=fs.readFileSync('adm.html','utf8');

test('link atribuido pelo ADM vira a URL curta mostrada ao funcionario',()=>{
  assert.match(employeeHtml,/employeeReferralUrl=slug=>location\.origin\+'\/'\+encodeURIComponent\(slug\)/);
  assert.match(employeeHtml,/primaryLink=\(data\.links\|\|\[\]\)\[0\]/);
  assert.match(employeeHtml,/employeeReferralUrl\(primaryLink\.slug\)/);
  assert.match(adminHtml,/employeeUrl=primaryLink\?location\.origin\+'\/'\+encodeURIComponent\(primaryLink\.slug\)/);
  assert.doesNotMatch(adminHtml,/location\.origin}\/\?funcionario=/);
});

test('falha ao carregar painel nao encerra a sessao automaticamente',()=>{
  const authHandler=employeeHtml.match(/auth\.onAuthStateChanged\(async user=>\{if\(!user\)[\s\S]*?\}\);/g)?.at(-1)||'';
  assert.ok(authHandler);
  assert.doesNotMatch(authHandler,/auth\.signOut\(/);
});

test('rota de login local descarta somente a sessao administrativa anterior',()=>{
  assert.match(adminHtml,/const adminLoginReset = new URLSearchParams\(location\.search\)\.has\('login'\)/);
  assert.match(adminHtml,/if\(adminLoginReset\)await auth\.signOut\(\)/);
});

test('entrada pelo Link curto guarda a campanha e remove atribuicao antiga',()=>{
  assert.match(landingHtml,/sessionStorage\.setItem\('campaignRef', ref\)/);
  assert.match(landingHtml,/sessionStorage\.setItem\('campaignReferralPending', ref\)/);
  assert.match(landingHtml,/function claimPendingCampaignReferral\(\)/);
  assert.match(landingHtml,/fetch\('\/api\/claim-referral'/);
  assert.match(landingHtml,/sessionStorage\.removeItem\('employeeRef'\)/);
  assert.doesNotMatch(landingHtml,/employees\.json/);
});

test('clientes atendidos ficam separados dos leads e visiveis ao funcionario e ADM',()=>{
  assert.match(employeeHtml,/id="clientModal"/);
  assert.match(employeeHtml,/id="clientName"/);
  assert.match(employeeHtml,/id="clientStatus"/);
  assert.match(employeeHtml,/value="negotiating">Em negociação/);
  assert.match(employeeHtml,/clientName:clientNameValue/);
  assert.match(employeeHtml,/id\?'update-client':'add-client'/);
  assert.match(employeeHtml,/id="clientDocument"/);
  assert.match(employeeHtml,/id="clientSearch"/);
  assert.match(employeeHtml,/id="clientListStatus"/);
  assert.match(employeeHtml,/id="clientListPersonType"/);
  assert.match(employeeHtml,/id="clientToday"/);
  assert.match(employeeHtml,/todayOnly=clientToday\?\.getAttribute\('aria-pressed'\)==='true'/);
  assert.match(employeeHtml,/clientToday\.addEventListener\('click'/);
  assert.match(employeeHtml,/id="clients"/);
  assert.match(employeeServer,/employeeClients\/'\+caller\.uid/);
  assert.match(employeeServer,/action==='add-client'/);
  assert.match(employeeServer,/action==='update-client'/);
  assert.match(employeeServer,/clientName=clean\(body\.clientName,120\)/);
  assert.match(employeeServer,/clientName:clean\(value\.clientName,120\)/);
  assert.match(employeeServer,/clientStatus\(value\.status,statuses,caller\.uid\)/);
  assert.match(employeeServer,/admin-save-client-status/);
  assert.match(employeeServer,/admin-update-client/);
  assert.match(employeeServer,/admin-delete-client/);
  assert.match(adminHtml,/employeeClientsAdmList/);
  assert.match(adminHtml,/employee-client-status/);
  assert.match(adminHtml,/employee-client-status-count/);
  assert.match(adminHtml,/const countByStatus=employeeClientsAdm\.reduce/);
  assert.match(adminHtml,/employee-client-status-dot" style="background:'\+esc\(color\)\+'!important/);
  assert.match(adminHtml,/Todos os funcionários/);
});

test('editor de promoção permite buscar categoria e sessão antes de selecionar o alvo',()=>{
  assert.match(adminHtml,/id="promoTargetSearchAdm"/);
  assert.match(adminHtml,/placeholder="Pesquisar categoria ou sessão"/);
  assert.match(adminHtml,/function renderPromoTargetSearchAdm\(\)/);
  assert.match(adminHtml,/targetSearchMode=tipo==='sessao'\|\|tipo==='categoria'/);
});

test('ponto do status personalizado recebe a cor salva ao renderizar e re-renderizar',()=>{
  const source=adminHtml.match(/function renderEmployeeClientStatusesAdm\(\)\{[\s\S]*?\nfunction createEmployeeClientStatusAdm/);
  assert.ok(source);
  const box={innerHTML:''},context={document:{getElementById:()=>box},employeeClientsAdm:[],employeeClientStatusesAdm:[{id:'portfolio',name:'Portfólio enviado',color:'#0000f0',builtIn:false}],employeeClientStatusColor:()=> '#8e8e93',esc:value=>String(value||'').replace(/[&<>"']/g,''),console};
  vm.runInNewContext(source[0].replace(/\nfunction createEmployeeClientStatusAdm[\s\S]*/,''),context);
  context.renderEmployeeClientStatusesAdm();
  assert.match(box.innerHTML,/class="employee-client-status-dot" style="background:#0000f0!important/);
  context.renderEmployeeClientStatusesAdm();
  assert.match(box.innerHTML,/background:#0000f0!important/);
});

test('editar status preserva a cor escolhida ao salvar e carregar novamente',async()=>{
  const data={employeeClientStatuses:{portfolio:{name:'Portfólio enviado',color:'#8e8e93'}},employees:{},trackingLinks:{},orders:{},paymentTests:{},leads:{},employeeClients:{}};
  const read=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data)??null;
  const write=(path,value)=>{const keys=path.split('/').filter(Boolean),last=keys.pop();let node=data;for(const key of keys)node=node[key]??={};node[last]=structuredClone(value)};
  const db={ref:path=>({get:async()=>({val:()=>structuredClone(read(path))}),set:async value=>write(path,value),update:async values=>{for(const [key,value]of Object.entries(values))write(path+'/'+key,value)},push:()=>({key:'portfolio'})})};
  const call=body=>handleEmployees({auth:{},db,caller:{uid:'admin'},body,requireAdmin:async()=>{}});
  const saved=await call({action:'admin-save-client-status',id:'portfolio',name:'Portfólio enviado',color:'#0000f0'});
  assert.equal(saved.status.color,'#0000f0');
  const listed=await call({action:'admin-list'});
  assert.equal(listed.clientStatuses.find(status=>status.id==='portfolio').color,'#0000f0');
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
  assert.match(adminHtml,/employeeHideLeadContacts\.value==='true'/);
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
