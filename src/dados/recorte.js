// Recorte ativo — ponto ÚNICO de filtragem e agregação (etapa 08).
// Todas as vistas leem o mesmo objeto, calculado uma vez por combinação de filtros:
//   indicadores  → recorte.kpis
//   tabela       → recorte.indices
//   barras/mapa  → recorte.territorios (investimento previsto total agregado das obras do recorte)
//   macrocausas  → recorte.macrocausas (obras paralisadas do recorte por macrocausa; decisão 0009)
// Nenhum componente filtra ou soma registros por conta própria.
import { indicesRecorte, calcularKpisDeIndices, territoriosDoNivel, ordenarParaBarras, macrocausasDoRecorte } from './seletores.js';

const chaveFiltros = (f) => `${f.uf ?? ''}|${f.municipio ?? ''}|${f.situacao}|${f.setor ?? ''}|${f.macrocausa ?? ''}`;

export function criarRecorte(dados) {
  const cache = new Map();

  /**
   * Conferência de coerência: para o território selecionado, o total de obras, a soma e os
   * registros sem valor calculados AO VIVO a partir de obras.json devem coincidir com o
   * território em indicadores.json (pipeline). Divergência = erro registrado no console.
   */
  function conferir(f, kpis, territorios) {
    // (a) territórios × cartões: a soma da lista (ou o território selecionado) = recorte
    const alvo = f.municipio ? territorios.filter((t) => t.chave === f.municipio) : territorios;
    const sn = alvo.reduce((s, t) => s + t.n_obras, 0);
    const ss = alvo.reduce((s, t) => s + (t.soma_centavos ?? 0), 0);
    const sa = alvo.reduce((s, t) => s + t.n_valor_ausente, 0);
    let ok = sn === kpis.total && ss === kpis.investimento.soma && sa === kpis.investimento.ausentes;
    // (b) sem setor e sem macrocausa: a agregação ao vivo = indicadores.json (pipeline auditado), território a território
    if (!f.setor && !f.macrocausa) {
      const base = f.uf ? dados.indicadores.MUNICIPIO : dados.indicadores.UF;
      for (const t of territorios) {
        const r = base[t.chave].recortes[f.situacao];
        if (r.n_obras !== t.n_obras || r.n_valor_ausente !== t.n_valor_ausente || r.soma_centavos !== t.soma_centavos || r.classe !== t.classe) { ok = false; break; }
      }
    }
    if (!ok) console.error('Recorte incoerente (territórios × cartões × indicadores.json)', f, kpis);
    return { territorio: f.municipio ? 'MUNICIPIO' : f.uf ? 'UF' : null, ok };
  }

  /** Recorte para os filtros dados (memorizado: a mesma combinação devolve o mesmo objeto). */
  function recorte(filtros) {
    const f = { uf: filtros.uf ?? null, municipio: filtros.municipio ?? null, situacao: filtros.situacao, setor: filtros.setor ?? null, macrocausa: filtros.macrocausa ?? null };
    const chave = chaveFiltros(f);
    if (cache.has(chave)) return cache.get(chave);
    const indices = indicesRecorte(dados.obras, f);
    const indicesTerritoriais = f.situacao === 'todas' ? indices : indicesRecorte(dados.obras, f, { ignorarSituacao: true });
    const kpis = calcularKpisDeIndices(dados.obras, indices, indicesTerritoriais);
    const nivel = f.uf ? 'MUNICIPIO' : 'UF';
    const territorios = territoriosDoNivel(dados, f);
    const r = Object.freeze({
      chave, filtros: Object.freeze(f), nivel, indices, kpis,
      territorios, territoriosOrdenados: ordenarParaBarras(territorios),
      selecionado: f.uf ? f.municipio : f.uf, // chave do território destacado no nível exibido
      macrocausas: macrocausasDoRecorte(dados.obras, f), // null quando a situação é "Em execução"
      coerencia: conferir(f, kpis, territorios),
    });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    cache.set(chave, r);
    return r;
  }
  return recorte;
}
