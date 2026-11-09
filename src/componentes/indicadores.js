// Faixa de indicadores (2). Recalcula a cada mudança de filtro; não reage a zoom, realce ou tabela.
import { inteiro, pct, reaisAbreviado, reaisExato } from './formatacao.js';

export function iniciarIndicadores(raiz, dados, store) {
  const q = (s) => raiz.querySelector(s);
  function render(estado, tipo) {
    if (!['filtro', 'inicial'].includes(tipo)) return;
    const k = dados.recorte(estado.filtros).kpis; // recorte central (src/dados/recorte.js)
    q('[data-kpi="total"]').textContent = inteiro(k.total);
    q('[data-kpi="total-nota"]').textContent = 'obras no recorte ativo';

    for (const [chave, v] of [['investimento', k.investimento], ['desbloqueado', k.desbloqueado]]) {
      const el = q(`[data-kpi="${chave}"]`);
      const nenhumValor = k.total > 0 && v.ausentes === k.total; // ausência não é exibida como zero (decisão 0007)
      el.textContent = nenhumValor ? 'não informado' : reaisAbreviado(v.soma);
      el.title = nenhumValor ? 'Nenhum registro do recorte tem valor na fonte' : reaisExato(v.soma);
      q(`[data-kpi="${chave}-nota"]`).textContent = nenhumValor
        ? `Nenhum dos ${inteiro(k.total)} registro(s) possui valor na fonte`
        : v.ausentes
          ? `Soma dos valores informados: ${inteiro(v.ausentes)} registro(s) sem valor, não somado(s) (não tratados como zero)`
          : 'Todos os registros do recorte possuem valor';
    }

    const d = k.distribuicao;
    const pP = d.total ? (d.paralisadas / d.total) * 100 : 0;
    const pE = d.total ? (d.execucao / d.total) * 100 : 0;
    const barra = q('.distribuicao');
    barra.classList.toggle('distribuicao--vazia', d.total === 0);
    barra.dataset.ativa = estado.filtros.situacao;
    q('.distribuicao__parte--paralisada').style.width = `${pP}%`;
    q('.distribuicao__parte--execucao').style.width = `${pE}%`;
    barra.setAttribute('aria-label', d.total
      ? `Paralisadas ${inteiro(d.paralisadas)} (${pct(pP)}); em execução ${inteiro(d.execucao)} (${pct(pE)})`
      : 'Sem obras no recorte territorial');
    q('[data-kpi="paralisadas"]').textContent = d.total ? `${inteiro(d.paralisadas)} (${pct(pP)})` : '0';
    q('[data-kpi="execucao"]').textContent = d.total ? `${inteiro(d.execucao)} (${pct(pE)})` : '0';
    q('[data-kpi="dist-nota"]').textContent = estado.filtros.macrocausa
      ? 'Macrocausa ativa: somente obras paralisadas do recorte territorial'
      : estado.filtros.situacao === 'todas'
      ? 'Recorte territorial ativo'
      : 'Recorte territorial (sem o filtro de situação); situação filtrada em destaque';
  }
  return render;
}
