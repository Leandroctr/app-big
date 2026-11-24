# Paridade do OneSignal e do fallback offline na BigPix

Base BigPix `c3fd98fa60666ec842c638b0b058d3c37804fd47`. Referência homologada MegaBingo7 `652f72a4d886c6e87eafd3812df710c235d6b969`. [Piloto OneSignal e Service Worker](https://github.com/Leandroctr/app-megabingo7/pull/4) · [Splash nativo](https://github.com/Leandroctr/app-megabingo7/pull/5)

## M-2

O Web SDK v16 carrega um script JSONP em `https://api.onesignal.com/sync/<app-id>/web`. A CSP original da BigPix permanece como política base. Somente o HTML navegável de `/` recebe uma diretiva adicional quando `NEXT_PUBLIC_ONESIGNAL_APP_ID` do build é um UUID v4 válido:

```text
script-src-elem 'self' 'unsafe-inline' https://cdn.onesignal.com https://api.onesignal.com/sync/<app-id>/web
```

O App ID real vem do ambiente já configurado na BigPix. Os cinco cabeçalhos CETEC, as fontes de `script-src`, as demais diretivas, a CSP administrativa e as políticas de `/instalar`, `/pwa-offline` e RSC conservam o baseline. `blob:` continua bloqueado para scripts e `unsafe-eval` segue ausente.

A BigPix já encaminha callbacks da raiz para `/admin/activate` e `/admin/reset-password`. A regra de CSP exclui as queries com `code`, `token_hash`, `type`, `error_code` ou `error_description`. O inicializador consulta o resolvedor de callback existente antes de iniciar o SDK na raiz, inclusive para fragmentos que o servidor não recebe. Os destinos, a validação e a troca dos tokens permanecem no fluxo existente.

O JSONP executa código remoto com os privilégios do documento. A comparação de CSP ignora parâmetros da query e, após redirecionamento, deixa de comparar o caminho. Para fragmentos, a proteção contra uma chamada do SDK no callback depende da verificação no navegador. Encaminhar a exceção do M-2, o escopo administrativo e essas limitações à CETEC para revalidação formal antes da operação comercial. [CSP Level 3](https://www.w3.org/TR/CSP3/#paths-and-redirects)

## Cache e B-5

A raiz mantém `private, no-store` quando a regra do piloto está ativa. `/pwa-offline` é uma representação pública separada, com CSP original, revalidação HTTP e `CDN-Cache-Control: no-store`. O Service Worker `app-big-v3` busca o documento em segundo plano na própria origem, sem credenciais ou redirects, e exige URL exato, status `200`, tipo HTML, CSP original e aprovação dos filtros de cache. O precache verifica também tipo e CSP do manifest. Respostas administrativas, RSC e respostas reprovadas pelos filtros ficam fora do fallback.

Se o precache falhar, o worker pode ativar com fallback válido de `app-big-v2`. A nova entrada tem prioridade assim que for validada. O cache de `v2` e seus arquivos versionados ficam disponíveis durante a transição. Uma falha de atualização preserva o último documento válido. Em rollback, restaurar a política de `/` e manter `/pwa-offline` durante a transição. Se o worker também precisar mudar, versionar o cache e manter o fallback válido até verificar o substituto. [Cabeçalhos de cache da Vercel](https://vercel.com/docs/caching/cache-control-headers)

## A-5, dependências e homologação

A implementação preserva o worker do OneSignal, o envio e a sincronização de push, A-5, autenticação, MFA, RLS, uploads, auditoria persistente, dependências e critérios de CI da BigPix. As suítes de navegador usam perfil descartável e bloqueiam gravações. Opções de inscrição e envio permanecem reservadas a contas e origens de homologação autorizadas.

Na validação pública, verificar a CSP da raiz, fallback, Central e administração, respostas HTML/RSC/304, migração de um perfil `v2`, perda e recuperação da rede, SDK real e ausência de execução do HTML legado. Em Android e iOS físicos, verificar atualização e reinstalação, inscrição nova e anterior, entrega de push e ativos disponíveis offline.
