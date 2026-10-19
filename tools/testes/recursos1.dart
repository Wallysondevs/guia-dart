import 'dart:math' as math;
import 'dart:io';
class A { int x; A(this.x); }
class B extends A { int y; B(super.x, this.y); }
extension E on double { String get f => toStringAsFixed(1); }
extension S on int { String get estrelas => '*' * this; }
class Contador { int total = 0; void inc() { total++; ++total; total--; } }
enum Tamanho { pequeno, grande }
void main() {
  print(math.max(1, 2));
  print(B(1, 2).y);
  print(2.345.f);
  print(3.estrelas);
  print(Object.hash("a", 1.0) == Object.hash("a", 1.0));
  final c = Contador()..inc(); print(c.total);
  final idade = int.tryParse('5');
  if (idade == null) { print('nada'); } else { print(idade + 10); }
  String? s = stdin.readLineSync();
  if (s == null) return;
  print(s.length);
  Tamanho t = .grande;
  print(t);
  var funcs = <void Function()>[];
  for (var i = 0; i < 3; i++) { funcs.add(() => print('Aviso $i')); }
  for (final f in funcs) f();
  final m = {'a': 1};
  for (final MapEntry(key: k, value: v) in m.entries) print('$k=$v');
  print(switch (idade) { 5 => 'cinco', _ => 'outro' });
}
