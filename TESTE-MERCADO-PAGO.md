# Regra atual: simulação visual independente

A loja mostra parcelas e total estimado usando a tabela enviada e as marcações do ADM. Essa tabela pode ser substituída para outra conta e não garante o total do provedor. No cartão, o servidor e o payload continuam usando somente o preço original dos produtos. O desconto Pix permanece. O financiamento final é escolhido e aplicado no Mercado Pago. Esta regra substitui as descrições históricas abaixo.

# Regra atual do checkout

O cartão envia somente o preço original dos produtos. A seleção local de parcelas é apenas uma preferência visual, sem simular valores nem prometer ausência de juros. O comprador escolhe de 1x a 12x e aceita as condições finais no Mercado Pago. As taxas históricas do ADM não são aplicadas. O desconto do Pix continua funcionando. Os pedidos guardam separadamente o valor dos produtos e o total com financiamento.

As seções anteriores abaixo descrevem etapas de teste e decisões substituídas por esta regra. A integração permanece local, sem publicação. O webhook Orders ainda requer a assinatura da nova aplicação em MP_ORDERS_WEBHOOK_SECRET.
# Teste local do Checkout Pro
Nada é publicado por estes comandos. Os pedidos ficam em paymentTests, separados de orders e dos indicadores de faturamento.

1. No Firebase, abra Configurações do projeto > Contas de serviço > Firebase Admin SDK > Gerar nova chave privada. Guarde o JSON fora da pasta do site.
2. Em .env.local, configure GOOGLE_APPLICATION_CREDENTIALS com o caminho desse arquivo (use barras /). Nunca envie o JSON ou .env.local ao GitHub.
3. Execute npm install e npm run dev. Abra http://localhost:3000/cim.html, entre com sua conta Firebase e monte um carrinho.
4. Conclua no Mercado Pago usando a conta Comprador de teste em janela anônima. O servidor verifica se o vendedor é test_user e bloqueia contas reais.
5. Ao retornar, a página consulta o Mercado Pago; os parâmetros de retorno nunca autorizam pagamento. No ADM local, use Ver pedidos de teste para consultar a coleção separada.
6. Para testar confirmação automática com navegador fechado, configure um endereço HTTPS de teste com acesso ao servidor local. Preencha CHECKOUT_BASE_URL, MP_NOTIFICATION_URL (terminando em /api/webhook) e MP_WEBHOOK_SECRET. Configure Webhooks no ambiente de teste do Mercado Pago. Esta parte ainda precisa ser configurada e validada.

Os preços, promoções e cupons vêm do Firebase. O servidor recusa total divergente. O parcelamento mantém as taxas atuais do site; diferença entre elas e as condições do Mercado Pago deve ser revisada antes de produção. Os testes automatizados não substituem uma compra de teste nem validam as credenciais externas.

A implementação está limitada a testes. Antes de produção: ajustar coleção definitiva, regras para criação/status de pagamento, condições de parcelas e frete, controle de estoque, reembolsos e monitoramento. Não publique o arquivo .env.local nem credenciais.
## Webhook HTTPS temporário

Execute o servidor local na porta 3000, o proxy com `node scripts/webhook-proxy.cjs` e o túnel com `.tools/cloudflared.exe tunnel --url http://127.0.0.1:3001 --no-autoupdate`.
O endereço trycloudflare.com termina ao encerrar o túnel. Somente /api/webhook fica acessível; loja, ADM e arquivos privados não são servidos pelo proxy.

No painel do Mercado Pago, configure a URL HTTPS retornada pelo túnel acrescida de /api/webhook e selecione Pagamentos. Salve. Configure o segredo gerado em MP_WEBHOOK_SECRET no arquivo .env.local e reinicie o servidor. Configure também MP_NOTIFICATION_URL com a mesma URL completa. CHECKOUT_BASE_URL permanece http://localhost:3000 para o retorno local.

Simule uma notificação com um ID de pagamento existente desta conta de vendedor de teste. Verifique HTTP 200 no painel e webhookReceivedAt no pedido em paymentTests. Envio assinado localmente verifica o código, mas somente uma notificação enviada pelo Mercado Pago valida a integração externa.

Na produção o webhook precisa de URL permanente. Este túnel e as contas configuradas são apenas para testes.
## Parcelas controladas pelo ADM

O ADM, a loja e o servidor usam assets/payment-policy.js. A fonte é settings/cardInterestFreeInstallments: true remove o acréscimo da CIM; false restaura a taxa original. Sem configuração explícita, 1x a 5x ficam sem acréscimo; 6x a 12x usam as taxas originais. O servidor lê a configuração novamente antes de cobrar e recusa total antigo.

As condições de financiamento do Checkout Pro dependem da conta Mercado Pago. Para usar apenas o acréscimo definido pela CIM, configure no painel da conta vendedora Taxas e parcelas > Checkout as parcelas sem acréscimos ao comprador que serão oferecidas (até 12x se todas forem usadas no site). Essa escolha transfere custos de financiamento para o vendedor; confira as tarifas da conta. O código não altera essas condições da conta. Não assuma que installments/default_installments zeram juros: esses campos não são a configuração de financiamento.

Os pedidos novos guardam interestRate e interestFree. Após confirmar pagamento, o servidor registra paidTotal, financingCost e actualInstallments; a área de testes do ADM exibe o valor pago e eventual custo adicional. Pedidos antigos não são recalculados retroativamente. Um teste com cartão é necessário após ajustar as condições da conta, verificando o total final antes de aprovar.
## Migração local para Checkout Pro via Orders

Novas compras agora usam POST /v1/orders. O valor inclui somente o acréscimo calculado pela configuração do ADM. Para cartão parcelado, o payload define config.payment_method.installments.interest_free entre 2 e o número de parcelas escolhido. A resposta HTTP 201 confirmou essa configuração no vendedor de teste. Isso ainda precisa ser conferido na tela antes de concluir pagamento.

Pedidos novos têm provider=orders, reference curta, mercadoOrderId e índice privado paymentOrderIndex. Pedidos antigos continuam no histórico, sem migração nem recálculo. A consulta automática do ADM atualiza apenas as Orders novas. O webhook de Orders consulta GET /v1/orders/{id} e só marca pago quando vendedor, referência, total e transação aprovada correspondem. Valor efetivamente pago divergente bloqueia confirmação automática.

Configure na aplicação do vendedor fictício correspondente ao novo token (4427717098719340) o evento Order (Mercado Pago), URL terminando em /api/webhook. Essa assinatura vai em MP_ORDERS_WEBHOOK_SECRET no .env.local. MP_WEBHOOK_SECRET é mantido para o histórico da API anterior; não reutilize sem confirmar a assinatura da aplicação nova. A URL não é enviada como notification_url na criação de Orders: a configuração ocorre no painel.

Campos installments_cost, default_type e installments.available foram rejeitados na criação por esta API e não são enviados. max_installments limita o máximo; a pessoa compradora ainda escolhe a quantidade no Mercado Pago. Essa migração não inclui produção nem validação de pagamento real.

## Fluxo de carrinho e pagamento pendente (15/10/2026)
- Carrinho salvo por conta no servidor e em cache local separado por usuário. Sair salva antes de encerrar a sessão.
- Criar checkout com sucesso esvazia o carrinho e registra pedido pendente. Falha ao criar preserva o carrinho.
- Pedidos novos: validade PT1H no Mercado Pago; retomar pagamento exige autenticação, propriedade e prazo válido.
- Expirados somem da lista do cliente. Histórico interno preservado; pagamentos confirmados não são apagados.
- Notificações persistentes por pedido/status, sem reiniciar leitura. A consulta e webhook conciliam aprovações; com site aberto há atualização a cada minuto.
- Teste manual: adicionar peça, sair e entrar; finalizar sem pagar, voltar e usar Pagar pedido; aprovar e conferir notificação/Pago. Nada publicado.
