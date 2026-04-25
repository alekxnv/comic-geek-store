// ================================================
//   COMIC GEEK STORE — CONFIGURAÇÃO DAS APIs
//   Substitua os valores XXXX pelos seus dados reais
// ================================================

window.CGS_CONFIG = {

  // --------------------------------------------------
  // GOOGLE ANALYTICS GA4
  // Como obter: analytics.google.com → Criar conta → Fluxo de dados → ID de medição
  // Formato: G-XXXXXXXXXX
  // --------------------------------------------------
  googleAnalyticsId: "G-L5HRMRN5DG",

  // --------------------------------------------------
  // MICROSOFT CLARITY (heatmaps + gravação de sessão — GRÁTIS)
  // Como obter: clarity.microsoft.com → Novo Projeto → ID do Projeto
  // Formato: string de 10 caracteres
  // --------------------------------------------------
  clarityId: "wd8zq37szz",

  // --------------------------------------------------
  // FACEBOOK PIXEL (rastreamento de anúncios)
  // Como obter: business.facebook.com → Gerenciador de Eventos → Pixels → ID do Pixel
  // Formato: número de 15-16 dígitos
  // --------------------------------------------------
  facebookPixelId: "966532092558414",

  // --------------------------------------------------
  // WHATSAPP BUSINESS
  // Número com código do país, sem + ou espaços
  // Exemplo: 5541999999999 (55 = Brasil, 41 = Curitiba)
  // --------------------------------------------------
  whatsappNumero: "5541999999999",
  whatsappMensagem: "Olá! Vim pelo site da Comic Geek Store e preciso de ajuda.",

  // --------------------------------------------------
  // EMAILJS (envio de e-mails sem backend — GRÁTIS até 200/mês)
  // Como obter: emailjs.com → Criar conta → Email Services → Account → Public Key
  // --------------------------------------------------
  emailjsPublicKey:   "x4buxmvZZJYw4gkv4",
  emailjsServiceId:   "service_9clvgis",
  emailjsTemplateConfirmacao: "template_gcu8cs7",

  // --------------------------------------------------
  // MARVEL API (capas e dados reais dos quadrinhos)
  // Como obter: developer.marvel.com → Criar conta → Meus Aplicativos → Chave Pública
  // Lembre de adicionar o domínio do site nas "Authorized Referrers"
  // --------------------------------------------------
  marvelPublicKey: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",

  // --------------------------------------------------
  // MERCADO PAGO (pagamentos reais com cartão, Pix e boleto)
  // Como obter: mercadopago.com.br → Seu negócio → Credenciais → Chave pública
  // Formato: APP_USR-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
  // --------------------------------------------------
  mercadoPagoPublicKey: "APP_USR-477804dc-75f6-44d7-af86-a8a4e0577882",

  // --------------------------------------------------
  // URL DO BACKEND (preencha após hospedar o servidor)
  // Exemplo Railway: https://comic-geek-store.up.railway.app
  // --------------------------------------------------
  backendUrl: "https://comic-geek-store-production.up.railway.app",

  // --------------------------------------------------
  // ONESIGNAL (notificações push no navegador — GRÁTIS até 10k assinantes)
  // Como obter: onesignal.com → Novo App → Web → App ID
  // Formato: UUID (ex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  // --------------------------------------------------
  oneSignalAppId: "6866e2e9-57ed-4ed6-9563-02656eb75abb",

  // --------------------------------------------------
  // TIDIO (chat ao vivo no site — GRÁTIS)
  // Como obter: tidio.com → Criar conta → Settings → Developer → Public Key
  // --------------------------------------------------
  tidioKey: "xxlnp3hajb2wobhymixm50b9udgibbnc",

};
