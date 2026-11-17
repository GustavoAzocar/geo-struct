# Arquitetura

React, TypeScript e Vite compõem a interface. Tauri 2 fornece a janela nativa para Linux/Windows. Os arquivos, a tipografia, os ícones e o processamento são locais. Não existe backend remoto, conta ou telemetria do produto.

| Camada                           | Responsabilidade                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `src/domain/model.ts`            | Contrato `geostruct/1`, materiais, seções, IDs, validação estrutural e arquivo JSON |
| `src/domain/geometry.ts`         | Contornos, interpolação, sobreposição, cobertura e diagnósticos do editor           |
| `src/domain/editing.ts`          | Operações imutáveis de vértices/contornos, interfaces coincidentes, divisão e cópia |
| `src/domain/precision.ts`        | Captura, entrada absoluta/relativa/polar e medição, sem dependência de tela         |
| `src/domain/history.ts`          | Histórico imutável, limitado a 50 transações                                        |
| `src/components/ModelCanvas.tsx` | Vista SVG, coordenadas de tela, pan/zoom, captura e prévias de desenho              |
| `src/components/Inspector.tsx`   | Rascunhos de campos e aplicação transacional                                        |
| `src/App.tsx`                    | Projeto ativo, seleção, comandos, histórico e proteções de navegação                |
| `src/lib/files.ts`               | Adaptadores web/desktop, serialização, exportação e recuperação                     |
| `src-tauri`                      | Identidade nativa, diálogos, permissões e empacotamento                             |

O modelo usa coordenadas cartesianas X e Z, com Z positivo para cima. O campo JSON `y` armazena a coordenada vertical Z. Comprimentos em m, tensões em kPa e pesos específicos em kN/m³. Zoom e pan pertencem à vista, nunca alteram o modelo.

Cada seção possui um terreno e uma base horizontal; o domínio é fechado automaticamente. Regiões poligonais representam outros solos e não podem sobrepor suas áreas. O material de fundo preenche o restante do domínio. Materiais são compartilhados no projeto; seções duplicadas recebem novos IDs para seus elementos.

O terreno admite X não decrescente e faces verticais, sem retorno sobre segmentos nem prolongamentos sem área nas extremidades. A base continua horizontal e perfis em balanço não são admitidos. A linha piezométrica mantém X estritamente crescente. Na abscissa de uma face vertical, o desenho de cargas usa o envelope superior e o diagnóstico de água acima do terreno usa o inferior. Essas convenções servem ao editor, não definem forças ou admissibilidade do futuro solver. A tolerância geométrica do editor é `1e-7 m`; não determina convergência, admissibilidade ou tolerância do futuro cálculo.

Os contornos continuam armazenados como listas de pontos do formato `geostruct/1`: nenhum campo persistido foi adicionado ou reinterpretado. Projetos existentes permanecem legíveis, com IDs e materiais preservados. Versões antigas do aplicativo podem apontar faces verticais como inconsistência geométrica. Grade, restrição ortogonal e vinculação de interfaces são opções da sessão, não parâmetros físicos serializados.

A edição vinculada encontra coincidências geométricas entre terreno e regiões. Ao mover uma aresta, insere os vértices necessários nos vizinhos e interpola suas subdivisões ao longo da nova aresta. Inserção/exclusão acompanha os contornos coincidentes; a água permanece independente. Cada aplicação produz uma seção nova e só chega ao histórico após validação. Copiar cria outro ID; dividir preserva o ID original em uma das partes e cria outro na segunda, mantendo o material nas duas. Divisão com ilhas, furos ou mais de duas partes é recusada.

A tabela conserva a correspondência de linhas existentes para propagar movimentos e exclusões. Colar uma lista substitui apenas o contorno selecionado, sem inferir correspondência com vértices antigos. Para substituir a maior parte dos vértices, deve-se usar essa operação explícita. A entrada numérica direta não é arredondada pela captura. Captura prioriza vértices, interseções, segmentos e grade; a restrição ortogonal preserva a coordenada transversal da âncora.

A serialização valida tipos, limites, referências e IDs. Arquivos estruturalmente inválidos são recusados sem substituir o projeto aberto. Um arquivo estruturalmente válido com inconsistências geométricas pode ser aberto e corrigido; os diagnósticos continuam visíveis. Aplicações de edição não introduzem novos erros geométricos. Avisos, inclusive parâmetros ainda vazios, são preservados no arquivo.

Rascunhos de propriedades só modificam o modelo em **Aplicar**. A troca de contexto protege rascunhos e desenhos em andamento. Arrastar um vértice confirma uma transação ao soltar. Cancelar restaura a geometria original. Undo/redo não intercepta edição de texto em campos.

Os diálogos nativos ampliam o escopo apenas para caminhos selecionados pelo usuário. Não há permissão de leitura/escrita global. A proteção de fechamento nativa intercepta `CloseRequested`; navegação no navegador usa `beforeunload`. A recuperação local guarda o último modelo aplicado, não rascunhos de campos ou traçados ainda não concluídos.

## Preparação para o motor

O motor será um módulo separado do React, com dados de entrada normalizados, resultados por fatia, diagnósticos e revisão do modelo de origem. A busca deverá executar em Worker com progresso e cancelamento. A versão atual não contém solver simulado, regra de FS mínimo ou sinalização de aprovação de estabilidade. O contrato detalhado depende do fechamento das issues #30/#31.
