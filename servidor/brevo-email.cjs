const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function sendNotificationEmail({campaignId,subject,title,message,recipients,design={},request=fetch}){
 const apiKey=process.env.BREVO_API_KEY;
 const senderEmail=process.env.BREVO_SENDER_EMAIL||'marketing@cimautoparts.com.br';
 const senderName=process.env.BREVO_SENDER_NAME||'CIM Global Parts';
 let logoUrl=process.env.BREVO_LOGO_URL||'https://www.cimautoparts.com.br/assets/logo.png';
 try{const parsed=new URL(logoUrl);if(parsed.protocol!=='https:')logoUrl='';}catch{logoUrl='';}
 const valid=recipients.filter(recipient=>EMAIL.test(String(recipient.email||'').trim())).slice(0,2000);
 if(!valid.length)return {status:'skipped',sent:0,skipped:recipients.length,reason:'Nenhum destinatário possui e-mail válido.'};
 if(!apiKey)return {status:'not_configured',sent:0,skipped:recipients.length,reason:'Envio por e-mail ainda não configurado.'};
 const nameVariable=/\[nome\]/gi;
 const personalizedTitle=String(title).replace(nameVariable,'{{ params.nome }}'),personalizedMessage=String(message).replace(nameVariable,'{{ params.nome }}');
 const safeTitle=escapeHtml(personalizedTitle),safeMessage=escapeHtml(personalizedMessage).replace(/\r?\n/g,'<br>');
 const layout='brand';
 const selectedContentColor=/^#[0-9a-fA-F]{6}$/.test(design.contentColor||'')?design.contentColor:'#080808';
 const color=(value,fallback)=>/^#[0-9a-fA-F]{6}$/.test(value||'')?value:fallback;
 const contentColor=layout==='brand'?'#080808':selectedContentColor;
 const titleColor=layout==='brand'?'#ffffff':color(design.titleColor,'#ffffff'),textColor=layout==='brand'?'#ffffff':color(design.textColor,'#ffffff'),footerColor=layout==='brand'?'#b8b8b8':color(design.footerColor,'#b8b8b8');
 const productCardColor=layout==='brand'?'#080808':color(design.productCardColor,'#0b0b0b'),cardRgb=productCardColor.slice(1).match(/../g).map(value=>parseInt(value,16)),productTextColor=layout==='brand'?'#ffffff':((cardRgb[0]*299+cardRgb[1]*587+cardRgb[2]*114)/1000>145?'#222222':'#ffffff');
 const accent=/^#[0-9a-fA-F]{6}$/.test(design.accent||'')?design.accent:'#ff3601';
 const safeHttps=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch{return''}};
 const bannerUrl=safeHttps(design.bannerUrl),buttonUrl=safeHttps(design.buttonUrl)||'https://www.cimautoparts.com.br/',buttonText=String(design.buttonText??'Acessar CIM Global Parts').trim().slice(0,60);
 const logo=logoUrl?`<img src="${escapeHtml(logoUrl)}" width="105" alt="CIM Global Parts" style="display:block;width:105px;max-width:100%;height:auto;border:0">`:'<strong style="font-size:20px">CIM Global Parts</strong>';
 const banner=layout!=='text'&&design.useBanner!==false&&bannerUrl?`<tr><td><img src="${escapeHtml(bannerUrl)}" alt="" width="620" style="display:block;width:100%;max-height:320px;object-fit:cover;border:0"></td></tr>`:'';
 const button=layout!=='text'&&buttonText?`<p style="margin:28px 0 0"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${escapeHtml(buttonText)}</a></p>`:'';
 const header=layout==='text'||design.showHeader===false?'':`<tr><td style="background:${layout==='white'?'#ffffff':'#080808'};color:${layout==='white'?'#181818':'#ffffff'};padding:18px 30px">${logo}</td></tr>`;
 const footer=layout==='text'?'':`<tr><td bgcolor="${contentColor}" style="border-top:1px solid #333;padding:18px 30px;color:${footerColor}!important;background-color:${contentColor}!important;font-size:12px;line-height:1.5">Mensagem enviada pela CIM Global Parts para clientes cadastrados. Para falar conosco, responda este e-mail.</td></tr>`;
 const money=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),products=layout==='text'?'':(Array.isArray(design.products)?design.products:[]).reduce((rows,product,index)=>{if(index%2===0)rows.push([]);rows.at(-1).push(product);return rows},[]).map(row=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${productCardColor}" style="margin-top:20px;background-color:${productCardColor}!important;border:0"><tr>${row.map(product=>`<td width="50%" valign="top" bgcolor="${productCardColor}" style="padding:0;border:0;background-color:${productCardColor}!important"><a href="${escapeHtml(product.url)}" style="display:block;color:${productTextColor}!important;text-decoration:none;border:0!important;border-radius:0;overflow:hidden;background-color:${productCardColor}!important"><img src="${escapeHtml(product.image)}" alt="" width="280" style="display:block;width:100%;height:180px;object-fit:contain;border:0;background-color:${productCardColor}!important"><span style="display:block;padding:14px;background-color:${productCardColor}!important"><strong style="display:block;font-size:14px;line-height:1.35;color:${productTextColor}!important">${escapeHtml(product.name)}</strong>${product.promotional?`<span style="display:block;color:${productTextColor}!important;opacity:.65;text-decoration:line-through;font-size:12px;margin-top:8px">${money(product.base)}</span><b style="display:block;color:${accent};font-size:18px">${money(product.promotional)}</b><small style="color:${accent}">-${product.discount}% no Pix</small>`:`<b style="display:block;color:${accent};font-size:18px;margin-top:8px">${product.base?money(product.base):'Consulte'}</b>`}</span></a></td>`).join('')}${row.length===1?`<td width="50%" bgcolor="${productCardColor}" style="border:0;background-color:${productCardColor}!important"></td>`:''}</tr></table>`).join('');
 const emailBackground=layout==='text'?'#ffffff':contentColor;
 const htmlContent=`<!doctype html><html lang="pt-BR"><head><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><style>:root{color-scheme:light only}body,.cim-email-bg{background-color:${emailBackground}!important;color:${textColor}!important}</style></head><body class="cim-email-bg" bgcolor="${emailBackground}" style="margin:0;background-color:${emailBackground}!important;font-family:Arial,sans-serif;color:${textColor}!important"><table class="cim-email-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${emailBackground}" style="background-color:${emailBackground}!important"><tr><td class="cim-email-bg" align="center" bgcolor="${emailBackground}" style="padding:${layout==='text'?'18px':'28px 12px'};background-color:${emailBackground}!important"><table class="cim-email-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${emailBackground}" style="max-width:620px;background-color:${emailBackground}!important;${layout==='text'?'':'border-radius:14px;overflow:hidden'}">${header}${banner}<tr><td class="cim-email-bg" bgcolor="${emailBackground}" style="padding:${layout==='text'?'12px':'32px 30px'};background-color:${emailBackground}!important"><h1 style="font-size:${layout==='text'?'20px':'24px'};margin:0 0 18px;color:${titleColor}!important">${safeTitle}</h1><div style="font-size:16px;line-height:1.65;color:${textColor}!important">${safeMessage}</div>${products}${button}</td></tr>${footer}</table></td></tr></table></body></html>`;
 const safeSubject=String(subject||title||'Mensagem da CIM Global Parts').trim().slice(0,150).replace(nameVariable,'{{ params.nome }}');
 const link=design.showLink===false?'':safeHttps(design.buttonUrl);
 const textContent=[personalizedTitle,personalizedMessage,link].filter(Boolean).join('\n\n');
 const payload={sender:{email:senderEmail,name:senderName},replyTo:{email:senderEmail,name:senderName},subject:safeSubject,textContent,headers:{IdempotencyKey:String(campaignId)},tags:['notificacao-painel'],messageVersions:valid.map(recipient=>({to:[{email:String(recipient.email).trim(),name:String(recipient.name||'Cliente').slice(0,200)}],params:{nome:String(recipient.name||'Cliente').trim()||'Cliente'}}))};
 let response;
 try{response=await request('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{accept:'application/json','content-type':'application/json','api-key':apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});}
 catch{return {status:'failed',sent:0,skipped:recipients.length,reason:'Não foi possível conectar ao serviço de e-mail.'};}
 const result=await response.json().catch(()=>({}));
 if(!response.ok)return {status:'failed',sent:0,skipped:recipients.length,reason:String(result.message||'O serviço de e-mail recusou o envio.').slice(0,300)};
 return {status:'sent',sent:Array.isArray(result.messageIds)?result.messageIds.length:valid.length,skipped:recipients.length-valid.length};
}

module.exports={sendNotificationEmail};
