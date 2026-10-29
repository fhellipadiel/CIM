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

test('catálogo usa logos das marcas, remove textos antigos e ordena disponíveis primeiro',()=>{
  const available={name:'Disponível',brand:'CIM',prices:{PF:100},_publicPricing:{base:100,promotional:null,discount:0}};
  const unavailable={name:'Sem preço',brand:'CIM',soldOut:true,_publicPricing:null};
  const html=catalogHtml([['out',unavailable],['in',available]],{cim:{name:'CIM',image:'https://example.com/cim.webp'}});
  assert.doesNotMatch(html,/>Catálogo público</i);
  assert.doesNotMatch(html,/Promoções indicadas são válidas no Pix/i);
  assert.match(html,/https:\/\/example\.com\/cim\.webp/);
  assert.ok(html.indexOf('Disponível')<html.indexOf('Sem preço'));
  assert.ok(html.indexOf('Marcas')<html.indexOf('id="pesquisar"'));
  assert.ok(html.indexOf('id="pesquisar"')<html.indexOf('class="catalog-categories"'));
  assert.ok(html.indexOf('class="catalog-categories"')<html.indexOf('id="catalog-grid"'));
  assert.doesNotMatch(html,/<h2>Categorias<\/h2>/);
  assert.doesNotMatch(html,/<h2>Todos os produtos<\/h2>/);
  assert.match(html,/Pesquisar a peça, código ou montadora/);
  assert.match(html,/class="vehicle-filter-toggle"/);
  assert.match(html,/id="floating-search"/);
  assert.match(html,/class="accent-word">peça<\/span>/);
  assert.match(html,/background:radial-gradient/);
  assert.match(html,/header\{border-bottom:0\}/);
});

test('catálogo público permite carrinho, oculta menu privado e exige login para pagar',()=>{
  const product={name:'Coxim público',prices:{PF:100},_publicPricing:{base:100,promotional:null,discount:0}};
  const html=catalogHtml([['public-1',product]]);
  assert.match(html,/class="public-add-cart"/);
  assert.match(html,/cim_cart_guest/);
  assert.match(html,/Entrar para finalizar pagamento/);
  assert.match(html,/href="\/login\.html"/);
  assert.doesNotMatch(html,/menu-toggle|bottomMenu|onclick="finalizePurchase\(\)"/);
});
