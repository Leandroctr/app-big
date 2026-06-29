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

