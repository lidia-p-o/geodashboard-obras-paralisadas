// Seletores: funções puras sobre (dados, estado). Sem acesso ao DOM ou ao Leaflet.
// Agregação territorial ao vivo (decisão 0008): mesma regra do pipeline (preparar_web.py › categoria),
// necessária para o filtro de setor; sem setor, o resultado é conferido com indicadores.json (recorte.js).

const SITUACAO_FONTE = { paralisadas: 'Paralisada', em_execucao: 'Em execução' };

/** Pré-processa as obras para acesso rápido (executado uma vez). */
export function prepararObras(obras) {
  const d = obras.dicionarios;
  const c = obras.colunas;
  const idxSit = Object.fromEntries(d['Situação'].map((v, i) => [v, i]));
  const porId = new Map(c.id.map((id, i) => [id, i]));
  return { ...obras, idxSit, porId };
}

const ufDe = (o, i) => o.dicionarios.UF[o.colunas['cat:UF'][i]];
const sitDe = (o, i) => o.dicionarios['Situação'][o.colunas['cat:Situação'][i]];

export const CAMPO_MACROCAUSA = 'Macrocausa da paralisação';

/** Índices das obras que satisfazem os filtros (UF, município, setor, macrocausa e, opcionalmente, a situação).
 *  Macrocausa (decisão 0009): só se aplica a obras paralisadas — com macrocausa ativa, o recorte é sempre
 *  "Paralisada × macrocausa", inclusive na distribuição territorial (ignorarSituacao). */
export function indicesRecorte(o, filtros, { ignorarSituacao = false } = {}) {
  const { uf, municipio, situacao, setor, macrocausa } = filtros;
  const sitAlvo = macrocausa ? o.idxSit[SITUACAO_FONTE.paralisadas]
    : !ignorarSituacao && situacao !== 'todas' ? o.idxSit[SITUACAO_FONTE[situacao]] : null;
  const catMacro = o.colunas[`cat:${CAMPO_MACROCAUSA}`];
  const idxMacro = macrocausa ? o.dicionarios[CAMPO_MACROCAUSA].indexOf(macrocausa) : null;
  const out = [];
  const catUF = o.colunas['cat:UF'];
  const catSit = o.colunas['cat:Situação'];
  const catSetor = o.colunas['cat:Setor'];
  const idxUF = uf ? o.dicionarios.UF.indexOf(uf) : null;
  const idxSetor = setor ? o.dicionarios.Setor.indexOf(setor) : null;
  for (let i = 0; i < o.n; i++) {
    if (idxUF !== null && catUF[i] !== idxUF) continue;
    if (municipio && o.colunas.cd_mun[i] !== municipio) continue;
    if (sitAlvo !== null && catSit[i] !== sitAlvo) continue;
    if (idxSetor !== null && catSetor[i] !== idxSetor) continue;
    if (idxMacro !== null && catMacro[i] !== idxMacro) continue;
    out.push(i);
  }
  return out;
}

/**
 * Macrocausas das obras PARALISADAS do recorte (decisão 0009): UF, município e setor ativos; a situação e a
 * própria macrocausa não restringem (o gráfico mostra todas as categorias para permitir trocar de seleção).
 * Categorias = dicionário do campo `Macrocausa da paralisação`, sem alteração nem dedução a partir de `Causa`.
 * Retorna null quando a situação ativa é "Em execução" (macrocausas não se aplicam).
 */
export function macrocausasDoRecorte(o, filtros) {
  if (filtros.situacao === 'em_execucao') return null;
  const idx = indicesRecorte(o, { ...filtros, situacao: 'paralisadas', macrocausa: null });
  const dic = o.dicionarios[CAMPO_MACROCAUSA];
  const catM = o.colunas[`cat:${CAMPO_MACROCAUSA}`];
  const catC = o.colunas['cat:Causa da paralisação'];
  const val = o.colunas.valor_investimento_centavos;
  const cats = dic.map((nome) => ({ nome, n: 0, soma_centavos: 0, n_valor_ausente: 0, causas: {} }));
  for (const i of idx) {
    const c = cats[catM[i]];
    c.n++;
    if (val[i] === null) c.n_valor_ausente++; else c.soma_centavos += val[i];
    const causa = o.dicionarios['Causa da paralisação'][catC[i]];
    c.causas[causa] = (c.causas[causa] ?? 0) + 1;
  }
  return { total: idx.length, categorias: cats };
}

/** Status e classe do investimento previsto total — MESMA regra de preparar_web.py › categoria (decisão 0007). */
export function categoria(nObras, nAusentes, somaCentavos, limites) {
  if (nObras === 0) return { status: 'sem_obras', classe: 'sem_obras' };
  if (nAusentes === nObras) return { status: 'nao_informado', classe: 'nao_informado' };
  if (somaCentavos === 0) return { status: 'zero', classe: 'zero' };
  const k = limites.findIndex((l) => somaCentavos <= l);
  return { status: 'positivo', classe: String(k === -1 ? 5 : k + 1) };
}

function somaCentavos(col, indices) {
  let soma = 0;
  let ausentes = 0;
  for (const i of indices) {
    const v = col[i];
    if (v === null) ausentes++; else soma += v;
  }
  return { soma, ausentes };
}

/** Indicadores da faixa superior a partir de índices já filtrados (usado por recorte.js).
 *  A distribuição usa só o recorte territorial (D-07). */
export function calcularKpisDeIndices(o, idx, idxTerritorial) {
  let paralisadas = 0;
  let execucao = 0;
  for (const i of idxTerritorial) {
    const s = sitDe(o, i);
    if (s === 'Paralisada') paralisadas++; else if (s === 'Em execução') execucao++;
  }
  return {
    total: idx.length,
    investimento: somaCentavos(o.colunas.valor_investimento_centavos, idx),
    desbloqueado: somaCentavos(o.colunas.valor_desbloqueado_centavos, idx),
    distribuicao: { paralisadas, execucao, total: idxTerritorial.length },
  };
}

/** Territórios do nível ativo (UF no nível nacional; municípios da UF selecionada), com o investimento
 *  previsto total agregado das obras do recorte (situação e setor; o filtro de município não restringe a lista). */
export function territoriosDoNivel(dados, filtros) {
  const o = dados.obras;
  const nivel = filtros.uf ? 'MUNICIPIO' : 'UF';
  const fonte = filtros.uf
    ? Object.values(dados.indicadores.MUNICIPIO).filter((t) => t.sigla_uf === filtros.uf)
    : Object.values(dados.indicadores.UF);
  const ag = new Map();
  const col = o.colunas.valor_investimento_centavos;
  for (const i of indicesRecorte(o, { ...filtros, municipio: null })) {
    const k = nivel === 'UF' ? ufDe(o, i) : o.colunas.cd_mun[i];
    let a = ag.get(k);
    if (!a) { a = { n: 0, soma: 0, ids: [] }; ag.set(k, a); }
    a.n++;
    if (col[i] === null) a.ids.push(o.colunas.id[i]); else a.soma += col[i];
  }
  const limites = dados.referencia.classes[nivel].limites_centavos;
  return fonte.map((t) => {
    const a = ag.get(nivel === 'UF' ? t.sigla_uf : t.cd) ?? { n: 0, soma: 0, ids: [] };
    return {
      chave: nivel === 'UF' ? t.sigla_uf : t.cd, nivel, cd: t.cd,
      nome: t.nome, sigla_uf: t.sigla_uf, populacao: t.populacao, nota_pop: t.nota_pop,
      n_obras: a.n, n_valor_ausente: a.ids.length, ids_valor_ausente: a.ids.sort(),
      soma_centavos: a.n > a.ids.length ? a.soma : null,
      ...categoria(a.n, a.ids.length, a.soma, limites),
    };
  });
}

/** Ordena para o gráfico: territórios com valor informado pelo investimento total (desc, zero ao fim do grupo),
 *  depois "valor não informado" e "sem obras". */
export function ordenarParaBarras(lista) {
  const peso = (t) => (t.soma_centavos !== null ? 0 : t.status === 'nao_informado' ? 1 : 2);
  return [...lista].sort((a, b) => peso(a) - peso(b) || (b.soma_centavos ?? -1) - (a.soma_centavos ?? -1)
    || a.nome.localeCompare(b.nome, 'pt-BR'));
}

const COLUNAS_TABELA = {
  id: (o, i) => o.colunas.id[i],
  empreendimento: (o, i) => o.colunas.empreendimento[i],
  municipio: (o, i) => `${o.colunas.municipio_tcu[i]}/${ufDe(o, i)}`,
  situacao: (o, i) => sitDe(o, i),
  valor: (o, i) => o.colunas.valor_investimento_centavos[i],
  exec_fisica: (o, i) => o.colunas.exec_fisica_pct[i],
  setor: (o, i) => o.dicionarios.Setor[o.colunas['cat:Setor'][i]],
};

/** Linhas da página corrente; ausentes (null) sempre ao final, em qualquer direção. */
export function paginaTabela(o, indices, { coluna, direcao }, pagina, porPagina = 25) {
  const f = COLUNAS_TABELA[coluna];
  const sinal = direcao === 'asc' ? 1 : -1;
  const ord = [...indices].sort((a, b) => {
    const va = f(o, a); const vb = f(o, b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')) * sinal;
  });
  const totalPaginas = Math.max(1, Math.ceil(ord.length / porPagina));
  const p = Math.min(Math.max(1, pagina), totalPaginas);
  const linhas = ord.slice((p - 1) * porPagina, p * porPagina).map((i) => ({
    indice: i, id: o.colunas.id[i], empreendimento: COLUNAS_TABELA.empreendimento(o, i),
    municipio: COLUNAS_TABELA.municipio(o, i), situacao: sitDe(o, i),
    valor: o.colunas.valor_investimento_centavos[i], exec_fisica: o.colunas.exec_fisica_pct[i],
    setor: COLUNAS_TABELA.setor(o, i),
  }));
  return { linhas, pagina: p, totalPaginas, total: ord.length };
}

/** Todos os campos de uma obra para o painel de detalhe. */
export function detalheObra(o, id) {
  const i = o.porId.get(id);
  if (i === undefined) return null;
  const cat = (c) => o.dicionarios[c][o.colunas[`cat:${c}`][i]];
  return {
    id, empreendimento: o.colunas.empreendimento[i], municipio: o.colunas.municipio_tcu[i], uf: cat('UF'),
    cd_mun: o.colunas.cd_mun[i], situacao: cat('Situação'), valor_investimento: o.colunas.valor_investimento_centavos[i],
    valor_desbloqueado: o.colunas.valor_desbloqueado_centavos[i], exec_fisica: o.colunas.exec_fisica_pct[i],
    exec_financeira: o.colunas.exec_financeira_pct[i], causa: cat('Causa da paralisação'),
    macrocausa: cat('Macrocausa da paralisação'), repassador: cat('Repassador'), setor: cat('Setor'),
    base: cat('BASE'), nun_conv: o.colunas.nun_conv[i], data_base: cat('DATA_BASE'),
    grupo_duplicidade: o.colunas.grupo_duplicidade[i],
  };
}
