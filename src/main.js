// Ponto de entrada: carrega dados processados, cria o estado compartilhado e conecta as vistas.
// Fluxo: evento → ação → estado → seletores → vistas (docs/especificacao-interface.md §4).
import { carregarDados } from './dados/carregador.js';
import { prepararObras } from './dados/seletores.js';
import { criarRecorte } from './dados/recorte.js';
import { criarEstado } from './estado/estado.js';
import { configurarSimbologia } from './mapa/simbologia.js';
import { iniciarMapa } from './mapa/mapa.js';
import { iniciarCabecalho } from './componentes/cabecalho.js';
import { iniciarIndicadores } from './componentes/indicadores.js';
import { iniciarFiltros } from './componentes/filtros.js';
import { iniciarBarras } from './componentes/barras.js';
import { iniciarTabela } from './componentes/tabela.js';
import { iniciarMacrocausas } from './componentes/macrocausas.js';
import { iniciarDetalhe } from './componentes/detalhe.js';

const status = document.getElementById('estado-carregamento');
iniciarCabecalho();

function falha(erro) {
  console.error(erro);
  document.body.dataset.estado = 'erro';
  status.textContent = `Não foi possível carregar os dados: ${erro.message}. Abra a página por um servidor HTTP local (README).`;
  document.querySelectorAll('[data-carregando]').forEach((el) => { el.dataset.carregando = 'false'; });
  document.querySelectorAll('.estado-vazio__titulo').forEach((el) => { el.textContent = 'Dados indisponíveis'; });
}

carregarDados().then((brutos) => {
  const dados = { ...brutos, obras: prepararObras(brutos.obras) };
  dados.recorte = criarRecorte(dados); // filtragem e agregação centralizadas (uma por combinação de filtros)
  configurarSimbologia(dados.referencia);
  const store = criarEstado({ ufDoMunicipio: (cd) => dados.indicadores.MUNICIPIO[cd]?.sigla_uf ?? null });

  // Regra de pertinência do detalhe (registrada primeiro)
  store.inscrever((estado, tipo) => {
    if (tipo === 'filtro' && estado.obraSelecionada
      && !dados.recorte(estado.filtros).indices.includes(dados.obras.porId.get(estado.obraSelecionada))) {
      store.acoes.fecharDetalhe('A obra selecionada não pertence ao novo recorte; o detalhe foi fechado.');
    }
  });

  const vistas = [
    iniciarIndicadores(document.querySelector('.indicadores'), dados, store),
    iniciarFiltros(document.querySelector('.filtros'), dados, store),
    iniciarBarras(document.querySelector('.barras'), dados, store),
    iniciarMacrocausas(document.querySelector('.macrocausas'), dados, store),
    iniciarTabela(document.querySelector('.tabela'), dados, store),
    iniciarDetalhe(document.getElementById('painel-detalhe'), dados, store),
  ];
  vistas.forEach((v) => store.inscrever(v));
  document.querySelectorAll('[data-carregando]').forEach((el) => { el.dataset.carregando = 'false'; });
  document.querySelector('.mapa__conteiner .estado-vazio')?.remove();
  const mapa = iniciarMapa(document.getElementById('mapa'), dados, store);
  vistas.forEach((v) => v(store.obter(), 'inicial'));

  document.body.dataset.estado = 'pronto';
  status.textContent = `Dados carregados: ${dados.obras.n.toLocaleString('pt-BR')} obras · data-base abr/2025.`;
  window.__geodashboard = { store, dados, mapa }; // apoio a testes automatizados (somente leitura)
}).catch(falha);
