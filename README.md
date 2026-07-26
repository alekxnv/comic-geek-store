# Comic Geek Store

Loja virtual de quadrinhos full-stack com checkout real, painel administrativo, área para vendedores PJ e experiências de compra modernas.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Projeto desenvolvido para oferecer uma experiência completa de e-commerce com integração de pagamentos, gestão de pedidos e administração de catálogo.

**Produção:** [comic-geek-store.onrender.com](https://comic-geek-store.onrender.com)

---

## Sumário

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Executar](#como-executar)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Deploy](#deploy)
- [Licença](#licença)
- [Autores](#autores)

---

## Visão Geral

A **Comic Geek Store** é uma aplicação completa para venda de quadrinhos, mangás e colecionáveis, com foco em usabilidade, segurança e operação real. O projeto reúne frontend, backend, integração com pagamentos e recursos administrativos em uma plataforma única.

---

## Funcionalidades

### Para clientes
- Catálogo com filtros por categoria: Marvel, DC, Lançamentos, Pré-Venda e Especiais
- Busca por nome de produto
- Modal de detalhes com seleção de quantidade
- Carrinho persistido e cálculo de frete por CEP
- Cupons de desconto e fluxo de checkout integrado
- Histórico de pedidos e visualização de status

### Para administradores
- Gestão completa de produtos, pedidos e usuários
- Aprovação e acompanhamento de vendedores Pessoa Jurídica
- Cadastro de múltiplas contas administrativas
- Painel administrativo integrado ao fluxo do site

### Para vendedores PJ
- Área exclusiva para cadastro e gerenciamento de produtos
- Upload de imagem, preço, desconto e categoria
- Organização de envios e acompanhamento de vendas

---

## Tecnologias

### Frontend
| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura das páginas |
| CSS3 | Estilização modular e responsiva |
| JavaScript (ES6+) | Lógica de interface e interações |
| Google Fonts | Tipografia temática |

### Backend
| Tecnologia | Uso |
|---|---|
| Node.js + Express | API REST e serviços do sistema |
| PostgreSQL | Persistência em produção |
| Redis | Cache e persistência auxiliar |
| JWT | Autenticação segura |
| bcryptjs | Hash de senhas |
| Mercado Pago SDK | Processamento de pagamentos |
| EmailJS | Envio de e-mails |

### Infraestrutura
| Serviço | Uso |
|---|---|
| Render | Hospedagem do backend |
| Neon | Banco de dados PostgreSQL |
| Upstash | Redis gerenciado |
| GitHub | Versionamento e deploy contínuo |
| Clarity / GA4 | Métricas e análise de uso |
| OneSignal / Tidio | Notificações e atendimento |

---

## Estrutura do Projeto

```text
comic-geek-store/
├── css/                 # Estilos do frontend
├── img/                 # Imagens, ícones e capas
├── js/                  # Configuração e lógica do frontend
├── db/                  # Conexão e schema do banco de dados
├── pages/               # Páginas HTML do site
├── data/                # Dados JSON usados como fallback local
├── server.js            # API REST e regras de negócio
├── package.json         # Dependências e scripts
├── docker-compose.yml   # Redis local para desenvolvimento
└── .env                 # Variáveis de ambiente (não versionado)
```

---

## Como Executar

### Pré-requisitos
- Node.js 18+
- Redis (ou Docker para subir localmente)
- PostgreSQL (ou conta gratuita no Neon)
- Conta no Mercado Pago para pagamentos reais

### Passos
1. Clone o repositório:
   ```bash
   git clone https://github.com/alekxnv/comic-geek-store.git
   cd comic-geek-store
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente criando um arquivo `.env` na raiz. Consulte [“.env.example”](.env.example) e a seção abaixo.
4. Inicie o Redis localmente, se necessário:
   ```bash
   docker-compose up -d
   ```
5. Rode a aplicação:
   ```bash
   # Produção
   npm start

   # Desenvolvimento
   npm run dev
   ```
6. Acesse o frontend abrindo o arquivo `index.html` no navegador ou servindo a pasta com um servidor estático:
   ```bash
   npx serve .
   ```

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as variáveis abaixo:

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=sua_chave_secreta_aqui
FRONTEND_URL=http://localhost:3000
ADMIN_USER=admin
ADMIN_PASS=sua_senha_admin
DATABASE_URL=postgresql://usuario:senha@host/dbname?sslmode=require
REDIS_URL=redis://localhost:6379
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxx
PEDIDO_EXPIRACAO_HORAS=24
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx
EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxx
```

> `NODE_ENV=production` é obrigatório em produção para evitar falhas na conexão com o PostgreSQL.

---

## Deploy

O projeto está preparado para deploy no Render, com PostgreSQL no Neon e Redis no Upstash.

### Passos principais
1. Crie um banco PostgreSQL no Neon e aplique o schema de [db/schema.sql](db/schema.sql)
2. Crie um banco Redis no Upstash
3. Configure as variáveis de ambiente no painel do Render
4. Conecte o repositório GitHub ao serviço Web e faça o deploy

### Variáveis obrigatórias no Render
```text
JWT_SECRET
ADMIN_USER
ADMIN_PASS
MP_ACCESS_TOKEN
NODE_ENV=production
DATABASE_URL
REDIS_URL
FRONTEND_URL
BACKEND_URL
```

---

## Licença

Este projeto está licenciado sob a MIT License. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

Copyright © 2026 Alexsander Neneve e Vinicius Rigobelo de Oliveira.

---

## Autores

Desenvolvido por:

| Nome | GitHub | LinkedIn |
|---|---|---|
| Alexsander Neneve | [@alekxnv](https://github.com/alekxnv) | [linkedin.com/in/alexsanderneneve](https://linkedin.com/in/alexsanderneneve) |
| Vinicius Rigobelo de Oliveira | [@viniciusrigobelo](https://github.com/viniciusrigobelo) | [linkedin.com/in/vinicius-rigobelo-308601383](https://www.linkedin.com/in/vinicius-rigobelo-308601383) |

---

<p align="center">
  Feito com dedicação para a <strong>Comic Geek Store</strong>
</p>
