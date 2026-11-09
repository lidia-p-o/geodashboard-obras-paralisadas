// Carrega os arquivos processados via HTTP (servidor local). Não recalcula indicadores nem classes.
const BASE = 'dados/processados';

async function json(caminho) {
  const r = await fetch(caminho, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Falha ao carregar ${caminho} (HTTP ${r.status})`);
  return r.json();
}

function validar(obras, indicadores, referencia, estados) {
  const erros = [];
  const n = obras.n;
  for (const [nome, col] of Object.entries(obras.colunas)) if (col.length !== n) erros.push(`coluna ${nome} com ${col.length} ≠ ${n}`);
  if (n !== referencia.metadados.registros_obra) erros.push('nº de obras difere dos metadados');
  if (Object.keys(indicadores.UF).length !== 27) erros.push('indicador UF sem 27 unidades');
  if (estados.features.length !== 27) erros.push('malha de estados sem 27 feições');
  if (erros.length) throw new Error(`Dados inconsistentes: ${erros.join('; ')}`);
}

export async function carregarDados() {
  const [obras, indicadores, referencia, estados, indiceMalha] = await Promise.all([
    json(`${BASE}/web/obras.json`),
    json(`${BASE}/web/indicadores.json`),
    json(`${BASE}/web/referencia.json`),
    json(`${BASE}/cartografia/estados.geojson`),
    // Índice de validação da malha municipal (validar_malha_municipal.py). Se faltar, nenhuma UF desce ao nível municipal.
    json(`${BASE}/cartografia/municipios/indice.json`).catch(() => ({ ufs: {}, areas_nao_municipais: [] })),
  ]);
  validar(obras, indicadores, referencia, estados);
  return { obras, indicadores, referencia, estados, indiceMalha };
}

const cacheMunicipios = new Map();
/** Malha municipal de uma UF (carregada sob demanda e mantida em cache). */
export function carregarMunicipiosUF(sigla) {
  if (!cacheMunicipios.has(sigla)) {
    cacheMunicipios.set(sigla, json(`${BASE}/cartografia/municipios/${sigla}.json`));
  }
  return cacheMunicipios.get(sigla);
}

/**
 * Regra 12 — o nível municipal só é exibido quando dados e geometrias estão disponíveis e validados.
 * 1) o índice gerado no processamento marca a UF como "validado";
 * 2) a malha carregada confere com o indicador: todo município do indicador tem geometria, e toda
 *    geometria extra é uma área não municipal documentada no índice.
 * Retorna { ok, motivo }.
 */
export function verificarMalhaUF(sigla, geo, indicadores, indiceMalha) {
  const reg = indiceMalha?.ufs?.[sigla];
  if (!reg || reg.status !== 'validado') return { ok: false, motivo: 'malha municipal não validada para esta UF' };
  if (!geo?.features?.length) return { ok: false, motivo: 'malha municipal indisponível' };
  const cdsGeo = new Set(geo.features.map((f) => f.properties.CD_MUN));
  const extras = new Set(indiceMalha.areas_nao_municipais ?? []);
  const doIndicador = Object.values(indicadores.MUNICIPIO).filter((t) => t.sigla_uf === sigla).map((t) => t.cd);
  const semGeo = doIndicador.filter((cd) => !cdsGeo.has(cd));
  const naoDoc = [...cdsGeo].filter((cd) => !doIndicador.includes(cd) && !extras.has(cd));
  if (semGeo.length) return { ok: false, motivo: `${semGeo.length} município(s) do indicador sem geometria` };
  if (naoDoc.length) return { ok: false, motivo: `${naoDoc.length} geometria(s) sem correspondência no indicador` };
  if (geo.features.length !== reg.n_geometrias) return { ok: false, motivo: 'malha difere da versão validada' };
  return { ok: true, motivo: '' };
}

/** Carrega e verifica a malha municipal da UF; nunca lança erro (falha → { ok: false }). */
export async function obterMunicipiosValidados(sigla, indicadores, indiceMalha) {
  if (indiceMalha?.ufs?.[sigla]?.status !== 'validado') return { ok: false, motivo: 'malha municipal não validada para esta UF', geo: null };
  try {
    const geo = await carregarMunicipiosUF(sigla);
    return { ...verificarMalhaUF(sigla, geo, indicadores, indiceMalha), geo };
  } catch (e) {
    cacheMunicipios.delete(sigla);
    return { ok: false, motivo: 'falha ao carregar a malha municipal', geo: null };
  }
}
