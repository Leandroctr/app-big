# White-label PWA

Base Next.js mobile-first para gerar PWAs reutilizaveis para diferentes marcas,
sites e plataformas.

## Stack

- Next.js com App Router
- React
- TypeScript
- Tailwind CSS
- ESLint
- Supabase
- PWA com manifest dinamico e service worker

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
NEXT_PUBLIC_APP_NAME=
NEXT_PUBLIC_APP_SHORT_NAME=
NEXT_PUBLIC_APP_DESCRIPTION=
NEXT_PUBLIC_PLATFORM_URL=
NEXT_PUBLIC_SUPPORT_URL=
NEXT_PUBLIC_PUBLIC_URL=
NEXT_PUBLIC_LOGO_URL=
NEXT_PUBLIC_THEME_COLOR=
NEXT_PUBLIC_BACKGROUND_COLOR=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=

ADMIN_EMAIL=
ADMIN_PASSWORD=
```

## White-label

A configuracao principal fica em `lib/app-config.ts`. Para criar uma nova
variacao do PWA, use a mesma base de codigo e altere apenas as variaveis de
ambiente do deploy.

Variaveis que normalmente mudam por dominio/site:

- `NEXT_PUBLIC_APP_NAME`: nome completo exibido no app.
- `NEXT_PUBLIC_APP_SHORT_NAME`: nome curto usado no manifest e UI compacta.
- `NEXT_PUBLIC_APP_DESCRIPTION`: texto principal da home e descricao do PWA.
- `NEXT_PUBLIC_PLATFORM_URL`: destino do botao Acessar.
- `NEXT_PUBLIC_SUPPORT_URL`: destino dos botoes de suporte.
- `NEXT_PUBLIC_PUBLIC_URL`: dominio publico do PWA.
- `NEXT_PUBLIC_LOGO_URL`: URL publica do logo da marca.
- `NEXT_PUBLIC_THEME_COLOR`: cor principal da marca.
- `NEXT_PUBLIC_BACKGROUND_COLOR`: cor de fundo do app.
- `NEXT_PUBLIC_SUPABASE_URL`: projeto Supabase da variacao.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave anonima Supabase da variacao.
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`: app OneSignal da variacao, quando ativado.

O manifest e a home consomem `lib/app-config.ts`, entao nome, descricao, cores,
logo e URLs acompanham automaticamente o ambiente configurado.

## Supabase

O SQL inicial fica em `supabase/schema.sql`.

Nesta etapa o projeto prepara as tabelas de dispositivos e campanhas, sem implementar OneSignal, painel admin funcional, login admin, segmentacao ou CRM.
