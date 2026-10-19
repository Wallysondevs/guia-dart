Future<int> lerEstoque(String produto) async {
  await Future.delayed(Duration(milliseconds: 10));
  throw StateError('não vendemos $produto');
}

Future<void> main() async {
  try {
    lerEstoque('pizza');
    print('Pedido enviado');
  } catch (e) {
    print('Tratado: $e');
  }
  print('Fim do main');
}
