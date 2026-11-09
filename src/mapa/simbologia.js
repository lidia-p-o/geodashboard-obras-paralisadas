// Simbologia temática compartilhada por mapa, legenda e barras (fonte: simbologia.json — decisão 0004).
// Mantém a correspondência visual: o mesmo território recebe a mesma cor no mapa e no gráfico.

let SIMB = null;
let CLASSES = null;

export function configurarSimbologia(referencia) {
  SIMB = referencia.simbologia;
  CLASSES = referencia.classes;
}

export const escala = (situacao) => SIMB.escalas[situacao];
export const especiais = () => SIMB.categorias_especiais;

/** Preenchimento para (situação, categoria). Categorias especiais usam padrões SVG (#padrao-*). */
export function preenchimento(situacao, categoria) {
  if (/^[1-5]$/.test(String(categoria))) return escala(situacao).cores[Number(categoria) - 1];
  if (categoria === 'zero') return 'url(#padrao-zero)';
  return especiais()[categoria]?.preenchimento ?? '#f0f0f0';
}

/** Rótulos das 5 classes na legenda e limites exatos (centavos) para o nível (decisão 0007). */
export function limitesLegenda(nivel) {
  return { rotulos: CLASSES[nivel].rotulos_legenda, limitesCentavos: CLASSES[nivel].limites_centavos };
}

export const ROTULO_SITUACAO = { todas: 'Todas as obras', paralisadas: 'Paralisadas', em_execucao: 'Em execução' };

/** Definições SVG dos padrões (inseridas no mapa e no gráfico). */
export function defsPadroes() {
  const zero = especiais().zero.padrao.cor;
  return `
    <pattern id="padrao-zero" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="${especiais().zero.preenchimento}"/>
      <circle cx="3" cy="3" r="1" fill="${zero}"/>
    </pattern>`;
}
