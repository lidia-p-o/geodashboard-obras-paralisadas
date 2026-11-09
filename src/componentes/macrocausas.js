// Faixa de macrocausas de paralisação (8) — decisão 0009.
// Quantidade de obras PARALISADAS do recorte ativo por macrocausa (campo original, sem reclassificação).
// Lê apenas recorte.macrocausas (src/dados/recorte.js); clique numa barra → ação definir/selecionar macrocausa.
import { inteiro, pct, reaisExato } from './formatacao.js';

const CAT_SEM_INFORMACAO = '6. Não informado / outros'; // categoria residual da fonte: sempre por último, em cinza
export const PREFIXO_AVISO_MACROCAUSA = 'Filtro de macrocausa';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function iniciarMacrocausas(raiz, dados, store) {
  const cont = raiz.querySelector('.macrocausas__conteiner');
  const subtitulo = raiz.querySelector('.bloco__subtitulo');
  const aviso = raiz.querySelector('.macrocausas__aviso');
  const selo = raiz.querySelector('.macrocausas__selo'); // resumo visual do universo (redesign rc7)

  cont.addEventListener('click', (e) => {
    const b = e.target.closest('[data-macrocausa]');
    if (b) store.acoes.selecionarMacrocausa(b.dataset.macrocausa);
  });

  function contexto(f) {
    const partes = [f.municipio ? `${dados.indicadores.MUNICIPIO[f.municipio].nome}/${f.uf}` : f.uf ? dados.indicadores.UF[f.uf].nome : 'Brasil'];
    if (f.setor) partes.push(`Setor: ${f.setor}`);
    return partes.join(' · ');
  }

  function desenhar(estado) {
    try { desenharConteudo(estado); } finally { subtitulo.title = subtitulo.textContent; } // texto completo, se truncado
  }

  function desenharConteudo(estado) {
    const f = estado.filtros;
    const mc = dados.recorte(f).macrocausas; // recorte central
    // teclado: a barra focada continua focada após o redesenho (Enter/Espaço não perdem a posição)
    const focada = cont.contains(document.activeElement) ? document.activeElement.dataset?.macrocausa : null;
    const avisoMacro = estado.aviso && estado.aviso.startsWith(PREFIXO_AVISO_MACROCAUSA) ? estado.aviso : '';
    aviso.textContent = avisoMacro;
    aviso.hidden = !avisoMacro;
    cont.dataset.situacao = f.situacao;

    // "Em execução": macrocausas não se aplicam — sem barras com zeros artificiais
    selo.hidden = false;
    selo.textContent = mc ? `Paralisadas · ${inteiro(mc.total)} obra${mc.total === 1 ? '' : 's'}` : 'Não se aplica a obras em execução';
    selo.classList.toggle('macrocausas__selo--neutro', !mc);
    if (!mc) {
      subtitulo.textContent = `${contexto(f)} · Em execução`;
      cont.innerHTML = `<div class="macrocausas__vazio" role="status">
        <p class="macrocausas__vazio-titulo">Macrocausas de paralisação não se aplicam ao recorte selecionado.</p>
        <p class="macrocausas__vazio-texto">A situação ativa é “Em execução”. Selecione “Paralisadas” ou “Todas as obras” para ver as macrocausas das obras paralisadas.</p></div>`;
      return;
    }
    const base = f.situacao === 'todas' ? 'considera apenas as obras paralisadas do recorte' : 'obras paralisadas do recorte';
    subtitulo.textContent = `${contexto(f)} · ${base} (${inteiro(mc.total)})${mc.total ? ' · nº de obras e % das paralisadas' : ''}`;
    if (!mc.total) {
      cont.innerHTML = `<div class="macrocausas__vazio" role="status">
        <p class="macrocausas__vazio-titulo">Nenhuma obra paralisada no recorte ativo.</p>
        <p class="macrocausas__vazio-texto">Não há macrocausas a exibir para este recorte.</p></div>`;
      return;
    }

    // Ordem: categorias específicas por quantidade decrescente (empate: número da categoria); a residual por último
    const especificas = mc.categorias.filter((c) => c.nome !== CAT_SEM_INFORMACAO)
      .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
    const residual = mc.categorias.filter((c) => c.nome === CAT_SEM_INFORMACAO);
    const lista = [...especificas, ...residual];
    const max = Math.max(...lista.map((c) => c.n), 1); // escala única, eixo a partir de 0
    const sel = f.macrocausa;

    cont.innerHTML = `<ul class="macrocausas__lista" role="list">${lista.map((c) => {
      const p = (c.n / mc.total) * 100;
      const causas = Object.entries(c.causas).sort((a, b) => b[1] - a[1]);
      const composicao = causas.length ? ` · causas na fonte: ${causas.slice(0, 6).map(([k, v]) => `${k} (${inteiro(v)})`).join('; ')}${causas.length > 6 ? '; …' : ''}` : '';
      const valor = c.n ? ` · investimento previsto ${reaisExato(c.soma_centavos)}${c.n_valor_ausente ? ` (soma dos valores informados; ${inteiro(c.n_valor_ausente)} sem valor)` : ''}` : '';
      const titulo = `${c.nome}: ${inteiro(c.n)} obra(s) paralisada(s), ${pct(p)} das paralisadas do recorte${valor}${composicao}`;
      const classes = ['macrocausa', c.nome === CAT_SEM_INFORMACAO && 'macrocausa--residual', sel === c.nome && 'macrocausa--selecionada', sel && sel !== c.nome && 'macrocausa--esmaecida'].filter(Boolean).join(' ');
      return `<li class="${classes}">
        <button type="button" class="macrocausa__botao" data-macrocausa="${esc(c.nome)}" aria-pressed="${sel === c.nome}" title="${esc(titulo)}"
          aria-label="${esc(titulo)}. ${sel === c.nome ? 'Clique para remover o filtro.' : 'Clique para filtrar a interface por esta macrocausa.'}">
          <span class="macrocausa__rotulo">${esc(c.nome)}</span>
          <span class="macrocausa__trilho"><span class="macrocausa__barra" style="--r:${c.n ? Math.max(0.004, c.n / max) : 0}"></span></span>
          <span class="macrocausa__valor"><strong>${inteiro(c.n)}</strong> · ${pct(p)}</span>
        </button></li>`;
    }).join('')}</ul>`;
    if (focada) [...cont.querySelectorAll('[data-macrocausa]')].find((el) => el.dataset.macrocausa === focada)?.focus();
  }

  return function render(estado, tipo) {
    if (['filtro', 'inicial'].includes(tipo)) desenhar(estado);
  };
}
