# Guia de uso — GeoStruct 0.1

## Primeiro projeto

Escolha **Novo projeto**, informe nome e, se desejar, responsável. A seção inicial não tem terreno. Os materiais começam com parâmetros vazios. **Explorar um exemplo** abre um modelo próprio em duas camadas, com dados ilustrativos claramente identificados.

Em **Geometria → Perfil do terreno**, marque os pontos da esquerda para a direita. Enter ou Concluir finaliza; Escape cancela; Backspace ou botão direito remove o último ponto. Regiões são fechadas automaticamente. O primeiro contorno do terreno deve ficar acima da cota da base indicada no painel.

Também é possível digitar a tabela X/Z nas propriedades. **Colar lista de coordenadas** aceita uma linha por ponto, com valores separados por ponto e vírgula, tabulação ou espaço. O separador decimal pode ser ponto ou vírgula. Exemplo:

```text
0 ; 20
15,5 ; 20
30 ; 8
50 ; 8
```

Clique em **Usar coordenadas**, confira a tabela e **Aplicar**. Os campos são um rascunho: sair deles para outro elemento oferece a opção de continuar editando ou descartar. O desenho não é modificado por um valor ainda não aplicado.

## Solos, água e cargas

Em **Materiais → Novo material**, informe nome, cor, peso específico total, coesão, atrito, tipo de parâmetros e origem. O solo de fundo é definido nas propriedades da seção/terreno e preenche as áreas sem outra região. Desenhe polígonos com **Região de solo**, selecione-os e atribua o material. As regiões podem compartilhar bordas, mas não sobrepor áreas.

Em **Água e cargas**, trace a linha piezométrica, com X crescente. Não é análise de percolação: trata-se de uma linha prescrita. Carga acima do terreno e cobertura incompleta produzem avisos. Remover a linha usa Excluir com a linha selecionada.

Para uma sobrecarga, clique nos limites inicial/final da faixa horizontal. Depois informe **q (kPa)** nas propriedades e aplique. A faixa inicia com q = 0 para não presumir carregamento. A direção prevista é vertical descendente, uniforme na projeção horizontal. Faixas sobrepostas permanecem explícitas no modelo.

**Análise → Círculo de tentativa** recebe centro e um ponto do círculo. Centro/raio podem ser ajustados numericamente. Ele é uma referência geométrica: não há FS nem verificação da superfície nesta versão.

## Navegar e editar

- Roda: zoom no cursor. Botão do meio ou Espaço + arrastar: mover vista.
- V: selecionar; H: mover vista; F: enquadrar; F3: captura.
- Captura procura vértices próximos e depois grade de 0,5 m. Desative-a para posicionamento livre.
- Selecione terreno, região ou água para exibir seus vértices. Arrastar um vértice gera um passo de histórico; alterações inválidas são recusadas com mensagem.
- Ctrl+Z desfaz e Ctrl+Shift+Z/Ctrl+Y refaz. Em campos de texto, esses atalhos conservam a edição nativa do campo.
- Arraste os divisores dos painéis ou use setas após focá-los com Tab.
- A faixa **Mostrar** controla solos, água, cargas e círculo. Temas claro/escuro ficam no topo.

## Arquivos e recuperação

**Salvar** e Ctrl+S exportam `.geo.json`. No desktop, o primeiro salvamento pede destino e os seguintes atualizam o caminho selecionado. **Salvar como** escolhe um novo destino principal. No navegador, cada salvamento gera um download. Confira seu destino de downloads.

**Abrir** valida a estrutura antes de substituir o projeto atual; arquivo inválido não remove o trabalho aberto. Salve ou descarte alterações do projeto antes de substituí-lo. A recuperação local registra somente as operações aplicadas e é oferecida na tela inicial; nunca abre automaticamente. Ela não substitui o arquivo exportado e não contém campos/traçados ainda em edição.

**Fechar projeto** retorna à tela inicial, protegendo alterações. Fechar normalmente remove sua recuperação local. Fechar a janela/browser sem resolver alterações exibe a proteção da plataforma. Bloqueio de armazenamento local é comunicado; salvar arquivo continua disponível.

## Documentar

**Relatório de entradas** reúne todas as seções, materiais e fontes, coordenadas, água, cargas, círculo e diagnósticos. Imprimir/PDF usa a impressão disponível no navegador/sistema. **Exportar HTML** fornece uma versão portátil. **Exportar desenho** salva SVG da vista atual; a extensão não contém o modelo editável completo, que pertence ao `.geo.json`.

As verificações desta versão detectam inconsistências de modelagem. A estabilidade e os critérios de aceitação ainda não são calculados.
