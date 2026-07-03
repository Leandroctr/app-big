-- =============================================================
-- Migration: 003_admin_auth_tables
-- Projeto: app-big-pwa
-- Data planejada: 2026-07-03
-- Status: AGUARDANDO EXECUÇÃO — não executar sem aprovação e backup prévio
-- Rollback disponível: 003_admin_auth_tables.rollback.sql
-- =============================================================
--
-- Objetivo:
--   Criar as tabelas necessárias para autenticação real de administradores
--   via Supabase Auth, com dois papéis (super_admin | admin) e permissão
--   de acesso por tenant_domain.
--
-- Escopo desta migration:
--   100% aditiva. Não altera app_settings, push_subscriptions,
--   push_campaigns nem qualquer dado existente. Não remove nem modifica
--   o login provisório (ADMIN_EMAIL/ADMIN_PASSWORD) — ele continua
--   funcionando normalmente enquanto o código não for trocado.
--
-- Tabelas criadas:
--   1. public.admin_users
--      - vincula um usuário do Supabase Auth (auth.users) a um papel
--        (super_admin | admin) e a um estado ativo/inativo.
--      - não armazena senha nem hash — isso é responsabilidade exclusiva
--        do Supabase Auth (auth.users).
--   2. public.admin_tenant_access
--      - define quais tenant_domain cada admin_user pode acessar.
--      - só relevante para role = 'admin' (super_admin ignora esta tabela
--        e tem acesso a todos os tenants por definição de papel).
--
-- Segurança:
--   RLS habilitado em ambas as tabelas, sem nenhuma policy criada —
--   ou seja, deny-all para as roles "anon" e "authenticated" do Supabase.
--   Apenas o service role key (já usado hoje em lib/supabase/server.ts,
--   createSupabaseAdminClient) consegue ler/escrever, pois esse client
--   ignora RLS por definição do Supabase.
--
-- Pré-requisito:
--   Nenhum. Não depende de nenhuma linha existir em auth.users ainda —
--   a FK só é validada quando uma linha for de fato inserida em
--   admin_users (etapa futura, separada e aprovada individualmente).
-- =============================================================


begin;


-- -------------------------------------------------------------
-- Tabela 1: admin_users
-- -------------------------------------------------------------
-- auth_user_id referencia auth.users(id) — o usuário real do Supabase Auth.
-- role é restrito a exatamente dois valores, por regra de negócio do projeto.
-- Nenhuma coluna de senha/hash: a senha vive só em auth.users.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  role text not null check (role in ('super_admin', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela admin_users criada (ou já existente).


-- -------------------------------------------------------------
-- Tabela 2: admin_tenant_access
-- -------------------------------------------------------------
-- Um admin_user pode ter no máximo uma linha por tenant_domain
-- (garantido pela constraint unique abaixo). "active = false" permite
-- revogar acesso sem apagar o histórico da concessão.
-- tenant_domain não tem FK para app_settings.tenant_domain de propósito:
-- a validação de que o domínio existe fica na camada de aplicação, para
-- não acoplar esta tabela ao índice único de app_settings.

create table if not exists public.admin_tenant_access (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  tenant_domain text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (admin_user_id, tenant_domain)
);

-- Tabela admin_tenant_access criada (ou já existente).


-- -------------------------------------------------------------
-- Segurança: RLS habilitado, deny-all (sem policies)
-- -------------------------------------------------------------

alter table public.admin_users enable row level security;
alter table public.admin_tenant_access enable row level security;

-- RLS habilitado em admin_users e admin_tenant_access (deny-all, sem policies).


-- -------------------------------------------------------------
-- Índice de apoio
-- -------------------------------------------------------------
-- Acelera a checagem de requireTenantAccess(), que filtra por
-- admin_user_id em toda requisição de um admin não-super_admin.

create index if not exists admin_tenant_access_admin_user_idx
  on public.admin_tenant_access (admin_user_id);

-- Índice admin_tenant_access_admin_user_idx criado (ou já existente).


commit;


-- =============================================================
-- Verificação pós-execução (executar manualmente após o commit)
-- =============================================================
--
-- 1. Confirmar que as tabelas existem e estão vazias:
--      SELECT count(*) FROM public.admin_users;
--      SELECT count(*) FROM public.admin_tenant_access;
--      -- ambas devem retornar 0 (nenhum admin criado ainda)
--
-- 2. Confirmar RLS habilitado e sem policies:
--      SELECT relrowsecurity FROM pg_class WHERE relname = 'admin_users';
--      SELECT relrowsecurity FROM pg_class WHERE relname = 'admin_tenant_access';
--      -- ambas devem retornar true
--      SELECT * FROM pg_policies
--      WHERE tablename IN ('admin_users', 'admin_tenant_access');
--      -- deve retornar 0 rows
--
-- 3. Confirmar que nenhum dado existente foi afetado:
--      SELECT id, tenant_domain, app_name, updated_at FROM public.app_settings;
--      -- deve continuar idêntico ao estado anterior à migration
--
-- 4. Confirmar que o login provisório continua funcionando:
--      GET/POST /admin/login com ADMIN_EMAIL/ADMIN_PASSWORD
--      -- deve continuar funcionando sem nenhuma mudança de comportamento
-- =============================================================
