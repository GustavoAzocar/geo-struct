# Créditos e dependências

GeoStruct é de autoria de Ricardo Corsini e colaboradores, sob MIT. Os ícones provisórios são os arquivos padrão do [create-tauri-app](https://github.com/tauri-apps/create-tauri-app/tree/c6f5cf68942f187ba7bb738a49ee505c28e6ca5a/templates/_base_/src-tauri/icons), copiados sem conversão por `scripts/prepare-tauri-icons.mjs` durante a preparação desktop. O script fixa a revisão de origem, confere SHA-256 e mantém os binários fora do versionamento. A licença MIT original está em `src-tauri/icons/LICENSE.txt`. A arte personalizada será incorporada posteriormente.

A implementação é própria. Nenhum código dos aplicativos ArmaduraStruct (GPL) ou de softwares comerciais foi incorporado. Convenções de uso do ConsoloStruct, ArmaduraStruct, Slide2 e GEO5 orientaram a organização visual; ver docs/REFERENCIAS-DE-INTERFACE.md.

Dependências diretas de execução:

| Dependência                   | Licença                   | Uso                                               |
| ----------------------------- | ------------------------- | ------------------------------------------------- |
| React / React DOM             | MIT                       | Interface                                         |
| Radix Dialog                  | MIT                       | Diálogos e navegação de foco                      |
| Lucide React                  | ISC                       | Ícones de comandos                                |
| Inter / Fontsource Inter      | SIL Open Font License 1.1 | Tipografia local                                  |
| Zod                           | MIT                       | Contrato do arquivo                               |
| polygon-clipping              | MIT                       | Verificação de interseção e cobertura das regiões |
| Tauri, API, plugins dialog/fs | MIT ou Apache-2.0         | Janela desktop e arquivos selecionados            |

Os arquivos de licença das dependências acompanham suas distribuições em `node_modules` e crates. Versões de JavaScript são fixadas no package-lock.json. Ferramentas de desenvolvimento incluem Vite, TypeScript, Vitest, Playwright e Prettier, com suas próprias licenças. Nenhum livro, norma ou material protegido de cálculo é redistribuído.
