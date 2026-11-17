# Pressões de água nas bases — contrato 1

Esta etapa prepara a pressão prescrita na base de cada fatia, conforme o recorte de D2 aprovado na [issue #30](https://github.com/ricardocorsini/openstruct-front/issues/30#issuecomment-6850038580). Não calcula forças de água, pressão usada na resistência, tensões efetivas, equilíbrio ou FS. Os itens restantes R0–R6 e o aceite integral da especificação continuam pendentes.

## Regra, ponto e fontes

Com Z positivo para cima, interpolar linearmente a linha piezométrica na abscissa do ponto representativo: `h = zp(xa) − za` e `u = γw max(0, h)`. Usar o γw positivo informado, em kN/m³; h em m e u em kPa. Preservar a diferença de cotas com sinal, a altura positiva usada e a pressão. Não incorporar sucção nem multiplicar por comprimento de base nesta etapa. No estado explicitamente seco, u = 0, sem inventar linha ou γw.

O ponto `(xa, za)` é o **ponto médio angular do arco** já registrado em `geostruct-fixed-geometry/2`, onde a tangente é paralela à corda. Não é o ponto médio da corda ou da largura horizontal. Esta escolha fica explícita no contrato e na inspeção; segue a preparação geométrica existente e a proposta do §2 da [especificação candidata](https://github.com/ricardocorsini/openstruct-front/issues/30#issuecomment-6863167450), sem declarar encerrada a revisão R1. A linha é avaliada pela altura vertical, não pela distância perpendicular à base. Em um nó compartilhado, o segmento anterior fornece a origem da interpolação; no primeiro nó, usa-se o primeiro segmento.

Fonte consultada: USACE EM 1110-2-1902 (31/10/2003), §F-2b(11–12), §F-6b e §D-11b, no [manual original em cópia pública](https://damtoolbox.org/images/8/83/Slope_Stability_Document.pdf). O manual relaciona pressão e altura piezométrica no centro da base, distingue forças externas de água e discute a hipótese de desprezar pressões negativas. O recorte e o ponto numérico aqui usados são os explicitados acima, não uma validação de estabilidade pelo manual.

## Cobertura e limites desta preparação

1. Exigir entrada disponível e geometria preparada da mesma revisão, preservando perfil e contrato de origem. Pressões independem dos pesos próprios; γ de solo ausente não impede avaliar água se a geometria estiver disponível.
2. Em condição piezométrica, exigir pelo menos dois pontos finitos com X estritamente crescente e γw positivo finito. Não definir um γw padrão. Origem vazia permanece identificada como não informada e mantém a pendência do cadastro.
3. Exigir cobertura de **todo o intervalo horizontal do círculo preparado**, inclusive suas extremidades. Cobrir só os pontos representativos não basta; a linha não precisa cobrir trechos da seção fora do candidato. Não extrapolar, prolongar ou ajustar nós. A conferência de pressões é estrita; a tolerância geométrica não autoriza extensão da linha.
4. Conferir a posição em relação ao terreno em todos os nós de ambas as polilinhas dentro do intervalo, além das extremidades. Como a diferença é linear entre nós, essa verificação abrange os intervalos. Em uma face vertical interior, usar o menor dos limites laterais; nas extremidades do candidato, usar o lado interior.
5. Linha acima do terreno bloqueia **esta preparação**, com localização e indicação de que carga confinada e lâmina externa ainda precisam de tratamento próprio. Não afirmar que toda carga acima do terreno é lâmina externa. Essa restrição operacional conserva o recorte atual enquanto R2 está aberto; geometria e peso próprio continuam disponíveis. A comparação admite apenas arredondamento aritmético de interpolação (`32 × Number.EPSILON × escala das cotas`), não uma altura de lâmina permitida.
6. Zero é resultado da condição seca ou de h ≤ 0, nunca substituto para entrada ausente ou erro. Rejeitar produto/soma não finito e produto positivo perdido por subfluxo numérico. Não usar a tolerância geométrica como limiar para zerar uma pressão pequena. Não arredondar intermediários.

O modo de resistência efetivo/total não modifica a pressão física preparada. A futura pressão usada nas equações (`u_e`), inclusive o tratamento do modo total ou misto, será outro passo da especificação. Os pesos específicos totais dos solos permanecem inalterados. Não somar pressões em kPa para apresentar uma força total.

## Consulta, revisão e arquivo

**Preparar fatias** prepara também as pressões quando as entradas permitem. **Inspecionar fatias → Pressões de água** apresenta condição, origem, γw, cobertura e pontos, cota piezométrica, alturas, segmento de origem e pressão por fatia. A faixa mínima/máxima se refere aos pontos amostrados, não a um extremo contínuo no arco. A tabela geral mostra u em kPa; quando bloqueado, mostra Pendente.

O contrato imutável `geostruct-slice-pressures/1`, etapa `pore-pressure-only`, mantém revisão e perfil. Rascunhos ocultam a consulta até aplicar ou descartar. Mudanças aplicadas, troca de perfil e histórico seguem a revisão da entrada. Preparar/consultar não altera o projeto ou o histórico; o arquivo continua `geostruct/4`, sem persistir resultados.

## Casos independentes e sequência

- Círculo de centro (0, 4), raio 5 e terreno Z = 0: ponto central do arco (0, −1). Para linha Z = −0,5 e γw = 10, h = 0,5 m e u = **5 kPa**. Com linha em −1 ou abaixo, u central = 0.
- Linha inclinada `zp = a + bx`: calcular a cota e a pressão nos pontos analíticos do arco; conferir que a altura é vertical e que pontos da corda não são usados.
- Cobertura integral, falta de cobertura mesmo com todos os centros cobertos, nós intermediários, faces verticais, γw ausente/inválido, pressão pequena positiva, estado seco explícito e mudança de modo de resistência.
- Translação, espelhamento, escala, refinamento e conservação dos arquivos/entradas. Refinar muda a amostragem e não deve ser tratado como conservação da soma das pressões.

Próxima etapa: preparar resultantes das faixas de sobrecarga e seus pontos de aplicação, consolidando sinais e braços de momento antes das equações de equilíbrio.
