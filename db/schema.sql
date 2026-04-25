-- Comic Geek Store — PostgreSQL Schema
-- Usa nomes de coluna camelCase entre aspas para compatibilidade com o código JS existente

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  login TEXT UNIQUE,
  senha TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'usuario',
  cpf TEXT,
  cnpj TEXT,
  "razaoSocial" TEXT,
  endereco JSONB,
  "termosAceitos" BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'aprovado',
  "aprovadoPor" TEXT,
  "aprovadoEm" TIMESTAMPTZ,
  "rejeitadoPor" TEXT,
  "rejeitadoEm" TIMESTAMPTZ,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produtos (
  id BIGINT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco NUMERIC(10,2),
  "precoOriginal" NUMERIC(10,2),
  img TEXT,
  editora TEXT,
  secao TEXT,
  estoque INTEGER,
  esgotado BOOLEAN DEFAULT FALSE,
  "dataLancamento" DATE,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "produtosVendedores" (
  id BIGINT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco NUMERIC(10,2),
  "precoOriginal" NUMERIC(10,2),
  descricao TEXT,
  img TEXT,
  categoria TEXT,
  "vendedorEmail" TEXT NOT NULL,
  "vendedorNome" TEXT,
  status TEXT DEFAULT 'pendente',
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos (
  id BIGINT PRIMARY KEY,
  numero TEXT,
  data TEXT,
  "dataISO" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  email TEXT NOT NULL,
  nome TEXT,
  itens JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2),
  pagamento TEXT,
  frete NUMERIC(10,2) DEFAULT 0,
  cupom TEXT,
  desconto NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  endereco JSONB,
  arquivado BOOLEAN DEFAULT FALSE,
  "pagamentoId" TEXT,
  "metodoPagamento" TEXT,
  "canceladoEm" TIMESTAMPTZ,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "pedidosArquivo" (
  id BIGINT PRIMARY KEY,
  numero TEXT,
  data TEXT,
  "dataISO" TIMESTAMPTZ,
  email TEXT,
  nome TEXT,
  itens JSONB DEFAULT '[]',
  total NUMERIC(10,2),
  pagamento TEXT,
  frete NUMERIC(10,2) DEFAULT 0,
  status TEXT,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cupons (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  desconto NUMERIC(10,2) NOT NULL,
  tipo TEXT DEFAULT 'percentual',
  ativo BOOLEAN DEFAULT TRUE,
  usos INTEGER DEFAULT 0,
  limite INTEGER,
  "validoAte" TIMESTAMPTZ,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "avisosEstoque" (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  produto TEXT NOT NULL,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "carrinhosAbandono" (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nome TEXT,
  itens JSONB DEFAULT '[]',
  "atualizadoEm" TIMESTAMPTZ DEFAULT NOW(),
  notificado BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS "tokensReset" (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expiry BIGINT NOT NULL,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contatos (
  id BIGINT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  assunto TEXT,
  mensagem TEXT NOT NULL,
  lido BOOLEAN DEFAULT FALSE,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT PRIMARY KEY,
  login TEXT UNIQUE NOT NULL,
  nome TEXT,
  senha TEXT NOT NULL,
  "criadoEm" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ultimoRelatorio" (
  id INTEGER PRIMARY KEY DEFAULT 1,
  valor TEXT
);
