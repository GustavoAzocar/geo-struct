# Contribuir

Abra uma issue com o comportamento desejado, motivação e um exemplo. Antes de iniciar, confira se existe trabalho em andamento. Envie alterações por PR salvo orientação do mantenedor.

Use Node 24, `npm ci` e `npm run dev`. Execute `npm run check`, `npm run build`, `npm run test:e2e` e `npm run format:check`. Instale Chromium para os testes com `npx playwright install --with-deps chromium`. Em um ambiente com navegador já instalado, a variável opcional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` define seu executável.

Mudanças geométricas precisam de casos que possam refutar a implementação: interfaces, degenerações, sobreposição ou precisão. Não gere resultados esperados pelo próprio código testado. Mudanças do futuro motor exigirão casos independentes, referência e revisão de engenharia.

Confira sua autoria com `git var GIT_AUTHOR_IDENT`. Use nome/email da conta GitHub ou seu email privado noreply. Não use a identidade de ferramentas de assistência.

Não publique dados de clientes sem autorização. Os exemplos do repositório são ilustrativos e próprios. Consulte também AGENTS.md.
