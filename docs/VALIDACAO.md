# Validação da primeira etapa

## Verificações executáveis

- `npm run check`: tipos TypeScript e testes do domínio. Cobertura de geometria, interseção/cobertura de regiões, linhas, água, faixas, leitura/limites de arquivo, IDs, duplicação, números e histórico.
- `npm run build`: aplicação web compilada.
- `npm run test:e2e`: uso real no Chromium, incluindo criação, edição, rascunhos, arraste, cancelamento, undo/redo, seções, arquivos, recuperação, relatório e janela mínima.
- `npm run format:check`: consistência de formatação.
- Workflow `Validate and build`: repete as verificações e compila o executável Tauri em Ubuntu 24.04 e Windows. Não publica release nem integra o catálogo.

Os artefatos do CI incluem traces de falhas, sem capturas de imagens. Resultados de uma execução específica devem ser conferidos pelo SHA no GitHub Actions.

### Evolução da geometria e edição

Testes adicionais verificam interfaces com subdivisões diferentes, conservação de área e ausência de sobreposição após editar/dividir, limites de pontos, identidades/materiais, cópia inválida, precisão/captura e faces verticais. O arquivo de exemplo da primeira versão é lido e regravado sem alterar seus dados. Os fluxos de interface cobrem edição compartilhada e histórico, inserção/exclusão gráfica, divisão com persistência, rejeição de cópia, deslocamento relativo, medição sem modificar o modelo e entrada de face vertical na janela mínima.

Asserções de geometria não são validações das forças sobre faces verticais. O solver ainda não existe. Não se executa geração/conversão de imagens nos testes; traces são mantidos sem screenshots.

### Materiais e arquivos

Os testes verificam atribuição explícita/nula, zero de coesão/atrito, escolha de tipo de resistência, limites de cadastro, duplicação independente, atribuição em lote isolada por seção e substituição/exclusão em todas as seções com histórico único. Cobrem lista vazia de materiais, referências inválidas, preservação dos dados v1 na migração para v2 e recusa de campos desconhecidos. Os fluxos Chromium exercitam o gerenciador na janela mínima, rascunhos, pendências, relatório, persistência, recuperação antiga e navegação aos usos do material.

Os limites numéricos são limites do cadastro de software. “Dados preenchidos” não é validação dos parâmetros de engenharia ou condição de cálculo.

## Limites

As verificações são de software de modelagem, sem validação de solver geotécnico. Não há benchmark de FS nesta entrega. A revisão com engenheiros e os casos de cálculo independentes dependem das issues #30/#31 do frontend.

Compilar um executável nativo não comprova sua interação com todos os ambientes. Antes de distribuir instaladores, conferir manualmente em Linux e Windows: abrir/salvar, cancelamento de diálogo, permissões, fechamento com alterações, impressão, escala de tela, zoom/pan e teclado. Validar Linux WebKitGTK e Windows WebView2 além do Chromium dos testes.

A recuperação usa armazenamento local e pode ser bloqueada pelo navegador. O caso deve produzir aviso sem substituir a responsabilidade de salvar arquivo. Arquivos com geometria inconsistente são abertos com diagnósticos, sem conferir aprovação de estabilidade.
