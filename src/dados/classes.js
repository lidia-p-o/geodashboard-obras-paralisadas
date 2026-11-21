// Conjuntos de classes do indicador "investimento previsto total (R$)" por nível (decisões 0007 e 0011).
// Padrão: limites aprovados em referencia.json (UF 1·2·4·8 bi; municípios 1·3·10·30 mi).
// Com filtro de macrocausa, no nível UF, os valores caem para a casa dos milhões: usa-se o conjunto
// aprovado pela autora em 2026-11-21 (decisão 0011): 30 · 100 · 300 · 1.000 mi. Classe k = (lim k−1, lim k].
export const CLASSES_UF_MACROCAUSA = Object.freeze({
  limites_centavos: [3_000_000_000, 10_000_000_000, 30_000_000_000, 100_000_000_000],
  rotulos_legenda: ['> 0 a 30 mi', '> 30 a 100 mi', '> 100 a 300 mi', '> 300 a 1.000 mi', '> 1.000 mi'],
  unidade: 'milhões',
});

/** Classes em vigor para o nível e os filtros ativos. */
export function classesDoRecorte(referencia, nivel, filtros = {}) {
  if (nivel === 'UF' && filtros.macrocausa) return CLASSES_UF_MACROCAUSA;
  const c = referencia.classes[nivel];
  return { ...c, unidade: nivel === 'UF' ? 'bilhões' : 'milhões' };
}
