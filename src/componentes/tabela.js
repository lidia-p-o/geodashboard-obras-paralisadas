// Tabela de obras (6): recorte ativo, ordenação e paginação; clique abre o detalhe.
import { paginaTabela } from '../dados/seletores.js';
import { inteiro, reaisExato, percentualFonte } from './formatacao.js';

export function iniciarTabela(raiz, dados, store) {
  const corpo = raiz.querySelector('tbody');
  const cabecalhos = raiz.querySelectorAll('th[data-coluna]');
  const titulo = raiz.querySelector('#titulo-tabela');
  const pagTexto = raiz.querySelector('.paginacao__texto');
  const [btAnt, btProx] = raiz.querySelectorAll('.paginacao button');
  const aviso = raiz.querySelector('.tabela__aviso');
  let totalPaginas = 1;

  cabecalhos.forEach((th) => {
    const b = th.querySelector('button');
    b.addEventListener('click', () => store.acoes.ordenar(th.dataset.coluna));
  });
  btAnt.addEventListener('click', () => store.acoes.paginar(store.obter().tabela.pagina - 1));
  btProx.addEventListener('click', () => store.acoes.paginar(store.obter().tabela.pagina + 1));
  corpo.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) store.acoes.selecionarObra(tr.dataset.id);
  });
  corpo.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); store.acoes.selecionarObra(tr.dataset.id); }
  });

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  return function render(estado, tipo) {
    if (tipo === 'realce' || tipo === 'historico') return;
    const idx = dados.recorte(estado.filtros).indices; // recorte central (src/dados/recorte.js)
    const p = paginaTabela(dados.obras, idx, estado.tabela.ordem, estado.tabela.pagina);
    totalPaginas = p.totalPaginas;
    titulo.textContent = `Obras do recorte (${inteiro(p.total)})`;
    corpo.innerHTML = p.linhas.length ? p.linhas.map((l) => `
      <tr data-id="${esc(l.id)}" tabindex="0" class="${l.id === estado.obraSelecionada ? 'tabela__linha--selecionada' : ''}" aria-selected="${l.id === estado.obraSelecionada}">
        <td class="mono">${esc(l.id)}</td>
        <td class="tabela__empreendimento" title="${esc(l.empreendimento)}">${esc(l.empreendimento)}</td>
        <td>${esc(l.municipio)}</td>
        <td><span class="situacao situacao--${l.situacao === 'Paralisada' ? 'paralisada' : 'execucao'}">${esc(l.situacao)}</span></td>
        <td class="num">${l.valor === null ? '<span class="ausente">não informado</span>' : reaisExato(l.valor).replace('R$ ', '')}</td>
        <td class="num">${l.exec_fisica === null ? '<span class="ausente">não informado</span>' : percentualFonte(l.exec_fisica).replace('%', '')}</td>
        <td>${esc(l.setor)}</td>
      </tr>`).join('')
      : '<tr class="tabela__vazia"><td colspan="7">Nenhuma obra no recorte selecionado.</td></tr>';
    pagTexto.textContent = `Página ${inteiro(p.pagina)} de ${inteiro(p.totalPaginas)}`;
    btAnt.disabled = p.pagina <= 1;
    btProx.disabled = p.pagina >= totalPaginas;
    const o = estado.tabela.ordem;
    cabecalhos.forEach((th) => {
      th.setAttribute('aria-sort', th.dataset.coluna === o.coluna ? (o.direcao === 'asc' ? 'ascending' : 'descending') : 'none');
    });
    aviso.textContent = estado.aviso ?? '';
    aviso.hidden = !estado.aviso;
  };
}
