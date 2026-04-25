const request = require("supertest");
const app = require("../server");

const ADMIN_LOGIN = process.env.ADMIN_USER || "admin";
const ADMIN_SENHA = process.env.ADMIN_PASS || "admin@2024";

let tokenAdmin = null;
let produtoCriadoId = null;

async function loginAdmin() {
  const res = await request(app).post("/api/auth/login").send({
    email: ADMIN_LOGIN,
    senha: ADMIN_SENHA,
  });
  return res.body.token || null;
}

beforeAll(async () => {
  tokenAdmin = await loginAdmin();
});

describe("Produtos — Listagem pública", () => {
  test("retorna lista de produtos sem autenticação", async () => {
    const res = await request(app).get("/api/produtos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("retorna produto por ID existente", async () => {
    const lista = await request(app).get("/api/produtos");
    if (!lista.body.length) return; // sem produtos cadastrados, pula
    const id = lista.body[0].id;
    const res = await request(app).get(`/api/produtos/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  test("retorna 404 para produto inexistente", async () => {
    const res = await request(app).get("/api/produtos/999999999");
    expect(res.status).toBe(404);
  });
});

describe("Produtos — CRUD Admin", () => {
  const novoProduto = {
    nome: "HQ Teste Jest",
    preco: 29.9,
    precoOriginal: 39.9,
    editora: "marvel",
    secao: "lancamentos",
    img: "img/quadrinhos/teste.png",
  };

  test("rejeita criação sem token admin", async () => {
    const res = await request(app).post("/api/produtos").send(novoProduto);
    expect(res.status).toBe(401);
  });

  test("cria produto com token admin", async () => {
    if (!tokenAdmin) return console.warn("Token admin não disponível — pulando");
    const res = await request(app)
      .post("/api/produtos")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send(novoProduto);
    expect(res.status).toBe(201);
    expect(res.body.nome).toBe(novoProduto.nome);
    expect(res.body.id).toBeDefined();
    produtoCriadoId = res.body.id;
  });

  test("rejeita criação sem nome", async () => {
    if (!tokenAdmin) return;
    const res = await request(app)
      .post("/api/produtos")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ preco: 20, img: "x.png" });
    expect(res.status).toBe(400);
  });

  test("atualiza produto criado", async () => {
    if (!tokenAdmin || !produtoCriadoId) return;
    const res = await request(app)
      .put(`/api/produtos/${produtoCriadoId}`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ nome: "HQ Teste Jest Atualizada", preco: 25.9 });
    expect(res.status).toBe(200);
    expect(res.body.nome).toBe("HQ Teste Jest Atualizada");
  });

  test("exclui produto criado", async () => {
    if (!tokenAdmin || !produtoCriadoId) return;
    const res = await request(app)
      .delete(`/api/produtos/${produtoCriadoId}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
  });

  test("confirma que produto foi excluído", async () => {
    if (!produtoCriadoId) return;
    const res = await request(app).get(`/api/produtos/${produtoCriadoId}`);
    expect(res.status).toBe(404);
  });
});
