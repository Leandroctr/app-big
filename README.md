# App Big PWA

Projeto Next.js mobile-first para o PWA independente do App Big.

## Stack

- Next.js com App Router
- React
- TypeScript
- Tailwind CSS
- ESLint
- Supabase
- PWA com `manifest.json` e service worker

## Como executar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_APP_NAME=App Big
NEXT_PUBLIC_PLATFORM_URL=
NEXT_PUBLIC_SUPPORT_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=

ADMIN_EMAIL=
ADMIN_PASSWORD=
```

## Supabase

O SQL inicial fica em `supabase/schema.sql`.

Nesta etapa o projeto prepara as tabelas de dispositivos e campanhas, sem implementar OneSignal, painel admin funcional, login admin, segmentacao ou CRM.
