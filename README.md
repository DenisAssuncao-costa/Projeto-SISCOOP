
<h1 align="center">SISCOOP</h1>

<p align="center">
  Sistema Desktop de Gestão de Estoque e vendas para Cooperativa de Artesanato Ribeirinho.
</p>

<!-- MENU DE NAVEGAÇÃO INTERNO -->
<p align="center">
  <a href="#-sobre-o-projeto">Sobre</a> •
  <a href="#-objetivos">Objetivos</a> •
  <a href="#-tecnologias">Tecnologias</a> •
  <a href="#-Requisitos-Funcionais">Requisitos</a> •
  <a href="#banco-de-dados">Banco de Dados</a> •
  <a href="#-equipe">Equipe</a>
</p>

---

## 📌 Sobre o Projeto

O SISCOOP é uma solução de software de porte desktop , projetada especificamente para atender às demandas de gestão operacional, controle de estoque físico e mediação financeira de cooperativas e associações de artesanato ribeirinho e indígenas na Região Amazônica.

caracterizaçao do Problema.

As cooperativas de artesanato ribeirinho no Amazonas desempenham um papel socioeconômico crucial para a subsistência de diversas famílias comunitárias. No entanto, a gestão de estoque, controle de vendas e repasses aos artesãos ainda ocorrem predominantemente de forma manual (em cadernos de anotações ou planilhas desconectadas).

justificativa.

O desenvolvimento do SISCOOP justifica-se pela necessidade de informatizar e profissionalizar o fluxo de trabalho da cooperativa por meio de uma aplicação desktop robusta, intuitiva e totalmente independente de conexão com a internet (100% offline).


## 🎯 Objetivos

- [ ] **Objetivo Principal:** Desenvolver um siatema desktop para controle de estoque, vendas e produção de associados de uma cooperativa.
- [ ] **Objetivo Secundário 1:** Permitir cadastro de associados/ Artesão e de produtos Artesanais.
- [ ] **Objetivo Secundário 2:** Implementar melhorias através de um sistema unificado e de facíl acesso para associados.
---


## 🛠 Tecnologias

Tecnologias, linguagens e ferramentas utilizadas no desenvolvimento:

| Categoria | Tecnologia | Versão / Observação |
| :--- | :--- | :--- |
| **Linguagem** | Insira aqui | ex: TypeScript / Java / Python |
| **Framework** | Insira aqui | ex: React / NestJS / Django |
| **Estilização** | Insira aqui | ex: Tailwind CSS / Styled Components |
| **Outros** | Insira aqui | ex: Docker / Jest |

---

## 📋 Requisitos Funcionais

| Código | Requisito | Descrição |
|---|---|---|
| RF01 | Cadastro do Artesão | cada cadastro deve conter número de identificação. |
| RF02 | Cadastro de produtos | O sistema deve permitir novos produtos e categorias . |
| RF03 | Registrar venda | O sistema devera permitir o registro de vendas via pix, débito, credito. |
| RF04 | Controle de Estoque| O sistema deverá atualizar o estoque á cada venda. |
| RF05 | Emitir documento fiscal | O sistema deverá permitir a emissão de nota fisal. |

## 🔒 Requisitos Não Funcionais

| Código | Requisito | Descrição |
|---|---|---|
| RNF01 | Acesso offline | O sistema devera permitir o suso das principais funcionalidaes de forma offline. |
| RNF02 | Backup automático| O sistema deverá realizar cópias de segurança automaticamente, em preriodos definidos. |
| RNF03 | Segurança | o sistema deverá utilizar banco de dados local seguro, com proteção contra acesso indevido. |
| RNF04 | Usabilidade | O sistema deverá possuir uma interface simples, intuitiva e de fácil utilizaçao. |
| RNF05 | Desempenho | O sistema deverá apresentar tempo de resposta adequado para as operações de cadastro, consulta e venda. |

---

## 🗄️ Banco de Dados

O sistema utiliza um banco de dados MySQL para armazenamento e
gerenciamento das informações da aplicação.

### Principais entidades

- Artesao
- Produto
- Usuário
- Categotia
- Estoque

📄 [Ver documentação do banco de dados](docs/banco-de-dados.md)

💾 [Arquivo SQL do banco](database/banco.sql)

---

## 👥 Equipe

* [Marcelo Aguiar](https://github.com/joaosilva) - *Desenvolvedor Front-end*
* [Denis Assunção](https://github.com/DenisAssuncao-costa) - *Banco de Dados*
* [Ewerton Lima](https://linkedin.com/in/carloseduardo) - 
