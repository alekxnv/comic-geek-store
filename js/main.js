// =========================
// BACKEND API HELPER
// =========================
function _backendUrl() {
  const u = window.CGS_CONFIG && window.CGS_CONFIG.backendUrl;
  return u && !u.includes("XXXX") ? u : null;
}

function api(endpoint, method, body) {
  const base = _backendUrl();
  if (!base) return Promise.resolve(null);
  const token = localStorage.getItem("cgs_token");
  const opts = { method: method || "GET", headers: { "Content-Type": "application/json" } };
  if (token) opts.headers["Authorization"] = "Bearer " + token;
  if (body) opts.body = JSON.stringify(body);
  return fetch(base + endpoint, opts)
    .then(r => r.json())
    .catch(() => null);
}

function _salvarSessao(token, usuario) {
  if (token) localStorage.setItem("cgs_token", token);
  // Usa login como nome exibido se disponível
  const u = { ...usuario };
  if (u.login && !u.nomeExibido) u.nomeExibido = u.login;
  localStorage.setItem("usuarioLogado", JSON.stringify(u));
}

// =========================
// SEGURANÇA — SANITIZAÇÃO XSS
// =========================
function sanitizar(str) {
  if (typeof str !== "string") return String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// =========================
// SEGURANÇA — HASH SHA-256
// =========================
async function hashSenha(senha) {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha + "cgs@salt#2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// =========================
// SEGURANÇA — LIMITE DE TENTATIVAS
// =========================
function verificarTentativas(chave) {
  const dados = JSON.parse(localStorage.getItem(chave)) || { tentativas: 0, bloqueadoAte: 0 };
  if (Date.now() < dados.bloqueadoAte) {
    const seg = Math.ceil((dados.bloqueadoAte - Date.now()) / 1000);
    return { bloqueado: true, mensagem: `Muitas tentativas. Tente novamente em ${seg}s.` };
  }
  return { bloqueado: false, dados };
}

function registrarTentativaFalha(chave) {
  const dados = JSON.parse(localStorage.getItem(chave)) || { tentativas: 0, bloqueadoAte: 0 };
  dados.tentativas += 1;
  if (dados.tentativas >= 5) {
    dados.bloqueadoAte = Date.now() + 60000; // bloqueia 60s
    dados.tentativas = 0;
  }
  localStorage.setItem(chave, JSON.stringify(dados));
}

function limparTentativas(chave) {
  localStorage.removeItem(chave);
}

// =========================
// MENSAGENS
// =========================
function mostrarMensagem(texto, tipo = "sucesso") {
  const mensagem = document.createElement("div");
  mensagem.classList.add("mensagem");
  mensagem.classList.add(tipo === "erro" ? "mensagem-erro" : "mensagem-sucesso");
  mensagem.textContent = texto;
  document.body.appendChild(mensagem);
  setTimeout(() => {
    mensagem.classList.add("sumir");
    setTimeout(() => mensagem.remove(), 300);
  }, 3000);
}

// =========================
// VALIDAÇÕES DE FORMULÁRIO
// =========================
function validarCampo(input, regra, mensagem) {
  let erroEl = input.parentElement.querySelector(".campo-erro");
  if (!erroEl) {
    erroEl = document.createElement("span");
    erroEl.className = "campo-erro";
    input.parentElement.appendChild(erroEl);
  }
  const ok = regra(input.value);
  input.classList.toggle("input-erro", !ok);
  input.classList.toggle("input-ok", ok);
  erroEl.textContent = ok ? "" : mensagem;
  return ok;
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_CPF   = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
const REGEX_CNPJ  = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;

function validarSenhaForca(senha) {
  const erros = [];
  if (senha.length < 8) erros.push("mínimo 8 caracteres");
  if (!/[A-Z]/.test(senha)) erros.push("uma letra maiúscula");
  if (!/[0-9]/.test(senha)) erros.push("um número");
  return erros;
}

function ativarValidacaoTempoReal(form) {
  if (!form) return;
  form.querySelectorAll("input").forEach(input => {
    input.addEventListener("blur", () => {
      // só valida no blur se o usuário já digitou algo ou o campo já foi marcado com erro
      if (input.value.trim() !== "" || input.classList.contains("input-erro")) {
        validarInputPorTipo(input);
      }
    });
    input.addEventListener("input", () => {
      if (input.classList.contains("input-erro")) validarInputPorTipo(input);
    });
  });
}

function validarInputPorTipo(input) {
  const tipo = input.type;
  const nome = input.name || input.id;
  if (!input.value && !input.required) return true;
  if (!input.value && input.required) {
    return validarCampo(input, v => v.trim() !== "", "Campo obrigatório");
  }
  if (tipo === "email") return validarCampo(input, v => REGEX_EMAIL.test(v), "E-mail inválido");
  if (tipo === "password" && nome !== "confirmar-senha") {
    const formId = input.closest("form")?.id;
    if (formId === "form-cadastro") {
      const erros = validarSenhaForca(input.value);
      return validarCampo(input, () => erros.length === 0, erros.length ? "A senha precisa ter: " + erros.join(", ") : "");
    }
    return true;
  }
  if (nome === "confirmar-senha" || nome === "confirmarSenha") {
    const senhaEl = document.getElementById("senha") || document.getElementById("nova-senha");
    return validarCampo(input, v => senhaEl && v === senhaEl.value, "As senhas não coincidem");
  }
  if (nome === "login-usuario") return validarCampo(input, v => /^[a-zA-Z0-9_\-]{3,30}$/.test(v), "3-30 caracteres: letras, números, _ ou -");
  if (nome === "cpf") return validarCampo(input, v => REGEX_CPF.test(v), "CPF inválido (000.000.000-00)");
  if (nome === "cnpj") return validarCampo(input, v => REGEX_CNPJ.test(v), "CNPJ inválido");
  if (nome === "telefone" || nome === "celular") return validarCampo(input, v => v.replace(/\D/g,"").length >= 10, "Telefone inválido");
  if (tipo === "text" || tipo === "tel") return validarCampo(input, v => v.trim().length >= 2, "Mínimo 2 caracteres");
  return true;
}

function validarFormCompleto(form) {
  let valido = true;
  form.querySelectorAll("input[required], input[type='email'], input[type='password']").forEach(input => {
    if (input.offsetParent === null) return; // ignora campos ocultos
    if (!validarInputPorTipo(input)) valido = false;
  });
  return valido;
}

// =========================
// LOGOUT
// =========================
function logout() {
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("cgs_token");
  window.location.href = "/login";
}

// =========================
// MODAL PERFIL
// =========================

// =========================
// BARRA DE ADMIN (topo da página)
// =========================
function injetarBarraAdmin(usuario) {
  if (document.getElementById("admin-topbar")) return;
  if (window.location.pathname.includes("/admin")) return;

  const bar = document.createElement("div");
  bar.id = "admin-topbar";
  const base = window.location.pathname.includes("/pages/") ? "" : "pages/";
  bar.innerHTML = `
    <span class="admin-topbar__info">⚙ Você está navegando como <strong>Admin</strong></span>
    <div class="admin-topbar__acoes">
      <a href="/admin" class="admin-topbar__btn">⚙ Voltar ao Painel</a>
      <button class="admin-topbar__sair" onclick="logout()">Sair</button>
    </div>`;
  document.body.insertBefore(bar, document.body.firstChild);
  document.body.classList.add("tem-admin-topbar");
}

// =========================
// HEADER — ESTADO DO USUÁRIO
// =========================
function inicializarHeader() {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const liLogout = document.getElementById("li-logout");
  const liVender = document.getElementById("li-vender");
  const perfilNome = document.getElementById("perfil-nome");
  const linkPerfil = document.getElementById("link-perfil");

  if (usuarioLogado) {
    const nomeParaExibir = usuarioLogado.nomeExibido || usuarioLogado.login || usuarioLogado.nome.split(" ")[0];
    if (perfilNome) perfilNome.textContent = nomeParaExibir;
    if (linkPerfil) {
      linkPerfil.href = "/perfil";
    }
    if (liLogout) liLogout.style.display = "inline-block";

    // Mostrar "Minha Loja" para PJ aprovada (usa status do localStorage, atualizado no vender.html)
    if (liVender && usuarioLogado.tipo === "juridica" && usuarioLogado.status === "aprovado") {
      liVender.style.display = "inline-block";
      document.querySelector("header")?.classList.add("header--pj");
    }
  }

  // Mostrar botão Admin se usuário logado for admin + barra no topo
  const liAdmin = document.getElementById("li-admin");
  if (usuarioLogado && usuarioLogado.tipo === "admin") {
    // Topbar já tem "Voltar ao Painel" e "Sair" — oculta duplicatas no header
    if (liAdmin) liAdmin.style.display = "none";
    if (liLogout) liLogout.style.display = "none";
    injetarBarraAdmin(usuarioLogado);
  }

  // Fallback: header antigo (páginas sem id="perfil-nome")
  if (!perfilNome && usuarioLogado) {
    const perfil = document.querySelector(".header-icone-perfil");
    if (perfil) {
      const nomeEl = perfil.parentElement.querySelector("h3");
      if (nomeEl) nomeEl.textContent = usuarioLogado.nomeExibido || usuarioLogado.login || usuarioLogado.nome.split(" ")[0];
    }
  }
}

// =========================
// CARRINHO — BADGE
// =========================
function atualizarBadgeCarrinho() {
  const badge = document.getElementById("carrinho-badge");
  if (!badge) return;
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const total = carrinho.reduce((sum, item) => sum + item.qtd, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? "flex" : "none";
}

// =========================
// CARRINHO — ADICIONAR
// =========================
function adicionarAoCarrinho(nome, preco, img, qtd = 1, precoOriginal = null) {
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const idx = carrinho.findIndex((item) => item.nome === nome);
  if (idx >= 0) {
    carrinho[idx].qtd += qtd;
  } else {
    const item = { nome, preco: parseFloat(preco), img, qtd };
    if (precoOriginal && parseFloat(precoOriginal) > parseFloat(preco)) {
      item.precoOriginal = parseFloat(precoOriginal);
    }
    carrinho.push(item);
  }
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
  atualizarBadgeCarrinho();
  const nomeResumido = nome.length > 35 ? nome.substring(0, 35) + "..." : nome;
  const sufixo = qtd > 1 ? ` (${qtd}x)` : "";
  mostrarMensagem(`"${nomeResumido}"${sufixo} adicionado ao carrinho!`);
  if (window.MarvelAPI) MarvelAPI.rastrearCarrinho(nome, parseFloat(preco));
  // Salva carrinho no backend para lembrete de abandono
  if (_backendUrl() && localStorage.getItem("cgs_token")) {
    api("/api/carrinho/salvar", "POST", { itens: carrinho }).catch(() => {});
  }
}

// =========================
// CARRINHO — PÁGINA
// =========================
function renderizarCarrinho() {
  const container = document.getElementById("carrinho-lista");
  const resumo = document.getElementById("carrinho-resumo");
  if (!container) return;

  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

  if (carrinho.length === 0) {
    container.innerHTML = `
      <div class="carrinho-vazio">
        <h2>Seu carrinho está vazio</h2>
        <p>Que tal explorar nossos quadrinhos?</p>
        <a href="/" class="btn-continuar">Continuar Comprando</a>
      </div>`;
    if (resumo) resumo.style.display = "none";
    return;
  }

  container.innerHTML = carrinho
    .map((item, idx) => {
      const temDesconto = item.precoOriginal && item.precoOriginal > item.preco;
      const pct = temDesconto ? Math.round((1 - item.preco / item.precoOriginal) * 100) : 0;
      const precoHtml = temDesconto
        ? `<span class="carrinho-item__preco-orig">R$ ${item.precoOriginal.toFixed(2).replace(".", ",")}</span>
           <span class="carrinho-item__preco carrinho-item__preco--desconto">R$ ${item.preco.toFixed(2).replace(".", ",")} <span class="carrinho-item__badge-desc">-${pct}%</span></span>`
        : `<span class="carrinho-item__preco">R$ ${item.preco.toFixed(2).replace(".", ",")}</span>`;
      return `
    <div class="carrinho-item${temDesconto ? " carrinho-item--desconto" : ""}">
      <img src="../${sanitizar(item.img)}" alt="${sanitizar(item.nome)}" class="carrinho-item__img">
      <div class="carrinho-item__info">
        <h3>${sanitizar(item.nome)}</h3>
        ${precoHtml}
      </div>
      <div class="carrinho-item__qtd">
        <button class="btn-qtd" onclick="alterarQtd(${idx}, -1)">−</button>
        <span>${item.qtd}</span>
        <button class="btn-qtd" onclick="alterarQtd(${idx}, 1)">+</button>
      </div>
      <span class="carrinho-item__subtotal">R$ ${(item.preco * item.qtd).toFixed(2).replace(".", ",")}</span>
      <button class="carrinho-item__remover" onclick="removerItem(${idx})" title="Remover">✕</button>
    </div>`;
    })
    .join("");

  if (resumo) resumo.style.display = "block";
  atualizarTotalComDesconto();
}

function alterarQtd(idx, delta) {
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  carrinho[idx].qtd += delta;
  if (carrinho[idx].qtd <= 0) carrinho.splice(idx, 1);
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
  atualizarBadgeCarrinho();
  renderizarCarrinho();
}

function removerItem(idx) {
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  carrinho.splice(idx, 1);
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
  atualizarBadgeCarrinho();
  renderizarCarrinho();
}

// =========================
// CUPONS
// =========================
const CUPONS = {
  "GEEK10": 10,
  "GEEK20": 20,
  "COMIC20": 20,
  "HEROI15": 15,
  "MARVEL5": 5,
};

let descontoAtivo = 0;

function aplicarCupom() {
  const input = document.getElementById("cupom-input");
  const msg = document.getElementById("cupom-msg");
  if (!input || !msg) return;

  const codigo = input.value.trim().toUpperCase();
  const percentual = CUPONS[codigo];

  if (!codigo) {
    msg.textContent = "Digite um cupom.";
    msg.className = "cupom-msg erro";
    return;
  }

  // Bloqueia cupom se algum item do carrinho já tem desconto
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const temItemComDesconto = carrinho.some(item => item.precoOriginal && item.precoOriginal > item.preco);
  if (temItemComDesconto) {
    msg.textContent = "Cupons não são válidos para itens já em promoção.";
    msg.className = "cupom-msg erro";
    return;
  }

  if (!percentual) {
    msg.textContent = "Cupom inválido ou expirado.";
    msg.className = "cupom-msg erro";
    descontoAtivo = 0;
    atualizarTotalComDesconto();
    return;
  }

  descontoAtivo = percentual;
  msg.textContent = `Cupom aplicado! ${percentual}% de desconto.`;
  msg.className = "cupom-msg sucesso";
  input.disabled = true;
  atualizarTotalComDesconto();
}

// =========================
// CEP — AUTO PREENCHIMENTO
// =========================
function buscarCepAutoFill(cep, campos, msgId) {
  const msg = document.getElementById(msgId);
  if (msg) { msg.textContent = "Buscando endereço..."; msg.style.color = "#888"; }

  fetch(`https://viacep.com.br/ws/${cep}/json/`)
    .then(r => r.json())
    .then(data => {
      if (data.erro) {
        if (msg) { msg.textContent = "CEP não encontrado."; msg.style.color = "#e74c3c"; }
        return;
      }
      const setField = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };
      setField(campos.rua,    data.logradouro || "");
      setField(campos.bairro, data.bairro     || "");
      setField(campos.cidade, data.localidade || "");
      setField(campos.estado, data.uf         || "");
      if (msg) {
        msg.textContent = `📍 ${data.localidade} — ${data.uf}`;
        msg.style.color = "#27ae60";
      }
    })
    .catch(() => {
      if (msg) { msg.textContent = "Erro ao buscar o CEP."; msg.style.color = "#e74c3c"; }
    });
}

// =========================
// FRETE
// =========================
let freteValor = 0;
let cepValidado = false;

function calcularFrete() {
  const input = document.getElementById("frete-cep");
  const msg   = document.getElementById("frete-msg");
  const opcoes = document.getElementById("frete-opcoes");
  if (!input) return;

  const cep = input.value.replace(/\D/g, "");
  if (cep.length !== 8) {
    msg.textContent = "CEP inválido. Digite 8 números.";
    msg.style.color = "#e74c3c";
    cepValidado = false;
    return;
  }

  msg.textContent = "Consultando CEP...";
  msg.style.color = "#888";
  opcoes.style.display = "none";

  fetch(`https://viacep.com.br/ws/${cep}/json/`)
    .then(r => r.json())
    .then(data => {
      if (data.erro) {
        msg.textContent = "CEP não encontrado. Verifique e tente novamente.";
        msg.style.color = "#e74c3c";
        cepValidado = false;
        return;
      }

      // Formata CEP no input
      input.value = cep.replace(/(\d{5})(\d{3})/, "$1-$2");

      // Calcula frete baseado na UF
      const uf = data.uf;
      const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
      const pesoTotal = carrinho.reduce((sum, item) => sum + item.qtd, 0);

      const { pac, sedex } = calcularValoresFrete(uf, pesoTotal);

      document.getElementById("frete-pac-preco").textContent  = pac.preco === 0 ? "GRÁTIS" : `R$ ${pac.preco.toFixed(2).replace(".", ",")}`;
      document.getElementById("frete-pac-prazo").textContent  = `${pac.prazo} dias úteis`;
      document.getElementById("frete-sedex-preco").textContent = `R$ ${sedex.preco.toFixed(2).replace(".", ",")}`;
      document.getElementById("frete-sedex-prazo").textContent = `${sedex.prazo} dias úteis`;

      msg.textContent = `📍 ${data.localidade} — ${uf}`;
      msg.style.color = "#27ae60";
      opcoes.style.display = "flex";
      cepValidado = true;

      // Listeners nas opções
      document.querySelectorAll('input[name="frete"]').forEach(radio => {
        radio.onchange = function() {
          freteValor = this.value === "pac" ? pac.preco : sedex.preco;
          document.getElementById("frete-valor").textContent = freteValor === 0 ? "GRÁTIS" : `R$ ${freteValor.toFixed(2).replace(".", ",")}`;
          document.getElementById("linha-frete").style.display = "flex";
          atualizarTotalComDesconto();
        };
      });
    })
    .catch(() => {
      msg.textContent = "Erro ao consultar o CEP. Tente novamente.";
      msg.style.color = "#e74c3c";
    });
}

const FRETE_GRATIS_MINIMO = 200;

function calcularValoresFrete(uf, qtdItens) {
  // Frete grátis para compras acima de R$ 200
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const subtotal = carrinho.reduce((sum, item) => sum + item.preco * item.qtd, 0);
  if (subtotal >= FRETE_GRATIS_MINIMO) {
    return {
      pac:   { preco: 0, prazo: calcularPrazoPac(uf) },
      sedex: { preco: 0, prazo: calcularPrazoSedex(uf) }
    };
  }

  // Regiões Sul/Sudeste: frete mais barato e rápido
  const sudeste  = ["SP", "RJ", "MG", "ES"];
  const sul      = ["PR", "SC", "RS"];
  const co       = ["GO", "MT", "MS", "DF"];
  const norte    = ["AM", "PA", "AC", "RO", "RR", "AP", "TO"];
  const nordeste = ["BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI", "MA"];

  const base = 1 + (qtdItens - 1) * 0.5;

  let pac, sedex;

  if (sudeste.includes(uf)) {
    pac   = { preco: base <= 1 ? 0 : parseFloat((base * 4.5).toFixed(2)), prazo: 5 };
    sedex = { preco: parseFloat((base * 14).toFixed(2)), prazo: 1 };
  } else if (sul.includes(uf)) {
    pac   = { preco: parseFloat((base * 6).toFixed(2)), prazo: 6 };
    sedex = { preco: parseFloat((base * 18).toFixed(2)), prazo: 2 };
  } else if (co.includes(uf)) {
    pac   = { preco: parseFloat((base * 8).toFixed(2)), prazo: 8 };
    sedex = { preco: parseFloat((base * 22).toFixed(2)), prazo: 2 };
  } else if (nordeste.includes(uf)) {
    pac   = { preco: parseFloat((base * 10).toFixed(2)), prazo: 10 };
    sedex = { preco: parseFloat((base * 26).toFixed(2)), prazo: 3 };
  } else if (norte.includes(uf)) {
    pac   = { preco: parseFloat((base * 13).toFixed(2)), prazo: 14 };
    sedex = { preco: parseFloat((base * 32).toFixed(2)), prazo: 4 };
  } else {
    pac   = { preco: parseFloat((base * 8).toFixed(2)), prazo: 9 };
    sedex = { preco: parseFloat((base * 22).toFixed(2)), prazo: 3 };
  }

  return { pac, sedex };
}

function calcularPrazoPac(uf) {
  const prazoMap = { SP:5,RJ:5,MG:5,ES:5, PR:6,SC:6,RS:6, GO:8,MT:8,MS:8,DF:8, BA:10,SE:10,AL:10,PE:10,PB:10,RN:10,CE:10,PI:10,MA:10, AM:14,PA:14,AC:14,RO:14,RR:14,AP:14,TO:14 };
  return prazoMap[uf] || 9;
}

function calcularPrazoSedex(uf) {
  const prazoMap = { SP:1,RJ:1,MG:1,ES:1, PR:2,SC:2,RS:2, GO:2,MT:2,MS:2,DF:2, BA:3,SE:3,AL:3,PE:3,PB:3,RN:3,CE:3,PI:3,MA:3, AM:4,PA:4,AC:4,RO:4,RR:4,AP:4,TO:4 };
  return prazoMap[uf] || 3;
}

// Formata CEP enquanto digita
// =========================
// RETORNO DO MERCADOPAGO
// =========================
(function () {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const pedido = params.get("pedido");
  if (!status) return;

  const configs = {
    aprovado: {
      icon: "✅",
      titulo: "Pagamento aprovado!",
      msg: pedido ? `Seu pedido <strong>#${pedido}</strong> foi confirmado. Você receberá um e-mail de confirmação.` : "Seu pagamento foi aprovado com sucesso!",
      cor: "#27ae60",
      bg: "#eafaf1",
      border: "#27ae60",
    },
    pendente: {
      icon: "⏳",
      titulo: "Pagamento em análise",
      msg: pedido ? `Seu pedido <strong>#${pedido}</strong> está sendo processado. Você será notificado quando for aprovado.` : "Seu pagamento está em processamento.",
      cor: "#f39c12",
      bg: "#fef9e7",
      border: "#f39c12",
    },
    erro: {
      icon: "❌",
      titulo: "Pagamento não concluído",
      msg: "Houve um problema com seu pagamento. Tente novamente ou escolha outra forma de pagamento.",
      cor: "#e74c3c",
      bg: "#fdf2f2",
      border: "#e74c3c",
    },
  };

  const cfg = configs[status];
  if (!cfg) return;

  // Limpa carrinho se aprovado
  if (status === "aprovado") {
    localStorage.removeItem("carrinho");
    atualizarBadgeCarrinho();
  }

  // Cria banner no topo da página
  const banner = document.createElement("div");
  banner.style.cssText = `
    position:fixed; top:0; left:0; right:0; z-index:9999;
    background:${cfg.bg}; border-bottom:3px solid ${cfg.border};
    padding:16px 24px; display:flex; align-items:center; gap:14px;
    box-shadow:0 2px 12px rgba(0,0,0,0.1); animation: slideDown .4s ease;
  `;
  banner.innerHTML = `
    <span style="font-size:28px">${cfg.icon}</span>
    <div style="flex:1">
      <strong style="color:${cfg.cor};font-size:16px;display:block">${cfg.titulo}</strong>
      <span style="color:#555;font-size:14px">${cfg.msg}</span>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#999">✕</button>
  `;
  document.body.prepend(banner);
  document.body.style.paddingTop = "80px";

  // Remove da URL sem recarregar
  const url = new URL(window.location);
  url.searchParams.delete("status");
  url.searchParams.delete("pedido");
  window.history.replaceState({}, "", url);

  // Auto-remove após 10s se aprovado
  if (status === "aprovado") setTimeout(() => banner.remove(), 10000);
})();

document.addEventListener("DOMContentLoaded", () => {
  // --- CEP no carrinho (frete) ---
  const cepInput = document.getElementById("frete-cep");
  if (cepInput) {
    const u = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (u) {
      const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
      const dados = usuarios.find(x => x.email === u.email);
      if (dados?.endereco?.cep) {
        cepInput.value = dados.endereco.cep;
        // Calcula frete automaticamente com o CEP salvo
        calcularFrete();
      }
    }
    cepInput.addEventListener("input", function() {
      let v = this.value.replace(/\D/g, "").slice(0, 8);
      if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
      this.value = v;
    });
    cepInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); calcularFrete(); }
    });
  }

  // --- CEP no cadastro ---
  const cepCadastro = document.getElementById("cep");
  if (cepCadastro) {
    cepCadastro.addEventListener("input", function() {
      let v = this.value.replace(/\D/g, "").slice(0, 8);
      if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
      this.value = v;
      if (v.replace(/\D/g, "").length === 8) {
        buscarCepAutoFill(v.replace(/\D/g, ""), {
          rua: "rua", bairro: "bairro", cidade: "cidade", estado: "estado"
        }, "cep-msg");
      } else {
        const msg = document.getElementById("cep-msg");
        if (msg) msg.textContent = "";
      }
    });
  }

  // --- CEP no cadastro PJ ---
  const cepCadastroPJ = document.getElementById("cep-pj");
  if (cepCadastroPJ) {
    cepCadastroPJ.addEventListener("input", function() {
      let v = this.value.replace(/\D/g, "").slice(0, 8);
      if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
      this.value = v;
      if (v.replace(/\D/g, "").length === 8) {
        buscarCepAutoFill(v.replace(/\D/g, ""), {
          rua: "rua-pj", bairro: "bairro-pj", cidade: "cidade-pj", estado: "estado-pj"
        }, "cep-pj-msg");
      } else {
        const msg = document.getElementById("cep-pj-msg");
        if (msg) msg.textContent = "";
      }
    });
  }

  // --- CEP no perfil ---
  const cepPerfil = document.getElementById("perfil-cep");
  if (cepPerfil) {
    cepPerfil.addEventListener("input", function() {
      let v = this.value.replace(/\D/g, "").slice(0, 8);
      if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
      this.value = v;
      if (v.replace(/\D/g, "").length === 8) {
        buscarCepAutoFill(v.replace(/\D/g, ""), {
          rua: "perfil-rua", bairro: "perfil-bairro", cidade: "perfil-cidade", estado: "perfil-estado"
        }, "perfil-cep-msg");
      } else {
        const msg = document.getElementById("perfil-cep-msg");
        if (msg) msg.textContent = "";
      }
    });
  }
});

function atualizarTotalComDesconto() {
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const subtotal = carrinho.reduce((sum, item) => sum + item.preco * item.qtd, 0);
  const desconto = subtotal * (descontoAtivo / 100);

  // Frete grátis acima de R$ 200
  const freteEfetivo = subtotal >= FRETE_GRATIS_MINIMO ? 0 : freteValor;
  if (subtotal >= FRETE_GRATIS_MINIMO && freteValor > 0) {
    freteValor = 0;
    const freteEl = document.getElementById("frete-valor");
    if (freteEl) freteEl.textContent = "GRÁTIS";
    // Atualiza os preços exibidos nas opções
    const pacPreco   = document.getElementById("frete-pac-preco");
    const sedexPreco = document.getElementById("frete-sedex-preco");
    if (pacPreco)   pacPreco.textContent   = "GRÁTIS";
    if (sedexPreco) sedexPreco.textContent = "GRÁTIS";
  }

  const total = subtotal - desconto + freteEfetivo;

  const subtotalEl = document.getElementById("subtotal-valor");
  const totalEl = document.getElementById("total-valor");
  const descontoEl = document.getElementById("desconto-valor");
  const linhaDesconto = document.getElementById("linha-desconto");

  if (subtotalEl) subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace(".", ",")}`;
  if (totalEl) totalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;

  if (descontoAtivo > 0) {
    if (linhaDesconto) linhaDesconto.style.display = "flex";
    if (descontoEl) descontoEl.textContent = `- R$ ${desconto.toFixed(2).replace(".", ",")}`;
  } else {
    if (linhaDesconto) linhaDesconto.style.display = "none";
  }

  // Banners de frete grátis
  const bannerGratis    = document.getElementById("banner-frete-gratis");
  const bannerProgresso = document.getElementById("banner-frete-progresso");
  if (bannerGratis && bannerProgresso) {
    if (subtotal >= FRETE_GRATIS_MINIMO) {
      bannerGratis.style.display = "block";
      bannerProgresso.style.display = "none";
    } else {
      bannerGratis.style.display = "none";
      const faltam = FRETE_GRATIS_MINIMO - subtotal;
      bannerProgresso.style.display = "block";
      bannerProgresso.textContent = `🚚 Faltam R$ ${faltam.toFixed(2).replace(".", ",")} para frete GRÁTIS!`;
    }
  }
}

function finalizarCompra() {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) {
    mostrarMensagem("Faça login para finalizar sua compra!", "erro");
    setTimeout(() => (window.location.href = "/login"), 1500);
    return;
  }

  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  if (carrinho.length === 0) return;

  // Valida CEP e frete antes de prosseguir
  if (!cepValidado) {
    mostrarMensagem("Informe e consulte seu CEP para calcular o frete antes de finalizar.", "erro");
    const cepInput = document.getElementById("frete-cep");
    if (cepInput) { cepInput.focus(); cepInput.classList.add("input-erro"); }
    return;
  }

  const freteSelecionado = document.querySelector('input[name="frete"]:checked');
  if (!freteSelecionado) {
    mostrarMensagem("Selecione uma opção de frete (PAC ou SEDEX) antes de finalizar.", "erro");
    const opcoes = document.getElementById("frete-opcoes");
    if (opcoes) opcoes.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const subtotal = carrinho.reduce((sum, item) => sum + item.preco * item.qtd, 0);
  const total = subtotal - subtotal * (descontoAtivo / 100) + freteValor;
  const modalTotal = document.getElementById("modal-total");
  if (modalTotal) modalTotal.textContent = "R$ " + total.toFixed(2).replace(".", ",");

  // Resetar para step 1
  _mostrarStep(1);
  document.querySelectorAll('input[name="pagamento"]').forEach(r => r.checked = false);

  // Cartão sempre disponível
  const radioCartao = document.querySelector('input[name="pagamento"][value="cartao"]');
  const labelCartao = radioCartao?.closest(".pagamento-opcao");
  if (radioCartao) {
    radioCartao.disabled = false;
    labelCartao?.classList.remove("pagamento-opcao--bloqueada");
  }

  const modal = document.getElementById("modal-pagamento");
  if (modal) modal.style.display = "flex";
}

function _mostrarStep(n) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById("pag-step-" + i);
    if (el) el.style.display = i === n ? "block" : "none";
  });
  const cardStep = document.getElementById("pag-step-card");
  if (cardStep) cardStep.style.display = n === "card" ? "block" : "none";
  const boletoStep = document.getElementById("pag-step-boleto");
  if (boletoStep) boletoStep.style.display = n === "boleto" ? "block" : "none";
}

function fecharModalPagamento() {
  const modal = document.getElementById("modal-pagamento");
  if (modal) modal.style.display = "none";
  _mostrarStep(1);
}

function voltarStep1() {
  _mostrarStep(1);
}

function confirmarPagamento() {
  // Com backend ativo: vai direto para MercadoPago sem precisar de radio selecionado
  if (_backendUrl()) {
    _finalizarPedido("mercadopago");
    return;
  }

  // Sem backend: fluxo simulado local
  const metodoPagamento = document.querySelector('input[name="pagamento"]:checked');
  if (!metodoPagamento) {
    mostrarMensagem("Selecione uma forma de pagamento!", "erro");
    return;
  }
  if (metodoPagamento.value === "pix") { _abrirFormPix(); return; }
  if (metodoPagamento.value === "cartao") { _abrirFormCartao(); return; }
  if (metodoPagamento.value === "boleto") { _abrirFormBoleto(); return; }
  _finalizarPedido(metodoPagamento.value);
}

function _abrirFormPix() {
  // Exibe o total na etapa 2
  const totalTexto = document.getElementById("modal-total")?.textContent || "R$ 0,00";
  const el = document.getElementById("pix-total-display");
  if (el) el.textContent = totalTexto;

  // Pré-preenche com dados do usuário logado (se existirem)
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  const u = usuarios.find(x => x.email === usuarioLogado?.email) || {};

  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };

  set("pix-nome", u.nome || usuarioLogado?.nome || "");

  // Label e placeholder conforme tipo
  const docLabel = document.getElementById("pix-doc-label");
  const docInput = document.getElementById("pix-doc");
  if (u.tipo === "juridica") {
    if (docLabel) docLabel.textContent = "CNPJ *";
    if (docInput) docInput.placeholder = "00.000.000/0000-00";
    set("pix-doc", u.cnpj || "");
  } else {
    if (docLabel) docLabel.textContent = "CPF *";
    if (docInput) docInput.placeholder = "000.000.000-00";
    set("pix-doc", u.cpf || "");
  }

  // Endereço (só existe para Pessoa Física)
  const end = u.endereco || {};
  set("pix-cep",    end.cep    || "");
  set("pix-rua",    end.rua    || "");
  set("pix-numero", end.numero || "");
  set("pix-bairro", end.bairro || "");
  set("pix-cidade", end.cidade || "");
  set("pix-estado", end.estado || "");

  _mostrarStep(2);

  // Formata CEP enquanto digita
  const cepPix = document.getElementById("pix-cep");
  if (cepPix && !cepPix._pixListener) {
    cepPix._pixListener = true;
    cepPix.addEventListener("input", function () {
      let v = this.value.replace(/\D/g, "").slice(0, 8);
      if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
      this.value = v;
    });
  }
}

function gerarQRCodePix(e) {
  e.preventDefault();

  const nome   = document.getElementById("pix-nome").value.trim();
  const doc    = document.getElementById("pix-doc").value.trim();
  const cep    = document.getElementById("pix-cep").value.trim();
  const rua    = document.getElementById("pix-rua").value.trim();
  const numero = document.getElementById("pix-numero").value.trim();
  const bairro = document.getElementById("pix-bairro").value.trim();
  const cidade = document.getElementById("pix-cidade").value.trim();
  const estado = document.getElementById("pix-estado").value.trim().toUpperCase();

  if (!nome || !doc || !cep || !rua || !numero || !bairro || !cidade || !estado) {
    mostrarMensagem("Preencha todos os campos obrigatórios!", "erro");
    return;
  }

  const totalTexto = document.getElementById("pix-total-display")?.textContent || "R$ 0,00";
  const totalNum   = totalTexto.replace("R$", "").replace(",", ".").trim();

  // Monta o payload do QR Code
  const pixPayload =
    `00020126580014BR.GOV.BCB.PIX` +
    `0136comicgeekstore@pix.com.br` +
    `52040000` +
    `5303986` +
    `54${String(totalNum.length).padStart(2,"0")}${totalNum}` +
    `5802BR` +
    `5913ComicGeekStore` +
    `6007${estado}` +
    `62070503***` +
    `6304`;

  // QR Code via API pública (sem backend necessário)
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(pixPayload)}`;

  const img = document.getElementById("pix-qrcode-img");
  if (img) img.src = url;

  const totalFinal = document.getElementById("pix-total-final");
  if (totalFinal) totalFinal.textContent = totalTexto;

  _mostrarStep(3);
}

function copiarChavePix() {
  const chave = document.getElementById("pix-chave-exibida")?.textContent || "";
  navigator.clipboard.writeText(chave).then(() => {
    mostrarMensagem("Chave PIX copiada!");
  }).catch(() => {
    mostrarMensagem("Não foi possível copiar. Copie manualmente: " + chave, "erro");
  });
}

function confirmarPagamentoPix() {
  _finalizarPedido("pix");
}

// =========================
// BOLETO
// =========================

function _abrirFormBoleto() {
  const totalTexto = document.getElementById("modal-total")?.textContent || "R$ 0,00";
  const el = document.getElementById("boleto-total-display");
  if (el) el.textContent = totalTexto;

  // Pré-preenche com dados do usuário logado
  const user = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  if (user) {
    const nomeEl = document.getElementById("boleto-nome");
    if (nomeEl && !nomeEl.value) nomeEl.value = user.nome || "";
    const cpfEl = document.getElementById("boleto-cpf");
    if (cpfEl && !cpfEl.value && user.cpf) cpfEl.value = user.cpf;
  }

  // Máscara CPF
  const cpfInput = document.getElementById("boleto-cpf");
  if (cpfInput && !cpfInput._bolMask) {
    cpfInput._bolMask = true;
    cpfInput.addEventListener("input", function () {
      let v = this.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      this.value = v;
    });
  }

  // Máscara CEP
  const cepInput = document.getElementById("boleto-cep");
  if (cepInput && !cepInput._bolMask) {
    cepInput._bolMask = true;
    cepInput.addEventListener("input", function () {
      let v = this.value.replace(/\D/g, "").slice(0, 8);
      if (v.length > 5) v = v.replace(/(\d{5})(\d{1,3})/, "$1-$2");
      this.value = v;
    });
  }

  document.getElementById("boleto-form-section").style.display = "block";
  document.getElementById("boleto-display-section").style.display = "none";
  _mostrarStep("boleto");
}

function gerarBoleto(e) {
  e.preventDefault();

  const nome    = document.getElementById("boleto-nome").value.trim();
  const cpf     = document.getElementById("boleto-cpf").value.trim();
  const cep     = document.getElementById("boleto-cep").value.trim();
  const rua     = document.getElementById("boleto-rua").value.trim();
  const num     = document.getElementById("boleto-numero").value.trim();
  const bairro  = document.getElementById("boleto-bairro").value.trim();
  const cidade  = document.getElementById("boleto-cidade").value.trim();
  const estado  = document.getElementById("boleto-estado").value.trim().toUpperCase();

  // Gera números do boleto
  const r4 = () => String(Math.floor(Math.random() * 9000 + 1000));
  const nossoNum = r4() + r4() + r4();
  const numDoc   = "CGS-" + Date.now().toString().slice(-8);

  // Vencimento: 3 dias úteis
  const hoje = new Date();
  let dias = 0;
  const venc = new Date(hoje);
  while (dias < 3) {
    venc.setDate(venc.getDate() + 1);
    const dow = venc.getDay();
    if (dow !== 0 && dow !== 6) dias++;
  }
  const fmt = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

  const totalTexto = document.getElementById("boleto-total-display").textContent;

  // Linha digitável realista
  const linhaDigitavel =
    `00190.${r4()}${r4()} ${r4()}${r4()}.${r4()}0 ${r4()}${r4()}.${r4()}1 6 ${nossoNum}`;

  // Preenche o boleto visual
  document.getElementById("boleto-linha-digitavel").textContent = linhaDigitavel;
  document.getElementById("boleto-nosso-numero").textContent = nossoNum;
  document.getElementById("boleto-num-doc").textContent = numDoc;
  document.getElementById("boleto-emissao").textContent = fmt(hoje);
  document.getElementById("boleto-vencimento").textContent = fmt(venc);
  document.getElementById("boleto-valor").textContent = totalTexto;
  document.getElementById("boleto-valor-cobrado").textContent = totalTexto;
  document.getElementById("boleto-pagador-nome").textContent = nome;
  document.getElementById("boleto-pagador-end").textContent =
    `${rua}, ${num} — ${bairro} — ${cidade}/${estado} — CEP: ${cep}`;
  document.getElementById("boleto-pagador-doc").textContent = `CPF: ${cpf}`;

  // Gera barras do código de barras
  _gerarBarrasBoleto(nossoNum);

  // Guarda linha para copiar
  window._boletoLinha = linhaDigitavel;

  document.getElementById("boleto-form-section").style.display = "none";
  document.getElementById("boleto-display-section").style.display = "block";
}

function _gerarBarrasBoleto(seed) {
  const container = document.getElementById("boleto-barcode");
  if (!container) return;
  container.innerHTML = "";
  let n = parseInt(seed.replace(/\D/g, "0").slice(0, 9)) || 123456789;
  for (let i = 0; i < 96; i++) {
    n = (n * 1664525 + 1013904223) & 0x7fffffff;
    const w = (n % 3) + 1;
    const span = document.createElement("span");
    span.className = i % 2 === 0 ? "boleto-bar" : "boleto-bar--space";
    span.style.width = w + "px";
    container.appendChild(span);
  }
}

function copiarLinhaDigitavel() {
  const linha = window._boletoLinha || "";
  if (navigator.clipboard) {
    navigator.clipboard.writeText(linha).then(() => mostrarMensagem("Linha digitável copiada!", "sucesso"));
  } else {
    const ta = document.createElement("textarea");
    ta.value = linha;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    mostrarMensagem("Linha digitável copiada!", "sucesso");
  }
}

function confirmarPagamentoBoleto() {
  _finalizarPedido("boleto");
}

// =========================
// CARTÃO — DETECÇÃO
// =========================
const _BANDEIRAS = [
  { id: "elo",       nome: "Elo",        cor: "#1a1a1a", regex: /^(4011|4312|4389|4514|4576|5067|5090|6362|6363|6516|6550)/ },
  { id: "hipercard", nome: "Hipercard",  cor: "#822124", regex: /^(606282|3841)/ },
  { id: "amex",      nome: "Amex",       cor: "#007bc1", regex: /^3[47]/ },
  { id: "mastercard",nome: "Mastercard", cor: "#2c2c2c", regex: /^(5[1-5]|2[2-7])/ },
  { id: "visa",      nome: "Visa",       cor: "#1a1f71", regex: /^4/ },
];

// BINs de débito conhecidos (Brasil, simplificado)
const _BINS_DEBITO = [
  "4011","4312","4389","4514","4576",   // Elo Débito
  "5067","6362","6363",                 // Elo Débito
  "4002","4003","4009","4360",          // Visa Electron
  "5041","5090",                        // Mastercard Débito
];

function _detectarBandeira(n) {
  const digits = n.replace(/\D/g, "");
  return _BANDEIRAS.find(b => b.regex.test(digits)) || null;
}

function _detectarTipo(n) {
  const digits = n.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return _BINS_DEBITO.some(p => digits.startsWith(p)) ? "debito" : "credito";
}

function _abrirFormCartao() {
  const totalTexto = document.getElementById("modal-total")?.textContent || "R$ 0,00";
  const el = document.getElementById("cartao-total-display");
  if (el) el.textContent = totalTexto;

  // Pré-preenche nome do titular
  const u = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (u) {
    const nomeEl = document.getElementById("cartao-nome");
    if (nomeEl && !nomeEl.value) nomeEl.value = u.nome.toUpperCase();
  }

  // Reset preview
  _atualizarPreviewCartao();
  _mostrarStep("card");

  // ---- Listeners do formulário ----
  const numInput = document.getElementById("cartao-numero");
  const nomeInput = document.getElementById("cartao-nome");
  const valInput = document.getElementById("cartao-validade");
  const cvvInput = document.getElementById("cartao-cvv");

  if (numInput && !numInput._cartaoListener) {
    numInput._cartaoListener = true;

    numInput.addEventListener("input", function () {
      // Formata com espaços a cada 4 dígitos
      let v = this.value.replace(/\D/g, "").slice(0, 16);
      this.value = v.replace(/(.{4})/g, "$1 ").trim();
      _atualizarPreviewCartao();
    });

    nomeInput.addEventListener("input", function () {
      this.value = this.value.toUpperCase();
      _atualizarPreviewCartao();
    });

    valInput.addEventListener("input", function () {
      let v = this.value.replace(/\D/g, "").slice(0, 4);
      if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
      this.value = v;
      _atualizarPreviewCartao();
    });

    cvvInput.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 4);
      _atualizarPreviewCartao();
    });

    cvvInput.addEventListener("focus",  () => { document.getElementById("cartao-preview")?.classList.add("virado"); });
    cvvInput.addEventListener("blur",   () => { document.getElementById("cartao-preview")?.classList.remove("virado"); });
  }
}

function _atualizarPreviewCartao() {
  const numero   = (document.getElementById("cartao-numero")?.value   || "").replace(/\D/g, "");
  const nome     = document.getElementById("cartao-nome")?.value      || "";
  const validade = document.getElementById("cartao-validade")?.value  || "";
  const cvv      = document.getElementById("cartao-cvv")?.value       || "";

  const preview  = document.getElementById("cartao-preview");
  const bandeira = _detectarBandeira(numero);
  const tipo     = _detectarTipo(numero);

  // Número formatado no preview
  const blocos = (numero.padEnd(16, "•")).match(/.{1,4}/g) || [];
  const prevNumero = document.getElementById("prev-numero");
  if (prevNumero) prevNumero.textContent = blocos.join(" ");

  // Nome
  const prevNome = document.getElementById("prev-nome");
  if (prevNome) prevNome.textContent = nome || "SEU NOME";

  // Validade
  const prevVal = document.getElementById("prev-validade");
  if (prevVal) prevVal.textContent = validade || "MM/AA";

  // CVV
  const prevCvv = document.getElementById("prev-cvv");
  if (prevCvv) prevCvv.textContent = cvv ? "•".repeat(cvv.length) : "•••";

  // Bandeira no preview e no input
  if (preview) {
    _BANDEIRAS.forEach(b => preview.classList.remove("bandeira-" + b.id));
    if (bandeira) preview.classList.add("bandeira-" + bandeira.id);
  }
  const prevBandeira = document.getElementById("prev-bandeira-nome");
  const inlineBandeira = document.getElementById("cartao-bandeira-inline");
  if (prevBandeira) prevBandeira.textContent = bandeira ? bandeira.nome.toUpperCase() : "";
  if (inlineBandeira) inlineBandeira.textContent = bandeira ? bandeira.nome : "";

  // Tipo (Crédito / Débito) no badge do preview
  const prevTipo = document.getElementById("prev-tipo");
  if (prevTipo) {
    prevTipo.textContent = tipo === "debito" ? "DÉBITO" : tipo === "credito" ? "CRÉDITO" : "";
  }

  // Badge detectado embaixo do campo
  const detectado = document.getElementById("cartao-detectado");
  if (detectado) {
    if (bandeira && tipo) {
      detectado.innerHTML =
        `<span class="badge-bandeira" style="background:${bandeira.cor}">${bandeira.nome}</span>` +
        `<span class="badge-tipo badge-tipo--${tipo}">${tipo === "debito" ? "Débito" : "Crédito"}</span>`;
    } else if (bandeira) {
      detectado.innerHTML =
        `<span class="badge-bandeira" style="background:${bandeira.cor}">${bandeira.nome}</span>`;
    } else {
      detectado.innerHTML = numero.length >= 4
        ? '<span style="color:#aaa;font-size:11px">Bandeira não identificada</span>'
        : "";
    }
  }
}

function confirmarPagamentoCartao(e) {
  e.preventDefault();

  const numero   = document.getElementById("cartao-numero")?.value.replace(/\D/g, "") || "";
  const nome     = document.getElementById("cartao-nome")?.value.trim() || "";
  const validade = document.getElementById("cartao-validade")?.value.trim() || "";
  const cvv      = document.getElementById("cartao-cvv")?.value.trim() || "";

  if (numero.length < 13) { mostrarMensagem("Número de cartão inválido!", "erro"); return; }
  if (!nome)               { mostrarMensagem("Informe o nome do titular!", "erro"); return; }
  if (!/^\d{2}\/\d{2}$/.test(validade)) { mostrarMensagem("Validade inválida! Use MM/AA.", "erro"); return; }
  if (cvv.length < 3)      { mostrarMensagem("CVV inválido!", "erro"); return; }

  // Validade não expirada
  const [mm, aa] = validade.split("/").map(Number);
  const agora = new Date();
  const ano4 = 2000 + aa;
  if (ano4 < agora.getFullYear() || (ano4 === agora.getFullYear() && mm < agora.getMonth() + 1)) {
    mostrarMensagem("Cartão expirado!", "erro"); return;
  }

  const tipo = _detectarTipo(numero);
  const metodo = tipo === "debito" ? "cartao_debito" : "cartao_credito";
  _finalizarPedido(metodo);
}

function _finalizarPedido(metodoPagamento) {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const subtotalPedido = carrinho.reduce((sum, item) => sum + item.preco * item.qtd, 0);
  const total = subtotalPedido - subtotalPedido * (descontoAtivo / 100) + freteValor;

  const agora = new Date();
  const pedido = {
    id: agora.getTime(),
    numero: "CGS-" + agora.getTime().toString().slice(-6),
    data: agora.toLocaleDateString("pt-BR"),
    dataISO: agora.toISOString(),
    email: usuarioLogado.email,
    itens: JSON.parse(JSON.stringify(carrinho)),
    total,
    pagamento: metodoPagamento,
    status: "pendente",
  };

  // Salva pedido como pendente
  const pedidos = JSON.parse(localStorage.getItem("pedidos")) || [];
  pedidos.unshift(pedido);
  localStorage.setItem("pedidos", JSON.stringify(pedidos));

  // Backend disponível: salva pedido e redireciona para pagamento
  if (_backendUrl()) {
    fecharModalPagamento();

    const btnPagar = document.querySelector(".btn-confirmar-pagamento");
    if (btnPagar) {
      btnPagar.disabled = true;
      btnPagar.textContent = "Aguarde...";
    }
    mostrarMensagem("Redirecionando para o pagamento...");

    api("/api/criar-preferencia", "POST", {
      itens: carrinho,
      pedidoNumero: pedido.numero,
      email: usuarioLogado.email,
    }).then(data => {
      if (data && data.init_point) {
        api("/api/carrinho/salvar", "DELETE").catch(() => {});
        window.location.href = data.init_point;
      } else {
        const msg = data?.erro || "Erro ao conectar com o pagamento. Tente novamente.";
        mostrarMensagem(msg, "erro");
        if (btnPagar) { btnPagar.disabled = false; btnPagar.textContent = "Pagar com MercadoPago"; }
      }
    }).catch(() => {
      mostrarMensagem("Erro ao conectar com o pagamento. Tente novamente.", "erro");
      if (btnPagar) { btnPagar.disabled = false; btnPagar.textContent = "Pagar com MercadoPago"; }
    });

    return;
  }

  // Sem backend: fluxo simulado (desenvolvimento)
  pedido.status = "concluido";
  pedidos[0] = pedido;
  localStorage.setItem("pedidos", JSON.stringify(pedidos));
  localStorage.removeItem("carrinho");
  api("/api/carrinho/salvar", "DELETE").catch(() => {});
  atualizarBadgeCarrinho();
  fecharModalPagamento();
  mostrarMensagem("Pedido #" + pedido.numero + " realizado com sucesso!");

  if (window.MarvelAPI) MarvelAPI.rastrearCompra(total, carrinho);

  if (window.enviarEmailConfirmacao) {
    const itensTexto = carrinho.map(i => `${i.nome} (x${i.qtd}) — R$ ${(i.preco * i.qtd).toFixed(2).replace(".", ",")}`).join("\n");
    enviarEmailConfirmacao({
      nome:            usuarioLogado.nome,
      email:           usuarioLogado.email,
      numero:          pedido.numero,
      itens:           itensTexto,
      total:           "R$ " + total.toFixed(2).replace(".", ","),
      metodoPagamento: metodoPagamento,
    });
  }

  setTimeout(() => (window.location.href = "/pedidos"), 1500);
}

// =========================
// PEDIDOS — PÁGINA
// =========================
function renderizarPedidos() {
  const container = document.getElementById("pedidos-lista");
  if (!container) return;

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));

  if (!usuarioLogado) {
    container.innerHTML = `
      <div class="pedidos-vazio">
        <h2>Você precisa estar logado</h2>
        <p>Faça login para visualizar seus pedidos.</p>
        <a href="/login" class="btn-pedidos-acao">Fazer Login</a>
      </div>`;
    return;
  }

  if (_backendUrl()) {
    api("/api/pedidos").then(data => {
      const pedidos = Array.isArray(data) ? data : (JSON.parse(localStorage.getItem("pedidos")) || []).filter(p => p.email === usuarioLogado.email);
      _renderPedidosLista(container, pedidos);
    });
    return;
  }
  const todosPedidos = JSON.parse(localStorage.getItem("pedidos")) || [];
  const pedidos = todosPedidos.filter((p) => p.email === usuarioLogado.email);
  _renderPedidosLista(container, pedidos);
}

function _renderPedidosLista(container, pedidos) {
  if (pedidos.length === 0) {
    container.innerHTML = `
      <div class="pedidos-vazio">
        <h2>Nenhum pedido realizado ainda</h2>
        <p>Explore nossa loja e faça seu primeiro pedido!</p>
        <a href="/" class="btn-pedidos-acao">Explorar Loja</a>
      </div>`;
    return;
  }

  container.innerHTML = pedidos
    .map(pedido => {
      const cancelavel = pedido.status === "pendente" || pedido.status === "aguardando_pagamento";
      const statusLabel = {
        concluido: "✓ Concluído", pendente: "⏳ Pendente",
        aguardando_pagamento: "⏳ Aguardando pagamento", cancelado: "✕ Cancelado"
      };
      const st = pedido.status || "concluido";
      return `
    <div class="pedido-card">
      <div class="pedido-card__header">
        <div class="pedido-card__info">
          <span class="pedido-numero">Pedido #${pedido.numero}</span>
          <span class="pedido-data">📅 ${pedido.data || pedido.dataISO?.slice(0,10)}</span>
        </div>
        <div class="pedido-card__direita">
          <span class="pedido-total">R$ ${Number(pedido.total).toFixed(2).replace(".", ",")}</span>
          <span class="pedido-status pedido-status--${st}">${statusLabel[st] || st}</span>
          ${cancelavel ? `<button class="btn-cancelar-pedido" onclick="cancelarPedido('${pedido.id}')">Cancelar</button>` : ""}
        </div>
      </div>
      <div class="pedido-itens">
        ${(pedido.itens || []).map(item => `
          <div class="pedido-item">
            <img src="../${item.img}" alt="${item.nome}" class="pedido-item__img">
            <div class="pedido-item__info">
              <span class="pedido-item__nome">${item.nome}</span>
              <span class="pedido-item__qtd">Qtd: ${item.qtd}</span>
            </div>
            <span class="pedido-item__preco">R$ ${(item.preco * item.qtd).toFixed(2).replace(".", ",")}</span>
          </div>`).join("")}
      </div>
    </div>`;
    }).join("");
}

function cancelarPedido(id) {
  if (!confirm("Tem certeza que deseja cancelar este pedido?")) return;
  api(`/api/pedidos/${id}/cancelar`, "PUT").then(data => {
    if (data && data.erro) { mostrarMensagem(data.erro, "erro"); return; }
    mostrarMensagem("Pedido cancelado.");
    carregarPedidos();
  });
}

// =========================
// FILTRO DE CATEGORIAS
// =========================
// Mapa: filtro → id do grupo que deve ficar visível
const _FILTRO_GRUPO = {
  lancamentos: "grupo-lancamentos",
  prevenda:    "grupo-prevenda",
  marvel:      "grupo-marvel",
  dc:          "grupo-dc",
  especiais:   "grupo-especiais",
  panini:      "grupo-panini",
  image:       "grupo-image",
  darkhorse:   "grupo-darkhorse",
};

function filtrarProdutos(filtro) {
  const cards = document.querySelectorAll(".card-produto");
  const grupos = document.querySelectorAll(".secao-grupo");
  const estadoVazio = document.getElementById("estado-vazio");

  if (filtro === "tudo") {
    // Mostra tudo
    cards.forEach((c) => {
      c.classList.remove("card-oculto--categoria");
      c.classList.toggle("card-oculto",
        c.classList.contains("card-oculto--preco") ||
        c.classList.contains("card-oculto--busca")
      );
    });
    grupos.forEach((g) => { g.style.display = ""; });
  } else {
    const grupoAlvo = _FILTRO_GRUPO[filtro];

    // Mostra/oculta grupos inteiros
    grupos.forEach((g) => {
      const mostrar = !grupoAlvo || g.id === grupoAlvo;
      g.style.display = mostrar ? "" : "none";
    });

    // Filtra cards dentro do grupo visível
    cards.forEach((card) => {
      let visivel = true;
      if (filtro === "marvel") {
        visivel = card.dataset.editora === "marvel";
      } else if (filtro === "dc") {
        visivel = card.dataset.editora === "dc";
      } else if (filtro === "panini") {
        visivel = card.dataset.editora === "panini";
      } else if (filtro === "image") {
        visivel = card.dataset.editora === "image";
      } else if (filtro === "darkhorse") {
        visivel = card.dataset.editora === "darkhorse";
      } else if (filtro === "lancamentos") {
        visivel = card.dataset.secao === "lancamentos";
      } else if (filtro === "prevenda") {
        visivel = card.dataset.secao === "prevenda";
      } else if (filtro === "especiais") {
        visivel = card.dataset.secao === "especiais";
      } else if (filtro === "oferta") {
        visivel = !!card.querySelector(".card-produto__preco h3");
      }
      card.classList.toggle("card-oculto--categoria", !visivel);
      card.classList.toggle("card-oculto",
        !visivel ||
        card.classList.contains("card-oculto--preco") ||
        card.classList.contains("card-oculto--busca")
      );
    });

    // Para filtro de oferta, oculta grupos e mostra apenas cards com desconto
    if (filtro === "oferta") {
      grupos.forEach(g => { g.style.display = ""; });
    }
  }

  const algumVisivel = [...grupos].some((g) => g.style.display !== "none");
  if (estadoVazio) {
    estadoVazio.style.display = algumVisivel ? "none" : "block";
    if (!algumVisivel) {
      estadoVazio.querySelector("h2").textContent = "Nenhum produto nesta categoria.";
      estadoVazio.querySelector("p").textContent = "Confira outras categorias ou volte mais tarde!";
    }
  }
}

let _filtroPrecoMin = 0;
let _filtroPrecoMax = Infinity;

function aplicarFiltroPreco() {
  const cards = document.querySelectorAll(".card-produto");
  const grupos = document.querySelectorAll(".secao-grupo");
  const estadoVazio = document.getElementById("estado-vazio");
  cards.forEach(card => {
    const preco = parseFloat(card.dataset.preco) || 0;
    const fora = preco < _filtroPrecoMin || preco > _filtroPrecoMax;
    if (fora) card.classList.add("card-oculto--preco");
    else card.classList.remove("card-oculto--preco");
    card.classList.toggle("card-oculto",
      card.classList.contains("card-oculto--preco") ||
      card.classList.contains("card-oculto--categoria") ||
      card.classList.contains("card-oculto--busca")
    );
  });
  grupos.forEach(grupo => {
    const temVisiveis = [...grupo.querySelectorAll(".card-produto")].some(c => !c.classList.contains("card-oculto"));
    grupo.style.display = temVisiveis ? "" : "none";
  });
  const algumVisivel = [...cards].some(c => !c.classList.contains("card-oculto"));
  if (estadoVazio) estadoVazio.style.display = algumVisivel ? "none" : "block";
}

function inicializarFiltroPrecoBarra() {
  const btnAplicar = document.getElementById("filtro-preco-aplicar");
  const btnLimpar = document.getElementById("filtro-preco-limpar");
  const inputMin = document.getElementById("filtro-preco-min");
  const inputMax = document.getElementById("filtro-preco-max");
  if (!btnAplicar) return;
  btnAplicar.addEventListener("click", () => {
    _filtroPrecoMin = parseFloat(inputMin.value) || 0;
    _filtroPrecoMax = inputMax.value ? parseFloat(inputMax.value) : Infinity;
    const ativo = _filtroPrecoMin > 0 || _filtroPrecoMax !== Infinity;
    if (btnLimpar) btnLimpar.style.display = ativo ? "inline-block" : "none";
    aplicarFiltroPreco();
  });
  if (btnLimpar) {
    btnLimpar.addEventListener("click", () => {
      _filtroPrecoMin = 0; _filtroPrecoMax = Infinity;
      if (inputMin) inputMin.value = "";
      if (inputMax) inputMax.value = "";
      btnLimpar.style.display = "none";
      document.querySelectorAll(".card-produto").forEach(c => c.classList.remove("card-oculto--preco"));
      aplicarFiltroPreco();
    });
  }
}

function inicializarFiltros() {
  const navItems = document.querySelectorAll("nav ul li[data-filtro]");
  if (!navItems.length) return;

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((n) => n.classList.remove("nav-ativo"));
      item.classList.add("nav-ativo");
      filtrarProdutos(item.dataset.filtro);

      // Limpar busca ao trocar de filtro
      const inputPesquisa = document.getElementById("input-pesquisa");
      if (inputPesquisa) inputPesquisa.value = "";
    });
  });
}

// =========================
// PESQUISA
// =========================
function inicializarPesquisa() {
  const form = document.getElementById("form-pesquisa");
  const input = document.getElementById("input-pesquisa");
  if (!form || !input) return;

  function aplicarBusca() {
    const query = input.value.trim().toLowerCase();
    const cards = document.querySelectorAll(".card-produto");
    const grupos = document.querySelectorAll(".secao-grupo");
    const estadoVazio = document.getElementById("estado-vazio");

    // Resetar nav ativo
    document.querySelectorAll("nav ul li[data-filtro]").forEach((n) => n.classList.remove("nav-ativo"));
    const itemTudo = document.querySelector('nav ul li[data-filtro="tudo"]');
    if (itemTudo) itemTudo.classList.add("nav-ativo");

    if (!query) {
      cards.forEach(c => c.classList.remove("card-oculto--busca"));
      filtrarProdutos("tudo");
      aplicarFiltroPreco();
      return;
    }

    cards.forEach((card) => {
      const nome = (card.dataset.nome || "").toLowerCase();
      const escondidoPorBusca = !nome.includes(query);
      card.classList.toggle("card-oculto--busca", escondidoPorBusca);
      card.classList.toggle("card-oculto",
        escondidoPorBusca ||
        card.classList.contains("card-oculto--preco") ||
        card.classList.contains("card-oculto--categoria")
      );
    });

    grupos.forEach((grupo) => {
      const temVisiveis = [...grupo.querySelectorAll(".card-produto")].some(
        (c) => !c.classList.contains("card-oculto")
      );
      grupo.style.display = temVisiveis ? "" : "none";
    });

    const algumVisivel = [...cards].some((c) => !c.classList.contains("card-oculto"));
    if (estadoVazio) {
      estadoVazio.style.display = algumVisivel ? "none" : "block";
      if (!algumVisivel) {
        estadoVazio.querySelector("h2").textContent = `Nenhum resultado para "${input.value.trim()}"`;
        estadoVazio.querySelector("p").textContent = "Buscando mais quadrinhos...";
      }
    }

    if (!algumVisivel && query.length >= 3) {
      // Busca server-side primeiro
      if (_backendUrl()) {
        fetch(`/api/produtos/buscar?q=${encodeURIComponent(query)}`)
          .then(r => r.json())
          .then(resultados => {
            if (resultados && resultados.length > 0) {
              _mostrarResultadosBusca(resultados);
            } else if (window.MarvelAPI) {
              MarvelAPI.buscar(input.value.trim(), r => _mostrarResultadosMarvel(r, input.value.trim()));
            }
          })
          .catch(() => {
            if (window.MarvelAPI)
              MarvelAPI.buscar(input.value.trim(), r => _mostrarResultadosMarvel(r, input.value.trim()));
          });
      } else if (window.MarvelAPI) {
        MarvelAPI.buscar(input.value.trim(), r => _mostrarResultadosMarvel(r, input.value.trim()));
      }
    } else {
      const secaoMarvel = document.getElementById("marvel-api-resultados");
      if (secaoMarvel) secaoMarvel.remove();
      const secaoBusca = document.getElementById("busca-server-resultados");
      if (secaoBusca) secaoBusca.remove();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    aplicarBusca();
  });

  input.addEventListener("input", () => {
    aplicarBusca();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      filtrarProdutos("tudo");
      input.blur();
    }
  });
}

// =========================
// MARVEL API — RENDERIZAR RESULTADOS
// =========================
function _mostrarResultadosBusca(resultados) {
  const main = document.querySelector("main");
  if (!main) return;

  let secao = document.getElementById("busca-server-resultados");
  if (!secao) {
    secao = document.createElement("div");
    secao.id = "busca-server-resultados";
    secao.className = "secao-grupo";
    secao.innerHTML = `
      <div class="titulo-secao" style="margin-top:16px">
        <h1>Resultados da busca</h1>
      </div>
      <section class="lista-cards" id="busca-server-lista" aria-label="Resultados da busca"></section>
    `;
    main.appendChild(secao);
  }

  const lista = secao.querySelector("#busca-server-lista");
  if (!lista) return;

  if (resultados.length === 0) {
    secao.remove();
    return;
  }

  const estadoVazio = document.getElementById("estado-vazio");
  if (estadoVazio) estadoVazio.style.display = "none";

  lista.innerHTML = resultados.map(p => {
    const nome = sanitizar(p.nome || "Sem título");
    const preco = parseFloat(p.preco) || 0;
    const precoFmt = "R$ " + preco.toFixed(2).replace(".", ",");
    const imgSrc = p.img || "img/logos/logo.png";
    const esgotado = p.esgotado || p.estoque === 0;
    return `
      <article class="card-produto"
        data-id="${p.id || ""}"
        data-nome="${nome}"
        data-preco="${preco.toFixed(2)}"
        data-img="${imgSrc}"
        data-editora="${sanitizar(p.editora || "")}"
        data-secao="${sanitizar(p.secao || "")}"
        ${p.precoOriginal ? `data-preco-original="${p.precoOriginal}"` : ""}
        ${p.estoque != null ? `data-estoque="${p.estoque}"` : ""}
        ${esgotado ? 'data-esgotado="true"' : ""}>
        <div class="card-produto__imagem">
          <img src="${imgSrc}" alt="${nome}" loading="lazy">
        </div>
        <div class="card-produto__nome"><h3>${nome}</h3></div>
        <div class="card-produto__preco"><h2>${precoFmt}</h2></div>
        <button class="card-produto__btn"${esgotado ? " disabled" : ""}>
          ${esgotado ? "Esgotado" : "+ Adicionar ao Carrinho"}
        </button>
      </article>`;
  }).join("");

  lista.querySelectorAll(".card-produto").forEach(card => {
    card.addEventListener("click", function(e) {
      if (e.target.closest(".card-produto__btn")) return;
      abrirModalProduto(this);
    });
  });
}

// =========================
// CARREGAR PRODUTOS DO ADMIN NA HOME
// =========================
function carregarProdutosAPI() {
  if (!_backendUrl()) return;
  fetch("/api/produtos")
    .then(r => r.json())
    .then(lista => {
      if (!Array.isArray(lista)) return;
      const grupos = {
        panini:    document.getElementById("lista-panini"),
        image:     document.getElementById("lista-image"),
        darkhorse: document.getElementById("lista-darkhorse"),
      };
      const hoje = Date.now();
      const TRINTA = 30 * 24 * 60 * 60 * 1000;
      lista.forEach(p => {
        const listaEl = grupos[p.editora];
        if (!listaEl) return;
        const esgotado = p.esgotado || p.estoque === 0;
        const preco = parseFloat(p.preco) || 0;
        const precoFmt = "R$ " + preco.toFixed(2).replace(".", ",");
        const origFmt = p.precoOriginal && p.precoOriginal > preco ? "R$ " + parseFloat(p.precoOriginal).toFixed(2).replace(".", ",") : "";
        const isNovo = p.criadoEm && (hoje - new Date(p.criadoEm).getTime()) < TRINTA;
        const card = document.createElement("article");
        card.className = "card-produto";
        card.dataset.nome = sanitizar(p.nome);
        card.dataset.preco = preco.toFixed(2);
        card.dataset.img = p.img || "img/logos/logo.png";
        card.dataset.editora = p.editora || "";
        card.dataset.secao = p.secao || "";
        if (p.precoOriginal) card.dataset.precoOriginal = p.precoOriginal;
        if (p.estoque != null) card.dataset.estoque = p.estoque;
        if (p.criadoEm) card.dataset.criadoEm = p.criadoEm;
        if (esgotado) card.dataset.esgotado = "true";
        card.innerHTML = `
          <div class="card-produto__imagem">
            <img src="${p.img || "img/logos/logo.png"}" alt="${sanitizar(p.nome)}" loading="lazy">
          </div>
          <div class="card-produto__nome"><h3>${sanitizar(p.nome)}</h3></div>
          <div class="card-produto__preco">${origFmt ? `<h3>${origFmt}</h3>` : ""}<h2>${precoFmt}</h2></div>
          <button class="card-produto__btn"${esgotado ? " disabled" : ""}>${esgotado ? "Esgotado" : "+ Adicionar ao Carrinho"}</button>`;
        listaEl.appendChild(card);
        const grupoEl = listaEl.closest(".secao-grupo");
        if (grupoEl) grupoEl.style.display = "";
      });
    })
    .catch(() => {});
}

function _mostrarResultadosMarvel(resultados, query) {
  const main = document.querySelector("main");
  if (!main) return;

  let secao = document.getElementById("marvel-api-resultados");
  if (!secao) {
    secao = document.createElement("div");
    secao.id = "marvel-api-resultados";
    secao.className = "secao-grupo";
    secao.innerHTML = `
      <div class="titulo-secao" style="margin-top:16px">
        <h1>Encontrados na Marvel</h1>
      </div>
      <p style="text-align:center;font-size:13px;color:rgba(255,255,255,0.4);margin:-8px 0 8px;font-family:'Montserrat',sans-serif;">
        Resultados da Marvel — clique para ver mais detalhes
      </p>
      <section class="lista-cards" id="marvel-api-lista" aria-label="Resultados Marvel API"></section>
    `;
    main.appendChild(secao);
  }

  const lista = secao.querySelector("#marvel-api-lista");
  if (!lista) return;

  if (resultados.length === 0) {
    secao.remove();
    const estadoVazio = document.getElementById("estado-vazio");
    if (estadoVazio) {
      estadoVazio.querySelector("p").textContent = "Tente buscar por outro título ou selecione outra categoria.";
    }
    return;
  }

  const estadoVazio = document.getElementById("estado-vazio");
  if (estadoVazio) estadoVazio.style.display = "none";

  lista.innerHTML = resultados.map(comic => {
    const img = comic.thumbnail
      ? comic.thumbnail.path + "/portrait_xlarge." + comic.thumbnail.extension
      : "";
    const nome = sanitizar(comic.title || "Sem título");
    const preco = comic.prices && comic.prices[0] ? comic.prices[0].price.toFixed(2) : "0.00";
    const precoFmt = "R$ " + (parseFloat(preco) > 0 ? (parseFloat(preco) * 5.2).toFixed(2).replace(".", ",") : "--");
    const imgSrc = img && !img.includes("image_not_available") ? img : "img/logos/logo.png";

    return `
      <article class="card-produto"
        data-editora="marvel"
        data-secao="marvel"
        data-nome="${nome}"
        data-preco="${(parseFloat(preco) * 5.2).toFixed(2)}"
        data-img="${imgSrc}">
        <div class="card-produto__imagem">
          <img src="${imgSrc}" alt="${nome}" loading="lazy">
        </div>
        <div class="card-produto__nome"><h3>${nome}</h3></div>
        <div class="card-produto__preco"><h2>${precoFmt}</h2></div>
        <button class="card-produto__btn">+ Adicionar ao Carrinho</button>
      </article>`;
  }).join("");

  lista.querySelectorAll(".card-produto").forEach(card => {
    card.addEventListener("click", function(e) {
      if (e.target.closest(".card-produto__btn")) return;
      abrirModalProduto(this);
    });
  });
}

// =========================
// BOTÕES "ADICIONAR AO CARRINHO"
// =========================
function inicializarBotoesCarrinho() {
  document.querySelectorAll(".card-produto__btn:not([data-listener])").forEach((btn) => {
    btn.dataset.listener = "1";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const card = this.closest(".card-produto");
      if (card.dataset.estoque === "0") return;
      const origText = card.querySelector(".card-produto__preco h3")?.textContent?.replace("R$","").replace(",",".").trim();
      const precoOriginal = origText ? parseFloat(origText) : null;
      adicionarAoCarrinho(card.dataset.nome, card.dataset.preco, card.dataset.img, 1, precoOriginal);
    });
  });

  // Badge de desconto + badge Esgotado em cada card
  document.querySelectorAll(".card-produto").forEach((card) => {
    // Estoque
    if (card.dataset.estoque === "0") {
      card.classList.add("esgotado");
      const btn = card.querySelector(".card-produto__btn");
      if (btn) { btn.disabled = true; btn.textContent = "Esgotado"; }
      const overlay = document.createElement("div");
      overlay.className = "card-esgotado-overlay";
      overlay.innerHTML = "<span>Esgotado</span>";
      card.querySelector(".card-produto__imagem").appendChild(overlay);
    }

    // Desconto
    const precoOrigEl = card.querySelector(".card-produto__preco h3");
    const precoVendaEl = card.querySelector(".card-produto__preco h2");
    if (!precoOrigEl || !precoVendaEl) return;

    const orig  = parseFloat(precoOrigEl.textContent.replace("R$","").replace(",",".").trim());
    const venda = parseFloat(precoVendaEl.textContent.replace("R$","").replace(",",".").trim());
    if (!orig || orig <= venda) return;

    const pct = Math.round(((orig - venda) / orig) * 100);
    const badge = document.createElement("div");
    badge.className = "card-produto__badge-desconto badge-pct";
    badge.textContent = "-" + pct + "%";
    card.querySelector(".card-produto__imagem").appendChild(badge);
  });

  // Badges NOVO e PRÉ-VENDA
  const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;
  document.querySelectorAll(".card-produto").forEach((card) => {
    const imgBox = card.querySelector(".card-produto__imagem");
    if (!imgBox || imgBox.querySelector(".badge-novo, .badge-prevenda")) return;
    if (card.dataset.secao === "prevenda") {
      const b = document.createElement("div");
      b.className = "card-produto__badge-desconto badge-prevenda";
      b.textContent = "Pré-Venda";
      imgBox.appendChild(b);
    } else if (card.dataset.criadoEm) {
      const diff = Date.now() - new Date(card.dataset.criadoEm).getTime();
      if (diff < TRINTA_DIAS) {
        const b = document.createElement("div");
        b.className = "card-produto__badge-desconto badge-novo";
        b.textContent = "NOVO";
        imgBox.appendChild(b);
      }
    }
  });

  // Botão favorito em cada card
  document.querySelectorAll(".card-produto").forEach((card) => {
    if (card.querySelector(".btn-favorito-card")) return;
    const nome = card.dataset.nome;
    if (!nome) return;
    const favs = lerFavoritos();
    const btn = document.createElement("button");
    btn.className = "btn-favorito-card" + (favs.some(f => f.nome === nome) ? " ativo" : "");
    btn.title = "Favoritar";
    btn.innerHTML = btn.classList.contains("ativo") ? "❤" : "♡";
    btn.setAttribute("type", "button");
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      toggleFavoritoCard(card, this);
    });
    card.querySelector(".card-produto__imagem").appendChild(btn);
  });

  // Abre modal ao clicar no card
  document.querySelectorAll(".card-produto").forEach((card) => {
    card.addEventListener("click", function (e) {
      if (e.target.closest(".card-produto__btn")) return;
      if (e.target.closest(".btn-favorito-card")) return;
      abrirModalProduto(this);
    });
  });
}

// =========================
// MODAL DETALHE DO PRODUTO
// =========================
// =========================
// FAVORITOS
// =========================
function lerFavoritos() {
  return JSON.parse(localStorage.getItem("favoritos") || "[]");
}

function toggleFavoritoCard(card, btn) {
  let favs = lerFavoritos();
  const nome = card.dataset.nome;
  const idx = favs.findIndex(f => f.nome === nome);
  if (idx === -1) {
    favs.push({ nome, preco: card.dataset.preco, img: card.dataset.img, editora: card.dataset.editora || "marvel" });
    btn.classList.add("ativo");
    btn.innerHTML = "❤";
    mostrarMensagem("Adicionado aos favoritos!");
  } else {
    favs.splice(idx, 1);
    btn.classList.remove("ativo");
    btn.innerHTML = "♡";
    mostrarMensagem("Removido dos favoritos.");
  }
  localStorage.setItem("favoritos", JSON.stringify(favs));
}

let modalQtd = 1;
let modalProdutoAtual = null;

const descricoes = {
  marvel: [
    "Uma história épica do universo Marvel que vai te deixar preso até a última página.",
    "Aventura, ação e heróis incríveis nesta edição imperdível da Marvel.",
    "Os maiores heróis da Marvel em uma saga que marcou gerações de fãs.",
    "Edição especial com arte incrível e roteiro de tirar o fôlego.",
  ],
  dc: [
    "Uma das histórias mais marcantes do universo DC Comics.",
    "Vilões e heróis se enfrentam nesta edição épica da DC.",
    "Mergulhe no universo DC com esta edição repleta de reviravoltas.",
    "Arte e roteiro excepcionais nesta edição que todo fã da DC precisa ter.",
  ],
};

function getDescricao(editora, nome) {
  const lista = descricoes[editora] || descricoes.marvel;
  const idx = nome.length % lista.length;
  return lista[idx];
}

function calcularDesconto(original, venda) {
  if (!original || original <= venda) return 0;
  return Math.round(((original - venda) / original) * 100);
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function abrirModalProduto(card) {
  const nome     = card.dataset.nome;
  const preco    = parseFloat(card.dataset.preco);
  const img      = card.dataset.img;
  const editora  = card.dataset.editora || "marvel";

  // Pega o preço original do DOM do card (só existe se houver desconto real)
  const precoOrigEl   = card.querySelector(".card-produto__preco h3");
  const precoOrigText = precoOrigEl ? precoOrigEl.textContent.replace("R$","").replace(",",".").trim() : null;
  const precoOriginal = precoOrigText ? parseFloat(precoOrigText) : null;
  const temDesconto   = precoOriginal && precoOriginal > preco;

  const estoque = card.dataset.estoque !== undefined ? parseInt(card.dataset.estoque, 10) : Infinity;
  modalProdutoAtual = { nome, preco, img, editora, precoOriginal, estoque };
  modalQtd = 1;

  // Preenche o modal
  document.getElementById("modal-nome").textContent      = nome;
  document.getElementById("modal-descricao").textContent = getDescricao(editora, nome);
  document.getElementById("modal-img").src               = img;
  document.getElementById("modal-img").alt               = nome;
  document.getElementById("modal-qtd").textContent       = "1";
  document.getElementById("modal-total-preco").textContent =
    "R$ " + preco.toFixed(2).replace(".", ",");

  // Preço original: só exibe se houver desconto real
  const precoOrigRow = document.getElementById("modal-preco-original").closest(".preco-original");
  if (temDesconto) {
    document.getElementById("modal-preco-original").textContent =
      "R$ " + precoOriginal.toFixed(2).replace(".", ",");
    precoOrigRow.style.display = "";
  } else {
    precoOrigRow.style.display = "none";
  }

  document.getElementById("modal-preco-venda").textContent =
    "R$ " + preco.toFixed(2).replace(".", ",");

  // Parcelamento — apenas para compras acima de R$150 (política da loja)
  const parcelaEl = document.getElementById("modal-parcela");
  if (parcelaEl) {
    if (preco >= 150) {
      const vlParcela = (preco / 3).toFixed(2).replace(".", ",");
      parcelaEl.textContent = "3x de R$ " + vlParcela + " sem juros";
      parcelaEl.style.display = "block";
    } else {
      parcelaEl.style.display = "none";
    }
  }

  const desconto = temDesconto ? calcularDesconto(precoOriginal, preco) : 0;
  const badge = document.getElementById("modal-badge-off");
  badge.textContent   = desconto > 0 ? desconto + "% OFF" : "";
  badge.style.display = desconto > 0 ? "block" : "none";

  const linkPagina = document.getElementById("modal-link-pagina");
  if (linkPagina) linkPagina.href = "/produto/" + slugify(nome);

  // Estoque
  const esgotado = card.dataset.estoque === "0";
  let avisoEl = document.getElementById("modal-esgotado-aviso");
  if (!avisoEl) {
    avisoEl = document.createElement("div");
    avisoEl.id = "modal-esgotado-aviso";
    avisoEl.className = "modal-esgotado-aviso";
    avisoEl.textContent = "Este produto está esgotado no momento.";
    const botoesDiv = document.querySelector(".produto-modal__botoes");
    if (botoesDiv) botoesDiv.before(avisoEl);
  }
  avisoEl.style.display = esgotado ? "block" : "none";
  document.querySelector(".btn-comprar-modal").disabled   = esgotado;
  document.querySelector(".btn-carrinho-modal").disabled  = esgotado;

  // Botão "Me avise" para produtos esgotados
  let btnAviso = document.getElementById("btn-me-avise");
  if (!btnAviso) {
    btnAviso = document.createElement("button");
    btnAviso.id = "btn-me-avise";
    btnAviso.className = "btn-me-avise";
    btnAviso.textContent = "🔔 Me avise quando voltar";
    const botoesDiv = document.querySelector(".produto-modal__botoes");
    if (botoesDiv) botoesDiv.after(btnAviso);
    btnAviso.addEventListener("click", () => abrirFormAviso(modalProdutoAtual?.nome));
  }
  btnAviso.style.display = esgotado ? "flex" : "none";

  document.getElementById("modal-produto").style.display = "flex";
  document.body.style.overflow = "hidden";

  _carregarAvaliacoes(nome);
  _inicializarFormAvaliacao();
  _carregarRelacionados(card);
}

async function abrirFormAviso(nomeProduto) {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const email = usuario?.email;
  if (!email) {
    mostrarMensagem("Faça login para receber o aviso de reposição.", "erro");
    return;
  }
  try {
    const r = await fetch("/api/estoque/avisar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, produto: nomeProduto }),
    });
    const d = await r.json();
    mostrarMensagem(d.mensagem || d.erro || "Aviso registrado!", d.erro ? "erro" : "sucesso");
  } catch { mostrarMensagem("Erro ao registrar aviso. Tente novamente.", "erro"); }
}

function fecharModalProduto(e) {
  if (e && e.target !== document.getElementById("modal-produto")) return;
  document.getElementById("modal-produto").style.display = "none";
  document.body.style.overflow = "";
}

function atualizarTotalModal() {
  const total = (modalProdutoAtual.preco * modalQtd).toFixed(2).replace(".", ",");
  document.getElementById("modal-total-preco").textContent = "R$ " + total;
}

function mudarQtdModal(delta) {
  modalQtd = Math.max(1, modalQtd + delta);
  document.getElementById("modal-qtd").textContent = modalQtd;
  atualizarTotalModal();
}

function comprarModal() {
  if (!modalProdutoAtual) return;
  adicionarAoCarrinho(modalProdutoAtual.nome, modalProdutoAtual.preco, modalProdutoAtual.img, modalQtd, modalProdutoAtual.precoOriginal);
  fecharModalProduto();
  setTimeout(() => window.location.href = "/carrinho", 800);
}

function adicionarCarrinhoModal() {
  if (!modalProdutoAtual) return;
  adicionarAoCarrinho(modalProdutoAtual.nome, modalProdutoAtual.preco, modalProdutoAtual.img, modalQtd, modalProdutoAtual.precoOriginal);
  fecharModalProduto();
}

// =========================
// AVALIAÇÕES
// =========================
function _carregarRelacionados(cardAtual) {
  const area = document.getElementById("modal-relacionados-area");
  const lista = document.getElementById("relacionados-lista");
  if (!area || !lista) return;

  const editora = cardAtual.dataset.editora;
  const nomeAtual = cardAtual.dataset.nome;

  const todos = Array.from(document.querySelectorAll(".card-produto[data-nome]"));
  const relacionados = todos
    .filter(c => c.dataset.editora === editora && c.dataset.nome !== nomeAtual && c.dataset.estoque !== "0")
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  if (relacionados.length === 0) { area.style.display = "none"; return; }

  area.style.display = "block";
  lista.innerHTML = relacionados.map(c => {
    const nome = c.dataset.nome;
    const preco = parseFloat(c.dataset.preco).toFixed(2).replace(".", ",");
    const img = c.dataset.img;
    return `
      <div class="relacionado-card" onclick="abrirModalProduto(document.querySelector('[data-nome=\\'${nome.replace(/'/g,"\\'")}\\']'))">
        <img src="${img}" alt="${nome}" loading="lazy" class="relacionado-card__img">
        <div class="relacionado-card__nome">${nome}</div>
        <div class="relacionado-card__preco">R$ ${preco}</div>
      </div>`;
  }).join("");
}

let _avaliacaoNotaSelecionada = 0;

function _carregarAvaliacoes(nomeProduto) {
  const lista = document.getElementById("avaliacao-lista");
  const mediaBox = document.getElementById("avaliacao-media-box");
  if (!lista) return;
  if (!_backendUrl()) { lista.innerHTML = '<p class="avaliacao-vazio">Avaliações disponíveis apenas online.</p>'; return; }
  api("/api/avaliacoes/" + encodeURIComponent(nomeProduto)).then(avaliacoes => {
    if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) {
      lista.innerHTML = '<p class="avaliacao-vazio">Seja o primeiro a avaliar este produto!</p>';
      if (mediaBox) mediaBox.style.display = "none";
      return;
    }
    const media = avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length;
    if (mediaBox) {
      mediaBox.style.display = "flex";
      document.getElementById("avaliacao-estrelas-media").textContent = "★".repeat(Math.round(media)) + "☆".repeat(5 - Math.round(media));
      document.getElementById("avaliacao-nota-media").textContent = media.toFixed(1) + " (" + avaliacoes.length + ")";
    }
    lista.innerHTML = avaliacoes.map(a => {
      const stars = "★".repeat(a.nota) + "☆".repeat(5 - a.nota);
      const data = new Date(a.data).toLocaleDateString("pt-BR");
      return `<div class="avaliacao-item">
        <div class="avaliacao-item__header">
          <span class="avaliacao-item__autor">${a.nome}</span>
          <span class="avaliacao-item__data">${data}</span>
        </div>
        <div class="avaliacao-item__estrelas">${stars}</div>
        ${a.comentario ? `<p class="avaliacao-item__comentario">${a.comentario}</p>` : ""}
      </div>`;
    }).join("");
  });
}

function _inicializarFormAvaliacao() {
  const form = document.getElementById("avaliacao-form");
  const aviso = document.getElementById("avaliacao-login-aviso");
  const starsInput = document.getElementById("avaliacao-stars-input");
  const notaInput = document.getElementById("avaliacao-nota");
  if (!form) return;

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) {
    if (aviso) aviso.style.display = "block";
    form.style.display = "none";
  } else {
    if (aviso) aviso.style.display = "none";
    form.style.display = "block";
    form.reset();
    _avaliacaoNotaSelecionada = 0;
    if (notaInput) notaInput.value = "0";
    document.querySelectorAll(".avaliacao-star").forEach(btn => btn.classList.remove("ativa"));
  }

  if (starsInput) {
    starsInput.querySelectorAll(".avaliacao-star").forEach(btn => {
      btn.onclick = () => {
        _avaliacaoNotaSelecionada = parseInt(btn.dataset.val);
        if (notaInput) notaInput.value = _avaliacaoNotaSelecionada;
        starsInput.querySelectorAll(".avaliacao-star").forEach(b => {
          b.classList.toggle("ativa", parseInt(b.dataset.val) <= _avaliacaoNotaSelecionada);
        });
      };
    });
  }
}

function enviarAvaliacao(e) {
  e.preventDefault();
  const nota = parseInt(document.getElementById("avaliacao-nota").value);
  const comentario = document.getElementById("avaliacao-comentario").value.trim();
  if (!nota || nota < 1) { mostrarMensagem("Selecione uma nota de 1 a 5 estrelas.", "erro"); return; }
  if (!modalProdutoAtual) return;
  const btn = document.querySelector(".avaliacao-btn-enviar");
  if (btn) btn.disabled = true;
  api("/api/avaliacoes/" + encodeURIComponent(modalProdutoAtual.nome), "POST", { nota, comentario })
    .then(res => {
      if (res && !res.erro) {
        mostrarMensagem("Avaliação enviada! Obrigado.");
        document.getElementById("avaliacao-form").style.display = "none";
        _carregarAvaliacoes(modalProdutoAtual.nome);
      } else {
        mostrarMensagem(res?.erro || "Erro ao enviar avaliação.", "erro");
        if (btn) btn.disabled = false;
      }
    }).catch(() => {
      mostrarMensagem("Erro ao enviar avaliação.", "erro");
      if (btn) btn.disabled = false;
    });
}

function toggleFavorito() {
  if (!modalProdutoAtual) return;
  const btn = document.getElementById("btn-favorito");
  const favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
  const idx = favoritos.indexOf(modalProdutoAtual.nome);
  if (idx >= 0) {
    favoritos.splice(idx, 1);
    btn.textContent = "♡ Favorito";
    btn.classList.remove("ativo");
  } else {
    favoritos.push(modalProdutoAtual.nome);
    btn.textContent = "♥ Favorito";
    btn.classList.add("ativo");
  }
  localStorage.setItem("favoritos", JSON.stringify(favoritos));
}

function toggleLista() {
  if (!modalProdutoAtual) return;
  const btn = document.getElementById("btn-lista");
  const lista = JSON.parse(localStorage.getItem("listaDesejos")) || [];
  const idx = lista.indexOf(modalProdutoAtual.nome);
  if (idx >= 0) {
    lista.splice(idx, 1);
    btn.textContent = "☆ Lista de Desejos";
    btn.classList.remove("ativo");
    mostrarMensagem("Removido da lista de desejos.");
  } else {
    lista.push(modalProdutoAtual.nome);
    btn.textContent = "★ Lista de Desejos";
    btn.classList.add("ativo");
    mostrarMensagem("Adicionado à lista de desejos!");
  }
  localStorage.setItem("listaDesejos", JSON.stringify(lista));
}

function atualizarEstadoFavorito(nome) {
  const favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
  const lista = JSON.parse(localStorage.getItem("listaDesejos")) || [];
  const btnFav = document.getElementById("btn-favorito");
  const btnLista = document.getElementById("btn-lista");
  if (btnFav) {
    btnFav.textContent = favoritos.includes(nome) ? "♥ Favorito" : "♡ Favorito";
    favoritos.includes(nome) ? btnFav.classList.add("ativo") : btnFav.classList.remove("ativo");
  }
  if (btnLista) {
    btnLista.textContent = lista.includes(nome) ? "★ Lista de Desejos" : "☆ Lista de Desejos";
    lista.includes(nome) ? btnLista.classList.add("ativo") : btnLista.classList.remove("ativo");
  }
}

// Fechar modais com ESC
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    const modalProduto = document.getElementById("modal-produto");
    if (modalProduto && modalProduto.style.display !== "none") {
      modalProduto.style.display = "none";
      document.body.style.overflow = "";
    }
    const modalPerfil = document.getElementById("modal-perfil");
    if (modalPerfil && modalPerfil.style.display !== "none") {
      modalPerfil.style.display = "none";
      document.body.style.overflow = "";
    }
  }
});

// =========================
// CADASTRO
// =========================
function alternarTipoConta(tipo) {
  const campoCpf       = document.getElementById("campo-cpf");
  const campoRazao     = document.getElementById("campo-razao");
  const campoEndereco  = document.getElementById("campo-endereco");
  const campoNasc      = document.getElementById("campo-nascimento");
  if (tipo === "juridica") {
    if (campoCpf)      campoCpf.style.display      = "none";
    if (campoRazao)    campoRazao.style.display    = "block";
    if (campoEndereco) campoEndereco.style.display = "none";
    if (campoNasc)     campoNasc.style.display     = "none";
  } else {
    if (campoCpf)      campoCpf.style.display      = "block";
    if (campoRazao)    campoRazao.style.display    = "none";
    if (campoEndereco) campoEndereco.style.display = "block";
    if (campoNasc)     campoNasc.style.display     = "block";
  }
}

function inicializarCadastro() {
  const formCadastro = document.getElementById("form-cadastro");
  if (!formCadastro) return;

  // Lê tipo da URL para pré-selecionar o radio
  const params = new URLSearchParams(window.location.search);
  const tipoUrl = params.get("tipo") || "fisica";
  const radioCorreto = formCadastro.querySelector(`input[name="tipo-conta"][value="${tipoUrl}"]`);
  if (radioCorreto) {
    radioCorreto.checked = true;
    alternarTipoConta(tipoUrl);
  }

  // Define limites do campo data: máximo = hoje, mínimo = 120 anos atrás
  const inputNasc = document.getElementById("nascimento");
  if (inputNasc) {
    const hoje = new Date();
    const maxDate = hoje.toISOString().split("T")[0];
    const minDate = new Date(hoje.getFullYear() - 120, hoje.getMonth(), hoje.getDate()).toISOString().split("T")[0];
    inputNasc.max = maxDate;
    inputNasc.min = minDate;
  }

  ativarValidacaoTempoReal(formCadastro);

  formCadastro.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validarFormCompleto(formCadastro)) {
      mostrarMensagem("Corrija os campos destacados antes de continuar.", "erro");
      return;
    }

    const tipoRadio = formCadastro.querySelector('input[name="tipo-conta"]:checked');
    const tipo = tipoRadio ? tipoRadio.value : "fisica";
    const nome = document.getElementById("nome").value.trim();
    const loginUsuario = (document.getElementById("login-usuario")?.value.trim() || "").toLowerCase();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const senha = document.getElementById("senha").value;
    const confirmarSenha = document.getElementById("confirmar-senha").value;

    if (!nome) { mostrarMensagem("Informe seu nome!", "erro"); return; }
    if (!loginUsuario || !/^[a-zA-Z0-9_\-]{3,30}$/.test(loginUsuario)) {
      mostrarMensagem("Login inválido. Use 3-30 caracteres: letras, números, _ ou -.", "erro"); return;
    }

    // Valida data de nascimento
    const nascimentoEl = document.getElementById("nascimento");
    if (nascimentoEl && nascimentoEl.value && tipo !== "juridica") {
      const nasc = new Date(nascimentoEl.value);
      const hoje = new Date();
      if (nasc > hoje) { mostrarMensagem("Data de nascimento não pode ser no futuro!", "erro"); return; }
    }

    if (senha.length < 6) { mostrarMensagem("A senha deve ter pelo menos 6 caracteres!", "erro"); return; }
    if (senha !== confirmarSenha) { mostrarMensagem("As senhas não coincidem!", "erro"); return; }

    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    if (usuarios.find((u) => u.email === email)) {
      mostrarMensagem("Esse e-mail já está cadastrado!", "erro");
      return;
    }
    if (loginUsuario && usuarios.find((u) => u.login === loginUsuario)) {
      mostrarMensagem("Esse nome de usuário já está em uso!", "erro");
      return;
    }

    hashSenha(senha).then(senhaHash => {
      const novoUsuario = {
        nome: sanitizar(nome),
        login: loginUsuario,
        nomeExibido: loginUsuario, // nome que aparece no header
        email: sanitizar(email),
        senha: senhaHash,
        _senhaPlain: senha,
        tipo,
        status: tipo === "juridica" ? "pendente" : "aprovado"
      };

      if (tipo === "juridica") {
        const razao = document.getElementById("razao-social")?.value.trim();
        const cnpj = document.getElementById("cnpj")?.value.trim();
        if (razao) novoUsuario.razaoSocial = sanitizar(razao);
        if (cnpj) novoUsuario.cnpj = sanitizar(cnpj);
      } else {
        const cpf = document.getElementById("cpf")?.value.trim();
        if (cpf) novoUsuario.cpf = sanitizar(cpf);

        novoUsuario.endereco = {
          cep:         sanitizar(document.getElementById("cep")?.value.trim()         || ""),
          rua:         sanitizar(document.getElementById("rua")?.value.trim()         || ""),
          numero:      sanitizar(document.getElementById("numero")?.value.trim()      || ""),
          complemento: sanitizar(document.getElementById("complemento")?.value.trim() || ""),
          bairro:      sanitizar(document.getElementById("bairro")?.value.trim()      || ""),
          cidade:      sanitizar(document.getElementById("cidade")?.value.trim()      || ""),
          estado:      sanitizar(document.getElementById("estado")?.value.trim().toUpperCase() || ""),
        };
      }

      // Abre modal de aceite de termos antes de salvar a conta
      abrirModalTermos(novoUsuario, usuarios, tipo);
    });
  });
}

// =========================
// MODAL ACEITE DE TERMOS
// =========================
function abrirModalTermos(novoUsuario, usuarios, tipo) {
  const overlay = document.createElement("div");
  overlay.className = "termos-modal-overlay";
  overlay.id = "termos-modal-overlay";

  overlay.innerHTML =
    '<div class="termos-modal">' +
      '<h2 class="termos-modal__titulo">Antes de continuar</h2>' +
      '<p class="termos-modal__sub">Leia os pontos principais e confirme antes de criar sua conta.</p>' +
      '<ul class="termos-modal__lista">' +
        '<li><span>🔞</span><span>Esta plataforma é exclusiva para <strong>maiores de 18 anos</strong>. Declaração falsa sujeita às penalidades do Art. 299 do Código Penal.</span></li>' +
        '<li><span>🔒</span><span>Sua senha é protegida com criptografia SHA-256. Nunca a compartilhamos.</span></li>' +
        '<li><span>📦</span><span>Seus dados de entrega são usados apenas para processar pedidos.</span></li>' +
        '<li><span>🚫</span><span>Não vendemos seus dados para terceiros (LGPD — Lei nº 13.709/2018).</span></li>' +
        '<li><span>↩️</span><span>Direito de devolução em até 7 dias após o recebimento (CDC, Art. 49).</span></li>' +
        '<li><span>⚖️</span><span>Transações acima de R$ 10.000,00 podem exigir documentação adicional (COAF).</span></li>' +
      '</ul>' +
      '<p class="termos-modal__links">' +
        'Leia na íntegra: ' +
        '<a href="/termos" target="_blank">Termos e Condições de Uso</a> e ' +
        '<a href="/privacidade" target="_blank">Política de Privacidade</a>.' +
      '</p>' +
      '<div class="termos-modal__check-row">' +
        '<input type="checkbox" id="check-maior-idade">' +
        '<label for="check-maior-idade">Declaro, sob as penas da lei, que sou <strong>maior de 18 anos</strong> e possuo plena capacidade civil para contratar (Art. 5º do Código Civil).</label>' +
      '</div>' +
      '<div class="termos-modal__check-row">' +
        '<input type="checkbox" id="check-aceite-termos">' +
        '<label for="check-aceite-termos">Li, compreendi e concordo integralmente com os <strong>Termos e Condições de Uso</strong> e a <strong>Política de Privacidade</strong> da Comic Geek Store.</label>' +
      '</div>' +
      '<div class="termos-modal__btns">' +
        '<button class="termos-btn-cancelar" onclick="fecharModalTermos()">Cancelar</button>' +
        '<button class="termos-btn-aceitar" id="btn-aceitar-termos" disabled onclick="confirmarAceiteTermos()">Criar Conta</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // Habilita botão somente quando AMBOS os checkboxes estiverem marcados
  function verificarChecks() {
    var idade  = document.getElementById("check-maior-idade").checked;
    var termos = document.getElementById("check-aceite-termos").checked;
    document.getElementById("btn-aceitar-termos").disabled = !(idade && termos);
  }
  document.getElementById("check-maior-idade").addEventListener("change", verificarChecks);
  document.getElementById("check-aceite-termos").addEventListener("change", verificarChecks);

  // Salva dados pendentes para usar ao confirmar
  window._pendingUsuario = novoUsuario;
  window._pendingUsuarios = usuarios;
  window._pendingTipo = tipo;
}

function fecharModalTermos() {
  const overlay = document.getElementById("termos-modal-overlay");
  if (overlay) overlay.remove();
  window._pendingUsuario = null;
  window._pendingUsuarios = null;
  window._pendingTipo = null;
}

function confirmarAceiteTermos() {
  const novoUsuario = window._pendingUsuario;
  const usuarios = window._pendingUsuarios;
  const tipo = window._pendingTipo;
  if (!novoUsuario || !usuarios) return;

  novoUsuario.termosAceitos = true;
  novoUsuario.termosAceitosEm = new Date().toISOString();
  novoUsuario.maiorIdadeDeclarado = true;

  fecharModalTermos();

  if (_backendUrl()) {
    const dadosApi = { ...novoUsuario, senha: novoUsuario._senhaPlain };
    delete dadosApi._senhaPlain;

    api("/api/auth/cadastro", "POST", dadosApi).then(data => {
      if (!data) { mostrarMensagem("Erro ao conectar com o servidor. Verifique sua internet.", "erro"); return; }
      if (data.token) {
        _salvarSessao(data.token, data.usuario);
        mostrarMensagem("Conta criada com sucesso!");
        setTimeout(() => (window.location.href = "/"), 1500);
      } else {
        const msgs = {
          "E-mail já cadastrado": "Este e-mail já possui uma conta. Tente fazer login.",
          "Campos obrigatórios faltando": "Preencha todos os campos obrigatórios.",
        };
        mostrarMensagem(msgs[data.erro] || data.erro || "Erro ao criar conta. Tente novamente.", "erro");
      }
    });
    return;
  }

  // Fallback local
  usuarios.push(novoUsuario);
  localStorage.setItem("usuarios", JSON.stringify(usuarios));
  _salvarSessao(null, { nome: novoUsuario.nome, email: novoUsuario.email, tipo });
  mostrarMensagem("Conta criada com sucesso!");
  setTimeout(() => (window.location.href = "/"), 1500);
}

// =========================
// LOGIN
// =========================
const formLogin = document.getElementById("dados-entrar");

if (formLogin) {
  ativarValidacaoTempoReal(formLogin);

  formLogin.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validarFormCompleto(formLogin)) return;

    const identificador = document.getElementById("email").value.trim().toLowerCase();
    const senha = document.getElementById("senha").value;

    if (_backendUrl()) {
      api("/api/auth/login", "POST", { identificador, senha }).then(data => {
        if (!data) { mostrarMensagem("Erro ao conectar com o servidor.", "erro"); return; }
        if (data.token) {
          _salvarSessao(data.token, data.usuario);
          if (data.usuario.tipo === "admin") {
            mostrarMensagem("Bem-vindo, Admin!");
            setTimeout(() => (window.location.href = "/admin"), 1000);
          } else {
            mostrarMensagem("Login realizado com sucesso!");
            const destino = data.usuario.tipo === "juridica" ? "/vender" : "/";
            setTimeout(() => (window.location.href = destino), 1200);
          }
        } else {
          mostrarMensagem(data.erro || "Login ou senha inválidos!", "erro");
        }
      });
      return;
    }

    // Fallback local
    const chave = "tentativas_login";
    const status = verificarTentativas(chave);
    if (status.bloqueado) { mostrarMensagem(status.mensagem, "erro"); return; }
    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    hashSenha(senha).then(senhaHash => {
      const usuario = usuarios.find((u) => (u.email === identificador || u.login === identificador) && u.senha === senhaHash);
      if (usuario) {
        limparTentativas(chave);
        _salvarSessao(null, { nome: usuario.nome, email: usuario.email, tipo: usuario.tipo });
        mostrarMensagem("Login realizado com sucesso!");
        setTimeout(() => (window.location.href = "/"), 1500);
      } else {
        registrarTentativaFalha(chave);
        const statusAtual = JSON.parse(localStorage.getItem(chave)) || {};
        const restantes = 5 - (statusAtual.tentativas || 0);
        mostrarMensagem(`Login/e-mail ou senha inválidos! ${restantes > 0 ? restantes + " tentativas restantes." : ""}`, "erro");
      }
    });
  });
}

// =========================
// ADMIN
// =========================
function inicializarAdmin() {
  const painel = document.getElementById("admin-painel");
  if (!painel) return;

  const u = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  if (!u || u.tipo !== "admin") {
    window.location.href = "/login?redirect=admin";
    return;
  }

  painel.style.display = "flex";
  carregarPainelAdmin();
}

function logoutAdmin() {
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("cgs_token");
  window.location.href = "/login";
}

function mostrarAba(aba) {
  document.querySelectorAll(".admin-aba").forEach(a => a.style.display = "none");
  document.querySelectorAll(".admin-nav__item").forEach(b => b.classList.remove("ativo"));
  document.getElementById("aba-" + aba).style.display = "block";
  const btns = document.querySelectorAll(".admin-nav__item");
  const abas = ["produtos","pedidos","usuarios","aprovacoes","admins","cupons"];
  btns[abas.indexOf(aba)]?.classList.add("ativo");

  if (aba === "pedidos")    carregarPedidosAdmin();
  if (aba === "usuarios")   carregarUsuariosAdmin();
  if (aba === "aprovacoes") carregarAprovacoes();
  if (aba === "admins")     carregarAdmins();
  if (aba === "cupons")     carregarCupons();
}

function carregarPainelAdmin() {
  carregarTabelaProdutos();
  atualizarStats();
  atualizarBadgeAprovacoes();
}

function atualizarStats() {
  api("/api/admin/stats").then(data => {
    if (!data) return;
    const el = (id) => document.getElementById(id);
    if (el("stat-total-produtos")) el("stat-total-produtos").textContent = data.totalProdutos ?? 0;
    if (el("stat-total-pedidos"))  el("stat-total-pedidos").textContent  = data.totalPedidos  ?? 0;
    if (el("stat-total-usuarios")) el("stat-total-usuarios").textContent = data.totalUsuarios ?? 0;
  });
}

// ---- APROVAÇÕES PJ ----

function atualizarBadgeAprovacoes() {
  const badge = document.getElementById("badge-pendentes");
  if (!badge) return;
  api("/api/admin/aprovacoes").then(data => {
    const count = Array.isArray(data) ? data.length : 0;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  });
}

function carregarAprovacoes() {
  const lista = document.getElementById("admin-lista-aprovacoes");
  const vazio = document.getElementById("admin-aprovacoes-vazio");
  if (!lista) return;

  api("/api/admin/aprovacoes").then(pendentes => {
    atualizarBadgeAprovacoes();

    if (!Array.isArray(pendentes) || pendentes.length === 0) {
      lista.innerHTML = "";
      if (vazio) vazio.style.display = "block";
      return;
    }

    if (vazio) vazio.style.display = "none";
    lista.innerHTML = pendentes.map(u => {
      const end = u.endereco || {};
      const enderecoTxt = [end.rua, end.numero, end.bairro, end.cidade, end.estado].filter(Boolean).join(", ") || "—";
      const dataCadastro = u.criadoEm ? new Date(u.criadoEm).toLocaleDateString("pt-BR") : "—";

      return `
      <div class="aprovacao-card">
        <div class="aprovacao-card__avatar">${u.nome.charAt(0).toUpperCase()}</div>
        <div class="aprovacao-card__info">
          <h3>${u.nome}</h3>

          <div class="aprovacao-secao">
            <span class="aprovacao-secao__titulo">Dados da Empresa</span>
            <p><span class="aprovacao-label">Razão Social</span> ${u.razaoSocial || "—"}</p>
            <p><span class="aprovacao-label">CNPJ</span> ${u.cnpj || "—"}</p>
          </div>

          <div class="aprovacao-secao">
            <span class="aprovacao-secao__titulo">Endereço Comercial</span>
            <p><span class="aprovacao-label">Endereço</span> ${enderecoTxt}</p>
            ${end.cep ? `<p><span class="aprovacao-label">CEP</span> ${end.cep}</p>` : ""}
            ${end.complemento ? `<p><span class="aprovacao-label">Complemento</span> ${end.complemento}</p>` : ""}
          </div>

          <div class="aprovacao-secao">
            <span class="aprovacao-secao__titulo">Acesso</span>
            <p><span class="aprovacao-label">E-mail</span> ${u.email}</p>
            <p><span class="aprovacao-label">Login</span> ${u.login || "—"}</p>
            <p><span class="aprovacao-label">Cadastrado em</span> ${dataCadastro}</p>
          </div>
        </div>
        <div class="aprovacao-card__acoes">
          <button class="btn-aprovar-vend" onclick="aprovarVendedor('${encodeURIComponent(u.email)}')">✓ Aprovar</button>
          <button class="btn-rejeitar-vend" onclick="rejeitarVendedor('${encodeURIComponent(u.email)}')">✕ Rejeitar</button>
        </div>
      </div>`;
    }).join("");
  });
}

function aprovarVendedor(emailEnc) {
  const email = decodeURIComponent(emailEnc);
  const adminLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  api(`/api/admin/aprovacoes/${encodeURIComponent(email)}/aprovar`, "PUT", {
    aprovadoPor: adminLogado?.login || adminLogado?.nome || "admin",
  }).then(data => {
    if (!data || data.erro) { mostrarMensagem(data?.erro || "Erro ao aprovar.", "erro"); return; }
    mostrarMensagem("Vendedor aprovado com sucesso!");
    carregarAprovacoes();
    atualizarBadgeAprovacoes();
  });
}

function rejeitarVendedor(emailEnc) {
  const email = decodeURIComponent(emailEnc);
  const adminLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  api(`/api/admin/aprovacoes/${encodeURIComponent(email)}/rejeitar`, "PUT", {
    rejeitadoPor: adminLogado?.login || adminLogado?.nome || "admin",
  }).then(data => {
    if (!data || data.erro) { mostrarMensagem(data?.erro || "Erro ao rejeitar.", "erro"); return; }
    mostrarMensagem("Cadastro rejeitado.");
    carregarAprovacoes();
    atualizarBadgeAprovacoes();
  });
}

// ---- ADMINS CADASTRADOS ----

function carregarAdmins() {
  const tbody = document.getElementById("admin-tabela-admins");
  const vazio = document.getElementById("admin-admins-vazio");
  if (!tbody) return;

  api("/api/admin/admins").then(admins => {
    if (!Array.isArray(admins) || admins.length === 0) {
      tbody.innerHTML = "";
      if (vazio) vazio.style.display = "block";
      return;
    }
    if (vazio) vazio.style.display = "none";
    tbody.innerHTML = admins.map(a => {
      const data = a.criadoEm ? new Date(a.criadoEm).toLocaleDateString("pt-BR") : "—";
      return `
        <tr>
          <td><strong>${a.nome}</strong></td>
          <td><code style="background:#f3ebff;padding:2px 8px;border-radius:4px;color:var(--cor-primaria)">${a.login}</code></td>
          <td>${data}</td>
          <td>
            <div class="admin-tabela__acoes">
              <button class="btn-excluir-prod" onclick="excluirAdmin('${a.login}')">Remover</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  });
}

function toggleFormAdmin() {
  const box = document.getElementById("admin-form-novo-admin");
  if (!box) return;
  const visivel = box.style.display !== "none";
  box.style.display = visivel ? "none" : "block";
  if (!visivel) document.getElementById("form-novo-admin").reset();
}

function salvarNovoAdmin(e) {
  e.preventDefault();
  const nome   = document.getElementById("admin-novo-nome").value.trim();
  const login  = document.getElementById("admin-novo-login").value.trim().toLowerCase();
  const senha  = document.getElementById("admin-novo-senha").value;
  const confirm = document.getElementById("admin-novo-senha-confirm").value;

  if (senha !== confirm) { mostrarMensagem("As senhas não coincidem!", "erro"); return; }
  if (senha.length < 6)  { mostrarMensagem("Senha deve ter no mínimo 6 caracteres!", "erro"); return; }

  api("/api/admin/admins", "POST", { nome, login, senha }).then(data => {
    if (!data || data.erro) { mostrarMensagem(data?.erro || "Erro ao cadastrar.", "erro"); return; }
    mostrarMensagem("Admin cadastrado com sucesso!");
    toggleFormAdmin();
    carregarAdmins();
  });
}

function excluirAdmin(login) {
  if (!confirm(`Remover o admin "${login}"?`)) return;
  api(`/api/admin/admins/${encodeURIComponent(login)}`, "DELETE").then(data => {
    if (data?.mensagem) { mostrarMensagem("Admin removido."); carregarAdmins(); }
    else mostrarMensagem("Erro ao remover.", "erro");
  });
}

// ---- CUPONS ADMIN ----

function carregarCupons() {
  const tbody = document.getElementById("admin-tabela-cupons");
  const vazio = document.getElementById("admin-cupons-vazio");
  if (!tbody) return;
  api("/api/admin/cupons").then(data => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = "";
      if (vazio) vazio.style.display = "block";
      return;
    }
    if (vazio) vazio.style.display = "none";
    tbody.innerHTML = data.map(c => `
      <tr>
        <td><strong>${c.codigo}</strong></td>
        <td>${c.desconto}%</td>
        <td><button class="btn-admin-excluir" onclick="excluirCupom('${c.codigo}')">Excluir</button></td>
      </tr>`).join("");
  });
}

function toggleFormCupom() {
  const box = document.getElementById("admin-form-cupom");
  if (!box) return;
  const vis = box.style.display !== "none";
  box.style.display = vis ? "none" : "block";
  if (!vis) document.getElementById("form-admin-cupom").reset();
}

function salvarCupom(e) {
  e.preventDefault();
  const codigo   = document.getElementById("admin-cupom-codigo").value.trim().toUpperCase();
  const desconto = parseFloat(document.getElementById("admin-cupom-desconto").value);
  if (!codigo || !desconto) return;
  api("/api/admin/cupons", "POST", { codigo, desconto }).then(data => {
    if (!data || data.erro) { mostrarMensagem(data?.erro || "Erro ao salvar cupom.", "erro"); return; }
    mostrarMensagem("Cupom criado com sucesso!");
    toggleFormCupom();
    carregarCupons();
  });
}

function excluirCupom(codigo) {
  if (!confirm(`Excluir o cupom "${codigo}"?`)) return;
  api(`/api/admin/cupons/${encodeURIComponent(codigo)}`, "DELETE").then(() => {
    mostrarMensagem("Cupom excluído.");
    carregarCupons();
  });
}

// ---- PRODUTOS ADMIN ----

function toggleFormProduto() {
  const box = document.getElementById("admin-form-produto");
  if (!box) return;
  const visivel = box.style.display !== "none";
  box.style.display = visivel ? "none" : "block";
  if (!visivel) {
    document.getElementById("form-admin-produto").reset();
    document.getElementById("admin-prod-id").value = "";
    document.getElementById("admin-form-titulo").textContent = "Cadastrar Novo Produto";
  }
}

let _adminProdutosCache = [];

function _renderTabelaProdutos(todos) {
  const tbody = document.getElementById("admin-tabela-produtos");
  const vazio = document.getElementById("admin-produtos-vazio");
  if (!tbody) return;

  if (todos.length === 0) {
    tbody.innerHTML = "";
    if (vazio) vazio.style.display = "block";
    return;
  }
  if (vazio) vazio.style.display = "none";

  tbody.innerHTML = todos.map(p => `
    <tr>
      <td><img src="../${p.img}" class="admin-tabela__img" onerror="this.src='../img/quadrinhos/batman.png'"></td>
      <td>
        <strong>${p.nome}</strong>
        ${p._origem === "vendedor" ? '<span class="badge-vendedor">Vendedor</span>' : ""}
      </td>
      <td><span class="admin-tabela__badge badge-${p.editora || p.categoria}">${(p.editora || p.categoria || "—").toUpperCase()}</span></td>
      <td><span class="badge-secao">${p.secao || p.categoria || "—"}</span></td>
      <td>
        ${p.precoOriginal ? `<span style="text-decoration:line-through;color:#aaa;font-size:12px">R$${parseFloat(p.precoOriginal).toFixed(2).replace(".",",")}</span><br>` : ""}
        <strong>R$${parseFloat(p.preco).toFixed(2).replace(".",",")}</strong>
      </td>
      <td>
        <div class="admin-tabela__acoes">
          <button class="btn-editar-prod" onclick="editarProduto(${p.id})">Editar</button>
          <button class="btn-excluir-prod" onclick="excluirProduto(${p.id})">Excluir</button>
        </div>
      </td>
    </tr>`).join("");
}

function carregarTabelaProdutos() {
  const tbody = document.getElementById("admin-tabela-produtos");
  if (!tbody) return;
  atualizarStats();

  api("/api/produtos").then(lista => {
    const todos = (Array.isArray(lista) ? lista : []).map(p => ({
      ...p,
      _origem: p.vendedorEmail ? "vendedor" : "admin",
    }));
    _adminProdutosCache = todos;
    _renderTabelaProdutos(todos);
  });
}

function editarProduto(id) {
  const p = _adminProdutosCache.find(x => String(x.id) === String(id));
  if (!p) return;

  document.getElementById("admin-prod-id").value             = p.id;
  document.getElementById("admin-prod-nome").value           = p.nome;
  document.getElementById("admin-prod-editora").value        = p.editora || p.categoria || "marvel";
  document.getElementById("admin-prod-preco-original").value = p.precoOriginal || p.preco;
  if (p.precoOriginal && p.precoOriginal > p.preco) {
    const desc = Math.round((1 - p.preco / p.precoOriginal) * 100);
    document.getElementById("admin-prod-desconto").value = desc;
  } else {
    document.getElementById("admin-prod-desconto").value = "";
  }
  document.getElementById("admin-prod-preco").value          = p.preco;
  document.getElementById("admin-prod-secao").value          = p.secao || p.categoria || "lancamentos";
  document.getElementById("admin-prod-img").value            = p.img;
  document.getElementById("admin-prod-estoque").value        = p.estoque != null ? p.estoque : "";
  const dataLancEl = document.getElementById("admin-prod-data-lancamento");
  if (dataLancEl) dataLancEl.value = p.dataLancamento ? p.dataLancamento.substring(0, 10) : "";
  document.getElementById("admin-form-titulo").textContent   = "Editar Produto";

  const box = document.getElementById("admin-form-produto");
  box.style.display = "block";
  box.scrollIntoView({ behavior: "smooth" });
}

function excluirProduto(id) {
  if (!confirm("Tem certeza que deseja excluir este produto?")) return;
  api("/api/produtos/" + id, "DELETE").then(res => {
    if (!res) { mostrarMensagem("Erro ao excluir produto.", "erro"); return; }
    carregarTabelaProdutos();
    mostrarMensagem("Produto excluído.");
  });
}

function calcularPrecoAdmin() {
  const original = parseFloat(document.getElementById("admin-prod-preco-original")?.value) || 0;
  const desconto = parseFloat(document.getElementById("admin-prod-desconto")?.value) || 0;
  const campoPreco = document.getElementById("admin-prod-preco");
  if (!campoPreco) return;
  if (original > 0) {
    const final = desconto > 0 ? (original * (1 - desconto / 100)).toFixed(2) : original.toFixed(2);
    campoPreco.value = final;
  }
}

function salvarProdutoAdmin(e) {
  e.preventDefault();
  const id            = document.getElementById("admin-prod-id").value;
  const nome          = document.getElementById("admin-prod-nome").value.trim();
  const editora       = document.getElementById("admin-prod-editora").value;
  const precoOriginal = document.getElementById("admin-prod-preco-original").value;
  const desconto      = parseFloat(document.getElementById("admin-prod-desconto")?.value) || 0;
  const preco         = document.getElementById("admin-prod-preco").value;
  const secao         = document.getElementById("admin-prod-secao").value;
  const img           = document.getElementById("admin-prod-img").value.trim();
  const estoqueVal    = document.getElementById("admin-prod-estoque")?.value;
  const estoque       = estoqueVal !== "" && estoqueVal != null ? parseInt(estoqueVal) : null;
  const dataLancamento = document.getElementById("admin-prod-data-lancamento")?.value || null;

  if (!nome || !preco || !precoOriginal || !img) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  const payload = { nome, editora, precoOriginal: parseFloat(precoOriginal), preco: parseFloat(preco), secao, img, estoque, esgotado: estoque === 0, dataLancamento };

  const req = id
    ? api("/api/produtos/" + id, "PUT", payload)
    : api("/api/produtos", "POST", payload);

  req.then(res => {
    if (!res || res.erro) { mostrarMensagem("Erro ao salvar produto.", "erro"); return; }
    toggleFormProduto();
    carregarTabelaProdutos();
    mostrarMensagem("Produto salvo com sucesso!");
  });
}

// ---- PEDIDOS ADMIN ----

function carregarPedidosAdmin() {
  const container = document.getElementById("admin-lista-pedidos");
  const vazio     = document.getElementById("admin-pedidos-vazio");
  if (!container) return;

  api("/api/admin/pedidos").then(pedidos => {
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      container.innerHTML = "";
      if (vazio) vazio.style.display = "block";
      return;
    }
    if (vazio) vazio.style.display = "none";

    const statusCor = { aprovado: "#2ecc71", pendente: "#f39c12", cancelado: "#e74c3c" };
    const statusLabel = { aprovado: "✓ Pago", pendente: "⏳ Pendente", cancelado: "✕ Cancelado" };

    container.innerHTML = pedidos.slice().reverse().map(p => {
      const st = p.status || "aprovado";
      const cor = statusCor[st] || "#aaa";
      const label = statusLabel[st] || st;
      const data = p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—";
      return `
      <div class="admin-pedido-card">
        <div class="admin-pedido-card__header">
          <div>
            <strong>#${p.numero || p.id}</strong>
            <span style="margin-left:12px">${data}</span>
          </div>
          <div>
            <span>👤 ${p.email || p.nomeComprador || "—"}</span>
            <span style="margin-left:12px;background:${cor};color:white;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">${label}</span>
          </div>
        </div>
        <div class="admin-pedido-card__body">
          ${(p.itens || []).map(i => `
            <div class="admin-pedido-item">
              <span>${i.nome} × ${i.qtd}</span>
              <span>R$ ${(i.preco * i.qtd).toFixed(2).replace(".",",")}</span>
            </div>`).join("")}
          <div class="admin-pedido-total">Total: R$ ${(p.total || 0).toFixed(2).replace(".",",")}</div>
        </div>
      </div>`;
    }).join("");
  });
}

// ---- USUÁRIOS ADMIN ----

let _adminUsuarioCache = [];

function carregarUsuariosAdmin() {
  const tbody = document.getElementById("admin-tabela-usuarios");
  const vazio = document.getElementById("admin-usuarios-vazio");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:20px">Carregando...</td></tr>`;

  api("/api/admin/usuarios").then(usuarios => {
    if (!Array.isArray(usuarios)) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#e74c3c;padding:20px">Erro ao carregar usuários. Verifique se está logado como admin.</td></tr>`;
      return;
    }
    _adminUsuarioCache = usuarios;

    if (usuarios.length === 0) {
      tbody.innerHTML = "";
      if (vazio) vazio.style.display = "block";
      return;
    }
    if (vazio) vazio.style.display = "none";

    const statusLabel = { aprovado: "✓ Aprovado", pendente: "⏳ Pendente", rejeitado: "✕ Rejeitado" };
    const statusCor   = { aprovado: "#e8f5e9;color:#27ae60", pendente: "#fff3e0;color:#e67e22", rejeitado: "#fdecea;color:#e74c3c" };
    tbody.innerHTML = usuarios.map(u => {
      const statusBadge = u.tipo === "juridica"
        ? `<span class="admin-tabela__badge" style="background:${statusCor[u.status] || "#eee;color:#999"};margin-left:6px">${statusLabel[u.status] || u.status}</span>`
        : "";
      const aprovInfo = u.tipo === "juridica" && u.aprovadoPor
        ? `<br><small style="color:#27ae60">✓ por ${u.aprovadoPor} em ${new Date(u.aprovadoEm).toLocaleDateString("pt-BR")}</small>`
        : u.tipo === "juridica" && u.rejeitadoPor
        ? `<br><small style="color:#e74c3c">✕ por ${u.rejeitadoPor} em ${new Date(u.rejeitadoEm).toLocaleDateString("pt-BR")}</small>`
        : "";
      return `
        <tr>
          <td><strong>${u.nome}</strong><br><small style="color:#aaa">${u.login || ""}</small></td>
          <td>${u.email}${u.razaoSocial ? `<br><small style="color:#888">${u.razaoSocial}</small>` : ""}</td>
          <td>
            <span class="admin-tabela__badge" style="background:#f3ebff;color:var(--cor-primaria)">${u.tipo === "juridica" ? "🏢 Jurídica" : "👤 Física"}</span>
            ${statusBadge}${aprovInfo}
          </td>
          <td>
            <div class="admin-tabela__acoes">
              <button class="btn-editar-prod" onclick="editarUsuarioAdmin('${encodeURIComponent(u.email)}')">Editar</button>
              <button class="btn-excluir-prod" onclick="excluirUsuarioAdmin('${encodeURIComponent(u.email)}')">Excluir</button>
            </div>
          </td>
        </tr>`;
    }).join("");

    atualizarStats();
  });
}

function editarUsuarioAdmin(emailEnc) {
  const email = decodeURIComponent(emailEnc);
  const u = _adminUsuarioCache.find(x => x.email === email);
  if (!u) return;

  const end = u.endereco || {};
  document.getElementById("admin-user-email-original").value = u.email;
  document.getElementById("admin-user-nome").value  = u.nome  || "";
  document.getElementById("admin-user-email").value = u.email || "";
  document.getElementById("admin-user-tipo").value  = u.tipo  || "fisica";
  document.getElementById("admin-user-cpf").value   = u.cpf   || "";
  document.getElementById("admin-user-razao").value = u.razaoSocial || "";
  document.getElementById("admin-user-cnpj").value  = u.cnpj  || "";
  document.getElementById("admin-user-cep").value         = end.cep         || "";
  document.getElementById("admin-user-rua").value         = end.rua         || "";
  document.getElementById("admin-user-numero").value      = end.numero      || "";
  document.getElementById("admin-user-complemento").value = end.complemento || "";
  document.getElementById("admin-user-bairro").value      = end.bairro      || "";
  document.getElementById("admin-user-cidade").value      = end.cidade      || "";
  document.getElementById("admin-user-estado").value      = end.estado      || "";

  // Mostra senha atual mascarada
  const campoSenhaAtual = document.getElementById("admin-user-senha-atual");
  if (campoSenhaAtual) {
    campoSenhaAtual.value = u.senha ? "••••••••" : "";
  }
  document.getElementById("admin-user-senha-nova").value = "";
  document.getElementById("admin-user-senha-confirmar").value = "";

  toggleCamposUsuarioAdmin();

  const box = document.getElementById("admin-form-usuario");
  box.style.display = "block";
  box.scrollIntoView({ behavior: "smooth" });
}

function toggleCamposUsuarioAdmin() {
  const tipo     = document.getElementById("admin-user-tipo")?.value;
  const campoCpf = document.getElementById("admin-user-campo-cpf");
  const campoRazao    = document.getElementById("admin-user-campo-razao");
  const campoEndereco = document.getElementById("admin-user-campo-endereco");
  if (!campoCpf) return;
  if (tipo === "juridica") {
    campoCpf.style.display      = "none";
    campoRazao.style.display    = "";
    campoEndereco.style.display = "none";
  } else {
    campoCpf.style.display      = "";
    campoRazao.style.display    = "none";
    campoEndereco.style.display = "";
  }
}

function fecharFormUsuario() {
  const box = document.getElementById("admin-form-usuario");
  if (box) { box.style.display = "none"; document.getElementById("form-admin-usuario").reset(); }
}

function salvarEdicaoUsuario(e) {
  e.preventDefault();
  const emailOriginal = document.getElementById("admin-user-email-original").value;
  const novoNome  = document.getElementById("admin-user-nome").value.trim();
  const novoEmail = document.getElementById("admin-user-email").value.trim().toLowerCase();
  const tipo      = document.getElementById("admin-user-tipo").value;
  const senhaNova      = document.getElementById("admin-user-senha-nova").value;
  const senhaConfirmar = document.getElementById("admin-user-senha-confirmar").value;

  if (!novoNome || !novoEmail) { mostrarMensagem("Preencha nome e e-mail!", "erro"); return; }

  if (senhaNova) {
    if (senhaNova.length < 6) { mostrarMensagem("A senha deve ter pelo menos 6 caracteres!", "erro"); return; }
    if (senhaNova !== senhaConfirmar) { mostrarMensagem("As senhas não coincidem!", "erro"); return; }
  }

  const payload = { nome: novoNome, email: novoEmail, tipo };

  if (tipo === "juridica") {
    payload.razaoSocial = document.getElementById("admin-user-razao").value.trim();
    payload.cnpj        = document.getElementById("admin-user-cnpj").value.trim();
    payload.status      = "aprovado";
  } else {
    payload.cpf = document.getElementById("admin-user-cpf").value.trim();
    payload.endereco = {
      cep:         document.getElementById("admin-user-cep").value.trim(),
      rua:         document.getElementById("admin-user-rua").value.trim(),
      numero:      document.getElementById("admin-user-numero").value.trim(),
      complemento: document.getElementById("admin-user-complemento").value.trim(),
      bairro:      document.getElementById("admin-user-bairro").value.trim(),
      cidade:      document.getElementById("admin-user-cidade").value.trim(),
      estado:      document.getElementById("admin-user-estado").value.trim().toUpperCase(),
    };
  }

  if (senhaNova) payload.novaSenha = senhaNova;

  api(`/api/admin/usuarios/${encodeURIComponent(emailOriginal)}`, "PUT", payload).then(data => {
    if (!data) { mostrarMensagem("Erro ao salvar.", "erro"); return; }
    fecharFormUsuario();
    carregarUsuariosAdmin();
    document.getElementById("admin-user-senha-nova").value = "";
    document.getElementById("admin-user-senha-confirmar").value = "";
    mostrarMensagem("Usuário atualizado com sucesso!");
  });
}

function excluirUsuarioAdmin(emailEnc) {
  if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
  const email = decodeURIComponent(emailEnc);
  api(`/api/admin/usuarios/${encodeURIComponent(email)}`, "DELETE").then(data => {
    if (data === null || data?.mensagem) {
      carregarUsuariosAdmin();
      mostrarMensagem("Usuário excluído.");
    } else {
      mostrarMensagem("Erro ao excluir.", "erro");
    }
  });
}

// =========================
// PRODUTOS DE VENDEDORES — INDEX
// =========================
function renderizarProdutosVendedores() {
  const lista = document.getElementById("lista-vendedores");
  const grupo = document.getElementById("grupo-vendedores");
  if (!lista || !grupo) return;

  const produtos = JSON.parse(localStorage.getItem("produtosVendedores")) || [];
  if (produtos.length === 0) return;

  grupo.style.display = "block";
  lista.innerHTML = produtos.map((p) => `
    <article class="card-produto"
      data-editora="${p.categoria}"
      data-secao="${p.categoria}"
      data-nome="${p.nome}"
      data-preco="${p.preco}"
      data-img="${p.img}">
      <div class="card-produto__imagem">
        <img src="${p.img}" alt="${p.nome}" onerror="this.src='../img/quadrinhos/batman.png'">
      </div>
      <div class="card-produto__nome"><h3>${p.nome}</h3></div>
      <div class="card-produto__preco">
        <h2>R$${parseFloat(p.preco).toFixed(2).replace(".", ",")}</h2>
      </div>
      <button class="card-produto__btn">+ Adicionar ao Carrinho</button>
    </article>`).join("");
}

// =========================
// PRODUTOS ADMIN — INDEX
// =========================
function renderizarProdutosAdmin() {
  const produtos = JSON.parse(localStorage.getItem("produtosAdmin")) || [];
  if (produtos.length === 0) return;

  // Mapa de seção → lista de cards existente
  const mapaSecao = {
    lancamentos: document.querySelector("#grupo-lancamentos .lista-cards"),
    marvel:      document.querySelector("#grupo-marvel .lista-cards"),
    dc:          document.querySelector("#grupo-dc .lista-cards"),
    prevenda:    document.querySelector("#grupo-prevenda .lista-cards"),
    especiais:   document.querySelector("#grupo-especiais .lista-cards"),
  };

  produtos.forEach(p => {
    const lista = mapaSecao[p.secao];
    if (!lista) return;

    const card = document.createElement("article");
    card.className = "card-produto";
    card.dataset.editora = p.editora;
    card.dataset.secao   = p.secao;
    card.dataset.nome    = p.nome;
    card.dataset.preco   = p.preco;
    card.dataset.img     = p.img;

    const imgSrc = p.img.startsWith("http") ? p.img : p.img;
    card.innerHTML = `
      <div class="card-produto__imagem">
        <img src="${imgSrc}" alt="${p.nome}" onerror="this.src='img/quadrinhos/batman.png'">
      </div>
      <div class="card-produto__nome"><h3>${p.nome}</h3></div>
      <div class="card-produto__preco">
        <h3>R$${parseFloat(p.precoOriginal).toFixed(2).replace(".",",")}</h3>
        <h2>R$${parseFloat(p.preco).toFixed(2).replace(".",",")}</h2>
      </div>
      <button class="card-produto__btn">+ Adicionar ao Carrinho</button>`;

    lista.appendChild(card);
  });
}

// =========================
// VENDER — PÁGINA PJ
// =========================
function calcularPrecoVendedor() {
  const original = parseFloat(document.getElementById("prod-preco-original")?.value) || 0;
  const desconto = parseFloat(document.getElementById("prod-desconto")?.value) || 0;
  const campoPreco = document.getElementById("prod-preco");
  if (!campoPreco) return;
  if (original > 0) {
    const final = desconto > 0 ? (original * (1 - desconto / 100)).toFixed(2) : original.toFixed(2);
    campoPreco.value = final;
  } else {
    campoPreco.value = "";
  }
}

function inicializarVender() {
  const conteudo   = document.getElementById("vender-conteudo");
  const bloqueado  = document.getElementById("vender-bloqueado");
  const pendente   = document.getElementById("vender-pendente");
  const rejeitado  = document.getElementById("vender-rejeitado");
  if (!conteudo) return;

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));

  // Não é PJ
  if (!usuarioLogado || usuarioLogado.tipo !== "juridica") {
    if (conteudo) conteudo.style.display = "none";
    if (bloqueado) bloqueado.style.display = "block";
    return;
  }

  // Oculta tudo enquanto carrega
  if (conteudo) conteudo.style.display = "none";

  // Busca status atualizado do backend
  api("/api/usuarios/perfil").then(perfil => {
    // Se API falhou ou retornou erro, usa status do localStorage como fallback
    const status = (perfil && !perfil.erro) ? (perfil.status || "pendente") : (usuarioLogado.status || "pendente");

    if (status === "rejeitado") {
      if (rejeitado) rejeitado.style.display = "block";
      return;
    }

    if (status !== "aprovado") {
      if (pendente) pendente.style.display = "block";
      return;
    }

    // Aprovado — atualiza localStorage e mostra conteúdo
    const u = { ...usuarioLogado, status: "aprovado" };
    localStorage.setItem("usuarioLogado", JSON.stringify(u));

    if (conteudo) conteudo.style.display = "block";
    renderizarMeusProdutos();
    _inicializarFormProduto(u);
  });
}

function _inicializarFormProduto(usuarioLogado) {

  const formProduto = document.getElementById("form-produto");
  if (formProduto) {
    formProduto.addEventListener("submit", function (e) {
      e.preventDefault();
      const nome          = document.getElementById("prod-nome").value.trim();
      const precoOriginal = parseFloat(document.getElementById("prod-preco-original").value);
      const desconto      = parseFloat(document.getElementById("prod-desconto").value) || 0;
      const preco         = desconto > 0
        ? parseFloat((precoOriginal * (1 - desconto / 100)).toFixed(2))
        : precoOriginal;
      const categoria = document.getElementById("prod-categoria").value;
      const img       = document.getElementById("prod-img").value.trim();
      const descricao = document.getElementById("prod-descricao").value.trim();

      if (!nome || !precoOriginal || !img) {
        mostrarMensagem("Preencha todos os campos obrigatórios!", "erro");
        return;
      }

      const produto = {
        id: Date.now(),
        nome, preco, categoria, img, descricao,
        vendedorEmail: usuarioLogado.email,
        vendedorNome: usuarioLogado.nome
      };
      if (desconto > 0) produto.precoOriginal = precoOriginal;

      const produtos = JSON.parse(localStorage.getItem("produtosVendedores")) || [];
      produtos.push(produto);
      localStorage.setItem("produtosVendedores", JSON.stringify(produtos));

      mostrarMensagem("Produto cadastrado com sucesso!");
      formProduto.reset();
      fecharFormProduto();
      renderizarMeusProdutos();
    });
  }
}

function renderizarMeusProdutos() {
  const lista = document.getElementById("lista-meus-produtos");
  if (!lista) return;

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const todos = JSON.parse(localStorage.getItem("produtosVendedores")) || [];
  const meus = todos.filter(p => p.vendedorEmail === usuarioLogado?.email);

  if (meus.length === 0) {
    lista.innerHTML = `<div class="vender-vazio">Você ainda não cadastrou nenhum produto.<br>Clique em "+ Cadastrar Produto" para começar.</div>`;
    return;
  }

  const todosPedidos = JSON.parse(localStorage.getItem("pedidos")) || [];

  lista.innerHTML = meus.map(p => {
    let qtdVendida = 0;
    todosPedidos.forEach(pedido => {
      pedido.itens.forEach(item => {
        if (item.nome === p.nome) qtdVendida += item.qtd;
      });
    });
    const vendido = qtdVendida > 0;

    return `
    <div class="meu-produto-card">
      <img src="${p.img}" alt="${p.nome}" class="meu-produto-card__img" onerror="this.src='../img/quadrinhos/batman.png'">
      <div class="meu-produto-card__info">
        <h3>${p.nome}</h3>
        <span>${p.descricao || ""}</span>
      </div>
      <span class="meu-produto-card__categoria">${p.categoria}</span>
      <span class="produto-status ${vendido ? "produto-status--vendido" : "produto-status--ativo"}">${vendido ? "Vendido " + qtdVendida + "x" : "Ativo"}</span>
      <span class="meu-produto-card__preco">R$ ${parseFloat(p.preco).toFixed(2).replace(".", ",")}</span>
      <button class="btn-remover-produto" onclick="removerMeuProduto(${p.id})" title="Remover">✕</button>
    </div>`;
  }).join("");
}

function mostrarAbaVender(aba) {
  document.getElementById("aba-anuncios").style.display = aba === "anuncios" ? "block" : "none";
  document.getElementById("aba-vendas").style.display   = aba === "vendas"   ? "block" : "none";
  const abaEnvios = document.getElementById("aba-envios");
  if (abaEnvios) abaEnvios.style.display = aba === "envios" ? "block" : "none";
  document.getElementById("tab-anuncios").classList.toggle("ativo", aba === "anuncios");
  document.getElementById("tab-vendas").classList.toggle("ativo",   aba === "vendas");
  const tabEnvios = document.getElementById("tab-envios");
  if (tabEnvios) tabEnvios.classList.toggle("ativo", aba === "envios");

  const btnNovo = document.getElementById("btn-novo-produto");
  if (btnNovo) btnNovo.style.display = aba === "anuncios" ? "" : "none";

  const formBox = document.getElementById("form-produto-box");
  if (aba !== "anuncios" && formBox) formBox.style.display = "none";

  if (aba === "vendas") renderizarMinhasVendas();
  if (aba === "envios") renderizarEnvios();
}

function renderizarMinhasVendas() {
  const lista = document.getElementById("lista-minhas-vendas");
  if (!lista) return;

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const todosProdutos = JSON.parse(localStorage.getItem("produtosVendedores")) || [];
  const meusProdutos  = todosProdutos.filter(p => p.vendedorEmail === usuarioLogado?.email);

  if (meusProdutos.length === 0) {
    lista.innerHTML = `<div class="vender-vazio">Você não tem produtos anunciados ainda.<br>Vá até "Meus Anúncios" e cadastre seu primeiro produto.</div>`;
    return;
  }

  const todosPedidos = JSON.parse(localStorage.getItem("pedidos")) || [];

  const vendas = meusProdutos.map(p => {
    let qtdVendida = 0;
    let receita = 0;
    todosPedidos.forEach(pedido => {
      pedido.itens.forEach(item => {
        if (item.nome === p.nome) {
          qtdVendida += item.qtd;
          receita    += item.preco * item.qtd;
        }
      });
    });
    return { ...p, qtdVendida, receita };
  });

  const totalAnunciados = vendas.length;
  const totalVendidos   = vendas.reduce((s, v) => s + v.qtdVendida, 0);
  const totalReceita    = vendas.reduce((s, v) => s + v.receita, 0);

  const resumoHtml = `
    <div class="vendas-resumo">
      <div class="vendas-resumo__item">
        <span class="vendas-resumo__label">Anunciados</span>
        <span class="vendas-resumo__valor">${totalAnunciados}</span>
      </div>
      <div class="vendas-resumo__item">
        <span class="vendas-resumo__label">Unidades Vendidas</span>
        <span class="vendas-resumo__valor">${totalVendidos}</span>
      </div>
      <div class="vendas-resumo__item">
        <span class="vendas-resumo__label">Receita Total</span>
        <span class="vendas-resumo__valor">R$ ${totalReceita.toFixed(2).replace(".", ",")}</span>
      </div>
    </div>`;

  const vendasHtml = vendas.map(v => `
    <div class="venda-card">
      <img src="${v.img}" alt="${v.nome}" class="venda-card__img" onerror="this.src='../img/quadrinhos/batman.png'">
      <div class="venda-card__info">
        <h3>${v.nome}</h3>
        <span>${v.categoria} &bull; R$ ${parseFloat(v.preco).toFixed(2).replace(".", ",")}</span>
      </div>
      <div class="venda-card__qtd">
        <div class="venda-card__qtd-label">Vendido</div>
        <div class="venda-card__qtd-valor">${v.qtdVendida} un.</div>
      </div>
      <div class="venda-card__receita ${v.qtdVendida === 0 ? "venda-card__receita--zero" : ""}">
        ${v.qtdVendida > 0 ? "R$ " + v.receita.toFixed(2).replace(".", ",") : "—"}
      </div>
      <span class="produto-status ${v.qtdVendida > 0 ? "produto-status--vendido" : "produto-status--ativo"}">
        ${v.qtdVendida > 0 ? "Vendido" : "Ativo"}
      </span>
    </div>`).join("");

  lista.innerHTML = resumoHtml + vendasHtml;
}

function removerMeuProduto(id) {
  const produtos = JSON.parse(localStorage.getItem("produtosVendedores")) || [];
  const novos = produtos.filter(p => p.id !== id);
  localStorage.setItem("produtosVendedores", JSON.stringify(novos));
  renderizarMeusProdutos();
  mostrarMensagem("Produto removido.");
}

function abrirFormProduto() {
  const box = document.getElementById("form-produto-box");
  if (box) box.style.display = "block";
}

function fecharFormProduto() {
  const box = document.getElementById("form-produto-box");
  if (box) box.style.display = "none";
}

// ---- ENVIOS & NF ----

function renderizarEnvios() {
  const lista = document.getElementById("lista-envios");
  if (!lista) return;

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const meusProdutos  = (JSON.parse(localStorage.getItem("produtosVendedores")) || [])
    .filter(p => p.vendedorEmail === usuarioLogado?.email)
    .map(p => p.nome);

  const todosPedidos = JSON.parse(localStorage.getItem("pedidos")) || [];
  const pedidosDoVendedor = todosPedidos.filter(pedido =>
    pedido.itens?.some(item => meusProdutos.includes(item.nome))
  );

  if (pedidosDoVendedor.length === 0) {
    lista.innerHTML = `<div class="vender-vazio">Nenhum pedido com seus produtos ainda.</div>`;
    return;
  }

  const envios = JSON.parse(localStorage.getItem("enviosVendedor")) || {};

  lista.innerHTML = pedidosDoVendedor.map(pedido => {
    const env = envios[pedido.id];
    const itensMeus = pedido.itens.filter(i => meusProdutos.includes(i.nome));
    const data = pedido.data ? new Date(pedido.data).toLocaleDateString("pt-BR") : "—";
    const statusEnvio = env
      ? `<span class="envio-status envio-status--enviado">Enviado</span>`
      : `<span class="envio-status envio-status--pendente">Aguardando Envio</span>`;

    const itensHtml = itensMeus.map(i =>
      `<li>${i.nome} &times; ${i.qtd} — R$ ${(i.preco * i.qtd).toFixed(2).replace(".", ",")}</li>`
    ).join("");

    const envioInfo = env ? `
      <div class="envio-info">
        <span>Transportadora: <strong>${env.transportadora}</strong></span>
        <span>Rastreio: <strong>${env.rastreio}</strong></span>
        <span>NF: <strong>${env.nf}</strong></span>
        ${env.chaveNfe ? `<span>Chave NF-e: <small>${env.chaveNfe}</small></span>` : ""}
        <button class="btn-editar-envio" onclick="abrirModalEnvio('${pedido.id}')">Editar</button>
      </div>` : `<button class="btn-registrar-envio" onclick="abrirModalEnvio('${pedido.id}')">Registrar Envio + NF</button>`;

    return `
    <div class="envio-card ${env ? "envio-card--ok" : ""}">
      <div class="envio-card__header">
        <span class="envio-card__pedido">Pedido #${pedido.id}</span>
        <span class="envio-card__data">${data}</span>
        ${statusEnvio}
      </div>
      <div class="envio-card__comprador">
        Comprador: <strong>${pedido.nomeComprador || pedido.email || "—"}</strong>
        ${pedido.enderecoEntrega ? `&bull; ${pedido.enderecoEntrega}` : ""}
      </div>
      <ul class="envio-card__itens">${itensHtml}</ul>
      ${envioInfo}
    </div>`;
  }).join("");
}

function abrirModalEnvio(pedidoId) {
  const modal = document.getElementById("modal-envio");
  if (!modal) return;
  document.getElementById("envio-pedido-id").value = pedidoId;
  const envios = JSON.parse(localStorage.getItem("enviosVendedor")) || {};
  const env = envios[pedidoId];
  document.getElementById("envio-transportadora").value = env?.transportadora || "Correios PAC";
  document.getElementById("envio-rastreio").value       = env?.rastreio || "";
  document.getElementById("envio-nf").value             = env?.nf || "";
  document.getElementById("envio-chave-nfe").value      = env?.chaveNfe || "";
  modal.style.display = "flex";
}

function fecharModalEnvio(event) {
  if (event && event.target !== document.getElementById("modal-envio")) return;
  const modal = document.getElementById("modal-envio");
  if (modal) modal.style.display = "none";
}

function confirmarEnvio() {
  const pedidoId      = document.getElementById("envio-pedido-id").value;
  const transportadora = document.getElementById("envio-transportadora").value;
  const rastreio      = document.getElementById("envio-rastreio").value.trim().toUpperCase();
  const nf            = document.getElementById("envio-nf").value.trim();
  const chaveNfe      = document.getElementById("envio-chave-nfe").value.trim();

  if (!transportadora || !rastreio || !nf) {
    mostrarMensagem("Preencha transportadora, rastreio e número da NF.", "erro");
    return;
  }

  const envios = JSON.parse(localStorage.getItem("enviosVendedor")) || {};
  envios[pedidoId] = { transportadora, rastreio, nf, chaveNfe, dataEnvio: new Date().toISOString() };
  localStorage.setItem("enviosVendedor", JSON.stringify(envios));

  const modal = document.getElementById("modal-envio");
  if (modal) modal.style.display = "none";
  mostrarMensagem("Envio registrado com sucesso!");
  renderizarEnvios();
}

// =========================
// PÁGINA DE PERFIL
// =========================
function inicializarPerfil() {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) { window.location.href = "/login"; return; }

  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  const u = usuarios.find(x => x.email === usuarioLogado.email) || usuarioLogado;

  // Hero
  document.getElementById("perfil-avatar").textContent    = u.nome.charAt(0).toUpperCase();
  document.getElementById("perfil-hero-nome").textContent = u.nome;
  document.getElementById("perfil-hero-tipo").textContent =
    u.tipo === "juridica" ? "Pessoa Jurídica" : "Pessoa Física";

  // Preenche campos comuns
  document.getElementById("perfil-nome-input").value  = u.nome  || "";
  document.getElementById("perfil-email-input").value = u.email || "";

  // Campos por tipo
  if (u.tipo === "juridica") {
    document.getElementById("campo-cpf-perfil").style.display   = "none";
    document.getElementById("campo-razao-perfil").style.display = "";
    document.getElementById("campo-cnpj-perfil").style.display  = "";
    document.getElementById("perfil-razao-input").value = u.razaoSocial || "";
    document.getElementById("perfil-cnpj-input").value  = u.cnpj        || "";
  } else {
    document.getElementById("perfil-cpf-input").value = u.cpf || "";
    // Mostra endereço e preenche
    document.getElementById("card-endereco").style.display = "";
    const end = u.endereco || {};
    document.getElementById("perfil-cep").value         = end.cep         || "";
    document.getElementById("perfil-rua").value         = end.rua         || "";
    document.getElementById("perfil-numero").value      = end.numero      || "";
    document.getElementById("perfil-complemento").value = end.complemento || "";
    document.getElementById("perfil-bairro").value      = end.bairro      || "";
    document.getElementById("perfil-cidade").value      = end.cidade      || "";
    document.getElementById("perfil-estado").value      = end.estado      || "";
  }

  // Submit único — dados + endereço + senha (opcional)
  document.getElementById("form-perfil").addEventListener("submit", function(e) {
    e.preventDefault();

    const novoNome  = document.getElementById("perfil-nome-input").value.trim();
    const novoEmail = document.getElementById("perfil-email-input").value.trim().toLowerCase();

    if (!novoNome)  { mostrarMensagem("Informe seu nome!", "erro"); return; }
    if (!novoEmail) { mostrarMensagem("Informe seu e-mail!", "erro"); return; }

    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    const idx = usuarios.findIndex(x => x.email === usuarioLogado.email);
    if (idx === -1) { mostrarMensagem("Usuário não encontrado!", "erro"); return; }

    usuarios[idx].nome  = novoNome;
    usuarios[idx].email = novoEmail;

    if (u.tipo === "juridica") {
      usuarios[idx].razaoSocial = document.getElementById("perfil-razao-input").value.trim();
      usuarios[idx].cnpj        = document.getElementById("perfil-cnpj-input").value.trim();
    } else {
      usuarios[idx].cpf = document.getElementById("perfil-cpf-input").value.trim();
      usuarios[idx].endereco = {
        cep:         document.getElementById("perfil-cep").value.trim(),
        rua:         document.getElementById("perfil-rua").value.trim(),
        numero:      document.getElementById("perfil-numero").value.trim(),
        complemento: document.getElementById("perfil-complemento").value.trim(),
        bairro:      document.getElementById("perfil-bairro").value.trim(),
        cidade:      document.getElementById("perfil-cidade").value.trim(),
        estado:      document.getElementById("perfil-estado").value.trim().toUpperCase(),
      };
    }

    localStorage.setItem("usuarios", JSON.stringify(usuarios));
    localStorage.setItem("usuarioLogado", JSON.stringify({
      nome: novoNome, email: novoEmail, tipo: usuarios[idx].tipo
    }));
    document.getElementById("perfil-hero-nome").textContent = novoNome;
    document.getElementById("perfil-avatar").textContent    = novoNome.charAt(0).toUpperCase();
    mostrarMensagem("Alterações salvas com sucesso!");
  });
}

// =========================
// REDEFINIÇÃO DE SENHA — MODAL 2 ETAPAS
// =========================
let _resetEmailAtual = null;

function _injetarModalReset() {
  if (document.getElementById("modal-reset-senha")) return;
  const modal = document.createElement("div");
  modal.id = "modal-reset-senha";
  modal.className = "modal-esqueci-overlay";
  modal.style.display = "none";
  modal.innerHTML = `
    <div class="modal-esqueci-box" id="modal-reset-box">
      <button class="modal-esqueci-fechar" onclick="fecharModalResetSenha()">&times;</button>

      <!-- Etapa 1: e-mail -->
      <div id="reset-step-1">
        <h2 class="modal-esqueci-titulo">Redefinir Senha</h2>
        <p class="modal-esqueci-desc">Informe o e-mail cadastrado para continuar.</p>
        <form id="form-reset-email" onsubmit="confirmarEmailReset(event)">
          <label class="modal-esqueci-label">E-mail</label>
          <input type="email" id="reset-input-email" class="modal-esqueci-input" placeholder="seu@email.com" required autocomplete="email">
          <button type="submit" class="modal-esqueci-btn">Enviar</button>
        </form>
      </div>

      <!-- Etapa 2: nova senha -->
      <div id="reset-step-2" style="display:none">
        <h2 class="modal-esqueci-titulo">Nova Senha</h2>
        <p class="modal-esqueci-desc reset-email-confirmado"></p>
        <form id="form-reset-nova-senha" onsubmit="salvarNovaSenhaReset(event)">
          <label class="modal-esqueci-label">Nova senha</label>
          <input type="password" id="reset-nova-senha" class="modal-esqueci-input" placeholder="Mínimo 6 caracteres" required minlength="6">
          <label class="modal-esqueci-label" style="margin-top:12px">Confirmar senha</label>
          <input type="password" id="reset-confirmar-senha" class="modal-esqueci-input" placeholder="Repita a nova senha" required>
          <button type="submit" class="modal-esqueci-btn" style="margin-top:16px">Salvar nova senha</button>
        </form>
      </div>

      <!-- Etapa 3: sucesso -->
      <div id="reset-step-3" style="display:none;text-align:center">
        <div style="font-size:52px;margin-bottom:14px">✅</div>
        <h2 class="modal-esqueci-titulo">Senha redefinida!</h2>
        <p class="modal-esqueci-desc">Sua senha foi atualizada com sucesso.</p>
        <button class="modal-esqueci-btn" onclick="fecharModalResetSenha()">Fechar</button>
      </div>
    </div>
  `;
  modal.addEventListener("click", function(e) {
    if (e.target === modal) fecharModalResetSenha();
  });
  document.body.appendChild(modal);
}

function toggleSenhaVisivel(inputId, el) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  // Suporta tanto checkbox (checked) quanto botão toggle
  const mostrar = el.type === "checkbox" ? el.checked : inp.type === "password";
  inp.type = mostrar ? "text" : "password";
  if (el.type !== "checkbox") el.textContent = mostrar ? "🙈" : "👁";
}

function abrirModalResetSenha(emailInicial) {
  _injetarModalReset();
  const modal = document.getElementById("modal-reset-senha");
  modal.style.display = "flex";
  document.getElementById("reset-step-1").style.display = "";
  document.getElementById("reset-step-2").style.display = "none";
  document.getElementById("reset-step-3").style.display = "none";
  document.getElementById("form-reset-email").reset();
  document.getElementById("form-reset-nova-senha").reset();
  _resetEmailAtual = null;
  if (emailInicial) {
    document.getElementById("reset-input-email").value = emailInicial;
  }
}

function fecharModalResetSenha() {
  const modal = document.getElementById("modal-reset-senha");
  if (modal) modal.style.display = "none";
}

function confirmarEmailReset(e) {
  e.preventDefault();
  const email = document.getElementById("reset-input-email").value.trim().toLowerCase();

  if (_backendUrl()) {
    const btn = e.target.querySelector("button[type=submit]");
    if (btn) btn.disabled = true;
    api("/api/auth/solicitar-reset", "POST", { email }).then(() => {
      document.getElementById("reset-step-1").style.display = "none";
      const step2 = document.getElementById("reset-step-2");
      step2.style.display = "";
      step2.innerHTML = `
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:48px;margin-bottom:12px">📧</div>
          <h2 class="modal-esqueci-titulo">Verifique seu e-mail</h2>
          <p class="modal-esqueci-desc">Enviamos um link de redefinição para <strong>${email}</strong>.<br>Verifique também a pasta de spam.</p>
          <button class="modal-esqueci-btn" style="margin-top:16px" onclick="fecharModalResetSenha()">Fechar</button>
        </div>`;
    }).catch(() => {
      if (btn) btn.disabled = false;
      mostrarMensagem("Erro ao enviar. Tente novamente.", "erro");
    });
    return;
  }

  // Fallback local (sem backend)
  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  const usuario = usuarios.find(u => u.email === email);
  if (!usuario) {
    mostrarMensagem("E-mail não encontrado. Verifique e tente novamente.", "erro");
    return;
  }

  _resetEmailAtual = email;
  document.getElementById("reset-step-1").style.display = "none";
  const desc = document.querySelector(".reset-email-confirmado");
  if (desc) desc.textContent = "E-mail verificado: " + email + ". Crie sua nova senha abaixo.";
  document.getElementById("reset-step-2").style.display = "";
  document.getElementById("reset-nova-senha").focus();
}

function salvarNovaSenhaReset(e) {
  e.preventDefault();
  const nova     = document.getElementById("reset-nova-senha").value;
  const confirma = document.getElementById("reset-confirmar-senha").value;
  if (nova.length < 6) { mostrarMensagem("A senha deve ter pelo menos 6 caracteres!", "erro"); return; }
  if (nova !== confirma) { mostrarMensagem("As senhas não coincidem!", "erro"); return; }

  hashSenha(nova).then(hash => {
    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    const idx = usuarios.findIndex(u => u.email === _resetEmailAtual);
    if (idx === -1) { mostrarMensagem("Usuário não encontrado!", "erro"); return; }
    usuarios[idx].senha = hash;
    localStorage.setItem("usuarios", JSON.stringify(usuarios));
    document.getElementById("reset-step-2").style.display = "none";
    document.getElementById("reset-step-3").style.display = "";
    _resetEmailAtual = null;
  });
}

function solicitarResetSenhaPerfil() {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  abrirModalResetSenha(usuarioLogado ? usuarioLogado.email : "");
}

// =========================
// SINCRONIZAÇÃO ENTRE ABAS (storage event)
// =========================
window.addEventListener("storage", function (e) {
  if (e.key !== "usuarioLogado") return;

  // Atualiza o header imediatamente em todas as abas abertas
  inicializarHeader();

  // Se estiver na página de vendas, re-verifica o acesso
  if (document.getElementById("lista-meus-produtos")) {
    inicializarVender();
  }
});

// =========================
// BANNER SLIDER
// =========================
(function () {
  let slideAtual = 0;
  let autoplayTimer = null;
  const INTERVALO = 4500;

  function _slides() {
    return document.querySelectorAll(".banner-slide");
  }
  function _dots() {
    return document.querySelectorAll(".banner-dot");
  }

  function irParaSlide(idx) {
    const slides = _slides();
    const dots   = _dots();
    if (!slides.length) return;

    slides[slideAtual].classList.remove("ativo");
    dots[slideAtual]?.classList.remove("ativo");

    slideAtual = (idx + slides.length) % slides.length;

    slides[slideAtual].classList.add("ativo");
    dots[slideAtual]?.classList.add("ativo");
  }

  function moverSlide(delta) {
    reiniciarAutoplay();
    irParaSlide(slideAtual + delta);
  }

  function reiniciarAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = setInterval(() => irParaSlide(slideAtual + 1), INTERVALO);
  }

  // Expor funções globalmente para os onclicks no HTML
  window.irParaSlide  = function(i) { reiniciarAutoplay(); irParaSlide(i); };
  window.moverSlide   = moverSlide;

  // Inicializar só se o slider existir na página
  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("banner-slider")) return;
    reiniciarAutoplay();

    // Pausar ao passar o mouse
    const slider = document.getElementById("banner-slider");
    slider.addEventListener("mouseenter", () => clearInterval(autoplayTimer));
    slider.addEventListener("mouseleave", reiniciarAutoplay);

    // Suporte a swipe no celular
    let touchStartX = 0;
    slider.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener("touchend", e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) moverSlide(diff > 0 ? 1 : -1);
    }, { passive: true });
  });
})();

// =========================
// PREVIEW DE IMAGEM — FORMULÁRIOS
// =========================
function _aplicarPreviewImg(url, imgEl, placeholderEl) {
  if (!imgEl || !placeholderEl) return;
  var limpo = (url || "").trim();
  if (limpo.length > 4) {
    imgEl.src = limpo;
    imgEl.style.display = "block";
    placeholderEl.style.display = "none";
  } else {
    imgEl.style.display = "none";
    placeholderEl.style.display = "flex";
  }
}

function atualizarPreviewImgAdmin(url) {
  _aplicarPreviewImg(url,
    document.getElementById("admin-img-preview"),
    document.getElementById("admin-img-placeholder"));
}

function atualizarPreviewImgVendedor(url) {
  _aplicarPreviewImg(url,
    document.getElementById("vender-img-preview"),
    document.getElementById("vender-img-placeholder"));
}

// =========================
// BADGES E PARCELAS DOS CARDS
// =========================
(function () {
  function formatarPreco(val) {
    return "R$" + parseFloat(val).toFixed(2).replace(".", ",");
  }

  function processarCard(card) {
    if (card.dataset.badgesOk) return;
    card.dataset.badgesOk = "1";

    var imgBox   = card.querySelector(".card-produto__imagem");
    var precoBox = card.querySelector(".card-produto__preco");
    if (!imgBox || !precoBox) return;

    var h3 = precoBox.querySelector("h3");
    var h2 = precoBox.querySelector("h2");

    // Badge de promoção + % quando há desconto
    if (h3 && h2) {
      var original = parseFloat(h3.textContent.replace("R$", "").replace(",", ".").trim());
      var final    = parseFloat(h2.textContent.replace("R$", "").replace(",", ".").trim());

      if (original > final && original > 0 && final > 0) {
        var pct = Math.round((1 - final / original) * 100);

        var badgePromo = document.createElement("span");
        badgePromo.className = "card-badge-promo";
        badgePromo.textContent = "Promoção";
        imgBox.appendChild(badgePromo);


      }
    }

    // Texto de parcela embaixo do preço
    var precoFinal = h2 ? parseFloat(h2.textContent.replace("R$", "").replace(",", ".").trim()) : 0;
    if (precoFinal >= 150) {
      var vlParcela = (precoFinal / 3).toFixed(2).replace(".", ",");
      var btn = card.querySelector(".card-produto__btn");
      var parcela = document.createElement("p");
      parcela.className = "card-produto__parcela";
      parcela.textContent = "3x de R$ " + vlParcela + " sem juros";
      if (btn) card.insertBefore(parcela, btn);
      else card.appendChild(parcela);
    }
  }

  function inicializarBadgesCards() {
    document.querySelectorAll(".card-produto").forEach(processarCard);
  }

  document.addEventListener("DOMContentLoaded", inicializarBadgesCards);
  window._reinicializarBadgesCards = inicializarBadgesCards;
})();

// =========================
// SCROLL HORIZONTAL DE PRODUTOS (auto-scroll + bolinhas por página)
// =========================
(function () {
  var CARD_WIDTH = 191;
  var INTERVALO  = 2800;

  function criarScrollHorizontal(lista) {
    if (!lista) return;
    if (lista.dataset.autoScrollOk) return;
    lista.dataset.autoScrollOk = "1";

    var timer = null;
    var total  = lista.querySelectorAll(".card-produto").length;

    var dotsWrap = document.createElement("div");
    dotsWrap.className = "produto-dots";
    lista.parentNode.insertBefore(dotsWrap, lista.nextSibling);

    var dots = [];

    function getVisiveis() {
      return Math.max(1, Math.floor(lista.clientWidth / CARD_WIDTH));
    }

    function getNumPaginas() {
      return Math.ceil(total / getVisiveis());
    }

    function getPaginaAtual() {
      var paginaW = getVisiveis() * CARD_WIDTH;
      return Math.round(lista.scrollLeft / paginaW);
    }

    function reconstruirDots() {
      var n = getNumPaginas();
      dotsWrap.innerHTML = "";
      dots = [];
      for (var i = 0; i < n; i++) {
        (function (idx) {
          var d = document.createElement("button");
          d.type = "button";
          d.className = "produto-dot" + (idx === 0 ? " ativo" : "");
          d.setAttribute("aria-label", "Página " + (idx + 1));
          d.addEventListener("click", function () {
            parar();
            lista.scrollTo({ left: idx * getVisiveis() * CARD_WIDTH, behavior: "smooth" });
            setTimeout(iniciar, 3000);
          });
          dotsWrap.appendChild(d);
          dots.push(d);
        })(i);
      }
    }

    function atualizarDots() {
      var p = Math.max(0, Math.min(getPaginaAtual(), dots.length - 1));
      dots.forEach(function (d, i) { d.classList.toggle("ativo", i === p); });
    }

    lista.addEventListener("scroll", atualizarDots, { passive: true });
    window.addEventListener("resize", function () { reconstruirDots(); atualizarDots(); }, { passive: true });

    reconstruirDots();

    function avancar() {
      var atFim = lista.scrollLeft >= lista.scrollWidth - lista.clientWidth - 2;
      lista[atFim ? "scrollTo" : "scrollBy"]({ left: atFim ? 0 : CARD_WIDTH, behavior: "smooth" });
    }

    function iniciar() { clearInterval(timer); timer = setInterval(avancar, INTERVALO); }
    function parar()   { clearInterval(timer); }

    lista.addEventListener("mouseenter", parar);
    lista.addEventListener("mouseleave", iniciar);
    lista.addEventListener("touchstart", parar, { passive: true });
    lista.addEventListener("touchend", function () { setTimeout(iniciar, 2000); }, { passive: true });

    iniciar();
  }

  function inicializarScrollProdutos() {
    document.querySelectorAll(".lista-cards").forEach(criarScrollHorizontal);
  }

  document.addEventListener("DOMContentLoaded", inicializarScrollProdutos);

  window._reinicializarScrollProdutos = function () {
    document.querySelectorAll(".lista-cards").forEach(criarScrollHorizontal);
  };
})();

// =========================
// SEGURANÇA — META TAGS (inject nas páginas sem elas)
// =========================
(function injetarMetasSeguranca() {
  function addMeta(httpEquiv, content) {
    if (document.querySelector('meta[http-equiv="' + httpEquiv + '"]')) return;
    var m = document.createElement("meta");
    m.httpEquiv = httpEquiv;
    m.content = content;
    document.head.appendChild(m);
  }
  addMeta("X-Content-Type-Options", "nosniff");
  addMeta("Referrer-Policy", "strict-origin-when-cross-origin");
  addMeta("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
})();

// =========================
// LGPD — BANNER DE COOKIES
// =========================
(function inicializarLGPD() {
  if (localStorage.getItem("lgpd_aceito")) return;
  var banner = document.createElement("div");
  banner.className = "lgpd-banner";
  banner.id = "lgpd-banner";
  banner.innerHTML =
    '<div class="lgpd-banner__texto">' +
      '🍪 Utilizamos cookies para melhorar sua experiência de compra e personalizar conteúdo. ' +
      'Seus dados são protegidos conforme a <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong>. ' +
      'Ao continuar navegando, você concorda com nossa ' +
      '<a href="/privacidade">Política de Privacidade</a> e ' +
      '<a href="/termos">Termos de Uso</a>.' +
    '</div>' +
    '<div class="lgpd-banner__btns">' +
      '<button class="lgpd-btn-aceitar" onclick="aceitarLGPD()">Aceitar Todos</button>' +
      '<button class="lgpd-btn-recusar" onclick="fecharLGPD()">Apenas Essenciais</button>' +
    '</div>';
  document.body.appendChild(banner);
})();

function aceitarLGPD() {
  localStorage.setItem("lgpd_aceito", "todos");
  var b = document.getElementById("lgpd-banner");
  if (b) b.remove();
}

function fecharLGPD() {
  localStorage.setItem("lgpd_aceito", "essenciais");
  var b = document.getElementById("lgpd-banner");
  if (b) b.remove();
}

// =========================
// SELOS DE SEGURANÇA NO FOOTER
// =========================
(function injetarSelosSeguranca() {
  document.addEventListener("DOMContentLoaded", function () {
    var adminLink = document.querySelector(".footer-admin-link");
    if (!adminLink) return;
    var div = document.createElement("div");
    div.className = "footer-seguranca";
    div.innerHTML =
      '<div class="selo-seguranca">' +
        '<span class="selo-seguranca__icone">🔒</span>' +
        '<div class="selo-seguranca__texto">' +
          '<span class="selo-seguranca__titulo">Site Seguro</span>' +
          '<span class="selo-seguranca__sub">Conexão criptografada SSL</span>' +
        '</div>' +
      '</div>' +
      '<div class="selo-seguranca">' +
        '<span class="selo-seguranca__icone">🛡️</span>' +
        '<div class="selo-seguranca__texto">' +
          '<span class="selo-seguranca__titulo">Dados Protegidos</span>' +
          '<span class="selo-seguranca__sub">Conformidade com a LGPD</span>' +
        '</div>' +
      '</div>' +
      '<div class="selo-seguranca">' +
        '<span class="selo-seguranca__icone">✅</span>' +
        '<div class="selo-seguranca__texto">' +
          '<span class="selo-seguranca__titulo">Compra Garantida</span>' +
          '<span class="selo-seguranca__sub">Política de troca e devolução</span>' +
        '</div>' +
      '</div>' +
      '<div class="selo-seguranca">' +
        '<span class="selo-seguranca__icone">💳</span>' +
        '<div class="selo-seguranca__texto">' +
          '<span class="selo-seguranca__titulo">Pagamento Seguro</span>' +
          '<span class="selo-seguranca__sub">PIX, cartão e boleto protegidos</span>' +
        '</div>' +
      '</div>';
    adminLink.parentNode.insertBefore(div, adminLink);
  });
})();

// =========================
// INDICADOR DE FORMULÁRIO SEGURO
// =========================
(function injetarFormSeguro() {
  document.addEventListener("DOMContentLoaded", function () {
    var seletores = [".login-form", ".cadastro-form", "#form-dados-pix", "#form-dados-cartao", "#form-dados-boleto"];
    seletores.forEach(function (sel) {
      var form = document.querySelector(sel);
      if (!form || form.querySelector(".form-seguro-badge")) return;
      var badge = document.createElement("div");
      badge.className = "form-seguro-badge";
      badge.innerHTML = '<span class="form-seguro-badge__icone">🔒</span> Seus dados estão protegidos por criptografia';
      form.appendChild(badge);
    });
  });
})();

// =========================
// INICIALIZAÇÃO
// =========================
inicializarHeader();
atualizarBadgeCarrinho();
inicializarFiltros();
inicializarPesquisa();
inicializarFiltroPrecoBarra();
inicializarCadastro();

if (document.getElementById("carrinho-lista")) {
  renderizarCarrinho();
}

if (document.getElementById("pedidos-lista")) {
  renderizarPedidos();
}

if (document.getElementById("lista-vendedores")) {
  renderizarProdutosVendedores();
  renderizarProdutosAdmin();
  // Reinicializa dots/auto-scroll nas seções que receberam novos cards
  if (window._reinicializarScrollProdutos) window._reinicializarScrollProdutos();
}
inicializarBotoesCarrinho();
inicializarNavDropdown();
carregarProdutosAPI();

if (document.getElementById("lista-meus-produtos")) {
  inicializarVender();
}

if (document.getElementById("form-perfil")) {
  inicializarPerfil();
}


// =========================
// NAV DROPDOWN CATEGORIAS
// =========================
function inicializarNavDropdown() {
  const trigger = document.getElementById("nav-dropdown-trigger");
  const painel  = document.getElementById("nav-dropdown-painel");
  if (!trigger || !painel) return;

  trigger.addEventListener("click", function(e) {
    e.stopPropagation();
    const aberto = painel.classList.toggle("aberto");
    trigger.setAttribute("aria-expanded", aberto);
    painel.setAttribute("aria-hidden", !aberto);
  });

  document.addEventListener("click", function() {
    painel.classList.remove("aberto");
    trigger.setAttribute("aria-expanded", "false");
    painel.setAttribute("aria-hidden", "true");
  });

  painel.addEventListener("click", function(e) { e.stopPropagation(); });
}

function toggleSubMenu(id) {
  const sub = document.getElementById(id);
  if (!sub) return;
  sub.classList.toggle("aberto");
  const plusId = "plus-" + id.replace("-sub", "");
  const plus = document.getElementById(plusId);
  if (plus) plus.style.transform = sub.classList.contains("aberto") ? "rotate(45deg)" : "";
}

function filtrarDropdown(filtro) {
  const painel = document.getElementById("nav-dropdown-painel");
  const trigger = document.getElementById("nav-dropdown-trigger");
  if (painel) { painel.classList.remove("aberto"); }
  if (trigger) { trigger.setAttribute("aria-expanded", "false"); }

  // Ativa o nav item correspondente
  document.querySelectorAll("nav > ul > li[data-filtro]").forEach(n => n.classList.remove("nav-ativo"));
  const navItem = document.querySelector(`nav > ul > li[data-filtro="${filtro}"]`);
  if (navItem) navItem.classList.add("nav-ativo");

  filtrarProdutos(filtro);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Auto-abrir produto via ?open=nome (vindo da página de favoritos)
(function() {
  const params = new URLSearchParams(window.location.search);
  const nomeAbrir = params.get("open");
  if (!nomeAbrir) return;
  const cards = document.querySelectorAll(".card-produto");
  for (const card of cards) {
    if (card.dataset.nome === nomeAbrir) {
      setTimeout(() => abrirModalProduto(card), 300);
      break;
    }
  }
  // Limpa o param da URL sem recarregar
  history.replaceState(null, "", window.location.pathname);
})();

// Admin
const formAdminProduto = document.getElementById("form-admin-produto");
if (formAdminProduto) formAdminProduto.addEventListener("submit", salvarProdutoAdmin);
inicializarAdmin();

// =========================
// ANIMAÇÕES
// =========================
(function inicializarAnimacoes() {

  // --- Scroll reveal com IntersectionObserver ---
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visivel");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  // Títulos de seção
  document.querySelectorAll(".titulo-secao").forEach(el => {
    el.classList.add("animar", "animar-up");
    observer.observe(el);
  });

  // Cards com stagger
  document.querySelectorAll(".lista-cards").forEach(lista => {
    lista.querySelectorAll(".card-produto").forEach((card, i) => {
      card.classList.add("animar", "animar-up");
      const delay = Math.min(i, 7) + 1;
      card.classList.add(`animar-delay-${delay}`);
      observer.observe(card);
    });
  });

  // Divisores
  document.querySelectorAll(".divisor").forEach(el => {
    el.classList.add("animar", "animar-fade");
    observer.observe(el);
  });

  // --- Ripple em todos os botões ---
  document.addEventListener("click", function(e) {
    const btn = e.target.closest("button, .btn-comprar-modal, .btn-carrinho-modal, .cadastro-btn, .perfil-btn-salvar");
    if (!btn) return;

    const circle = document.createElement("span");
    circle.classList.add("ripple-effect");
    const rect = btn.getBoundingClientRect();
    circle.style.left = (e.clientX - rect.left) + "px";
    circle.style.top  = (e.clientY - rect.top)  + "px";
    btn.style.position = "relative";
    btn.style.overflow = "hidden";
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  });

})();
