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
- Captura procura vértices próximos, interseções, segmentos e depois a grade. Em **Geometria → Precisão**, configure o passo (inicialmente 0,5 m) e a restrição horizontal/vertical. F3 desliga a captura; a restrição ortogonal é uma opção separada.
- Selecione terreno, região ou água para exibir seus vértices. Arrastar um vértice gera um passo de histórico; alterações inválidas são recusadas com mensagem.
- Ctrl+Z desfaz e Ctrl+Shift+Z/Ctrl+Y refaz. Em campos de texto, esses atalhos conservam a edição nativa do campo.
- Arraste os divisores dos painéis ou use setas após focá-los com Tab.
- A faixa **Mostrar** controla solos, água, cargas e círculo. Temas claro/escuro ficam no topo.

### Editar contornos e interfaces

Selecione o terreno, uma região ou a linha piezométrica antes de escolher **Inserir vértice**, **Excluir vértice** ou **Mover contorno**. Inserir usa um clique no interior de um segmento. Excluir usa um clique no vértice e mantém o mínimo de dois pontos no perfil ou três na região. Mover usa um ponto base e um destino, que definem o deslocamento.

Por padrão, **Editar interfaces de solo vinculadas** mantém juntas as fronteiras coincidentes entre terreno e regiões, inclusive quando os dois lados têm números diferentes de vértices. Desfazer reverte a operação completa. A água é independente. Desligue a vinculação em **Precisão** para editar só o contorno selecionado; a validação continua recusando sobreposição e saída do domínio. A edição pela tabela também acompanha as interfaces. Colar uma lista substitui apenas o contorno selecionado e não infere quais pontos antigos correspondem aos novos.

**Copiar região** exige uma região selecionada e dois pontos de deslocamento. Cria um novo ID e mantém o material original. **Dividir região** usa dois pontos para definir uma reta infinita de corte e cria duas regiões adjacentes com o mesmo material. Selecione cada parte para ajustar nome e material. Reta tangente/exterior ou corte que gera mais de duas partes é recusado. Copiar/dividir atua em regiões explícitas; o solo de fundo continua preenchendo o restante da seção.

O perfil pode conter faces verticais: use pontos consecutivos com o mesmo X e Z diferente. Continue avançando da esquerda para a direita; retornos e perfis em balanço não são aceitos. Uma face na extremidade não pode retornar sobre o fechamento lateral automático. A admissão geométrica não significa que o futuro motor já aceite o caso.

### Entrada precisa e medição

Durante o desenho ou comandos de dois pontos, abra **Entrada precisa** no canto inferior esquerdo. Escolha **X/Z**, **ΔX/ΔZ** a partir do último ponto, ou **Distância/ângulo**. O primeiro ponto precisa de X/Z ou clique. Ângulos são medidos a partir de +X, positivos em direção a +Z. Valores digitados são preservados, sem arredondamento pela grade ou restrição ortogonal. A tabela das propriedades continua disponível para coordenadas existentes.

**Medir** mostra distância, ΔX, ΔZ e ângulo entre dois pontos; não modifica o projeto. Um terceiro ponto inicia outra medição. Escape encerra. As preferências de precisão valem para a sessão e não são gravadas como parâmetros físicos no `.geo.json`.

## Arquivos e recuperação

**Salvar** e Ctrl+S exportam `.geo.json`. No desktop, o primeiro salvamento pede destino e os seguintes atualizam o caminho selecionado. **Salvar como** escolhe um novo destino principal. No navegador, cada salvamento gera um download. Confira seu destino de downloads.

**Abrir** valida a estrutura antes de substituir o projeto atual; arquivo inválido não remove o trabalho aberto. Salve ou descarte alterações do projeto antes de substituí-lo. A recuperação local registra somente as operações aplicadas e é oferecida na tela inicial; nunca abre automaticamente. Ela não substitui o arquivo exportado e não contém campos/traçados ainda em edição.

**Fechar projeto** retorna à tela inicial, protegendo alterações. Fechar normalmente remove sua recuperação local. Fechar a janela/browser sem resolver alterações exibe a proteção da plataforma. Bloqueio de armazenamento local é comunicado; salvar arquivo continua disponível.

## Documentar

**Relatório de entradas** reúne todas as seções, materiais e fontes, coordenadas, água, cargas, círculo e diagnósticos. Imprimir/PDF usa a impressão disponível no navegador/sistema. **Exportar HTML** fornece uma versão portátil. **Exportar desenho** salva SVG da vista atual; a extensão não contém o modelo editável completo, que pertence ao `.geo.json`.

As verificações desta versão detectam inconsistências de modelagem. A estabilidade e os critérios de aceitação ainda não são calculados.
