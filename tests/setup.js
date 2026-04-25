const path = require("path");
const fs = require("fs");
const os = require("os");

// Usa diretório temporário para dados de teste — não toca nos dados reais
const testDataDir = path.join(os.tmpdir(), `cgs_test_${Date.now()}`);
fs.mkdirSync(testDataDir, { recursive: true });

// Desativa Redis e usa arquivos JSON temporários
process.env.REDIS_URL = "";
process.env.DATA_DIR = testDataDir;
process.env.JWT_SECRET = "test_secret_jest";
process.env.ADMIN_USER = "admin_teste";
process.env.ADMIN_PASS = "Admin@123";
// Evita que o servidor tente conectar SMTP em testes
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";

// Arquivos vazios para começar do zero
["usuarios", "produtos", "pedidos", "pedidosArquivo", "cupons", "avisosEstoque", "carrinhosAbandono", "tokensReset", "contatos"].forEach(k => {
  fs.writeFileSync(path.join(testDataDir, `${k}.json`), "[]");
});

// testDataDir será limpo pelo SO ou pelo globalTeardown
global.__TEST_DATA_DIR__ = testDataDir;
