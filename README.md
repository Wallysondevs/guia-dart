# Guia Dart

Site: https://wallysondevs.github.io/guia-dart/

Curso de Dart 3 em português, do zero ao avançado, feito para quem **nunca programou**. Funciona como uma escola: uma aula para cada assunto, organizadas em **3 níveis + projetos + referência** (111 páginas). Vai de `print`, variáveis e null safety até classes, records e patterns, exceções, `async`/`await`, arquivos e JSON.

Cada aula explica o código parte por parte (anatomia), mostra a saída real, o que acontece quando dá errado (com a mensagem verdadeira do Dart), formas diferentes de fazer e exercícios no fim. Todas as saídas de terminal e mensagens de erro foram conferidas no **Dart SDK 3.13.5** oficial, rodando `dart run`.

Para praticar, as páginas trazem o editor **Experimente** (`.trydart`), que roda Dart no seu navegador:

- Edite o código, clique em **Rodar** e veja a saída, os erros de compilação, as exceções e o código de saída.
- O programa pode pedir uma entrada e você digita ali mesmo, no terminal da caixa.
- Nas **missões**, a caixa confere se o seu programa chegou ao resultado pedido.

O editor usa `assets/dartsim.js` com o **Dart do guia**: um tradutor de Dart 3 para JavaScript feito para o guia (`assets/dart/`), que imita o `dart run` do Dart 3.13.5. Ele não depende de nenhum servidor: roda num Web Worker, então a página não trava, e o botão **Parar** (ou o limite de 10 segundos) encerra um laço infinito. O primeiro **Rodar** baixa cerca de 320 KB. Ele é comparado automaticamente com o Dart SDK oficial (veja **Testes**).

Site 100% estático (HTML + CSS + JS, sem build e sem dependências externas): funciona no GitHub Pages. Para usar o editor no seu computador, sirva a raiz do site com um servidor local em vez de abrir o arquivo direto.

## Estrutura

```
index.html                 página inicial
<tema>.html                uma aula por tema
assets/style.css           visual
assets/site.js             níveis/menu (lista NIVEIS), Anterior/Próximo, anatomia, exercícios
assets/dartsim.js          o editor "Experimente" (caixas .trydart)
assets/dart/motor.js       o tradutor: lê o Dart, aponta os erros de compilação e gera JavaScript
assets/dart/runtime.js     a biblioteca (dart:core, dart:io, dart:math, dart:async, dart:convert…)
assets/dart/executar.js    o "dart run": main, args, stdin, exceções e código de saída
assets/dart/dart-worker.js o Web Worker onde o programa roda
tools/sim.js               roda um programa Dart como o editor rodaria
tools/testar-missoes.js    testa as missões de cada página
tools/testar-navegador.js  abre as páginas num Chromium sem janela e roda cada caixa
tools/diferencial.js       teste diferencial do motor contra o Dart SDK oficial
tools/testes/              programas do teste diferencial e as saídas esperadas
tools/motor-node.mjs       o mesmo motor do editor rodando no Node
tools/lab-nativo.js        roda no Dart SDK oficial do laboratório (usado pelo --nativo)
tools/DIFERENCAS.md        diferenças encontradas entre o editor e o Dart oficial
CONTRIBUINDO.md            como escrever uma aula
.nojekyll                  faz o GitHub Pages servir os arquivos como estão
```

## Testes

```bash
node tools/testar-missoes.js --todas         # todas as páginas
node tools/testar-missoes.js pagina.html     # só estas páginas (-q mostra só os problemas)
node tools/testar-missoes.js --nativo pagina.html   # compara também com o Dart oficial (precisa do laboratório)
node tools/diferencial.js                    # teste diferencial do motor
node tools/testar-navegador.js --todas       # roda cada caixa num Chromium sem janela (precisa do puppeteer-core)
node tools/sim.js main.dart                  # roda um programa como o editor
bash tools/checar-privacidade.sh             # páginas e histórico; lista extra: PROIBIDO=lista.txt
```

## Publicar no GitHub Pages

Envie a pasta para um repositório e ative **Settings → Pages → Deploy from a branch → main / (root)**.

## Adicionar uma aula

Leia `CONTRIBUINDO.md` e inclua a página na lista `NIVEIS` de `assets/site.js`.
