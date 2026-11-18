# Bishop Simplificado em círculo fixo

Implementação do recorte autorizado pelo mantenedor na sequência de Fellenius, usando D1–D5 [aprovadas como base](https://github.com/ricardocorsini/openstruct-front/issues/30#issuecomment-6850038580). As regras abaixo tornam a execução deste incremento explícita; não constituem aceite integral de R0–R6, CA8 ou encerramento da [PR #37](https://github.com/ricardocorsini/openstruct-front/pull/37), que continua candidata. O catálogo independente da #31 e a consulta integral de Bishop (1955) permanecem pendentes.

## Formulação e limites

Fonte primária conferida: USACE EM 1110-2-1902 (2003), pp. F-6/F-7, eqs. F-4 a F-6 ([original oficial](https://www.publications.usace.army.mil/Portals/76/Publications/EngineerManuals/EM_1110-2-1902.pdf), [cópia integral consultada](https://damtoolbox.org/images/8/83/Slope_Stability_Document.pdf)). Usa `ue b` no numerador reduzido, conforme D1. A eq. C-15 do mesmo manual contém um fator sec α adicional na água; essa divergência foi registrada na candidata e a implementação segue F-4/F-6. Não se atribui ao manual a aprovação das políticas numéricas locais abaixo.

Para cada fatia, b = ℓ cos α, V = W + Q, t = tan φ; ue é u nas bases efetivas e zero nas totais. α é positivo ao descer no sentido escolhido. As forças são por unidade de largura fora do plano.

```text
D = Σ W sin α + Σ Mq/R
m(F) = cos α + sin α t/F
A(F) = [c b + (V − ue b)t] / m(F)
G(F) = Σ A(F) / D
N(F) = [V − ue b − c ℓ sin α/F] / m(F)
Ntotal(F) = N(F) + ue ℓ
σr(F) = N(F) / ℓ
```

Bishop resolve F = G(F). N é a normal usada na resistência (efetiva ou total segundo a base). Algebricamente, A(F) = cℓ + N(F)t. A equação vertical local usa o esforço mobilizado S = A/F; o equilíbrio global de momentos é satisfeito dentro do resíduo iterativo. Bishop Simplificado não fecha o equilíbrio horizontal global.

Círculo, cortes, base pela corda, pressão no meio angular, área até o arco e braço aproximado R sin α do peso são os da preparação vigente. Cada faixa conserva seu braço próprio −xq e seu momento com sinal; não é convertida em peso no centro da fatia. Bases devem ser todas efetivas ou todas totais; materiais diferentes são admitidos. Faces verticais que tocam a massa, modos mistos, água externa e extrapolação piezométrica continuam fora deste recorte. O círculo não é alterado para obter convergência.

## Perfil numérico da sessão

| Campo | Regra                                                                                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F₀    | Finito e estritamente positivo; primeira tentativa fornecida pelo usuário.                                                                                                                                  |
| τF    | Finito e positivo, adimensional; convergência se `abs(G(F) − F) ≤ τF`. Não é tolerância relativa, arredondamento da tela ou tolerância geométrica.                                                          |
| K     | Inteiro entre 1 e 1.000; conta avaliações de G, incluindo a inicial. 1.000 é limite operacional da execução síncrona, não recomendação de engenharia.                                                       |
| τm    | Finito e não negativo; cada m deve superar estritamente τm. Falha informa fatia, avaliação e valor. Não há amortecimento nem tentativa alternativa automática.                                              |
| τD    | Finito e não negativo, em kN/m; exige D > τD e D > `32 ε Σ abs(d)`, com soma compensada dos termos motrizes. O segundo corte protege contra cancelamento numérico indistinguível.                           |
| τt    | Finito e não negativo, em kPa; verifica σr somente no F convergido. σr < −τt rejeita. Negativo dentro da tolerância gera aviso e permanece bruto; sem corte, redistribuição ou abertura de fenda implícita. |

Os seis campos começam vazios. Não existe perfil geotécnico universal predefinido. Um perfil de conferência do exemplo transcrito é F₀ = 1,4, τF = 10⁻⁶, K = 20, τm = 0, τD = 10⁻⁸ kN/m e τt = 0 kPa; esses valores não são critérios de projeto.

A rotina aceita e retorna o **F avaliado**, mantendo G(F), resíduo e parcelas dessa mesma avaliação. Na última avaliação permitida, verifica a convergência antes de declarar esgotamento. Não retorna a atualização G(F) sem avaliar seu resíduo. Normais transitórias não provocam rejeição por tração. Na ausência de convergência, a inspeção de parcelas reduzidas continua disponível, com normais não avaliadas.

Finitude, overflow e produto/quociente não nulo que desaparece por underflow são verificados. Somas preservam sinais. Uma singularidade em certa tentativa encerra essa trajetória, sem afirmar que nenhuma outra raiz existe. Tentativas completas anteriores são identificadas como anteriores caso a seguinte seja interrompida.

## Estados e comparação

- `calculated`: F positivo, resíduo atendido e admissibilidade satisfeita. FS numérico disponível.
- `nonconverged`: K esgotado. Última tentativa, G e resíduo preservados; FS nulo.
- `zero-resistance`: todas as bases têm c = φ = 0, com D admissível. Não itera F = 0, pois a recorrência contém divisão por F; FS nulo neste método, sem verificação de normais em F zero. Fellenius mantém seu estado independente com FS = 0.
- `rejected`: entrada incompatível, singularidade, falha numérica, G não positivo por cancelamento ou tração excessiva. FS nulo. Não confundir convergência algébrica com admissibilidade.

Cada solver valida sua própria seleção e calcula suas normais. Falha de Fellenius não é pré-condição de Bishop, nem o inverso. A interface compara somente a mesma revisão, círculo e discretização, com resultados positivos admissíveis e igualdade de τD/τt. Exibe ΔFS = Bishop − Fellenius, sem eleger método vencedor ou aprovar estabilidade. Alterações no perfil removem a avaliação correspondente e a diferença; mudanças de dados, caso, arquivo, histórico ou refinamento invalidam a apresentação anterior.

O contrato imutável `geostruct-bishop/1` copia as entradas antes de congelá-las e conserva revisão, origem, perfil geométrico/numérico, trajetória e parcelas. Não altera o arquivo `geostruct/4`, não inclui resultados no relatório de entradas e não cria uma nova distribuição desktop.

## Casos independentes e precisão

1. Uma fatia com ℓ = 2 m, α = 30°, W = 100 kN/m, Q = 15 kN/m, R = 10 m, u = 10 kPa, c = 5 kPa e φ = 30°. Para a faixa em xq = −5, 0 ou +5 m, D = 57,5, 50 ou 42,5 kN/m. Definindo `a = c b + (V − ue b)tanφ`, a solução algébrica independente é `F = (a − D sinα tanφ)/(D cosα)`. Testa braço próprio, pressão, normal total/efetiva, equilíbrio vertical e resistência mobilizada. Margens de 5 × 10⁻¹² em FS e 5 × 10⁻¹⁰ kN/m no fechamento de momentos incluem o resíduo de 10⁻¹² e arredondamento de ponto flutuante.
2. φ = 0 e c > 0: F = Σcℓ/D, desde que admissível. Um F₀ igual à raiz pode ser aceito na primeira avaliação. Um F₀ com normal transitória negativa não bloqueia uma solução convergida sem tração.
3. Duncan et al. (2014), 2ª ed., fig. 7.40, p. 157: dez fatias da [transcrição na candidata](https://github.com/ricardocorsini/openstruct-front/issues/30#issuecomment-6863167450). O livro não foi reaberto nesta entrega. Conversão coerente de ft/lb/psf para m/kN/kPa. D original = 1.891.280,560; numerador em F = 1,6: 3.049.723,278. F₀ = 1,4, τF = 10⁻⁶ e K = 20 aceitam F ≈ 1,613020984 na quinta avaliação, com resíduo ≈ 5,06 × 10⁻⁷; raiz refinada ≈ 1,613022, valor publicado 1,61. K = 1 resulta em não convergência. Margens dos totais são metade da última casa transcrita; o valor publicado arredondado usa 0,005 apenas como conferência secundária. Esse caso verifica as equações nas fatias fornecidas, não a reconstrução da geometria do livro.
4. Modelo próprio sem coesão, com preparação completa, seco/piezométrico, refinamento, espelhamento com inversão do movimento e translação. Os limites de comparação são regressões desse modelo, não tolerâncias universais. O mesmo modelo com coesão de 5 kPa demonstra uma situação em que Fellenius passa e Bishop converge mas rejeita tração nas fatias de extremidade.

Testes adicionais cobrem limiares exatos, K, singularidade dependente de F₀, não finitos, cancelamentos, zero físico distinto de atualização não positiva, modos resistentes, revisões, imutabilidade e persistência. A interface verifica perfil, trajetória, comparação, falhas, edição, rascunhos, desfazer/refazer e troca de arquivo/caso na janela mínima. Estes checks não substituem revisão independente de engenharia ou a validação integral do catálogo.
