// Painel de detalhes (7): aberto somente com obra selecionada; sobreposto ao gráfico; fecha com × ou Esc.
import { detalheObra } from '../dados/seletores.js';
import { reaisExato, percentualFonte } from './formatacao.js';

export function iniciarDetalhe(raiz, dados, store) {
  const corpo = raiz.querySelector('.detalhe__corpo');
  const fechar = raiz.querySelector('#fechar-detalhe');
  fechar.addEventListener('click', () => store.acoes.fecharDetalhe());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !raiz.hidden && document.getElementById('painel-notas').hidden) store.acoes.fecharDetalhe();
  });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let aberto = null;
  return function render(estado, tipo) {
    if (tipo === 'realce' || tipo === 'tabela' || tipo === 'historico') return;
    const id = estado.obraSelecionada;
    raiz.hidden = !id;
    if (!id && aberto) corpo.innerHTML = ''; // fechado: não deixa conteúdo de obra anterior no DOM
    if (!id || id === aberto) { aberto = id; return; }
    aberto = id;
    const d = detalheObra(dados.obras, id);
    const avisos = ['Localização em nível municipal (a base não informa a posição exata da obra).'];
    if (d.valor_investimento === null) avisos.push('Registro sem valor de investimento na fonte.');
    if (d.valor_desbloqueado === null) avisos.push('Registro sem valor desbloqueado na fonte.');
    if (d.valor_investimento !== null && d.valor_desbloqueado !== null && d.valor_desbloqueado > d.valor_investimento)
      avisos.push('Valor desbloqueado superior ao valor previsto, conforme a fonte.');
    if (d.exec_financeira !== null && d.exec_financeira > 100) avisos.push('Execução financeira acima de 100%, conforme a fonte.');
    if (d.grupo_duplicidade) avisos.push(`Integra o grupo ${d.grupo_duplicidade} de duplicidade potencial (não comprovada; registro mantido).`);
    const campos = [
      ['ID', d.id], ['Empreendimento', d.empreendimento], ['Município / UF', `${d.municipio} / ${d.uf}`],
      ['Situação', d.situacao], ['Valor Investimento (previsto)', reaisExato(d.valor_investimento)],
      ['Valor desbloqueado (já investido)', reaisExato(d.valor_desbloqueado)],
      ['Execução física', percentualFonte(d.exec_fisica)], ['Execução financeira', percentualFonte(d.exec_financeira)],
      ['Causa da paralisação', d.causa], ['Macrocausa', d.macrocausa], ['Repassador', d.repassador || 'não informado'],
      ['Setor', d.setor], ['Base de origem', d.base], ['Nº do convênio', d.nun_conv || 'não informado'], ['Data-base', d.data_base],
    ];
    corpo.innerHTML = `
      <ul class="detalhe__avisos">${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <dl class="detalhe__campos">${campos.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
    fechar.focus();
  };
}
