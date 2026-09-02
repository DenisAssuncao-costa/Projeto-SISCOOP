const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siscoop', {
  // autenticacao
  login: (login, senha) => ipcRenderer.invoke('auth:login', { login, senha }),
  usuarioAtual: () => ipcRenderer.invoke('auth:usuarioAtual'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  alterarSenha: (senhaAtual, novaSenha) => ipcRenderer.invoke('auth:alterarSenha', { senhaAtual, novaSenha }),

  // usuarios (admin)
  listarUsuarios: () => ipcRenderer.invoke('usuarios:listar'),
  criarUsuario: (dados) => ipcRenderer.invoke('usuarios:criar', dados),
  statusUsuario: (id, ativo) => ipcRenderer.invoke('usuarios:status', { id, ativo }),
  redefinirSenhaUsuario: (id, novaSenha) => ipcRenderer.invoke('usuarios:redefinirSenha', { id, novaSenha }),

  // artesaos
  listarArtesoes: (incluirInativos) => ipcRenderer.invoke('artesoes:listar', incluirInativos),
  salvarArtesao: (dados) => ipcRenderer.invoke('artesoes:salvar', dados),
  inativarArtesao: (id) => ipcRenderer.invoke('artesoes:inativar', id),

  // categorias
  listarCategorias: () => ipcRenderer.invoke('categorias:listar'),
  salvarCategoria: (dados) => ipcRenderer.invoke('categorias:salvar', dados),

  // produtos / estoque
  listarProdutos: (incluirInativos) => ipcRenderer.invoke('produtos:listar', incluirInativos),
  salvarProduto: (dados) => ipcRenderer.invoke('produtos:salvar', dados),
  inativarProduto: (id) => ipcRenderer.invoke('produtos:inativar', id),
  produtosCriticos: () => ipcRenderer.invoke('produtos:criticos'),
  movimentarEstoque: (payload) => ipcRenderer.invoke('estoque:movimentar', payload),
  historicoEstoque: (id_produto) => ipcRenderer.invoke('estoque:historico', id_produto),

  // vendas / pdv
  registrarVenda: (payload) => ipcRenderer.invoke('vendas:registrar', payload),
  estornarVenda: (id_venda, motivo) => ipcRenderer.invoke('vendas:estornar', { id_venda, motivo }),
  historicoVendas: (filtro) => ipcRenderer.invoke('vendas:historico', filtro),
  itensDaVenda: (id_venda) => ipcRenderer.invoke('vendas:itens', id_venda),
  relatorioRepasse: (filtro) => ipcRenderer.invoke('vendas:repasse', filtro),
  gerarComprovantePdf: (id_venda) => ipcRenderer.invoke('vendas:comprovantePdf', id_venda),

  // dashboard
  dashboardResumo: () => ipcRenderer.invoke('dashboard:resumo'),
  dashboardVendasPorDia: (dias) => ipcRenderer.invoke('dashboard:vendasPorDia', dias),
  dashboardVendasPorCategoria: () => ipcRenderer.invoke('dashboard:vendasPorCategoria'),

  // materia prima / listas de compra
  listarMaterias: () => ipcRenderer.invoke('materias:listar'),
  salvarMateria: (dados) => ipcRenderer.invoke('materias:salvar', dados),
  listarListas: () => ipcRenderer.invoke('listas:listar'),
  criarLista: () => ipcRenderer.invoke('listas:criar'),
  addItemLista: (payload) => ipcRenderer.invoke('listas:addItem', payload),
  itensDaLista: (id_lista) => ipcRenderer.invoke('listas:itens', id_lista),
  statusLista: (id_lista, status) => ipcRenderer.invoke('listas:status', { id_lista, status }),

  // backup
  exportarBackup: () => ipcRenderer.invoke('backup:exportar'),
  restaurarBackup: () => ipcRenderer.invoke('backup:restaurar'),

  // auditoria
  listarAuditoria: () => ipcRenderer.invoke('auditoria:listar')
});
