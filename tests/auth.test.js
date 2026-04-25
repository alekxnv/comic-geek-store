const request = require("supertest");
const app = require("../server");

// Dados únicos por execução para não conflitar com dados reais
const timestamp = Date.now();
const EMAIL_TESTE = `teste_${timestamp}@geek.com`;
const SENHA_TESTE = "Senha@123";
const NOME_TESTE = "Usuário Teste";

let tokenUsuario = null;

describe("Auth — Cadastro", () => {
  test("cadastra novo usuário com sucesso", async () => {
    const res = await request(app).post("/api/auth/cadastro").send({
      nome: NOME_TESTE,
      email: EMAIL_TESTE,
      senha: SENHA_TESTE,
      tipo: "fisica",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.email).toBe(EMAIL_TESTE);
  });

  test("rejeita cadastro com e-mail duplicado", async () => {
    const res = await request(app).post("/api/auth/cadastro").send({
      nome: NOME_TESTE,
      email: EMAIL_TESTE,
      senha: SENHA_TESTE,
      tipo: "fisica",
    });
    expect([400, 409]).toContain(res.status);
    expect(res.body.erro).toBeDefined();
  });

  test("rejeita cadastro sem e-mail", async () => {
    const res = await request(app).post("/api/auth/cadastro").send({
      nome: NOME_TESTE,
      senha: SENHA_TESTE,
    });
    expect(res.status).toBe(400);
  });
});

describe("Auth — Login", () => {
  test("faz login com credenciais corretas", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: EMAIL_TESTE,
      senha: SENHA_TESTE,
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    tokenUsuario = res.body.token;
  });

  test("rejeita login com senha errada", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: EMAIL_TESTE,
      senha: "SenhaErrada999",
    });
    expect(res.status).toBe(401);
  });

  test("rejeita login com e-mail inexistente", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "naoexiste@geek.com",
      senha: SENHA_TESTE,
    });
    expect(res.status).toBe(401);
  });
});

describe("Auth — Perfil", () => {
  test("retorna perfil com token válido", async () => {
    const res = await request(app)
      .get("/api/usuarios/perfil")
      .set("Authorization", `Bearer ${tokenUsuario}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(EMAIL_TESTE);
  });

  test("rejeita perfil sem token", async () => {
    const res = await request(app).get("/api/usuarios/perfil");
    expect(res.status).toBe(401);
  });

  test("rejeita perfil com token inválido", async () => {
    const res = await request(app)
      .get("/api/usuarios/perfil")
      .set("Authorization", "Bearer token_invalido");
    expect(res.status).toBe(401);
  });
});
