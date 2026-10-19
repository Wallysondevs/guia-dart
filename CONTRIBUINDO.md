# Como escrever uma página do Guia Dart

O guia é uma **escola**, estilo W3Schools, para quem **nunca programou**. **Uma aula = um assunto.** O dono do projeto já reclamou de outro guia que juntava vários assuntos numa página. Nunca mostre código "seco":
- explique cada parte (anatomia);
- mostre a **saída real**, colhida no Dart SDK de verdade (laboratório, §5);
- mostre o que acontece quando dá errado, com a mensagem **real** do Dart (erro de compilação e exceção em tempo de execução);
- deixe o leitor praticar no editor do guia (§4).

Antes de tudo, leia o `RECURSOS.md`: onde trabalhar (VPS) e como.

## 0. O que o guia ensina
- **A linguagem Dart 3** em programas de terminal (`dart run main.dart`), do zero até classes, coleções, null safety, records/patterns e assíncrono.
- **Flutter** só em `flutter.html` (o que é, como o Dart aparece nele) — não há Flutter no lab: o que for da tela do Flutter é ilustrativo.
- O que exige pacotes (`package:test`, `package:http`) aparece no lab com `dart pub`; o editor não baixa pacotes.

## 1. Esqueleto do arquivo
Use como modelo uma aula do Guia Lua (`~/guia-lua/print.html`, `~/guia-lua/while.html`, na VPS): cabeçalho, `<main>`, blocos, rodapé, `.exercise`, `.mc`, `dl.anatomy`, `div.cenario`, `div.note`, `table.ref`. Troque:
- `<title>Dart TEMA — descrição | Guia Dart</title>`;
- `<h1>Dart <span class="hl">TEMA</span></h1>`;
- a caixa `.trylua` por **`.trydart`** e `main.lua` por `main.dart`.

Menu, selo e Anterior/Próximo vêm de `assets/site.js` (`NIVEIS`). **Não mude a `NIVEIS`.** Links internos só para páginas que estão nela.

## 2. Ordem de uma aula
1. Intro.
2. "Você vai aprender".
3. A ideia antes do código, com uma comparação do dia a dia.
4. Do simples ao completo, uma novidade por vez, com `dl.anatomy` ou tabela "parte → o que faz".
5. **A saída real** depois de cada exemplo: `pre.term` com `$ dart run main.dart` e o que o Dart respondeu no lab.
6. **Pelo menos dois "Experimente"** (`.trydart`) por aula: um no meio e uma missão no fim.
7. Formas diferentes de fazer + tabela "qual usar".
8. **Quando dá errado** (`div.cenario`): o código errado e a **mensagem real** (colha no lab), explicada linha por linha em português — o erro de compilação (`main.dart:3:9: Error: …`, a linha do código e o `^^^^`) e a exceção (`Unhandled exception:`, a mensagem, o `#0 …` do stack trace).
9. Referência (`table.ref`).
10. Exercícios (3 ou mais: `.exercise`, `.mc`).
11. Resumo.

Páginas de **Projetos**: passo a passo (versão 1, 2, 3…), cada uma com um `.trydart`. Páginas de **Referência**: tabelas, com 1 ou 2 `.trydart`.

## 3. Componentes

### Código para ler
```html
<pre class="file" data-file="ola.dart">void main() {
  final nome = 'Ana';
  print('Olá, $nome!');
}
</pre>
```
Dentro de `<pre>` e de atributos, escape `<`, `>` e `&` (`&lt;`, `&gt;`, `&amp;`): `List&lt;int&gt;`, `if (x &lt; 10)`, `a &amp;&amp; b`, `(x) =&gt; x * 2`. O testador confere.

### Terminal (`pre.term`)
- `$ ` = `ana@notebook:~$` (o prompt aparece sozinho); `«` = anotação.
- Toda saída vem do lab:
```html
<pre class="term">$ dart run ola.dart
Olá, Ana!
</pre>
```

### Editor "Experimente" (`.trydart`)
```html
<div class="trydart" data-goal="out:Olá, Ana!">
<p class="try-task"><strong>Missão:</strong> troque "mundo" por "Ana" e clique em Rodar.</p>
<pre class="script" data-file="main.dart">void main() {
  print('Olá, mundo!');
}
</pre>
<pre class="solucao" data-file="main.dart">void main() {
  print('Olá, Ana!');
}
</pre>
</div>
```
- **Rodar** executa o programa (`dart run main.dart`) no editor do guia (§4) e mostra a saída, os erros em vermelho e o código de saída.
- **Vários arquivos**: vários `<pre class="script" data-file="…">` viram abas; o primeiro é o que roda (`main.dart`); os outros ficam na pasta (`import 'contas.dart';`, `dados.txt`).
- `data-stdin="linha1\nlinha2"`: o que o `stdin.readLineSync()` vai ler. Sem `data-stdin`, o programa **pede e o leitor digita**.
- `data-args="a b"`: o que chega em `main(List<String> args)`.
- `data-digitar="Bia\n30"`: o que o testador digita quando o programa pede.
- `data-sem-fim`: laço infinito de propósito (para mostrar o ■ Parar).
- Sem `data-goal`: caixa livre. Com `data-goal`: missão, e o `pre.solucao` é **obrigatório**.
- Cada Rodar parte do zero.

### Metas (`data-goal`) — regras fixas, não invente outras
Várias metas se separam com **`;;`**; **todas** precisam passar.

| Meta | Verdade quando… |
| --- | --- |
| `out:TEXTO` | a saída do programa (stdout e stderr, na ordem) **contém** o texto, exatamente |
| `outre:REGEX` | a saída inteira casa com a regex |
| `semerro` | compilou e terminou sem exceção não tratada |
| `erro:TEXTO` ou `erro:/REGEX/` | houve erro de compilação ou exceção não tratada e a mensagem contém o texto (ou casa) |
| `exit:N` | o código de saída foi N (`exit(N)`; erro de compilação = 254; exceção não tratada = 255) — confira no lab |
| `src:REGEX` | o código do leitor (todas as abas) casa com a regex (flag `m`) |
| `arquivo:NOME` / `arquivo:NOME~TEXTO` | depois de rodar, o arquivo existe na pasta (e contém o texto) |

**Regras exatas:** regex do JavaScript; `outre:` sem flags sobre a saída inteira (`\n` para as quebras); `|` é alternativa e `\|` é a barra literal; o `data-goal` é decodificado (HTML) antes de separar nos `;;`; o **código inicial não pode cumprir a meta**, e a **solução tem de cumprir**; prefira metas tolerantes (`out:` de um trecho, `semerro`, `src:`); a meta **não pode depender** de `Random()` sem semente, data e hora (`DateTime.now()`), tempo de execução, `hashCode` padrão de objetos ou ordem de um `HashMap`/`HashSet` (o `Map`/`Set` literal do Dart mantém a ordem de inserção — esse pode).

### Outros blocos
`dl.anatomy`, `div.note/.tip/.warning/.cenario`, `ol.passo`, `div.table-wrap > table.ref`, `.exercise`, `.mc`, `figure`, `<span class="versao">Dart 3.0</span>`.

No `.exercise`, `data-answer="a|b"` aceita respostas alternativas (comparação **exata**). Para uma barra vertical dentro da resposta, escreva `\|`.

## 4. O editor do guia (`assets/dartsim.js`)
> **Esta seção é mantida pelo agente do simulador.** Antes de escrever uma frase do tipo "no editor…", confira com as ferramentas dele (`tools/sim.js`).

### 4.1 O que é
O DartPad compila num servidor do Google; o guia não depende disso. O "Experimente" usa o **Dart do guia**: um tradutor de Dart 3 para JavaScript feito para o guia, que roda no navegador do leitor:
- `assets/dart/motor.js`: lexer, parser, verificação (os erros de compilação) e gerador de JavaScript;
- `assets/dart/runtime.js`: a biblioteca (`dart:core`, `dart:io`, `dart:math`, `dart:async`, `dart:convert`, `dart:collection` e `dart:isolate`, só o que o guia usa);
- `assets/dart/executar.js`: o `dart run` (main, args, stdin, exceções, código de saída);
- `assets/dart/dart-worker.js`: o Web Worker. A página não trava, e o ■ Parar (ou o limite de 10 s) encerra o worker.

O 1º Rodar baixa uns 180 KB. **Não é o SDK oficial.** As saídas das aulas (`pre.term`) vêm **sempre** do lab (§5). O editor imita o `dart run` do Dart 3.13.5, e o `testar --nativo` mostra onde ele difere.

### 4.2 Como o editor mostra as coisas
- O comando aparece como `ana@notebook:~$ dart run main.dart [args]` e, no fim, `[código de saída: N]`.
- **Erro de compilação**: no formato do `dart run`, em vermelho. Primeiro `main.dart:3:9: Error: Undefined name 'idadee'.`, depois as linhas de contexto (` - 'Pessoa' is from 'main.dart'.`), o `Try …`, a linha do código e o `^^^^`. Todos os erros de verificação aparecem, em ordem. Erros de **sintaxe**: só o primeiro (o lab às vezes mostra mais). Código de saída **254**.
- **Exceção não tratada**: `Unhandled exception:`, a mensagem (o `toString()` do Dart) e o stack trace `#0      main (file:///home/ana/main.dart:4:10)`, com as duas linhas finais do `dart:isolate-patch`. Para `List.[]`, `int.parse` e `double.parse`, vêm também as linhas `dart:core-patch` do lab. Código de saída **255**.
- `print` usa o `toString()` do Dart:
  - coleções: `[1, 2, 3]`, `{a: 1}`, `{1, 2}`;
  - records e objetos: `(1, a, x: 2)`, `Instance of 'Pessoa'`, `Cor.azul`;
  - números e null: `1.0`, `2.5`, `null`;
  - `Iterable` preguiçoso (`map`, `where`, `reversed`): entre parênteses, `(2, 4, 6)`, e encurtado com `...` como no Dart.
- **Números**:
  - `int` tem 64 bits, como na VM: `9223372036854775807 + 1` dá o negativo;
  - `5 / 2` = `2.5`, `4 / 2` = `2.0`, `7 ~/ 2` = `3`, `-7 % 3` = `2`;
  - literal inteiro em contexto `double` vira double: `double x = 3;` e `<double>[10]` mostram `3.0` e `[10.0]`, e `double Function() f = () => 0;` também;
  - `toStringAsFixed` e `toStringAsPrecision` funcionam como no Dart.
- **Entrada** (`stdin.readLineSync()`):
  - com `data-stdin`, lê dali, e o terminal mostra o eco do que foi lido;
  - sem `data-stdin`, o leitor **digita** no terminal (Ctrl+D = fim de entrada → `null`);
  - por dentro, a cada linha digitada o programa roda de novo desde o começo, e a saída repetida não aparece outra vez.
- **Arquivos** (`File('dados.txt')`): as abas são os arquivos da pasta `/home/ana`. O que o programa grava vale até o fim daquele Rodar (a meta `arquivo:` confere). `readAsStringSync`, `readAsLinesSync`, `writeAsStringSync` (com `mode: FileMode.append`), `existsSync`, `deleteSync` e `openWrite`.
- **Imports**:
  - `import 'contas.dart';` funciona entre abas, também com `as`, `show` e `hide`. Cada arquivo tem os seus nomes; usar sem prefixo um nome que dois imports trazem dá o erro do lab (`'formatar' is imported from both …`);
  - **as bibliotecas do SDK precisam de import**, como no lab: `sqrt` sem `import 'dart:math';` dá `Method not found: 'sqrt'.`, e `stdin` sem `dart:io` dá `Undefined name 'stdin'.`;
  - `package:` não funciona (o editor não baixa pacotes): use o lab.
- **Assíncrono**: `async`/`await`, `Future` (`delayed`, `value`, `wait`, `then`, `catchError`, `whenComplete`, `timeout`), `Stream` (`async*`, `await for`, `listen`, `StreamController`, `Stream.periodic`, `fromIterable`), `Timer`, `Completer`, `Isolate.run` (roda na mesma linha de execução) e `sync*`. A ordem das mensagens segue a do Dart (microtarefas antes de timers). Um `Future` que falha sem ninguém esperar por ele encerra o programa com `Unhandled exception:` (código 255), como no lab.
- **O que não roda**: `assert` (como no `dart run` sem `--enable-asserts`).
- **Números sorteados**: `Random(42)` usa o algoritmo da VM, então a mesma semente dá os mesmos números (confira no lab antes de pôr na meta). `Random()` sem semente, `DateTime.now()` e o `hashCode` padrão mudam a cada execução: **nunca** os use em metas.

### 4.3 O que o editor confere na compilação (erros 254, com a mensagem do lab)
**Sintaxe**:
- `Expected ';' after this.`, `Expected an identifier, but got ')'.` + `Try inserting…`, chaves sem par;
- palavra reservada como nome: `'class' can't be used as an identifier because it's a keyword.`;
- letras com acento em nomes: `The non-ASCII character 'ç' (U+00E7) can't be used in identifiers…`.

**Nomes**:
- `Undefined name 'x'.`, `Method not found: 'f'.`, `Member not found: 'Produto.brinde'.`;
- tipo inexistente: `'string' isn't a type.`; e, em `extends`/`with`/`implements`, `Type 'X' not found.`;
- nome ambíguo entre imports.

**Tipos**:
- `A value of type 'String' can't be assigned to a variable of type 'int'.`, também com elementos de uma lista tipada e argumentos (`The argument type … can't be assigned to the parameter type …`);
- getter, método ou setter inexistente numa classe sua ou em `Object`, e membro `_privado` usado de outra aba (outra biblioteca) (`The getter 'length' isn't defined for the type 'Object'.`), e atribuir a um campo `final`;
- `Too few/many positional arguments`, `Required named parameter 'x' must be provided.`, `No named parameter with the name 'x'.`.

**Null safety**:
- membro, método ou operador de tipo anulável (`Property 'length' cannot be accessed on 'String?' because it is potentially null.`);
- **com promoção de tipo**: depois de `if (x != null)`, de `if (x == null) return;` (ou `continue`/`break`/`throw`/`exit`), no `else` de `x == null`, depois de `x is T`, de `x ??= …` e de `x = valorNãoNulo`, dentro de `&&`/`||` e de `? :`;
- `Non-nullable variable 'x' must be assigned before it can be used.`;
- `A non-null value must be returned since the return type 'int' doesn't allow null.`.

**`final`/`const`**:
- `Can't assign to the final variable 'x'.`;
- `Not a constant expression.`;
- `Cannot invoke a non-'const' constructor where a const expression is expected.` (ex.: `const agora = DateTime.now();`).

**`switch` exaustivo**:
- expressão `switch` sobre `int`/`double`/`String`/`num` sem `_`: `The type 'int' is not exhaustively matched by the switch cases since it doesn't match 'int()'.`;
- sobre `bool` (`'false'`), enum (`'Cor.azul'`) e classe `sealed` (também no comando `switch`).

**Ainda não confere** (roda, e pode virar exceção ou rodar "certo" onde o lab recusa; avise se a aula precisar):
- a análise de fluxo mais fina (promoção de campos privados `final`, atribuição definida dentro de laços);
- erros de tipos genéricos e de *function types*;
- `@override` incorreto, métodos abstratos não implementados, modificadores de classe (`base`/`final`/`interface` fora da biblioteca);
- `late final` atribuído duas vezes (no lab é exceção em tempo de execução; no editor, não);
- vários erros de sintaxe ao mesmo tempo (o editor mostra o primeiro).

### 4.4 Versões do Dart 3 no editor
Funcionam:
- records e patterns (destructuring, `if-case`, `switch` com guardas `when`, padrões de objeto, lista, mapa e relacionais), expressões `switch`, `sealed`/`base`/`final`/`interface`/`mixin class` (3.0);
- extension types (3.3), com o `toString()` da representação;
- `_` coringa que não cria variável e pode repetir (3.7);
- elementos nulos `?item` em coleções (3.8);
- *dot shorthands* `.grande` (3.10, procurando o membro estático pelo nome);
- parâmetros nomeados privados `{required this._nome}` chamados com `nome:` (3.12);
- construtor primário `class Produto(final String nome);` (o que o lab 3.13.5 aceita).

### 4.5 Diferenças conhecidas
O testador `--nativo` registra as demais em `tools/DIFERENCAS.md`.
- **Nomes internos**: `_GrowableList`, `_Map` e as linhas `dart:core-patch/…` do stack trace podem diferir.
- **Exceções depois de `await`**: mostram o frame da função `async` + `<asynchronous suspension>`, sem a cadeia completa.
- **Desempenho**: o editor é mais lento em laços com milhões de voltas (o limite é 10 s).
- **O que o editor não tem**: `Process`, `HttpClient`, `Isolate.spawn` de verdade (portas), `dart:ffi`, `dart:mirrors` e pacotes.

### 4.6 Ferramentas (na VPS, em `~/guia-dart`)
| Comando | O que faz |
| --- | --- |
| `timeout 60 node tools/sim.js main.dart [outros.dart] [--stdin "Ana\n30"] [--digitar "Ana"] [--args "a b"] [--goal "out:…"]` | roda como o editor rodaria e diz se a meta passaria |
| `timeout 60 node tools/sim.js -e 'void main() => print(1);' [--js]` | idem, com o código na linha (`--js` mostra o JavaScript gerado) |
| `~/guia-dart-lab/testar [--nativo] pagina.html` (no notebook) | o testador: o inicial falha, a solução cumpre, escapes, links, privacidade; o `--nativo` roda também no Dart do lab e registra as diferenças em `tools/DIFERENCAS.md` |
| `timeout 600 node tools/diferencial.js [--sdk]` | o teste diferencial do motor: `tools/testes/*.dart` com a saída real do lab (`*.esperado`) |

Achou uma diferença que não está aqui? Anote no relatório para o agente do simulador.

## 5. Fidelidade: o laboratório (`~/guia-dart-lab/lab`, na VPS)
É a máquina da Ana (usuária `ana`, computador `notebook`, `/home/ana`, pt_BR, Ubuntu 26.04) com o **Dart SDK oficial** (versão no `COMO-USAR.md` do lab). Toda saída de terminal mostrada numa aula vem de lá:
- programa em arquivo: crie o `.dart` na home da Ana e rode `dart run arquivo.dart`;
- **as mensagens de erro do Dart saem em inglês** (`Error: The getter 'nome' isn't defined for the type 'Pessoa'.`): copie como saíram e explique em português;
- **Privacidade:** nada da máquina real nem da VPS; só `/home/ana/…`, `ana@notebook`.

## 6. Versão
O guia ensina o **Dart 3** (a versão estável do lab), com null safety, records, patterns, modificadores de classe e expressões `switch`. O que é recente fica marcado com `<span class="versao">Dart 3.x</span>` e reunido em `novidades.html`. Nunca afirme algo de uma versão sem conferir no lab ou na documentação oficial (dart.dev, api.dart.dev) — marque como **ilustrativo** o que não deu para rodar.

## 7. Escrita
- Português do Brasil, frases curtas, "você". O leitor nunca programou.
- Termos em inglês ganham tradução na primeira vez: `print` = "imprimir/mostrar", `final` = "final, não muda mais", `required` = "obrigatório".
- Exemplos com a vida da Ana: a lista de compras, as notas da turma, o estoque da lojinha, a padaria do bairro.
- Boas práticas desde o começo, sempre com o porquê (Effective Dart): `final` por padrão, tipos claros, nomes em `lowerCamelCase` (`precoTotal`), classes em `UpperCamelCase`, arquivos em `snake_case.dart`, aspas simples nos textos (o padrão dos lints), 2 espaços, vírgula no fim de listas longas.
- Nomes em português e sem acento (`preco`, `quantidade`).
