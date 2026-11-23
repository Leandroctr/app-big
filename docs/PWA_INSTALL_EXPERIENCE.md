# PWA_INSTALL_EXPERIENCE.md

# PWA Install Experience

**Projeto:** app-big-pwa  
**Objetivo:** criar uma experiência white label para incentivar instalação do PWA.

---

## 1. Conceito

O recurso não deve ser tratado apenas como um modal.

Ele deve ser tratado como:

> **Experiência de Instalação do Aplicativo**

A ideia é aumentar a taxa de instalação do PWA com uma abordagem visual, personalizada e integrada à marca do cliente.

---

## 2. Plataformas Suportadas

- Android Chrome
- Android Edge
- Windows Chrome
- Windows Edge
- iPhone Safari
- iPad Safari

---

## 3. Comportamento Android / Windows

Fluxo:

1. usuário acessa o site;
2. sistema aguarda alguns segundos;
3. se `beforeinstallprompt` estiver disponível, exibe o modal;
4. usuário clica em instalar;
5. sistema chama o prompt nativo;
6. se instalado, salva estado local;
7. modal não aparece mais.

---

## 4. Comportamento iOS

No iOS não existe instalação automática via botão.

Fluxo:

1. usuário acessa pelo Safari;
2. sistema aguarda alguns segundos;
3. exibe modal com instruções;
4. orienta:
   - tocar em compartilhar;
   - tocar em “Adicionar à Tela de Início”;
   - abrir pelo ícone instalado;
   - ativar notificações quando disponível.

---

## 5. Regras de Exibição

O modal não deve aparecer se:

- app já está em modo standalone;
- usuário já instalou;
- usuário fechou há menos de 24h;
- navegador não suporta a experiência;
- configuração do admin estiver desativada.

Regras sugeridas:

- delay inicial: 10 segundos;
- repetição: 24 horas;
- fechamento manual: salvar timestamp;
- instalação concluída: salvar permanentemente.

---

## 6. Persistência Local

Chaves sugeridas no `localStorage`:

- `pwa_install_dismissed_at`
- `pwa_install_completed`
- `pwa_install_last_shown_at`
- `pwa_install_platform`

---

## 7. Campos Futuros no Admin

Adicionar no painel:

- ativar/desativar modal;
- delay para aparecer;
- intervalo para reaparecer;
- título Android/Windows;
- mensagem Android/Windows;
- CTA Android/Windows;
- título iOS;
- mensagem iOS;
- lista de benefícios;
- usar cores do tema;
- preview.

Campos futuros no banco:

```sql
install_modal_enabled boolean default false,
install_modal_delay_ms integer default 10000,
install_modal_repeat_hours integer default 24,
install_modal_title text,
install_modal_message text,
install_modal_cta_text text,
install_modal_ios_title text,
install_modal_ios_message text,
install_modal_benefits jsonb,
install_modal_use_theme_colors boolean default true
```

---

## 8. Design White Label

O modal deve usar:

- logo atual;
- nome do app;
- cor primária;
- cor secundária;
- cor de fundo;
- cor de contraste;
- ícone do app.

Evitar cores fixas.

A lógica visual deve adaptar contraste automaticamente para evitar texto ilegível.

---

## 9. Conteúdo Padrão

### Android / Windows

Título:

> Instale nosso aplicativo

Mensagem:

> Tenha acesso mais rápido, receba notificações importantes e aproveite uma experiência melhor.

Benefícios:

- Acesso com um toque
- Mais velocidade
- Notificações importantes
- Experiência de aplicativo

CTA:

> Instalar aplicativo

---

### iOS

Título:

> Instale no seu iPhone

Mensagem:

> Toque em compartilhar no Safari e selecione “Adicionar à Tela de Início”.

Benefícios:

- Acesso direto pela tela inicial
- Experiência mais rápida
- Notificações quando disponíveis
- Visual de aplicativo

CTA:

> Entendi

---

## 10. Eventos de Analytics

Registrar futuramente:

- `modal_shown`
- `modal_dismissed`
- `install_clicked`
- `install_completed`
- `ios_instructions_shown`
- `standalone_opened`
- `prompt_unavailable`

---

## 11. Riscos

- iOS não permite botão de instalação automática;
- prompt Android depende de critérios do navegador;
- Service Worker pode interferir;
- manifest precisa estar correto;
- ícones precisam ter boa qualidade;
- cache pode manter manifest antigo.

---

## 12. Ordem de Implementação Recomendada

1. Documentar o comportamento.
2. Adicionar campos no admin em ambiente seguro.
3. Criar componente visual sem ativar.
4. Criar detecção de plataforma.
5. Criar controle de localStorage.
6. Testar Android.
7. Testar Windows.
8. Testar iOS.
9. Ativar para um cliente teste.
10. Só depois ativar em produção.

---

## 13. Rota direta de instalação — BigPix

Implementada em 2026-11-19 como referência white label, sem ativar modal global e
sem alterar o launcher da raiz.

- A rota `/instalar` é independente de `app/page.tsx`; portanto, não executa o
  redirecionamento automático para `NEXT_PUBLIC_PLATFORM_URL`.
- O evento `beforeinstallprompt` é capturado e retido. `prompt()` só é chamado
  depois do clique explícito em **Instalar aplicativo**.
- Quando o evento não está disponível, a página mostra instruções por plataforma
  e continua ouvindo um evento que possa chegar depois.
- Android orienta o menu do navegador; iOS orienta Safari, Compartilhar e
  Adicionar à Tela de Início; desktop orienta Chrome/Edge.
- `display-mode: standalone` e `navigator.standalone` identificam a execução já
  instalada e oferecem **Abrir aplicativo**.
- O evento `appinstalled` confirma a conclusão quando o navegador o fornece.
- `getAppSettings()` fornece os dados e a origem pública de cada tenant.
  `lib/pwa-install-brand.ts` reúne perfis visuais por `tenant_domain`, com
  substituições opcionais de nome, frase comercial, logo, ícone, mascote, cores
  e gradientes. Os perfis viajam no mesmo código compartilhado; o domínio já
  configurado para o PWA seleciona o perfil. O componente recebe os dados de
  marca e mantém as mesmas instruções técnicas e estados para todos os perfis.
- O perfil do BigPix usa `icon.png`, `logo.png` e `tiger.png`, copiados sem
  alterações da pasta `public/brands/bigpix` da landing aprovada. Os três
  arquivos são servidos pela origem do PWA. As moedas e a textura do banner da
  referência não têm arquivos aprovados separados; o banner usa apenas o logo,
  o mascote e o gradiente CSS. Para tenants sem perfil, a rota usa os settings
  existentes e omite áreas de imagem quando faltam os ativos; os ícones genéricos
  do manifest não entram na composição visual da rota.
- Em iOS, **Ver como instalar** leva ao card manual. Fora do Safari, o primeiro
  passo mostra o endereço `/instalar` na origem de `settings.publicUrl` para
  copiar e abrir no Safari. Na ausência dessa configuração, usa o endereço da
  rota atual. No Safari, o card orienta a usar Compartilhar, Adicionar à Tela de
  Início e Abrir como App da Web, quando disponível.
- O aceite no convite nativo mostra que a instalação foi autorizada. Um evento
  `appinstalled` recebido antes da resolução do convite prevalece sobre o
  aceite. Cancelamento e erro no convite retornam ao card manual.
- A rota não baixa APK, não chama instalação sem consentimento e não persiste
  analytics ou identificadores.
- O banner Clube VIP fica oculto apenas em `/instalar` para não competir com o
  CTA de instalação. A inicialização e os workers do OneSignal permanecem
  inalterados.
- `app/manifest.ts` continua com `start_url: "/"`; a experiência normal do PWA
  permanece sendo o launcher existente.
- `public/sw.js`, workers OneSignal, autenticação, MFA e administração não foram
  alterados.

### Limitações conhecidas

- O navegador decide se e quando oferece `beforeinstallprompt`; a aplicação não
  pode forçar a disponibilidade.
- Fora de `standalone`, não existe API universal e confiável para abrir uma
  instalação PWA já existente. A ausência do prompt também pode significar que o
  app já está instalado.
- A confirmação final precisa ser validada em Chrome Android real, sob HTTPS,
  com manifest e Service Worker ativos. A adição no Safari também precisa de
  validação em um iPhone real. As capturas locais usam Chrome com emulação de
  viewport e User-Agent. Os eventos de instalação e standalone foram simulados.
- A validação local executou typecheck, build e a suíte `test:pwa`, além do
  Chrome em 320, 375, 393 e 430 px. No navegador foram exercitados o CTA manual,
  o convite tardio, o cancelamento, a falha, o aceite, o `appinstalled` e o
  standalone. Uma configuração neutra abriu a mesma rota sem ativos de marca.
- O erro Cloudflare 520 informado para `https://app-bigpix.com` segue como
  pendência externa. O launcher continua usando a configuração comercial existente.

### Rollback

Para reverter a reforma visual, reverta o commit da branch
`fix/pwa-install-white-label`. Isso restaura a versão anterior de `/instalar`.

