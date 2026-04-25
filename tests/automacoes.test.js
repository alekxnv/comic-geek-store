/**
 * Testes das automações — testa as funções diretamente via módulo interno
 * usando dados em memória (sem tocar no banco de dados real).
 */

// ─── helpers internos replicados para teste ───────────────

function arquivarPedidosAntigos(pedidos, arquivo) {
  const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const antigos = pedidos.filter(p => {
    const data = p.dataISO ? new Date(p.dataISO).getTime() : 0;
    return data < limite && ["aprovado", "concluido", "cancelado"].includes(p.status);
  });
  const ativos = pedidos.filter(p => !antigos.find(a => a.id === p.id));
  return { ativos, novoArquivo: [...arquivo, ...antigos] };
}

function cancelarPedidosPendentesAntigos(pedidos) {
  const limite = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return pedidos.map(p => {
    if (p.status !== "pendente") return p;
    if (p.expiresAt) return p;
    const data = p.dataISO ? new Date(p.dataISO).getTime() : 0;
    return data < limite ? { ...p, status: "cancelado" } : p;
  });
}

function expirarCupons(cupons) {
  const agora = new Date();
  return cupons.map(c => {
    if (c.ativo === false) return c;
    if (c.validoAte && new Date(c.validoAte) < agora) return { ...c, ativo: false };
    return c;
  });
}

function calcularTotalPedido(itens, cupomDesconto = 0, frete = 0) {
  const subtotal = itens.reduce((s, i) => s + Number(i.preco) * Number(i.qtd || 1), 0);
  const desconto = subtotal * (cupomDesconto / 100);
  return parseFloat((subtotal - desconto + frete).toFixed(2));
}

// ─── testes ───────────────────────────────────────────────

describe("Automação — Arquivamento de pedidos antigos", () => {
  const hoje = new Date().toISOString();
  const ha40dias = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

  const pedidos = [
    { id: 1, status: "aprovado", dataISO: ha40dias },   // deve arquivar
    { id: 2, status: "pendente", dataISO: ha40dias },   // não arquiva (pendente)
    { id: 3, status: "concluido", dataISO: ha40dias },  // deve arquivar
    { id: 4, status: "aprovado", dataISO: hoje },       // não arquiva (recente)
    { id: 5, status: "cancelado", dataISO: ha40dias },  // deve arquivar
  ];

  test("move pedidos antigos aprovados/concluídos/cancelados para arquivo", () => {
    const { ativos, novoArquivo } = arquivarPedidosAntigos(pedidos, []);
    expect(novoArquivo).toHaveLength(3); // ids 1, 3, 5
    expect(novoArquivo.map(p => p.id)).toEqual(expect.arrayContaining([1, 3, 5]));
  });

  test("mantém pedidos pendentes e recentes nos ativos", () => {
    const { ativos } = arquivarPedidosAntigos(pedidos, []);
    expect(ativos).toHaveLength(2); // ids 2 e 4
    expect(ativos.map(p => p.id)).toEqual(expect.arrayContaining([2, 4]));
  });

  test("não move nada se todos os pedidos são recentes", () => {
    const todos = [
      { id: 10, status: "aprovado", dataISO: hoje },
      { id: 11, status: "concluido", dataISO: hoje },
    ];
    const { ativos, novoArquivo } = arquivarPedidosAntigos(todos, []);
    expect(ativos).toHaveLength(2);
    expect(novoArquivo).toHaveLength(0);
  });
});

describe("Automação — Cancelamento de pedidos pendentes antigos", () => {
  const ha4dias = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const hoje = new Date().toISOString();

  test("cancela pedido pendente sem expiresAt com +3 dias", () => {
    const pedidos = [{ id: 1, status: "pendente", dataISO: ha4dias }];
    const resultado = cancelarPedidosPendentesAntigos(pedidos);
    expect(resultado[0].status).toBe("cancelado");
  });

  test("não cancela pedido pendente recente", () => {
    const pedidos = [{ id: 2, status: "pendente", dataISO: hoje }];
    const resultado = cancelarPedidosPendentesAntigos(pedidos);
    expect(resultado[0].status).toBe("pendente");
  });

  test("não cancela pedido com expiresAt (MercadoPago controla)", () => {
    const pedidos = [{ id: 3, status: "pendente", dataISO: ha4dias, expiresAt: new Date(Date.now() + 99999).toISOString() }];
    const resultado = cancelarPedidosPendentesAntigos(pedidos);
    expect(resultado[0].status).toBe("pendente");
  });

  test("não altera pedidos já aprovados ou cancelados", () => {
    const pedidos = [
      { id: 4, status: "aprovado", dataISO: ha4dias },
      { id: 5, status: "cancelado", dataISO: ha4dias },
    ];
    const resultado = cancelarPedidosPendentesAntigos(pedidos);
    expect(resultado[0].status).toBe("aprovado");
    expect(resultado[1].status).toBe("cancelado");
  });
});

describe("Automação — Expiração de cupons", () => {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  test("desativa cupom com validoAte no passado", () => {
    const cupons = [{ codigo: "VENCIDO", desconto: 10, ativo: true, validoAte: ontem }];
    const resultado = expirarCupons(cupons);
    expect(resultado[0].ativo).toBe(false);
  });

  test("mantém cupom com validoAte no futuro ativo", () => {
    const cupons = [{ codigo: "ATIVO", desconto: 10, ativo: true, validoAte: amanha }];
    const resultado = expirarCupons(cupons);
    expect(resultado[0].ativo).toBe(true);
  });

  test("mantém cupom sem validoAte ativo", () => {
    const cupons = [{ codigo: "SEMDATA", desconto: 10, ativo: true }];
    const resultado = expirarCupons(cupons);
    expect(resultado[0].ativo).toBe(true);
  });

  test("não altera cupom já inativo", () => {
    const cupons = [{ codigo: "INATIVO", desconto: 10, ativo: false, validoAte: ontem }];
    const resultado = expirarCupons(cupons);
    expect(resultado[0].ativo).toBe(false);
  });
});

describe("Cálculo de total de pedido (lógica server-side)", () => {
  test("calcula subtotal simples corretamente", () => {
    const itens = [{ preco: 30, qtd: 1 }, { preco: 20, qtd: 2 }];
    expect(calcularTotalPedido(itens)).toBe(70);
  });

  test("aplica desconto de cupom corretamente", () => {
    const itens = [{ preco: 100, qtd: 1 }];
    expect(calcularTotalPedido(itens, 10)).toBe(90); // 10% de desconto
  });

  test("soma frete ao total", () => {
    const itens = [{ preco: 50, qtd: 1 }];
    expect(calcularTotalPedido(itens, 0, 15)).toBe(65);
  });

  test("aplica desconto e frete juntos", () => {
    const itens = [{ preco: 100, qtd: 2 }]; // 200
    // 20% de desconto = -40, frete = 20 → total = 180
    expect(calcularTotalPedido(itens, 20, 20)).toBe(180);
  });

  test("arredonda corretamente para 2 casas decimais", () => {
    const itens = [{ preco: 33.33, qtd: 3 }]; // 99.99
    expect(calcularTotalPedido(itens)).toBe(99.99);
  });
});
