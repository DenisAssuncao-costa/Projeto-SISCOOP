// ==================== ESTADO GLOBAL ====================
let usuarioAtual = null;
let cacheProdutos = [];
let cacheCategorias = [];
let carrinho = [];

const mapaNav = {};

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

  await carregarCategorias();
  await carregarProdutos();
  renderizarPdvProdutos();
});

function preencherCabecalhoUsuario() {
  document.getElementById('chipNome').textContent = usuarioAtual.nome;
  document.getElementById('chipAvatar').textContent = iniciaisNome(usuarioAtual.nome);
  document.getElementById('perfilAvatar').textContent = iniciaisNome(usuarioAtual.nome);
  document.getElementById('perfilNome').textContent = usuarioAtual.nome;
  document.getElementById('perfilLogin').textContent = '@' + usuarioAtual.login;
}

const titulosSecao = {
  'secao-pdv': 'Ponto de Venda', 'secao-minhasvendas': 'Minhas Vendas',
  'secao-estoque': 'Consulta de Estoque', 'secao-perfil': 'Meu Perfil'
};

function navegarPara(idSecao) {
  trocarSecao(idSecao, mapaNav);
  document.getElementById('tituloTopbar').textContent = titulosSecao[idSecao] || '';
  if (idSecao === 'secao-pdv') { carregarProdutos().then(renderizarPdvProdutos); }
  if (idSecao === 'secao-minhasvendas') carregarMinhasVendas();
  if (idSecao === 'secao-estoque') carregarProdutos().then(renderizarEstoqueConsulta);
}

// ==================== CATEGORIAS / PRODUTOS ====================
async function carregarCategorias() {
  cacheCategorias = await window.siscoop.listarCategorias();
  const sel = document.getElementById('filtroCategoriaPdv');
  sel.innerHTML = '<option value="">Todas as categorias</option>' +
    cacheCategorias.map(c => `<option value="${c.id_categoria}">${escaparHtml(c.nome)}</option>`).join('');
}

async function carregarProdutos() {
  cacheProdutos = await window.siscoop.listarProdutos(false);
}

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

// ==================== MINHAS VENDAS ====================
async function carregarMinhasVendas() {
  const inicio = document.getElementById('filtroDataInicioVendas').value;
  const fim = document.getElementById('filtroDataFimVendas').value;
  const filtro = (inicio && fim) ? { dataInicio: inicio, dataFim: fim } : {};
  const todasVendas = await window.siscoop.historicoVendas(filtro);
  const minhas = todasVendas.filter(v => v.id_usuario === usuarioAtual.id_usuario);
  const corpo = document.querySelector('#tabelaVendas tbody');
  corpo.innerHTML = minhas.length ? minhas.map(v => `
    <tr>
      <td>${escaparHtml(v.numero_documento || v.id_venda)}</td>
      <td>${formatarData(v.data_venda)}</td>
      <td>${v.tipo === 'CONSIGNADO' ? 'Consignado' : 'À vista'}</td>
      <td>${escaparHtml(v.forma_pagamento || '-')}</td>
      <td>${formatarMoeda(v.valor_total)}</td>
      <td><span class="chip-status ${v.status === 'CONCLUIDA' ? 'chip-ativo' : 'chip-inativo'}">${v.status === 'CONCLUIDA' ? 'Concluída' : 'Estornada'}</span></td>
      <td class="acoes-linha"><button class="btn-secundario" onclick="verItensVenda(${v.id_venda})">Ver Itens</button></td>
    </tr>
  `).join('') : '<tr><td colspan="7" class="vazio">Nenhuma venda encontrada.</td></tr>';
}
document.getElementById('btnFiltrarVendas')?.addEventListener('click', carregarMinhasVendas);

async function verItensVenda(idVenda) {
  vendaAtualParaPdf = idVenda;
  document.getElementById('btnBaixarPdfComprovante').style.display = 'inline-block';
  const itens = await window.siscoop.itensDaVenda(idVenda);
  const itensHtml = itens.map(i => `<tr><td>${escaparHtml(i.produto_nome)}</td><td>${i.quantidade}</td><td>${formatarMoeda(i.valor_unitario)}</td><td>${formatarMoeda(i.subtotal)}</td></tr>`).join('');
  document.getElementById('corpoComprovante').innerHTML = `
    <h3 style="margin-top:0;">Itens da Venda #${idVenda}</h3>
    <table><thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>${itensHtml}</tbody></table>
  `;
  abrirModal('modalComprovante');
}

// ==================== CONSULTA DE ESTOQUE (SOMENTE LEITURA) ====================
function renderizarEstoqueConsulta() {
  const busca = (document.getElementById('buscaEstoque').value || '').toLowerCase();
  const lista = cacheProdutos.filter(p => p.ativo && p.nome.toLowerCase().includes(busca));
  const corpo = document.querySelector('#tabelaEstoque tbody');
  corpo.innerHTML = lista.length ? lista.map(p => {
    const critico = p.quantidade_atual <= p.estoque_minimo;
    return `
    <tr>
      <td>${escaparHtml(p.nome)}</td>
      <td>${escaparHtml(p.categoria_nome)}</td>
      <td>${formatarMoeda(p.preco)}</td>
      <td>${p.quantidade_atual}</td>
      <td><span class="chip-status ${critico ? 'chip-inativo' : 'chip-ativo'}" style="${critico ? 'background:#fbe9dc;color:#b5651d;' : ''}">${critico ? 'Repor estoque' : 'Normal'}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="vazio">Nenhum produto encontrado.</td></tr>';
}
document.getElementById('buscaEstoque')?.addEventListener('input', renderizarEstoqueConsulta);

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
