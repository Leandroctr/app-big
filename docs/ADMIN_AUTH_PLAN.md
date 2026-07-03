# ADMIN_AUTH_PLAN.md

# Plano de autenticacao e permissoes administrativas por tenant

**Projeto:** app-big-pwa
**Escopo desta fase:** somente `app-big`. Os outros 5 tenants (`app-megabingo7`, `app-obapremios`, `app-premiosaovivo`, `app-pixkeno`, `app-superkeno`) nao sao alterados nesta rodada.
**Status:** etapas preparatorias 1-7 executadas (arquivos criados, nada conectado, nada aplicado no banco). Aguardando aprovacao para as proximas etapas.

---

## 1. Objetivo

Substituir o login provisorio (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, `lib/admin-auth.ts`) por autenticacao real via Supabase Auth (e-mail/senha), com dois papeis fixos:

- `super_admin`: acessa todos os tenants, gerencia administradores e suas permissoes por `tenant_domain`.
- `admin`: acessa apenas os tenants liberados para ele, sem acesso a tela "Administradores".

Cadastro publico continua desativado. Usuarios sao criados apenas pelo super_admin.

---

## 2. Arquitetura confirmada antes desta implementacao

- Todos os tenants compartilham **um unico projeto Supabase** (`app_settings`, e agora tambem `admin_users`/`admin_tenant_access`).
- `tenant_domain` de cada deploy e **fixo em build-time**, vindo de `extractHostname(appConfig.publicUrl)` (`NEXT_PUBLIC_PUBLIC_URL`) — nunca do `Host` da requisicao nem de input do cliente.
- Nao existe `middleware.ts` no repositorio. A protecao e feita explicitamente em cada pagina/rota, chamando um helper de servidor.

---

## 3. Tabelas novas (aditivas)

`supabase/migrations/003_admin_auth_tables.sql` (nao aplicada ainda):

- `admin_users`: identidade + papel (`super_admin` | `admin`) + `active`. Vinculada a `auth.users` via `auth_user_id`. Nao armazena senha nem hash — isso fica exclusivamente no Supabase Auth.
- `admin_tenant_access`: quais `tenant_domain` cada `admin_user` pode acessar, com flag `active`.
- RLS habilitado em ambas, sem nenhuma policy — deny-all para `anon`/`authenticated`. So o service role key (servidor) acessa.
- Rollback correspondente em `003_admin_auth_tables.rollback.sql`.

---

## 4. Helpers de autorizacao (`lib/admin-identity.server.ts`)

- `getCurrentAdmin()`: le a sessao Supabase Auth do cookie (via `lib/supabase/admin-session.ts`), busca a linha correspondente em `admin_users`. Retorna `null` se nao houver sessao, se nao existir linha em `admin_users`, ou se `active = false` — mesmo com sessao Supabase Auth valida.
- `requireSuperAdmin()`: retorna o admin atual apenas se `role === 'super_admin'`; senao `null`.
- `requireTenantAccess()`: super_admin sempre passa; `admin` precisa de uma linha ativa em `admin_tenant_access` para o `tenant_domain` fixo deste deploy.

Os tres retornam `null`/objeto (nao fazem `redirect` nem retornam `NextResponse`), seguindo o mesmo padrao ja usado por `isAdminAuthenticated()` hoje: cada pagina decide `redirect()`, cada rota de API decide o `NextResponse` de 401/403. Isso evita acoplar o helper a um unico tipo de consumidor (pagina vs. rota) antes da hora.

`lib/password-policy.ts`: validacao de senha forte usada apenas na criacao/redefinicao de admin pelo super_admin (minimo de caracteres + bloqueio de lista de senhas genericas + bloqueio de senha contendo e-mail/nome do proprio admin).

`lib/supabase/admin-session.ts`: wrapper de sessao Supabase Auth via cookies, usando `@supabase/ssr`, para uso em Server Components e Route Handlers.

---

## 5. Rotas que serao protegidas (proxima fase, ainda nao conectadas)

| Rota | Guard planejado |
|---|---|
| `/admin` (pagina) | `requireTenantAccess()` |
| `/admin/settings` (pagina) | `requireTenantAccess()` |
| `/admin/administradores` (pagina, nova) | `requireSuperAdmin()` |
| `/api/admin/settings` (POST) | `requireTenantAccess()` |
| `/api/admin/upload` (POST) | `requireTenantAccess()` |
| `/api/push/send` (POST) | `requireTenantAccess()` |
| `/api/admin/admins*` (novas) | `requireSuperAdmin()` |
| `/api/settings`, `/api/push/subscribe` | sem mudanca — publicas |

Nesta fase (preparatoria) nenhuma dessas rotas foi alterada. Todas continuam usando `isAdminAuthenticated()`/`lib/admin-auth.ts` como hoje.

---

## 6. Fallback temporario

`lib/admin-auth.ts` (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) sera mantido funcionando durante a transicao, tratado como sessao legada com escopo restrito ao tenant local (sem acesso a tela "Administradores", sem entrar em `admin_users`). Remocao e uma etapa separada e explicita, so depois que o primeiro `super_admin` real estiver criado, tiver logado com sucesso via Supabase Auth, e o checklist de testes tiver passado.

### 6.1. `/admin/login` (implementado)

`app/admin/login/page.tsx` agora tenta, nesta ordem:

1. `signInWithPassword()` via Supabase Auth (cliente com sessao em cookies,
   `lib/supabase/admin-session.ts`). Nao consulta `admin_users` — essa
   tabela ainda nao existe no banco (migration 003 nao aplicada) e os
   guards (`getCurrentAdmin`/`requireSuperAdmin`/`requireTenantAccess`)
   continuam desconectados de qualquer rota real.
2. Se falhar (ou Supabase nao estiver configurado), cai no fallback legado
   (`validateAdminCredentials` contra `ADMIN_EMAIL`/`ADMIN_PASSWORD`),
   exatamente como antes.

**Correcao de seguranca aplicada (2026-07-03):** a primeira versao desta
etapa chamava `createAdminSession()` no branch de sucesso do Supabase
Auth, sem checar `validateAdminCredentials()`. Como `createAdminSession()`
ignora os parametros de login e sempre grava o mesmo hash fixo derivado
de `ADMIN_EMAIL`/`ADMIN_PASSWORD` (as envs do deploy), isso concedia o
cookie legado — e portanto acesso total a `/admin` — para **qualquer**
usuario que autenticasse com sucesso no Supabase Auth, independente de
quem fosse ou de existir em `admin_users`. Corrigido: sucesso no
Supabase Auth agora so mantem os cookies de sessao Supabase (`sb-*`)
para uso futuro; `createAdminSession()` so e chamado depois que
`validateAdminCredentials(email, password)` retornar `true`. Ou seja,
o acesso real a `/admin` nesta fase depende exclusivamente do login
legado, mesmo que o Supabase Auth tambem tenha aceitado as credenciais.

**Limitacao conhecida, aceita para esta etapa:** como nenhum usuario real
existe ainda em `auth.users` (nenhum super_admin foi criado — etapa 13),
o caminho Supabase Auth sempre falha na pratica hoje e cai no fallback.
O codigo esta pronto e testado para o caminho de falha; o caminho de
sucesso so sera exercitado de fato depois que a migration 003 for
aplicada e o primeiro super_admin existir.

**Nao alterado nesta etapa:** o logout (`app/admin/page.tsx`, funcao
`logout`) continua so limpando o cookie legado — nao encerra uma
eventual sessao Supabase Auth. Registrado aqui como pendencia para a
etapa em que os guards forem conectados (etapa 10/11), nao no escopo
desta rodada.

### 6.2. Tela "Administradores" e rotas `/api/admin/admins*` (implementado)

Criados nesta etapa, todos protegidos por `requireSuperAdmin()`:

- `app/admin/administradores/page.tsx` — lista administradores e formulario
  de criacao. **Nao ligada ao menu principal do `/admin`** (nenhum link foi
  adicionado em `app/admin/page.tsx`) — so acessivel via URL direta por
  enquanto.
- `app/api/admin/admins/route.ts` — `GET` lista admins + tenants
  disponiveis; `POST` cria um administrador novo (Supabase Auth +
  `admin_users` + `admin_tenant_access`).
- `app/api/admin/admins/[id]/route.ts` — `PATCH` altera papel/ativo/nome.
- `app/api/admin/admins/[id]/access/route.ts` — `PATCH` concede/revoga
  acesso a um `tenant_domain`.
- `lib/admin-directory.server.ts` — leituras auxiliares
  (`listAdminUsers()`, `listTenantDomains()`), com fallback silencioso
  (lista vazia + log) quando as tabelas nao existem ou o Supabase nao
  esta configurado.
- `components/admin-admins-form.tsx`, `components/admin-admins-table.tsx`.

**Nao testado contra banco real ainda:** como a migration 003 nao foi
aplicada, `admin_users`/`admin_tenant_access` nao existem — toda consulta
retorna erro "relation does not exist", tratado como lista vazia (leitura)
ou erro 500 (escrita). O codigo compila e os tipos batem, mas nenhum fluxo
foi exercitado de ponta a ponta contra o banco.

**Tenants sempre vem de `app_settings`:** `listTenantDomains()` faz
`select tenant_domain from app_settings where tenant_domain is not null
order by tenant_domain`. Tanto o formulario de criacao quanto a rota de
concessao de acesso (`/api/admin/admins/[id]/access`) validam o
`tenant_domain` contra essa lista antes de gravar — nenhum dominio
inventado pode ser salvo em `admin_tenant_access`.

**Senha forte:** `POST /api/admin/admins` chama
`checkPasswordPolicy(password, { email, name })` (`lib/password-policy.ts`,
ja existente) antes de criar qualquer coisa — se reprovar, retorna 400 com
o motivo, sem tocar no Supabase Auth nem no banco.

**Trava contra autolockout:** `PATCH /api/admin/admins/[id]` recusa (400)
se o super_admin logado tentar desativar a propria conta ou rebaixar o
proprio papel para `admin`.

### 6.3. Migration 003 aplicada + primeiro super_admin criado (2026-07-03)

**Bug encontrado e corrigido antes de aplicar:** o arquivo
`003_admin_auth_tables.sql` tinha `raise notice '...'` soltos, fora de um
bloco `do $$ ... $$`/funcao — invalido em SQL puro (RAISE e PL/pgSQL-only).
Removidos (eram so mensagens decorativas, nenhuma mudanca de schema) e
substituidos por comentarios `--`. Corrigido nos dois arquivos antes de
qualquer execucao.

**Pre-checks:** confirmado via SQL Editor que `admin_users`/
`admin_tenant_access` nao existiam; os 6 tenants esperados (`pwa.app-bigpix.com`,
`pwa.app-megabingo7.com`, `pwa.app-obapremios.com`, `pwa.app-premiosaovivo.com`,
`pwa.app-pixkeno.com`, `pwa.app-superkeno.com`) todos presentes em
`app_settings`, sem linha extra.

**Backup:** `C:\projetos\_backups\supabase\app_settings_backup_pre_admin_auth_2026-07-03T17-56-40-782Z.json`
(6 linhas) e `auth_users_backup_pre_admin_auth_2026-07-03T17-56-40-782Z.json`
(0 usuarios — baseline confirmado antes de criar qualquer conta).

**Discrepancia investigada e resolvida:** o painel Supabase mostrou
"Total: 10 users (estimated)" ao abrir Authentication → Users, contradizendo
o baseline de 0. A tabela real, ja carregada, mostrou "No users in your
project" — confirmado como estimativa desatualizada do rodape do painel
(coincide com o banner "We are investigating a technical issue" do proprio
Supabase naquele momento), nao um dado real. Nao foi tratado como criterio
de parada por ter sido corroborado pela tabela real antes de prosseguir.

**Migration aplicada** via SQL Editor (nao ha Supabase CLI linkado neste
repo). RLS confirmado `true` em ambas as tabelas; `pg_policies` retornou 0
linhas; `app_settings` com 6 linhas, `admin_users`/`admin_tenant_access`
com 0 linhas logo apos a migration.

**Primeiro super_admin:** usuario criado no Supabase Auth pelo proprio
usuario (Claude nao digita senha em nenhum campo, por regra de seguranca
propria, independente de aprovacao) — `leandro.moline@gmail.com`,
`auth_user_id = 7b3dc212-c6f1-4b42-8db0-887b146d31c4`. UID obtido por
leitura read-only (`auth.admin.listUsers()`), sem a senha em momento algum.
INSERT em `admin_users` retornou `id = e8acfa19-dd2a-4bb2-a5f2-730fcea3e6a6`,
`role = super_admin`, `active = true`.

**Testes locais (`npm run dev`, sem deploy):**
- Login legado (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, autofill do navegador) →
  sucesso normal em `/admin`, painel completo carregado — sem regressao.
- Com so o cookie legado, `GET /admin/administradores` → redirect para
  `/admin/login` (sessao legada nao acessa a tela nova).
- Login com Supabase Auth real (`leandro.moline@gmail.com`) → log do
  servidor confirma `admin_login_supabase_auth_ok`; tela mostra erro (gate
  legado recusando, esperado); navegando manualmente para
  `/admin/administradores` em seguida → **carregou com sucesso**, mostrando
  os 6 tenants (de `app_settings`) e o proprio Leandro cadastrado como
  `super_admin`/`Ativo`.
- `curl` sem cookie: `GET /api/admin/admins` → `403`; `GET /admin` → `307`;
  `GET /admin/administradores` → `307`; `GET /api/settings` → `200`
  (publica, sem regressao).

**Nao relacionado, so ambiente local:** erro de OneSignal no console do
navegador (`Can only be used on: https://pwa.app-bigpix.com`) — esperado
ao rodar em `localhost`, sem nenhuma relacao com esta frente de trabalho,
nao mexido.

### 6.4. Guard de `/admin` trocado para `requireTenantAccess()` (2026-07-03)

Unico arquivo alterado: `app/admin/page.tsx`. Nenhum outro arquivo desta
rodada (`/admin/settings`, `/api/admin/settings`, `/api/admin/upload`,
`/api/push/send`, `/admin/login`) foi tocado — confirmado por `git diff`
antes de reportar.

**Guard novo:**

```
const currentAdmin = await requireTenantAccess();
const hasLegacySession = await isAdminAuthenticated();

if (!currentAdmin && !hasLegacySession) {
  redirect("/admin/login");
}

const isSuperAdmin = currentAdmin?.role === "super_admin";
```

Acesso a `/admin` e concedido se **qualquer um** dos dois for valido —
sessao Supabase real (com tenant checado por `requireTenantAccess()`) OU
cookie legado. O link "Administradores" so renderiza se `isSuperAdmin`,
que depende exclusivamente de `currentAdmin` (nunca da sessao legada).

**Ajuste adicional feito no mesmo arquivo, fora do pedido literal mas
necessario como consequencia direta da mudanca:** a funcao `logout()`
agora tambem chama `sessionClient.auth.signOut()`, alem de
`clearAdminSession()`. Sem isso, "Sair" deixaria de fato deslogar quem
entrou via Supabase Auth, ja que o guard novo aceita essa sessao
independente do cookie legado — o proprio `docs/ADMIN_AUTH_PLAN.md`
(secao 6.1) ja tinha essa pendencia registrada para "a etapa em que os
guards forem conectados", que e esta. Testado e confirmado: apos "Sair",
`/admin/administradores` volta a exigir login.

**Testes locais (`npm run dev`):**
- Sessao Supabase real (super_admin): `/admin` carrega, link
  "Administradores" aparece, navegacao ate `/admin/administradores`
  funciona.
- "Sair" com sessao Supabase real → redirect para `/admin/login` e
  sessao Supabase efetivamente encerrada (confirmado tentando
  `/admin/administradores` depois, que voltou a pedir login).
- Login legado (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) → `/admin` carrega
  normalmente, **sem** o link "Administradores".
- Sessao legada, `GET /admin/administradores` direto → redirect para
  `/admin/login` (bloqueio confirmado no backend, nao so escondido no
  frontend).
- Sessao legada, `/admin/settings` → continua funcionando sem nenhuma
  mudanca.
- `npm run lint`/`npm run build`: limpos, mesmo warning pre-existente e
  nao relacionado em `components/admin-settings-form.tsx`.

### 6.5. Guard de `/admin/settings` trocado para `requireTenantAccess()` (2026-07-03)

Unico arquivo alterado: `app/admin/settings/page.tsx`. Mesmo padrao de
`/admin` (secao 6.4), sem necessidade de ajuste em `logout()` (essa pagina
nao tem botao "Sair" — logout so existe em `/admin`).

```
const currentAdmin = await requireTenantAccess();
const hasLegacySession = await isAdminAuthenticated();
if (!currentAdmin && !hasLegacySession) redirect("/admin/login");
```

Nenhuma mudanca no comportamento visual/de leitura-gravacao de settings —
só o guard de entrada.

**Testes locais (`npm run dev`):**
- Sessao Supabase real (super_admin) → `/admin/settings` carrega
  normalmente (settings do BigPix, 6/9 configurado).
- `/admin` continua funcionando igual a etapa anterior (link
  "Administradores" visivel).
- Login legado → `/admin/settings` carrega normalmente, sem nenhuma
  mudanca.
- Sessao legada, `GET /admin/administradores` direto → continua
  redirecionando para `/admin/login`.
- `git diff --stat` confirma diff vazio em `app/admin/page.tsx`,
  `app/admin/login/page.tsx`, `app/api/admin/settings/route.ts`,
  `app/api/admin/upload/route.ts`, `app/api/push/send/route.ts` nesta
  rodada.
- `npm run lint`/`npm run build`: limpos, mesmo warning pre-existente.

### 6.6. Guard de `/api/admin/settings` trocado para `requireTenantAccess()` (2026-07-03)

Unico arquivo alterado: `app/api/admin/settings/route.ts`. Mesmo padrao
das etapas anteriores, adaptado para API (retorna JSON 401 em vez de
redirect):

```
const currentAdmin = await requireTenantAccess();
const hasLegacySession = await isAdminAuthenticated();
if (!currentAdmin && !hasLegacySession) {
  return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
}
```

Nenhuma mudanca na logica de `tenant_domain`: `hostname =
extractHostname(appConfig.publicUrl)` continua sendo a unica fonte usada
no filtro `.eq("tenant_domain", hostname)`/`upsert(..., tenant_domain:
hostname)` — o campo `tenantDomain` do payload e lido em
`normalizePayload()` mas nunca usado para decidir qual linha e afetada
(era assim antes desta etapa tambem).

**Testes locais (`npm run dev`):**
- `curl -X POST /api/admin/settings` sem cookie → `401
  {"ok":false,"error":"Nao autenticado."}`.
- Sessao Supabase real (super_admin): alterado "Nome curto" para "BigPix
  QA" → `Configuracoes salvas com sucesso.`; revertido para "BigPix" e
  salvo novamente.
- Sessao legada (`ADMIN_EMAIL`/`ADMIN_PASSWORD`): mesmo teste (alterar
  para "BigPix Legacy QA", salvar, reverter) → funcionou identico, sem
  regressao.
- Teste de forjar `tenant_domain`: via `fetch()` no console da propria
  pagina autenticada, enviado `tenantDomain: "pwa.app-forjado-malicioso.com"`
  no body — resposta confirmou `settings.tenantDomain: "localhost"` (o
  hostname real do ambiente local, vindo de `appConfig.publicUrl`),
  provando que o payload do cliente nao influencia qual tenant e afetado.
- `/api/admin/upload` e `/api/push/send`: diff vazio confirmado via
  `git diff --stat`.
- `npm run lint`/`npm run build`: limpos, mesmo warning pre-existente.

**Efeito colateral encontrado durante o teste, registrado para decisão:**
como o ambiente local (`npm run dev`) aponta para o mesmo projeto Supabase
de producao, e `tenant_domain` resolvido localmente e `localhost` (nao
corresponde a nenhum dos 6 tenants reais), os saves de teste acima
criaram uma **linha nova** em `app_settings` com `tenant_domain =
'localhost'` (id `d808cd3e-5869-4b65-9d31-d34c031c00aa`), via `upsert`.
Nao colide nem afeta nenhuma linha dos 6 tenants reais (confirmado por
`select` mostrando as 6 linhas originais intactas + essa linha extra).
Ela fica inerte (nenhum deploy real usa `tenant_domain = 'localhost'`),
mas e um dado de teste dentro do banco de producao — decisao de apagar
ou nao fica para o usuario, nao apagada unilateralmente nesta etapa.

### 6.7. Incidente `tenant_domain = 'localhost'`: limpeza e mitigacao (2026-07-03)

**O que aconteceu:** durante o teste de `POST /api/admin/settings` (secao
6.6), o ambiente local (`npm run dev`) apontava para o mesmo projeto
Supabase compartilhado de producao. Como `NEXT_PUBLIC_PUBLIC_URL` neste
`.env.local` e `http://localhost:3000`, `extractHostname()` resolvia
`tenant_domain = "localhost"` — um valor que nao corresponde a nenhum dos
6 tenants reais. Os saves de teste (via `upsert`) criaram uma linha nova
em `public.app_settings` para esse `tenant_domain` inexistente.

**Limpeza feita (aprovada e executada em etapa separada, antes desta):**
1. `SELECT` confirmando exatamente 1 linha (`id =
   d808cd3e-5869-4b65-9d31-d34c031c00aa`, `tenant_domain = 'localhost'`).
2. Backup da linha em
   `C:\projetos\_backups\supabase\app_settings_localhost_cleanup_2026-07-03.json`,
   fora de qualquer repositorio git.
3. `DELETE ... RETURNING` confirmando a remocao exata dessa linha (e só
   dela).
4. Pos-verificacao: os 6 tenants reais continuam intactos;
   `tenant_domain = 'localhost'` com contagem `0`.

**Regra registrada para nao se repetir:** testes locais de **gravacao**
de settings contra o Supabase compartilhado de producao nao sao seguros
sem protecao explicita no codigo — o ambiente local nao tem (e nao deve
ganhar) um Supabase separado nesta fase do projeto.

**Mitigacao aplicada:** `app/api/admin/settings/route.ts`, logo apos
resolver `hostname = extractHostname(appConfig.publicUrl)`, bloqueia a
gravacao com `403` se `hostname === "localhost"` ou `"127.0.0.1"`:

```ts
if (hostname === "localhost" || hostname === "127.0.0.1") {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Gravacao de settings bloqueada para tenant_domain 'localhost'. " +
        "Configure NEXT_PUBLIC_PUBLIC_URL com um dominio real (ou de staging) para testar o salvamento.",
    },
    { status: 403 },
  );
}
```

Leitura (`GET /api/settings`, carregamento da tela `/admin/settings`)
continua funcionando normalmente em local — só a gravacao e bloqueada.

**Teste de validacao:** com sessao legada autenticada, `fetch()` direto
para `POST /api/admin/settings` retornou `403` com a mensagem acima;
`SELECT count(*) ... where tenant_domain = 'localhost'` confirmou `0`
apos a tentativa — nenhuma linha nova foi criada.

**Consequencia para testes futuros nesta frente:** ao testar
`/api/admin/upload` ou `/api/push/send` (proximas etapas), sera
necessario avaliar se elas tambem escrevem no banco a partir do
`tenant_domain` resolvido localmente e, se for o caso, propor protecao
equivalente antes de exercitar gravacao local contra o Supabase
compartilhado.

### 6.8. Guard de `/api/admin/upload` trocado para `requireTenantAccess()` (2026-07-03)

Unico arquivo alterado: `app/api/admin/upload/route.ts`. Mesmo padrao das
etapas anteriores (401 JSON em vez de redirect). Nenhuma mudanca em
bucket, validacao de arquivo, otimizacao via `sharp`, geracao de path ou
resposta.

```
const currentAdmin = await requireTenantAccess();
const hasLegacySession = await isAdminAuthenticated();
if (!currentAdmin && !hasLegacySession) {
  return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
}
```

**Analise de impacto antes de testar (pedida explicitamente):** esta rota
so grava no Storage (`bucket app-assets`), nunca em `app_settings` —
`path` sempre inclui `Date.now()` + `crypto.randomUUID()`, entao um
upload de teste nunca sobrescreve nenhum asset real de nenhum tenant.
Diferente de `/api/admin/settings`, nao ha risco de poluir uma linha de
`app_settings` (upload e settings sao duas chamadas separadas; nao
persisti a URL retornada em nenhum settings real). O unico efeito e um
arquivo pequeno novo no bucket compartilhado, sob path obviamente de
teste.

**Testes locais (`npm run dev`):**
- `curl -X POST /api/admin/upload` sem cookie → `401
  {"ok":false,"error":"Nao autenticado."}`.
- Sessao legada: upload de um SVG minusculo (`kind=favicon`,
  `claude-test-upload-do-not-use.svg`, gerado inline, sem usar asset real
  de cliente) → `200`, path
  `favicon/1783105454613-...-claude-test-upload-do-not-use.svg`.
- Sessao Supabase real (super_admin): mesmo teste
  (`claude-test-upload-superadmin-do-not-use.svg`) → `200`, path
  `favicon/1783105527483-...-claude-test-upload-superadmin-do-not-use.svg`.
- `/api/push/send`: diff vazio confirmado via `git diff --stat`.
- `npm run lint`/`npm run build`: limpos, mesmo warning pre-existente.

**Arquivos de teste — criados e depois removidos do bucket `app-assets`
(Storage compartilhado de producao):**
- `favicon/1783105454613-f709b4af-8af8-4bf1-a697-ba7e1a42ec0b-claude-test-upload-do-not-use.svg`
- `favicon/1783105527483-f0bd8c89-0c21-44ab-88d0-bd25d26a0a58-claude-test-upload-superadmin-do-not-use.svg`

Ambos eram SVGs de 8x8px, sem referencia em nenhuma linha de
`app_settings`. Ver secao 6.9 para o registro completo da limpeza.

### 6.9. Limpeza dos arquivos de teste no Storage (2026-07-03)

**Verificacao previa** (script read-only, service role key, sem SQL —
chamadas `storage.list()`/`.select()` via `@supabase/supabase-js`):
- `storage.from("app-assets").list("favicon")` confirmou os dois objetos
  presentes, nomes exatamente iguais aos registrados na secao 6.8.
- `select` em `app_settings` (6 linhas) confirmou que nenhum campo de URL
  (`logo_url`, `favicon_url`, `icon_192_url`, `icon_512_url`,
  `splash_image_url`, `splash_html_url`) de nenhum tenant real referencia
  qualquer um dos dois paths — remocao seguro para prosseguir.

**Remocao:** `storage.from("app-assets").remove([...os dois paths...])` —
retornou os metadados de ambos os objetos removidos (tamanho 107 bytes
cada, `image/svg+xml`, confirmando que eram de fato os SVGs de teste).

**Pos-verificacao:**
- Nova listagem de `favicon/` mostra os 12 arquivos reais de producao
  (favicons dos outros tenants — MegaBingo7, PremiosAoVivo etc.) e
  **nenhum** dos dois arquivos de teste.
- `tenant_domain` em `app_settings` continua com as mesmas 6 linhas reais,
  nao tocadas por esta limpeza (a remocao foi só no Storage, a tabela nem
  foi escrita).

**Regra operacional registrada:** qualquer teste desta frente que envie
arquivo para o Storage real (`app-assets`) precisa apagar o objeto de
teste no mesmo ciclo em que foi criado — nao deixar para depois, mesmo
que o arquivo seja inerte. Mesma logica ja aplicada ao incidente da linha
`tenant_domain = 'localhost'` em `app_settings` (secao 6.7): ambiente
local aponta para o mesmo Supabase de producao, entao todo efeito
colateral de teste e real e precisa ser limpo no ciclo.

### 6.10. Guard de `/api/push/send` trocado para `requireTenantAccess()` (2026-07-03) — última rota pendente

Único arquivo alterado: `app/api/push/send/route.ts`. Mesmo padrão das
etapas anteriores (401 JSON), posicionado **antes** de qualquer
configuração, consulta a `push_subscriptions` ou chamada ao OneSignal:

```
const currentAdmin = await requireTenantAccess();
const hasLegacySession = await isAdminAuthenticated();
if (!currentAdmin && !hasLegacySession) {
  return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
}
```

Confirmado por leitura do arquivo: o guard fica nas linhas 47-61, antes
da checagem de config (`supabase`/`oneSignalAppId`/`oneSignalRestApiKey`),
do parse do payload, da validação de título/mensagem, da consulta a
`push_subscriptions`, da criação em `push_campaigns` e do `fetch()` para
a API do OneSignal.

**Testes realizados (sem disparo real):**
- `curl -X POST /api/push/send` sem cookie, mesmo com payload de
  título/mensagem vazios → `401 {"ok":false,"error":"Nao autenticado."}`.
- Com sessão autenticada (cookie existente na aba de testes), `fetch()`
  com `{ title: "", message: "" }` → `400
  {"ok":false,"error":"Titulo e mensagem sao obrigatorios."}` — prova que
  o guard deixou passar (não é 401) mas a requisição parou **antes** de
  tocar `push_subscriptions`/`push_campaigns`/OneSignal.
- Log do servidor confirma isso: só aparece `POST /api/push/send 400`,
  nenhuma linha `push_send_started`/`push_send_onesignal_response`.
- Confirmado por leitura em `public.push_subscriptions`
  (`count = 30`, igual ao valor de sempre) e `public.push_campaigns`
  (`count = 0`, `max(created_at) = NULL`) — nenhuma linha criada,
  nenhuma campanha registrada, nenhum push disparado.
- `npm run lint`/`npm run build`: limpos, mesmo warning pre-existente.

**Marco:** com esta etapa, as 5 rotas originalmente protegidas por
`isAdminAuthenticated()` (`/admin`, `/admin/settings`,
`/api/admin/settings`, `/api/admin/upload`, `/api/push/send`) agora usam
`requireTenantAccess()` com fallback legado mantido. Falta apenas a
auditoria manual final (etapa 11) antes de considerar a etapa 10 do
plano totalmente concluída.

### 6.11. Auditoria final, commit, push e validação em produção (2026-07-03)

Auditoria manual (etapa 11) concluída com sucesso — mapa de guards
conferido rota a rota, buscas por `isAdminAuthenticated`/
`validateAdminCredentials`/`createAdminSession`/`requireTenantAccess`/
`requireSuperAdmin` no repo inteiro, e confirmação de que
`push_subscriptions`/`push_campaigns`/`app_settings` seguiam intactos.

Commit `0aaca27 feat: add tenant-aware admin authentication` criado
isolando exatamente os 21 arquivos desta frente, sem misturar o WIP
pré-existente do install flow (`AGENTS.md`, `CLAUDE.md`, `app/layout.tsx`,
`docs/PWA_INSTALL_EXPERIENCE.md`, `components/pwa-install-flow.tsx`,
`public/pwa-install/` ficaram de fora do stage). Push feito para
`origin/main` (fast-forward, sem divergência). Deploy automático da
Vercel (webhook GitHub→Vercel) confirmado `READY` em produção
(`pwa.app-bigpix.com`), validado com os mesmos testes básicos já feitos
localmente: login legado, login Supabase Auth, `/admin`,
`/admin/settings` (só leitura), `/admin/administradores`, bloqueio da
sessão legada em `/admin/administradores`, e `/api/settings` público
com `source: "database"`.

### 6.12. Correção de UX: login Supabase Auth redireciona direto (2026-07-03)

**Problema encontrado após a validação em produção:** o login com
Supabase Auth criava a sessão real corretamente, mas a tela continuava
mostrando o erro do fallback legado (porque o fluxo sempre caía na
checagem de `validateAdminCredentials()` em seguida, mesmo já tendo
autenticado via Supabase). Como `/admin`, `/admin/settings` e
`/admin/administradores` já usam `requireTenantAccess()`/
`requireSuperAdmin()`, essa segunda checagem era desnecessária.

**Correção:** único arquivo alterado, `app/admin/login/page.tsx`. O
branch de sucesso do Supabase Auth agora faz `redirect("/admin")`
diretamente, sem cair no bloco do fallback legado:

```ts
if (supabaseOk) {
  logServerInfo("admin_login_supabase_auth_ok", { email });
  redirect("/admin");
}

if (!validateAdminCredentials(email, password)) {
  redirect("/admin/login?error=1");
}

logServerWarn("admin_login_legacy_fallback_used", { email });
await createAdminSession();
redirect("/admin");
```

`createAdminSession()` continua sendo alcançável **somente** depois de
`validateAdminCredentials()` passar — nada mudou nessa garantia, só o
caminho de sucesso do Supabase deixou de "cair" nessa checagem.

**Testes locais (`npm run dev`):**
- Login Supabase Auth (super_admin) → redireciona direto para `/admin`,
  **sem** mostrar a tela de erro.
- `/admin` carrega com link "Administradores" visível.
- `/admin/administradores` carrega normalmente.
- `createAdminSession()` não é chamado nesse caminho — confirmado por
  leitura do código (branch `if (supabaseOk)` termina em `redirect()`
  antes de qualquer referência a `createAdminSession()`) e por
  comportamento (login direto sem erro só é possível vindo desse branch,
  já que a senha real do Supabase nunca bate com `ADMIN_PASSWORD`).
- Login legado (`admin@admin.com`) → continua entrando em `/admin`
  normalmente, **sem** o link "Administradores".
- Sessão legada em `/admin/administradores` → continua bloqueada,
  redireciona para `/admin/login`.
- `npm run lint`/`npm run build`: limpos, mesmo warning pre-existente.

---

## 7. Micro-etapas

- [x] 1. Criar `docs/ADMIN_AUTH_PLAN.md`.
- [x] 2. Criar `supabase/migrations/003_admin_auth_tables.sql` (nao aplicada).
- [x] 3. Criar `supabase/migrations/003_admin_auth_tables.rollback.sql`.
- [x] 4. Criar `lib/admin-identity.server.ts` (nao conectado a nenhuma rota).
- [x] 5. Criar `lib/password-policy.ts`.
- [x] 6. Adicionar dependencia `@supabase/ssr`.
- [x] 7. Criar `lib/supabase/admin-session.ts`.
- [x] 8. Reescrever `/admin/login` com Supabase Auth + fallback legado (ver secao 6.1).
- [x] 9. Criar `/admin/administradores` + rotas `/api/admin/admins*` (ver secao 6.2).
- [x] 10. Trocar guard das rotas existentes, uma por vez — **concluido**:
      `/admin` (secao 6.4), `/admin/settings` (secao 6.5),
      `/api/admin/settings` (secao 6.6), `/api/admin/upload` (secao 6.8)
      e `/api/push/send` (secao 6.10).
- [ ] 11. Auditoria manual confirmando guard em 100% das rotas admin.
- [x] 12. Aplicar migration 003 no Supabase (com backup previo e aprovacao) — ver secao 6.3.
- [x] 13. Criar o primeiro super_admin — ver secao 6.3. `leandro.moline@gmail.com`,
      `admin_users.id = e8acfa19-dd2a-4bb2-a5f2-730fcea3e6a6`, role `super_admin`.
- [x] 14. Rodar checklist de testes completo (parcial — só o que e possivel nesta
      fase intermediaria, sem guards trocados; ver secao 6.3).
- [ ] 15. Desligar o fallback legado (etapa separada).
- [ ] 16. Atualizar `AGENTS.md`/`CLAUDE.md`/`docs/AUDIT_REPORT.md`/`docs/TENANT_DOMAIN_AUDIT.md`.
- [ ] 17. (fora desta rodada) Avaliar `middleware.ts` como camada extra.
- [ ] 18. (fora desta rodada) Decidir estrategia de replicacao para os outros 5 tenants.

---

## 8. Checklist de teste (a rodar quando as rotas forem conectadas)

- Fallback legado continua funcionando durante toda a fase de transicao.
- Login do super_admin via Supabase Auth funciona e mostra o link "Administradores".
- Sessao legada nao mostra o link "Administradores".
- `curl` em `/api/admin/admins` sem cookie retorna 401.
- `curl` em `/api/admin/admins` com sessao de `admin` (nao super_admin) retorna 403.
- Criacao de admin com senha fraca e rejeitada por `lib/password-policy.ts`.
- Admin de teste com acesso a `app-big` consegue usar `/admin/settings`, mas recebe 403 em `/admin/administradores`.
- `admin_users.active = false` bloqueia login mesmo com credencial Supabase valida.
- Nenhuma senha em texto puro fica persistida em `admin_users`.
- RLS de `admin_users`/`admin_tenant_access` bloqueia leitura via chave anonima.
- Migration aplicada nao quebra `/api/settings` nem `/api/push/subscribe`.

---

## 9. Riscos (resumo — ver analise completa na conversa de planejamento)

- Sem `middleware.ts` nesta fase: toda protecao depende do guard ser chamado explicitamente em cada rota. Mitigado por auditoria manual antes de aplicar a migration/criar o super_admin.
- Fallback legado prolongado e uma segunda porta de entrada sem rastreabilidade por usuario — precisa de desligamento explicito, nao pode virar permanente.
- Identidade compartilhada entre os 6 tenants (mesmo projeto Supabase): uma sessao comprometida pode tentar logar em qualquer um dos 6 dominios — a barreira real e `admin_tenant_access`.
- Risco de lockout total se o primeiro super_admin for criado errado — mitigado por manter o fallback ativo ate validacao completa.
