# Diferenças: editor do guia (motor do guia) × dart do lab

Mantido pelo `tools/testar-missoes.js --nativo`. O editor roda o **Dart do guia**: um tradutor de
Dart 3 para JavaScript (`assets/dart/`), que imita o `dart run` do **Dart SDK 3.13.5 oficial** do lab
(`~/guia-dart-lab/lab`). O testador roda o código inicial e a solução de cada caixa nos dois,
com o mesmo stdin e os mesmos argumentos, e compara a saída (stdout + stderr) e o código de saída.

## Diferenças conhecidas (esperadas)
Estão na §4 do `CONTRIBUINDO.md`: `Random()` sem semente, data e hora, `hashCode` padrão,
tempo medido, desempenho e as partes do Dart que o editor não tem.
Uma diferença que **não** está lá é um achado: avise o agente do simulador.

## Diferenças encontradas
<!-- AUTO: cada página tem a sua seção, reescrita a cada --nativo. Página sem diferença não aparece. -->

<!-- pagina:operadores-comparacao.html -->
### operadores-comparacao.html (2026-10-19 21:17 UTC)

**caixa 2, código inicial (linha 438)** — saída diferente: + main.dart:5:50: Error: 'saldo' isn't a type. | +   print('Saque de $saque1 permitido? ${saque1 =< saldo}'); | +                                                  ^^^^^ | + main.dart:5:55: Error: Expe

```dart
void main() {
  final saldo = 250;
  final saque1 = 300;
  final saque2 = 250;
  print('Saque de $saque1 permitido? ${saque1 =< saldo}');
  print('Saque de $saque2 permitido? ${saque2 < saldo}');
}
```

- editor (código de saída 254):

```
main.dart:5:50: Error: Expected '>' after this.
  print('Saque de $saque1 permitido? ${saque1 =< saldo}');
                                                 ^^^^^
```
- lab, dart (código de saída 254):

```
main.dart:5:50: Error: 'saldo' isn't a type.
  print('Saque de $saque1 permitido? ${saque1 =< saldo}');
                                                 ^^^^^
main.dart:5:50: Error: Expected '>' after this.
  print('Saque de $saque1 permitido? ${saque1 =< saldo}');
                                                 ^^^^^
main.dart:5:55: Error: Expected '[' before this.
  print('Saque de $saque1 permitido? ${saque1 =< saldo}');
                                                      ^
main.dart:5:40: Error: Can't assign to the final variable 'saque1'.
  print('Saque de $saque1 permitido? ${saque1 =< saldo}');
                                       ^^^^^^
```
<!-- /pagina:operadores-comparacao.html -->

<!-- pagina:operadores-logicos.html -->
### operadores-logicos.html (2026-10-19 21:17 UTC)

**caixa 2, código inicial (linha 359)** — saída diferente: + main.dart:4:39: Error: A value of type 'bool' can't be assigned to a variable of type 'int'. | +   final podeDirigir = idade >= 18 and temCarteira; | +                                       ^

```dart
void main() {
  final idade = 19;
  final temCarteira = true;
  final podeDirigir = idade >= 18 and temCarteira;
  print('Pode dirigir? $podeDirigir');
}
```

- editor (código de saída 254):

```
main.dart:4:35: Error: Binary operator 'and' is written as '&' instead of the written out word.
Try replacing 'and' with '&'.
  final podeDirigir = idade >= 18 and temCarteira;
                                  ^^^
```
- lab, dart (código de saída 254):

```
main.dart:4:35: Error: Binary operator 'and' is written as '&' instead of the written out word.
Try replacing 'and' with '&'.
  final podeDirigir = idade >= 18 and temCarteira;
                                  ^^^
main.dart:4:39: Error: A value of type 'bool' can't be assigned to a variable of type 'int'.
  final podeDirigir = idade >= 18 and temCarteira;
                                      ^
```
<!-- /pagina:operadores-logicos.html -->

<!-- pagina:final-const.html -->
### final-const.html (2026-10-19 21:17 UTC)

**caixa 3, código inicial (linha 456)** — saída diferente: + main.dart:2:19: Error: Expected ':' before this. | +   ? desconto = 0.1; | +                   ^ | + main.dart:2:5: Error: Setter not found: 'desconto'.

```dart
void main() {
  ? desconto = 0.1;
  ? produto = 'Caderno';
  ? preco = 20;
  ? precoFinal = preco - preco * desconto;
  ? estoque = 10;
  estoque = estoque - 1;
  print('Produto: $produto');
  print('Preço com desconto: $precoFinal');
  print('Estoque: $estoque');
}
```

- editor (código de saída 254):

```
main.dart:2:3: Error: Expected an identifier, but got '?'.
Try inserting an identifier before '?'.
  ? desconto = 0.1;
  ^
```
- lab, dart (código de saída 254):

```
main.dart:2:3: Error: Expected an identifier, but got '?'.
Try inserting an identifier before '?'.
  ? desconto = 0.1;
  ^
main.dart:2:19: Error: Expected ':' before this.
  ? desconto = 0.1;
                  ^
main.dart:2:5: Error: Setter not found: 'desconto'.
  ? desconto = 0.1;
    ^^^^^^^^
main.dart:2:19: Error: Expected an identifier, but got ';'.
Try inserting an identifier before ';'.
  ? desconto = 0.1;
                  ^
main.dart:3:3: Error: Expected an identifier, but got '?'.
Try inserting an identifier before '?'.
  ? produto = 'Caderno';
  ^
main.dart:3:24: Error: Expected ':' before this.
  ? produto = 'Caderno';
                       ^
main.dart:3:5: Error: Setter not found: 'produto'.
  ? produto = 'Caderno';
    ^^^^^^^
main.dart:3:24: Error: Expected an identifier, but got ';'.
Try inserting an identifier before ';'.
  ? produto = 'Caderno';
                       ^
main.dart:4:3: Error: Expected an identifier, but got '?'.
Try inserting an identifier before '?'.
  ? preco = 20;
  ^
main.dart:4:15: Error: Expected ':' before this.
  ? preco = 20;
              ^
main.dart:4:5: Error: Setter not found: 'preco'.
  ? preco = 20;
    ^^^^^
main.dart:4:15: Error: Expected an identifier, but got ';'.
Try inserting an identifier before ';'.
  ? preco = 20;
              ^
main.dart:5:3: Error: Expected an identifier, but got '?'.
Try inserting an identifier before '?'.
  ? precoFinal = preco - preco * desconto;
  ^
main.dart:5:34: Error: Undefined name 'desconto'.
  ? precoFinal = preco - preco * desconto;
                                 ^^^^^^^^
main.dart:5:26: Error: Undefined name 'preco'.
  ? precoFinal = preco - preco * desconto;
                         ^^^^^
main.dart:5:18: Error: Undefined name 'preco'.
  ? precoFinal = preco - preco * desconto;
                 ^^^^^
main.dart:5:42: Error: Expected ':' before this.
  ? precoFinal = preco - preco * desconto;
                                         ^
main.dart:5:5: Error: Setter not found: 'precoFinal'.
  ? precoFinal = preco - preco * desconto;
    ^^^^^^^^^^
main.dart:5:42: Error: Expected an identifier, but got ';'.
Try inserting an identifier before ';'.
  ? precoFinal = preco - preco * desconto;
                                         ^
main.dart:6:3: Error: Expected an identifier, but got '?'.
Try inserting an identifier before '?'.
  ? estoque = 10;
  ^
main.dart:6:17: Error: Expected ':' before this.
  ? estoque = 10;
                ^
main.dart:6:5: Error: Setter not found: 'estoque'.
  ? estoque = 10;
    ^^^^^^^
main.dart:6:17: Error: Expected an identifier, but got ';'.
Try inserting an identifier before ';'.
  ? estoque = 10;
                ^
main.dart:7:13: Error: Undefined name 'estoque'.
  estoque = estoque - 1;
            ^^^^^^^
main.dart:7:3: Error: Setter not found: 'estoque'.
  estoque = estoque - 1;
  ^^^^^^^
main.dart:8:20: Error: Undefined name 'produto'.
  print('Produto: $produto');
                   ^^^^^^^
main.dart:9:31: Error: Undefined name 'precoFinal'.
  print('Preço com desconto: $precoFinal');
                              ^^^^^^^^^^
main.dart:10:20: Error: Undefined name 'estoque'.
  print('Estoque: $estoque');
                   ^^^^^^^
```
<!-- /pagina:final-const.html -->

<!-- pagina:nomes-variaveis.html -->
### nomes-variaveis.html (2026-10-19 21:17 UTC)

**caixa 1, código inicial (linha 123)** — saída diferente: + main.dart:3:3: Error: Variables can't be declared using both 'var' and a type name. | + Try removing 'var.' | +   var quantidade de alunos = 32; | +   ^^^

```dart
void main() {
  var class = 'Turma A';
  var quantidade de alunos = 32;
  print(class);
  print(quantidade de alunos);
}
```

- editor (código de saída 254):

```
main.dart:2:7: Error: 'class' can't be used as an identifier because it's a keyword.
Try renaming this to be an identifier that isn't a keyword.
  var class = 'Turma A';
      ^^^^^
```
- lab, dart (código de saída 254):

```
main.dart:2:7: Error: 'class' can't be used as an identifier because it's a keyword.
Try renaming this to be an identifier that isn't a keyword.
  var class = 'Turma A';
      ^^^^^
main.dart:3:3: Error: Variables can't be declared using both 'var' and a type name.
Try removing 'var.'
  var quantidade de alunos = 32;
  ^^^
main.dart:3:7: Error: 'quantidade' isn't a type.
  var quantidade de alunos = 32;
      ^^^^^^^^^^
main.dart:3:18: Error: Expected ';' after this.
  var quantidade de alunos = 32;
                 ^^
main.dart:3:21: Error: Setter not found: 'alunos'.
  var quantidade de alunos = 32;
                    ^^^^^^
main.dart:4:9: Error: 'class' can't be used as an identifier because it's a keyword.
Try renaming this to be an identifier that isn't a keyword.
  print(class);
        ^^^^^
main.dart:5:9: Error: Undefined name 'quantidade'.
  print(quantidade de alunos);
        ^^^^^^^^^^
main.dart:5:20: Error: Expected ',' before this.
  print(quantidade de alunos);
                   ^^
main.dart:5:23: Error: Expected ',' before this.
  print(quantidade de alunos);
                      ^^^^^^
main.dart:5:23: Error: Undefined name 'alunos'.
  print(quantidade de alunos);
                      ^^^^^^
main.dart:5:8: Error: Too many positional arguments: 1 allowed, but 3 found.
Try removing the extra positional arguments.
  print(quantidade de alunos);
       ^
org-dartlang-sdk:///sdk/lib/core/print.dart:19:6: Context: Found this candidate, but the arguments don't match.
void print(Object? object) {
     ^^^^^
```

**caixa 2, código inicial (linha 432)** — saída diferente: + main.dart:2:12: Error: Undefined name 'franceses'. | +   var pães-franceses = 30; | +            ^^^^^^^^^ | + main.dart:2:22: Error: Can't assign to this.

```dart
void main() {
  var pães-franceses = 30;
  var preço do açúcar = 4.5;
  var 1aberta = true;
  print('Pão francês: $pães-franceses');
  print('Açúcar: $preço do açúcar');
  print('Aberta: $1aberta');
}
```

- editor (código de saída 254):

```
main.dart:2:8: Error: The non-ASCII character 'ã' (U+00E3) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  var pães-franceses = 30;
       ^
main.dart:3:10: Error: The non-ASCII character 'ç' (U+00E7) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  var preço do açúcar = 4.5;
         ^
main.dart:3:17: Error: The non-ASCII character 'ç' (U+00E7) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  var preço do açúcar = 4.5;
                ^
main.dart:3:18: Error: The non-ASCII character 'ú' (U+00FA) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  var preço do açúcar = 4.5;
                 ^
main.dart:7:19: Error: A '$' has special meaning inside a string, and must be followed by an identifier or an expression in curly braces ({}).
Try adding a backslash (\) to escape the '$'.
  print('Aberta: $1aberta');
                  ^
main.dart:2:7: Error: Expected ';' after this.
  var pães-franceses = 30;
      ^^^^
```
- lab, dart (código de saída 254):

```
main.dart:2:8: Error: The non-ASCII character 'ã' (U+00E3) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  var pães-franceses = 30;
       ^
main.dart:3:10: Error: The non-ASCII character 'ç' (U+00E7) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  var preço do açúcar = 4.5;
         ^
main.dart:3:17: Error: The non-ASCII character 'ç' (U+00E7) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  var preço do açúcar = 4.5;
                ^
main.dart:3:18: Error: The non-ASCII character 'ú' (U+00FA) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  var preço do açúcar = 4.5;
                 ^
main.dart:7:19: Error: A '$' has special meaning inside a string, and must be followed by an identifier or an expression in curly braces ({}).
Try adding a backslash (\) to escape the '$'.
  print('Aberta: $1aberta');
                  ^
main.dart:2:7: Error: Expected ';' after this.
  var pães-franceses = 30;
      ^^^^
main.dart:2:12: Error: Undefined name 'franceses'.
  var pães-franceses = 30;
           ^^^^^^^^^
main.dart:2:22: Error: Can't assign to this.
  var pães-franceses = 30;
                     ^
main.dart:3:7: Error: Expected ';' after this.
  var preço do açúcar = 4.5;
      ^^^^^
main.dart:3:16: Error: Setter not found: 'açúcar'.
  var preço do açúcar = 4.5;
               ^^^^^^
main.dart:4:3: Error: Expected 'while' before this.
  var 1aberta = true;
  ^^^
main.dart:4:3: Error: Expected to find '('.
  var 1aberta = true;
  ^^^
main.dart:4:3: Error: Expected an identifier, but got 'var'.
Try inserting an identifier before 'var'.
  var 1aberta = true;
  ^^^
main.dart:3:28: Error: Expected ';' after this.
  var preço do açúcar = 4.5;
                           ^
main.dart:4:7: Error: Expected an identifier, but got '1'.
Try inserting an identifier before '1'.
  var 1aberta = true;
      ^
main.dart:4:7: Error: Expected ';' after this.
  var 1aberta = true;
      ^
main.dart:4:8: Error: Setter not found: 'aberta'.
  var 1aberta = true;
       ^^^^^^
main.dart:5:24: Error: Undefined name 'p'.
  print('Pão francês: $pães-franceses');
                       ^
main.dart:6:19: Error: Undefined name 'pre'.
  print('Açúcar: $preço do açúcar');
                  ^^^
```
<!-- /pagina:nomes-variaveis.html -->

<!-- pagina:for.html -->
### for.html (2026-10-19 21:17 UTC)

**caixa 2, código inicial (linha 473)** — saída diferente: + main.dart:3:19: Error: 'n' is already declared in this scope. | +   for (var n = 1, n <= 4, n++) { | +                   ^ | + main.dart:3:12: Context: Previous declaration of 'n'.

```dart
void main() {
  var soma = 0;
  for (var n = 1, n <= 4, n++) {
    soma += n;
  }
  print('Soma de 1 a 4: $soma');
}
```

- editor (código de saída 254):

```
main.dart:3:19: Error: Expected ';' after this.
  for (var n = 1, n <= 4, n++) {
                  ^
```
- lab, dart (código de saída 254):

```
main.dart:3:19: Error: 'n' is already declared in this scope.
  for (var n = 1, n <= 4, n++) {
                  ^
main.dart:3:12: Context: Previous declaration of 'n'.
  for (var n = 1, n <= 4, n++) {
           ^
main.dart:3:19: Error: Expected ';' after this.
  for (var n = 1, n <= 4, n++) {
                  ^
main.dart:3:21: Error: Expected an identifier, but got '<='.
Try inserting an identifier before '<='.
  for (var n = 1, n <= 4, n++) {
                    ^^
main.dart:3:24: Error: Expected ';' after this.
  for (var n = 1, n <= 4, n++) {
                       ^
main.dart:3:25: Error: Expected an identifier, but got ','.
Try inserting an identifier before ','.
  for (var n = 1, n <= 4, n++) {
                        ^
```
<!-- /pagina:for.html -->

<!-- pagina:for-in.html -->
### for-in.html (2026-10-19 21:17 UTC)

**caixa 2, código inicial (linha 388)** — saída diferente: + main.dart:4:14: Error: 'preco' isn't a type. | +   for (final preco of precos) { | +              ^^^^^ | + main.dart:4:23: Error: Expected ';' after this.

```dart
void main() {
  final precos = [4.50, 12.90, 3.25, 7.00];
  var total = 0.0;
  for (final preco of precos) {
    total += preco;
  }
  print('Total: R\$ ${total.toStringAsFixed(2)}');
}
```

- editor (código de saída 254):

```
main.dart:4:20: Error: Expected ';' after this.
  for (final preco of precos) {
                   ^^
```
- lab, dart (código de saída 254):

```
main.dart:4:14: Error: 'preco' isn't a type.
  for (final preco of precos) {
             ^^^^^
main.dart:4:20: Error: Expected ';' after this.
  for (final preco of precos) {
                   ^^
main.dart:4:23: Error: Expected ';' after this.
  for (final preco of precos) {
                      ^^^^^^
main.dart:5:14: Error: Undefined name 'preco'.
    total += preco;
             ^^^^^
main.dart:4:23: Error: A value of type 'List<double>' can't be assigned to a variable of type 'bool'.
 - 'List' is from 'dart:core'.
  for (final preco of precos) {
                      ^
```
<!-- /pagina:for-in.html -->

<!-- pagina:projeto-adivinhacao.html -->
### projeto-adivinhacao.html (2026-10-19 21:17 UTC)

**caixa 3, solução (linha 332)** — saída diferente: + Seu palpite: É maior! | + Seu palpite: É maior! | + Seu palpite: É maior! | + Seu palpite: É maior! (esperado: Random() sem semente)

```dart
import 'dart:io';
import 'dart:math';

void main() {
  final segredo = Random().nextInt(100) + 1;
  var palpite = 0;
  var tentativas = 0;
  while (palpite != segredo) {
    stdout.write('Seu palpite: ');
    palpite = int.parse(stdin.readLineSync()!);
    tentativas++;
    if (palpite < segredo) {
      print('É maior!');
    } else if (palpite > segredo) {
      print('É menor!');
    }
  }
  print('Acertou em $tentativas tentativas! Era $segredo.');
}
```

- editor (código de saída 0):

```
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: Acertou em 50 tentativas! Era 50.
```
- lab, dart (código de saída 0):

```
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: É maior!
Seu palpite: Acertou em 73 tentativas! Era 73.
```

**caixa 4, solução (linha 547)** — saída diferente: + Acabaram as tentativas. Era 94. | - Acabaram as tentativas. Era 13. (esperado: Random() sem semente)

```dart
import 'dart:io';
import 'dart:math';

const maxTentativas = 7;

void main() {
  final segredo = Random().nextInt(100) + 1;
  var tentativas = 0;
  while (tentativas < maxTentativas) {
    stdout.write('Tentativa ${tentativas + 1}: ');
    final palpite = int.tryParse(stdin.readLineSync() ?? '');
    if (palpite == null) {
      print('Digite um número inteiro de 1 a 100.');
      continue;
    }
    tentativas++;
    if (palpite == segredo) {
      print('Acertou em $tentativas tentativas!');
      return;
    }
    print(palpite < segredo ? 'É maior!' : 'É menor!');
  }
  print('Acabaram as tentativas. Era $segredo.');
}
```

- editor (código de saída 0):

```
Tentativa 1: Digite um número inteiro de 1 a 100.
Tentativa 1: É maior!
Tentativa 2: É maior!
Tentativa 3: É maior!
Tentativa 4: É maior!
Tentativa 5: É maior!
Tentativa 6: É maior!
Tentativa 7: É maior!
Acabaram as tentativas. Era 13.
```
- lab, dart (código de saída 0):

```
Tentativa 1: Digite um número inteiro de 1 a 100.
Tentativa 1: É maior!
Tentativa 2: É maior!
Tentativa 3: É maior!
Tentativa 4: É maior!
Tentativa 5: É maior!
Tentativa 6: É maior!
Tentativa 7: É maior!
Acabaram as tentativas. Era 94.
```
<!-- /pagina:projeto-adivinhacao.html -->

<!-- pagina:arrow.html -->
### arrow.html (2026-10-19 21:18 UTC)

**caixa 3, código inicial (linha 347)** — saída diferente: + main.dart:3:71: Error: Expected ';' after this. | + String formatarPreco(double valor) => 'R\$ ${valor.toStringAsFixed(2)}' | +                                                                       

```dart
double totalDaCompra(double preco, int quantidade) => return preco * quantidade;

String formatarPreco(double valor) => 'R\$ ${valor.toStringAsFixed(2)}'

void main() {
  print(formatarPreco(totalDaCompra(0.75, 10)));
}
```

- editor (código de saída 254):

```
main.dart:1:55: Error: Unexpected token 'return'.
double totalDaCompra(double preco, int quantidade) => return preco * quantidade;
                                                      ^^^^^^
```
- lab, dart (código de saída 254):

```
main.dart:1:55: Error: Unexpected token 'return'.
double totalDaCompra(double preco, int quantidade) => return preco * quantidade;
                                                      ^^^^^^
main.dart:3:71: Error: Expected ';' after this.
String formatarPreco(double valor) => 'R\$ ${valor.toStringAsFixed(2)}'
                                                                      ^
main.dart:5:1: Error: Unexpected token 'void'.
void main() {
^^^^
```
<!-- /pagina:arrow.html -->

<!-- pagina:funcoes-anonimas.html -->
### funcoes-anonimas.html (2026-10-19 21:18 UTC)

**caixa 3, código inicial (linha 418)** — saída diferente: + main.dart:5:4: Error: Expected ';' after this. | +   }) | +    ^

```dart
void main() {
  final compras = ['arroz', 'feijão'];
  compras.forEach((item) => {
    print('- $item');
  })
}
```

- editor (código de saída 254):

```
main.dart:4:21: Error: Expected '}' before this.
    print('- $item');
                    ^
```
- lab, dart (código de saída 254):

```
main.dart:4:21: Error: Expected '}' before this.
    print('- $item');
                    ^
main.dart:5:4: Error: Expected ';' after this.
  })
   ^
```
<!-- /pagina:funcoes-anonimas.html -->

<!-- pagina:ref-palavras-reservadas.html -->
### ref-palavras-reservadas.html (2026-10-19 21:18 UTC)

**caixa 1, código inicial (linha 369)** — saída diferente: + main.dart:3:9: Error: 'class' can't be used as an identifier because it's a keyword. | + Try renaming this to be an identifier that isn't a keyword. | +   print(class); | +         ^^^^^

```dart
void main() {
  var class = 'Turma A';
  print(class);
}
```

- editor (código de saída 254):

```
main.dart:2:7: Error: 'class' can't be used as an identifier because it's a keyword.
Try renaming this to be an identifier that isn't a keyword.
  var class = 'Turma A';
      ^^^^^
```
- lab, dart (código de saída 254):

```
main.dart:2:7: Error: 'class' can't be used as an identifier because it's a keyword.
Try renaming this to be an identifier that isn't a keyword.
  var class = 'Turma A';
      ^^^^^
main.dart:3:9: Error: 'class' can't be used as an identifier because it's a keyword.
Try renaming this to be an identifier that isn't a keyword.
  print(class);
        ^^^^^
```
<!-- /pagina:ref-palavras-reservadas.html -->

<!-- pagina:sintaxe.html -->
### sintaxe.html (2026-10-19 21:18 UTC)

**caixa 2, código inicial (linha 437)** — saída diferente: + main.dart:5:1: Error: Expected a declaration, but got '}'. | + } | + ^ | + main.dart:2:56: Error: Expected an identifier, but got ','.

```dart
void main() {
print('Bilhete para a padaria'); print('Quero 10 pães'),
      print('Separe um bolo de fubá');
}
}
```

- editor (código de saída 254):

```
main.dart:2:55: Error: Expected ';' after this.
print('Bilhete para a padaria'); print('Quero 10 pães'),
                                                      ^
```
- lab, dart (código de saída 254):

```
main.dart:5:1: Error: Expected a declaration, but got '}'.
}
^
main.dart:2:55: Error: Expected ';' after this.
print('Bilhete para a padaria'); print('Quero 10 pães'),
                                                      ^
main.dart:2:56: Error: Expected an identifier, but got ','.
Try inserting an identifier before ','.
print('Bilhete para a padaria'); print('Quero 10 pães'),
                                                       ^
main.dart:2:56: Error: Unexpected token ';'.
print('Bilhete para a padaria'); print('Quero 10 pães'),
                                                       ^
```
<!-- /pagina:sintaxe.html -->

<!-- pagina:strings.html -->
### strings.html (2026-10-19 21:19 UTC)

**caixa 2, código inicial (linha 437)** — saída diferente: + main.dart:2:16: Error: Undefined name 'água'. | +   print('Pão d'água'); | +                ^^^^ | + main.dart:2:20: Error: Expected ',' before this.

```dart
void main() {
  print('Pão d'água');
}
```

- editor (código de saída 254):

```
main.dart:2:16: Error: The non-ASCII character 'á' (U+00E1) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  print('Pão d'água');
               ^
main.dart:2:20: Error: String starting with ' must end with '.
  print('Pão d'água');
                   ^^^
main.dart:2:8: Error: Can't find ')' to match '('.
  print('Pão d'água');
       ^
main.dart:2:16: Error: Expected ',' before this.
  print('Pão d'água');
               ^^^^
```
- lab, dart (código de saída 254):

```
main.dart:2:16: Error: The non-ASCII character 'á' (U+00E1) can't be used in identifiers, only in strings and comments.
Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign).
  print('Pão d'água');
               ^
main.dart:2:20: Error: String starting with ' must end with '.
  print('Pão d'água');
                   ^^^
main.dart:2:8: Error: Can't find ')' to match '('.
  print('Pão d'água');
       ^
main.dart:2:16: Error: Expected ',' before this.
  print('Pão d'água');
               ^^^^
main.dart:2:16: Error: Undefined name 'água'.
  print('Pão d'água');
               ^^^^
main.dart:2:20: Error: Expected ',' before this.
  print('Pão d'água');
                   ^^^
main.dart:2:8: Error: Too many positional arguments: 1 allowed, but 3 found.
Try removing the extra positional arguments.
  print('Pão d'água');
       ^
org-dartlang-sdk:///sdk/lib/core/print.dart:19:6: Context: Found this candidate, but the arguments don't match.
void print(Object? object) {
     ^^^^^
main.dart:2:20: Error: Expected ';' after this.
  print('Pão d'água');
                   ^^^
```
<!-- /pagina:strings.html -->

<!-- pagina:ternario.html -->
### ternario.html (2026-10-19 21:19 UTC)

**caixa 2, código inicial (linha 300)** — saída diferente: + main.dart:3:33: Error: Expected an identifier, but got ';'. | + Try inserting an identifier before ';'. | +   final preco = idade <= 12 ? 15; | +                                 ^

```dart
void main() {
  final idade = 10;
  final preco = idade <= 12 ? 15;
  print('Ingresso: R\$ $preco');
}
```

- editor (código de saída 254):

```
main.dart:3:33: Error: Expected ':' before this.
  final preco = idade <= 12 ? 15;
                                ^
```
- lab, dart (código de saída 254):

```
main.dart:3:33: Error: Expected ':' before this.
  final preco = idade <= 12 ? 15;
                                ^
main.dart:3:33: Error: Expected an identifier, but got ';'.
Try inserting an identifier before ';'.
  final preco = idade <= 12 ? 15;
                                ^
```
<!-- /pagina:ternario.html -->

<!-- pagina:while.html -->
### while.html (2026-10-19 21:19 UTC)

**caixa 5, código inicial (linha 553)** — saída diferente: + main.dart:3:21: Error: Expected ';' after this. | +   while contador <= 5 { | +                     ^ | + main.dart:7:22: Error: Undefined name 'voltas'.

```dart
void main() {
  var contador = 1;
  while contador <= 5 {
    print('Volta $contador');
    contador++;
  }
  print('Fim! Foram $voltas voltas.');
}
```

- editor (código de saída 254):

```
main.dart:3:9: Error: Expected to find '('.
  while contador <= 5 {
        ^^^^^^^^
main.dart:3:9: Error: Expected an identifier, but got 'contador'.
Try inserting an identifier before 'contador'.
  while contador <= 5 {
        ^^^^^^^^
```
- lab, dart (código de saída 254):

```
main.dart:3:9: Error: Expected to find '('.
  while contador <= 5 {
        ^^^^^^^^
main.dart:3:9: Error: Expected an identifier, but got 'contador'.
Try inserting an identifier before 'contador'.
  while contador <= 5 {
        ^^^^^^^^
main.dart:3:21: Error: Expected ';' after this.
  while contador <= 5 {
                    ^
main.dart:7:22: Error: Undefined name 'voltas'.
  print('Fim! Foram $voltas voltas.');
                     ^^^^^^
```
<!-- /pagina:while.html -->

<!-- pagina:excecoes.html -->
### excecoes.html (2026-10-19 21:19 UTC)

**caixa 2, código inicial (linha 465)** — saída diferente: + main.dart:4:11: Error: A catch clause must have a body, even if it is empty. | + Try adding an empty body. | +   } catch e { | +           ^

```dart
void main() {
  try {
    final pago = int.parse('20');
  } catch e {
    print('Valor inválido: $e');
  }
  print('Pago: $pago');
}
```

- editor (código de saída 254):

```
main.dart:4:11: Error: 'catch' must be followed by '(identifier)' or '(identifier, identifier)'.
No types are needed, the first is given by 'on', the second is always 'StackTrace'.
  } catch e {
          ^
```
- lab, dart (código de saída 254):

```
main.dart:4:11: Error: 'catch' must be followed by '(identifier)' or '(identifier, identifier)'.
No types are needed, the first is given by 'on', the second is always 'StackTrace'.
  } catch e {
          ^
main.dart:4:11: Error: A catch clause must have a body, even if it is empty.
Try adding an empty body.
  } catch e {
          ^
main.dart:4:11: Error: Expected ';' after this.
  } catch e {
          ^
main.dart:4:11: Error: Undefined name 'e'.
  } catch e {
          ^
main.dart:5:29: Error: Undefined name 'e'.
    print('Valor inválido: $e');
                            ^
main.dart:7:17: Error: Undefined name 'pago'.
  print('Pago: $pago');
                ^^^^
```
<!-- /pagina:excecoes.html -->
