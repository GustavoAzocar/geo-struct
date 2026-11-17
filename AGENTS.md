# Trabalhar no GeoStruct

Leia README.md, docs/ESCOPO-E-ROADMAP.md e docs/ARQUITETURA.md antes de alterar comportamento.

- GeoStruct faz parte do OpenStruct. Preserve interface em português, ribbon, árvore, propriedades, arquivos locais e funcionamento sem servidor de aplicação.
- Esta primeira etapa é modelagem. Não introduza um FS, critério normativo ou cálculo geotécnico sem especificação aprovada, fonte verificável e caso independente.
- Use m, kN e kPa no modelo; mantenha transformações de tela separadas. Tolerâncias geométricas do editor não são tolerâncias do solver.
- Preserve IDs, histórico por operação, isolamento das seções, rascunhos de propriedades e proteção contra perda de alterações. Não descarte silenciosamente arquivo ou campo inválido.
- Alterações de formato exigem versão/migração documentada e testes de leitura. Atribuição de material deve ser explícita.
- Faça testes proporcionais ao comportamento: `npm run check`, `npm run build`, `npm run test:e2e` e `npm run format:check`. Compilações desktop são verificadas no CI.
- Evite dependências e abstrações sem uso concreto. O domínio não importa React, Tauri ou APIs de tela.
- Não versione dependências, instaladores, dist, credenciais ou livros/normas de terceiros.
- Verifique `git var GIT_AUTHOR_IDENT` antes de commitar. Use a identidade do contribuidor, nunca a identidade de uma ferramenta de assistência.
- Descreva o que foi validado e o que não foi; checks de software não equivalem a validação de engenharia.
