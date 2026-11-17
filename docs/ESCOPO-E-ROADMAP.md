# Escopo e evolução

## 0.1.0 — Modelagem

Esta entrega prepara projetos e seções, materiais, terreno, regiões de solo, água, faixas de carga e círculo de tentativa. Inclui edição por desenho/coordenadas, histórico, persistência e relatório de entradas. Não calcula fator de segurança e não dimensiona contenções.

Limites de modelagem: 100 seções e 100 materiais por projeto; 64 regiões e 100 cargas por seção; 500 pontos por contorno; arquivos até 8 MB. Coordenadas limitadas a ±1.000.000 m. Não há importação DXF/DWG, estágios construtivos, faces verticais, overhangs, cálculo de fluxo, água externa ou análise sísmica. O nome de uma seção não cria cenário de cálculo: cenários ainda não têm modelo próprio nesta etapa.

## Base técnica

- [#28 — Roadmap](https://github.com/ricardocorsini/openstruct-front/issues/28): primeiro motor determinístico 2D, superfícies circulares, Mohr–Coulomb, Fellenius e Bishop Simplificado.
- [#29 — Bibliografia](https://github.com/ricardocorsini/openstruct-front/issues/29): seleção aprovada pelo Eng. Gustavo Azocar. Referências principais: Duncan, Wright e Brandon (2014) e USACE EM 1110-2-1902 (2003).
- [#30 — Especificação](https://github.com/ricardocorsini/openstruct-front/issues/30), [PR #37](https://github.com/ricardocorsini/openstruct-front/pull/37): documento candidato; D1–D5 aprovadas como base, R0–R6, consulta direta de Bishop e aceite final pendentes na consulta de 17/11/2026.
- [#31 — Validação](https://github.com/ricardocorsini/openstruct-front/issues/31): catálogo de casos independentes e tolerâncias ainda pendente na mesma consulta.

Os testes de modelagem deste repositório não substituem os casos geotécnicos da #31. Os exemplos têm números ilustrativos, sem origem experimental e sem resultados de estabilidade associados.

## Sequência proposta

1. Revisar usabilidade e persistência da modelagem com usuários; conferir o aplicativo nativo nos sistemas de destino.
2. Concluir a especificação #30 e o catálogo #31. Definir contrato do motor, perfis numéricos, materiais/água e comportamento de falhas.
3. Implementar preparação de fatias e cálculo em superfície fixa. Validar geometria e forças, além das equações, com referências independentes.
4. Implementar busca circular determinística, progresso, cancelamento, inspeção por fatia e memória rastreável. Vincular resultados à revisão de entrada e invalidá-los quando ela mudar.
5. Preparar distribuição assinada no catálogo/Launcher do OpenStruct, documentação de instalação e procedimento de atualização.
6. Especificar métodos rigorosos, superfícies não circulares e estabilidade com reforços. Especificar separadamente verificações/dimensionamento das contenções.

Slide2 e GEO5 são referências de produto e comparação controlada. Seus padrões de tela, exemplos ou configurações não substituem decisões de engenharia nem servem, isoladamente, como fonte governante das equações. Critérios normativos de aceitação têm etapa própria.
