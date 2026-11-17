# Sobrecargas nas fatias

Esta etapa aplica o recorte de D3 aprovado na [issue #30](https://github.com/ricardocorsini/openstruct-front/issues/30#issuecomment-6850038580): faixa vertical uniforme, resultante no centro da largura horizontal carregada e braço próprio. Prepara forças e momentos das sobrecargas, sem combiná-los com peso, água ou resistência e sem calcular equilíbrio ou FS. A [PR #37](https://github.com/ricardocorsini/openstruct-front/pull/37) continua candidata; R0–R6 e o aceite final não são encerrados por esta implementação.

## Resultante e sinais

Para cada faixa ativa j e fatia i, recortar os intervalos horizontais. Se `a = max(xesq,i, x1,j)` e `b = min(xdir,i, x2,j)`, há contribuição somente quando `b > a`:

| Grandeza | Definição                | Unidade |
| -------- | ------------------------ | ------- |
| Lij      | b − a                    | m       |
| Qij      | qj × Lij, descendente    | kN/m    |
| xq,ij    | a + Lij/2                | m       |
| zq,ij    | cota do terreno em xq,ij | m       |
| dCCW,ij  | xc − xq,ij               | m       |
| MCCW,ij  | Qij × dCCW,ij            | kN·m/m  |

Coordenadas originais: X para a direita, Z para cima. Momento positivo significa rotação anti-horária (CCW) no desenho X/Z. Pela expressão plana `M = rx Fz − rz Fx`, com `Fx = 0` e `Fz = −Q`, resulta `M = Q (xc − xq)`. Z identifica um ponto da linha de ação no terreno; não altera o momento da força vertical. O braço é avaliado como `(xc − a) − L/2` para reduzir perda de precisão por translação. Não se usa arco, corda, comprimento inclinado do terreno ou o centro da largura inteira da fatia como substituto do trecho carregado.

No ramo inferior, o sentido esquerda→direita corresponde à rotação anti-horária; direita→esquerda, à horária. O contrato também fornece braço e momento orientados ao movimento: multiplicar os valores CCW por +1 ou −1, respectivamente. Se o sentido não foi definido, esses campos são `null`, mas as resultantes e os momentos CCW permanecem disponíveis. Essa transformação cinemática não é o denominador de Fellenius/Bishop nem um critério de admissibilidade. O teste de espelhamento confere o recorte de sinais de R0, sem declarar aceite integral da especificação.

As forças têm unidade por metro fora do plano. Momento zero não significa força zero: carga alinhada ao centro continua presente. Momentos negativos são preservados; não há módulo, descarte de parcelas resistentes ou arredondamento antes da soma.

## Entrada, falhas e rastreabilidade

`prepareSliceLoads` consome a entrada efetiva `geostruct-input/1` e a geometria preparada `geostruct-fixed-geometry/2` da mesma revisão. Retorna `geostruct-slice-loads/1`, estágio `surcharge-resultants-only`, imutável, com perfil geométrico, convenção, sentido, seleção do caso, totais por faixa e por fatia e contribuições por ID/origem. Os totais usam soma compensada, inclusive para momentos com sinais opostos.

- A escolha explícita sem sobrecargas produz zero. Campos guardados e inativos não são ativados; a resolução de herança/seleção continua no adaptador de entradas.
- Cada faixa mantém seu ID mesmo com nome repetido. Sobreposições são aditivas. Não se soma largura como se fosse união geométrica de faixas.
- Contato em um extremo e faixas fora da massa têm largura carregada zero. Seu cadastro permanece na inspeção dos totais por faixa; não recebem ponto de aplicação fictício nem contribuição de fatia.
- `q = 0` conhecido permanece como contribuição de largura positiva, com ponto e braço. `q = null` em faixa que intercepta a massa bloqueia a preparação completa, sem total parcial. Nulo fora da massa é conservado e não entra no cálculo.
- Faixas ativas precisam de IDs únicos, limites finitos, extensão positiva e cobertura pelo terreno. Intensidade contribuinte deve ser finita e não negativa. Não há extrapolação, tolerância de captura do editor ou exclusão de pequenas contribuições positivas.
- Entrada indisponível, geometria inválida/desatualizada, condição não definida, erros de cadastro, overflow ou produto não nulo que desapareça por underflow produzem diagnóstico. Pesos e pressões são preparações independentes.

As inspeções são derivadas somente dos dados aplicados. Alterar perfil, dados, caso, arquivo ou histórico exige a revisão correspondente; rascunhos do caso ocultam os resultados até aplicar/descartar. Nada novo é gravado no projeto `geostruct/4`, no histórico ou nos relatórios de entradas.

## Casos independentes

Para `xc = 0`, uma faixa de 20 kPa em [−2, 0] resulta em 40 kN/m em X = −1 m e +40 kN·m/m CCW. Em [0, 2], a mesma força resulta em −40 kN·m/m. Ambas juntas produzem 80 kN/m e momento nulo, sem perder as parcelas. A faixa de 20 kPa em [−1, 1] tem 40 kN/m e momento global zero.

Os testes conferem esses balanços pela integração analítica no intervalo total, recorte parcial, faixa inclinada em projeção horizontal, superposição, sentidos e espelhamento, translação, escala, refinamento, zeros/nulos, condições próprias/herdadas, falhas e imutabilidade. Casos de interface conferem inspeção, arquivo, revisão, rascunho e histórico. São verificações desta preparação, não validação de estabilidade da #31.

## Referência de estática

[Engineering Statics, §7.8 — Distributed Loads](https://engineeringstatics.org/distributed-loads.html), texto dos autores disponível online, consultado em 17/11/2026: a força equivalente integra a intensidade; sua linha de ação passa pelo centroide da distribuição. Para o retângulo uniforme, fica no ponto médio. O sinal acima é derivado explicitamente em X/Z e testado por integração e espelhamento. Nenhum valor de FS ou limite normativo é extraído dessa referência.
