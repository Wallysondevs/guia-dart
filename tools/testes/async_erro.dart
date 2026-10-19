Future<void> main() async {
  print("a");
  await Future.delayed(Duration(milliseconds: 10));
  print("b");
  throw StateError("ruim");
}
