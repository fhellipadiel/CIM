# Acesso ao ADM e recuperação do autenticador

As autorizações ficam no console Firebase → Realtime Database → Dados, em duas listas privadas. Não edite as regras para trocar pessoas.

## Administradores do painel

Caminho: accessControl/admins/UID_DA_CONTA

Campos:
- enabled: true para autorizar; false para revogar.
- canRead: true para permitir leitura administrativa.
- canWrite: true para permitir alterações; false para somente leitura.

Os três valores são booleanos, sem aspas. canWrite só funciona com enabled e canRead verdadeiros.
Copie o UID em Authentication → Usuários. Nome, e-mail e isAdmin no perfil não concedem acesso.
Para trocar administradores, adicione e teste o novo UID antes de desativar o anterior.
As regras do banco e as APIs conferem a lista atual. As imagens administrativas passam pelo servidor, pois as regras do Storage não consultam o Realtime Database.

## Responsáveis por recuperação

Caminho: accessControl/recoveryOperators/UID_DA_CONTA_GOOGLE

Campo: enabled: true. Para revogar, coloque false ou remova a entrada.
Essa autorização é separada da de administrador: uma não concede a outra.
Use uma conta Google com acesso independente do autenticador que pode ser perdido.
Nenhuma conta é autorizada automaticamente por e-mail, por ser administrador ou por descobrir o endereço.
A lista pode ficar sem responsáveis até o proprietário escolher uma conta. As entradas _instructions servem apenas para orientação e não concedem acesso.

## Recuperar pelo navegador

Acesse /recuperar-acesso.html, sem link público na tela de login.
Entre com a conta Google autorizada. Ela precisa ter e-mail verificado e login recente.
Escolha o administrador, confira o e-mail e digite esse e-mail para confirmar.
Somente os fatores daquela conta são removidos. Senha, UID, dados e demais contas são preservados.
As sessões anteriores são revogadas, o evento fica no registro privado securityAudit e o acesso aos dados do ADM fica bloqueado até concluir novo cadastro de autenticador.
O administrador entra no ADM, é encaminhado para a configuração do autenticador e cadastra seu novo celular.
Depois de confirmar o código, entra novamente com senha e autenticador.

Se a conta Google ainda não existe no projeto, faça login nessa página, copie seu UID no console Authentication e autorize-o na lista privada. O primeiro login sem permissão não dá acesso à recuperação.
Essa página não resolve perda de acesso à conta Google proprietária do Firebase; a recuperação dessa conta é feita pelo Google.

## Recuperar sem a página

O proprietário pode usar a ferramenta local em computador seguro com as credenciais privadas configuradas.
Agora é obrigatório informar explicitamente o UID que será recuperado:

node --env-file=.env.local scripts/recover-admin-mfa.cjs --uid UID_DA_CONTA --confirm-reset

Confira a conta antes de executar. A ferramenta afeta somente o UID indicado, incluindo todos os fatores dele, e mantém o acesso administrativo bloqueado até cadastrar novo autenticador.

Nunca publique o arquivo firebase, arquivos .env, chaves de serviço ou valores reais de UID na documentação pública.
