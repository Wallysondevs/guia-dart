import "dart:io";
void main() {
  var nome = stdin.readLineSync();
  print("Olá, $nome!");
  final l = [3, 1, 2]..sort();
  print(l.map((x) => x * 2));
}
