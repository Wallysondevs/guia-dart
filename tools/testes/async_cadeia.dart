Future<int> lerEstoque(String produto) async {
  await Future.delayed(Duration(milliseconds: 10));
  if (produto == 'pizza') {
    throw StateError('não vendemos $produto');
  }
  return 30;
}

Future<void> verificar(String produto) async {
  final n = await lerEstoque(produto);
  print('$produto: $n');
}

Future<void> main() async {
  await verificar('pão');
  await verificar('pizza');
  print('Fim');
}
