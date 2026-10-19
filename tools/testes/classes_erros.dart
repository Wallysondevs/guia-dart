abstract class Pagamento {
  double valor;
  Pagamento(this.valor);
  String get nome;
  double taxa();
}
class Vale extends Pagamento {
  Vale(super.valor);
}
class Pessoa {
  final String nome;
  final int idade;
}
enum Cobertura { granola, morango }
void main() {
  final p = Pessoa('Ana', 30);
  for (final c in Cobertura.values) {
    print(c.preco);
  }
  String r = StringBuffer();
  bool pagou = True;
  int x = '1';
}
