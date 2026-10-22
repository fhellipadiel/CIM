const test=require('node:test');
const assert=require('node:assert/strict');
const {publicPricing,catalogHtml}=require('../server/public-products.cjs');

test('calcula o maior desconto público válido para PF',()=>{
  const product={id:'p1',category:'Suspensão',sessionId:'s1',prices:{PF:200}};
  const promos={
    produto:{ativa:true,tipo:'produto',alvoId:'p1',tipoCliente:'PF',descontoPercentual:10},
    categoria:{ativa:true,tipo:'categoria',alvoId:'Suspensão',tipoCliente:'ambos',descontoPercentual:20},
    pj:{ativa:true,tipo:'produto',alvoId:'p1',tipoCliente:'PJ',descontoPercentual:50},
    expirada:{ativa:true,tipo:'produto',alvoId:'p1',tipoCliente:'ambos',descontoPercentual:80,dataExpiracao:1}
  };
  assert.deepEqual(publicPricing('p1',product,promos,1000),{base:200,promotional:160,discount:20});
});

test('catálogo público renderiza preços, promoção, carrosséis e sugestões',()=>{
  const product={id:'p1',name:'Coxim Honda Civic',codigo:'ABC-123',brand:'CIM',category:'Coxim',image:'https://example.com/coxim.webp',prices:{PF:200}};
  product._publicPricing={base:200,promotional:160,discount:20};
  const html=catalogHtml([['p1',product]]);
  assert.match(html,/R\$\s200,00/);
  assert.match(html,/R\$\s160,00/);
  assert.match(html,/-20% no Pix/);
  assert.match(html,/class="carousel-track"/);
  assert.match(html,/id="search-suggestions"/);
  assert.match(html,/Coxim Honda Civic/);
  assert.doesNotMatch(html,/pessoa física/i);
});

test('dados das sugestões não permitem encerrar a tag script',()=>{
  const product={name:'Peça </script><script>alert(1)</script>',prices:{PF:10},_publicPricing:{base:10,promotional:null,discount:0}};
  const html=catalogHtml([['safe-id',product]]);
  assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
});
