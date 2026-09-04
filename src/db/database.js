const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { criarCredenciais, verificarSenha } = require('./hash');

// ------------------------------------------------------------------
// CREDENCIAL PADRAO DO ADMINISTRADOR (fica gravada no codigo-fonte).
// Usada APENAS na primeira execucao para criar a conta. Depois disso
// o proprio administrador deve trocar a senha em "Meu Perfil".
// ------------------------------------------------------------------
const ADMIN_LOGIN_PADRAO = 'admin';
const ADMIN_SENHA_PADRAO = 'siscoop@2026';

let db;

function iniciar(userDataPath) {
  const dbPath = path.join(userDataPath, 'siscoop.db');
  const primeiraExecucao = !fs.existsSync(dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  if (primeiraExecucao) {
    semear();
  } else {
    // garante que o admin padrao exista mesmo em bancos antigos
    const existeAdmin = db.prepare("SELECT COUNT(*) c FROM usuario WHERE nivel_acesso='ADMINISTRADOR'").get();
    if (existeAdmin.c === 0) {
      criarUsuarioAdminPadrao();
    }
  }
  return dbPath;
}

function criarUsuarioAdminPadrao() {
  const { senha_hash, senha_salt } = criarCredenciais(ADMIN_SENHA_PADRAO);
  db.prepare(`INSERT INTO usuario (nome, login, senha_hash, senha_salt, nivel_acesso)
              VALUES (?,?,?,?,?)`)
    .run('Administrador', ADMIN_LOGIN_PADRAO, senha_hash, senha_salt, 'ADMINISTRADOR');
}

function semear() {
  criarUsuarioAdminPadrao();

  const categorias = ['Cestaria', 'Ceramica', 'Biojoias', 'Tecelagem', 'Madeira'];
  const insCat = db.prepare('INSERT INTO categoria (nome) VALUES (?)');
  categorias.forEach(c => insCat.run(c));
}

// ---------------------- AUTENTICACAO ----------------------
function autenticar(login, senha) {
  const usuario = db.prepare('SELECT * FROM usuario WHERE login = ? AND ativo = 1').get(login);
  if (!usuario) return { ok: false, erro: 'Usuario nao encontrado ou inativo.' };
  const valido = verificarSenha(senha, usuario.senha_salt, usuario.senha_hash);
  if (!valido) return { ok: false, erro: 'Senha incorreta.' };
  const { senha_hash, senha_salt, ...usuarioSeguro } = usuario;
  return { ok: true, usuario: usuarioSeguro };
}

function alterarSenha(id_usuario, senhaAtual, novaSenha) {
  const usuario = db.prepare('SELECT * FROM usuario WHERE id_usuario = ?').get(id_usuario);
  if (!usuario) return { ok: false, erro: 'Usuario nao encontrado.' };
  if (!verificarSenha(senhaAtual, usuario.senha_salt, usuario.senha_hash)) {
    return { ok: false, erro: 'Senha atual incorreta.' };
  }
  if (!novaSenha || novaSenha.length < 6) {
    return { ok: false, erro: 'A nova senha deve ter ao menos 6 caracteres.' };
  }
  const { senha_hash, senha_salt } = criarCredenciais(novaSenha);
  db.prepare('UPDATE usuario SET senha_hash=?, senha_salt=? WHERE id_usuario=?')
    .run(senha_hash, senha_salt, id_usuario);
  return { ok: true };
}

// ---------------------- USUARIOS (gestao pelo admin) ----------------------
function listarUsuarios() {
  return db.prepare('SELECT id_usuario, nome, login, nivel_acesso, ativo, criado_em FROM usuario ORDER BY nome').all();
}

function criarUsuario({ nome, login, senha, nivel_acesso }) {
  const existe = db.prepare('SELECT 1 FROM usuario WHERE login = ?').get(login);
  if (existe) return { ok: false, erro: 'Ja existe um usuario com esse login.' };
  const { senha_hash, senha_salt } = criarCredenciais(senha);
  const info = db.prepare(`INSERT INTO usuario (nome, login, senha_hash, senha_salt, nivel_acesso)
                            VALUES (?,?,?,?,?)`).run(nome, login, senha_hash, senha_salt, nivel_acesso);
  return { ok: true, id: info.lastInsertRowid };
}

function definirStatusUsuario(id_usuario, ativo) {
  db.prepare('UPDATE usuario SET ativo=? WHERE id_usuario=?').run(ativo ? 1 : 0, id_usuario);
  return { ok: true };
}

function redefinirSenhaAdmin(id_usuario, novaSenha) {
  if (!novaSenha || novaSenha.length < 6) return { ok: false, erro: 'A senha deve ter ao menos 6 caracteres.' };
  const { senha_hash, senha_salt } = criarCredenciais(novaSenha);
  db.prepare('UPDATE usuario SET senha_hash=?, senha_salt=? WHERE id_usuario=?').run(senha_hash, senha_salt, id_usuario);
  return { ok: true };
}

// ---------------------- ARTESAOS ----------------------
function listarArtesoes(incluirInativos = false) {
  return db.prepare(`SELECT * FROM artesao ${incluirInativos ? '' : 'WHERE ativo = 1'} ORDER BY nome`).all();
}

function salvarArtesao(dados) {
  if (dados.id_artesao) {
    db.prepare(`UPDATE artesao SET numero_identificacao=?, nome=?, cpf=?, contato=? WHERE id_artesao=?`)
      .run(dados.numero_identificacao, dados.nome, dados.cpf, dados.contato || null, dados.id_artesao);
    return { ok: true, id: dados.id_artesao };
  }
  try {
    const info = db.prepare(`INSERT INTO artesao (numero_identificacao, nome, cpf, contato) VALUES (?,?,?,?)`)
      .run(dados.numero_identificacao, dados.nome, dados.cpf, dados.contato || null);
    return { ok: true, id: info.lastInsertRowid };
  } catch (e) {
    return { ok: false, erro: 'CPF ou codigo de identificacao ja cadastrado (RNG/CUS 07).' };
  }
}

function inativarArtesao(id_artesao) {
  db.prepare('UPDATE artesao SET ativo=0 WHERE id_artesao=?').run(id_artesao);
  return { ok: true };
}

// ---------------------- CATEGORIAS ----------------------
function listarCategorias() {
  return db.prepare('SELECT * FROM categoria ORDER BY nome').all();
}
function salvarCategoria(dados) {
  if (dados.id_categoria) {
    db.prepare('UPDATE categoria SET nome=?, descricao=? WHERE id_categoria=?')
      .run(dados.nome, dados.descricao || null, dados.id_categoria);
    return { ok: true };
  }
  const info = db.prepare('INSERT INTO categoria (nome, descricao) VALUES (?,?)').run(dados.nome, dados.descricao || null);
  return { ok: true, id: info.lastInsertRowid };
}

// ---------------------- PRODUTOS + ESTOQUE ----------------------
function listarProdutos(incluirInativos = false) {
  return db.prepare(`
    SELECT p.*, a.nome AS artesao_nome, c.nome AS categoria_nome,
           COALESCE(e.quantidade_atual, 0) AS quantidade_atual
    FROM produto p
    JOIN artesao a ON a.id_artesao = p.id_artesao
    JOIN categoria c ON c.id_categoria = p.id_categoria
    LEFT JOIN estoque e ON e.id_produto = p.id_produto
    ${incluirInativos ? '' : 'WHERE p.ativo = 1'}
    ORDER BY p.nome
  `).all();
}

function produtosEstoqueCritico() {
  return db.prepare(`
    SELECT p.*, COALESCE(e.quantidade_atual,0) AS quantidade_atual
    FROM produto p
    LEFT JOIN estoque e ON e.id_produto = p.id_produto
    WHERE p.ativo = 1 AND COALESCE(e.quantidade_atual,0) <= p.estoque_minimo
    ORDER BY quantidade_atual ASC
  `).all();
}

const salvarProdutoTx = () => db.transaction((dados) => {
  if (dados.id_produto) {
    db.prepare(`UPDATE produto SET id_artesao=?, id_categoria=?, nome=?, descricao=?, materia_prima=?,
                preco_custo=?, preco=?, estoque_minimo=? WHERE id_produto=?`)
      .run(dados.id_artesao, dados.id_categoria, dados.nome, dados.descricao || null, dados.materia_prima || null,
           dados.preco_custo || 0, dados.preco, dados.estoque_minimo || 0, dados.id_produto);
    return dados.id_produto;
  }
  const info = db.prepare(`INSERT INTO produto (id_artesao, id_categoria, nome, descricao, materia_prima,
              preco_custo, preco, estoque_minimo) VALUES (?,?,?,?,?,?,?,?)`)
    .run(dados.id_artesao, dados.id_categoria, dados.nome, dados.descricao || null, dados.materia_prima || null,
         dados.preco_custo || 0, dados.preco, dados.estoque_minimo || 0);
  const idProduto = info.lastInsertRowid;
  db.prepare('INSERT INTO estoque (id_produto, quantidade_atual) VALUES (?, 0)').run(idProduto);
  return idProduto;
});

function salvarProduto(dados) {
  try {
    const id = salvarProdutoTx()(dados);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

function inativarProduto(id_produto) {
  db.prepare('UPDATE produto SET ativo=0 WHERE id_produto=?').run(id_produto);
  return { ok: true };
}

// entrada/saida/ajuste manual de estoque (RF04, com log de auditoria)
const movimentarEstoqueTx = () => db.transaction((id_produto, id_usuario, tipo, quantidade, observacao) => {
  const est = db.prepare('SELECT * FROM estoque WHERE id_produto = ?').get(id_produto);
  let novaQtd = est.quantidade_atual;
  if (tipo === 'ENTRADA') novaQtd += quantidade;
  else if (tipo === 'SAIDA' || tipo === 'AJUSTE') novaQtd -= quantidade;
  if (novaQtd < 0) throw new Error('Estoque nao pode ficar negativo (RNG/SEG 01).');
  db.prepare('UPDATE estoque SET quantidade_atual=? WHERE id_produto=?').run(novaQtd, id_produto);
  db.prepare(`INSERT INTO movimentacao_estoque (id_produto, id_usuario, tipo_movimentacao, quantidade, observacao)
              VALUES (?,?,?,?,?)`).run(id_produto, id_usuario, tipo, quantidade, observacao || null);
  return novaQtd;
});

function movimentarEstoque(id_produto, id_usuario, tipo, quantidade, observacao) {
  try {
    const novaQtd = movimentarEstoqueTx()(id_produto, id_usuario, tipo, quantidade, observacao);
    return { ok: true, quantidade_atual: novaQtd };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

function historicoMovimentacoes(id_produto) {
  return db.prepare(`
    SELECT m.*, u.nome AS usuario_nome FROM movimentacao_estoque m
    JOIN usuario u ON u.id_usuario = m.id_usuario
    WHERE m.id_produto = ? ORDER BY m.data_movimentacao DESC
  `).all(id_produto);
}

// ---------------------- PDV / VENDAS ----------------------
// itens: [{ id_produto, quantidade, valor_unitario }]
const registrarVendaTx = () => db.transaction((id_usuario, itens, forma_pagamento, tipo, dados_transacao, consignacao) => {
  let valor_total = 0;
  for (const item of itens) {
    const est = db.prepare('SELECT quantidade_atual FROM estoque WHERE id_produto = ?').get(item.id_produto);
    if (!est || est.quantidade_atual < item.quantidade) {
      const prod = db.prepare('SELECT nome FROM produto WHERE id_produto=?').get(item.id_produto);
      throw new Error(`Estoque insuficiente para "${prod ? prod.nome : item.id_produto}" (RNG/SEG 01).`);
    }
    valor_total += item.quantidade * item.valor_unitario;
  }

  const infoVenda = db.prepare(`INSERT INTO venda (id_usuario, valor_total, tipo, id_consignatario, data_limite_consignacao)
              VALUES (?,?,?,?,?)`)
    .run(id_usuario, valor_total, tipo || 'A_VISTA',
         consignacao ? consignacao.consignatario : null,
         consignacao ? consignacao.data_limite : null);
  const id_venda = infoVenda.lastInsertRowid;

  const produtoStmt = db.prepare('SELECT preco_custo FROM produto WHERE id_produto = ?');
  for (const item of itens) {
    const produto = produtoStmt.get(item.id_produto);
    const subtotal = item.quantidade * item.valor_unitario;
    db.prepare(`INSERT INTO item_venda (id_venda, id_produto, quantidade, valor_unitario, valor_repasse_unit, subtotal)
                VALUES (?,?,?,?,?,?)`)
      .run(id_venda, item.id_produto, item.quantidade, item.valor_unitario, produto.preco_custo, subtotal);

    db.prepare('UPDATE estoque SET quantidade_atual = quantidade_atual - ? WHERE id_produto = ?')
      .run(item.quantidade, item.id_produto);
    db.prepare(`INSERT INTO movimentacao_estoque (id_produto, id_usuario, tipo_movimentacao, quantidade, observacao)
                VALUES (?,?, 'VENDA', ?, ?)`)
      .run(item.id_produto, id_usuario, item.quantidade, `Venda #${id_venda}`);
  }

  db.prepare(`INSERT INTO pagamento (id_venda, forma_pagamento, dados_transacao, valor) VALUES (?,?,?,?)`)
    .run(id_venda, forma_pagamento, dados_transacao || null, valor_total);

  const numeroDoc = `SISCOOP-${String(id_venda).padStart(6, '0')}`;
  db.prepare(`INSERT INTO documento_fiscal (id_venda, numero_documento) VALUES (?,?)`).run(id_venda, numeroDoc);

  return { id_venda, valor_total, numeroDoc };
});

function registrarVenda(payload) {
  try {
    const { id_usuario, itens, forma_pagamento, tipo, dados_transacao, consignacao } = payload;
    if (!itens || itens.length === 0) return { ok: false, erro: 'Nenhum item no carrinho.' };
    if (tipo === 'CONSIGNADO' && (!consignacao || !consignacao.consignatario || !consignacao.data_limite)) {
      return { ok: false, erro: 'Consignatario e data limite sao obrigatorios (RNG/USA 04).' };
    }
    const resultado = registrarVendaTx()(id_usuario, itens, forma_pagamento, tipo, dados_transacao, consignacao);
    return { ok: true, ...resultado };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

function estornarVenda(id_venda, id_usuario_estorno, motivo) {
  const tx = db.transaction(() => {
    const venda = db.prepare('SELECT * FROM venda WHERE id_venda = ?').get(id_venda);
    if (!venda) throw new Error('Venda nao encontrada.');
    if (venda.status === 'ESTORNADA') throw new Error('Venda ja estornada.');
    const itens = db.prepare('SELECT * FROM item_venda WHERE id_venda = ?').all(id_venda);
    for (const item of itens) {
      db.prepare('UPDATE estoque SET quantidade_atual = quantidade_atual + ? WHERE id_produto = ?')
        .run(item.quantidade, item.id_produto);
      db.prepare(`INSERT INTO movimentacao_estoque (id_produto, id_usuario, tipo_movimentacao, quantidade, observacao)
                  VALUES (?,?, 'ESTORNO', ?, ?)`)
        .run(item.id_produto, id_usuario_estorno, item.quantidade, `Estorno da venda #${id_venda}: ${motivo || ''}`);
    }
    db.prepare("UPDATE venda SET status='ESTORNADA' WHERE id_venda=?").run(id_venda);
  });
  try {
    tx();
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

function historicoVendas({ dataInicio, dataFim } = {}) {
  let query = `
    SELECT v.*, u.nome AS vendedor_nome, p.forma_pagamento, d.numero_documento
    FROM venda v
    JOIN usuario u ON u.id_usuario = v.id_usuario
    LEFT JOIN pagamento p ON p.id_venda = v.id_venda
    LEFT JOIN documento_fiscal d ON d.id_venda = v.id_venda
  `;
  const params = [];
  if (dataInicio && dataFim) {
    query += ' WHERE date(v.data_venda) BETWEEN date(?) AND date(?)';
    params.push(dataInicio, dataFim);
  }
  query += ' ORDER BY v.data_venda DESC';
  return db.prepare(query).all(...params);
}

function itensDaVenda(id_venda) {
  return db.prepare(`
    SELECT iv.*, p.nome AS produto_nome, a.nome AS artesao_nome
    FROM item_venda iv
    JOIN produto p ON p.id_produto = iv.id_produto
    JOIN artesao a ON a.id_artesao = p.id_artesao
    WHERE iv.id_venda = ?
  `).all(id_venda);
}

// dados completos de uma venda (cabecalho + itens) usados na emissao do comprovante em PDF
function obterVendaCompleta(id_venda) {
  const venda = db.prepare(`
    SELECT v.*, u.nome AS vendedor_nome, p.forma_pagamento, p.dados_transacao,
           d.numero_documento, d.data_emissao
    FROM venda v
    JOIN usuario u ON u.id_usuario = v.id_usuario
    LEFT JOIN pagamento p ON p.id_venda = v.id_venda
    LEFT JOIN documento_fiscal d ON d.id_venda = v.id_venda
    WHERE v.id_venda = ?
  `).get(id_venda);
  if (!venda) return null;
  const itens = itensDaVenda(id_venda);
  return { ...venda, itens };
}

// ---------------------- REPASSE AOS ARTESAOS (RNG/SEG 02, RNG/DES 05) ----------------------
function relatorioRepasse({ dataInicio, dataFim }) {
  return db.prepare(`
    SELECT a.id_artesao, a.nome AS artesao_nome,
           SUM(iv.quantidade) AS itens_vendidos,
           SUM(iv.quantidade * iv.valor_repasse_unit) AS valor_repasse,
           SUM(iv.subtotal) AS valor_vendido,
           SUM(iv.subtotal - (iv.quantidade * iv.valor_repasse_unit)) AS margem_cooperativa
    FROM item_venda iv
    JOIN venda v ON v.id_venda = iv.id_venda
    JOIN produto p ON p.id_produto = iv.id_produto
    JOIN artesao a ON a.id_artesao = p.id_artesao
    WHERE v.status = 'CONCLUIDA' AND date(v.data_venda) BETWEEN date(?) AND date(?)
    GROUP BY a.id_artesao
    ORDER BY valor_repasse DESC
  `).all(dataInicio, dataFim);
}

function dashboardResumo() {
  const hoje = db.prepare(`SELECT COALESCE(SUM(valor_total),0) total, COUNT(*) qtd FROM venda
                            WHERE status='CONCLUIDA' AND date(data_venda) = date('now','localtime')`).get();
  const mes = db.prepare(`SELECT COALESCE(SUM(valor_total),0) total FROM venda
                           WHERE status='CONCLUIDA' AND strftime('%Y-%m', data_venda) = strftime('%Y-%m','now','localtime')`).get();
  const totalProdutos = db.prepare('SELECT COUNT(*) c FROM produto WHERE ativo=1').get();
  const totalArtesoes = db.prepare('SELECT COUNT(*) c FROM artesao WHERE ativo=1').get();
  const criticos = produtosEstoqueCritico();
  return {
    vendasHoje: hoje.total, qtdVendasHoje: hoje.qtd, vendasMes: mes.total,
    totalProdutos: totalProdutos.c, totalArtesoes: totalArtesoes.c,
    estoqueCritico: criticos.length, produtosCriticos: criticos.slice(0, 8)
  };
}

// ---------------------- DADOS PARA GRAFICOS DO DASHBOARD ----------------------

// total vendido por dia nos ultimos N dias (para o grafico de barras/linha)
function dashboardVendasPorDia(dias = 7) {
  const linhas = db.prepare(`
    SELECT date(data_venda) AS dia, COALESCE(SUM(valor_total),0) AS total
    FROM venda
    WHERE status = 'CONCLUIDA' AND date(data_venda) >= date('now','localtime','-${dias - 1} days')
    GROUP BY date(data_venda)
  `).all();
  const mapa = Object.fromEntries(linhas.map(l => [l.dia, l.total]));

  // preenche os dias sem venda com 0, mantendo a ordem cronologica
  const resultado = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = db.prepare(`SELECT date('now','localtime', ?) AS dia`).get(`-${i} days`).dia;
    resultado.push({ dia: d, total: mapa[d] || 0 });
  }
  return resultado;
}

// distribuicao das vendas do mes atual por categoria de produto (para o grafico de pizza/donut)
function dashboardVendasPorCategoria() {
  return db.prepare(`
    SELECT c.nome AS categoria, COALESCE(SUM(iv.subtotal),0) AS total
    FROM item_venda iv
    JOIN venda v ON v.id_venda = iv.id_venda
    JOIN produto p ON p.id_produto = iv.id_produto
    JOIN categoria c ON c.id_categoria = p.id_categoria
    WHERE v.status = 'CONCLUIDA' AND strftime('%Y-%m', v.data_venda) = strftime('%Y-%m','now','localtime')
    GROUP BY c.id_categoria
    HAVING total > 0
    ORDER BY total DESC
  `).all();
}

// ---------------------- MATERIA PRIMA / LISTA DE COMPRAS ----------------------
function listarMateriasPrimas() {
  return db.prepare('SELECT * FROM materia_prima ORDER BY nome').all();
}
function salvarMateriaPrima(dados) {
  if (dados.id_materia) {
    db.prepare('UPDATE materia_prima SET nome=?, descricao=?, unidade_medida=?, quantidade_disponivel=? WHERE id_materia=?')
      .run(dados.nome, dados.descricao || null, dados.unidade_medida, dados.quantidade_disponivel || 0, dados.id_materia);
    return { ok: true };
  }
  const info = db.prepare(`INSERT INTO materia_prima (nome, descricao, unidade_medida, quantidade_disponivel)
              VALUES (?,?,?,?)`).run(dados.nome, dados.descricao || null, dados.unidade_medida, dados.quantidade_disponivel || 0);
  return { ok: true, id: info.lastInsertRowid };
}

function listarListasCompra() {
  return db.prepare(`
    SELECT l.*, u.nome AS usuario_nome FROM lista_compra l
    JOIN usuario u ON u.id_usuario = l.id_usuario ORDER BY l.data_criacao DESC
  `).all();
}
function criarListaCompra(id_usuario) {
  const info = db.prepare('INSERT INTO lista_compra (id_usuario) VALUES (?)').run(id_usuario);
  return { ok: true, id: info.lastInsertRowid };
}
function adicionarItemLista(id_lista, id_materia, quantidade_desejada) {
  const info = db.prepare(`INSERT INTO item_lista_compra (id_lista, id_materia, quantidade_desejada)
              VALUES (?,?,?)`).run(id_lista, id_materia, quantidade_desejada);
  return { ok: true, id: info.lastInsertRowid };
}
function itensDaLista(id_lista) {
  return db.prepare(`
    SELECT il.*, m.nome AS materia_nome, m.unidade_medida FROM item_lista_compra il
    JOIN materia_prima m ON m.id_materia = il.id_materia WHERE il.id_lista = ?
  `).all(id_lista);
}
function atualizarStatusLista(id_lista, status) {
  db.prepare('UPDATE lista_compra SET status=? WHERE id_lista=?').run(status, id_lista);
  return { ok: true };
}

// ---------------------- BACKUP / RESTAURACAO (RF10 / RNF06) ----------------------
function caminhoBanco() {
  return db.name;
}

function backup(destino) {
  return db.backup(destino).then(() => ({ ok: true, destino }));
}

function fecharConexao() {
  if (db) db.close();
}

// ---------------------- AUDITORIA GERAL (RNG/DES 06) ----------------------
function auditoriaGeral(limite = 300) {
  return db.prepare(`
    SELECT m.*, p.nome AS produto_nome, u.nome AS usuario_nome
    FROM movimentacao_estoque m
    JOIN produto p ON p.id_produto = m.id_produto
    JOIN usuario u ON u.id_usuario = m.id_usuario
    ORDER BY m.data_movimentacao DESC
    LIMIT ?
  `).all(limite);
}

module.exports = {
  iniciar,
  autenticar, alterarSenha,
  listarUsuarios, criarUsuario, definirStatusUsuario, redefinirSenhaAdmin,
  listarArtesoes, salvarArtesao, inativarArtesao,
  listarCategorias, salvarCategoria,
  listarProdutos, salvarProduto, inativarProduto, produtosEstoqueCritico,
  movimentarEstoque, historicoMovimentacoes,
  registrarVenda, estornarVenda, historicoVendas, itensDaVenda, obterVendaCompleta,
  relatorioRepasse, dashboardResumo, dashboardVendasPorDia, dashboardVendasPorCategoria,
  listarMateriasPrimas, salvarMateriaPrima,
  listarListasCompra, criarListaCompra, adicionarItemLista, itensDaLista, atualizarStatusLista,
  caminhoBanco, backup, fecharConexao, auditoriaGeral,
  ADMIN_LOGIN_PADRAO
};
