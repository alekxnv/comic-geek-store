const request = require("supertest");
const app = require("../server");

const timestamp = Date.now();
const EMAIL_USUARIO = `pedido_${timestamp}@geek.com`;
const SENHA_USUARIO = "Senha@123";
const ADMIN_LOGIN = process.env.ADMIN_USER || "admin";
const ADMIN_SENHA = process.env.ADMIN_PASS || "admin@2024";

let tokenUsuario = null;
let tokenAdmin = null;
const CODIGO_CUPOM_TESTE = `JEST${timestamp.toString().slice(-4)}`;

beforeAll(async () => {
  // Cadastra usuário de teste
  const cadastro = await request(app).post("/api/auth/cadastro").send({
    nome: "Usuário Pedido Teste",
    email: EMAIL_USUARIO,
    senha: SENHA_USUARIO,
    tipo: "fisica",
  });
  tokenUsuario = cadastro.body.token;

  // Login admin
  const adminLogin = await request(app).post("/api/auth/login").send({
    email: ADMIN_LOGIN,
    senha: ADMIN_SENHA,
  });
  tokenAdmin = adminLogin.body.token;
});

// ─── CUPONS ───────────────────────────────────────────────

describe("Cupons", () => {
  test("cria cupom como admin", async () => {
    if (!tokenAdmin) return;
    const res = await request(app)
      .post("/api/admin/cupons")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ codigo: CODIGO_CUPOM_TESTE, desconto: 15 });
    expect(res.status).toBe(200);
    expect(res.body.codigo).toBe(CODIGO_CUPOM_TESTE);
  });

  test("rejeita criação de cupom duplicado", async () => {
    if (!tokenAdmin) return;
    const res = await request(app)
      .post("/api/admin/cupons")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ codigo: CODIGO_CUPOM_TESTE, desconto: 10 });
    expect(res.status).toBe(400);
  });

  test("busca cupom válido", async () => {
    const res = await request(app).get(`/api/cupons/${CODIGO_CUPOM_TESTE}`);
    expect(res.status).toBe(200);
    expect(res.body.desconto).toBe(15);
  });

  test("retorna 404 para cupom inexistente", async () => {
    const res = await request(app).get("/api/cupons/CUPOMINVALIDO999");
    expect(res.status).toBe(404);
  });

  test("lista cupons como admin", async () => {
    if (!tokenAdmin) return;
    const res = await request(app)
      .get("/api/admin/cupons")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("rejeita listagem de cupons sem autenticação admin", async () => {
    const res = await request(app).get("/api/admin/cupons");
    expect(res.status).toBe(401);
  });

  test("exclui cupom criado", async () => {
    if (!tokenAdmin) return;
    const res = await request(app)
      .delete(`/api/admin/cupons/${CODIGO_CUPOM_TESTE}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
  });
});

// ─── PEDIDOS ──────────────────────────────────────────────

describe("Pedidos — Criação", () => {
  const itensTeste = [
    { nome: "Batman: Ano Um", preco: 35.9, img: "img/batman.png", qtd: 1 },
  ];

  test("rejeita pedido sem autenticação", async () => {
    const res = await request(app).post("/api/pedidos").send({ itens: itensTeste });
    expect(res.status).toBe(401);
  });

  test("rejeita pedido com carrinho vazio", async () => {
    if (!tokenUsuario) return;
    const res = await request(app)
      .post("/api/pedidos")
      .set("Authorization", `Bearer ${tokenUsuario}`)
      .send({ itens: [] });
    expect(res.status).toBe(400);
  });

  test("cria pedido com itens válidos", async () => {
    if (!tokenUsuario) return;
    const res = await request(app)
      .post("/api/pedidos")
      .set("Authorization", `Bearer ${tokenUsuario}`)
      .send({ itens: itensTeste, pagamento: "pix", frete: 0 });
    expect(res.status).toBe(201);
    expect(res.body.numero).toMatch(/^CGS-/);
    expect(res.body.total).toBe(35.9);
    expect(res.body.status).toBe("pendente");
  });

  test("calcula total corretamente com múltiplos itens e quantidade", async () => {
    if (!tokenUsuario) return;
    const res = await request(app)
      .post("/api/pedidos")
      .set("Authorization", `Bearer ${tokenUsuario}`)
      .send({
        itens: [
          { nome: "X-Men", preco: 20, img: "img/x.png", qtd: 2 },
          { nome: "Spider-Man", preco: 30, img: "img/s.png", qtd: 1 },
        ],
        pagamento: "pix",
        frete: 10,
      });
    expect(res.status).toBe(201);
    // 20*2 + 30*1 + 10 frete = 80
    expect(res.body.total).toBe(80);
  });
});

describe("Pedidos — Listagem", () => {
  test("lista pedidos do usuário autenticado", async () => {
    if (!tokenUsuario) return;
    const res = await request(app)
      .get("/api/pedidos")
      .set("Authorization", `Bearer ${tokenUsuario}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("lista todos os pedidos como admin", async () => {
    if (!tokenAdmin) return;
    const res = await request(app)
      .get("/api/admin/pedidos")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("rejeita listagem admin sem autenticação", async () => {
    const res = await request(app).get("/api/admin/pedidos");
    expect(res.status).toBe(401);
  });
});
