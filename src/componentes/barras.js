// Gráfico de barras horizontais (5) em SVG próprio. Mesmos territórios, valores e cores do mapa.
import { preenchimento, defsPadroes, ROTULO_SITUACAO } from '../mapa/simbologia.js';
import { reaisCompacto, reaisExato, inteiro } from './formatacao.js';

const ALT = 18;      // altura da barra
const PASSO = 24;    // espaçamento vertical
const ROT_MUN = 132; // largura do rótulo (nome do município)
const ROT_UF = 40;   // largura do rótulo (sigla da UF)
const VAL = 84;      // largura reservada ao valor

export function iniciarBarras(raiz, dados, store) {
  const cont = raiz.querySelector('.barras__conteiner');
  const subtitulo = raiz.querySelector('.bloco__subtitulo');
  let lista = [];

  cont.addEventListener('click', (e) => {
    const g = e.target.closest('[data-chave]');
    if (g) store.acoes.selecionarTerritorio(g.dataset.nivel, g.dataset.chave);
  });
  cont.addEventListener('keydown', (e) => {
    const g = e.target.closest('[data-chave]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); store.acoes.selecionarTerritorio(g.dataset.nivel, g.dataset.chave); }
  });
  cont.addEventListener('mouseover', (e) => {
    const g = e.target.closest('[data-chave]');
    store.acoes.realcar(g ? { nivel: g.dataset.nivel, chave: g.dataset.chave } : null);
  });
  cont.addEventListener('mouseleave', () => store.acoes.realcar(null));

  function desenhar(estado) {
    const f = estado.filtros;
    const rec = dados.recorte(f); // recorte central (src/dados/recorte.js)
    lista = rec.territoriosOrdenados;
    const ROT = f.uf ? ROT_MUN : ROT_UF;
    const larg = Math.max(260, cont.clientWidth - 8);
    const area = larg - ROT - VAL;
    const max = Math.max(...lista.map((t) => t.soma_centavos ?? 0), 1);
    const nivel = f.uf ? 'MUNICIPIO' : 'UF';
    const selecionado = rec.selecionado;
    subtitulo.textContent = `${f.uf ? `Municípios de ${dados.indicadores.UF[f.uf].nome}` : 'Unidades federativas'} · ${ROTULO_SITUACAO[f.situacao]}${f.setor ? ` · Setor: ${f.setor}` : ''}${f.macrocausa ? ` · Macrocausa: ${f.macrocausa}` : ''} · valores em R$ · ordem decrescente · eixo a partir de 0`;

    const linhas = lista.map((t, i) => {
      const y = 6 + i * PASSO;
      const w = t.soma_centavos ? Math.max(1, (t.soma_centavos / max) * area) : 0;
      const rotulo = nivel === 'UF' ? t.sigla_uf : t.nome;
      const sel = t.chave === selecionado;
      let valor;
      if (t.status === 'sem_obras') valor = 'sem obras';
      else if (t.status === 'nao_informado') valor = 'não informado';
      else valor = `${reaisCompacto(t.soma_centavos)}${t.n_valor_ausente ? '*' : ''}`;
      const exato = t.soma_centavos !== null ? reaisExato(t.soma_centavos) : valor;
      const ausentes = t.n_valor_ausente ? ` · ${inteiro(t.n_valor_ausente)} obra(s) sem valor informado` : '';
      const titulo = `${t.nome}: ${valor === 'sem obras' ? 'sem obras no recorte' : exato} · ${inteiro(t.n_obras)} obra(s)${ausentes}`;
      return `<g class="barra${sel ? ' barra--selecionada' : ''}" data-nivel="${nivel}" data-chave="${t.chave}" tabindex="0" role="button" aria-pressed="${sel}" aria-label="${titulo}">
        <title>${titulo}</title>
        <rect class="barra__alvo" x="0" y="${y - 3}" width="${larg}" height="${PASSO}" fill="transparent"/>
        <text class="barra__rotulo" x="${ROT - 6}" y="${y + ALT / 2 + 4}" text-anchor="end">${rotulo.length > 20 ? rotulo.slice(0, 19) + '…' : rotulo}</text>
        ${w ? `<rect class="barra__marca" x="${ROT}" y="${y}" width="${w}" height="${ALT}" fill="${preenchimento(f.situacao, t.classe)}" stroke="#9aa5b1" stroke-width="0.5"/>` : ''}
        ${sel && w ? `<rect x="${ROT - 1.5}" y="${y - 1.5}" width="${w + 3}" height="${ALT + 3}" fill="none" stroke="#ffffff" stroke-width="5"/><rect x="${ROT - 1.5}" y="${y - 1.5}" width="${w + 3}" height="${ALT + 3}" fill="none" stroke="#000" stroke-width="3"/>` : ''}
        ${sel && !w ? `<rect x="1" y="${y - 2}" width="${larg - 2}" height="${ALT + 4}" fill="none" stroke="#000" stroke-width="2"/>` : ''}
        <text class="barra__valor" x="${ROT + w + 6}" y="${y + ALT / 2 + 4}">${valor}</text>
      </g>`;
    }).join('');
    const altura = 12 + lista.length * PASSO;
    cont.innerHTML = `<svg class="barras__svg" width="${larg}" height="${altura}" role="list" aria-label="Comparação territorial">
      <defs>${defsPadroes()}</defs>
      <line x1="${ROT}" y1="0" x2="${ROT}" y2="${altura}" stroke="#9aa5b1"/>
      ${linhas}</svg>
      ${lista.some((t) => t.n_valor_ausente && t.soma_centavos !== null) ? '<p class="barras__nota">* soma dos valores informados; há obra(s) sem valor informado, não somada(s).</p>' : ''}`;
    if (selecionado) {
      const el = cont.querySelector(`[data-chave="${selecionado}"]`);
      if (el) { const y = Number(el.querySelector('.barra__alvo').getAttribute('y')); cont.scrollTop = Math.max(0, y - cont.clientHeight / 2); }
    }
  }

  function realcar(r) {
    cont.querySelectorAll('.barra--realce').forEach((g) => g.classList.remove('barra--realce'));
    if (r) cont.querySelector(`[data-chave="${r.chave}"]`)?.classList.add('barra--realce');
  }

  let larguraAnterior = 0;
  new ResizeObserver(() => {
    if (Math.abs(cont.clientWidth - larguraAnterior) > 4) { larguraAnterior = cont.clientWidth; desenhar(store.obter()); }
  }).observe(cont);

  return function render(estado, tipo) {
    if (tipo === 'realce') return realcar(estado.realce);
    if (['filtro', 'inicial'].includes(tipo)) desenhar(estado);
  };
}
