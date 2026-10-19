void main() {
  int n = 3;
  String s = "a";
  double d = 2.5;
  bool b = true;
  var x = switch (n) { 1 => "um", 2 => "dois" };
  var y = switch (s) { "a" => 1 };
  var z = switch (d) { < 5 => 1, >= 5 => 2 };
  var w = switch (b) { true => 1 };
  print("$x $y $z $w");
}
