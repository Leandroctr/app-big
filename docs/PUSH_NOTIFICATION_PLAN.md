# PUSH_NOTIFICATION_PLAN.md

# Plano e histórico de diagnóstico — Push Notification (OneSignal)

**Projeto:** app-big-pwa
**Escopo desta versão:** app-big / BigPix (`pwa.app-bigpix.com`). Replicação para os outros 5 tenants ainda pendente (ver seção "Pendência" abaixo).

---

## 1. Resumo do incidente (2026-07-06/07)

Um push de teste disparado pelo painel admin (`/admin`, botão "Enviar teste") era aceito e confirmado como entregue pela OneSignal (`Sent`/`Delivered`), mas a notificação **não aparecia** no dispositivo Android de teste. A investigação passou por três causas reais, na ordem em que foram encontradas e corrigidas:

1. `ONESIGNAL_REST_API_KEY` inválida em produção (corrigida manualmente pelo usuário no painel da Vercel — fora do código, não documentada aqui como código).
2. Corrida entre a inicialização/sincronização do OneSignal e o redirect automático do launcher (`app/page.tsx`) — **corrigida no código**, commit `928f117`.
3. Ausência de `target_channel: "push"` no payload da API unificada da OneSignal (`api.onesignal.com`) — **corrigida no código**, commit `1825f43`.

Depois das três correções, a OneSignal seguia confirmando `Sent: 1` / `Delivered: 1` para os testes, mas a notificação continuava não aparecendo no Android. A causa final não estava em nenhum dos sistemas nossos ou da OneSignal.

---

## 2. Sintomas observados

- `push_campaigns.status = "sent"`, sem `error_message`, com `onesignal_notification_id` real preenchido.
- Painel da OneSignal (mensagem individual): `Sent: 1`, `Delivered: 1`, `Failed: 0`.
- A **Welcome Notification** automática da própria OneSignal (disparada ao detectar um novo opt-in) **chegava normalmente** no mesmo aparelho Android — descartando bloqueio geral de permissão, canal ou Service Worker quebrado.
- Os pushes disparados pelo nosso endpoint (`/api/push/send`), especificamente, não apareciam — mesmo com `Delivered` confirmado.

---

## 3. Causa raiz final

**Otimização/restrição de bateria do Android para o Chrome.** O aparelho estava em modo de economia de energia com restrição de bateria ativa para o navegador, o que impede o Chrome de processar o evento `push` em segundo plano e exibir a notificação — mesmo que o FCM (serviço de push do Google) já tenha entregue o payload com sucesso ao aparelho (o que a OneSignal reporta como `Delivered`).

**Confirmação:** ao colocar o Chrome em modo normal / sem restrição de bateria (Configurações do Android → Bateria → Chrome → "Sem restrições"), o mesmo tipo de envio passou a aparecer normalmente no aparelho.

**Importante:** `Delivered` na OneSignal significa que o FCM confirmou o recebimento pelo aparelho — não significa que o Android efetivamente exibiu a notificação. A exibição depende inteiramente do sistema operacional e do navegador depois desse ponto, fora do alcance de qualquer diagnóstico via API/backend.

---

## 4. Achados técnicos corrigidos no caminho

Ainda que não fossem a causa final, os dois problemas abaixo eram reais, foram corrigidos, e permanecem válidos independente do incidente de bateria:

### 4.1. Corrida entre sync do OneSignal e redirect do launcher — commit `928f117`

**Problema:** `app/page.tsx` redirecionava para `platformUrl` (`window.location.assign()`, ou `window.top.location.assign()` embutido na splash HTML customizada) após um timer fixo (`redirectDelayMs`), sem nenhuma coordenação com `components/onesignal-initializer.tsx`, que tentava sincronizar a inscrição push via `fetch("/api/push/subscribe")` **sem `keepalive`** — sujeito a ser abortado pelo navegador quando o documento navegava para outra origem.

**Correção:**
- `components/onesignal-initializer.tsx`: `keepalive: true` no fetch; `await` em vez de fire-and-forget; dispara `window.dispatchEvent(new CustomEvent("push-sync-settled", { detail: { ok } }))` ao final de toda tentativa de sync (sucesso, falha, ou nada para sincronizar).
- `app/page.tsx`: redirect centralizado em um único ponto React, que ouve `push-sync-settled` (`{ once: true }`) **ou** o timer de segurança (mesmo `redirectDelayMs` já configurado, sem aumentar o tempo de espera do usuário) — o que vier primeiro. Guard contra disparo duplo. O redirect embutido no HTML da splash customizada foi removido; a splash customizada ficou somente visual.

### 4.2. Ausência de `target_channel: "push"` — commit `1825f43`

**Problema:** o payload enviado para `POST https://api.onesignal.com/notifications` (API unificada, modelo de Subscription) não incluía o campo `target_channel`. Essa API suporta múltiplos canais (push/e-mail/SMS) sob o mesmo `subscription_id`, e a ausência desse campo era um candidato plausível para explicar aceitação sem exibição.

**Correção:** adicionado `target_channel: "push"` ao corpo da requisição em `app/api/push/send/route.ts`, mantendo os demais campos (`app_id`, `include_subscription_ids`, `headings`, `contents`, `url`) inalterados.

**Nota:** essa correção sozinha **não resolveu** o sintoma relatado (a causa real era bateria) — mas é uma correção de payload legítima e correta para a API unificada, mantida.

---

## 5. Checklist operacional para suporte (push "aceito mas não aparece")

Quando a OneSignal confirmar `Sent`/`Delivered` mas o usuário reportar que a notificação não apareceu, verificar nesta ordem:

1. **Puxar a bandeja de notificações do Android** (não só esperar um alerta/popup) — a notificação pode ter chegado silenciosa, sem heads-up.
2. **Chrome → permissões do site** (`pwa.<tenant>.com`) → Notificações → confirmar "Permitir".
3. **Configurações do Android → Apps → Chrome → Notificações** → confirmar que o canal do site não está desativado/silenciado.
4. Se o PWA estiver instalado como app separado (ícone próprio, "standalone"), verificar as notificações **desse app especificamente**, não só do Chrome — em alguns Android, o PWA instalado aparece como um app distinto nas configurações de notificação.
5. **Não Perturbar / Foco** — confirmar que o aparelho não está nesse modo no momento do teste.
6. **Otimização/restrição de bateria do Android para o Chrome (ou para o PWA instalado)** — Configurações → Bateria → Chrome (ou o app do PWA) → colocar em **"Sem restrições"**. **Este é o item que resolveu o incidente registrado nesta seção** — deve ser o primeiro item a testar na prática, mesmo estando listado por último no diagnóstico formal.

Ver também `docs/ONBOARDING_CLIENTE.md`, seção "Erros Comuns" → "Push não aparece", para o checklist resumido já integrado ao fluxo de onboarding.

---

## 6. Commits relacionados

- `928f117` — `fix: wait for push sync before launcher redirect`
- `1825f43` — `fix: set target_channel on OneSignal push payload`

Ambos aplicados e publicados somente no **app-big**.

---

## 7. Pendência — replicar para os outros 5 tenants

As duas correções de código (seção 4) ainda não foram replicadas para:

- [ ] `app-pixkeno`
- [ ] `app-superkeno`
- [ ] `app-megabingo7`
- [ ] `app-obapremios`
- [ ] `app-premiosaovivo`

Arquivos envolvidos em cada replicação: `app/page.tsx`, `components/onesignal-initializer.tsx`, `app/api/push/send/route.ts`. Mesmo processo já usado na replicação da autenticação Supabase Auth (diagnóstico Git → comparação com app-big → implementação → diff → aprovação → commit → push → validação de deploy), um tenant por vez.

O item de bateria/otimização (seção 3/5) não depende de código — é orientação operacional válida para todos os tenants desde já, independente da replicação de código estar pendente.
