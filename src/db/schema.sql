-- ============================================================
-- SISCOOP - BANCO DE DADOS - COOPERATIVA DE ARTESANATO RIBEIRINHO
-- DIALETO: SQLite
-- Baseado no MER do Relatorio Tecnico 2026
-- ============================================================
PRAGMA foreign_keys = ON;

-- 1. USUARIO (login, senha com hash+salt, nivel de acesso)
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    senha_salt TEXT NOT NULL,
    nivel_acesso TEXT NOT NULL CHECK (nivel_acesso IN ('ADMINISTRADOR', 'VENDEDOR')),
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (DATETIME('now','localtime'))
);

-- 2. ARTESAO
CREATE TABLE IF NOT EXISTS artesao (
    id_artesao INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_identificacao TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    contato TEXT,
    ativo INTEGER NOT NULL DEFAULT 1
);

-- 3. CATEGORIA
CREATE TABLE IF NOT EXISTS categoria (
    id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT
);

-- 4. PRODUTO
CREATE TABLE IF NOT EXISTS produto (
    id_produto INTEGER PRIMARY KEY AUTOINCREMENT,
    id_artesao INTEGER NOT NULL,
    id_categoria INTEGER NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    materia_prima TEXT,
    preco_custo REAL NOT NULL DEFAULT 0 CHECK (preco_custo >= 0),
    preco REAL NOT NULL CHECK (preco >= 0),
    estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    ativo INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_produto_artesao FOREIGN KEY (id_artesao) REFERENCES artesao(id_artesao),
    CONSTRAINT fk_produto_categoria FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);

-- 5. ESTOQUE
CREATE TABLE IF NOT EXISTS estoque (
    id_estoque INTEGER PRIMARY KEY AUTOINCREMENT,
    id_produto INTEGER NOT NULL UNIQUE,
    quantidade_atual INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
    CONSTRAINT fk_estoque_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto) ON DELETE CASCADE
);

-- 6. VENDA
CREATE TABLE IF NOT EXISTS venda (
    id_venda INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    data_venda TEXT NOT NULL DEFAULT (DATETIME('now','localtime')),
    valor_total REAL NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
    tipo TEXT NOT NULL DEFAULT 'A_VISTA' CHECK (tipo IN ('A_VISTA','CONSIGNADO')),
    status TEXT NOT NULL DEFAULT 'CONCLUIDA' CHECK (status IN ('CONCLUIDA','ESTORNADA')),
    id_consignatario TEXT,
    data_limite_consignacao TEXT,
    CONSTRAINT fk_venda_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- 7. ITEM_VENDA
CREATE TABLE IF NOT EXISTS item_venda (
    id_item_venda INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venda INTEGER NOT NULL,
    id_produto INTEGER NOT NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    valor_unitario REAL NOT NULL CHECK (valor_unitario >= 0),
    valor_repasse_unit REAL NOT NULL DEFAULT 0 CHECK (valor_repasse_unit >= 0),
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    CONSTRAINT fk_item_venda_venda FOREIGN KEY (id_venda) REFERENCES venda(id_venda) ON DELETE CASCADE,
    CONSTRAINT fk_item_venda_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);

-- 8. PAGAMENTO
CREATE TABLE IF NOT EXISTS pagamento (
    id_pagamento INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venda INTEGER NOT NULL UNIQUE,
    forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('DINHEIRO','PIX','DEBITO','CREDITO')),
    dados_transacao TEXT,
    valor REAL NOT NULL CHECK (valor >= 0),
    CONSTRAINT fk_pagamento_venda FOREIGN KEY (id_venda) REFERENCES venda(id_venda) ON DELETE CASCADE
);

-- 9. DOCUMENTO_FISCAL (comprovante interno)
CREATE TABLE IF NOT EXISTS documento_fiscal (
    id_documento INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venda INTEGER NOT NULL UNIQUE,
    numero_documento TEXT NOT NULL,
    tipo_documento TEXT NOT NULL DEFAULT 'COMPROVANTE_INTERNO',
    data_emissao TEXT NOT NULL DEFAULT (DATETIME('now','localtime')),
    chave_acesso TEXT,
    CONSTRAINT fk_documento_venda FOREIGN KEY (id_venda) REFERENCES venda(id_venda) ON DELETE CASCADE
);

-- 10. MOVIMENTACAO_ESTOQUE (log de auditoria - entradas, saidas, vendas, ajustes, estornos)
CREATE TABLE IF NOT EXISTS movimentacao_estoque (
    id_movimentacao INTEGER PRIMARY KEY AUTOINCREMENT,
    id_produto INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,
    tipo_movimentacao TEXT NOT NULL CHECK (tipo_movimentacao IN ('ENTRADA','SAIDA','VENDA','AJUSTE','ESTORNO')),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    data_movimentacao TEXT NOT NULL DEFAULT (DATETIME('now','localtime')),
    observacao TEXT,
    CONSTRAINT fk_movimentacao_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto),
    CONSTRAINT fk_movimentacao_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- 11. MATERIA_PRIMA
CREATE TABLE IF NOT EXISTS materia_prima (
    id_materia INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    unidade_medida TEXT NOT NULL,
    quantidade_disponivel REAL NOT NULL DEFAULT 0 CHECK (quantidade_disponivel >= 0)
);

-- 12. LISTA_COMPRA
CREATE TABLE IF NOT EXISTS lista_compra (
    id_lista INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    data_criacao TEXT NOT NULL DEFAULT (DATETIME('now','localtime')),
    status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),
    CONSTRAINT fk_lista_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- 13. ITEM_LISTA_COMPRA
CREATE TABLE IF NOT EXISTS item_lista_compra (
    id_item_lista INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista INTEGER NOT NULL,
    id_materia INTEGER NOT NULL,
    quantidade_desejada REAL NOT NULL CHECK (quantidade_desejada > 0),
    CONSTRAINT fk_item_lista_lista FOREIGN KEY (id_lista) REFERENCES lista_compra(id_lista) ON DELETE CASCADE,
    CONSTRAINT fk_item_lista_materia FOREIGN KEY (id_materia) REFERENCES materia_prima(id_materia)
);

CREATE INDEX IF NOT EXISTS idx_produto_artesao ON produto(id_artesao);
CREATE INDEX IF NOT EXISTS idx_venda_data ON venda(data_venda);
CREATE INDEX IF NOT EXISTS idx_movimentacao_produto ON movimentacao_estoque(id_produto);
