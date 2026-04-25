# Comic Geek Store

Loja virtual de quadrinhos full-stack com pagamento real, painel administrativo, suporte a vendedores PJ e notificações push.

> Projeto iniciado como trabalho acadêmico em 2023 e evoluído para uma aplicação completa, com backend em produção no Railway.

---

## Sumário

- [Sobre](#sobre)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Executar](#como-executar)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Deploy](#deploy)
- [Autores](#autores)

---

## Sobre

A **Comic Geek Store** é uma loja virtual completa para venda de quadrinhos, mangás e colecionáveis. Conta com catálogo de produtos, carrinho de compras, checkout via Mercado Pago, painel administrativo e área exclusiva para vendedores Pessoa Jurídica cadastrarem seus próprios produtos.

**Produção:** [comic-geek-store-production.up.railway.app](https://comic-geek-store-production.up.railway.app)

---

## Funcionalidades

### Loja
- Catálogo com filtro por categoria (Marvel, DC, Lançamentos, Pré-Venda, Especiais)
- Busca por nome de produto
- Modal de detalhes com seletor de quantidade
- Carrinho persistido no localStorage
- Cálculo de frete por CEP (PAC e SEDEX)
- Cupons de desconto

### Pagamento
- Integração com **Mercado Pago** (cartão, Pix, boleto — até 12x)
- Pedidos com expiração automática (link e registro excluídos após 24h sem pagamento)
- Webhook para confirmação de pagamento
- Histórico de pedidos por usuário

### Autenticação e Cadastro
- Cadastro Pessoa Física e Pessoa Jurídica
- Login por e-mail ou nome de usuário
- JWT com expiração de 7 dias (usuários) ou 8 horas (admins)
- Recuperação de senha por e-mail (EmailJS)
- Bloqueio por tentativas excessivas de login

### Painel Admin
- Gerenciamento completo de produtos, pedidos e usuários
- Aprovação/rejeição de vendedores PJ com rastreio de qual admin aprovou
- Cadastro de múltiplas contas administrativas
- Barra de administração ao navegar no site como admin

### Vendedores PJ
- Área exclusiva "Minha Loja" após aprovação
- Cadastro de produtos com imagem, preço, desconto e categoria
- Gerenciamento de envios com nota fiscal (NF-e)

---

## Tecnologias

### Frontend
| Tecnologia | Uso |
|---|---|
| HTML5 semântico | Estrutura das páginas |
| CSS3 modularizado | Estilização por componente |
| JavaScript (ES6+) | Lógica client-side, SPA-like |
| Google Fonts (Bangers, Montserrat) | Tipografia temática |

### Backend
| Tecnologia | Uso |
|---|---|
| Node.js + Express | API REST |
| Redis | Persistência de dados em produção |
| JSON (fallback) | Persistência local em desenvolvimento |
| JWT (jsonwebtoken) | Autenticação stateless |
| bcryptjs | Hash de senhas |
| Mercado Pago SDK | Processamento de pagamentos |
| EmailJS | Envio de e-mails sem SMTP |

### Infraestrutura
| Serviço | Uso |
|---|---|
| Railway | Hospedagem do backend e Redis |
| GitHub | Versionamento e CI/CD |
| Microsoft Clarity | Heatmaps e gravação de sessão |
| Google Analytics GA4 | Métricas de acesso |
| OneSignal | Notificações push |
| Tidio | Chat ao vivo |

---

## Estrutura do Projeto

```
comic-geek-store/
├── css/
│   ├── global.css          # Reset, header, footer, variáveis
│   ├── home.css            # Banner, cards de produto, modal
│   ├── admin.css           # Painel administrativo
│   ├── cadastro.css        # Formulário de cadastro
│   ├── carrinho.css        # Página do carrinho
│   ├── login.css           # Página de login
│   ├── pedidos.css         # Histórico de pedidos
│   ├── perfil.css          # Página de perfil
│   ├── vender.css          # Área do vendedor PJ
│   └── animations.css      # Animações globais
├── img/
│   ├── icons/              # Ícones da interface
│   ├── logos/              # Logo e banners
│   └── quadrinhos/         # Capas dos produtos
├── js/
│   ├── config.js           # Chaves de API e configuração
│   ├── apis.js             # Helpers de integração
│   └── main.js             # Lógica principal (frontend)
├── pages/
│   ├── admin.html          # Painel administrativo
│   ├── cadastro.html       # Criação de conta
│   ├── carrinho.html       # Carrinho de compras
│   ├── dc.html             # Categoria DC
│   ├── especiais.html      # Edições especiais
│   ├── lancamentos.html    # Lançamentos
│   ├── login.html          # Login
│   ├── marvel.html         # Categoria Marvel
│   ├── pedidos.html        # Histórico de pedidos
│   ├── perfil.html         # Perfil do usuário
│   ├── prevenda.html       # Pré-venda
│   ├── privacidade.html    # Política de privacidade
│   ├── redefinir-senha.html# Redefinição de senha
│   ├── termos.html         # Termos de uso
│   └── vender.html         # Área do vendedor PJ
├── data/                   # Dados JSON (fallback local)
├── server.js               # API REST (Express)
├── package.json
├── docker-compose.yml      # Redis local para desenvolvimento
└── .env                    # Variáveis de ambiente (não versionado)
```

---

## Como Executar

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [Redis](https://redis.io/) (ou Docker para subir localmente)
- Conta no [Mercado Pago](https://mercadopago.com.br) (para pagamentos)

### 1. Clone o repositório

```bash
git clone https://github.com/viniciusrigobelo/comic-geek-store.git
cd comic-geek-store
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (veja a seção [Variáveis de Ambiente](#variáveis-de-ambiente)).

### 4. Suba o Redis localmente (opcional, via Docker)

```bash
docker-compose up -d
```

> Sem Redis configurado, o servidor usa arquivos JSON na pasta `data/` como fallback.

### 5. Inicie o servidor

```bash
# Produção
npm start

# Desenvolvimento (hot reload)
npm run dev
```

### 6. Acesse o frontend

Abra o arquivo `index.html` no navegador ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

> O frontend consome a API definida em `js/config.js` → `backendUrl`.

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz com as seguintes variáveis:

```env
# Servidor
PORT=3000
JWT_SECRET=sua_chave_secreta_aqui
FRONTEND_URL=http://localhost:3000

# Admin master
ADMIN_USER=admin
ADMIN_PASS=sua_senha_admin

# Redis (opcional — usa JSON local como fallback)
REDIS_URL=redis://localhost:6379

# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxx

# Expiração de pedidos pendentes (padrão: 24h)
PEDIDO_EXPIRACAO_HORAS=24

# EmailJS (envio de e-mails)
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx
EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxx
```

---

## Deploy

O projeto está configurado para deploy no **Railway** com Redis integrado.

### Passos para deploy

1. Faça fork ou push do repositório para o GitHub
2. Crie um novo projeto no [Railway](https://railway.app)
3. Conecte ao repositório GitHub
4. Adicione um serviço **Redis** ao projeto Railway
5. Configure as variáveis de ambiente no painel do Railway
6. O deploy acontece automaticamente a cada push na branch `main`

### Variáveis obrigatórias no Railway

```
JWT_SECRET
ADMIN_USER
ADMIN_PASS
MP_ACCESS_TOKEN
REDIS_URL          ← gerado automaticamente pelo serviço Redis do Railway
FRONTEND_URL       ← URL pública do seu serviço (ex: https://seu-app.up.railway.app)
```

---

## Autores

Desenvolvido por:

| Nome | GitHub |
|---|---|
| Alexsander Neneve | [@alekxnv](https://github.com/alekxnv) |
| Vinicius Rigobelo de Oliveira | [@viniciusrigobelo](https://github.com/viniciusrigobelo) |

---

<p align="center">
  Feito com dedicação para a <strong>Comic Geek Store</strong>
</p>
