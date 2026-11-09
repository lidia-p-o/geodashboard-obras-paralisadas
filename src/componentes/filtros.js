// Bloco de filtros (3). Seleção territorial ≡ filtros UF/município (D-05).
import { ROTULO_SITUACAO } from '../mapa/simbologia.js';

export function iniciarFiltros(raiz, dados, store) {
  const selUF = raiz.querySelector('#filtro-uf');
  const selMun = raiz.querySelector('#filtro-municipio');
  const radios = raiz.querySelectorAll('input[name="situacao"]');
  const selSetor = raiz.querySelector('#filtro-setor');
  const setorTxt = raiz.querySelector('.recorte__setor');
  const macroTxt = raiz.querySelector('.recorte__macrocausa');
  const trilha = raiz.querySelector('.recorte__trilha');
  const situacao = raiz.querySelector('.recorte__situacao');
  const btTerr = raiz.querySelector('[data-acao="limpar-territorio"]');
  const btTudo = raiz.querySelector('[data-acao="limpar-tudo"]');
  const btDesfazer = raiz.querySelector('[data-acao="desfazer"]');
  const ufs = Object.values(dados.indicadores.UF).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  selUF.innerHTML = '<option value="">Todas</option>' + ufs.map((u) => `<option value="${u.sigla_uf}">${u.nome} (${u.sigla_uf})</option>`).join('');
  selUF.disabled = false;
  raiz.querySelector('fieldset').disabled = false;
  // Setores: categorias efetivamente presentes no campo `Setor` da base (dicionário de obras.json), sem alteração
  selSetor.innerHTML = '<option value="">Todos os setores</option>' + [...dados.obras.dicionarios.Setor]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).map((s) => `<option value="${s.replace(/"/g, '&quot;')}">${s}</option>`).join('');
  selSetor.disabled = false;
  raiz.querySelector('.filtros__estado').textContent = 'Os filtros atualizam indicadores, mapa, gráfico e tabela.';

  selUF.addEventListener('change', () => store.acoes.definirUF(selUF.value || null));
  selMun.addEventListener('change', () => store.acoes.definirMunicipio(selMun.value || null));
  radios.forEach((r) => r.addEventListener('change', () => r.checked && store.acoes.definirSituacao(r.value)));
  selSetor.addEventListener('change', () => store.acoes.definirSetor(selSetor.value || null));
  setorTxt.addEventListener('click', (e) => { if (e.target.closest('[data-remover="setor"]')) store.acoes.definirSetor(null); });
  macroTxt.addEventListener('click', (e) => { if (e.target.closest('[data-remover="macrocausa"]')) store.acoes.definirMacrocausa(null); });
  btTerr.addEventListener('click', () => store.acoes.limparTerritorio());
  btTudo.addEventListener('click', () => store.acoes.limparTudo());
  btDesfazer.addEventListener('click', () => store.acoes.desfazer());
  // Ctrl+Z / ⌘+Z desfaz a última seleção (exceto quando o foco está num campo de texto)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !e.target.closest('input[type="text"], textarea')) {
      if (store.acoes.desfazer()) e.preventDefault();
    }
  });
  trilha.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remover]');
    if (!b) return;
    if (b.dataset.remover === 'uf') store.acoes.limparTerritorio();
    if (b.dataset.remover === 'municipio') store.acoes.definirMunicipio(null);
  });

  let ufMunicipios = undefined;
  function render(estado, tipo) {
    if (['filtro', 'inicial', 'historico', 'obra'].includes(tipo)) {
      btDesfazer.disabled = !estado.historico;
      btDesfazer.title = estado.historico ? `Desfazer a última seleção (Ctrl+Z) · ${estado.historico} passo(s) disponível(is)` : 'Nada a desfazer';
    }
    if (!['filtro', 'inicial'].includes(tipo)) return;
    const f = estado.filtros;
    selUF.value = f.uf ?? '';
    if (ufMunicipios !== f.uf) {
      const muns = f.uf ? Object.values(dados.indicadores.MUNICIPIO).filter((m) => m.sigla_uf === f.uf)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : [];
      selMun.innerHTML = '<option value="">Todos</option>' + muns.map((m) => `<option value="${m.cd}">${m.nome}</option>`).join('');
      ufMunicipios = f.uf;
    }
    selMun.disabled = !f.uf;
    selMun.value = f.municipio ?? '';
    radios.forEach((r) => { r.checked = r.value === f.situacao; });
    selSetor.value = f.setor ?? '';

    const ufNome = f.uf ? dados.indicadores.UF[f.uf].nome : null;
    const munNome = f.municipio ? dados.indicadores.MUNICIPIO[f.municipio].nome : null;
    const chip = (rotulo, alvo) => `<span class="chip">${rotulo}<button type="button" class="chip__remover" data-remover="${alvo}" aria-label="Remover ${rotulo}">×</button></span>`;
    trilha.innerHTML = ['Brasil', ufNome && chip(ufNome, 'uf'), munNome && chip(munNome, 'municipio')]
      .filter(Boolean).join('<span class="recorte__sep" aria-hidden="true">›</span>');
    situacao.textContent = `Situação: ${ROTULO_SITUACAO[f.situacao]}`;
    setorTxt.innerHTML = f.setor ? `Setor: ${chip(f.setor, 'setor').replace('Remover ', 'Remover o setor ')}` : 'Setor: Todos os setores';
    btTerr.disabled = !f.uf;
    // Macrocausa (decisão 0009): linha só aparece com filtro ativo, para não alongar a coluna
    macroTxt.hidden = !f.macrocausa;
    macroTxt.innerHTML = f.macrocausa ? `Macrocausa: ${chip(f.macrocausa, 'macrocausa').replace('Remover ', 'Remover a macrocausa ')}` : '';
    btTudo.disabled = !f.uf && f.situacao === 'todas' && !f.setor && !f.macrocausa;
  }
  return render;
}
