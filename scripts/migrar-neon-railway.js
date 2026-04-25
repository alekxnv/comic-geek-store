const { Pool } = require("pg");

const neon = new Pool({
  connectionString: "postgresql://neondb_owner:npg_el05BXbqtALK@ep-little-truth-acad62q4-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

const railway = new Pool({
  connectionString: "postgresql://postgres:IjfDwnaAwonPSkzUdxrIQRSSefuiBTcI@shortline.proxy.rlwy.net:51746/railway",
  ssl: { rejectUnauthorized: false },
});

const TABELAS = ["usuarios","produtos","produtosVendedores","pedidos","pedidosArquivo","cupons","avisosEstoque","carrinhosAbandono","tokensReset","contatos","admins"];

async function migrar() {
  console.log("Migrando Neon → Railway\n");
  for (const t of TABELAS) {
    const r = await neon.query(`SELECT * FROM "${t}"`).catch(() => ({ rows: [] }));
    if (r.rows.length === 0) { console.log(`${t}: vazio`); continue; }
    let ok = 0;
    for (const row of r.rows) {
      const cols = Object.keys(row).map(c => `"${c}"`).join(",");
      const vals = Object.values(row);
      const phs  = vals.map((_, i) => `$${i + 1}`).join(",");
      await railway.query(`INSERT INTO "${t}" (${cols}) VALUES (${phs}) ON CONFLICT DO NOTHING`, vals)
        .catch(e => console.warn(`  skip (${t}):`, e.message));
      ok++;
    }
    console.log(`✓ ${t}: ${ok} registro(s)`);
  }
  await neon.end();
  await railway.end();
  console.log("\nMigração concluída!");
}

migrar().catch(e => { console.error("Erro:", e.message); process.exit(1); });
