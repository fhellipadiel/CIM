# Recuperação do autenticador do ADM

## Com a chave de configuração

Na ativação, guarde o arquivo de backup da chave em um local seguro, separado da senha.
Para trocar ou recuperar um celular, adicione uma conta manualmente no Google Authenticator ou Microsoft Authenticator usando essa chave. O novo aplicativo passará a gerar os mesmos códigos.
A chave permite gerar códigos: não envie por chat, e-mail ou GitHub. O site não guarda uma cópia recuperável dela.

## Sem o celular e sem a chave

A recuperação precisa ser feita pelo proprietário do projeto Firebase, após confirmar a identidade do administrador por um canal independente do site.
Não há uma API pública para desativar o segundo fator por e-mail e senha.

No computador seguro do responsável, com as credenciais privadas do servidor configuradas:

`node --env-file=.env.local scripts/recover-admin-mfa.cjs --confirm-reset`

Esse comando remove os segundos fatores do administrador autorizado nas regras privadas, ajusta as permissões de fotos, desativa a exigência de MFA para permitir novo cadastro e revoga sessões anteriores.
Depois disso, o titular deve entrar no ADM e configurar novamente o autenticador.
Se houver erro, revise o estado no Firebase antes de liberar o acesso; a operação falha de forma restritiva.

Nunca envie o arquivo firebase, arquivos .env, credenciais de serviço ou identificadores privados ao GitHub.

## Pré-requisito de ativação

O autenticador TOTP exige Firebase Authentication com Identity Platform e e-mail verificado.
A migração de produto e a habilitação de TOTP são alterações separadas da configuração do celular e precisam ser autorizadas pelo responsável do projeto.
As contas comuns não precisam cadastrar segundo fator.
