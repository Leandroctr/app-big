# M-7 — Trilha de auditoria administrativa

**Repositorio canonico:** `Leandroctr/app-big`

**Projeto Supabase compartilhado:** PWA-WL (`myivwdbnpbuooncehwds`)

**Escopo desta etapa:** BigPix apenas

## Contrato

`public.admin_audit_logs` e uma trilha persistente, append-only, server-side e
multi-tenant. Ela nao depende dos logs da Vercel e preserva snapshots de e-mail
e role do ator mesmo se a linha de `admin_users` for alterada ou removida. A
FK do ator usa `on delete set null`.

Cada mutacao segue obrigatoriamente:

1. gerar `correlation_id` no servidor;
2. inserir `outcome = 'attempt'`;
3. somente apos o insert confirmado, executar a mutacao;
4. inserir um segundo evento com o mesmo `correlation_id` e outcome
   `success`, `failure` ou `partial`.

Falha no `attempt` bloqueia a mutacao com HTTP 503. Falha no evento terminal
gera somente `admin_audit_write_error` sanitizado; uma operacao externa ja
executada nao e desfeita automaticamente.

## Schema e acesso

A migration canonica e
`supabase/migrations/20260915153506_admin_audit_logs.sql`. O rollback protegido
e `supabase/migrations/20260915153506_admin_audit_logs.rollback.sql`.

O rollback recusa remover uma tabela nao vazia para preservar evidencia. A
tabela tem RLS ativa, nenhuma policy, e remove todos os privilegios de
`PUBLIC`, `anon` e `authenticated`. `service_role` recebe somente
`SELECT` e `INSERT` na tabela, alem de `USAGE, SELECT` na sequence da
identity. A aplicacao nao recebe `UPDATE`, `DELETE` ou `TRUNCATE`.

Os indices cobrem tenant de origem/tempo, tenant alvo/tempo (parcial), ator/tempo,
entidade/id/tempo e correlation id. Nao ha GIN, particionamento, IP ou user-agent.

## Acoes

| Superficie | Action | Entidade |
|---|---|---|
| Settings | `settings.updated` | `settings` |
| Upload | `asset.uploaded` | `asset` |
| Push | `push.sent`, `push.failed`, `push.partial` | `push_campaign` |
| Criar/vincular admin | `admin.created`, `admin.linked` | `admin` |
| Alterar admin | `admin.updated`, `admin.role_changed`, `admin.activated`, `admin.deactivated` | `admin` |
| Grant de tenant | `admin.tenant_granted`, `admin.tenant_revoked` | `admin_tenant_access` |

O reset de senha permanece fora do M-7: ele ocorre no Supabase Auth no browser,
nao e uma mutacao de configuracao/negocio do painel e nao justifica criar uma
nova superficie privilegiada. Login, logout e MFA tambem permanecem no dominio
de eventos de autenticacao/sessao. Nenhuma senha e auditada.

## Allowlists e retencao minima

- settings: somente campos configuraveis nao sensiveis; `changedFields`
  contem apenas nomes de campos allowlisted;
- admin: somente `name`, `role` e `active`;
- asset: tipo logico, MIME final e tamanho em bytes; o `entity_id` e o path
  interno final;
- push: campaign id, tipo de alvo, contagem, status HTTP e booleanos de estado;
- grant: somente estado anterior e final.

URLs perdem credenciais, query string e fragmento. Cada objeto JSON tem limite
de 16 KiB e passa por validacao defensiva de chaves proibidas. Senhas, hashes,
tokens, cookies, headers de autorizacao, TOTP, QR, keys, recipients, arquivo,
base64, payload bruto, resposta integral do OneSignal e nome original de upload
nao sao persistidos.

## Aplicacao controlada no PWA-WL

Esta migration existe somente no app-big e deve ser aplicada uma unica vez ao
projeto compartilhado. Nao criar migration equivalente nos outros cinco PWAs.

Preflight read-only obrigatorio:

```sql
select to_regclass('public.admin_audit_logs') as admin_audit_logs;
```

O resultado deve ser `null`. Depois de testes locais verdes e revisao do
rollback, executar a migration canonica uma vez. Validar:

```sql
select c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'admin_audit_logs';

select policyname
from pg_policies
where schemaname = 'public' and tablename = 'admin_audit_logs';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'admin_audit_logs'
order by grantee, privilege_type;
```

Esperado: RLS `true`, zero policies e somente `INSERT`/`SELECT` para
`service_role`.

## Validacao funcional

Usar uma alteracao reversivel de setting nao sensivel do BigPix. Confirmar
`attempt` e `success` com o mesmo `correlation_id`, ator e tenants corretos
e JSON sem secrets. Restaurar imediatamente o valor original; a restauracao
deve gerar outro par de eventos e nenhum log deve ser apagado.

Nao existe UI `/admin/auditoria` nesta etapa. Consulta SQL, testes e evidencia
persistida sao suficientes para o fechamento CETEC.

## Evidencia de aplicacao — 2026-09-15

O preflight confirmou a tabela ausente no PWA-WL. A migration canônica foi
aplicada uma vez e o catálogo confirmou:

- RLS ativa e zero policies;
- `anon` e `authenticated` sem `SELECT`, `INSERT`, `UPDATE`, `DELETE`
  ou `TRUNCATE`;
- `service_role` com `SELECT` e `INSERT`, sem `UPDATE`, `DELETE` ou
  `TRUNCATE`;
- sequence acessível somente conforme necessário ao insert;
- cinco índices solicitados, além da PK, e constraints esperadas.

O fluxo autenticado local, conectado ao tenant `pwa.app-bigpix.com`, alterou
`redirectDelayMs` de 7999 para 8000 e depois restaurou 7999. Foram observados:

- correlação `d3147871-c43d-4202-b237-daf7be236526`: ids 1/2,
  `attempt`/`success`, 7999 → 8000;
- correlação `1e89be82-ebdb-4ecc-9ccc-f06860022fc1`: ids 3/4,
  `attempt`/`success`, 8000 → 7999.

Nos dois pares, ator administrativo, auth user, snapshots, source tenant e
target tenant foram confirmados. `changedFields` continha apenas
`redirectDelayMs`; nenhuma chave proibida foi encontrada. O valor de produção
foi restaurado e os quatro eventos permaneceram append-only.
