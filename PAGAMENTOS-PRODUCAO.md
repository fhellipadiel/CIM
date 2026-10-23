# Preparação para pagamentos reais

Estado: publicado em 15/10/2026 em https://cimautoparts.com.br. Produção ativa na Vercel; ambiente local permanece em teste. Credenciais reais e assinatura ficam nos segredos da hospedagem e no arquivo local privado.

## Configuração no servidor

Preserve as variáveis MP_ACCESS_TOKEN, MP_SELLER_ID e MP_ORDERS_WEBHOOK_SECRET para os testes. Produção usa variáveis independentes:

- MP_PRODUCTION_ACCESS_TOKEN: Access Token da aplicação da conta que receberá os pagamentos.
- MP_PRODUCTION_SELLER_ID: identificador da mesma conta recebedora (validado via /users/me).
- MP_PRODUCTION_WEBHOOK_SECRET: assinatura secreta do webhook da aplicação real.
- CHECKOUT_PRODUCTION_BASE_URL: https://cimautoparts.com.br
- FIREBASE_SERVICE_ACCOUNT_JSON: credencial Firebase Admin em JSON, somente no ambiente do servidor.
- FIREBASE_DATABASE_URL: URL do banco do projeto existente.
- MP_ENVIRONMENT: manter test até concluir a configuração; production ativa o fluxo real.

Não inserir Access Token, assinatura ou credencial Firebase no HTML, repositório ou conversa. Não usar a credencial da conta fictícia para receber pagamentos reais.

## Webhook e publicação

1. Ativar as credenciais de produção no painel do Mercado Pago, na conta recebedora.
2. Configurar a URL de produção https://cimautoparts.com.br/api/webhook?environment=production para eventos de Order (Mercado Pago).
3. Configurar a assinatura correspondente no ambiente do servidor.
4. Revisar e publicar as regras do arquivo firebase: pedidos do provedor orders só podem ser criados/confirmados pelo backend; cliente pode confirmar recebimento após envio; dados de pagamento e índices são protegidos.
5. Publicar a aplicação com os endpoints de api/ e módulos de server/. O caminho /admin foi corrigido para adm.html no vercel.json.
6. Conferir domínio HTTPS, credencial Admin e MP_ENVIRONMENT. O comando npm run check:payments verifica presença/configuração sem imprimir segredos ou criar cobranças.

## Validação antes de liberar clientes

Validar uma compra real de valor baixo autorizada, retorno ao site, confirmação no ADM/Pedidos e notificação por webhook sem depender do comprador voltar à loja. Conferir parcelamento contra a conta recebedora: a tabela exibida na loja permanece uma estimativa configurada, não garante as taxas reais dessa conta.

Validar pedido pendente, retomada por Pagar pedido e vencimento de uma hora. Expirados são ocultados para o cliente; histórico é preservado. Repetição de webhook não pode regredir Preparando/A caminho/Entregue para Pago.

Pedidos reais usam orders; testes usam paymentTests. Pedido de teste nunca entra no faturamento real. O ADM não marca pedido do Mercado Pago como pago manualmente. Cancelamento via site é permitido apenas antes da aprovação; pagamentos aprovados exigem estorno no Mercado Pago, cuja atualização é conciliada pelo webhook. Não há estorno automático implantado no ADM.

Os testes automatizados usam banco e respostas do provedor simulados, sem acessar dinheiro real. A aprovação por uma conta real e o webhook hospedado ainda exigem validação após configuração/publicação.

Fontes oficiais consultadas:
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/go-to-production?scope=prod
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications?scope=prod

## Validação de publicação em 15/10/2026
- Projeto Vercel: cimglobalparts.
- 29 testes automatizados passaram.
- Checkout real criou um pedido pendente; consulta autenticada, retomada e notificação verificadas.
- Pedido técnico cancelado sem pagamento; webhook real recebido com assinatura válida e cancelamento aplicado automaticamente. Cadastro técnico temporário removido; auditoria do pedido preservada.
- Regras Firebase publicadas com backup; criação de pedido pago pelo cliente bloqueada em verificação real.
- Arquivos de credenciais e módulos do servidor retornam 404 pela web.
- A confirmação de uma compra efetivamente paga ainda depende da primeira transação; nenhuma cobrança foi realizada durante a validação.
- Firebase Admin exige jwks-rsa 3.2.0 neste runtime CommonJS da Vercel; regressão coberta por teste. Referência: https://github.com/firebase/firebase-admin-node/issues/3181

## Limpeza de pedidos anteriores à integração
- ADM: lixeira disponível apenas para pedidos antigos sem identificadores ou vínculo com pagamentos. A ação remove da lista por arquivamento, preservando auditoria e cadastro do cliente. Exige confirmação e autorização de administrador.
- Pendentes: contagem regressiva de uma hora e remoção automática das listas do cliente e ADM após vencimento. Pagamentos aprovados permanecem.
- Faturamento: pendentes, cancelados e arquivados não entram na receita.
- 33 testes automatizados passaram após estes ajustes.
