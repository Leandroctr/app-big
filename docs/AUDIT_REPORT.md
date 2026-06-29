# AUDIT_REPORT.md

# Auditoria Técnica — PWA White Label

**Projeto:** app-big-pwa  
**Base analisada:** AUDIT_SNAPSHOT.md  
**Data:** 2026-06-28  
**Objetivo:** identificar riscos, inconsistências e próximos passos sem alterar produção.

---

## 1. Resumo Executivo

O projeto está funcional, mas a arquitetura atual ainda não é multi-tenant real por domínio.

Hoje o modelo correto deve ser descrito como:

> **White label por deploy individual.**

Cada cliente possui seu próprio deploy, suas próprias variáveis de ambiente e seu próprio App ID do OneSignal. O banco contém uma configuração singleton por aplicação/deploy, não uma estrutura multi-tenant com isolamento por `tenant_domain`.

Isso não é necessariamente ruim para a fase atual. Pelo contrário: é mais seguro manter essa abordagem enquanto o projeto ainda está em produção e sensível a mudanças em Service Worker, OneSignal, manifest e push notifications.

---

## 2. Pontos Fortes

- Stack moderna com Next.js App Router, TypeScript, Tailwind, Supabase e Vercel.
- Painel admin já centraliza boa parte das configurações visuais.
- Upload de assets já existe via Supabase Storage.
- Push notification já possui estrutura inicial com OneSignal.
- Manifest PWA é dinâmico.
- Existe separação razoável entre settings, admin, upload e push.
- O projeto já possui um snapshot técnico útil para manutenção.

---

## 3. Diagnóstico Principal

### Situação esperada anteriormente

A documentação anterior sugeria uma arquitetura multi-tenant usando `tenant_domain`.

### Situação real encontrada

O snapshot mostra que:

- não existe coluna `tenant_domain`;
- não existe lógica por domínio;
- `app_settings` usa `singleton_key`;
- `getAppSettings()` busca o registro mais recente/singleton;
- o projeto opera como single-tenant por deploy.

Conclusão:

> O projeto não deve ser tratado como multi-tenant real ainda.

---

## 4. Riscos Altos

### 4.1 OneSignal App ID dividido entre banco e variável de ambiente

O servidor usa o `onesignal_app_id` vindo do banco para envio de push, mas o inicializador do OneSignal no cliente usa `NEXT_PUBLIC_ONESIGNAL_APP_ID`.

Risco:

- alterar App ID no painel pode não refletir no cliente;
- push pode ser enviado para um App ID diferente daquele inicializado no navegador;
- exige rebuild para mudanças de variável pública.

Recomendação:

- não mexer agora em produção;
- documentar claramente;
- futuramente unificar a fonte do App ID.

---

### 4.2 Service Workers duplicados

Existem arquivos OneSignal em:

- `/public/onesignal/OneSignalSDKWorker.js`
- `/public/OneSignalSDKWorker.js`

O primeiro parece ativo. O segundo é legado.

Risco:

- browsers antigos podem manter registro residual;
- conflito de escopo entre OneSignal e `/sw.js`;
- push pode falhar em alguns dispositivos.

Recomendação:

- não remover imediatamente;
- criar diagnóstico;
- testar antes em ambiente separado;
- só remover legado com plano de rollback.

---

### 4.3 Fallback silencioso de settings

Quando o Supabase falha, o sistema cai para env vars.

Risco:

- o site pode carregar dados antigos ou errados sem ninguém perceber;
- falhas reais de banco ficam mascaradas;
- o admin pode parecer funcionando, mas o cliente estar vendo fallback.

Recomendação:

- adicionar logs claros;
- exibir `source: database/env` em diagnóstico admin;
- criar endpoint de healthcheck.

---

### 4.4 Push sem isolamento por tenant

Como o projeto atual é single-tenant por deploy, isso é aceitável por enquanto. Mas se no futuro virar multi-tenant real, as tabelas de push precisam obrigatoriamente ter isolamento.

Campos necessários no futuro:

- `tenant_domain`
- `app_id`
- `campaign_id`
- `device_type`
- `user_agent`
- `permission_status`

---

## 5. Riscos Médios

### 5.1 Falta de auditoria no painel admin

Atualmente, alterações de settings e uploads não parecem gerar histórico persistente.

Risco:

- não saber quem alterou logo, cores ou URLs;
- dificuldade para investigar erro;
- perda de rastreabilidade.

Recomendação:

- criar `admin_audit_logs`;
- registrar alterações importantes;
- registrar antes/depois em JSON.

---

### 5.2 Upload sem limpeza de arquivos antigos

Cada upload gera um path único, mas assets antigos não são removidos.

Risco:

- acúmulo de arquivos órfãos;
- storage crescendo sem controle;
- confusão para auditoria.

Recomendação:

- não apagar nada agora;
- criar inventário de assets;
- futuramente implementar limpeza segura.

---

### 5.3 Ausência de runbook

Quando push, manifest, domínio ou service worker quebrarem, não há guia operacional.

Risco:

- perda de tempo;
- tentativa e erro em produção;
- decisões ruins em emergência.

Recomendação:

- criar `RUNBOOK.md`.

---

## 6. Riscos Baixos

- Textos do modal PWA ainda não existem.
- Admin pode ser melhor organizado.
- Visual e UX podem evoluir.
- Checklist de onboarding ainda precisa ser formalizado.

Esses pontos são importantes, mas não devem vir antes da segurança operacional.

---

## 7. Próximos Passos Recomendados

### Fase 1 — Sem alteração funcional

- criar documentação;
- atualizar visão real da arquitetura;
- listar riscos;
- criar plano de logging;
- criar plano de segurança de produção.

### Fase 2 — Baixo risco

- adicionar logs não invasivos;
- trocar catches silenciosos por logs;
- criar endpoint de diagnóstico somente leitura;
- criar painel de diagnóstico.

### Fase 3 — Médio risco

- adicionar tabelas de auditoria;
- registrar alterações do admin;
- registrar uploads;
- registrar erros técnicos.

### Fase 4 — Alto risco

- revisar Service Worker;
- revisar OneSignal;
- unificar fonte do App ID;
- migrar para multi-tenant real, se ainda fizer sentido.

---

## 8. Decisão Recomendada

Manter por enquanto:

> **White label por deploy individual.**

Preparar para o futuro:

> **Multi-tenant real somente depois de estabilidade, logs e staging.**

