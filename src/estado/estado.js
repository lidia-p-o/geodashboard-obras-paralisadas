// Estado compartilhado (docs/especificacao-interface.md §2; integração: etapa 08).
// Seleção territorial ≡ filtros uf/municipio (D-05). Zoom/deslocamento do mapa NÃO fazem parte do estado.
// Todas as vistas enviam ações para cá; nenhuma vista altera outra diretamente.

export const ESTADO_INICIAL = Object.freeze({
  filtros: { uf: null, municipio: null, situacao: 'todas', setor: null, macrocausa: null }, // setor: categoria de `Setor`; macrocausa: categoria de `Macrocausa da paralisação` (null = todas)
  obraSelecionada: null,
  tabela: { ordem: { coluna: 'valor', direcao: 'desc' }, pagina: 1 },
  realce: null,          // passagem do cursor { nivel, chave } — transitório, não altera dados
  aviso: null,           // mensagem curta de contexto (ex.: obra fora do recorte)
  historico: 0,          // nº de seleções que podem ser desfeitas
});

const LIMITE_HISTORICO = 50;

/**
 * @param {object} opcoes
 * @param {(cd: string) => string|null} [opcoes.ufDoMunicipio] sigla da UF de um município (consistência UF × município)
 */
export function criarEstado({ ufDoMunicipio = () => null } = {}) {
  let estado = structuredClone(ESTADO_INICIAL);
  const inscritos = new Set();
  // Pilha de seleções anteriores: { filtros, obraSelecionada }. Ordenação, paginação e realce não entram.
  const pilha = [];
  let emitindo = 0;
  let emAcao = 0; // ações compostas (ex.: selecionarTerritorio → definirUF) contam como um só passo

  const emitir = (tipo) => {
    emitindo++;
    try { inscritos.forEach((fn) => fn(estado, tipo)); } finally { emitindo--; }
  };
  const atualizar = (parcial, tipo) => { estado = { ...estado, ...parcial, historico: pilha.length }; emitir(tipo); };
  const filtros = (f) => ({ filtros: { ...estado.filtros, ...f }, tabela: { ...estado.tabela, pagina: 1 }, aviso: null });

  const instantaneo = () => ({ filtros: { ...estado.filtros }, obraSelecionada: estado.obraSelecionada });
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /**
   * Envolve uma ação de seleção: registra o estado anterior para "desfazer" se a seleção mudar.
   * Ações disparadas como CONSEQUÊNCIA de outra (durante a emissão, ex.: fechar o detalhe de uma obra
   * que saiu do recorte) fazem parte do mesmo passo e não geram entrada própria.
   */
  function selecao(fn) {
    return (...args) => {
      if (emitindo || emAcao) return fn(...args);
      const antes = instantaneo();
      emAcao++;
      let r;
      try { r = fn(...args); } finally { emAcao--; }
      if (!igual(antes, instantaneo())) {
        pilha.push(antes);
        if (pilha.length > LIMITE_HISTORICO) pilha.shift();
        estado = { ...estado, historico: pilha.length };
        emitir('historico');
      }
      return r;
    };
  }

  const acoes = {
    definirUF: selecao((uf) => {
      if ((uf || null) === estado.filtros.uf && !estado.filtros.municipio) return;
      atualizar(filtros({ uf: uf || null, municipio: null }), 'filtro');
    }),
    /** Regra 9: o município é sempre coerente com a UF (o município define a UF a que pertence). */
    definirMunicipio: selecao((cd) => {
      if (!cd) { if (estado.filtros.municipio) atualizar(filtros({ municipio: null }), 'filtro'); return; }
      const uf = ufDoMunicipio(cd);
      if (!uf || cd === estado.filtros.municipio) return;
      atualizar(filtros({ uf, municipio: cd }), 'filtro');
    }),
    /** Macrocausa só se aplica a paralisadas (decisão 0009): outra situação remove a macrocausa ativa, com aviso. */
    definirSituacao: selecao((s) => {
      if (s === estado.filtros.situacao) return;
      const m = estado.filtros.macrocausa;
      if (m && s !== 'paralisadas') {
        atualizar({ ...filtros({ situacao: s, macrocausa: null }), aviso: `Filtro de macrocausa "${m}" removido: macrocausas de paralisação só se aplicam a obras paralisadas.` }, 'filtro');
        return;
      }
      atualizar(filtros({ situacao: s }), 'filtro');
    }),
    /** Filtro setorial (um setor por vez; null = todos os setores). Não altera os demais filtros. */
    definirSetor: selecao((s) => { if ((s || null) !== estado.filtros.setor) atualizar(filtros({ setor: s || null }), 'filtro'); }),
    /** Filtro por macrocausa (decisão 0009): uma por vez; aplica-se só a paralisadas, por isso fixa a situação
     *  em "Paralisadas" no MESMO passo de desfazer. null remove a macrocausa (a situação permanece). */
    definirMacrocausa: selecao((m) => {
      m = m || null;
      if (m === estado.filtros.macrocausa) return;
      atualizar(filtros(m ? { macrocausa: m, situacao: 'paralisadas' } : { macrocausa: null }), 'filtro');
    }),
    /** Clique em barra de macrocausa: seleciona; clique repetido na mesma barra remove o filtro. */
    selecionarMacrocausa: selecao((m) => acoes.definirMacrocausa(m === estado.filtros.macrocausa ? null : m)),

    /** Clique em polígono ou barra (E05–E08); clique repetido desfaz o nível (E07). */
    selecionarTerritorio: selecao((nivel, chave) => {
      const f = estado.filtros;
      if (nivel === 'UF') {
        if (f.uf === chave && !f.municipio) return acoes.limparTerritorio();
        return acoes.definirUF(chave);
      }
      if (f.municipio === chave) return acoes.definirMunicipio(null);
      return acoes.definirMunicipio(chave);
    }),
    /** E13 / regra 10: remove UF e município; preserva situação, setor, macrocausa e a obra aberta (se continuar no recorte). */
    limparTerritorio: selecao(() => { if (estado.filtros.uf) atualizar(filtros({ uf: null, municipio: null }), 'filtro'); }),
    /** E14: estado inicial (pedido explícito). */
    limparTudo: selecao(() => {
      estado = { ...structuredClone(ESTADO_INICIAL), historico: pilha.length };
      emitir('filtro');
    }),

    selecionarObra: selecao((id) => { if (id !== estado.obraSelecionada) atualizar({ obraSelecionada: id, aviso: null }, 'obra'); }),
    fecharDetalhe: selecao((aviso = null) => { if (estado.obraSelecionada || aviso) atualizar({ obraSelecionada: null, aviso }, 'obra'); }),

    /** Desfaz a última seleção (filtros, território, situação ou obra), restaurando o estado anterior exato. */
    desfazer() {
      if (emitindo || !pilha.length) return false;
      const anterior = pilha.pop();
      const mudouFiltro = !igual(anterior.filtros, estado.filtros);
      estado = {
        ...estado, filtros: anterior.filtros, obraSelecionada: anterior.obraSelecionada,
        tabela: mudouFiltro ? { ...estado.tabela, pagina: 1 } : estado.tabela, aviso: null, historico: pilha.length,
      };
      emitir(mudouFiltro ? 'filtro' : 'obra');
      return true;
    },

    ordenar(coluna) {
      const o = estado.tabela.ordem;
      const direcao = o.coluna === coluna && o.direcao === 'desc' ? 'asc' : 'desc';
      atualizar({ tabela: { ordem: { coluna, direcao }, pagina: 1 } }, 'tabela');
    },
    paginar(pagina) { atualizar({ tabela: { ...estado.tabela, pagina } }, 'tabela'); },

    realcar(alvo) {
      const a = estado.realce;
      if ((a && alvo && a.nivel === alvo.nivel && a.chave === alvo.chave) || (!a && !alvo)) return;
      atualizar({ realce: alvo }, 'realce');
    },
  };

  return {
    obter: () => estado,
    inscrever(fn) { inscritos.add(fn); return () => inscritos.delete(fn); },
    acoes,
  };
}
