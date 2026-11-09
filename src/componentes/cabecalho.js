// Cabeçalho: abre/fecha o painel "Notas e limitações".
export function iniciarCabecalho() {
  const botao = document.getElementById('botao-notas');
  const painel = document.getElementById('painel-notas');
  if (!botao || !painel) return;
  const definir = (aberto) => { painel.hidden = !aberto; botao.setAttribute('aria-expanded', String(aberto)); };
  botao.addEventListener('click', () => definir(painel.hidden));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !painel.hidden) { definir(false); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('click', (e) => {
    if (!painel.hidden && !painel.contains(e.target) && !botao.contains(e.target)) definir(false);
  });
}
