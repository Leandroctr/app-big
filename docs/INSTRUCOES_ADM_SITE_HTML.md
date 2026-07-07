# Instruções para o banner Clube VIP no site principal

**Projeto:** BigPix / PWA white label
**Repositório:** `Leandroctr/app-big`
**Objetivo:** orientar a equipe que administra a página original/site principal BigPix a incluir uma chamada para instalar/acessar o PWA.
**PWA BigPix:** `https://pwa.app-bigpix.com`

> Este documento é para o site principal da banca, não para o painel administrativo.
> Não instale este banner em rotas, telas ou áreas de admin.

---

## 1. Objetivo do banner

O PWA BigPix já existe em um domínio separado:

```text
https://pwa.app-bigpix.com
```

O banner abaixo deve ser colocado na página original/site principal para convidar o usuário a instalar ou acessar o app.

Esse banner não instala o PWA diretamente no site principal. Ele leva o usuário para o domínio do PWA, onde o navegador pode oferecer a instalação quando os requisitos técnicos estiverem presentes.

---

## 2. Como funciona

O site principal faz somente a chamada visual:

- mostra um banner maior no topo;
- depois de alguns segundos, recolhe para uma faixa discreta;
- se o usuário fechar o banner maior, ele também recolhe para a faixa;
- a faixa continua visível e clicável;
- clique no botão ou na faixa abre o PWA BigPix.

O site principal normalmente não consegue disparar o prompt nativo de instalação (`beforeinstallprompt`), porque esse prompt pertence ao domínio que tem o `manifest.webmanifest` e o Service Worker do PWA.

Por isso, o comportamento correto é:

```text
Site principal -> redireciona para https://pwa.app-bigpix.com -> PWA trata instalação/acesso
```

Alerta importante:

- Não copie o Service Worker (`sw.js`) para o site principal.
- Não copie o `manifest.webmanifest` para o site principal.
- Não copie OneSignal para o site principal.
- Não use `iframe` para embutir o PWA.
- O banner deve apenas redirecionar para `https://pwa.app-bigpix.com`.

---

## 3. Onde inserir

Cole o bloco completo da seção 4 antes do fechamento da tag `</body>` do site principal.

Exemplo:

```html
  <!-- conteúdo normal da página -->

  <!-- Banner Clube VIP BigPix entra aqui -->

</body>
```

Sugestões por tecnologia:

| Tecnologia | Onde inserir |
|---|---|
| HTML puro | Antes de `</body>` no `index.html` |
| WordPress | Tema `footer.php`, plugin de custom code ou área equivalente |
| Laravel/Blade | Layout principal, antes de `</body>` |
| React/Next.js | Layout raiz/componente global do site principal |
| Vue/Nuxt | Layout principal |
| Painel/site builder | Campo de HTML customizado global, quando existir |

Não inserir em páginas administrativas.

Se o site principal já tiver menu/header fixo no topo, pode ser necessário ajustar `top`, `z-index` ou o espaçamento do conteúdo para o banner não cobrir elementos importantes.

---

## 4. Código pronto para copiar e colar

> Versão inicial focada somente no BigPix.

```html
<!-- ================================================== -->
<!-- BANNER CLUBE VIP - PWA BIGPIX                      -->
<!-- Cole antes do </body> no site principal BigPix     -->
<!-- ================================================== -->

<div id="bigpix-vip-install-root" aria-live="polite"></div>

<style>
  #bigpix-vip-install-root {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    font-family: Inter, Arial, Helvetica, sans-serif;
    pointer-events: none;
  }

  #bigpix-vip-install-root * {
    box-sizing: border-box;
  }

  .bigpix-vip-shell {
    pointer-events: auto;
    width: 100%;
    border-bottom: 1px solid rgba(0, 109, 255, 0.18);
    background: linear-gradient(135deg, #f4f8ff 0%, #ffffff 72%);
    box-shadow: 0 10px 28px rgba(16, 24, 40, 0.12);
  }

  .bigpix-vip-expanded {
    padding: 12px 14px;
  }

  .bigpix-vip-expanded-inner {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 12px;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    align-items: start;
  }

  .bigpix-vip-logo {
    width: 48px;
    height: 48px;
    border: 1px solid rgba(16, 24, 40, 0.08);
    border-radius: 14px;
    background: #ffffff;
    object-fit: cover;
    box-shadow: 0 8px 18px rgba(16, 24, 40, 0.12);
  }

  .bigpix-vip-title-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .bigpix-vip-title {
    margin: 0;
    color: #101828;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.25;
  }

  .bigpix-vip-close {
    display: grid;
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    place-items: center;
    border: 0;
    border-radius: 999px;
    background: rgba(16, 24, 40, 0.07);
    color: #475467;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
  }

  .bigpix-vip-copy {
    margin: 6px 0 12px;
    color: #344054;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
  }

  .bigpix-vip-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .bigpix-vip-primary,
  .bigpix-vip-mini-button {
    border: 0;
    background: #006dff;
    color: #ffffff;
    cursor: pointer;
    font-weight: 800;
    text-decoration: none;
    box-shadow: 0 10px 20px rgba(0, 109, 255, 0.24);
    transition: transform 0.15s ease, filter 0.15s ease;
  }

  .bigpix-vip-primary:hover,
  .bigpix-vip-mini-button:hover {
    filter: brightness(0.94);
    transform: translateY(-1px);
  }

  .bigpix-vip-primary {
    display: block;
    min-height: 42px;
    flex: 1;
    border-radius: 12px;
    padding: 12px 16px;
    text-align: center;
    font-size: 14px;
  }

  .bigpix-vip-secondary {
    min-height: 42px;
    border: 0;
    border-radius: 12px;
    background: #eef2f6;
    color: #475467;
    cursor: pointer;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 700;
  }

  .bigpix-vip-collapsed {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 9px;
    align-items: center;
    width: 100%;
    min-height: 50px;
    padding: 8px 10px;
    cursor: pointer;
  }

  .bigpix-vip-collapsed .bigpix-vip-logo {
    width: 32px;
    height: 32px;
    border-radius: 9px;
  }

  .bigpix-vip-collapsed-text {
    min-width: 0;
    overflow: hidden;
    color: #344054;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.35;
  }

  .bigpix-vip-mini-button {
    min-height: 32px;
    border-radius: 10px;
    padding: 0 12px;
    font-size: 12px;
  }

  @media (min-width: 768px) {
    #bigpix-vip-install-root {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bigpix-vip-primary,
    .bigpix-vip-mini-button {
      transition: none;
    }
  }
</style>

<script>
  (function () {
    var PWA_URL = "https://pwa.app-bigpix.com";
    var LOGO_URL = "https://pwa.app-bigpix.com/icons/icon-192.svg";
    var BRAND_NAME = "BigPix";

    var COLLAPSE_AFTER_MS = 7000;
    var STORAGE_KEY = "bigpix_vip_install_banner_state";

    var root = document.getElementById("bigpix-vip-install-root");
    var collapseTimer;

    if (!root) return;

    function isStandalone() {
      try {
        return (
          window.matchMedia("(display-mode: standalone)").matches ||
          window.navigator.standalone === true
        );
      } catch (error) {
        return false;
      }
    }

    function getSavedState() {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch (error) {
        return null;
      }
    }

    function saveState(state) {
      try {
        window.localStorage.setItem(STORAGE_KEY, state);
      } catch (error) {}
    }

    function openPwa() {
      saveState("collapsed");
      window.location.href = PWA_URL;
    }

    function renderLogo(sizeClass) {
      return (
        '<img class="bigpix-vip-logo ' +
        (sizeClass || "") +
        '" src="' +
        LOGO_URL +
        '" alt="' +
        BRAND_NAME +
        '" onerror="this.style.display=\'none\'">'
      );
    }

    function renderExpanded() {
      root.innerHTML =
        '<div class="bigpix-vip-shell bigpix-vip-expanded">' +
        '  <div class="bigpix-vip-expanded-inner">' +
        renderLogo("") +
        '    <div>' +
        '      <div class="bigpix-vip-title-row">' +
        '        <p class="bigpix-vip-title">Entre para o Clube VIP 👑</p>' +
        '        <button class="bigpix-vip-close" type="button" aria-label="Recolher banner">×</button>' +
        "      </div>" +
        '      <p class="bigpix-vip-copy">Instale o app e receba promoções especiais, bônus exclusivos e vantagens reservadas para quem faz parte.</p>' +
        '      <div class="bigpix-vip-actions">' +
        '        <button class="bigpix-vip-primary" type="button">Instalar app</button>' +
        '        <button class="bigpix-vip-secondary" type="button">Depois</button>' +
        "      </div>" +
        "    </div>" +
        "  </div>" +
        "</div>";

      root.querySelector(".bigpix-vip-primary").addEventListener("click", openPwa);
      root.querySelector(".bigpix-vip-close").addEventListener("click", renderCollapsed);
      root.querySelector(".bigpix-vip-secondary").addEventListener("click", renderCollapsed);

      window.clearTimeout(collapseTimer);
      collapseTimer = window.setTimeout(renderCollapsed, COLLAPSE_AFTER_MS);
    }

    function renderCollapsed() {
      saveState("collapsed");
      window.clearTimeout(collapseTimer);

      root.innerHTML =
        '<div class="bigpix-vip-shell bigpix-vip-collapsed" role="button" tabindex="0" aria-label="Instalar app BigPix">' +
        renderLogo("") +
        '  <div class="bigpix-vip-collapsed-text">Clube VIP 👑 Instale o app e receba vantagens exclusivas.</div>' +
        '  <button class="bigpix-vip-mini-button" type="button">Instalar</button>' +
        "</div>";

      var collapsed = root.querySelector(".bigpix-vip-collapsed");
      collapsed.addEventListener("click", openPwa);
      collapsed.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPwa();
        }
      });
    }

    if (isStandalone()) {
      root.innerHTML = "";
      return;
    }

    if (getSavedState() === "collapsed") {
      renderCollapsed();
    } else {
      renderExpanded();
    }
  })();
</script>
<!-- ================================================== -->
```

---

## 5. Campos editáveis

No topo do `<script>`, o administrador pode ajustar:

```js
var PWA_URL = "https://pwa.app-bigpix.com";
var LOGO_URL = "https://pwa.app-bigpix.com/icons/icon-192.svg";
var BRAND_NAME = "BigPix";
var COLLAPSE_AFTER_MS = 7000;
```

| Campo | Quando alterar |
|---|---|
| `PWA_URL` | Quando o domínio do PWA mudar |
| `LOGO_URL` | O valor atual usa um fallback temporário (`https://pwa.app-bigpix.com/icons/icon-192.svg`). Trocar pela URL oficial do logo BigPix quando disponível |
| `BRAND_NAME` | Quando precisar ajustar o texto alternativo do logo |
| `COLLAPSE_AFTER_MS` | Para mudar o tempo antes de recolher automaticamente |

Para o BigPix, a cor do CTA deve permanecer:

```text
#006DFF
```

---

## 6. Regras de comportamento

- O banner maior aparece inicialmente.
- Após alguns segundos sem interação, ele recolhe para uma faixa mínima no topo.
- Clicar no `×` ou em `Depois` recolhe para a faixa mínima.
- A faixa mínima continua visível, discreta e clicável.
- Clicar em `Instalar app`, `Instalar` ou na própria faixa abre `https://pwa.app-bigpix.com`.
- O banner não pede permissão de notificações.
- O banner não carrega OneSignal.
- O banner não copia Service Worker.
- O banner não copia manifest.
- O banner tenta não aparecer se detectar que a página está em modo standalone.

Limitação importante: em site externo, nem sempre é possível saber com certeza se o PWA já está instalado. A detecção de `display-mode: standalone` funciona quando aquela página está rodando em modo app instalado, mas não cobre todos os cenários.

Por isso, este snippet não grava uma flag de "instalado". Caso o site principal tenha uma integração própria que saiba quando o app foi instalado, a equipe pode adicionar uma regra específica. Sem essa integração, o comportamento seguro é apenas redirecionar para o PWA.

---

## 7. Validação após aplicação

Após aplicar o snippet no site principal, avise a equipe responsável para validação em mobile antes da publicação final.

---

## 8. Cuidados obrigatórios

- Não inserir este banner dentro do admin.
- Não pedir ativação de notificações neste banner.
- Não prometer bônus, promoções ou vantagens se a operação não for cumprir essa comunicação.
- Não usar logo errado.
- O `LOGO_URL` atual aponta para um fallback temporário do PWA; trocar pela URL oficial do logo BigPix quando disponível.
- Não copiar este snippet para outros tenants sem trocar URL, logo e nome.
- Não copiar `sw.js` para o site principal.
- Não copiar `manifest.webmanifest` para o site principal.
- Não configurar OneSignal no site principal por causa deste banner.
- Não usar `iframe` para embutir o PWA.
- Não alterar login, autenticação ou fluxo da plataforma principal para instalar este banner.
- Não deixar o banner cobrir menu, header fixo, botões de login ou avisos importantes do site principal.

---

## 9. Futuro: adaptação para outros tenants

Esta primeira versão é focada no BigPix.

Para adaptar para outro tenant no futuro:

1. Trocar `PWA_URL` para o domínio correto do PWA.
2. Trocar `LOGO_URL` para o logo correto daquele tenant.
3. Trocar `BRAND_NAME` se necessário.
4. Ajustar textos somente se a marca pedir, mantendo a promessa real da operação.
5. Manter o CTA `#006DFF`, salvo decisão de produto diferente.
6. Não usar logo BigPix nos demais tenants.
7. Não reaproveitar o fallback `https://pwa.app-bigpix.com/icons/icon-192.svg` em outros tenants sem conferir o branding.
8. Respeitar o branding de cada tenant.

Quando o banner for implementado dentro do PWA, o logo deve vir da configuração do painel nesta ordem:

1. `settings.logoUrl`
2. fallback `settings.icon192Url`
3. fallback `/icons/icon-192.svg`

No snippet externo acima, como o site principal normalmente não tem acesso dinâmico ao `settings`, o administrador deve trocar manualmente o valor de `LOGO_URL`. O valor inicial `https://pwa.app-bigpix.com/icons/icon-192.svg` é apenas um fallback temporário; quando a URL oficial do logo BigPix estiver disponível, ela deve substituir esse fallback.
