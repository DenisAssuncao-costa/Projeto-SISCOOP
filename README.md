# SISCOOP
### Sistema de Gestão de Estoque e Venda para Cooperativa de Artesanato Ribeirinho

Aplicativo **desktop**, feito com **Electron + Node.js + SQLite (better-sqlite3)**,
desenvolvido com base no Relatório Técnico da Prática Profissional Supervisionada
(CETAM – Escola de Educação Profissional Galileia).

---

## ✅ O que foi implementado

- **100% offline** — banco de dados SQLite embarcado em um único arquivo local, sem
  necessidade de internet ou servidor externo.
- **Janela maximizada automaticamente**, ocupando toda a área útil da tela do desktop.
- **Login com dois perfis de acesso**:
  - **Administrador** — acesso total (cadastros, PDV, estoque, usuários, relatórios de
    repasse, auditoria, backup/restauração).
  - **Operador/Vendedor** — acesso restrito ao Ponto de Venda, consulta de estoque
    (somente leitura), histórico das próprias vendas e ao próprio perfil.
- **Login do administrador gravado no código-fonte** (`src/db/database.js`), criado
  automaticamente na primeira execução. A senha pode (e deve) ser alterada pelo próprio
  administrador em **Meu Perfil**, a qualquer momento.
- **Paleta de cores** inspirada na floresta amazônica (verdes) e no artesanato/barro
  regional (terracota, dourado, fibra), com tons pensados para contraste e legibilidade
  (`src/renderer/shared/theme.css`).
- **Banco de dados** fiel ao MER do relatório (13 tabelas + tabela de usuários com
  senha criptografada), com índices e integridade referencial (`src/db/schema.sql`).
- Regras de negócio do relatório implementadas e testadas:
  - **RNG/SEG 01** — bloqueio de estoque negativo.
  - **RNG/SEG 02** e **RNG/DES 05** — cálculo automático do repasse ao artesão e da
    margem da cooperativa.
  - **RNG/USA 03/04** — baixa automática de estoque na venda; consignação exige
    consignatário e data limite.
  - **RNG/DES 06** — vendas concluídas não podem ser editadas, apenas estornadas, com
    motivo obrigatório e log de auditoria.
  - **RNG/CUS 07** — bloqueio de CPF/código de identificação duplicado de artesão.
  - **RF01–RF08 / RNF01–RNF06** — cadastros, PDV, alertas de estoque mínimo,
    histórico de vendas, comprovante interno, backup e restauração.
- **Comprovante de venda em PDF (RF08)** — gerado 100% localmente (sem internet),
  com dados da venda, itens, total e informações de consignação quando aplicável.
  Disponível no botão "Baixar em PDF" ao finalizar uma venda ou ao consultar o
  histórico de vendas.
- **Gráficos no Painel (Dashboard)** — vendas dos últimos 7 dias (barras) e vendas
  por categoria no mês atual (rosca/donut), desenhados com Canvas nativo do
  navegador — sem nenhuma biblioteca externa, mantendo o app 100% offline.

## 🔐 Acesso padrão do Administrador

```
Login: admin
Senha: siscoop@2026
```
Altere a senha assim que possível em **Meu Perfil**.

## ▶️ Como executar

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão 18 ou superior).

```bash
npm install
npm run rebuild   # recompila o better-sqlite3 para a versão nativa do Electron (rodar 1x após o install)
npm start
```

> **Por que o passo `npm run rebuild` é necessário?** O SQLite é um módulo nativo
> (compilado em C). Ele precisa ser recompilado especificamente para a versão do
> Electron usada pelo projeto — isso é padrão em qualquer app Electron que usa
> `better-sqlite3`, e foi testado neste ambiente antes da entrega.

O aplicativo abre direto na tela de login, já maximizado.

## 📄 Comprovante em PDF

Ao finalizar uma venda no PDV (ou ao consultar uma venda antiga em **Vendas &
Consignações** / **Minhas Vendas**), clique em **⬇️ Baixar em PDF** no comprovante.
Você escolhe onde salvar, e o PDF abre automaticamente no leitor padrão do
computador. Funciona sem internet.

## 📊 Gráficos do Painel

O Painel (Dashboard) do Administrador agora traz:
- **Vendas nos últimos 7 dias** (gráfico de barras)
- **Vendas por categoria no mês atual** (gráfico de rosca com legenda e percentuais)

## 💾 Backup e Restauração

Em **Backup & Restauração** (menu do Administrador):
- **Exportar Backup** salva um arquivo `.db` onde você quiser (pendrive, HD externo).
- **Restaurar Backup** substitui os dados atuais pelos de um arquivo `.db`
  selecionado e reinicia o aplicativo automaticamente.

## 📁 Estrutura do projeto

```
siscoop/
├── main.js                 # processo principal do Electron (janela, IPC)
├── preload.js               # ponte segura entre a interface e o banco de dados
├── package.json
└── src/
    ├── db/
    │   ├── schema.sql        # estrutura do banco (MER do relatório)
    │   ├── database.js       # toda a lógica de negócio e consultas SQL
    │   └── hash.js           # hash de senha (scrypt + salt)
    ├── pdf/
    │   └── comprovante.js     # geração do comprovante de venda em PDF (pdfkit)
    └── renderer/
        ├── login.html         # tela de autenticação
        ├── shared/            # tema visual, layout, gráficos e utilitários de UI
        ├── admin/             # painel completo do Administrador
        └── vendedor/          # painel do Operador (PDV, estoque, perfil)
```

## 🖥️ Empacotar como instalador (.exe/.AppImage) — opcional

Para distribuir o SISCOOP como um instalador de verdade (sem precisar do Node.js
instalado no computador de destino), é possível usar o `electron-builder`:

```bash
npm install --save-dev electron-builder
npx electron-builder --win   # ou --linux / --mac
```

Isso não foi incluído por padrão para manter o pacote enxuto, mas o projeto já está
pronto para essa etapa.
