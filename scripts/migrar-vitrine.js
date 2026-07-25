require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Produtos que antes ficavam fixos no HTML da vitrine (index.html e páginas de categoria).
// Este script os insere no banco para que passem a ser gerenciados pelo painel admin,
// como qualquer outro produto.
const PRODUTOS_VITRINE = [
  { nome: "All-Out Avengers (2022) #6", preco: 24.9, precoOriginal: 29.9, img: "img/quadrinhos/alloutavengers.jpg", editora: "marvel", secao: "lancamentos", estoque: null },
  { nome: "The Amazing Spider-Man (2022) #20", preco: 32.5, precoOriginal: null, img: "img/quadrinhos/spiderman.jpg", editora: "marvel", secao: "lancamentos", estoque: null },
  { nome: "Crise Sombria #1", preco: 19.9, precoOriginal: 24.9, img: "img/quadrinhos/crisesombria.jpg", editora: "dc", secao: "lancamentos", estoque: null },
  { nome: "Reino do Amanhã - Edição Definitiva", preco: 26.9, precoOriginal: 32.9, img: "img/quadrinhos/reinodoamanha.jpg", editora: "dc", secao: "lancamentos", estoque: null },
  { nome: "O Coringa (2022) Vol.3", preco: 29.9, precoOriginal: null, img: "img/quadrinhos/coringa.jpg", editora: "dc", secao: "lancamentos", estoque: null },
  { nome: "Carnificina (2022) #10", preco: 17.9, precoOriginal: null, img: "img/quadrinhos/carnage.jpg", editora: "marvel", secao: "lancamentos", estoque: 0 },
  { nome: "DC Versus Marvel #1", preco: 26.9, precoOriginal: 34.9, img: "img/quadrinhos/conflitodoseculo.jpg", editora: "marvel", secao: "lancamentos", estoque: null },
  { nome: "Venom: Lethal Protector (1993)", preco: 19.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/A1tv9QyWHmL._UF1000,1000_QL80_.jpg", editora: "marvel", secao: "lancamentos", estoque: null },
  { nome: "A Morte do Superman Vol. 1", preco: 23.9, precoOriginal: 29.9, img: "img/quadrinhos/superman.jpg", editora: "dc", secao: "lancamentos", estoque: null },
  { nome: "Vingadores - Desafio Infinito", preco: 19.9, precoOriginal: 29.9, img: "img/quadrinhos/desafioinfinito.jpg", editora: "marvel", secao: "marvel", estoque: null },
  { nome: "Guardiões da Galáxia - A Queda", preco: 24.9, precoOriginal: 32.9, img: "img/quadrinhos/guarioesdagalaxia.webp", editora: "marvel", secao: "marvel", estoque: null },
  { nome: "Guerra Civil", preco: 21.9, precoOriginal: 28.9, img: "img/quadrinhos/guerracivil.jpg", editora: "marvel", secao: "marvel", estoque: 0 },
  { nome: "Wolverine: Weapon X", preco: 27.9, precoOriginal: 33.9, img: "https://m.media-amazon.com/images/I/91APhUWdS-L._UF1000,1000_QL80_.jpg", editora: "marvel", secao: "marvel", estoque: null },
  { nome: "Guerras Secretas", preco: 29.9, precoOriginal: null, img: "img/quadrinhos/guerrassecretas.jpg", editora: "marvel", secao: "marvel", estoque: null },
  { nome: "Deadpool - Eixo", preco: 24.9, precoOriginal: null, img: "img/quadrinhos/deadpooleixo.jpg", editora: "marvel", secao: "marvel", estoque: null },
  { nome: "Spider-Man: Miles Morales Vol. 1", preco: 22.9, precoOriginal: 29.9, img: "https://m.media-amazon.com/images/I/91AfYuOgueL.jpg", editora: "marvel", secao: "marvel", estoque: null },
  { nome: "Capitão America - O Soldado Invernal", preco: 25.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/611wcUISMmL._AC_UF1000,1000_QL80_.jpg", editora: "marvel", secao: "marvel", estoque: null },
  { nome: "Iron Man: Extremis", preco: 21.9, precoOriginal: 27.9, img: "https://m.media-amazon.com/images/I/615Dgl+QelL._UF1000,1000_QL80_.jpg", editora: "marvel", secao: "marvel", estoque: null },
  { nome: "Batman - A Piada Mortal", preco: 29.9, precoOriginal: 39.9, img: "img/quadrinhos/batmanapiadamortal.webp", editora: "dc", secao: "dc", estoque: null },
  { nome: "Lanterna Verde - A Guerra Dos Anéis", preco: 19.9, precoOriginal: 27.9, img: "img/quadrinhos/lanternaverde.jpg", editora: "dc", secao: "dc", estoque: null },
  { nome: "Flashpoint (Ponto de Ignição)", preco: 24.9, precoOriginal: null, img: "img/quadrinhos/flash.png", editora: "dc", secao: "dc", estoque: null },
  { nome: "A Morte do Superman - Vol.1", preco: 29.9, precoOriginal: 34.9, img: "img/quadrinhos/superman.jpg", editora: "dc", secao: "dc", estoque: null },
  { nome: "Supergirl #1 (1994)", preco: 25.9, precoOriginal: 31.9, img: "https://m.media-amazon.com/images/I/61gobk-LuVL._UF1000,1000_QL80_.jpg", editora: "dc", secao: "dc", estoque: null },
  { nome: "Crise nas Infinitas Terras", preco: 25.9, precoOriginal: null, img: "img/quadrinhos/crisesinfinitas.jpg", editora: "dc", secao: "dc", estoque: null },
  { nome: "Batman: Cavaleiro das Trevas", preco: 28.9, precoOriginal: 36.9, img: "img/quadrinhos/batman.png", editora: "dc", secao: "dc", estoque: null },
  { nome: "Mulher-Maravilha Vol. 17 / 67", preco: 22.9, precoOriginal: null, img: "https://d14d9vp3wdof84.cloudfront.net/image/589816272436/image_jv12lnck3l0od2j8092rql341d/-S897-f.webp", editora: "dc", secao: "dc", estoque: null },
  { nome: "Nightwing: Rebirth #1 (2016)", preco: 20.9, precoOriginal: 26.9, img: "https://m.media-amazon.com/images/I/91S5teyH4kL._UF1000,1000_QL80_.jpg", editora: "dc", secao: "dc", estoque: null },
  { nome: "Os Vingadores 23 / 80", preco: 39.9, precoOriginal: null, img: "https://d14d9vp3wdof84.cloudfront.net/image/589816272436/image_rkr8bj122l7u12ucdk1aq0t84h/-S897-f.webp", editora: "marvel", secao: "prevenda", estoque: null },
  { nome: "Batman: A Corte das Corujas - Vol. 1", preco: 34.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/91mH07aKF8L._AC_UF1000,1000_QL80_.jpg", editora: "dc", secao: "prevenda", estoque: null },
  { nome: "X-men: A Saga da Fênix Negra - Vol. 1", preco: 36.9, precoOriginal: 46.9, img: "https://m.media-amazon.com/images/I/81EVT6w2IUL._AC_UF1000,1000_QL80_.jpg", editora: "marvel", secao: "prevenda", estoque: null },
  { nome: "Spider-Man: A Saga do Clone - Vol. 2", preco: 38.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/71jcUmzUpsL._AC_UF1000,1000_QL80_.jpg", editora: "marvel", secao: "prevenda", estoque: null },
  { nome: "Liga da Justiça: Guerra de Darkseid", preco: 33.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/91t1zOx7YhL.jpg", editora: "dc", secao: "prevenda", estoque: null },
  { nome: "Harley Quinn #1 (2000-2004)", preco: 41.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/91MG-ZqP6mL._UF1000,1000_QL80_.jpg", editora: "dc", secao: "prevenda", estoque: null },
  { nome: "X-Force #1 (2024-2025)", preco: 37.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/91wx3p5QsyL._UF1000,1000_QL80_.jpg", editora: "marvel", secao: "prevenda", estoque: null },
  { nome: "Quarteto Fantástico Vol. 1 - Coleção Clássica Marvel Vol. 2", preco: 32.9, precoOriginal: 42.9, img: "https://m.media-amazon.com/images/I/714PBVa6kOL._AC_UF1000,1000_QL80_.jpg", editora: "marvel", secao: "prevenda", estoque: null },
  { nome: "Batwoman #1 (2026)", preco: 21.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/81e+23ysk8L._UF1000,1000_QL80_.jpg", editora: "dc", secao: "prevenda", estoque: null },
  { nome: "Box Marvel - Guerra Civil: Guerras secretas", preco: 149.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/71qMpn5jDWL._AC_UF1000,1000_QL80_.jpg", editora: "marvel", secao: "especiais", estoque: null },
  { nome: "Superman: O Reino Dos Supermen Ed. 23 - Dc Graphic Novels", preco: 139.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/61-7XbkwweL._AC_UF350,350_QL50_.jpg", editora: "dc", secao: "especiais", estoque: null },
  { nome: "Watchmen - The Deluxe Edition", preco: 79.9, precoOriginal: null, img: "https://m.media-amazon.com/images/I/81nqASLZU5L.jpg", editora: "dc", secao: "especiais", estoque: null },
  { nome: "Box - Saga do Infinito Completa", preco: 289.9, precoOriginal: null, img: "https://acdn-us.mitiendanube.com/stores/846/909/products/saga-3ed-3d1-88b1eeb2c5df63b46615970868190968-640-0.webp", editora: "marvel", secao: "especiais", estoque: null },
  { nome: "Batman O Cavaleiro das Trevas - Edição Definitiva - Capa Dura", preco: 269.9, precoOriginal: null, img: "https://quadrinheiros.com/wp-content/uploads/2013/03/capabatmanocavaleirodastrevas.jpg?w=445&h=654", editora: "dc", secao: "especiais", estoque: null },
  { nome: "Marvel Team-Up Omnibus Vol. 1", preco: 99.9, precoOriginal: 129.9, img: "https://m.media-amazon.com/images/I/81c-8tA+klL._AC_UF1000,1000_QL80_.jpg", editora: "marvel", secao: "especiais", estoque: null },
  { nome: "Box Marvel — X-Men Omnibus", preco: 139.9, precoOriginal: 179.9, img: "https://rihappy.vtexassets.com/arquivos/ids/9596987/17675507392572.jpg?v=639033052786330000", editora: "marvel", secao: "especiais", estoque: null },
  { nome: "Box DC — Superman Renascimento Completo", preco: 119.9, precoOriginal: 159.9, img: "https://static.wixstatic.com/media/8b7e24_8f5d1b746f0d4e2f8e81f915c406b7e3~mv2.png/v1/fit/w_500,h_500,q_90/file.png", editora: "dc", secao: "especiais", estoque: null },
  { nome: "Box Vingadores - Todos Querem Dominar o Mundo", preco: 149.9, precoOriginal: null, img: "https://cinebuzz.com.br/wp-content/uploads/61zrbyaf4hl._sl1000_.jpg", editora: "marvel", secao: "especiais", estoque: null },
];
async function migrar() {
  console.log(`Iniciando migração de ${PRODUTOS_VITRINE.length} produtos da vitrine → PostgreSQL\n`);

  // Espaça o horário de criação para preservar a ordem original de exibição
  // (o primeiro da lista fica marcado como o mais recente)
  const agora = Date.now();

  for (let i = 0; i < PRODUTOS_VITRINE.length; i++) {
    const p = PRODUTOS_VITRINE[i];
    const id = agora - i * 60000; // 1 minuto de diferença entre cada um
    const criadoEm = new Date(id).toISOString();
    const esgotado = p.estoque === 0;

    const existe = await pool.query("SELECT id FROM produtos WHERE nome = $1", [p.nome]);
    if (existe.rows.length > 0) {
      console.log(`  ↷ ${p.nome} (já existe, pulando)`);
      continue;
    }

    await pool.query(
      `INSERT INTO produtos (id, nome, preco, "precoOriginal", img, editora, secao, estoque, esgotado, "criadoEm")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, p.nome, p.preco, p.precoOriginal, p.img, p.editora, p.secao, p.estoque, esgotado, criadoEm]
    );
    console.log(`  ✓ ${p.nome}`);
  }

  const r = await pool.query("SELECT COUNT(*) FROM produtos");
  console.log(`\n✅ Migração concluída — ${r.rows[0].count} produto(s) no banco`);
  pool.end();
}

migrar().catch(e => { console.error("Erro:", e.message); pool.end(); });
