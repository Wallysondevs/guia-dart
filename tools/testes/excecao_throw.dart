void dividir(int a, int b) {
  if (b == 0) throw Exception("divisão por zero");
}
void main() {
  print({"a": 1, "b": [1.0, 2.5]});
  print(5 / 2); print(4 / 2); print(7 ~/ 2); print(null); print(Object()); print((1, "a", x: 2));
  dividir(1, 0);
}
