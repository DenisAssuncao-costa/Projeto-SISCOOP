// Utilitários de interface compartilhados entre as telas do SISCOOP

function toast(mensagem, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = mensagem;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function formatarMoeda(valor) {
  const n = Number(valor || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(strData) {
  if (!strData) return '-';
  const [data, hora] = String(strData).split(' ');
  if (!data) return strData;
  const [ano, mes, dia] = data.split('-');
  return hora ? `${dia}/${mes}/${ano} ${hora.slice(0, 5)}` : `${dia}/${mes}/${ano}`;
}

function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function abrirModal(id) { document.getElementById(id).classList.add('aberto'); }
function fecharModal(id) { document.getElementById(id).classList.remove('aberto'); }

function confirmarAcao(mensagem) {
  return window.confirm(mensagem);
}

function iniciaisNome(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
}

function trocarSecao(idSecao, mapaNav) {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.getElementById(idSecao).classList.add('ativa');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('ativo'));
  if (mapaNav && mapaNav[idSecao]) mapaNav[idSecao].classList.add('ativo');
}

function hojeISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function primeiroDiaMesISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ==================== GRÁFICOS (Canvas nativo, sem dependências externas) ====================

function prepararCanvasAltaResolucao(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const larguraCss = canvas.clientWidth || canvas.parentElement.clientWidth;
  const alturaCss = canvas.clientHeight || 220;
  canvas.width = larguraCss * dpr;
  canvas.height = alturaCss * dpr;
  canvas.style.width = larguraCss + 'px';
  canvas.style.height = alturaCss + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, largura: larguraCss, altura: alturaCss };
}

/**
 * Desenha um gráfico de barras verticais simples.
 * pontos: [{ rotulo, valor }]
 */
function desenharGraficoBarras(idCanvas, pontos, opcoes = {}) {
  const canvas = document.getElementById(idCanvas);
  if (!canvas) return;
  const { ctx, largura, altura } = prepararCanvasAltaResolucao(canvas);
  ctx.clearRect(0, 0, largura, altura);

  const corBarra = opcoes.cor || '#3d6b52';
  const corTexto = '#5a5248';
  const margemEsquerda = 46, margemBaixo = 28, margemTopo = 22, margemDireita = 12;
  const areaLargura = largura - margemEsquerda - margemDireita;
  const areaAltura = altura - margemTopo - margemBaixo;

  const valorMax = Math.max(1, ...pontos.map(p => p.valor));
  const passos = 4;

  // linhas de grade + rótulos do eixo Y
  ctx.font = '10px Segoe UI, Arial';
  ctx.fillStyle = corTexto;
  ctx.strokeStyle = '#eee6d8';
  ctx.textAlign = 'right';
  for (let i = 0; i <= passos; i++) {
    const valor = (valorMax / passos) * i;
    const y = margemTopo + areaAltura - (valor / valorMax) * areaAltura;
    ctx.beginPath();
    ctx.moveTo(margemEsquerda, y);
    ctx.lineTo(largura - margemDireita, y);
    ctx.stroke();
    ctx.fillText('R$' + Math.round(valor), margemEsquerda - 6, y + 3);
  }

  // barras
  const larguraBarra = Math.min(38, (areaLargura / pontos.length) * 0.55);
  const espacamento = areaLargura / pontos.length;
  ctx.textAlign = 'center';
  pontos.forEach((p, i) => {
    const centroX = margemEsquerda + espacamento * i + espacamento / 2;
    const alturaBarra = (p.valor / valorMax) * areaAltura;
    const x = centroX - larguraBarra / 2;
    const y = margemTopo + areaAltura - alturaBarra;

    ctx.fillStyle = corBarra;
    const raio = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + Math.max(alturaBarra, 1));
    ctx.lineTo(x, y + raio);
    ctx.quadraticCurveTo(x, y, x + raio, y);
    ctx.lineTo(x + larguraBarra - raio, y);
    ctx.quadraticCurveTo(x + larguraBarra, y, x + larguraBarra, y + raio);
    ctx.lineTo(x + larguraBarra, y + Math.max(alturaBarra, 1));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = corTexto;
    ctx.fillText(p.rotulo, centroX, altura - margemBaixo + 16);
  });
}

/**
 * Desenha um gráfico de pizza/donut com legenda ao lado.
 * pontos: [{ rotulo, valor }]
 */
function desenharGraficoPizza(idCanvas, idLegenda, pontos, opcoes = {}) {
  const canvas = document.getElementById(idCanvas);
  if (!canvas) return;
  const { ctx, largura, altura } = prepararCanvasAltaResolucao(canvas);
  ctx.clearRect(0, 0, largura, altura);

  const cores = opcoes.cores || ['#3d6b52', '#c69a3a', '#a15c38', '#6f8f7a', '#d9b45a', '#8a6f52', '#557a63'];
  const total = pontos.reduce((acc, p) => acc + p.valor, 0);
  const cx = largura * 0.36, cy = altura / 2;
  const raioExterno = Math.min(cx, cy) - 10;
  const raioInterno = raioExterno * 0.55;

  const legenda = document.getElementById(idLegenda);
  if (legenda) legenda.innerHTML = '';

  if (total <= 0) {
    ctx.fillStyle = '#b8ae9c';
    ctx.textAlign = 'center';
    ctx.font = '12px Segoe UI, Arial';
    ctx.fillText('Sem vendas no período.', largura / 2, altura / 2);
    return;
  }

  let anguloAtual = -Math.PI / 2;
  pontos.forEach((p, i) => {
    const fatia = (p.valor / total) * Math.PI * 2;
    const cor = cores[i % cores.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, raioExterno, anguloAtual, anguloAtual + fatia);
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
    anguloAtual += fatia;

    if (legenda) {
      const pct = ((p.valor / total) * 100).toFixed(1);
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12.5px;margin-bottom:8px;';
      item.innerHTML = `<span style="width:11px;height:11px;border-radius:3px;background:${cor};flex-shrink:0;"></span>
        <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#5a5248;">${escaparHtml(p.rotulo)}</span>
        <b style="color:#2b2118; flex-shrink:0; white-space:nowrap;">${pct}%</b>`;
      legenda.appendChild(item);
    }
  });

  // buraco do donut
  ctx.beginPath();
  ctx.arc(cx, cy, raioInterno, 0, Math.PI * 2);
  ctx.fillStyle = '#fffdf8';
  ctx.fill();
}
