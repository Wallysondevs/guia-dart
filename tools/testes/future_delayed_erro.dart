Future<int> lerEstoque(String produto) {
  return Future.delayed(Duration(milliseconds: 10), () {
    if (produto == 'pizza') {
      throw StateError('não vendemos $produto');
    }
    return 30;
  });
}

void main() {
  lerEstoque('pão').then((n) => print('pão: $n'));
  lerEstoque('pizza').then((n) => print('pizza: $n'));
  print('Pedido enviado');
}
