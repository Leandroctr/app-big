# ONBOARDING_CLIENTE.md

# Checklist de Onboarding de Novo Cliente

**Projeto:** app-big-pwa  
**Modelo atual:** white label por deploy individual.

---

## 1. Objetivo

Criar um novo PWA white label para cliente sem depender de tentativa e erro.

Este checklist assume que cada cliente possui:

- deploy próprio;
- domínio próprio;
- configurações próprias;
- OneSignal próprio;
- linha/configuração própria no banco ou singleton do deploy.

---

## 2. Preparação

Antes de começar, levantar:

- nome do cliente;
- domínio da plataforma principal;
- domínio do PWA;
- logo;
- favicon;
- ícones 192 e 512;
- cores da marca;
- texto da splash;
- link de suporte;
- App ID OneSignal;
- REST API Key OneSignal;
- credenciais do admin.

---

## 3. Vercel

Checklist:

- criar novo projeto Vercel;
- vincular repositório correto;
- configurar domínio;
- configurar variáveis de ambiente;
- rodar deploy;
- validar domínio em produção.

Variáveis críticas:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_SHORT_NAME`
- `NEXT_PUBLIC_APP_DESCRIPTION`
- `NEXT_PUBLIC_PLATFORM_URL`
- `NEXT_PUBLIC_SUPPORT_URL`
- `NEXT_PUBLIC_PUBLIC_URL`
- `NEXT_PUBLIC_THEME_COLOR`
- `NEXT_PUBLIC_BACKGROUND_COLOR`
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. Cloudflare / DNS

Checklist:

- criar CNAME/A conforme necessidade;
- apontar domínio do PWA para Vercel;
- validar SSL;
- testar acesso pelo navegador;
- garantir que `NEXT_PUBLIC_PUBLIC_URL` bate com o domínio real.

---

## 5. Supabase

Checklist:

- confirmar conexão;
- confirmar bucket `app-assets`;
- confirmar policies;
- confirmar `app_settings`;
- validar settings pelo painel admin;
- testar upload de logo;
- testar upload de favicon;
- testar upload de ícones;
- testar splash.

---

## 6. OneSignal

Checklist:

- criar App no OneSignal;
- configurar Site URL exatamente igual ao domínio do PWA;
- copiar App ID;
- copiar REST API Key;
- configurar envs no Vercel;
- validar Service Worker;
- ativar notificação no navegador;
- enviar push teste.

---

## 7. Painel Admin

Checklist:

- acessar `/admin/login`;
- logar com credenciais;
- atualizar identidade visual;
- atualizar URLs;
- salvar settings;
- atualizar splash;
- testar preview;
- testar redirect;
- testar push se habilitado.

---

## 8. PWA

Checklist:

- abrir domínio no Chrome Android;
- validar manifest;
- validar ícone;
- validar nome do app;
- instalar PWA;
- abrir em modo standalone;
- abrir no Windows Chrome/Edge;
- abrir no iPhone Safari;
- validar instrução de instalação manual.

---

## 9. Pós-Onboarding

Registrar:

- cliente criado;
- domínio;
- projeto Vercel;
- App ID OneSignal;
- data de ativação;
- status do push;
- status do PWA;
- observações.

---

## 10. Erros Comuns

### PWA mostra ícone errado

Verificar:

- manifest;
- icon_192_url;
- icon_512_url;
- cache do navegador;
- cache do service worker.

### Push não aparece

Verificar:

- HTTPS;
- permissão do navegador;
- OneSignal App ID;
- Service Worker;
- REST API Key;
- Site URL do OneSignal.

### Configuração não atualiza

Verificar:

- se está lendo banco ou env;
- se houve fallback;
- se env `NEXT_PUBLIC_` exige rebuild;
- cache do navegador.

