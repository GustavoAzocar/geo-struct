# GeoStruct desktop 0.1.0

Distribuição de modelagem, sem motor de estabilidade. Windows x86_64 usa NSIS por usuário; Linux x86_64 usa AppImage. O Struct Launcher verifica assinatura, tamanho e SHA-256 antes de instalar. Os pacotes e metadados ficam no hub público openstruct-catalog, com o código de origem identificado por SHA e tag imutáveis. Não há autoatualizador dentro do GeoStruct; atualize pelo Launcher.

Ícones padrão do Tauri, sem arte personalizada. O AppImage tem como base Ubuntu 22.04; outras distribuições precisam das dependências usuais GTK/WebKitGTK e suporte AppImage. Windows usa WebView2.

Os testes de adaptadores verificam cancelamento, caminhos com espaços, salvar/reabrir, falhas e limite de tamanho com chamadas nativas substituídas por mocks. Os testes Chromium verificam a interface web. A compilação e o teste de inicialização dos executáveis não são homologação manual completa dos sistemas de destino.

Antes de adotar em produção, validar em cada computador: abrir/salvar/Salvar como, cancelar diálogos, falta de permissão, fechar com rascunho/alterações, recuperação, impressão, teclado e escalas de tela. Conservar cópias dos arquivos anteriores: o formato v4 não abre em versões antigas do aplicativo. Desinstalação pelo Launcher não deve remover projetos pessoais.
