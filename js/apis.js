// ================================================
//   COMIC GEEK STORE — INTEGRAÇÕES DE APIs
// ================================================

// =========================
// GOOGLE ANALYTICS GA4
// =========================
(function () {
  if (!window.CGS_CONFIG) return;
  const id = CGS_CONFIG.googleAnalyticsId;
  if (!id || id.includes("X")) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", id);

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
  document.head.appendChild(s);
})();

// =========================
// MICROSOFT CLARITY
// =========================
(function () {
  if (!window.CGS_CONFIG) return;
  const id = CGS_CONFIG.clarityId;
  if (!id || id.includes("X")) return;

  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
})();

// =========================
// FACEBOOK PIXEL
// =========================
(function () {
  if (!window.CGS_CONFIG) return;
  const id = CGS_CONFIG.facebookPixelId;
  if (!id || id.includes("X")) return;

  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
    n.queue = []; t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  fbq("init", id);
  fbq("track", "PageView");
})();


// =========================
// EMAILJS — CARREGAR SDK
// =========================
(function () {
  if (!window.CGS_CONFIG) return;
  const key = CGS_CONFIG.emailjsPublicKey;
  if (!key || key.includes("X")) return;

  // Fila para envios que chegam antes do SDK carregar
  window._emailjsFila = [];

  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
  s.onload = function () {
    emailjs.init({ publicKey: key });
    window._emailjsPronto = true;
    // Processa fila de e-mails pendentes
    window._emailjsFila.forEach(function (dados) { _enviarEmail(dados); });
    window._emailjsFila = [];
  };
  document.head.appendChild(s);
})();

function _enviarEmail(dadosPedido) {
  if (!window.CGS_CONFIG) return;
  const { emailjsServiceId, emailjsTemplateConfirmacao } = CGS_CONFIG;
  if (!emailjsServiceId || emailjsServiceId.includes("X")) return;
  emailjs.send(emailjsServiceId, emailjsTemplateConfirmacao, {
    cliente_nome:  dadosPedido.nome,
    cliente_email: dadosPedido.email,
    pedido_numero: dadosPedido.numero,
    pedido_itens:  dadosPedido.itens,
    pedido_total:  dadosPedido.total,
    pedido_metodo: dadosPedido.metodoPagamento,
  }).catch(function () {});
}

// Envia e-mail de confirmação — usa fila se SDK ainda não carregou
window.enviarEmailConfirmacao = function (dadosPedido) {
  if (window._emailjsPronto) {
    _enviarEmail(dadosPedido);
  } else if (window._emailjsFila) {
    window._emailjsFila.push(dadosPedido);
  }
};

// =========================
// MARVEL API
// =========================
window.MarvelAPI = (function () {
  function buscar(query, callback) {
    if (!window.CGS_CONFIG) return;
    const key = CGS_CONFIG.marvelPublicKey;
    if (!key || key.includes("X")) return;

    const url =
      "https://gateway.marvel.com/v1/public/comics" +
      "?titleStartsWith=" + encodeURIComponent(query) +
      "&apikey=" + key +
      "&limit=6&orderBy=-onsaleDate&noVariants=true";

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.data && data.data.results) callback(data.data.results);
      })
      .catch(function () {});
  }

  function rastrearVisualizacao(nome, preco) {
    if (window.fbq) fbq("track", "ViewContent", { content_name: nome, value: preco, currency: "BRL" });
  }

  function rastrearCarrinho(nome, preco) {
    if (window.fbq) fbq("track", "AddToCart", { content_name: nome, value: preco, currency: "BRL" });
    if (window.gtag) gtag("event", "add_to_cart", { currency: "BRL", value: preco, items: [{ item_name: nome, price: preco }] });
  }

  function rastrearCompra(total, itens) {
    if (window.fbq) fbq("track", "Purchase", { value: total, currency: "BRL" });
    if (window.gtag) gtag("event", "purchase", { currency: "BRL", value: total, items: itens.map(function (i) {
      return { item_name: i.nome, price: i.preco, quantity: i.qtd };
    })});
    if (window.clarity) clarity("set", "compra", "finalizada");
  }

  return { buscar, rastrearVisualizacao, rastrearCarrinho, rastrearCompra };
})();

// =========================
// MERCADO PAGO
// =========================
(function () {
  if (!window.CGS_CONFIG) return;
  const key = CGS_CONFIG.mercadoPagoPublicKey;
  if (!key || key.includes("X")) return;

  const s = document.createElement("script");
  s.src = "https://sdk.mercadopago.com/js/v2";
  s.onload = function () {
    window._mp = new MercadoPago(key, { locale: "pt-BR" });
    window._mpPronto = true;
  };
  document.head.appendChild(s);
})();

// =========================
// ONESIGNAL — NOTIFICAÇÕES PUSH
// =========================
(function () {
  if (!window.CGS_CONFIG) return;
  const appId = CGS_CONFIG.oneSignalAppId;
  if (!appId || appId.includes("X")) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  const s = document.createElement("script");
  s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  s.defer = true;
  document.head.appendChild(s);

  window.OneSignalDeferred.push(function (OneSignal) {
    OneSignal.init({
      appId: appId,
      notifyButton: { enable: true },
      promptOptions: {
        slidedown: {
          prompts: [{
            type: "push",
            autoPrompt: true,
            text: {
              actionMessage: "Receba novidades e lançamentos da Comic Geek Store!",
              acceptButton: "Sim, quero!",
              cancelButton: "Agora não"
            },
            delay: { pageViews: 2, timeDelay: 10 }
          }]
        }
      }
    });
  });
})();

// =========================
// TIDIO — CHAT AO VIVO
// =========================
(function () {
  if (!window.CGS_CONFIG) return;
  const key = CGS_CONFIG.tidioKey;
  if (!key || key.includes("X")) return;

  const s = document.createElement("script");
  s.src = "//code.tidio.co/" + key + ".js";
  s.async = true;
  document.body.appendChild(s);
})();
