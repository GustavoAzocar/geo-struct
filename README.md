<h1 align="center">GeoStruct</h1>
<p align="center">Modelagem geotécnica 2D para taludes e contenções.<br/>Um aplicativo livre do <strong>OpenStruct</strong>.</p>

**Versão 0.1.0 — primeira etapa: modelagem.** Crie seções, atribua materiais, represente água e sobrecargas e salve projetos locais. O motor de estabilidade ainda não está implementado; esta versão não calcula fatores de segurança, não dimensiona contenções e não emite aprovação de estabilidade.

## Começar

Node.js 22.12 ou superior (recomendado: Node 24):

```bash
git clone https://github.com/ricardocorsini/geo-struct.git
cd geo-struct
npm ci
npm run dev
```

Abra http://127.0.0.1:1420. Na tela inicial, escolha **Explorar um exemplo** ou **Novo projeto**. O exemplo é próprio, com dados ilustrativos, e contém terreno, duas camadas, linha piezométrica e sobrecarga. Seus parâmetros não representam um projeto geotécnico validado.

## Recursos desta versão

- Interface em português, ribbon, árvore de projeto, propriedades laterais, temas claro/escuro e painéis redimensionáveis.
- Projetos com múltiplas seções; criação e duplicação de seções e materiais compartilhados.
- Edição gráfica e por tabela de coordenadas, movimentação de vértices, captura de pontos/grade de 0,5 m, pan e zoom no cursor.
- Perfil do terreno, cota da base e regiões poligonais sem sobreposição, com material de fundo no restante do domínio.
- Materiais Mohr–Coulomb: peso específico total, coesão, atrito, modo de resistência e origem dos parâmetros.
- Linha piezométrica prescrita, sobrecargas verticais uniformes e círculo de tentativa.
- Validação geométrica, diagnósticos, desfazer/refazer, proteção de propriedades em edição e de alterações não salvas.
- Projeto `.geo.json` com esquema versionado; cópia local de recuperação; importação inválida preserva o projeto aberto.
- Relatório de dados de entrada com impressão/PDF pelo navegador, HTML portátil e exportação SVG da vista atual.
- Estrutura desktop Tauri 2 com ícones padrão provisórios; a arte personalizada será incorporada em uma etapa posterior.

O modelo e a edição usam unidades SI: **m, kN e kPa**, ângulos em graus na entrada. A edição aceita ponto ou vírgula decimal. Não há backend, login ou chamadas remotas durante o uso do aplicativo.

## Uso desktop

Instale Rust estável e os [pré-requisitos do Tauri 2](https://v2.tauri.app/start/prerequisites/). Em Ubuntu/Debian são necessárias as bibliotecas nativas WebKitGTK 4.1, GTK, AppIndicator e librsvg; Windows requer o ambiente MSVC e WebView2.

```bash
npm run desktop:dev
npm run desktop:build
```

Na primeira preparação desktop é necessário acesso à internet para baixar os ícones padrão do template oficial do Tauri. O script `npm run desktop:prepare` verifica a integridade dos arquivos e reutiliza a cópia local nas execuções seguintes. Os binários dos ícones não são versionados; o build web não depende desse download.

O aplicativo usa `br.com.openstruct.geostruct`, janela mínima de 960 × 640 e diálogo nativo de arquivos. O acesso ao sistema de arquivos fica limitado aos arquivos escolhidos pelo usuário. No navegador, Abrir usa o seletor de arquivo e Salvar gera um download. Conserve o arquivo exportado: a cópia de recuperação no navegador não substitui um backup.

Este primeiro commit entrega os fontes; instaladores e integração no catálogo/Launcher serão tratados após a validação da distribuição. Não há atualização automática ativa nesta versão.

## Desenvolvimento

```bash
npm run check
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run format:check
```

Testes de domínio verificam geometrias, limites dos parâmetros, arquivos, referências e histórico. Os testes de interface cobrem fluxos de edição e persistência. São verificações de software de modelagem; não validam um solver geotécnico.

| Caminho           | Responsabilidade                                             |
| ----------------- | ------------------------------------------------------------ |
| `src/domain/`     | Modelo, validação geométrica e histórico, sem React ou Tauri |
| `src/components/` | Ribbon, navegador, editor gráfico, propriedades e relatório  |
| `src/lib/`        | Entrada e saída local, com adaptadores web e desktop         |
| `src-tauri/`      | Janela nativa, permissões, identidade e empacotamento        |
| `tests/`          | Testes de domínio e fluxos Playwright                        |
| `examples/`       | Exemplo próprio de modelagem                                 |
| `docs/`           | Guia, arquitetura, escopo e validação                        |

Consulte [Guia de uso](docs/GUIA-DE-USO.md), [Arquitetura](docs/ARQUITETURA.md), [Escopo e evolução](docs/ESCOPO-E-ROADMAP.md), [Validação](docs/VALIDACAO.md) e [histórico](CHANGELOG.md).

## Origem e referências

Criado por **Ricardo Corsini**, no ecossistema **OpenStruct**. A base de pesquisa e especificação de estabilidade foi organizada pelo **Eng. Gustavo Azocar**, nas issues [#28](https://github.com/ricardocorsini/openstruct-front/issues/28), [#29](https://github.com/ricardocorsini/openstruct-front/issues/29), [#30](https://github.com/ricardocorsini/openstruct-front/issues/30) e [#31](https://github.com/ricardocorsini/openstruct-front/issues/31) do frontend.

A experiência segue convenções observadas nos aplicativos OpenStruct e na documentação oficial do Slide2 e GEO5. A implementação é própria. As referências e a situação do futuro motor estão em [ESCOPO-E-ROADMAP.md](docs/ESCOPO-E-ROADMAP.md).

Licença MIT. Dependências preservam suas licenças; veja [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
