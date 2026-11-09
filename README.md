# Painel de Obras Paralisadas — geodashboard

Geodashboard experimental desenvolvido para a dissertação de mestrado em Engenharia Urbana (UFU).
Mostra as obras não concluídas da base do TCU por UF e município: investimento previsto total (R$),
situação (paralisadas / em execução), setor e macrocausas de paralisação.

**Acesse:** https://USUARIO.github.io/geodashboard-obras/

## Fontes dos dados

- TCU — Painel de Obras Paralisadas (data-base abr/2025).
- IBGE — estimativas da população (01/07/2026) e Malha Municipal 2025 (simplificada para a web).

Os arquivos em `dados/processados/` são derivados dessas bases públicas; o processamento completo,
os testes e a documentação ficam no repositório de trabalho da autora.

## Tecnologia

HTML, CSS e JavaScript, sem servidor nem banco de dados. Mapa com [Leaflet 1.9.4](https://leafletjs.com)
(licença BSD-2-Clause, incluído em `src/vendor/`).

Versão: 1.0.0-rc7.
