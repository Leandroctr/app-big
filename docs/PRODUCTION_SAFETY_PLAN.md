# PRODUCTION_SAFETY_PLAN.md

# Plano de Segurança de Produção

**Projeto:** app-big-pwa  
**Objetivo:** evitar que alterações em produção quebrem clientes ativos.

---

## 1. Regra Principal

Nenhuma alteração de risco deve ser enviada para produção sem:

1. entendimento claro do impacto;
2. backup ou plano de rollback;
3. teste em ambiente seguro;
4. aprovação manual;
5. checklist de validação pós-deploy.

---

## 2. Classificação de Risco

## Seguro

Pode ser feito com baixo risco:

- criar documentação;
- criar arquivos em `/docs`;
- adicionar comentários técnicos;
- criar tarefas internas;
- revisar código sem alterar;
- criar checklist.

## Cuidado

Exige teste antes:

- adicionar logs;
- adicionar campos novos no admin;
- criar endpoints somente leitura;
- adicionar novas tabelas sem uso imediato;
- melhorar mensagens de erro;
- alterar layout do painel admin.

## Risco Alto

Não fazer direto em produção:

- Service Worker;
- OneSignal;
- manifest;
- push notifications;
- variáveis `NEXT_PUBLIC_`;
- schema principal;
- autenticação admin;
- lógica de settings;
- domínio;
- DNS;
- Vercel env;
- Supabase RLS;
- storage policy.

---

## 3. Antes de Qualquer Deploy

Checklist obrigatório:

- identificar qual projeto Vercel será alterado;
- confirmar branch;
- confirmar domínio;
- confirmar cliente afetado;
- confirmar variáveis de ambiente;
- confirmar se há mudança em banco;
- confirmar se há mudança em SW/OneSignal;
- confirmar rollback.

---

## 4. Antes de Qualquer Migração de Banco

Nunca rodar migration direto sem revisar.

Checklist:

- exportar schema atual;
- salvar SQL de rollback;
- testar em ambiente separado;
- confirmar que migration é idempotente;
- evitar `DROP`;
- evitar alteração destrutiva;
- preferir adicionar campos novos primeiro;
- só usar novos campos depois de validar.

---

## 5. Antes de Alterar Service Worker

Service Worker pode ficar preso no navegador do usuário.

Checklist:

- testar em domínio de staging;
- testar Chrome Android;
- testar Chrome/Edge Windows;
- testar Safari iOS se aplicável;
- validar escopos registrados;
- validar cache;
- validar instalação PWA;
- validar OneSignal;
- criar plano de rollback;
- documentar versão do cache.

---

## 6. Antes de Alterar OneSignal

Checklist:

- confirmar App ID correto;
- confirmar Site URL no painel OneSignal;
- confirmar REST API Key no Vercel;
- confirmar service worker path;
- confirmar subscription real;
- enviar push de teste;
- validar inscrição nova;
- validar inscrição antiga;
- validar logs.

---

## 7. Antes de Alterar Variáveis NEXT_PUBLIC_

Atenção: variáveis `NEXT_PUBLIC_` são embutidas no build.

Checklist:

- confirmar valor atual;
- confirmar valor novo;
- alterar no projeto correto;
- rodar deploy forçado;
- validar no navegador;
- limpar cache se necessário.

---

## 8. Rollback

Todo deploy deve responder:

- como voltar o código anterior?
- como reverter migration?
- como restaurar env anterior?
- como restaurar arquivos de storage?
- como validar que voltou?

---

## 9. Regra Para o Codex/Claudio

Nunca pedir:

> “melhore o projeto inteiro”

Sempre pedir tarefas pequenas e específicas.

Exemplo correto:

> “Adicione logging não invasivo em `/api/settings`, sem alterar o retorno da API.”

Exemplo errado:

> “Refatore o sistema multi-tenant e o push.”

---

## 10. Regra de Documentação Obrigatória

Toda alteração técnica relevante deve atualizar a documentação correspondente antes de ser considerada concluída.

| Área alterada                        | Documento a atualizar              |
|--------------------------------------|------------------------------------|
| Logs — novos pontos ou mudanças      | `docs/LOGGING_PLAN.md`             |
| Modal de instalação PWA              | `docs/PWA_INSTALL_EXPERIENCE.md`   |
| Fluxo de onboarding de cliente       | `docs/ONBOARDING_CLIENTE.md`       |
| Arquitetura, riscos ou estrutura     | `docs/AUDIT_REPORT.md`             |
| Visão de médio/longo prazo           | `docs/ROADMAP.md`                  |
| Qualquer item do primeiro lote       | `docs/FIRST_DELIVERY_PLAN.md`      |

**Regra:** nenhuma etapa deve ser considerada concluída se a documentação relacionada estiver desatualizada. A atualização do documento é parte da entrega, não um passo opcional posterior.

---

## 11. Ordem Segura de Evolução

1. Documentação.
2. Logs não invasivos.
3. Diagnóstico somente leitura.
4. Auditoria do admin.
5. Campos novos no banco.
6. Uso controlado dos campos.
7. Novas funcionalidades.
8. Migrações estruturais.

