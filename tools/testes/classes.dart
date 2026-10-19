abstract class Forma { double area(); String get nome; }
mixin Desenhavel { String desenhar() => 'desenhando $runtimeType'; }
class Circulo extends Forma with Desenhavel {
  final double r;
  Circulo(this.r);
  @override double area() => 3.14 * r * r;
  @override String get nome => 'círculo';
  @override String toString() => 'Circulo($r)';
}
enum Cor { vermelho, verde; String get min => name.toLowerCase(); }
sealed class Pagamento {}
class Pix extends Pagamento { final String chave; Pix(this.chave); }
class Boleto extends Pagamento { final int dias; Boleto(this.dias); }
String desc(Pagamento p) => switch (p) { Pix(:final chave) => 'pix $chave', Boleto(dias: var d) when d > 2 => 'boleto longo', Boleto() => 'boleto' };
class Ponto {
  final int x, y;
  const Ponto(this.x, this.y);
  Ponto operator +(Ponto o) => Ponto(x + o.x, y + o.y);
  @override bool operator ==(Object o) => o is Ponto && o.x == x && o.y == y;
  @override int get hashCode => Object.hash(x, y);
}
void main() {
  final c = Circulo(2);
  print(c);
  print(c.area());
  print(c.desenhar());
  print(Cor.verde);
  print(Cor.values);
  print(Cor.verde.index);
  print(desc(Pix('a@b')));
  print(desc(Boleto(3)));
  print(desc(Boleto(1)));
  print(Ponto(1, 2) + Ponto(3, 4) == Ponto(4, 6));
  print({Ponto(1, 1), Ponto(1, 1)}.length);
  try {
    throw FormatException('ruim');
  } on FormatException catch (e) {
    print('pegou: $e');
  } finally {
    print('fim');
  }
}
