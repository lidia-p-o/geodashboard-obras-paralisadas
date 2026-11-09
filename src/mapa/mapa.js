// Mapa coroplético (Leaflet). Reage ao estado; ações do usuário são enviadas ao estado.
// Zoom e deslocamento só alteram o enquadramento (não geram ações). Sem mapa-base externo.
/* global L */
import { obterMunicipiosValidados } from '../dados/carregador.js';
import { preenchimento, limitesLegenda, especiais, ROTULO_SITUACAO, defsPadroes } from './simbologia.js';
import { reaisCompacto, inteiro, reaisExato } from '../componentes/formatacao.js';

const ESTILO_BASE = { weight: 0.6, color: '#ffffff', opacity: 1, fillOpacity: 1 };

export function iniciarMapa(elemento, dados, store) {
  const mapa = L.map(elemento, {
    zoomSnap: 0.25, minZoom: 3, maxZoom: 12, attributionControl: true,
    maxBounds: [[-45, -95], [15, -15]], preferCanvas: false,
  });
  mapa.attributionControl.setPrefix(false);
  mapa.attributionControl.addAttribution('Malha: IBGE 2025 (simplificada) · Dados: TCU abr/2025; IBGE pop. 2026');

  mapa.setView([-14.5, -52], 4); // vista provisória; ajustada à malha logo abaixo
  // Padrão SVG (pontos da categoria zero)
  const renderizador = L.svg({ padding: 0.5 }).addTo(mapa);
  const svg = renderizador._container;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = defsPadroes();
  svg.insertBefore(defs, svg.firstChild);

  const camadaEstados = L.geoJSON(dados.estados, { renderer: renderizador, style: () => ESTILO_BASE });
  camadaEstados.addTo(mapa);
  const LIMITES_BRASIL_MALHA = camadaEstados.getBounds();
  // Enquadramento com margem à direita para a legenda (canto inferior direito, rc7): o território não fica sob ela.
  // Só apresentação: não altera camadas, eventos nem dados.
  const margens = (p) => {
    const leg = document.querySelector('#mapa .legenda');
    const larg = leg && leg.offsetWidth ? leg.offsetWidth : 214;
    return { paddingTopLeft: [p + 44, p], paddingBottomRight: [larg + p + 8, p] }; // 44 px: controles de zoom à esquerda
  };
  mapa.fitBounds(LIMITES_BRASIL_MALHA, margens(8));
  let camadaMunicipios = null;
  const camadasUF = new Map(); // camadas Leaflet já construídas por UF (evita refazer a leitura da malha ao voltar a uma UF)
  let ufCarregada = null;
  let camadaSelecao = null;
  let camadaObra = null;
  let ultimaUF;

  const legenda = L.control({ position: 'bottomright' }); // lado direito, como na referência "Opção 3" (rc7)
  legenda.onAdd = () => L.DomUtil.create('div', 'legenda');
  legenda.addTo(mapa);

  const porChave = (territorios) => new Map(territorios.map((t) => [t.chave, t]));

  const AREAS_NAO_MUNICIPAIS = new Set(dados.indiceMalha?.areas_nao_municipais ?? []);

  /** Consulta aos atributos territoriais (regra 10): tudo vem de indicadores.json, sem recálculo. */
  let setorTooltip = null; // setor ativo, para identificar o recorte na consulta
  let macroTooltip = null; // macrocausa ativa (decisão 0009)
  function tooltip(t, props, nivel) {
    if (!t) {
      const cd = props?.CD_MUN;
      const nome = props?.NM_MUN ?? props?.NM_UF ?? '';
      return AREAS_NAO_MUNICIPAIS.has(cd)
        ? `<strong>${nome}</strong><br>Código IBGE ${cd}<br>Dado indisponível: área da malha IBGE que não é município (sem obras e sem população)`
        : `<strong>${nome}</strong><br>Dado indisponível: território sem registro no indicador`;
    }
    const linhas = [`<strong>${t.nome}${t.nivel === 'MUNICIPIO' ? ` / ${t.sigla_uf}` : ''}</strong>`];
    linhas.push(`<span class="mapa-tooltip__meta">${nivel === 'UF' ? 'UF' : 'Município'} · código IBGE ${t.cd}</span>`);
    if (t.status === 'sem_obras') {
      linhas.push('<em>Sem obras no recorte</em> — nenhum registro nesta situação');
    } else if (t.status === 'nao_informado') {
      linhas.push('<b>Valor não informado</b> — nenhuma obra do recorte tem valor de investimento na fonte (não é zero)');
      linhas.push(`Obras no recorte: ${inteiro(t.n_obras)}`);
    } else {
      linhas.push(`<b>${reaisCompacto(t.soma_centavos)}</b> · investimento previsto total${setorTooltip ? ` · setor ${setorTooltip}` : ''}${macroTooltip ? ` · macrocausa ${macroTooltip}` : ''}`);
      linhas.push(t.classe === 'zero' ? 'Investimento informado igual a zero' : `Classe ${t.classe} de 5`);
      linhas.push(`Valor exato: ${reaisExato(t.soma_centavos)}`);
      linhas.push(`Obras no recorte: ${inteiro(t.n_obras)}`);
      if (t.n_valor_ausente > 0) {
        linhas.push(`Soma dos valores informados: ${inteiro(t.n_valor_ausente)} obra(s) sem valor na fonte, não somada(s) (${t.ids_valor_ausente.join(', ')})`);
      }
    }
    linhas.push(`População IBGE 01/07/2026: ${t.populacao ? inteiro(t.populacao) : 'não informada'}${t.nota_pop ? ` (${t.nota_pop})` : ''}`);
    return linhas.join('<br>');
  }

  function ligarEventos(camada, nivel, territorios, situacao) {
    const mapaT = porChave(territorios);
    camada.eachLayer((l) => {
      const chave = nivel === 'UF' ? l.feature.properties.SIGLA_UF : l.feature.properties.CD_MUN;
      const t = mapaT.get(chave);
      l.setStyle({ ...ESTILO_BASE, fillColor: preenchimento(situacao, t?.classe ?? 'sem_dado') });
      l.unbindTooltip();
      l.bindTooltip(tooltip(t ? { ...t, cd: nivel === 'UF' ? l.feature.properties.CD_UF : chave } : null, l.feature.properties, nivel), { sticky: true, direction: 'top', className: 'mapa-tooltip' });
      l.off('click mouseover mouseout');
      l.on('click', (e) => { L.DomEvent.stop(e); if (t) store.acoes.selecionarTerritorio(nivel, chave); });
      l.on('mouseover', () => store.acoes.realcar({ nivel, chave }));
      l.on('mouseout', () => store.acoes.realcar(null));
      teclado(l, t ? `${t.nome}${nivel === 'MUNICIPIO' ? ` / ${t.sigla_uf}` : ''}` : (l.feature.properties.NM_MUN ?? ''));
    });
  }

  /** Polígonos recebem foco pelo Tab (Leaflet abre a dica no foco); Enter/Espaço equivalem ao clique (E05/E06). */
  function teclado(l, rotulo) {
    const el = l.getElement?.();
    if (!el) return;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', rotulo);
    if (el.dataset.teclado) return;
    el.dataset.teclado = '1';
    el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      l.fire('click', { originalEvent: ev, latlng: l.getBounds().getCenter() });
    });
  }

  function estilizarEstadosContexto(ufSel) {
    camadaEstados.eachLayer((l) => {
      const sigla = l.feature.properties.SIGLA_UF;
      l.setStyle({ weight: sigla === ufSel ? 1.4 : 0.8, color: '#7b8794', fillColor: '#e4e8ec', fillOpacity: sigla === ufSel ? 0 : 1 });
      l.unbindTooltip();
      l.bindTooltip(`${l.feature.properties.NM_UF} — clique para selecionar`, { sticky: true, className: 'mapa-tooltip' });
      l.off('click mouseover mouseout');
      l.on('click', (e) => { L.DomEvent.stop(e); if (sigla !== ufSel) store.acoes.definirUF(sigla); });
      teclado(l, `${l.feature.properties.NM_UF} — selecionar UF`);
    });
  }

  function desenharContorno(feature, secundario = false) {
    const grupo = L.layerGroup();
    if (!feature) return grupo;
    const halo = L.geoJSON(feature, { renderer: renderizador, interactive: false, style: { color: '#ffffff', weight: secundario ? 4 : 6, fill: false } });
    const linha = L.geoJSON(feature, { renderer: renderizador, interactive: false,
      style: { color: '#000000', weight: secundario ? 2 : 3, fill: false, dashArray: secundario ? '5 4' : null } });
    grupo.addLayer(halo).addLayer(linha);
    return grupo;
  }

  function featurePor(nivel, chave) {
    const camada = nivel === 'UF' ? camadaEstados : camadaMunicipios;
    if (!camada || !chave) return null;
    let f = null;
    camada.eachLayer((l) => {
      const k = nivel === 'UF' ? l.feature.properties.SIGLA_UF : l.feature.properties.CD_MUN;
      if (k === chave) f = l.feature;
    });
    return f;
  }

  /** Legenda (regra 9): intervalos numéricos das classes, unidade, situação e contagem de territórios exibidos. */
  function atualizarLegenda(nivel, situacao, territorios, nExtras, setorAtivo = null, macroAtiva = null) {
    const { rotulos: faixas, limitesCentavos } = limitesLegenda(nivel);
    const cont = {};
    territorios.forEach((t) => { cont[t.classe] = (cont[t.classe] ?? 0) + 1; });
    cont.sem_dado = (cont.sem_dado ?? 0) + nExtras;
    const esp = especiais();
    // UF: "(3 UFs)"; município: "(138)" — a unidade vai na linha de valores, para a legenda não alargar
    const unidadeNivel = (n) => (nivel === 'UF' ? ` ${n === 1 || n === 0 ? 'UF' : 'UFs'}` : '');
    // Formato compacto (rc7): "> 1 a 2 bi (3 UFs)". Categorias especiais só aparecem se houver território nelas;
    // as de contagem zero ficam no DOM (ocultas) para manter a contagem completa auditável.
    const item = (cat, cor, rotulo, padrao, titulo = '', ocultarSeZero = false) => {
      const n = cont[cat] ?? 0;
      return `<li data-categoria="${cat}"${titulo ? ` title="${titulo}"` : ''}${ocultarSeZero && !n ? ' hidden' : ''}><svg width="18" height="14" aria-hidden="true"><defs>${padrao ? defsPadroes() : ''}</defs>
      <rect width="18" height="14" rx="2" fill="${cor}" stroke="#bcc3ca" stroke-width="0.5"/></svg><span class="legenda__rotulo">${rotulo}</span><span class="legenda__qtd">(<span class="legenda__n">${inteiro(n)}</span>${unidadeNivel(n)})</span></li>`;
    };
    legenda.getContainer().innerHTML = `
      <p class="legenda__titulo">Investimento previsto (R$) <span class="legenda__situacao">${ROTULO_SITUACAO[situacao]}</span></p>${setorAtivo ? `<p class="legenda__setor">Setor: ${setorAtivo}</p>` : ''}${macroAtiva ? `<p class="legenda__macrocausa">Macrocausa: ${macroAtiva}</p>` : ''}
      <p class="legenda__texto legenda__unidade">Valores em R$ ${nivel === 'UF' ? 'bilhões' : 'milhões · (nº de municípios)'}</p>
      <ul class="legenda__lista">${faixas.map((f, i) => item(String(i + 1), preenchimento(situacao, i + 1), f, false,
        i < 4 ? `Até ${reaisExato(limitesCentavos[i])}, inclusive` : `Acima de ${reaisExato(limitesCentavos[3])}`)).join('')}</ul>
      <ul class="legenda__lista legenda__lista--especial">
        ${item('zero', preenchimento(situacao, 'zero'), 'Zero', true, '', true)}
        ${item('sem_obras', esp.sem_obras.preenchimento, esp.sem_obras.rotulo, false, '', true)}
        ${item('nao_informado', esp.nao_informado.preenchimento, esp.nao_informado.rotulo, false, '', true)}
        ${item('sem_dado', esp.sem_dado.preenchimento, esp.sem_dado.rotulo, false, '', true)}
      </ul>
      <p class="legenda__nota" title="Classes ${nivel === 'UF' ? 'estaduais' : 'municipais'} fixas, iguais nas três situações; limite superior incluído na classe.">Classes fixas nas três situações; limite superior incluído.</p>`;
  }

  async function renderizar(estado, tipo) {
    const { filtros } = estado;
    if (tipo === 'historico') return;
    if (tipo === 'realce' || tipo === 'tabela') {
      if (tipo === 'realce') aplicarRealce(estado.realce);
      return;
    }
    // Regra 12: desce ao nível municipal só com malha disponível e validada para a UF
    let nivel = 'UF';
    let motivoIndisponivel = '';
    if (filtros.uf) {
      if (ufCarregada === filtros.uf) nivel = 'MUNICIPIO';
      else {
        const r = await obterMunicipiosValidados(filtros.uf, dados.indicadores, dados.indiceMalha);
        if (store.obter().filtros.uf !== filtros.uf) return; // seleção mudou durante o carregamento
        if (camadaMunicipios) { mapa.removeLayer(camadaMunicipios); camadaMunicipios = null; ufCarregada = null; }
        if (r.ok) {
          // Enquadra ANTES de adicionar a malha: o Leaflet projeta os polígonos uma única vez (desempenho, RNF-03)
          if (ultimaUF !== filtros.uf) {
            mapa.fitBounds(L.geoJSON(featurePor('UF', filtros.uf)).getBounds(), { ...margens(12), animate: false });
            ultimaUF = filtros.uf;
          }
          if (!camadasUF.has(filtros.uf)) camadasUF.set(filtros.uf, L.geoJSON(r.geo, { renderer: renderizador }));
          camadaMunicipios = camadasUF.get(filtros.uf).addTo(mapa);
          ufCarregada = filtros.uf;
          nivel = 'MUNICIPIO';
        } else motivoIndisponivel = r.motivo;
      }
    }
    const fil = store.obter().filtros; // estado mais recente (após eventual carregamento da malha)
    setorTooltip = fil.setor;
    macroTooltip = fil.macrocausa;
    // recorte central (src/dados/recorte.js); se o nível municipal estiver indisponível, o mapa mostra as UFs da mesma situação
    const territorios = dados.recorte(nivel === 'UF' ? { ...fil, uf: null, municipio: null } : fil).territorios;
    let nExtras = 0;

    if (nivel === 'UF') {
      if (camadaMunicipios) { mapa.removeLayer(camadaMunicipios); camadaMunicipios = null; ufCarregada = null; }
      ligarEventos(camadaEstados, 'UF', territorios, fil.situacao);
    } else {
      estilizarEstadosContexto(fil.uf);
      ligarEventos(camadaMunicipios, 'MUNICIPIO', territorios, fil.situacao);
      camadaMunicipios.eachLayer((l) => { if (AREAS_NAO_MUNICIPAIS.has(l.feature.properties.CD_MUN)) nExtras++; });
    }
    avisoNivel(fil.uf && nivel === 'UF' ? `Nível municipal indisponível para ${fil.uf}: ${motivoIndisponivel}. O mapa permanece nas UFs.` : '');

    // Enquadramento só muda quando a UF muda (seleção), nunca por filtro de situação
    if (ultimaUF !== fil.uf) {
      // sem animação: uma nova seleção durante a animação de zoom seria descartada pelo Leaflet
      if (fil.uf) mapa.fitBounds(L.geoJSON(featurePor('UF', fil.uf)).getBounds(), { ...margens(12), animate: false });
      else mapa.fitBounds(LIMITES_BRASIL_MALHA, { ...margens(8), animate: false });
      ultimaUF = fil.uf;
    }

    // Regra 7: seleção por contorno (preto 3 px + halo branco); o preenchimento temático é mantido
    if (camadaSelecao) mapa.removeLayer(camadaSelecao);
    const sel = nivel === 'MUNICIPIO'
      ? (fil.municipio ? featurePor('MUNICIPIO', fil.municipio) : null)
      : (fil.uf ? featurePor('UF', fil.uf) : null);
    camadaSelecao = desenharContorno(sel).addTo(mapa);

    if (camadaObra) mapa.removeLayer(camadaObra);
    const cdObra = store.obter().obraSelecionada ? dados.obras.colunas.cd_mun[dados.obras.porId.get(store.obter().obraSelecionada)] : null;
    const fObra = cdObra && cdObra !== fil.municipio ? featurePor('MUNICIPIO', cdObra) : null;
    camadaObra = desenharContorno(fObra, true).addTo(mapa);

    atualizarLegenda(nivel, fil.situacao, territorios, nExtras, fil.setor, fil.macrocausa);
    elemento.dataset.nivel = nivel;
    elemento.dataset.uf = fil.uf ?? '';
  }

  function aplicarRealce(realce) {
    const alvoCamada = realce?.nivel === 'UF' ? camadaEstados : camadaMunicipios;
    [camadaEstados, camadaMunicipios].forEach((c) => c?.eachLayer((l) => {
      const el = l.getElement?.();
      if (el) el.classList.remove('poligono--realce');
    }));
    if (!realce || !alvoCamada) return;
    alvoCamada.eachLayer((l) => {
      const k = realce.nivel === 'UF' ? l.feature.properties.SIGLA_UF : l.feature.properties.CD_MUN;
      if (k === realce.chave) l.getElement()?.classList.add('poligono--realce');
    });
  }

  // Aviso de nível municipal indisponível (regra 12)
  const aviso = L.control({ position: 'topright' });
  aviso.onAdd = () => { const d = L.DomUtil.create('div', 'mapa__aviso'); d.setAttribute('role', 'status'); d.hidden = true; return d; };
  aviso.addTo(mapa);
  function avisoNivel(texto) { const d = aviso.getContainer(); d.textContent = texto; d.hidden = !texto; }

  // Botão de enquadramento: só altera a vista (não gera ação de estado — E10)
  const enquadrar = L.control({ position: 'topleft' });
  enquadrar.onAdd = () => {
    const b = L.DomUtil.create('button', 'mapa__enquadrar');
    b.type = 'button';
    b.title = 'Reenquadrar o território ativo (não altera os dados)';
    b.textContent = '⌂';
    L.DomEvent.disableClickPropagation(b);
    b.addEventListener('click', () => {
      const uf = store.obter().filtros.uf;
      mapa.fitBounds(uf ? L.geoJSON(featurePor('UF', uf)).getBounds() : LIMITES_BRASIL_MALHA, { ...margens(12), animate: false });
    });
    return b;
  };
  enquadrar.addTo(mapa);

  store.inscrever(renderizar);
  renderizar(store.obter(), 'filtro');

  /** Apoio a testes: estilo e tooltip atuais de um território, contornos ativos. */
  function inspecionar(nivel, chave) {
    const camada = nivel === 'UF' ? camadaEstados : camadaMunicipios;
    let r = null;
    camada?.eachLayer((l) => {
      const k = nivel === 'UF' ? l.feature.properties.SIGLA_UF : l.feature.properties.CD_MUN;
      if (k === chave) r = { fill: l.options.fillColor, fillOpacity: l.options.fillOpacity, tooltip: l.getTooltip()?.getContent() ?? '' };
    });
    return r;
  }
  const contornos = () => ({ selecao: camadaSelecao?.getLayers().length ?? 0, obra: camadaObra?.getLayers().length ?? 0 });
  const nPoligonos = () => { let n = 0; (camadaMunicipios ?? camadaEstados).eachLayer(() => { n++; }); return n; };
  return { mapa, inspecionar, contornos, nPoligonos };
}
