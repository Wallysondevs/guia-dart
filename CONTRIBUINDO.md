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

(em construção)

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
