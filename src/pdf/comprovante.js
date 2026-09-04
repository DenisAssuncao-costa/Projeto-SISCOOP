const fs = require('fs');
const PDFDocument = require('pdfkit');

const VERDE_ESCURO = '#1e3f31';
const VERDE = '#3d6b52';
const DOURADO = '#c69a3a';
const CINZA_TEXTO = '#5a5248';
const CINZA_CLARO = '#e7e0d4';

function formatarMoedaPdf(valor) {
  return 'R$ ' + Number(valor || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatarDataPdf(strData) {
  if (!strData) return '-';
  const [data, hora] = String(strData).split(' ');
  const [ano, mes, dia] = data.split('-');
  return hora ? `${dia}/${mes}/${ano} ${hora.slice(0, 5)}` : `${dia}/${mes}/${ano}`;
}

const ROTULOS_PAGAMENTO = { DINHEIRO: 'Dinheiro', PIX: 'PIX', DEBITO: 'Cartão de Débito', CREDITO: 'Cartão de Crédito' };

/**
 * Gera o comprovante de venda em PDF (RF08 - documento fiscal/comprovante correspondente à venda).
 * @param {object} venda - retorno de database.obterVendaCompleta(id_venda)
 * @param {string} caminhoDestino - caminho completo do arquivo .pdf a ser criado
 * @returns {Promise<void>}
 */
function gerarComprovantePdf(venda, caminhoDestino) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(caminhoDestino);
      doc.pipe(stream);

      // ---------- CABEÇALHO ----------
      doc.rect(0, 0, doc.page.width, 90).fill(VERDE_ESCURO);
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
        .text('SISCOOP', 50, 28);
      doc.fontSize(9.5).font('Helvetica').fillColor('#dce8e0')
        .text('Sistema de Gestão de Estoque e Venda para Cooperativa de Artesanato Ribeirinho', 50, 52, { width: 340 });

      doc.fontSize(11).font('Helvetica-Bold').fillColor(DOURADO)
        .text('COMPROVANTE DE VENDA', 0, 30, { align: 'right', width: doc.page.width - 50 });
      doc.fontSize(10).font('Helvetica').fillColor('#ffffff')
        .text(venda.numero_documento || `SISCOOP-${String(venda.id_venda).padStart(6, '0')}`, 0, 48, { align: 'right', width: doc.page.width - 50 });
      doc.text(formatarDataPdf(venda.data_venda), 0, 63, { align: 'right', width: doc.page.width - 50 });

      let y = 118;

      // ---------- DADOS DA VENDA ----------
      doc.fillColor(CINZA_TEXTO).fontSize(10).font('Helvetica-Bold').text('Dados da Venda', 50, y);
      y += 18;
      doc.font('Helvetica').fontSize(9.5).fillColor('#222');

      const linhaInfo = (rotulo, valor) => {
        doc.font('Helvetica-Bold').text(rotulo, 50, y, { continued: true });
        doc.font('Helvetica').text('  ' + valor);
        y += 15;
      };
      linhaInfo('Vendedor(a):', venda.vendedor_nome || '-');
      linhaInfo('Tipo de venda:', venda.tipo === 'CONSIGNADO' ? 'Consignado' : 'À vista');
      linhaInfo('Forma de pagamento:', ROTULOS_PAGAMENTO[venda.forma_pagamento] || venda.forma_pagamento || '-');
      linhaInfo('Status:', venda.status === 'CONCLUIDA' ? 'Concluída' : 'Estornada');
      if (venda.tipo === 'CONSIGNADO') {
        linhaInfo('Consignatário:', venda.id_consignatario || '-');
        linhaInfo('Data limite p/ acerto:', venda.data_limite_consignacao ? formatarDataPdf(venda.data_limite_consignacao) : '-');
      }

      y += 8;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(CINZA_CLARO).lineWidth(1).stroke();
      y += 20;

      // ---------- TABELA DE ITENS ----------
      const colX = { produto: 50, artesao: 250, qtd: 370, unit: 420, subtotal: 490 };

      const desenharCabecalhoTabela = (yTopo) => {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.rect(50, yTopo, doc.page.width - 100, 22).fill(VERDE);
        doc.fillColor('#ffffff')
          .text('Produto', colX.produto + 6, yTopo + 6)
          .text('Artesão', colX.artesao, yTopo + 6)
          .text('Qtd', colX.qtd, yTopo + 6)
          .text('Unit.', colX.unit, yTopo + 6)
          .text('Subtotal', colX.subtotal, yTopo + 6);
        return yTopo + 22;
      };

      y = desenharCabecalhoTabela(y);

      doc.font('Helvetica').fontSize(9.5).fillColor('#222');
      venda.itens.forEach((item, i) => {
        const alturaLinha = 20;
        if (y > doc.page.height - 130) {
          doc.addPage();
          y = 50;
          y = desenharCabecalhoTabela(y);
          doc.font('Helvetica').fontSize(9.5).fillColor('#222');
        }
        if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, alturaLinha).fill('#f6f3ec');
        doc.fillColor('#222')
          .text(item.produto_nome, colX.produto + 6, y + 5, { width: 190 })
          .text(item.artesao_nome, colX.artesao, y + 5, { width: 110 })
          .text(String(item.quantidade), colX.qtd, y + 5)
          .text(formatarMoedaPdf(item.valor_unitario), colX.unit, y + 5)
          .text(formatarMoedaPdf(item.subtotal), colX.subtotal, y + 5);
        y += alturaLinha;
      });

      // garante espaço suficiente para a linha de total (evita pagina extra quase vazia)
      if (y > doc.page.height - 110) {
        doc.addPage();
        y = 50;
      }

      y += 10;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(CINZA_CLARO).lineWidth(1).stroke();
      y += 16;

      // ---------- TOTAL ----------
      doc.font('Helvetica-Bold').fontSize(13).fillColor(VERDE_ESCURO)
        .text('TOTAL', colX.unit - 40, y)
        .text(formatarMoedaPdf(venda.valor_total), colX.subtotal - 10, y, { width: 90, align: 'right' });

      y += 40;

      // ---------- RODAPÉ ----------
      doc.font('Helvetica').fontSize(8).fillColor('#999')
        .text('Documento gerado automaticamente pelo SISCOOP — Sistema de Gestão de Estoque e Venda para Cooperativa de Artesanato Ribeirinho.',
          50, doc.page.height - 85, { width: doc.page.width - 100, align: 'center' });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { gerarComprovantePdf };
