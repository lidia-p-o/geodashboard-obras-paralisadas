// Formatação pt-BR. Apenas apresentação: não altera valores.
const nInt = new Intl.NumberFormat('pt-BR');
const n2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const inteiro = (v) => nInt.format(v);
export const pct = (v) => `${n1.format(v)}%`;

/** Centavos (inteiro) → "R$ 123.271.193.782,01" (exato). */
export function reaisExato(centavos) {
  if (centavos === null || centavos === undefined) return 'não informado';
  const neg = centavos < 0;
  const c = Math.abs(centavos);
  const reais = Math.floor(c / 100);
  const cent = String(c % 100).padStart(2, '0');
  return `${neg ? '−' : ''}R$ ${nInt.format(reais)},${cent}`;
}

/** Centavos → forma abreviada ("R$ 123,27 bi", "R$ 845,10 mi", "R$ 12.345,00"). */
export function reaisAbreviado(centavos) {
  if (centavos === null || centavos === undefined) return 'não informado';
  const reais = centavos / 100;
  if (Math.abs(reais) >= 1e9) return `R$ ${n2.format(reais / 1e9)} bi`;
  if (Math.abs(reais) >= 1e6) return `R$ ${n2.format(reais / 1e6)} mi`;
  return `R$ ${n2.format(reais)}`;
}

/** Centavos → forma compacta conforme a magnitude: "R$ 11,10 bi", "R$ 2,88 mi", "R$ 223,6 mil", "R$ 950,00".
 *  Só apresentação: o valor exato (reaisExato) acompanha na consulta e no título. */
export function reaisCompacto(centavos) {
  if (centavos === null || centavos === undefined) return 'não informado';
  const r = centavos / 100;
  const a = Math.abs(r);
  if (a >= 1e9) return `R$ ${n2.format(r / 1e9)} bi`;
  if (a >= 1e6) return `R$ ${n2.format(r / 1e6)} mi`;
  if (a >= 1e3) return `R$ ${n1.format(r / 1e3)} mil`;
  return `R$ ${n2.format(r)}`;
}

export const percentualFonte = (v) => (v === null || v === undefined ? 'não informado' : `${n2.format(v)}%`);
