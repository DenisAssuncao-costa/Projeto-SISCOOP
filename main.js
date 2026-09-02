const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./src/db/database');
const { gerarComprovantePdf } = require('./src/pdf/comprovante');

let win;
let usuarioLogado = null; // guardado apenas em memoria do processo principal

function criarJanela() {
  win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1b3a2b',
    autoHideMenuBar: true
  });
  win.setMenuBarVisibility(false);
  win.maximize();
  win.show();
  win.loadFile(path.join(__dirname, 'src/renderer/login.html'));
  return win;
}

app.whenReady().then(() => {
  db.iniciar(app.getPath('userData'));
  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------- IPC: AUTENTICACAO ----------------
ipcMain.handle('auth:login', (e, { login, senha }) => {
  const resultado = db.autenticar(login, senha);
  if (resultado.ok) {
    usuarioLogado = resultado.usuario;
    const destino = usuarioLogado.nivel_acesso === 'ADMINISTRADOR'
      ? 'src/renderer/admin/admin.html'
      : 'src/renderer/vendedor/vendedor.html';
    win.loadFile(path.join(__dirname, destino));
  }
  return resultado;
});

ipcMain.handle('auth:usuarioAtual', () => usuarioLogado);

ipcMain.handle('auth:logout', () => {
  usuarioLogado = null;
  win.loadFile(path.join(__dirname, 'src/renderer/login.html'));
  return { ok: true };
});

ipcMain.handle('auth:alterarSenha', (e, { senhaAtual, novaSenha }) => {
  if (!usuarioLogado) return { ok: false, erro: 'Sessao invalida.' };
  return db.alterarSenha(usuarioLogado.id_usuario, senhaAtual, novaSenha);
});

// ---------------- IPC: USUARIOS (admin) ----------------
ipcMain.handle('usuarios:listar', () => db.listarUsuarios());
ipcMain.handle('usuarios:criar', (e, dados) => db.criarUsuario(dados));
ipcMain.handle('usuarios:status', (e, { id, ativo }) => db.definirStatusUsuario(id, ativo));
ipcMain.handle('usuarios:redefinirSenha', (e, { id, novaSenha }) => db.redefinirSenhaAdmin(id, novaSenha));

// ---------------- IPC: ARTESAOS ----------------
ipcMain.handle('artesoes:listar', (e, incluirInativos) => db.listarArtesoes(incluirInativos));
ipcMain.handle('artesoes:salvar', (e, dados) => db.salvarArtesao(dados));
ipcMain.handle('artesoes:inativar', (e, id) => db.inativarArtesao(id));

// ---------------- IPC: CATEGORIAS ----------------
ipcMain.handle('categorias:listar', () => db.listarCategorias());
ipcMain.handle('categorias:salvar', (e, dados) => db.salvarCategoria(dados));

// ---------------- IPC: PRODUTOS / ESTOQUE ----------------
ipcMain.handle('produtos:listar', (e, incluirInativos) => db.listarProdutos(incluirInativos));
ipcMain.handle('produtos:salvar', (e, dados) => db.salvarProduto(dados));
ipcMain.handle('produtos:inativar', (e, id) => db.inativarProduto(id));
ipcMain.handle('produtos:criticos', () => db.produtosEstoqueCritico());
ipcMain.handle('estoque:movimentar', (e, { id_produto, tipo, quantidade, observacao }) => {
  if (!usuarioLogado) return { ok: false, erro: 'Sessao invalida.' };
  return db.movimentarEstoque(id_produto, usuarioLogado.id_usuario, tipo, quantidade, observacao);
});
ipcMain.handle('estoque:historico', (e, id_produto) => db.historicoMovimentacoes(id_produto));

// ---------------- IPC: VENDAS / PDV ----------------
ipcMain.handle('vendas:registrar', (e, payload) => {
  if (!usuarioLogado) return { ok: false, erro: 'Sessao invalida.' };
  return db.registrarVenda({ ...payload, id_usuario: usuarioLogado.id_usuario });
});
ipcMain.handle('vendas:estornar', (e, { id_venda, motivo }) => {
  if (!usuarioLogado) return { ok: false, erro: 'Sessao invalida.' };
  return db.estornarVenda(id_venda, usuarioLogado.id_usuario, motivo);
});
ipcMain.handle('vendas:historico', (e, filtro) => db.historicoVendas(filtro));
ipcMain.handle('vendas:itens', (e, id_venda) => db.itensDaVenda(id_venda));
ipcMain.handle('vendas:repasse', (e, filtro) => db.relatorioRepasse(filtro));

ipcMain.handle('vendas:comprovantePdf', async (e, id_venda) => {
  if (!usuarioLogado) return { ok: false, erro: 'Sessao invalida.' };
  const venda = db.obterVendaCompleta(id_venda);
  if (!venda) return { ok: false, erro: 'Venda nao encontrada.' };

  const nomeSugerido = `${venda.numero_documento || 'comprovante-' + id_venda}.pdf`;
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Salvar comprovante em PDF',
    defaultPath: nomeSugerido,
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false, erro: 'Operacao cancelada.' };

  try {
    await gerarComprovantePdf(venda, filePath);
    shell.openPath(filePath); // abre o PDF gerado no leitor padrao do sistema
    return { ok: true, destino: filePath };
  } catch (err) {
    return { ok: false, erro: 'Erro ao gerar PDF: ' + err.message };
  }
});

// ---------------- IPC: DASHBOARD ----------------
ipcMain.handle('dashboard:resumo', () => db.dashboardResumo());
ipcMain.handle('dashboard:vendasPorDia', (e, dias) => db.dashboardVendasPorDia(dias));
ipcMain.handle('dashboard:vendasPorCategoria', () => db.dashboardVendasPorCategoria());

// ---------------- IPC: MATERIA PRIMA / LISTA DE COMPRAS ----------------
ipcMain.handle('materias:listar', () => db.listarMateriasPrimas());
ipcMain.handle('materias:salvar', (e, dados) => db.salvarMateriaPrima(dados));
ipcMain.handle('listas:listar', () => db.listarListasCompra());
ipcMain.handle('listas:criar', () => {
  if (!usuarioLogado) return { ok: false, erro: 'Sessao invalida.' };
  return db.criarListaCompra(usuarioLogado.id_usuario);
});
ipcMain.handle('listas:addItem', (e, { id_lista, id_materia, quantidade }) => db.adicionarItemLista(id_lista, id_materia, quantidade));
ipcMain.handle('listas:itens', (e, id_lista) => db.itensDaLista(id_lista));
ipcMain.handle('listas:status', (e, { id_lista, status }) => db.atualizarStatusLista(id_lista, status));

// ---------------- IPC: BACKUP ----------------
ipcMain.handle('backup:exportar', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Salvar copia de seguranca do SISCOOP',
    defaultPath: `siscoop-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: 'Banco de Dados SQLite', extensions: ['db'] }]
  });
  if (canceled || !filePath) return { ok: false, erro: 'Operacao cancelada.' };
  try {
    await db.backup(filePath);
    return { ok: true, destino: filePath };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
});

ipcMain.handle('backup:restaurar', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Selecionar copia de seguranca (.db) para restaurar',
    filters: [{ name: 'Banco de Dados SQLite', extensions: ['db'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || !filePaths[0]) return { ok: false, erro: 'Operacao cancelada.' };
  try {
    const destino = db.caminhoBanco();
    db.fecharConexao();
    fs.copyFileSync(filePaths[0], destino);
    // reabre a aplicacao para carregar o banco restaurado com uma conexao limpa
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
});

// ---------------- IPC: AUDITORIA ----------------
ipcMain.handle('auditoria:listar', () => db.auditoriaGeral());
