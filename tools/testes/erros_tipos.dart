class Pessoa { String nome = 'a'; }
class Conta { int saldo = 0; final int numero = 1; }
void main() {
  final p = Pessoa();
  print(p.idade);
  p.falar();
  Pessoa q = 'x';
  List<int> l = [1, 'a'];
  final c = Conta();
  c.numero = 3;
  int f(int x) { }
  String s = 3.5;
}
