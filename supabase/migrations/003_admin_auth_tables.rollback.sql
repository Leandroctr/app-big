-- =============================================================
-- Rollback: 003_admin_auth_tables
-- Projeto: app-big-pwa
-- Status: AGUARDANDO EXECUÇÃO CONDICIONAL
-- =============================================================
--
-- Quando usar:
--   Somente se a migration 003 foi aplicada ao banco e precisa ser
--   revertida por problema inesperado detectado imediatamente após
--   a execução.
--
-- O que este rollback FAZ:
--   - Remove a tabela admin_tenant_access (e todas as suas linhas).
--   - Remove a tabela admin_users (e todas as suas linhas).
--   - Não apaga nenhum usuário de auth.users — o Supabase Auth
--     não é afetado por este rollback.
--
-- O que este rollback NÃO FAZ:
--   - Não remove usuários criados em auth.users (Authentication do
--     Supabase). Se necessário removê-los, isso é uma ação separada,
--     feita manualmente no painel/API de Auth, com aprovação própria.
--   - Não reverte nenhuma mudança de código — se o rollback for
--     executado depois que alguma rota já estiver usando
--     lib/admin-identity.server.ts, essas rotas passarão a falhar
--     (getCurrentAdmin() sempre retornará null). Não usar este
--     rollback depois que as rotas estiverem conectadas sem
--     antes reverter o código também.
--
-- CONSEQUÊNCIAS DO ROLLBACK:
--   Qualquer admin_user e admin_tenant_access já cadastrado é perdido
--   permanentemente (não há como recuperar sem re-inserir manualmente).
--
-- Pré-requisitos obrigatórios ANTES de executar:
--   1. Confirmar que a migration 003 foi de fato aplicada ao banco.
--   2. Confirmar que nenhuma rota em produção depende hoje destas
--      tabelas (ver docs/ADMIN_AUTH_PLAN.md, seção de micro-etapas).
--   3. Ter um backup recente de admin_users/admin_tenant_access,
--      caso o rollback seja usado por engano.
-- =============================================================


begin;

-- -------------------------------------------------------------
-- Passo 1: remover admin_tenant_access (depende de admin_users)
-- -------------------------------------------------------------

drop table if exists public.admin_tenant_access;

raise notice 'Passo 1 OK: tabela admin_tenant_access removida (ou inexistente).';


-- -------------------------------------------------------------
-- Passo 2: remover admin_users
-- -------------------------------------------------------------

drop table if exists public.admin_users;

raise notice 'Passo 2 OK: tabela admin_users removida (ou inexistente).';
raise notice 'Usuários em auth.users NÃO foram removidos por este rollback.';


commit;


-- =============================================================
-- Verificação pós-rollback (executar manualmente)
-- =============================================================
--
-- 1. Confirmar que as tabelas foram removidas:
--      SELECT table_name FROM information_schema.tables
--      WHERE table_name IN ('admin_users', 'admin_tenant_access');
--      -- deve retornar 0 rows
--
-- 2. Confirmar que app_settings/push_subscriptions/push_campaigns
--    continuam intactos:
--      SELECT id, tenant_domain, app_name, updated_at
--      FROM public.app_settings;
--
-- 3. Confirmar que o login provisório continua funcionando:
--      GET/POST /admin/login com ADMIN_EMAIL/ADMIN_PASSWORD
-- =============================================================
