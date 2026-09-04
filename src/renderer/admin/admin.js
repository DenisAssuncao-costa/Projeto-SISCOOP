// ==================== ESTADO GLOBAL ====================
let usuarioAtual = null;
let cacheProdutos = [];
let cacheArtesoes = [];
let cacheCategorias = [];
let cacheMaterias = [];
let carrinho = []; // { id_produto, nome, preco, quantidade, estoque_disponivel }

const mapaNav = {};

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-item[data-secao]').forEach(item => {
    mapaNav[item.dataset.secao] = item;
    item.addEventListener('click', () => navegarPara(item.dataset.secao));
  });
  document.querySelector('.usuario-chip').addEventListener('click', () => navegarPara('secao-perfil'));
  document.getElementById('btnSair').addEventListener('click', async () => {
    if (confirmarAcao('Deseja realmente sair do sistema?')) await window.siscoop.logout();
  });

  usuarioAtual = await window.siscoop.usuarioAtual();
  if (usuarioAtual) preencherCabecalhoUsuario();

  await Promise.all([carregarArtesoes(), carregarCategorias(), carregarProdutos(), carregarMaterias()]);
  await carregarDashboard();
  registrarEventos();
});

function preencherCabecalhoUsuario() {
  document.getElementById('chipNome').textContent = usuarioAtual.nome;
  document.getElementById('chipPapel').textContent = usuarioAtual.nivel_acesso === 'ADMINISTRADOR' ? 'Administrador' : 'Operador';
  document.getElementById('chipAvatar').textContent = iniciaisNome(usuarioAtual.nome);
  document.getElementById('perfilAvatar').textContent = iniciaisNome(usuarioAtual.nome);
  document.getElementById('perfilNome').textContent = usuarioAtual.nome;
  document.getElementById('perfilLogin').textContent = '@' + usuarioAtual.login;
}

const titulosSecao = {
  'secao-dashboard': 'Painel Geral', 'secao-pdv': 'Ponto de Venda', 'secao-vendas': 'Vendas & Consignações',
  'secao-repasse': 'Repasse aos Artesãos', 'secao-produtos': 'Produtos & Estoque', 'secao-artesaos': 'Artesãos',
  'secao-categorias': 'Categorias', 'secao-materiaprima': 'Matéria-Prima & Compras', 'secao-usuarios': 'Usuários',
  'secao-auditoria': 'Auditoria', 'secao-backup': 'Backup & Restauração', 'secao-perfil': 'Meu Perfil'
};

function navegarPara(idSecao) {
  trocarSecao(idSecao, mapaNav);
  document.getElementById('tituloTopbar').textContent = titulosSecao[idSecao] || '';
  if (idSecao === 'secao-dashboard') carregarDashboard();
  if (idSecao === 'secao-pdv') renderizarPdvProdutos();
  if (idSecao === 'secao-vendas') carregarVendas();
  if (idSecao === 'secao-usuarios') carregarUsuarios();
  if (idSecao === 'secao-auditoria') carregarAuditoria();
  if (idSecao === 'secao-materiaprima') { carregarMaterias(); carregarListas(); }
}

// ==================== DASHBOARD ====================
async function carregarDashboard() {
  const r = await window.siscoop.dashboardResumo();
  document.getElementById('mVendasHoje').textContent = formatarMoeda(r.vendasHoje);
  document.getElementById('mQtdHoje').textContent = r.qtdVendasHoje;
  document.getElementById('mVendasMes').textContent = formatarMoeda(r.vendasMes);
  document.getElementById('mProdutos').textContent = r.totalProdutos;
  document.getElementById('mArtesoes').textContent = r.totalArtesoes;
  document.getElementById('mCritico').textContent = r.estoqueCritico;

  const badge = document.getElementById('badgeCritico');
  if (r.estoqueCritico > 0) { badge.style.display = 'inline-block'; badge.textContent = r.estoqueCritico; }
  else { badge.style.display = 'none'; }

  const corpo = document.querySelector('#tabelaCriticos tbody');
  corpo.innerHTML = r.produtosCriticos.length ? r.produtosCriticos.map(p => `
    <tr><td>${escaparHtml(p.nome)}</td><td>${p.quantidade_atual}</td><td>${p.estoque_minimo}</td></tr>
  `).join('') : '<tr><td colspan="3" class="vazio">Nenhum produto em nível crítico. 🎉</td></tr>';

  await carregarGraficosDashboard();
}

async function carregarGraficosDashboard() {
  const porDia = await window.siscoop.dashboardVendasPorDia(7);
  const pontosBarras = porDia.map(p => ({
    rotulo: formatarData(p.dia).slice(0, 5), // dd/mm
    valor: p.total
  }));
  desenharGraficoBarras('graficoVendasDia', pontosBarras, { cor: '#3d6b52' });

  const porCategoria = await window.siscoop.dashboardVendasPorCategoria();
  const pontosPizza = porCategoria.map(c => ({ rotulo: c.categoria, valor: c.total }));
  desenharGraficoPizza('graficoVendasCategoria', 'legendaVendasCategoria', pontosPizza);
}

// ==================== ARTESÃOS ====================
async function carregarArtesoes() {
  const incluirInativos = document.getElementById('mostrarInativosArtesao')?.checked;
  cacheArtesoes = await window.siscoop.listarArtesoes(incluirInativos);
  renderizarArtesoes();
  preencherSelectArtesoes();
}

function renderizarArtesoes() {
  const corpo = document.querySelector('#tabelaArtesoes tbody');
  corpo.innerHTML = cacheArtesoes.length ? cacheArtesoes.map(a => `
    <tr>
      <td>${escaparHtml(a.numero_identificacao)}</td>
      <td>${escaparHtml(a.nome)}</td>
      <td>${escaparHtml(a.cpf)}</td>
      <td>${escaparHtml(a.contato || '-')}</td>
      <td><span class="chip-status ${a.ativo ? 'chip-ativo' : 'chip-inativo'}">${a.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td class="acoes-linha">
        <button class="btn-secundario" onclick="editarArtesao(${a.id_artesao})">Editar</button>
        ${a.ativo ? `<button class="btn-perigo" onclick="inativarArtesaoUi(${a.id_artesao})">Inativar</button>` : ''}
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="vazio">Nenhum artesão cadastrado.</td></tr>';
}

function preencherSelectArtesoes() {
  const sel = document.getElementById('produtoArtesao');
  const atual = sel.value;
  sel.innerHTML = cacheArtesoes.filter(a => a.ativo).map(a => `<option value="${a.id_artesao}">${escaparHtml(a.nome)}</option>`).join('');
  if (atual) sel.value = atual;
}

document.getElementById('btnNovoArtesao')?.addEventListener('click', () => {
  document.getElementById('tituloModalArtesao').textContent = 'Novo Artesão';
  ['artesaoId', 'artesaoCodigo', 'artesaoNome', 'artesaoCpf', 'artesaoContato'].forEach(id => document.getElementById(id).value = '');
  abrirModal('modalArtesao');
});

function editarArtesao(id) {
  const a = cacheArtesoes.find(x => x.id_artesao === id);
  if (!a) return;
  document.getElementById('tituloModalArtesao').textContent = 'Editar Artesão';
  document.getElementById('artesaoId').value = a.id_artesao;
  document.getElementById('artesaoCodigo').value = a.numero_identificacao;
  document.getElementById('artesaoNome').value = a.nome;
  document.getElementById('artesaoCpf').value = a.cpf;
  document.getElementById('artesaoContato').value = a.contato || '';
  abrirModal('modalArtesao');
}

async function inativarArtesaoUi(id) {
  if (!confirmarAcao('Inativar este artesão? Ele deixará de aparecer nos cadastros de produto.')) return;
  await window.siscoop.inativarArtesao(id);
  toast('Artesão inativado.');
  await carregarArtesoes();
}

document.getElementById('mostrarInativosArtesao')?.addEventListener('change', carregarArtesoes);

document.getElementById('btnSalvarArtesao')?.addEventListener('click', async () => {
  const dados = {
    id_artesao: document.getElementById('artesaoId').value || null,
    numero_identificacao: document.getElementById('artesaoCodigo').value.trim(),
    nome: document.getElementById('artesaoNome').value.trim(),
    cpf: document.getElementById('artesaoCpf').value.trim(),
    contato: document.getElementById('artesaoContato').value.trim()
  };
  if (!dados.numero_identificacao || !dados.nome || !dados.cpf) return toast('Preencha os campos obrigatórios.', 'erro');
  const r = await window.siscoop.salvarArtesao(dados);
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Artesão salvo com sucesso.');
  fecharModal('modalArtesao');
  await carregarArtesoes();
});

// ==================== CATEGORIAS ====================
async function carregarCategorias() {
  cacheCategorias = await window.siscoop.listarCategorias();
  renderizarCategorias();
  preencherSelectCategorias();
  preencherFiltroCategoriaPdv();
}

function renderizarCategorias() {
  const corpo = document.querySelector('#tabelaCategorias tbody');
  corpo.innerHTML = cacheCategorias.length ? cacheCategorias.map(c => `
    <tr>
      <td>${escaparHtml(c.nome)}</td>
      <td>${escaparHtml(c.descricao || '-')}</td>
      <td class="acoes-linha"><button class="btn-secundario" onclick="editarCategoria(${c.id_categoria})">Editar</button></td>
    </tr>
  `).join('') : '<tr><td colspan="3" class="vazio">Nenhuma categoria cadastrada.</td></tr>';
}

function preencherSelectCategorias() {
  const sel = document.getElementById('produtoCategoria');
  const atual = sel.value;
  sel.innerHTML = cacheCategorias.map(c => `<option value="${c.id_categoria}">${escaparHtml(c.nome)}</option>`).join('');
  if (atual) sel.value = atual;
}

function preencherFiltroCategoriaPdv() {
  const sel = document.getElementById('filtroCategoriaPdv');
  const atual = sel.value;
  sel.innerHTML = '<option value="">Todas as categorias</option>' +
    cacheCategorias.map(c => `<option value="${c.id_categoria}">${escaparHtml(c.nome)}</option>`).join('');
  sel.value = atual;
}

document.getElementById('btnNovaCategoria')?.addEventListener('click', () => {
  document.getElementById('tituloModalCategoria').textContent = 'Nova Categoria';
  document.getElementById('categoriaId').value = '';
  document.getElementById('categoriaNome').value = '';
  document.getElementById('categoriaDescricao').value = '';
  abrirModal('modalCategoria');
});

function editarCategoria(id) {
  const c = cacheCategorias.find(x => x.id_categoria === id);
  if (!c) return;
  document.getElementById('tituloModalCategoria').textContent = 'Editar Categoria';
  document.getElementById('categoriaId').value = c.id_categoria;
  document.getElementById('categoriaNome').value = c.nome;
  document.getElementById('categoriaDescricao').value = c.descricao || '';
  abrirModal('modalCategoria');
}

document.getElementById('btnSalvarCategoria')?.addEventListener('click', async () => {
  const dados = {
    id_categoria: document.getElementById('categoriaId').value || null,
    nome: document.getElementById('categoriaNome').value.trim(),
    descricao: document.getElementById('categoriaDescricao').value.trim()
  };
  if (!dados.nome) return toast('Informe o nome da categoria.', 'erro');
  const r = await window.siscoop.salvarCategoria(dados);
  if (!r.ok) return toast(r.erro || 'Erro ao salvar categoria.', 'erro');
  toast('Categoria salva com sucesso.');
  fecharModal('modalCategoria');
  await carregarCategorias();
});

// ==================== PRODUTOS / ESTOQUE ====================
async function carregarProdutos() {
  const incluirInativos = document.getElementById('mostrarInativosProduto')?.checked;
  cacheProdutos = await window.siscoop.listarProdutos(incluirInativos);
  renderizarProdutos();
}

function renderizarProdutos() {
  const busca = (document.getElementById('buscaProduto')?.value || '').toLowerCase();
  const filtrados = cacheProdutos.filter(p => p.nome.toLowerCase().includes(busca));
  const corpo = document.querySelector('#tabelaProdutos tbody');
  corpo.innerHTML = filtrados.length ? filtrados.map(p => `
    <tr>
      <td>${escaparHtml(p.nome)}</td>
      <td>${escaparHtml(p.artesao_nome)}</td>
      <td>${escaparHtml(p.categoria_nome)}</td>
      <td>${formatarMoeda(p.preco)}</td>
      <td>${p.quantidade_atual}</td>
      <td>${p.estoque_minimo}</td>
      <td><span class="chip-status ${p.ativo ? 'chip-ativo' : 'chip-inativo'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td class="acoes-linha">
        <button class="btn-secundario" onclick="abrirMovimentacaoEstoque(${p.id_produto})">Estoque</button>
        <button class="btn-secundario" onclick="editarProduto(${p.id_produto})">Editar</button>
        ${p.ativo ? `<button class="btn-perigo" onclick="inativarProdutoUi(${p.id_produto})">Inativar</button>` : ''}
      </td>
    </tr>
  `).join('') : '<tr><td colspan="8" class="vazio">Nenhum produto encontrado.</td></tr>';
}

document.getElementById('buscaProduto')?.addEventListener('input', renderizarProdutos);
document.getElementById('mostrarInativosProduto')?.addEventListener('change', carregarProdutos);

document.getElementById('btnNovoProduto')?.addEventListener('click', () => {
  if (!cacheArtesoes.some(a => a.ativo)) return toast('Cadastre ao menos um artesão ativo antes de criar um produto.', 'erro');
  document.getElementById('tituloModalProduto').textContent = 'Novo Produto';
  ['produtoId', 'produtoNome', 'produtoMateriaPrima', 'produtoDescricao', 'produtoPrecoCusto', 'produtoPreco'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('produtoEstoqueMinimo').value = 5;
  abrirModal('modalProduto');
});

function editarProduto(id) {
  const p = cacheProdutos.find(x => x.id_produto === id);
  if (!p) return;
  document.getElementById('tituloModalProduto').textContent = 'Editar Produto';
  document.getElementById('produtoId').value = p.id_produto;
  document.getElementById('produtoNome').value = p.nome;
  document.getElementById('produtoArtesao').value = p.id_artesao;
  document.getElementById('produtoCategoria').value = p.id_categoria;
  document.getElementById('produtoMateriaPrima').value = p.materia_prima || '';
  document.getElementById('produtoDescricao').value = p.descricao || '';
  document.getElementById('produtoPrecoCusto').value = p.preco_custo;
  document.getElementById('produtoPreco').value = p.preco;
  document.getElementById('produtoEstoqueMinimo').value = p.estoque_minimo;
  abrirModal('modalProduto');
}

async function inativarProdutoUi(id) {
  if (!confirmarAcao('Inativar este produto?')) return;
  await window.siscoop.inativarProduto(id);
  toast('Produto inativado.');
  await carregarProdutos();
}

document.getElementById('btnSalvarProduto')?.addEventListener('click', async () => {
  const dados = {
    id_produto: document.getElementById('produtoId').value || null,
    id_artesao: Number(document.getElementById('produtoArtesao').value),
    id_categoria: Number(document.getElementById('produtoCategoria').value),
    nome: document.getElementById('produtoNome').value.trim(),
    materia_prima: document.getElementById('produtoMateriaPrima').value.trim(),
    descricao: document.getElementById('produtoDescricao').value.trim(),
    preco_custo: parseFloat(document.getElementById('produtoPrecoCusto').value) || 0,
    preco: parseFloat(document.getElementById('produtoPreco').value) || 0,
    estoque_minimo: parseInt(document.getElementById('produtoEstoqueMinimo').value) || 0
  };
  if (!dados.nome || !dados.id_artesao || !dados.id_categoria || !dados.preco) return toast('Preencha todos os campos obrigatórios.', 'erro');
  const r = await window.siscoop.salvarProduto(dados);
  if (!r.ok) return toast(r.erro || 'Erro ao salvar produto.', 'erro');
  toast('Produto salvo com sucesso.');
  fecharModal('modalProduto');
  await carregarProdutos();
});

function abrirMovimentacaoEstoque(id) {
  const p = cacheProdutos.find(x => x.id_produto === id);
  if (!p) return;
  document.getElementById('estoqueProdutoId').value = p.id_produto;
  document.getElementById('estoqueProdutoNome').textContent = p.nome;
  document.getElementById('estoqueProdutoAtual').textContent = p.quantidade_atual;
  document.getElementById('estoqueTipo').value = 'ENTRADA';
  document.getElementById('estoqueQuantidade').value = 1;
  document.getElementById('estoqueObservacao').value = '';
  abrirModal('modalEstoque');
}

document.getElementById('btnSalvarEstoque')?.addEventListener('click', async () => {
  const payload = {
    id_produto: Number(document.getElementById('estoqueProdutoId').value),
    tipo: document.getElementById('estoqueTipo').value,
    quantidade: parseInt(document.getElementById('estoqueQuantidade').value),
    observacao: document.getElementById('estoqueObservacao').value.trim()
  };
  if (!payload.quantidade || payload.quantidade <= 0) return toast('Informe uma quantidade válida.', 'erro');
  const r = await window.siscoop.movimentarEstoque(payload);
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Estoque atualizado com sucesso.');
  fecharModal('modalEstoque');
  await carregarProdutos();
  await carregarDashboard();
});

// ==================== PDV ====================
function renderizarPdvProdutos() {
  const busca = (document.getElementById('buscaPdv').value || '').toLowerCase();
  const categoriaFiltro = document.getElementById('filtroCategoriaPdv').value;
  const lista = cacheProdutos.filter(p =>
    p.ativo && p.nome.toLowerCase().includes(busca) &&
    (!categoriaFiltro || String(p.id_categoria) === categoriaFiltro)
  );
  const cont = document.getElementById('listaPdvProdutos');
  cont.innerHTML = lista.length ? lista.map(p => `
    <div class="card pdv-produto-card" onclick="adicionarAoCarrinho(${p.id_produto})">
      <div class="nome">${escaparHtml(p.nome)}</div>
      <div class="cat">${escaparHtml(p.categoria_nome)} • ${escaparHtml(p.artesao_nome)}</div>
      <div class="preco">${formatarMoeda(p.preco)}</div>
      <div class="estoque">${p.quantidade_atual > 0 ? `${p.quantidade_atual} em estoque` : 'Sem estoque'}</div>
    </div>
  `).join('') : '<div class="vazio">Nenhum produto encontrado.</div>';
}
document.getElementById('buscaPdv')?.addEventListener('input', renderizarPdvProdutos);
document.getElementById('filtroCategoriaPdv')?.addEventListener('change', renderizarPdvProdutos);

function adicionarAoCarrinho(idProduto) {
  const p = cacheProdutos.find(x => x.id_produto === idProduto);
  if (!p) return;
  if (p.quantidade_atual <= 0) return toast('Produto sem estoque disponível.', 'erro');
  const itemExistente = carrinho.find(i => i.id_produto === idProduto);
  if (itemExistente) {
    if (itemExistente.quantidade + 1 > p.quantidade_atual) return toast('Quantidade acima do estoque disponível.', 'erro');
    itemExistente.quantidade += 1;
  } else {
    carrinho.push({ id_produto: p.id_produto, nome: p.nome, preco: p.preco, quantidade: 1, estoque_disponivel: p.quantidade_atual });
  }
  renderizarCarrinho();
}

function alterarQuantidadeCarrinho(idProduto, delta) {
  const item = carrinho.find(i => i.id_produto === idProduto);
  if (!item) return;
  const nova = item.quantidade + delta;
  if (nova <= 0) { carrinho = carrinho.filter(i => i.id_produto !== idProduto); }
  else if (nova > item.estoque_disponivel) { return toast('Quantidade acima do estoque disponível.', 'erro'); }
  else { item.quantidade = nova; }
  renderizarCarrinho();
}

function renderizarCarrinho() {
  const cont = document.getElementById('carrinhoLista');
  cont.innerHTML = carrinho.length ? carrinho.map(i => `
    <div class="carrinho-item">
      <div class="info">
        <div class="n">${escaparHtml(i.nome)}</div>
        <div class="p">${formatarMoeda(i.preco)} un.</div>
      </div>
      <div class="qtd-controle">
        <button onclick="alterarQuantidadeCarrinho(${i.id_produto}, -1)">−</button>
        <span>${i.quantidade}</span>
        <button onclick="alterarQuantidadeCarrinho(${i.id_produto}, 1)">+</button>
      </div>
    </div>
  `).join('') : '<div class="vazio">Nenhum item adicionado.</div>';

  const total = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  document.getElementById('carrinhoTotal').textContent = formatarMoeda(total);
}

document.getElementById('btnLimparCarrinho')?.addEventListener('click', () => {
  if (carrinho.length && !confirmarAcao('Limpar todos os itens do carrinho?')) return;
  carrinho = [];
  renderizarCarrinho();
});

document.getElementById('tipoVenda')?.addEventListener('change', (e) => {
  document.getElementById('camposConsignacao').style.display = e.target.value === 'CONSIGNADO' ? 'block' : 'none';
});

document.getElementById('btnFinalizarVenda')?.addEventListener('click', async () => {
  if (!carrinho.length) return toast('Adicione ao menos um item ao carrinho.', 'erro');
  const tipo = document.getElementById('tipoVenda').value;
  const payload = {
    itens: carrinho.map(i => ({ id_produto: i.id_produto, quantidade: i.quantidade, valor_unitario: i.preco })),
    forma_pagamento: document.getElementById('formaPagamento').value,
    tipo
  };
  if (tipo === 'CONSIGNADO') {
    const consignatario = document.getElementById('consignatario').value.trim();
    const dataLimite = document.getElementById('dataLimiteConsignacao').value;
    if (!consignatario || !dataLimite) return toast('Informe o consignatário e a data limite.', 'erro');
    payload.consignacao = { consignatario, data_limite: dataLimite };
  }

  const r = await window.siscoop.registrarVenda(payload);
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Venda registrada com sucesso!');
  mostrarComprovante(r, payload);
  carrinho = [];
  renderizarCarrinho();
  document.getElementById('consignatario').value = '';
  document.getElementById('dataLimiteConsignacao').value = '';
  await carregarProdutos();
  renderizarPdvProdutos();
  await carregarDashboard();
});

let vendaAtualParaPdf = null;

function mostrarComprovante(resultadoVenda, payload) {
  vendaAtualParaPdf = resultadoVenda.id_venda;
  document.getElementById('btnBaixarPdfComprovante').style.display = 'inline-block';
  const itensHtml = payload.itens.map(i => `<tr><td>${escaparHtml(cacheProdutos.find(p=>p.id_produto===i.id_produto)?.nome || '')}</td><td>${i.quantidade}</td><td>${formatarMoeda(i.valor_unitario)}</td><td>${formatarMoeda(i.quantidade*i.valor_unitario)}</td></tr>`).join('');
  document.getElementById('corpoComprovante').innerHTML = `
    <p style="text-align:center; font-weight:800; color:var(--floresta-escura); margin-bottom:2px;">SISCOOP - Cooperativa de Artesanato</p>
    <p style="text-align:center; font-size:12.5px; color:var(--texto-suave); margin-top:0;">Comprovante ${escaparHtml(resultadoVenda.numeroDoc)}</p>
    <table style="margin:14px 0;"><thead><tr><th>Item</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>${itensHtml}</tbody></table>
    <div class="total-linha grande"><span>Total</span><span>${formatarMoeda(resultadoVenda.valor_total)}</span></div>
    <p style="font-size:12.5px; color:var(--texto-suave);">Forma de pagamento: ${payload.forma_pagamento} • Tipo: ${payload.tipo === 'CONSIGNADO' ? 'Consignado' : 'À vista'}</p>
  `;
  abrirModal('modalComprovante');
}

document.getElementById('btnBaixarPdfComprovante')?.addEventListener('click', async (e) => {
  if (!vendaAtualParaPdf) return;
  const botao = e.target;
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Gerando...';
  const r = await window.siscoop.gerarComprovantePdf(vendaAtualParaPdf);
  botao.disabled = false;
  botao.textContent = textoOriginal;
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Comprovante em PDF gerado com sucesso.');
});

// ==================== VENDAS / HISTÓRICO ====================
async function carregarVendas() {
  const inicio = document.getElementById('filtroDataInicioVendas').value;
  const fim = document.getElementById('filtroDataFimVendas').value;
  const filtro = (inicio && fim) ? { dataInicio: inicio, dataFim: fim } : {};
  const vendas = await window.siscoop.historicoVendas(filtro);
  const corpo = document.querySelector('#tabelaVendas tbody');
  corpo.innerHTML = vendas.length ? vendas.map(v => `
    <tr>
      <td>${escaparHtml(v.numero_documento || v.id_venda)}</td>
      <td>${formatarData(v.data_venda)}</td>
      <td>${escaparHtml(v.vendedor_nome)}</td>
      <td>${v.tipo === 'CONSIGNADO' ? 'Consignado' : 'À vista'}</td>
      <td>${escaparHtml(v.forma_pagamento || '-')}</td>
      <td>${formatarMoeda(v.valor_total)}</td>
      <td><span class="chip-status ${v.status === 'CONCLUIDA' ? 'chip-ativo' : 'chip-inativo'}">${v.status === 'CONCLUIDA' ? 'Concluída' : 'Estornada'}</span></td>
      <td class="acoes-linha">
        <button class="btn-secundario" onclick="verItensVenda(${v.id_venda})">Ver Itens</button>
        ${v.status === 'CONCLUIDA' ? `<button class="btn-perigo" onclick="estornarVendaUi(${v.id_venda})">Estornar</button>` : ''}
      </td>
    </tr>
  `).join('') : '<tr><td colspan="8" class="vazio">Nenhuma venda encontrada.</td></tr>';
}
document.getElementById('btnFiltrarVendas')?.addEventListener('click', carregarVendas);

async function verItensVenda(idVenda) {
  vendaAtualParaPdf = idVenda;
  document.getElementById('btnBaixarPdfComprovante').style.display = 'inline-block';
  const itens = await window.siscoop.itensDaVenda(idVenda);
  const itensHtml = itens.map(i => `<tr><td>${escaparHtml(i.produto_nome)}</td><td>${escaparHtml(i.artesao_nome)}</td><td>${i.quantidade}</td><td>${formatarMoeda(i.valor_unitario)}</td><td>${formatarMoeda(i.subtotal)}</td></tr>`).join('');
  document.getElementById('corpoComprovante').innerHTML = `
    <h3 style="margin-top:0;">Itens da Venda #${idVenda}</h3>
    <table><thead><tr><th>Produto</th><th>Artesão</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>${itensHtml}</tbody></table>
  `;
  abrirModal('modalComprovante');
}

async function estornarVendaUi(idVenda) {
  const motivo = window.prompt('Informe o motivo do estorno (registro de auditoria obrigatório):');
  if (motivo === null) return;
  if (!motivo.trim()) return toast('O motivo do estorno é obrigatório.', 'erro');
  const r = await window.siscoop.estornarVenda(idVenda, motivo.trim());
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Venda estornada e estoque reposto.');
  await carregarVendas();
  await carregarProdutos();
  await carregarDashboard();
}

// ==================== REPASSE ====================
document.getElementById('btnCalcularRepasse')?.addEventListener('click', async () => {
  const inicio = document.getElementById('repasseInicio').value;
  const fim = document.getElementById('repasseFim').value;
  if (!inicio || !fim) return toast('Selecione o período.', 'erro');
  const linhas = await window.siscoop.relatorioRepasse({ dataInicio: inicio, dataFim: fim });
  const corpo = document.querySelector('#tabelaRepasse tbody');
  corpo.innerHTML = linhas.length ? linhas.map(l => `
    <tr>
      <td>${escaparHtml(l.artesao_nome)}</td>
      <td>${l.itens_vendidos}</td>
      <td>${formatarMoeda(l.valor_vendido)}</td>
      <td>${formatarMoeda(l.margem_cooperativa)}</td>
      <td><b>${formatarMoeda(l.valor_repasse)}</b></td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="vazio">Nenhuma venda no período selecionado.</td></tr>';
});

// ==================== MATÉRIA-PRIMA / LISTAS DE COMPRA ====================
async function carregarMaterias() {
  cacheMaterias = await window.siscoop.listarMaterias();
  const corpo = document.querySelector('#tabelaMaterias tbody');
  corpo.innerHTML = cacheMaterias.length ? cacheMaterias.map(m => `
    <tr>
      <td>${escaparHtml(m.nome)}</td>
      <td>${escaparHtml(m.unidade_medida)}</td>
      <td>${m.quantidade_disponivel}</td>
      <td class="acoes-linha"><button class="btn-secundario" onclick="editarMateria(${m.id_materia})">Editar</button></td>
    </tr>
  `).join('') : '<tr><td colspan="4" class="vazio">Nenhuma matéria-prima cadastrada.</td></tr>';

  const sel = document.getElementById('itemListaMateria');
  if (sel) sel.innerHTML = cacheMaterias.map(m => `<option value="${m.id_materia}">${escaparHtml(m.nome)} (${escaparHtml(m.unidade_medida)})</option>`).join('');
}

document.getElementById('btnNovaMateria')?.addEventListener('click', () => {
  document.getElementById('tituloModalMateria').textContent = 'Nova Matéria-Prima';
  ['materiaId', 'materiaNome', 'materiaUnidade', 'materiaDescricao'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('materiaQuantidade').value = 0;
  abrirModal('modalMateria');
});

function editarMateria(id) {
  const m = cacheMaterias.find(x => x.id_materia === id);
  if (!m) return;
  document.getElementById('tituloModalMateria').textContent = 'Editar Matéria-Prima';
  document.getElementById('materiaId').value = m.id_materia;
  document.getElementById('materiaNome').value = m.nome;
  document.getElementById('materiaUnidade').value = m.unidade_medida;
  document.getElementById('materiaQuantidade').value = m.quantidade_disponivel;
  document.getElementById('materiaDescricao').value = m.descricao || '';
  abrirModal('modalMateria');
}

document.getElementById('btnSalvarMateria')?.addEventListener('click', async () => {
  const dados = {
    id_materia: document.getElementById('materiaId').value || null,
    nome: document.getElementById('materiaNome').value.trim(),
    unidade_medida: document.getElementById('materiaUnidade').value.trim(),
    quantidade_disponivel: parseFloat(document.getElementById('materiaQuantidade').value) || 0,
    descricao: document.getElementById('materiaDescricao').value.trim()
  };
  if (!dados.nome || !dados.unidade_medida) return toast('Preencha nome e unidade de medida.', 'erro');
  await window.siscoop.salvarMateria(dados);
  toast('Matéria-prima salva com sucesso.');
  fecharModal('modalMateria');
  await carregarMaterias();
});

let listaAtualId = null;
async function carregarListas() {
  const listas = await window.siscoop.listarListas();
  const corpo = document.querySelector('#tabelaListas tbody');
  corpo.innerHTML = listas.length ? listas.map(l => `
    <tr>
      <td>${l.id_lista}</td>
      <td>${escaparHtml(l.usuario_nome)}</td>
      <td>${formatarData(l.data_criacao)}</td>
      <td>
        <select onchange="atualizarStatusListaUi(${l.id_lista}, this.value)">
          ${['ABERTA','EM_ANDAMENTO','CONCLUIDA','CANCELADA'].map(s => `<option value="${s}" ${s===l.status?'selected':''}>${s.replace('_',' ')}</option>`).join('')}
        </select>
      </td>
      <td class="acoes-linha"><button class="btn-secundario" onclick="abrirItensLista(${l.id_lista})">Itens</button></td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="vazio">Nenhuma lista de compra criada ainda.</td></tr>';
}

document.getElementById('btnNovaLista')?.addEventListener('click', async () => {
  await window.siscoop.criarLista();
  toast('Nova lista de compras criada.');
  await carregarListas();
});

async function atualizarStatusListaUi(id, status) {
  await window.siscoop.statusLista(id, status);
  toast('Status da lista atualizado.');
}

async function abrirItensLista(idLista) {
  listaAtualId = idLista;
  document.getElementById('listaNumero').textContent = idLista;
  await renderizarItensLista();
  abrirModal('modalItensLista');
}

async function renderizarItensLista() {
  const itens = await window.siscoop.itensDaLista(listaAtualId);
  const corpo = document.querySelector('#tabelaItensLista tbody');
  corpo.innerHTML = itens.length ? itens.map(i => `
    <tr><td>${escaparHtml(i.materia_nome)}</td><td>${i.quantidade_desejada}</td><td>${escaparHtml(i.unidade_medida)}</td></tr>
  `).join('') : '<tr><td colspan="3" class="vazio">Nenhum item adicionado.</td></tr>';
}

document.getElementById('btnAddItemLista')?.addEventListener('click', async () => {
  const idMateria = Number(document.getElementById('itemListaMateria').value);
  const quantidade = parseFloat(document.getElementById('itemListaQuantidade').value);
  if (!idMateria || !quantidade || quantidade <= 0) return toast('Selecione a matéria-prima e informe uma quantidade válida.', 'erro');
  await window.siscoop.addItemLista({ id_lista: listaAtualId, id_materia: idMateria, quantidade });
  document.getElementById('itemListaQuantidade').value = '';
  await renderizarItensLista();
});

// ==================== USUÁRIOS ====================
async function carregarUsuarios() {
  const usuarios = await window.siscoop.listarUsuarios();
  const corpo = document.querySelector('#tabelaUsuarios tbody');
  corpo.innerHTML = usuarios.length ? usuarios.map(u => `
    <tr>
      <td>${escaparHtml(u.nome)}</td>
      <td>${escaparHtml(u.login)}</td>
      <td>${u.nivel_acesso === 'ADMINISTRADOR' ? 'Administrador' : 'Operador'}</td>
      <td><span class="chip-status ${u.ativo ? 'chip-ativo' : 'chip-inativo'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>${formatarData(u.criado_em)}</td>
      <td class="acoes-linha">
        <button class="btn-secundario" onclick="redefinirSenhaUsuarioUi(${u.id_usuario})">Redefinir Senha</button>
        <button class="${u.ativo ? 'btn-perigo' : 'btn-secundario'}" onclick="alternarStatusUsuario(${u.id_usuario}, ${u.ativo ? 0 : 1})">${u.ativo ? 'Desativar' : 'Ativar'}</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="vazio">Nenhum usuário cadastrado.</td></tr>';
}

document.getElementById('btnNovoUsuario')?.addEventListener('click', () => {
  ['usuarioNome', 'usuarioLogin', 'usuarioSenha'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('usuarioNivel').value = 'VENDEDOR';
  abrirModal('modalUsuario');
});

document.getElementById('btnSalvarUsuario')?.addEventListener('click', async () => {
  const dados = {
    nome: document.getElementById('usuarioNome').value.trim(),
    login: document.getElementById('usuarioLogin').value.trim(),
    senha: document.getElementById('usuarioSenha').value,
    nivel_acesso: document.getElementById('usuarioNivel').value
  };
  if (!dados.nome || !dados.login || !dados.senha) return toast('Preencha todos os campos.', 'erro');
  if (dados.senha.length < 6) return toast('A senha deve ter ao menos 6 caracteres.', 'erro');
  const r = await window.siscoop.criarUsuario(dados);
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Usuário criado com sucesso.');
  fecharModal('modalUsuario');
  await carregarUsuarios();
});

async function alternarStatusUsuario(id, ativo) {
  if (usuarioAtual.id_usuario === id) return toast('Você não pode desativar seu próprio usuário.', 'erro');
  await window.siscoop.statusUsuario(id, ativo);
  toast('Status do usuário atualizado.');
  await carregarUsuarios();
}

async function redefinirSenhaUsuarioUi(id) {
  const novaSenha = window.prompt('Digite a nova senha para este usuário (mínimo 6 caracteres):');
  if (novaSenha === null) return;
  const r = await window.siscoop.redefinirSenhaUsuario(id, novaSenha);
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Senha redefinida com sucesso.');
}

// ==================== AUDITORIA ====================
async function carregarAuditoria() {
  const registros = await window.siscoop.listarAuditoria();
  const corpo = document.querySelector('#tabelaAuditoria tbody');
  corpo.innerHTML = registros.length ? registros.map(m => `
    <tr>
      <td>${formatarData(m.data_movimentacao)}</td>
      <td>${escaparHtml(m.produto_nome)}</td>
      <td><span class="chip-status ${m.tipo_movimentacao === 'ESTORNO' ? 'chip-inativo' : 'chip-ativo'}">${m.tipo_movimentacao}</span></td>
      <td>${m.quantidade}</td>
      <td>${escaparHtml(m.usuario_nome)}</td>
      <td>${escaparHtml(m.observacao || '-')}</td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="vazio">Nenhuma movimentação registrada.</td></tr>';
}

// ==================== BACKUP ====================
document.getElementById('btnExportarBackup')?.addEventListener('click', async () => {
  const r = await window.siscoop.exportarBackup();
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Backup exportado com sucesso: ' + r.destino);
});

document.getElementById('btnRestaurarBackup')?.addEventListener('click', async () => {
  if (!confirmarAcao('Isso substituirá TODOS os dados atuais pelos dados do arquivo selecionado. O sistema será reiniciado. Deseja continuar?')) return;
  const r = await window.siscoop.restaurarBackup();
  if (r && !r.ok) toast(r.erro, 'erro');
});

// ==================== PERFIL ====================
document.getElementById('btnAlterarSenha')?.addEventListener('click', async () => {
  const senhaAtual = document.getElementById('senhaAtual').value;
  const novaSenha = document.getElementById('novaSenha').value;
  const confirmaSenha = document.getElementById('confirmaSenha').value;
  if (!senhaAtual || !novaSenha || !confirmaSenha) return toast('Preencha todos os campos.', 'erro');
  if (novaSenha !== confirmaSenha) return toast('A confirmação de senha não corresponde.', 'erro');
  const r = await window.siscoop.alterarSenha(senhaAtual, novaSenha);
  if (!r.ok) return toast(r.erro, 'erro');
  toast('Senha alterada com sucesso.');
  ['senhaAtual', 'novaSenha', 'confirmaSenha'].forEach(id => document.getElementById(id).value = '');
});

// ==================== EVENTOS GERAIS ====================
function registrarEventos() {
  // recarrega a lista de produtos usados no PDV sempre que a aba for aberta
}
