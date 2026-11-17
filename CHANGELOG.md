# Histórico

## Em desenvolvimento — geometria e edição

- Inserir/excluir vértices, mover contornos, copiar e dividir regiões por reta.
- Edição de interfaces coincidentes com propagação aos contornos vizinhos, inclusive pela tabela, e histórico por operação.
- Captura de vértices/interseções/segmentos, grade configurável e restrição horizontal/vertical.
- Entrada absoluta, relativa e por distância/ângulo; medição sem modificar o projeto.
- Faces verticais no terreno, com rejeição de retorno, balanço e trechos sem área nas extremidades.
- Compatibilidade com arquivos `geostruct/1`, testes de geometria/precisão e fluxos de interface.

Esta evolução não publica instaladores, não adiciona solver e mantém a arte personalizada adiada.

## 0.1.0 — 2026-11-17

Primeira entrega de código: modelagem geotécnica 2D.

- Interface OpenStruct em português, ribbon, árvore de projeto, propriedades, temas e painéis redimensionáveis.
- Múltiplas seções, materiais compartilhados, terreno, regiões de solo, linha piezométrica, faixas de carga e círculo de tentativa.
- Desenho gráfico, tabela/colagem de coordenadas, arraste de vértices, captura, pan/zoom e histórico por operação.
- Validação de contornos, sobreposição, cobertura, propriedades e contrato de arquivo.
- Projetos `.geo.json`, recuperação local e proteção de rascunhos/alterações não salvas.
- Relatório de entradas com impressão e HTML; desenho SVG.
- Estrutura Tauri 2 para Linux/Windows com ícones padrão provisórios, documentação e CI.

O solver de estabilidade e o dimensionamento de contenções ainda não fazem parte desta versão. Instaladores, catálogo e atualização pelo Launcher serão tratados em etapa posterior.
