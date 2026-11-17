# Materiais e formato de arquivo

Esta entrega organiza o cadastro e a atribuição de materiais para a modelagem. O modelo de resistência cadastrado continua sendo Mohr–Coulomb, sem solver. Não há biblioteca de valores presumidos, conversão entre tipos de resistência ou geração de parâmetros a partir de classificações de solo.

## Campos do material

| Campo      | Conteúdo e unidade                                                  | Validação de cadastro                                |
| ---------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| `id`       | Identidade compartilhada entre seções                               | Única no projeto, preservada nas edições             |
| `name`     | Nome exibido                                                        | Texto não vazio, até 120 caracteres                  |
| `color`    | Cor de representação                                                | Hexadecimal de seis dígitos                          |
| `gamma`    | Peso específico total informado, kN/m³                              | Nulo ou maior que zero e até 100                     |
| `cohesion` | c ou c′ informado, kPa                                              | Nulo ou entre 0 e 1.000.000                          |
| `friction` | φ ou φ′ informado, graus                                            | Nulo ou maior/igual a 0 e menor que 90               |
| `mode`     | `effective`, `total` ou nulo                                        | Escolha explícita; nulo é pendência                  |
| `source`   | Origem dos parâmetros: ensaio, investigação, referência ou hipótese | Até 2.000 caracteres; texto vazio/branco é pendência |

Os limites numéricos são controles de entrada já adotados pelo cadastro, não faixas recomendadas para solos ou critérios normativos. Valores fora do domínio são recusados. Valores faltantes continuam nulos, podem ser salvos e são apresentados como pendências. Coesão e atrito iguais a zero são valores informados.

O modo muda os rótulos c′/φ′ ou c/φ e preserva os números. Não converte parâmetros, não impõe φ = 0 e não presume condição drenada/não drenada. O peso específico continua como um único valor total informado; estados seco/saturado/submerso e tratamento de água dependem da próxima etapa e da especificação do motor. Nenhum desses valores é deduzido nesta entrega.

## Atribuições e operações

Cada seção guarda `backgroundMaterialId`; cada região guarda `materialId`. Uma referência válida aponta para o cadastro do projeto. `null` significa **sem material atribuído**, não vazio físico, água ou escavação. Novas seções e regiões começam nulas; desenhos podem ser salvos e completados depois. As pendências aparecem na árvore, propriedades, desenho, conferência e relatório.

- Atribuição individual: selecionar o material nas propriedades e aplicar.
- Atribuição em lote: escolher destinos na seção ativa e confirmar um material ou a retirada dos vínculos. Outras seções permanecem com suas atribuições.
- Duplicação de material: novo ID, nome disponível, parâmetros/origem copiados e nenhuma nova atribuição. O cadastro duplicado é independente.
- Duplicação de seção e cópia/divisão de região: preservam a referência existente, inclusive nula; não escolhem outro material.
- Exclusão sem uso: permitida após confirmação, inclusive para o último material.
- Exclusão em uso: exige outro material válido e substitui todas as referências, em todas as seções, junto com a exclusão. Nenhuma referência fica apontando para um cadastro inexistente.

Cada operação aplicada corresponde a um passo de histórico. Cadastro é compartilhado: editar um material altera os parâmetros associados a todas as suas atribuições. O gerenciador lista esses usos antes da edição. “Dados preenchidos” refere-se ao preenchimento do cadastro e não informa aptidão para cálculo ou aprovação de engenharia.

## Formato `geostruct/2`

| Aspecto                   | Versão 1               | Versão 2                                      |
| ------------------------- | ---------------------- | --------------------------------------------- |
| Número `version`          | `1`                    | `2`                                           |
| Lista `materials`         | 1 a 100 materiais      | 0 a 100 materiais                             |
| Referências de material   | ID obrigatório         | ID existente ou `null`                        |
| Tipo de parâmetros `mode` | `effective` ou `total` | Os mesmos valores ou `null`                   |
| Demais campos             | Contrato original      | Sem mudança de representação, unidades ou IDs |

A leitura valida o contrato antigo antes da migração. Um v1 válido é convertido para v2 alterando apenas `version`; materiais, parâmetros, referências, seções, geometria, água, cargas, círculo e IDs são preservados. Nenhuma atribuição antiga é removida ou reinterpretada. Nulos em posições que v1 não admitia continuam inválidos se o arquivo se declarar v1.

Arquivos v2 são salvos e reabertos preservando as pendências. Campos desconhecidos, versões não suportadas, referências inexistentes e IDs duplicados são recusados sem substituir o projeto aberto. A validação estrita impede que um arquivo contendo propriedades ainda não suportadas seja importado e regravado perdendo esses campos.

A abertura de v1 comunica a migração e marca o projeto para salvamento. **Salvar como** conserva o original; versões antigas do aplicativo não leem v2. A recuperação local mantém sua chave de armazenamento e usa a mesma leitura/migração. O exemplo versionado continua em v1 como caso permanente de compatibilidade.
