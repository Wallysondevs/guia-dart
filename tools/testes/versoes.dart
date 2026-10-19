extension type Id(int valor) {
  int dobro() => valor * 2;
}
class Pessoa {
  final String _nome;
  Pessoa({required this._nome});
  String get nome => _nome;
}
void main() {
  final id = Id(21);
  print(id.dobro());
  print(id);
  var _ = 1;
  var _ = 2;
  final f = (_, _) => 'ok';
  print(f(1, 2));
  print(Pessoa(nome: 'Ana').nome);
  var (a, _) = (1, 2);
  print(a);
}
