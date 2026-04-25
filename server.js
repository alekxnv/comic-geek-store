const express = require("express");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const { createClient } = require("redis");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

// ================================================
// SEGURANÇA — HTTP Headers
// ================================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.set("trust proxy", 1);

const limiteGlobal = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde um momento." },
});

const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  skipSuccessfulRequests: true,
});

app.use("/api", limiteGlobal);
app.use("/api/auth", limiteAuth);

function sanitize(str, maxLen = 200) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

app.use(express.json({ limit: "50kb" }));
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.static(path.join(__dirname, "public")));

// ================================================
// MERCADO PAGO — client
// ================================================
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
  options: { timeout: 5000 },
});

// ================================================
// REDIS
// ================================================
const redisUrl =
  process.env.REDIS_URL ||
  process.env.REDIS_PRIVATE_URL ||
  process.env.REDISURL ||
  process.env.REDIS_TLS_URL ||
  null;

console.log("Redis URL detectada:", redisUrl ? redisUrl.replace(/:\/\/[^@]*@/, "://***@") : "NENHUMA — usando arquivos locais");

let redis = null;
let redisOk = false;

if (redisUrl) {
  redis = createClient({ url: redisUrl });
  redis.on("error", (e) => console.error("Redis erro:", e.message));
  redis.connect()
    .then(() => { redisOk = true; console.log("Redis conectado — dados persistentes ativados"); })
    .catch((e) => console.error("Redis falhou:", e.message));
} else {
  console.log("Redis não configurado — usando arquivos JSON locais");
}

async function rGet(key) { return redisOk ? redis.get(key) : null; }
async function rSet(key, val, ex) {
  if (!redisOk) return;
  if (ex) await redis.set(key, val, { EX: ex });
  else await redis.set(key, val);
}
async function rDel(key) { if (redisOk) await redis.del(key); }

// ================================================
// POSTGRESQL
// ================================================
let db = null;
let dbOk = false;

if (process.env.DATABASE_URL) {
  try {
    db = require("./db");
    dbOk = true;
    console.log("PostgreSQL configurado — usando banco de dados relacional");
  } catch (e) {
    console.error("Falha ao carregar módulo PostgreSQL:", e.message);
  }
}

// ================================================
// DADOS — PostgreSQL → Redis → arquivo local
// ================================================
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

async function lerDados(chave) {
  if (redisOk) {
    const raw = await redis.get(`db:${chave}`);
    return raw ? JSON.parse(raw) : [];
  }
  const caminho = path.join(DATA_DIR, chave + ".json");
  if (!fs.existsSync(caminho)) return [];
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

async function salvarDados(chave, dados) {
  if (redisOk) {
    await redis.set(`db:${chave}`, JSON.stringify(dados));
    return;
  }
  fs.writeFileSync(path.join(DATA_DIR, chave + ".json"), JSON.stringify(dados, null, 2));
}

// ================================================
// EMAIL
// ================================================
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  console.log("E-mail configurado via SMTP");
} else {
  console.log("SMTP não configurado — e-mails desativados");
}

async function enviarEmailBoasVindas(nome, email) {
  if (!mailer) return;
  try {
    await mailer.sendMail({
      from: `"Comic Geek Store" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Bem-vindo à Comic Geek Store! 🦸",
      html: `
        <div style="font-family:Montserrat,sans-serif;max-width:560px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#6a0dad,#8b2fc9);padding:32px 28px;text-align:center">
            <h1 style="font-family:Georgia,serif;font-size:2rem;letter-spacing:3px;margin:0;color:#ffd84d">COMIC GEEK STORE</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.75);font-size:14px">Sua loja de quadrinhos favorita</p>
          </div>
          <div style="padding:32px 28px">
            <h2 style="margin:0 0 12px;font-size:1.3rem">Olá, ${nome}! 👋</h2>
            <p style="color:rgba(255,255,255,.8);line-height:1.6;margin:0 0 20px">
              Seja bem-vindo à Comic Geek Store! Sua conta foi criada com sucesso.
              Agora você tem acesso a centenas de quadrinhos Marvel, DC e muito mais.
            </p>
            <a href="${process.env.FRONTEND_URL || 'https://www.comicgeek.com.br'}" style="display:inline-block;background:#ffd84d;color:#000;font-weight:700;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px">Explorar a Loja →</a>
            <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:28px">
              Se você não criou esta conta, ignore este e-mail.
            </p>
          </div>
        </div>`,
    });
  } catch (e) {
    console.error("Erro ao enviar e-mail de boas-vindas:", e.message);
  }
}

async function enviarEmailPedido(email, nome, pedido) {
  if (!mailer) return;
  const itens = (pedido.itens || []).map(i =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #333">${i.nome}</td><td style="padding:6px 0;border-bottom:1px solid #333;text-align:right">x${i.qtd}</td><td style="padding:6px 0;border-bottom:1px solid #333;text-align:right">R$ ${parseFloat(i.preco||0).toFixed(2).replace(".",",")}</td></tr>`
  ).join("");
  try {
    await mailer.sendMail({
      from: `"Comic Geek Store" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Pedido #${pedido.id} confirmado! 🦸`,
      html: `<div style="font-family:Montserrat,sans-serif;max-width:560px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6a0dad,#8b2fc9);padding:24px 28px;text-align:center">
          <h1 style="font-family:Georgia,serif;font-size:1.6rem;color:#ffd84d;margin:0">Pedido Confirmado!</h1>
        </div>
        <div style="padding:28px">
          <p>Olá, <strong>${nome}</strong>! Seu pedido foi recebido com sucesso.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="color:#ffd84d"><th style="text-align:left">Produto</th><th>Qtd</th><th>Valor</th></tr></thead>
            <tbody>${itens}</tbody>
          </table>
          <p style="font-size:1.1rem"><strong>Total: R$ ${parseFloat(pedido.total||0).toFixed(2).replace(".",",")}</strong></p>
          <p style="color:rgba(255,255,255,.6);font-size:12px">Pedido #${pedido.id} · ${new Date().toLocaleDateString("pt-BR")}</p>
        </div>
      </div>`,
    });
  } catch (e) { console.error("Erro ao enviar e-mail de pedido:", e.message); }
}

// Cupons padrão (seed)
const CUPONS_SEED = [
  { codigo: "GEEK10", desconto: 10 },
  { codigo: "GEEK20", desconto: 20 },
  { codigo: "COMIC20", desconto: 20 },
  { codigo: "HEROI15", desconto: 15 },
  { codigo: "MARVEL5", desconto: 5 },
];

async function lerCupons() {
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM cupons");
    if (rows.length > 0) return rows;
    return CUPONS_SEED;
  }
  const salvos = await lerDados("cupons");
  if (salvos && salvos.length > 0) return salvos;
  return CUPONS_SEED;
}

// ================================================
// MIDDLEWARES
// ================================================
const JWT_SECRET = process.env.JWT_SECRET || "cgs_secret_2024";

function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ erro: "Token necessário" });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido" });
  }
}

function autenticarAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ erro: "Token necessário" });
  try {
    const dados = jwt.verify(token, JWT_SECRET);
    if (dados.tipo !== "admin") return res.status(403).json({ erro: "Acesso negado" });
    req.usuario = dados;
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido" });
  }
}

async function limitarTentativas(chave, max, janela, res) {
  if (!redisOk) return true;
  const tentativas = await redis.incr(chave);
  if (tentativas === 1) await redis.expire(chave, janela);
  if (tentativas > max) {
    const ttl = await redis.ttl(chave);
    res.status(429).json({ erro: `Muitas tentativas. Tente novamente em ${ttl}s.` });
    return false;
  }
  return true;
}

// ================================================
// AUTH
// ================================================
function validarCNPJ(cnpj) {
  const n = cnpj.replace(/\D/g, "");
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const calc = (len) => {
    let soma = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      soma += parseInt(n.charAt(len - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(n[12]) && calc(13) === parseInt(n[13]);
}

app.post("/api/auth/cadastro", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!(await limitarTentativas(`cadastro:${ip}`, 5, 3600, res))) return;

  let { nome, email, senha, tipo, cpf, cnpj, razaoSocial, endereco, termosAceitos, login } = req.body;
  nome = sanitize(nome, 100); email = sanitize(email, 150); tipo = sanitize(tipo, 20);
  login = sanitize(login, 50);
  if (!nome || !email || !senha || !tipo) return res.status(400).json({ erro: "Campos obrigatórios faltando" });
  if (senha.length < 6) return res.status(400).json({ erro: "Senha deve ter no mínimo 6 caracteres" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: "E-mail inválido" });

  if (tipo === "juridica" && cnpj && !validarCNPJ(cnpj)) {
    return res.status(400).json({ erro: "CNPJ inválido" });
  }

  const hash = await bcrypt.hash(senha, 10);
  const id = Date.now();
  const status = tipo === "juridica" ? "pendente" : "aprovado";
  const criadoEm = new Date().toISOString();

  if (dbOk) {
    const existe = await db.query("SELECT id FROM usuarios WHERE email=$1", [email]);
    if (existe.rows.length > 0) return res.status(409).json({ erro: "E-mail já cadastrado" });
    if (login) {
      const loginExiste = await db.query("SELECT id FROM usuarios WHERE login=$1", [login.toLowerCase()]);
      if (loginExiste.rows.length > 0) return res.status(409).json({ erro: "Este nome de usuário já está em uso" });
    }
    const { rows } = await db.query(
      `INSERT INTO usuarios (id, nome, email, login, senha, tipo, cpf, cnpj, "razaoSocial", endereco, "termosAceitos", status, "criadoEm")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id, nome, email, (login || "").toLowerCase() || null, hash, tipo,
       cpf || null, cnpj || null, razaoSocial || null,
       endereco ? JSON.stringify(endereco) : null,
       termosAceitos || false, status, criadoEm]
    );
    const usuario = rows[0];
    enviarEmailBoasVindas(nome, email).catch(() => {});
    const token = jwt.sign({ id: usuario.id, email: usuario.email, tipo: usuario.tipo, nome: usuario.nome }, JWT_SECRET, { expiresIn: "7d" });
    const { senha: _, ...dadosPublicos } = usuario;
    return res.status(201).json({ token, usuario: dadosPublicos });
  }

  const usuarios = await lerDados("usuarios");
  if (usuarios.find((u) => u.email === email)) return res.status(409).json({ erro: "E-mail já cadastrado" });
  if (login && usuarios.find((u) => u.login === login.toLowerCase())) {
    return res.status(409).json({ erro: "Este nome de usuário já está em uso" });
  }

  const usuario = {
    id, nome, email, login: (login || "").toLowerCase() || null, senha: hash, tipo,
    cpf: cpf || null, cnpj: cnpj || null, razaoSocial: razaoSocial || null,
    endereco: endereco || null, termosAceitos: termosAceitos || false,
    status, criadoEm,
  };
  usuarios.push(usuario);
  await salvarDados("usuarios", usuarios);

  enviarEmailBoasVindas(nome, email).catch(() => {});

  const token = jwt.sign({ id: usuario.id, email: usuario.email, tipo: usuario.tipo, nome: usuario.nome }, JWT_SECRET, { expiresIn: "7d" });
  const { senha: _, ...dadosPublicos } = usuario;
  res.status(201).json({ token, usuario: dadosPublicos });
});

app.post("/api/auth/login", async (req, res) => {
  const { senha } = req.body;
  const id = sanitize((req.body.identificador || req.body.email || ""), 150).toLowerCase().trim();
  if (!id || !senha) return res.status(400).json({ erro: "Credenciais obrigatórias" });
  const chave = `login:${id}`;

  if (!(await limitarTentativas(chave, 5, 60, res))) return;

  const adminUser = (process.env.ADMIN_USER || "admin").toLowerCase();
  const adminPass = process.env.ADMIN_PASS || "admin@2024";
  if (id === adminUser && senha === adminPass) {
    await rDel(chave);
    const token = jwt.sign({ tipo: "admin", nome: "Admin", login: adminUser }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ token, usuario: { nome: "Admin", login: adminUser, email: adminUser, tipo: "admin" } });
  }

  if (dbOk) {
    const adminsRes = await db.query("SELECT * FROM admins WHERE login=$1", [id]);
    const adminCad = adminsRes.rows[0];
    if (adminCad && await bcrypt.compare(senha, adminCad.senha)) {
      await rDel(chave);
      const token = jwt.sign({ tipo: "admin", nome: adminCad.nome, login: adminCad.login }, JWT_SECRET, { expiresIn: "8h" });
      return res.json({ token, usuario: { nome: adminCad.nome, login: adminCad.login, email: adminCad.login, tipo: "admin" } });
    }
    const usrRes = await db.query("SELECT * FROM usuarios WHERE email=$1 OR login=$1", [id]);
    const usuario = usrRes.rows[0];
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).json({ erro: "Login, e-mail ou senha incorretos" });
    }
    await rDel(chave);
    const token = jwt.sign({ id: usuario.id, email: usuario.email, tipo: usuario.tipo, nome: usuario.nome }, JWT_SECRET, { expiresIn: "7d" });
    const { senha: _, ...dadosPublicos } = usuario;
    return res.json({ token, usuario: dadosPublicos });
  }

  const admins = await lerDados("admins");
  const adminCad = admins.find((a) => a.login.toLowerCase() === id);
  if (adminCad && await bcrypt.compare(senha, adminCad.senha)) {
    await rDel(chave);
    const token = jwt.sign({ tipo: "admin", nome: adminCad.nome, login: adminCad.login }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ token, usuario: { nome: adminCad.nome, login: adminCad.login, email: adminCad.login, tipo: "admin" } });
  }

  const usuarios = await lerDados("usuarios");
  const usuario = usuarios.find((u) => u.email === id || (u.login && u.login === id));
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
    return res.status(401).json({ erro: "Login, e-mail ou senha incorretos" });
  }

  await rDel(chave);
  const token = jwt.sign({ id: usuario.id, email: usuario.email, tipo: usuario.tipo, nome: usuario.nome }, JWT_SECRET, { expiresIn: "7d" });
  const { senha: _, ...dadosPublicos } = usuario;
  res.json({ token, usuario: dadosPublicos });
});

app.post("/api/auth/solicitar-reset", async (req, res) => {
  const email = sanitize(req.body.email, 150);
  if (!email) return res.status(400).json({ erro: "E-mail obrigatório" });

  res.json({ mensagem: "Se o e-mail estiver cadastrado, você receberá as instruções em instantes." });

  let usuario = null;
  if (dbOk) {
    const r = await db.query("SELECT * FROM usuarios WHERE email=$1", [email]);
    usuario = r.rows[0];
  } else {
    const usuarios = await lerDados("usuarios");
    usuario = usuarios.find(u => u.email === email);
  }
  if (!usuario || !mailer) return;

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = Date.now() + 60 * 60 * 1000;

  if (dbOk) {
    await db.query("DELETE FROM \"tokensReset\" WHERE email=$1 OR expiry<$2", [email, Date.now()]);
    await db.query(`INSERT INTO "tokensReset" (token, email, expiry) VALUES ($1,$2,$3)`, [token, email, expiry]);
  } else {
    const tokens = await lerDados("tokensReset");
    const tokensLimpos = tokens.filter(t => t.email !== email && t.expiry > Date.now());
    tokensLimpos.push({ token, email, expiry });
    await salvarDados("tokensReset", tokensLimpos);
  }

  const frontendUrl = process.env.FRONTEND_URL || "https://comic-geek-store-production.up.railway.app";
  const link = `${frontendUrl}/redefinir-senha?token=${token}`;

  try {
    await mailer.sendMail({
      from: `"Comic Geek Store" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Redefinição de senha — Comic Geek Store 🔒",
      html: `<div style="font-family:Montserrat,sans-serif;max-width:520px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6a0dad,#8b2fc9);padding:28px;text-align:center">
          <h1 style="font-family:Georgia,serif;font-size:1.5rem;color:#ffd84d;margin:0">🔒 Redefinir Senha</h1>
        </div>
        <div style="padding:28px">
          <p>Olá, <strong>${usuario.nome || "herói"}</strong>!</p>
          <p style="color:rgba(255,255,255,.8)">Recebemos uma solicitação para redefinir a senha da sua conta.</p>
          <a href="${link}" style="display:inline-block;background:#ffd84d;color:#000;font-weight:700;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;margin:16px 0">Redefinir minha senha →</a>
          <p style="color:rgba(255,255,255,.5);font-size:12px;margin-top:20px">Este link expira em <strong>1 hora</strong>.<br>Se você não solicitou isso, ignore este e-mail — sua senha permanece a mesma.</p>
        </div>
      </div>`,
    });
    console.log("[Reset] E-mail de redefinição enviado para", email);
  } catch (e) { console.error("[Reset] Erro ao enviar e-mail:", e.message); }
});

app.post("/api/auth/reset-senha", async (req, res) => {
  const { token, novaSenha } = req.body;
  if (!token || !novaSenha) return res.status(400).json({ erro: "Token e nova senha são obrigatórios" });
  if (novaSenha.length < 6) return res.status(400).json({ erro: "Senha deve ter no mínimo 6 caracteres" });

  if (dbOk) {
    const r = await db.query(`SELECT * FROM "tokensReset" WHERE token=$1 AND expiry>$2`, [token, Date.now()]);
    const tokenData = r.rows[0];
    if (!tokenData) return res.status(400).json({ erro: "Link inválido ou expirado. Solicite um novo." });
    const hash = await bcrypt.hash(novaSenha, 10);
    const upd = await db.query("UPDATE usuarios SET senha=$1 WHERE email=$2 RETURNING id", [hash, tokenData.email]);
    if (upd.rows.length === 0) return res.status(404).json({ erro: "Usuário não encontrado" });
    await db.query(`DELETE FROM "tokensReset" WHERE token=$1`, [token]);
    return res.json({ mensagem: "Senha atualizada com sucesso" });
  }

  const tokens = await lerDados("tokensReset");
  const tokenData = tokens.find(t => t.token === token && t.expiry > Date.now());
  if (!tokenData) return res.status(400).json({ erro: "Link inválido ou expirado. Solicite um novo." });

  const usuarios = await lerDados("usuarios");
  const idx = usuarios.findIndex(u => u.email === tokenData.email);
  if (idx === -1) return res.status(404).json({ erro: "Usuário não encontrado" });

  usuarios[idx].senha = await bcrypt.hash(novaSenha, 10);
  await salvarDados("usuarios", usuarios);
  await salvarDados("tokensReset", tokens.filter(t => t.token !== token));

  res.json({ mensagem: "Senha atualizada com sucesso" });
});

// ================================================
// USUÁRIOS
// ================================================
app.get("/api/usuarios/perfil", autenticar, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM usuarios WHERE email=$1", [req.usuario.email]);
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado" });
    const { senha, ...dadosPublicos } = rows[0];
    return res.json(dadosPublicos);
  }
  const usuarios = await lerDados("usuarios");
  const usuario = usuarios.find((u) => u.email === req.usuario.email);
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });
  const { senha, ...dadosPublicos } = usuario;
  res.json(dadosPublicos);
});

app.put("/api/usuarios/perfil", autenticar, async (req, res) => {
  const { nome, cpf, cnpj, razaoSocial, endereco } = req.body;
  if (dbOk) {
    const { rows } = await db.query(
      `UPDATE usuarios SET nome=$1, cpf=$2, cnpj=$3, "razaoSocial"=$4, endereco=$5 WHERE email=$6 RETURNING *`,
      [nome, cpf || null, cnpj || null, razaoSocial || null, endereco ? JSON.stringify(endereco) : null, req.usuario.email]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado" });
    const { senha, ...dadosPublicos } = rows[0];
    return res.json(dadosPublicos);
  }
  const usuarios = await lerDados("usuarios");
  const idx = usuarios.findIndex((u) => u.email === req.usuario.email);
  if (idx === -1) return res.status(404).json({ erro: "Usuário não encontrado" });
  usuarios[idx] = { ...usuarios[idx], nome, cpf, cnpj, razaoSocial, endereco };
  await salvarDados("usuarios", usuarios);
  const { senha, ...dadosPublicos } = usuarios[idx];
  res.json(dadosPublicos);
});

app.put("/api/usuarios/senha", autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM usuarios WHERE email=$1", [req.usuario.email]);
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado" });
    if (!(await bcrypt.compare(senhaAtual, rows[0].senha))) {
      return res.status(401).json({ erro: "Senha atual incorreta" });
    }
    const hash = await bcrypt.hash(novaSenha, 10);
    await db.query("UPDATE usuarios SET senha=$1 WHERE email=$2", [hash, req.usuario.email]);
    return res.json({ mensagem: "Senha atualizada" });
  }
  const usuarios = await lerDados("usuarios");
  const idx = usuarios.findIndex((u) => u.email === req.usuario.email);
  if (idx === -1) return res.status(404).json({ erro: "Usuário não encontrado" });
  if (!(await bcrypt.compare(senhaAtual, usuarios[idx].senha))) {
    return res.status(401).json({ erro: "Senha atual incorreta" });
  }
  usuarios[idx].senha = await bcrypt.hash(novaSenha, 10);
  await salvarDados("usuarios", usuarios);
  res.json({ mensagem: "Senha atualizada" });
});

// ================================================
// PRODUTOS
// ================================================
app.get("/api/produtos", async (req, res) => {
  const cache = await rGet("produtos:todos");
  if (cache) return res.json(JSON.parse(cache));

  let todos;
  if (dbOk) {
    const p = await db.query("SELECT * FROM produtos");
    const v = await db.query(`SELECT * FROM "produtosVendedores" WHERE status != 'removido'`);
    todos = [...p.rows, ...v.rows];
  } else {
    const produtos = await lerDados("produtos");
    const vendedor = await lerDados("produtosVendedores");
    todos = [...produtos, ...vendedor.filter((p) => p.status !== "removido")];
  }
  await rSet("produtos:todos", JSON.stringify(todos), 300);
  res.json(todos);
});

app.get("/api/produtos/buscar", async (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  if (q.length < 2) return res.json([]);

  if (dbOk) {
    const like = `%${q}%`;
    const p = await db.query(
      "SELECT * FROM produtos WHERE LOWER(nome) LIKE $1 OR LOWER(editora) LIKE $1 OR LOWER(secao) LIKE $1 LIMIT 20",
      [like]
    );
    const v = await db.query(
      `SELECT * FROM "produtosVendedores" WHERE status != 'removido' AND (LOWER(nome) LIKE $1 OR LOWER(categoria) LIKE $1) LIMIT 20`,
      [like]
    );
    return res.json([...p.rows, ...v.rows].slice(0, 20));
  }

  const produtos = await lerDados("produtos");
  const vendedor = await lerDados("produtosVendedores");
  const todos = [...produtos, ...vendedor.filter(p => p.status !== "removido")];
  const resultado = todos.filter(p =>
    (p.nome || "").toLowerCase().includes(q) ||
    (p.editora || "").toLowerCase().includes(q) ||
    (p.secao || "").toLowerCase().includes(q)
  ).slice(0, 20);
  res.json(resultado);
});

app.get("/api/produtos/:id", async (req, res) => {
  if (dbOk) {
    const p = await db.query("SELECT * FROM produtos WHERE id=$1", [req.params.id]);
    if (p.rows[0]) return res.json(p.rows[0]);
    const v = await db.query(`SELECT * FROM "produtosVendedores" WHERE id=$1`, [req.params.id]);
    if (v.rows[0]) return res.json(v.rows[0]);
    return res.status(404).json({ erro: "Produto não encontrado" });
  }
  const produtos = [...(await lerDados("produtos")), ...(await lerDados("produtosVendedores"))];
  const produto = produtos.find((p) => String(p.id) === req.params.id);
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado" });
  res.json(produto);
});

app.post("/api/produtos", autenticarAdmin, async (req, res) => {
  const { nome, preco, precoOriginal, img, editora, secao, estoque, dataLancamento } = req.body;
  if (!nome || !preco) return res.status(400).json({ erro: "Nome e preço são obrigatórios" });
  const qtdEstoque = estoque != null ? parseInt(estoque) : null;
  const id = Date.now();

  if (dbOk) {
    const { rows } = await db.query(
      `INSERT INTO produtos (id, nome, preco, "precoOriginal", img, editora, secao, estoque, esgotado, "dataLancamento")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, nome, preco, precoOriginal || null, img, editora, secao,
       qtdEstoque, qtdEstoque === 0, dataLancamento || null]
    );
    await rDel("produtos:todos");
    return res.status(201).json(rows[0]);
  }

  const produtos = await lerDados("produtos");
  const novo = { id, nome, preco, precoOriginal: precoOriginal || null, img, editora, secao, estoque: qtdEstoque, esgotado: qtdEstoque === 0, dataLancamento: dataLancamento || null, criadoEm: new Date().toISOString() };
  produtos.push(novo);
  await salvarDados("produtos", produtos);
  await rDel("produtos:todos");
  res.status(201).json(novo);
});

app.put("/api/produtos/:id", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const atual = await db.query("SELECT * FROM produtos WHERE id=$1", [req.params.id]);
    if (!atual.rows[0]) return res.status(404).json({ erro: "Produto não encontrado" });
    const anterior = atual.rows[0];
    const merged = { ...anterior, ...req.body };
    const { rows } = await db.query(
      `UPDATE produtos SET nome=$1, preco=$2, "precoOriginal"=$3, img=$4, editora=$5, secao=$6, estoque=$7, esgotado=$8, "dataLancamento"=$9 WHERE id=$10 RETURNING *`,
      [merged.nome, merged.preco, merged.precoOriginal, merged.img, merged.editora, merged.secao,
       merged.estoque, merged.esgotado, merged.dataLancamento, req.params.id]
    );
    await rDel("produtos:todos");
    if (anterior.esgotado && req.body.esgotado === false) notificarMeAvise(anterior.nome).catch(console.error);
    if (!anterior.esgotado && req.body.esgotado === true) alertarEstoqueEsgotado(anterior.nome).catch(console.error);
    return res.json(rows[0]);
  }

  const produtos = await lerDados("produtos");
  const idx = produtos.findIndex((p) => String(p.id) === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Produto não encontrado" });
  const anterior = produtos[idx];
  produtos[idx] = { ...anterior, ...req.body };
  await salvarDados("produtos", produtos);
  await rDel("produtos:todos");

  if (anterior.esgotado && req.body.esgotado === false) notificarMeAvise(anterior.nome).catch(console.error);
  if (!anterior.esgotado && req.body.esgotado === true) alertarEstoqueEsgotado(anterior.nome).catch(console.error);

  res.json(produtos[idx]);
});

app.delete("/api/produtos/:id", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const r1 = await db.query("DELETE FROM produtos WHERE id=$1 RETURNING id", [req.params.id]);
    if (r1.rows.length === 0) {
      await db.query(`DELETE FROM "produtosVendedores" WHERE id=$1`, [req.params.id]);
    }
    await rDel("produtos:todos");
    return res.json({ mensagem: "Produto removido" });
  }

  let produtos = await lerDados("produtos");
  const existia = produtos.find((p) => String(p.id) === req.params.id);
  if (!existia) {
    let vendedor = await lerDados("produtosVendedores");
    vendedor = vendedor.filter((p) => String(p.id) !== req.params.id);
    await salvarDados("produtosVendedores", vendedor);
  } else {
    produtos = produtos.filter((p) => String(p.id) !== req.params.id);
    await salvarDados("produtos", produtos);
  }
  await rDel("produtos:todos");
  res.json({ mensagem: "Produto removido" });
});

// ================================================
// VENDEDOR
// ================================================
app.get("/api/vendedor/produtos", autenticar, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query(`SELECT * FROM "produtosVendedores" WHERE "vendedorEmail"=$1`, [req.usuario.email]);
    return res.json(rows);
  }
  const produtos = await lerDados("produtosVendedores");
  res.json(produtos.filter((p) => p.vendedorEmail === req.usuario.email));
});

app.post("/api/vendedor/produtos", autenticar, async (req, res) => {
  let usuario;
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM usuarios WHERE email=$1", [req.usuario.email]);
    usuario = rows[0];
  } else {
    const usuarios = await lerDados("usuarios");
    usuario = usuarios.find((u) => u.email === req.usuario.email);
  }
  if (!usuario || usuario.tipo !== "juridica" || usuario.status !== "aprovado") {
    return res.status(403).json({ erro: "Apenas vendedores aprovados podem anunciar" });
  }
  const { nome, preco, precoOriginal, img, categoria, descricao } = req.body;
  const id = Date.now();

  if (dbOk) {
    const { rows } = await db.query(
      `INSERT INTO "produtosVendedores" (id, nome, preco, "precoOriginal", img, categoria, descricao, "vendedorEmail", "vendedorNome")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, nome, preco, precoOriginal || null, img, categoria, descricao, req.usuario.email, req.usuario.nome]
    );
    await rDel("produtos:todos");
    return res.status(201).json(rows[0]);
  }

  const produtos = await lerDados("produtosVendedores");
  const novo = {
    id, nome, preco, precoOriginal: precoOriginal || null,
    img, categoria, descricao, vendedorEmail: req.usuario.email,
    vendedorNome: req.usuario.nome, criadoEm: new Date().toISOString(),
  };
  produtos.push(novo);
  await salvarDados("produtosVendedores", produtos);
  await rDel("produtos:todos");
  res.status(201).json(novo);
});

app.delete("/api/vendedor/produtos/:id", autenticar, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query(`SELECT * FROM "produtosVendedores" WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: "Produto não encontrado" });
    if (rows[0].vendedorEmail !== req.usuario.email) return res.status(403).json({ erro: "Sem permissão" });
    await db.query(`DELETE FROM "produtosVendedores" WHERE id=$1`, [req.params.id]);
    await rDel("produtos:todos");
    return res.json({ mensagem: "Produto removido" });
  }

  let produtos = await lerDados("produtosVendedores");
  const produto = produtos.find((p) => String(p.id) === req.params.id);
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado" });
  if (produto.vendedorEmail !== req.usuario.email) return res.status(403).json({ erro: "Sem permissão" });
  produtos = produtos.filter((p) => String(p.id) !== req.params.id);
  await salvarDados("produtosVendedores", produtos);
  await rDel("produtos:todos");
  res.json({ mensagem: "Produto removido" });
});

app.get("/api/vendedor/vendas", autenticar, async (req, res) => {
  let pedidos;
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM pedidos WHERE status='concluido'");
    pedidos = rows;
  } else {
    pedidos = await lerDados("pedidos");
    pedidos = pedidos.filter((p) => p.status === "concluido");
  }
  const vendas = {};
  pedidos.forEach((pedido) => {
    const itens = Array.isArray(pedido.itens) ? pedido.itens : (typeof pedido.itens === "string" ? JSON.parse(pedido.itens) : []);
    itens.forEach((item) => {
      if (!vendas[item.nome]) vendas[item.nome] = { nome: item.nome, qtd: 0, total: 0 };
      vendas[item.nome].qtd += item.qtd;
      vendas[item.nome].total += item.preco * item.qtd;
    });
  });
  res.json(Object.values(vendas));
});

// ================================================
// PEDIDOS
// ================================================
app.get("/api/pedidos", autenticar, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM pedidos WHERE email=$1 ORDER BY id DESC", [req.usuario.email]);
    return res.json(rows);
  }
  const pedidos = await lerDados("pedidos");
  res.json(pedidos.filter((p) => p.email === req.usuario.email));
});

app.get("/api/pedidos/:id", autenticar, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM pedidos WHERE id=$1 AND email=$2", [req.params.id, req.usuario.email]);
    if (!rows[0]) return res.status(404).json({ erro: "Pedido não encontrado" });
    return res.json(rows[0]);
  }
  const pedidos = await lerDados("pedidos");
  const pedido = pedidos.find((p) => String(p.id) === req.params.id && p.email === req.usuario.email);
  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
  res.json(pedido);
});

app.post("/api/pedidos", autenticar, async (req, res) => {
  const { itens, pagamento, frete, cupom } = req.body;
  if (!itens || itens.length === 0) return res.status(400).json({ erro: "Carrinho vazio" });

  const subtotal = itens.reduce((s, i) => s + Number(i.preco) * Number(i.qtd || 1), 0);
  let desconto = 0;
  if (cupom) {
    const cupons = await lerCupons();
    const c = cupons.find(x => x.codigo === String(cupom).toUpperCase());
    if (c) desconto = subtotal * (c.desconto / 100);
  }
  const total = parseFloat((subtotal - desconto + (Number(frete) || 0)).toFixed(2));

  const agora = new Date();
  const pedido = {
    id: agora.getTime(),
    numero: "CGS-" + agora.getTime().toString().slice(-6),
    data: agora.toLocaleDateString("pt-BR"),
    dataISO: agora.toISOString(),
    email: req.usuario.email,
    itens, total, pagamento, frete: Number(frete) || 0,
    status: "pendente",
  };

  if (dbOk) {
    await db.query(
      `INSERT INTO pedidos (id, numero, data, "dataISO", email, nome, itens, total, pagamento, frete, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [pedido.id, pedido.numero, pedido.data, pedido.dataISO,
       pedido.email, req.usuario.nome, JSON.stringify(itens), total, pagamento, Number(frete) || 0, "pendente"]
    );
  } else {
    const pedidos = await lerDados("pedidos");
    pedidos.unshift(pedido);
    await salvarDados("pedidos", pedidos);
  }

  // Decrementa estoque
  (async () => {
    if (dbOk) {
      for (const item of itens) {
        const r = await db.query("SELECT * FROM produtos WHERE id=$1 OR nome=$2 LIMIT 1", [item.id || 0, item.nome]);
        const prod = r.rows[0];
        if (!prod || prod.estoque == null) continue;
        const novoEstoque = Math.max(0, (prod.estoque || 0) - (item.qtd || 1));
        const esgotado = novoEstoque === 0;
        await db.query("UPDATE produtos SET estoque=$1, esgotado=$2 WHERE id=$3", [novoEstoque, esgotado, prod.id]);
        if (esgotado && !prod.esgotado) alertarEstoqueEsgotado(prod.nome).catch(() => {});
      }
      await rDel("produtos:todos");
    } else {
      const produtos = await lerDados("produtos");
      let alterado = false;
      for (const item of itens) {
        const idx = produtos.findIndex(p => String(p.id) === String(item.id) || p.nome === item.nome);
        if (idx === -1 || produtos[idx].estoque == null) continue;
        produtos[idx].estoque = Math.max(0, (produtos[idx].estoque || 0) - (item.qtd || 1));
        if (produtos[idx].estoque === 0 && !produtos[idx].esgotado) {
          produtos[idx].esgotado = true;
          alertarEstoqueEsgotado(produtos[idx].nome).catch(() => {});
        }
        alterado = true;
      }
      if (alterado) {
        await salvarDados("produtos", produtos);
        await rDel("produtos:todos");
      }
    }
  })().catch(() => {});

  // Email de confirmação
  let nomeUsuario = req.usuario.nome || "Cliente";
  if (dbOk) {
    const r = await db.query("SELECT nome FROM usuarios WHERE email=$1", [req.usuario.email]);
    if (r.rows[0]) nomeUsuario = r.rows[0].nome;
  } else {
    const usuarios = await lerDados("usuarios");
    const usr = usuarios.find(u => u.email === req.usuario.email);
    if (usr) nomeUsuario = usr.nome;
  }
  enviarEmailPedido(req.usuario.email, nomeUsuario, pedido).catch(() => {});

  res.status(201).json(pedido);
});

app.put("/api/pedidos/:id/status", autenticarAdmin, async (req, res) => {
  const { status } = req.body;
  if (dbOk) {
    const { rows } = await db.query("UPDATE pedidos SET status=$1 WHERE id=$2 RETURNING *", [status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: "Pedido não encontrado" });
    return res.json(rows[0]);
  }
  const pedidos = await lerDados("pedidos");
  const idx = pedidos.findIndex((p) => String(p.id) === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Pedido não encontrado" });
  pedidos[idx].status = status;
  await salvarDados("pedidos", pedidos);
  res.json(pedidos[idx]);
});

app.put("/api/pedidos/:id/cancelar", autenticar, async (req, res) => {
  if (dbOk) {
    const r = await db.query("SELECT * FROM pedidos WHERE id=$1 AND email=$2", [req.params.id, req.usuario.email]);
    if (!r.rows[0]) return res.status(404).json({ erro: "Pedido não encontrado" });
    const statusAtual = r.rows[0].status;
    if (statusAtual !== "pendente" && statusAtual !== "aguardando_pagamento") {
      return res.status(400).json({ erro: "Este pedido não pode ser cancelado" });
    }
    const { rows } = await db.query(
      `UPDATE pedidos SET status='cancelado', "canceladoEm"=$1 WHERE id=$2 RETURNING *`,
      [new Date().toISOString(), req.params.id]
    );
    return res.json(rows[0]);
  }
  const pedidos = await lerDados("pedidos");
  const idx = pedidos.findIndex((p) => String(p.id) === req.params.id && p.email === req.usuario.email);
  if (idx === -1) return res.status(404).json({ erro: "Pedido não encontrado" });
  const statusAtual = pedidos[idx].status;
  if (statusAtual !== "pendente" && statusAtual !== "aguardando_pagamento") {
    return res.status(400).json({ erro: "Este pedido não pode ser cancelado" });
  }
  pedidos[idx].status = "cancelado";
  pedidos[idx].canceladoEm = new Date().toISOString();
  await salvarDados("pedidos", pedidos);
  res.json(pedidos[idx]);
});

// ================================================
// CUPONS
// ================================================
app.get("/api/cupons/:codigo", async (req, res) => {
  const codigo = req.params.codigo.toUpperCase();
  const cupons = await lerCupons();
  const cupom = cupons.find(c => c.codigo === codigo);
  if (!cupom) return res.status(404).json({ erro: "Cupom inválido ou expirado" });
  if (cupom.ativo === false) return res.status(404).json({ erro: "Cupom inválido ou expirado" });
  if (cupom.validoAte && new Date(cupom.validoAte) < new Date()) return res.status(404).json({ erro: "Cupom expirado" });
  res.json({ codigo: cupom.codigo, desconto: parseFloat(cupom.desconto) });
});

app.get("/api/admin/cupons", autenticarAdmin, async (req, res) => {
  res.json(await lerCupons());
});

app.post("/api/admin/cupons", autenticarAdmin, async (req, res) => {
  const { codigo, desconto } = req.body;
  if (!codigo || !desconto) return res.status(400).json({ erro: "Campos obrigatórios" });
  const cup = codigo.toUpperCase().replace(/\s+/g, "");

  if (dbOk) {
    const existe = await db.query("SELECT id FROM cupons WHERE codigo=$1", [cup]);
    if (existe.rows.length > 0) return res.status(400).json({ erro: "Cupom já existe" });
    const { rows } = await db.query(
      `INSERT INTO cupons (codigo, desconto, ativo, "validoAte") VALUES ($1,$2,true,$3) RETURNING *`,
      [cup, parseFloat(desconto), req.body.validoAte || null]
    );
    return res.json(rows[0]);
  }

  const cupons = await lerCupons();
  if (cupons.find(c => c.codigo === cup)) return res.status(400).json({ erro: "Cupom já existe" });
  const novo = { codigo: cup, desconto: parseFloat(desconto), criadoEm: new Date().toISOString(), ativo: true, validoAte: req.body.validoAte || null };
  cupons.push(novo);
  await salvarDados("cupons", cupons);
  res.json(novo);
});

app.delete("/api/admin/cupons/:codigo", autenticarAdmin, async (req, res) => {
  const codigo = req.params.codigo.toUpperCase();
  if (dbOk) {
    await db.query("DELETE FROM cupons WHERE codigo=$1", [codigo]);
    return res.json({ ok: true });
  }
  let cupons = await lerCupons();
  cupons = cupons.filter(c => c.codigo !== codigo);
  await salvarDados("cupons", cupons);
  res.json({ ok: true });
});

// ================================================
// FRETE
// ================================================
app.post("/api/frete/calcular", (req, res) => {
  const { cep, total } = req.body;
  if (!cep) return res.status(400).json({ erro: "CEP obrigatório" });
  const estado = Number(cep.replace(/\D/g, "").substring(0, 2));
  let regiao = "norte";
  if (estado <= 39) regiao = "sudeste";
  else if (estado <= 49) regiao = "centro_oeste";
  else if (estado <= 65) regiao = "nordeste";
  else if (estado <= 69) regiao = "norte";
  else if (estado <= 79) regiao = "sul";
  else if (estado <= 99) regiao = "sul";
  const tabela = { sudeste: { pac: 12, sedex: 22 }, sul: { pac: 15, sedex: 28 }, centro_oeste: { pac: 18, sedex: 32 }, nordeste: { pac: 22, sedex: 40 }, norte: { pac: 28, sedex: 50 } };
  const opcoes = tabela[regiao];
  const gratis = total >= 200;
  res.json({
    regiao,
    pac: { preco: gratis ? 0 : opcoes.pac, prazo: "7-12 dias úteis", gratis },
    sedex: { preco: gratis ? 0 : opcoes.sedex, prazo: "2-5 dias úteis", gratis },
  });
});

// ================================================
// PAGAMENTO — MERCADO PAGO
// ================================================
app.post("/api/criar-preferencia", autenticar, async (req, res) => {
  const { itens, pedidoNumero, email } = req.body;
  if (!itens || itens.length === 0) return res.status(400).json({ erro: "Carrinho vazio" });

  const total = itens.reduce((s, i) => s + Number(i.preco) * Number(i.qtd), 0);
  const numero = pedidoNumero || "CGS-" + Date.now().toString().slice(-6);
  const frontendUrl = process.env.FRONTEND_URL || "https://comic-geek-store-production.up.railway.app";
  const backendUrl  = process.env.BACKEND_URL  || frontendUrl;

  const EXPIRACAO_HORAS = parseInt(process.env.PEDIDO_EXPIRACAO_HORAS || "24");
  const expiresAt = new Date(Date.now() + EXPIRACAO_HORAS * 60 * 60 * 1000).toISOString();

  if (dbOk) {
    const existe = await db.query("SELECT id FROM pedidos WHERE numero=$1", [numero]);
    if (existe.rows.length === 0) {
      const id = Date.now();
      await db.query(
        `INSERT INTO pedidos (id, numero, data, "dataISO", "expiresAt", email, nome, itens, total, pagamento, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, numero, new Date().toLocaleDateString("pt-BR"), new Date().toISOString(), expiresAt,
         email || req.usuario.email, req.usuario.nome, JSON.stringify(itens), total, "mercadopago", "pendente"]
      );
    }
  } else {
    const pedidos = await lerDados("pedidos");
    if (!pedidos.find(p => p.numero === numero)) {
      pedidos.unshift({
        id: Date.now(), numero,
        data: new Date().toLocaleDateString("pt-BR"),
        dataISO: new Date().toISOString(),
        expiresAt,
        email: email || req.usuario.email,
        nome: req.usuario.nome,
        itens, total, pagamento: "mercadopago", status: "pendente",
      });
      await salvarDados("pedidos", pedidos);
    }
  }

  try {
    const itensSanitizados = itens.map((item, idx) => {
      const preco = parseFloat(String(item.preco).replace(",", ".").replace(/[^\d.]/g, ""));
      const qtd   = parseInt(item.qtd) || 1;
      if (!preco || preco <= 0) throw new Error(`Item ${idx} com preço inválido`);
      return { id: String(item.id || idx + 1), title: String(item.nome || "Produto").slice(0, 256), quantity: qtd, unit_price: Math.round(preco * 100) / 100, currency_id: "BRL" };
    });
    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: itensSanitizados,
        payer: { email: email || req.usuario.email },
        external_reference: numero,
        expiration_date_to: expiresAt,
        back_urls: {
          success: `${frontendUrl}/pedidos?status=aprovado&pedido=${numero}`,
          failure: `${frontendUrl}/carrinho?status=erro`,
          pending: `${frontendUrl}/pedidos?status=pendente&pedido=${numero}`,
        },
        auto_return: "approved",
        notification_url: `${backendUrl}/api/webhook`,
        statement_descriptor: "Comic Geek Store",
        payment_methods: { installments: 12 },
      },
    });
    res.json({ id: result.id, init_point: result.init_point, pedidoNumero: numero, expiresAt });
  } catch (err) {
    console.error("Erro MercadoPago:", err.message);
    res.status(500).json({ erro: "Erro ao criar preferência de pagamento: " + err.message });
  }
});

async function enviarEmailConfirmacao(pedido) {
  const serviceId  = process.env.EMAILJS_SERVICE_ID  || "service_9clvgis";
  const templateId = process.env.EMAILJS_TEMPLATE_ID || "template_gcu8cs7";
  const publicKey  = process.env.EMAILJS_PUBLIC_KEY  || "x4buxmvZZJYw4gkv4";
  const itensTexto = (pedido.itens || []).map(i => `${i.nome} (x${i.qtd}) — R$ ${(i.preco * i.qtd).toFixed(2).replace(".", ",")}`).join("\n");
  try {
    const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId, template_id: templateId, user_id: publicKey,
        template_params: {
          cliente_nome: pedido.nome || pedido.email, cliente_email: pedido.email,
          pedido_numero: pedido.numero, pedido_itens: itensTexto,
          pedido_total: "R$ " + Number(pedido.total).toFixed(2).replace(".", ","),
          pedido_metodo: pedido.metodoPagamento || "MercadoPago",
        },
      }),
    });
    console.log("Email enviado:", resp.status);
  } catch (err) {
    console.error("Erro ao enviar e-mail:", err.message);
  }
}

app.post("/api/webhook", async (req, res) => {
  res.sendStatus(200);
  const { type, data } = req.body;
  if (type !== "payment" || !data?.id) return;
  try {
    const payment = new Payment(mpClient);
    const pagamento = await payment.get({ id: data.id });

    if (dbOk) {
      const r = await db.query("SELECT * FROM pedidos WHERE numero=$1", [pagamento.external_reference]);
      if (!r.rows[0]) return;
      if (pagamento.status === "approved") {
        await db.query(
          `UPDATE pedidos SET status='concluido', "pagamentoId"=$1, "metodoPagamento"=$2 WHERE numero=$3`,
          [data.id, pagamento.payment_type_id, pagamento.external_reference]
        );
        enviarEmailConfirmacao(r.rows[0]);
      } else if (pagamento.status === "rejected" || pagamento.status === "cancelled") {
        await db.query("UPDATE pedidos SET status='cancelado' WHERE numero=$1", [pagamento.external_reference]);
      }
      return;
    }

    const pedidos = await lerDados("pedidos");
    const idx = pedidos.findIndex((p) => p.numero === pagamento.external_reference);
    if (idx === -1) return;
    if (pagamento.status === "approved") {
      pedidos[idx].status = "concluido";
      pedidos[idx].pagamentoId = data.id;
      pedidos[idx].metodoPagamento = pagamento.payment_type_id;
      await salvarDados("pedidos", pedidos);
      enviarEmailConfirmacao(pedidos[idx]);
    } else if (pagamento.status === "rejected" || pagamento.status === "cancelled") {
      pedidos[idx].status = "cancelado";
      await salvarDados("pedidos", pedidos);
    }
  } catch (err) { console.error("Webhook error:", err.message); }
});

// ================================================
// ADMIN
// ================================================
app.get("/api/admin/stats", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const [u, p, pv, ped] = await Promise.all([
      db.query("SELECT COUNT(*) FROM usuarios"),
      db.query("SELECT COUNT(*) FROM produtos"),
      db.query(`SELECT COUNT(*) FROM "produtosVendedores"`),
      db.query("SELECT status FROM pedidos"),
    ]);
    const pedidos = ped.rows;
    const totalReceita = await db.query("SELECT COALESCE(SUM(total),0) as soma FROM pedidos WHERE status='concluido'");
    return res.json({
      totalUsuarios: parseInt(u.rows[0].count),
      totalPedidos: pedidos.length,
      totalProdutos: parseInt(p.rows[0].count) + parseInt(pv.rows[0].count),
      totalReceita: parseFloat(totalReceita.rows[0].soma),
      pedidosPendentes: pedidos.filter(p => p.status === "pendente").length,
      aprovacoesPendentes: (await db.query("SELECT COUNT(*) FROM usuarios WHERE tipo='juridica' AND status='pendente'")).rows[0].count,
    });
  }
  const usuarios = await lerDados("usuarios");
  const pedidos  = await lerDados("pedidos");
  const produtos  = [...(await lerDados("produtos")), ...(await lerDados("produtosVendedores"))];
  const totalReceita = pedidos.filter((p) => p.status === "concluido").reduce((s, p) => s + p.total, 0);
  res.json({
    totalUsuarios: usuarios.length, totalPedidos: pedidos.length,
    totalProdutos: produtos.length, totalReceita,
    pedidosPendentes: pedidos.filter((p) => p.status === "pendente").length,
    aprovacoesPendentes: usuarios.filter((u) => u.status === "pendente").length,
  });
});

app.get("/api/admin/usuarios", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query("SELECT id, nome, email, login, tipo, cpf, cnpj, \"razaoSocial\", endereco, status, \"criadoEm\" FROM usuarios");
    return res.json(rows);
  }
  const usuarios = (await lerDados("usuarios")).map(({ senha, ...u }) => u);
  res.json(usuarios);
});

app.put("/api/admin/usuarios/:email", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const r = await db.query("SELECT * FROM usuarios WHERE email=$1", [req.params.email]);
    if (!r.rows[0]) return res.status(404).json({ erro: "Usuário não encontrado" });
    const { novaSenha, senha: _s, ...resto } = req.body;
    const campos = { ...r.rows[0], ...resto };
    if (novaSenha && novaSenha.length >= 6) campos.senha = await bcrypt.hash(novaSenha, 10);
    const { rows } = await db.query(
      `UPDATE usuarios SET nome=$1, tipo=$2, status=$3, cpf=$4, cnpj=$5, "razaoSocial"=$6, endereco=$7, senha=$8 WHERE email=$9 RETURNING *`,
      [campos.nome, campos.tipo, campos.status, campos.cpf, campos.cnpj, campos.razaoSocial,
       campos.endereco ? JSON.stringify(campos.endereco) : null, campos.senha, req.params.email]
    );
    const { senha, ...dadosPublicos } = rows[0];
    return res.json(dadosPublicos);
  }
  const usuarios = await lerDados("usuarios");
  const idx = usuarios.findIndex((u) => u.email === req.params.email);
  if (idx === -1) return res.status(404).json({ erro: "Usuário não encontrado" });
  const { novaSenha, ...resto } = req.body;
  usuarios[idx] = { ...usuarios[idx], ...resto };
  if (novaSenha && novaSenha.length >= 6) usuarios[idx].senha = await bcrypt.hash(novaSenha, 10);
  await salvarDados("usuarios", usuarios);
  const { senha, ...dadosPublicos } = usuarios[idx];
  res.json(dadosPublicos);
});

app.delete("/api/admin/usuarios/:email", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    await db.query("DELETE FROM usuarios WHERE email=$1", [req.params.email]);
    return res.json({ mensagem: "Usuário removido" });
  }
  let usuarios = await lerDados("usuarios");
  usuarios = usuarios.filter((u) => u.email !== req.params.email);
  await salvarDados("usuarios", usuarios);
  res.json({ mensagem: "Usuário removido" });
});

// ================================================
// LIMPEZA DE PEDIDOS EXPIRADOS
// ================================================
async function limparPedidosExpirados() {
  if (dbOk) {
    await db.query(
      "DELETE FROM pedidos WHERE status='pendente' AND \"expiresAt\" IS NOT NULL AND \"expiresAt\" < NOW()"
    );
    return;
  }
  const pedidos = await lerDados("pedidos");
  const agora = Date.now();
  const ativos = pedidos.filter(p => {
    if (p.status !== "pendente") return true;
    if (!p.expiresAt) return true;
    return new Date(p.expiresAt).getTime() > agora;
  });
  if (ativos.length < pedidos.length) {
    await salvarDados("pedidos", ativos);
    console.log(`Limpeza: ${pedidos.length - ativos.length} pedido(s) expirado(s) removido(s)`);
  }
}

setInterval(limparPedidosExpirados, 60 * 60 * 1000).unref();

// ================================================
// AUTOMAÇÕES
// ================================================

async function arquivarPedidosAntigos() {
  if (dbOk) {
    const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { rows: antigos } = await db.query(
      `SELECT * FROM pedidos WHERE "dataISO" < $1 AND status IN ('aprovado','concluido','cancelado')`,
      [limite]
    );
    if (antigos.length === 0) return;
    for (const p of antigos) {
      await db.query(
        `INSERT INTO "pedidosArquivo" (id, numero, data, "dataISO", email, nome, itens, total, pagamento, frete, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.numero, p.data, p.dataISO, p.email, p.nome, p.itens, p.total, p.pagamento, p.frete, p.status]
      );
    }
    await db.query(`DELETE FROM pedidos WHERE "dataISO" < $1 AND status IN ('aprovado','concluido','cancelado')`, [limite]);
    console.log(`[Automação] ${antigos.length} pedido(s) arquivado(s)`);
    return;
  }
  const pedidos = await lerDados("pedidos");
  const arquivo = await lerDados("pedidosArquivo");
  const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const antigos = pedidos.filter(p => {
    const data = p.dataISO ? new Date(p.dataISO).getTime() : 0;
    return data < limite && ["aprovado", "concluido", "cancelado"].includes(p.status);
  });
  if (antigos.length === 0) return;
  const ativos = pedidos.filter(p => !antigos.find(a => a.id === p.id));
  await salvarDados("pedidos", ativos);
  await salvarDados("pedidosArquivo", [...arquivo, ...antigos]);
  console.log(`[Automação] ${antigos.length} pedido(s) arquivado(s)`);
}

async function cancelarPedidosPendentesAntigos() {
  if (dbOk) {
    const limite = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      `UPDATE pedidos SET status='cancelado', "canceladoEm"=NOW() WHERE status='pendente' AND "expiresAt" IS NULL AND "dataISO" < $1`,
      [limite]
    );
    return;
  }
  const pedidos = await lerDados("pedidos");
  const limite = Date.now() - 3 * 24 * 60 * 60 * 1000;
  let alterou = false;
  pedidos.forEach(p => {
    if (p.status !== "pendente") return;
    if (p.expiresAt) return;
    const data = p.dataISO ? new Date(p.dataISO).getTime() : 0;
    if (data < limite) { p.status = "cancelado"; p.canceladoEm = new Date().toISOString(); alterou = true; }
  });
  if (alterou) {
    await salvarDados("pedidos", pedidos);
    console.log("[Automação] Pedidos pendentes antigos cancelados");
  }
}

async function expirarCupons() {
  if (dbOk) {
    await db.query(`UPDATE cupons SET ativo=false WHERE ativo=true AND "validoAte" IS NOT NULL AND "validoAte" < NOW()`);
    return;
  }
  const cupons = await lerCupons();
  const agora = new Date();
  let alterou = false;
  cupons.forEach(c => {
    if (c.ativo === false) return;
    if (c.validoAte && new Date(c.validoAte) < agora) {
      c.ativo = false; alterou = true;
      console.log(`[Automação] Cupom ${c.codigo} expirado`);
    }
  });
  if (alterou) await salvarDados("cupons", cupons);
}

async function enviarRelatorioSemanal() {
  if (!mailer) return;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return;

  let todos;
  if (dbOk) {
    const p = await db.query("SELECT * FROM pedidos");
    const a = await db.query(`SELECT * FROM "pedidosArquivo"`);
    todos = [...p.rows, ...a.rows];
  } else {
    const pedidos = await lerDados("pedidos");
    const arquivo = await lerDados("pedidosArquivo");
    todos = [...pedidos, ...arquivo];
  }

  const seteDias = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const semana = todos.filter(p => p.dataISO && new Date(p.dataISO).getTime() > seteDias);
  const aprovados = semana.filter(p => ["aprovado", "concluido"].includes(p.status));
  const faturamento = aprovados.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const contagem = {};
  aprovados.forEach(p => {
    const itens = Array.isArray(p.itens) ? p.itens : (typeof p.itens === "string" ? JSON.parse(p.itens) : []);
    itens.forEach(i => { contagem[i.nome] = (contagem[i.nome] || 0) + (i.qtd || 1); });
  });
  const top5 = Object.entries(contagem).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topHtml = top5.map(([n,q]) => `<li>${n} — <strong>${q} vendido(s)</strong></li>`).join("") || "<li>Nenhuma venda</li>";
  try {
    await mailer.sendMail({
      from: `"Comic Geek Store" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `📊 Relatório Semanal — Comic Geek Store`,
      html: `<div style="font-family:Montserrat,sans-serif;max-width:560px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6a0dad,#8b2fc9);padding:24px 28px;text-align:center">
          <h1 style="font-family:Georgia,serif;font-size:1.5rem;color:#ffd84d;margin:0">📊 Relatório Semanal</h1>
          <p style="color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px">Últimos 7 dias</p>
        </div>
        <div style="padding:28px">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
            <tr><td style="padding:10px 0;border-bottom:1px solid #333;color:#aaa">Total de pedidos</td><td style="text-align:right;font-weight:700">${semana.length}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #333;color:#aaa">Pedidos aprovados</td><td style="text-align:right;font-weight:700;color:#2ecc71">${aprovados.length}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #333;color:#aaa">Pedidos pendentes</td><td style="text-align:right;font-weight:700;color:#f39c12">${semana.filter(p=>p.status==="pendente").length}</td></tr>
            <tr><td style="padding:10px 0;color:#aaa">Faturamento aprovado</td><td style="text-align:right;font-weight:800;color:#ffd84d;font-size:1.2rem">R$ ${faturamento.toFixed(2).replace(".",",")}</td></tr>
          </table>
          <h3 style="margin:0 0 10px;font-size:14px;color:#c97aff">🏆 Mais vendidos da semana</h3>
          <ul style="padding-left:18px;color:rgba(255,255,255,.8);line-height:1.8">${topHtml}</ul>
        </div>
      </div>`,
    });
    console.log("[Automação] Relatório semanal enviado para", adminEmail);
  } catch (e) { console.error("[Automação] Erro ao enviar relatório:", e.message); }
}

async function alertarEstoqueEsgotado(nomeProduto) {
  if (!mailer) return;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return;
  try {
    await mailer.sendMail({
      from: `"Comic Geek Store" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `⚠️ Produto esgotado: ${nomeProduto}`,
      html: `<div style="font-family:Montserrat,sans-serif;max-width:500px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#c0392b,#e74c3c);padding:20px 28px;text-align:center">
          <h1 style="font-size:1.3rem;color:#fff;margin:0">⚠️ Produto Esgotado</h1>
        </div>
        <div style="padding:24px">
          <p>O produto <strong style="color:#ffd84d">${nomeProduto}</strong> foi marcado como <strong>esgotado</strong> no painel admin.</p>
          <p style="color:rgba(255,255,255,.6);font-size:13px">Acesse o painel para atualizar o estoque quando disponível.</p>
        </div>
      </div>`,
    });
  } catch (e) { console.error("[Automação] Erro ao alertar estoque:", e.message); }
}

async function notificarMeAvise(nomeProduto) {
  if (!mailer) return;
  let avisos;
  if (dbOk) {
    const { rows } = await db.query(`SELECT * FROM "avisosEstoque" WHERE produto=$1`, [nomeProduto]);
    avisos = rows;
  } else {
    const todos = await lerDados("avisosEstoque");
    avisos = todos.filter(a => a.produto === nomeProduto);
  }
  if (avisos.length === 0) return;
  const frontendUrl = process.env.FRONTEND_URL || "https://comic-geek-store-production.up.railway.app";
  for (const aviso of avisos) {
    try {
      await mailer.sendMail({
        from: `"Comic Geek Store" <${process.env.SMTP_USER}>`,
        to: aviso.email,
        subject: `"${nomeProduto}" voltou ao estoque! 🎉`,
        html: `<div style="font-family:Montserrat,sans-serif;max-width:560px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#6a0dad,#8b2fc9);padding:24px 28px;text-align:center">
            <h1 style="font-family:Georgia,serif;font-size:1.5rem;color:#ffd84d;margin:0">🎉 Voltou ao Estoque!</h1>
          </div>
          <div style="padding:28px">
            <p>Boa notícia! O produto que você estava esperando voltou:</p>
            <h2 style="color:#ffd84d;margin:12px 0 20px">${nomeProduto}</h2>
            <a href="${frontendUrl}" style="display:inline-block;background:#ffd84d;color:#000;font-weight:700;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px">Comprar agora →</a>
            <p style="color:rgba(255,255,255,.4);font-size:11px;margin-top:24px">Você recebeu este e-mail porque clicou em "Me Avise" na Comic Geek Store.</p>
          </div>
        </div>`,
      });
    } catch (e) { console.error("[Automação] Erro ao notificar Me Avise:", e.message); }
  }
  if (dbOk) {
    await db.query(`DELETE FROM "avisosEstoque" WHERE produto=$1`, [nomeProduto]);
  } else {
    const todos = await lerDados("avisosEstoque");
    await salvarDados("avisosEstoque", todos.filter(a => a.produto !== nomeProduto));
  }
  console.log(`[Automação] ${avisos.length} notificação(ões) Me Avise enviadas para "${nomeProduto}"`);
}

async function verificarCarrinhosAbandonados() {
  if (!mailer) return;
  let carrinhos;
  if (dbOk) {
    const { rows } = await db.query(`SELECT * FROM "carrinhosAbandono" WHERE notificado=false`);
    carrinhos = rows;
  } else {
    carrinhos = await lerDados("carrinhosAbandono");
  }
  if (!carrinhos.length) return;
  const limite = Date.now() - 60 * 60 * 1000;
  const frontendUrl = process.env.FRONTEND_URL || "https://comic-geek-store-production.up.railway.app";
  const pendentes = carrinhos.filter(c => !c.notificado && new Date(c.atualizadoEm).getTime() < limite);
  for (const c of pendentes) {
    const itensArr = Array.isArray(c.itens) ? c.itens : (typeof c.itens === "string" ? JSON.parse(c.itens) : []);
    const itensHtml = itensArr.map(i =>
      `<tr><td style="padding:6px 0;border-bottom:1px solid #222">${i.nome}</td><td style="padding:6px 0;border-bottom:1px solid #222;text-align:right">x${i.qtd}</td><td style="padding:6px 0;border-bottom:1px solid #222;text-align:right;color:#ffd84d">R$ ${(i.preco*i.qtd).toFixed(2).replace(".",",")}</td></tr>`
    ).join("");
    try {
      await mailer.sendMail({
        from: `"Comic Geek Store" <${process.env.SMTP_USER}>`,
        to: c.email,
        subject: "Você esqueceu algo no carrinho! 🛒",
        html: `<div style="font-family:Montserrat,sans-serif;max-width:560px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#6a0dad,#8b2fc9);padding:24px 28px;text-align:center">
            <h1 style="font-family:Georgia,serif;font-size:1.5rem;color:#ffd84d;margin:0">🛒 Seu carrinho está esperando!</h1>
          </div>
          <div style="padding:28px">
            <p>Olá, <strong>${c.nome || "herói"}</strong>! Você deixou alguns itens no carrinho:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead><tr style="color:#c97aff"><th style="text-align:left">Produto</th><th>Qtd</th><th>Valor</th></tr></thead>
              <tbody>${itensHtml}</tbody>
            </table>
            <a href="${frontendUrl}/carrinho" style="display:inline-block;background:#ffd84d;color:#000;font-weight:700;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px">Finalizar compra →</a>
          </div>
        </div>`,
      });
      if (dbOk) {
        await db.query(`UPDATE "carrinhosAbandono" SET notificado=true WHERE email=$1`, [c.email]);
      } else {
        c.notificado = true;
      }
    } catch (e) { console.error("[Automação] Erro no lembrete de carrinho:", e.message); }
  }
  if (!dbOk) await salvarDados("carrinhosAbandono", carrinhos);
}

app.post("/api/carrinho/salvar", autenticar, async (req, res) => {
  const { itens } = req.body;
  if (!itens || !itens.length) return res.json({ ok: true });

  if (dbOk) {
    await db.query(
      `INSERT INTO "carrinhosAbandono" (email, nome, itens, "atualizadoEm", notificado)
       VALUES ($1,$2,$3,NOW(),false)
       ON CONFLICT (email) DO UPDATE SET itens=$3, "atualizadoEm"=NOW(), notificado=false`,
      [req.usuario.email, req.usuario.nome, JSON.stringify(itens)]
    );
    return res.json({ ok: true });
  }

  const carrinhos = await lerDados("carrinhosAbandono");
  const idx = carrinhos.findIndex(c => c.email === req.usuario.email);
  const registro = { email: req.usuario.email, nome: req.usuario.nome, itens, atualizadoEm: new Date().toISOString(), notificado: false };
  if (idx >= 0) carrinhos[idx] = registro;
  else carrinhos.push(registro);
  await salvarDados("carrinhosAbandono", carrinhos);
  res.json({ ok: true });
});

app.delete("/api/carrinho/salvar", autenticar, async (req, res) => {
  if (dbOk) {
    await db.query(`DELETE FROM "carrinhosAbandono" WHERE email=$1`, [req.usuario.email]);
    return res.json({ ok: true });
  }
  const carrinhos = await lerDados("carrinhosAbandono");
  await salvarDados("carrinhosAbandono", carrinhos.filter(c => c.email !== req.usuario.email));
  res.json({ ok: true });
});

function agendarAutomacoes() {
  setInterval(async () => {
    await arquivarPedidosAntigos().catch(console.error);
    await cancelarPedidosPendentesAntigos().catch(console.error);
    await expirarCupons().catch(console.error);
    await verificarCarrinhosAbandonados().catch(console.error);
  }, 60 * 60 * 1000).unref();

  setInterval(async () => {
    const agora = new Date();
    if (agora.getDay() === 1 && agora.getHours() === 8 && agora.getMinutes() < 60) {
      if (dbOk) {
        const r = await db.query(`SELECT valor FROM "ultimoRelatorio" WHERE id=1`);
        const hoje = agora.toDateString();
        if (!r.rows[0] || r.rows[0].valor !== hoje) {
          await enviarRelatorioSemanal().catch(console.error);
          await db.query(`INSERT INTO "ultimoRelatorio" (id, valor) VALUES (1,$1) ON CONFLICT (id) DO UPDATE SET valor=$1`, [hoje]);
        }
      } else {
        const ultima = await lerDados("ultimoRelatorio");
        const hoje = agora.toDateString();
        if (ultima !== hoje) {
          await enviarRelatorioSemanal().catch(console.error);
          await salvarDados("ultimoRelatorio", hoje);
        }
      }
    }
  }, 30 * 60 * 1000).unref();

  console.log("[Automação] Agendamentos ativos: arquivo, cancelamento, cupons, carrinho, relatório semanal");
}

agendarAutomacoes();

app.get("/api/admin/pedidos", autenticarAdmin, async (req, res) => {
  await limparPedidosExpirados();
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM pedidos ORDER BY id DESC");
    return res.json(rows);
  }
  res.json(await lerDados("pedidos"));
});

app.get("/api/admin/pedidos/arquivo", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query(`SELECT * FROM "pedidosArquivo" ORDER BY id DESC`);
    return res.json(rows);
  }
  res.json(await lerDados("pedidosArquivo"));
});

app.get("/api/admin/aprovacoes", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query(
      "SELECT id, nome, email, login, tipo, cpf, cnpj, \"razaoSocial\", endereco, status, \"criadoEm\" FROM usuarios WHERE tipo='juridica' AND status='pendente'"
    );
    return res.json(rows);
  }
  const pendentes = (await lerDados("usuarios"))
    .filter((u) => u.tipo === "juridica" && u.status === "pendente")
    .map(({ senha, ...u }) => u);
  res.json(pendentes);
});

app.put("/api/admin/aprovacoes/:email/aprovar", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query(
      `UPDATE usuarios SET status='aprovado', "aprovadoPor"=$1, "aprovadoEm"=NOW() WHERE email=$2 RETURNING id`,
      [req.body.aprovadoPor || req.usuario.login || "admin", req.params.email]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado" });
    return res.json({ mensagem: "Vendedor aprovado" });
  }
  const usuarios = await lerDados("usuarios");
  const idx = usuarios.findIndex((u) => u.email === req.params.email);
  if (idx === -1) return res.status(404).json({ erro: "Usuário não encontrado" });
  usuarios[idx].status = "aprovado";
  usuarios[idx].aprovadoPor = req.body.aprovadoPor || req.usuario.login || "admin";
  usuarios[idx].aprovadoEm = new Date().toISOString();
  await salvarDados("usuarios", usuarios);
  res.json({ mensagem: "Vendedor aprovado" });
});

app.put("/api/admin/aprovacoes/:email/rejeitar", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query(
      `UPDATE usuarios SET status='rejeitado', "rejeitadoPor"=$1, "rejeitadoEm"=NOW() WHERE email=$2 RETURNING id`,
      [req.body.rejeitadoPor || req.usuario.login || "admin", req.params.email]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado" });
    return res.json({ mensagem: "Vendedor rejeitado" });
  }
  const usuarios = await lerDados("usuarios");
  const idx = usuarios.findIndex((u) => u.email === req.params.email);
  if (idx === -1) return res.status(404).json({ erro: "Usuário não encontrado" });
  usuarios[idx].status = "rejeitado";
  usuarios[idx].rejeitadoPor = req.body.rejeitadoPor || req.usuario.login || "admin";
  usuarios[idx].rejeitadoEm = new Date().toISOString();
  await salvarDados("usuarios", usuarios);
  res.json({ mensagem: "Vendedor rejeitado" });
});

// ================================================
// ADMINS CADASTRADOS
// ================================================
app.get("/api/admin/admins", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query("SELECT id, login, nome, \"criadoEm\" FROM admins");
    return res.json(rows);
  }
  const admins = (await lerDados("admins")).map(({ senha, ...a }) => a);
  res.json(admins);
});

app.post("/api/admin/admins", autenticarAdmin, async (req, res) => {
  const { login, nome, senha } = req.body;
  if (!login || !nome || !senha) return res.status(400).json({ erro: "Login, nome e senha são obrigatórios" });
  if (senha.length < 6) return res.status(400).json({ erro: "Senha deve ter no mínimo 6 caracteres" });
  const adminMaster = (process.env.ADMIN_USER || "admin").toLowerCase();
  if (login.toLowerCase() === adminMaster) return res.status(409).json({ erro: "Login reservado" });
  const hash = await bcrypt.hash(senha, 10);
  const id = Date.now();

  if (dbOk) {
    const existe = await db.query("SELECT id FROM admins WHERE login=$1", [login.toLowerCase()]);
    if (existe.rows.length > 0) return res.status(409).json({ erro: "Login já cadastrado" });
    await db.query("INSERT INTO admins (id, login, nome, senha) VALUES ($1,$2,$3,$4)", [id, login.toLowerCase(), nome, hash]);
    return res.json({ mensagem: "Admin cadastrado com sucesso" });
  }

  const admins = await lerDados("admins");
  if (admins.find((a) => a.login.toLowerCase() === login.toLowerCase())) {
    return res.status(409).json({ erro: "Login já cadastrado" });
  }
  admins.push({ id, login: login.toLowerCase(), nome, senha: hash, criadoEm: new Date().toISOString() });
  await salvarDados("admins", admins);
  res.json({ mensagem: "Admin cadastrado com sucesso" });
});

app.delete("/api/admin/admins/:login", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    await db.query("DELETE FROM admins WHERE login=$1", [req.params.login.toLowerCase()]);
    return res.json({ mensagem: "Admin removido" });
  }
  const admins = (await lerDados("admins")).filter((a) => a.login !== req.params.login.toLowerCase());
  await salvarDados("admins", admins);
  res.json({ mensagem: "Admin removido" });
});

// ================================================
// FAVORITOS E LISTA DE DESEJOS
// ================================================
app.get("/api/favoritos", autenticar, async (req, res) => {
  const dados = await rGet(`favoritos:${req.usuario.email}`);
  res.json(dados ? JSON.parse(dados) : []);
});

app.post("/api/favoritos/:nome", autenticar, async (req, res) => {
  const chave = `favoritos:${req.usuario.email}`;
  const dados = await rGet(chave);
  const lista = dados ? JSON.parse(dados) : [];
  if (!lista.includes(req.params.nome)) lista.push(req.params.nome);
  await rSet(chave, JSON.stringify(lista));
  res.json(lista);
});

app.delete("/api/favoritos/:nome", autenticar, async (req, res) => {
  const chave = `favoritos:${req.usuario.email}`;
  const dados = await rGet(chave);
  const lista = (dados ? JSON.parse(dados) : []).filter((n) => n !== req.params.nome);
  await rSet(chave, JSON.stringify(lista));
  res.json(lista);
});

app.get("/api/lista-desejos", autenticar, async (req, res) => {
  const dados = await rGet(`desejos:${req.usuario.email}`);
  res.json(dados ? JSON.parse(dados) : []);
});

app.post("/api/lista-desejos/:nome", autenticar, async (req, res) => {
  const chave = `desejos:${req.usuario.email}`;
  const dados = await rGet(chave);
  const lista = dados ? JSON.parse(dados) : [];
  if (!lista.includes(req.params.nome)) lista.push(req.params.nome);
  await rSet(chave, JSON.stringify(lista));
  res.json(lista);
});

app.delete("/api/lista-desejos/:nome", autenticar, async (req, res) => {
  const chave = `desejos:${req.usuario.email}`;
  const dados = await rGet(chave);
  const lista = (dados ? JSON.parse(dados) : []).filter((n) => n !== req.params.nome);
  await rSet(chave, JSON.stringify(lista));
  res.json(lista);
});

// ================================================
// AVALIAÇÕES DE PRODUTOS
// ================================================
app.get("/api/avaliacoes/:produto", async (req, res) => {
  const chave = `aval:${req.params.produto}`;
  const dados = await rGet(chave);
  res.json(dados ? JSON.parse(dados) : []);
});

app.post("/api/avaliacoes/:produto", autenticar, async (req, res) => {
  const { nota, comentario } = req.body;
  if (!nota || nota < 1 || nota > 5) return res.status(400).json({ erro: "Nota inválida (1-5)" });
  const chave = `aval:${req.params.produto}`;
  const dados = await rGet(chave);
  const lista = dados ? JSON.parse(dados) : [];
  const jaAvaliou = lista.find(a => a.email === req.usuario.email);
  if (jaAvaliou) return res.status(409).json({ erro: "Você já avaliou este produto" });
  lista.push({
    email: req.usuario.email,
    nome: req.usuario.nome || req.usuario.email.split("@")[0],
    nota: parseInt(nota),
    comentario: (comentario || "").slice(0, 300),
    data: new Date().toISOString(),
  });
  await rSet(chave, JSON.stringify(lista));
  res.json(lista);
});

// ================================================
// NOTIFICAÇÃO DE ESTOQUE — "Me avise"
// ================================================
app.post("/api/estoque/avisar", async (req, res) => {
  const email = sanitize(req.body.email, 150);
  const produto = sanitize(req.body.produto, 200);
  if (!email || !produto) return res.status(400).json({ erro: "E-mail e produto obrigatórios" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: "E-mail inválido" });

  if (dbOk) {
    const existe = await db.query(`SELECT id FROM "avisosEstoque" WHERE email=$1 AND produto=$2`, [email, produto]);
    if (existe.rows.length > 0) return res.json({ mensagem: "Você já está na lista de avisos para este produto." });
    await db.query(`INSERT INTO "avisosEstoque" (email, produto) VALUES ($1,$2)`, [email, produto]);
    return res.json({ mensagem: "Perfeito! Você será avisado quando o produto voltar ao estoque." });
  }

  const avisos = await lerDados("avisosEstoque");
  const jaExiste = avisos.find(a => a.email === email && a.produto === produto);
  if (jaExiste) return res.json({ mensagem: "Você já está na lista de avisos para este produto." });
  avisos.push({ email, produto, criadoEm: new Date().toISOString() });
  await salvarDados("avisosEstoque", avisos);
  res.json({ mensagem: "Perfeito! Você será avisado quando o produto voltar ao estoque." });
});

app.get("/api/estoque/avisos", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query(`SELECT * FROM "avisosEstoque"`);
    return res.json(rows);
  }
  res.json(await lerDados("avisosEstoque"));
});

// ================================================
// FALE CONOSCO
// ================================================
app.post("/api/contato", async (req, res) => {
  const { nome, email, assunto, mensagem } = req.body;
  if (!nome || !email || !mensagem) return res.status(400).json({ erro: "Nome, e-mail e mensagem são obrigatórios." });

  if (dbOk) {
    const id = Date.now();
    await db.query(
      "INSERT INTO contatos (id, nome, email, assunto, mensagem) VALUES ($1,$2,$3,$4,$5)",
      [id, nome, email, assunto || "", mensagem]
    );
  } else {
    const contatos = await lerDados("contatos");
    const novo = { id: Date.now(), nome, email, assunto: assunto || "", mensagem, criadoEm: new Date().toISOString(), lido: false };
    contatos.push(novo);
    await salvarDados("contatos", contatos);
  }

  if (mailer) {
    const adminEmail = process.env.SMTP_USER;
    mailer.sendMail({
      from: `"Comic Geek Store" <${adminEmail}>`,
      to: adminEmail,
      subject: `[Contato] ${assunto || "Nova mensagem"} — ${nome}`,
      html: `<p><strong>De:</strong> ${nome} &lt;${email}&gt;</p><p><strong>Assunto:</strong> ${assunto || "—"}</p><p><strong>Mensagem:</strong></p><p>${mensagem.replace(/\n/g, "<br>")}</p>`,
    }).catch(() => {});
  }

  res.json({ mensagem: "Mensagem enviada com sucesso! Retornaremos em breve." });
});

app.get("/api/admin/contatos", autenticarAdmin, async (req, res) => {
  if (dbOk) {
    const { rows } = await db.query("SELECT * FROM contatos ORDER BY id DESC");
    return res.json(rows);
  }
  const contatos = await lerDados("contatos");
  res.json(contatos.sort((a, b) => b.id - a.id));
});

// ================================================
// MARVEL API — proxy seguro
// ================================================
app.get("/api/marvel/buscar", async (req, res) => {
  const { q } = req.query;
  const pub  = process.env.MARVEL_PUBLIC_KEY;
  const priv = process.env.MARVEL_PRIVATE_KEY;
  if (!pub || !priv) return res.status(503).json({ erro: "Marvel API não configurada. Adicione MARVEL_PUBLIC_KEY e MARVEL_PRIVATE_KEY nas variáveis de ambiente." });
  if (!q || q.trim().length < 2) return res.status(400).json({ erro: "Termo de busca obrigatório" });

  const ts   = Date.now().toString();
  const hash = crypto.createHash("md5").update(ts + priv + pub).digest("hex");
  const url  = `https://gateway.marvel.com/v1/public/comics?titleStartsWith=${encodeURIComponent(q.trim())}&limit=10&ts=${ts}&apikey=${pub}&hash=${hash}&orderBy=-onsaleDate`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ erro: "Erro na Marvel API", detalhe: data.message });
    const comics = (data.data?.results || []).map(c => ({
      id:        c.id,
      nome:      c.title,
      descricao: c.description || "",
      img:       c.thumbnail ? `${c.thumbnail.path}.${c.thumbnail.extension}` : "",
      preco:     c.prices?.find(p => p.type === "printPrice")?.price || 0,
      editora:   "marvel",
      secao:     "lancamentos",
    }));
    res.json(comics);
  } catch (e) {
    res.status(502).json({ erro: "Falha ao conectar à Marvel API" });
  }
});

app.get("/api/health", async (req, res) => {
  const redisStatus = redisOk ? await redis.ping().then(() => "conectado").catch(() => "erro") : "desativado";
  res.json({ status: "ok", redis: redisStatus, storage: dbOk ? "postgresql" : redisOk ? "redis" : "arquivo", db: dbOk ? "postgresql" : "N/A" });
});

// Rotas limpas para páginas
const ROTAS_PAGINAS = {
  "/login":          "pages/login.html",
  "/cadastro":       "pages/cadastro.html",
  "/carrinho":       "pages/carrinho.html",
  "/pedidos":        "pages/pedidos.html",
  "/perfil":         "pages/perfil.html",
  "/admin":          "pages/admin.html",
  "/vender":         "pages/vender.html",
  "/produto":        "pages/produto.html",
  "/redefinir-senha":"pages/redefinir-senha.html",
  "/privacidade":    "pages/privacidade.html",
  "/termos":         "pages/termos.html",
  "/marvel":         "pages/marvel.html",
  "/dc":             "pages/dc.html",
  "/lancamentos":    "pages/lancamentos.html",
  "/especiais":      "pages/especiais.html",
  "/prevenda":       "pages/prevenda.html",
  "/404":            "pages/404.html",
  "/favoritos":      "pages/favoritos.html",
  "/contato":        "pages/contato.html",
};
const PUBLIC = path.join(__dirname, "public");
Object.entries(ROTAS_PAGINAS).forEach(([rota, arquivo]) => {
  app.get(rota, (req, res) => res.sendFile(path.join(PUBLIC, arquivo)));
});

app.get("/produto/:slug", (req, res) => {
  res.sendFile(path.join(PUBLIC, "pages", "produto.html"));
});

app.get("*", (req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, "pages", "404.html"));
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Comic Geek Store rodando em http://localhost:${PORT}`));
}

module.exports = app;
