require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrar() {
  console.log("Iniciando migração de dados JSON → PostgreSQL\n");

  // Remove usuário de teste criado durante testes
  await pool.query("DELETE FROM usuarios WHERE email = 'teste@teste.com'");
  console.log("✓ Usuário de teste removido");

  const dataDir = path.join(__dirname, "../data");
  const arquivos = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];

  for (const arquivo of arquivos) {
    if (!arquivo.endsWith(".json")) continue;
    const nome = arquivo.replace(".json", "");
    const rawContent = fs.readFileSync(path.join(dataDir, arquivo), "utf8").trim();

    // Corrige JSON corrompido (lixo no final)
    const clean = rawContent.replace(/\][\s\S]*$/, "]").replace(/^[\s\S]*?\[/, "[");
    let dados;
    try {
      dados = JSON.parse(clean);
    } catch {
      console.warn(`⚠ Erro ao parsear ${arquivo}, pulando.`);
      continue;
    }
    if (!Array.isArray(dados) || dados.length === 0) continue;

    console.log(`\n→ ${arquivo} (${dados.length} registros)`);

    if (nome === "usuarios") {
      for (const u of dados) {
        await pool.query(
          `INSERT INTO usuarios (id, nome, email, login, senha, tipo, cpf, cnpj, "razaoSocial", endereco, "termosAceitos", status, "criadoEm")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, senha=EXCLUDED.senha`,
          [u.id, u.nome, u.email, u.login, u.senha, u.tipo || "fisica", u.cpf, u.cnpj,
           u.razaoSocial, u.endereco ? JSON.stringify(u.endereco) : null,
           u.termosAceitos || false, u.status || "aprovado", u.criadoEm]
        );
        console.log(`  ✓ ${u.nome} (${u.email})`);
      }
    } else if (nome === "produtos") {
      for (const p of dados) {
        await pool.query(
          `INSERT INTO produtos (id, nome, preco, "precoOriginal", img, editora, secao, estoque, esgotado, "dataLancamento", "criadoEm")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.nome, p.preco, p.precoOriginal, p.img, p.editora, p.secao,
           p.estoque, p.esgotado || false, p.dataLancamento || null, p.criadoEm]
        );
        console.log(`  ✓ ${p.nome}`);
      }
    } else if (nome === "pedidos") {
      for (const p of dados) {
        await pool.query(
          `INSERT INTO pedidos (id, "usuarioEmail", "usuarioNome", itens, total, frete, cupom, desconto, status, endereco, arquivado, "criadoEm")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.usuarioEmail, p.usuarioNome, JSON.stringify(p.itens || []),
           p.total, p.frete || 0, p.cupom, p.desconto || 0, p.status || "pendente",
           p.endereco ? JSON.stringify(p.endereco) : null, false, p.criadoEm]
        );
        console.log(`  ✓ Pedido ${p.id}`);
      }
    } else if (nome === "cupons") {
      for (const c of dados) {
        await pool.query(
          `INSERT INTO cupons (codigo, desconto, tipo, ativo, usos, limite, "criadoEm")
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (codigo) DO NOTHING`,
          [c.codigo, c.desconto, c.tipo || "percentual", c.ativo !== false, c.usos || 0, c.limite || null, c.criadoEm]
        );
        console.log(`  ✓ Cupom ${c.codigo}`);
      }
    } else {
      console.log(`  (tabela '${nome}' sem migração específica — pulando)`);
    }
  }

  const r = await pool.query("SELECT COUNT(*) FROM usuarios");
  console.log(`\n✅ Migração concluída — ${r.rows[0].count} usuário(s) no banco`);
  pool.end();
}

migrar().catch(e => { console.error("Erro:", e.message); pool.end(); });
