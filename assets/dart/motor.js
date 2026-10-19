/* =====================================================================
   motor.js — o Dart do editor do Guia Dart.
   Um tradutor de Dart 3 para JavaScript (lexer → parser → verificação →
   JavaScript) com uma biblioteca que imita a dart:core/dart:io/dart:math.
   Roda no Web Worker do editor (assets/dart/dart-worker.js) e no Node
   (tools/sim.js, tools/testar-missoes.js). Não é o Dart oficial: o que
   difere está na §4 do CONTRIBUINDO.md.
   ===================================================================== */
(function (raiz) {
  "use strict";
  var VERSAO = "3.13.5";

  /* ===================================================================
     1. Lexer
     =================================================================== */
  var PALAVRAS_RESERVADAS = new Set(("assert break case catch class const continue default do else enum extends false final finally for if in is new null rethrow return super switch this throw true try var void while with").split(" "));
  var OPS = [">>>=", "...?", "~/=", ">>=", "<<=", "??=", "...", "&&=", "||=", "?..", ">>>",
    "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "=>", "??", "?.", "..", "~/", "<<", ">>",
    "+", "-", "*", "/", "%", "<", ">", "=", "!", "?", ":", ";", ",", ".", "(", ")", "[", "]", "{", "}", "&", "|", "^", "~", "@", "#"];

  function ErroDart(msg, pos, len, extra) { this.msg = msg; this.pos = pos; this.len = len || 1; this.extra = extra || null; }

  function lexer(src, inicio, interp) {
    // interp: lexa um ${…} a partir de "inicio" e para no "}" que fecha (devolve {toks, fim})
    var toks = [], i = inicio || 0, n = src.length, nl = false, prof = 0;
    var lexErros = ERROS_LEX;
    function err(m, p, l) { throw new ErroDart(m, p, l); }
    while (true) {
      // espaços e comentários
      while (i < n) {
        var c = src[i];
        if (c === "\n") { nl = true; i++; }
        else if (c === " " || c === "\t" || c === "\r") i++;
        else if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; }
        else if (c === "/" && src[i + 1] === "*") {
          var prof = 1, ini = i; i += 2;
          while (i < n && prof) { if (src[i] === "/" && src[i + 1] === "*") { prof++; i += 2; } else if (src[i] === "*" && src[i + 1] === "/") { prof--; i += 2; } else i++; }
          if (prof) err("Comment starting with '/*' must end with '*/'.", ini, 2);
        } else break;
      }
      if (i >= n) {
        if (interp) throw new ErroDart("Can't find '}' to match '${'.", inicio - 2, 2);
        toks.push({ t: "eof", v: "", p: n, e: n, nl: true }); break;
      }
      if (interp && src[i] === "}" && prof === 0) { toks.push({ t: "eof", v: "", p: i, e: i }); return { toks: toks, fim: i }; }
      var c0 = src[i], p0 = i;
      if (/[A-Za-z_$]/.test(c0) || (c0 > "\x7f" && /\p{L}/u.test(c0))) {
        // string crua r'...'
        if ((c0 === "r") && (src[i + 1] === "'" || src[i + 1] === '"')) { i++; toks.push(lerString(true, p0)); nl = false; continue; }
        while (i < n && (/[A-Za-z0-9_$]/.test(src[i]) || (src[i] > "\x7f" && /[\p{L}\p{M}\p{N}]/u.test(src[i])))) {
          if (src[i] > "\x7f") {
            var cp = src.codePointAt(i), ch = String.fromCodePoint(cp);
            lexErros.push(new ErroDart("The non-ASCII character '" + ch + "' (U+" + cp.toString(16).toUpperCase().padStart(4, "0") + ") can't be used in identifiers, only in strings and comments.", i, 1, "Try using an US-ASCII letter, a digit, '_' (an underscore), or '$' (a dollar sign)."));
            i += ch.length; continue;
          }
          i++;
        }
        toks.push({ t: "id", v: src.slice(p0, i), p: p0, e: i, nl: nl }); nl = false; continue;
      }
      if (/[0-9]/.test(c0) || (c0 === "." && /[0-9]/.test(src[i + 1] || ""))) {
        var dbl = false;
        if (c0 === "0" && (src[i + 1] === "x" || src[i + 1] === "X")) {
          i += 2; while (i < n && /[0-9a-fA-F_]/.test(src[i])) i++;
        } else {
          while (i < n && /[0-9_]/.test(src[i])) i++;
          if (src[i] === "." && /[0-9]/.test(src[i + 1] || "")) { dbl = true; i++; while (i < n && /[0-9_]/.test(src[i])) i++; }
          if ((src[i] === "e" || src[i] === "E") && /[0-9+-]/.test(src[i + 1] || "")) { dbl = true; i++; if (src[i] === "+" || src[i] === "-") i++; while (i < n && /[0-9]/.test(src[i])) i++; }
        }
        toks.push({ t: "num", v: src.slice(p0, i).replace(/_/g, ""), dbl: dbl, p: p0, e: i, nl: nl }); nl = false; continue;
      }
      if (c0 === "'" || c0 === '"') { toks.push(lerString(false, p0)); nl = false; continue; }
      var op = null;
      for (var k = 0; k < OPS.length; k++) if (src.startsWith(OPS[k], i)) { op = OPS[k]; break; }
      if (!op) err("The string '" + c0 + "' isn't a valid token.", i, 1);
      i += op.length;
      if (op === "{") prof++; else if (op === "}") prof--;
      toks.push({ t: "op", v: op, p: p0, e: i, nl: nl }); nl = false;
    }
    return toks;

    function lerString(crua, p0) {
      var q = src[i], tripla = src.startsWith(q + q + q, i);
      var fecho = tripla ? q + q + q : q;
      i += fecho.length;
      if (tripla && src[i] === "\n") i++;
      else if (tripla && src[i] === "\r" && src[i + 1] === "\n") i += 2;
      var partes = [], buf = "";
      while (true) {
        if (i >= n || (!tripla && src[i] === "\n")) { var fl = src.indexOf("\n", p0); err("String starting with " + fecho + " must end with " + fecho + ".", p0, Math.max(1, (fl < 0 ? n : fl) - p0)); }
        if (src.startsWith(fecho, i)) { i += fecho.length; break; }
        var ch = src[i];
        if (ch === "\\" && !crua) {
          var d = src[i + 1]; i += 2;
          if (d === "n") buf += "\n"; else if (d === "t") buf += "\t"; else if (d === "r") buf += "\r";
          else if (d === "b") buf += "\b"; else if (d === "f") buf += "\f"; else if (d === "v") buf += "\v";
          else if (d === "x") { buf += String.fromCharCode(parseInt(src.substr(i, 2), 16)); i += 2; }
          else if (d === "u") {
            if (src[i] === "{") { var f = src.indexOf("}", i); buf += String.fromCodePoint(parseInt(src.slice(i + 1, f), 16)); i = f + 1; }
            else { buf += String.fromCharCode(parseInt(src.substr(i, 4), 16)); i += 4; }
          } else if (d === "\n") { /* continua */ }
          else buf += d;
          continue;
        }
        if (ch === "$" && !crua) {
          if (src[i + 1] === "{") {
            // acha o } correspondente (com strings dentro)
            var ini = i + 2, prof = 1, j = ini;
            var sub = [];
            // usa o lexer recursivo para achar o fim
            var resto = lexer(src, ini, true);
            partes.push(buf); buf = "";
            partes.push({ toks: resto.toks, p: ini });
            i = resto.fim + 1;
            continue;
          }
          if (/[A-Za-z_]/.test(src[i + 1] || "")) {
            var a = i + 1, b = a; while (b < n && /[A-Za-z0-9_]/.test(src[b])) b++;
            partes.push(buf); buf = "";
            partes.push({ toks: [{ t: "id", v: src.slice(a, b), p: a, e: b }, { t: "eof", v: "", p: b, e: b }], p: a });
            i = b; continue;
          }
        }
        buf += ch; i++;
      }
      partes.push(buf);
      return { t: "str", partes: partes, p: p0, e: i, nl: nl };
    }
  }

  /* ===================================================================
     2. Parser
     =================================================================== */
  var TPARAMS_VISTOS = new Set();
  var CONT_CORINGA = 0;
  var CONST_SDK = new Set(["Duration", "Object", "MapEntry", "Symbol", "JsonEncoder", "JsonEncoder.withIndent", "JsonDecoder", "Exception", "Error", "StateError", "FormatException", "ArgumentError", "UnsupportedError", "UnimplementedError", "Deprecated", "LineSplitter", "Point", "RangeError", "Utf8Codec", "Utf8Encoder", "Utf8Decoder", "Base64Codec"]);
  var ERROS_LEX = [];
  var MODIFICADORES_CLASSE = new Set(["abstract", "base", "final", "interface", "sealed", "mixin"]);

  function Parser(toks, src) { this.t = toks; this.i = 0; this.src = src; }
  var P = Parser.prototype;
  P.peek = function (k) { return this.t[Math.min(this.i + (k || 0), this.t.length - 1)]; };
  P.next = function () { var t = this.t[this.i]; if (this.i < this.t.length - 1) this.i++; return t; };
  P.prev = function () { return this.t[this.i - 1] || this.t[0]; };
  P.is = function (v, k) { var t = this.peek(k); return (t.t === "op" || t.t === "id") && t.v === v; };
  P.isOp = function (v, k) { var t = this.peek(k); return t.t === "op" && t.v === v; };
  P.isId = function (k) { var t = this.peek(k); return t.t === "id"; };
  P.accept = function (v) { if (this.is(v)) return this.next(); return null; };
  P.desc = function (t) { return t.t === "eof" ? "" : t.t === "str" ? this.src.slice(t.p, t.e) : t.v; };
  P.fail = function (msg, t) {
    t = t || this.peek();
    var extra = null, m = /^Expected an identifier, but got '(.*)'\.$/.exec(msg);
    if (m) extra = "Try inserting an identifier before '" + m[1] + "'.";
    throw new ErroDart(msg, t.p, Math.max(1, t.e - t.p), extra);
  };
  P.expect = function (v) {
    if (this.is(v)) return this.next();
    var t = this.peek();
    if (v === ";" || v === ")" || v === "]" || v === "}" ) {
      if (v === ";" || (t.t !== "eof" && !this.isOp(")") && !this.isOp("}") && !this.isOp("]") && false)) {
        var pv = this.prev();
        throw new ErroDart("Expected '" + v + "' after this.", pv.p, Math.max(1, pv.e - pv.p));
      }
    }
    if (t.t === "eof") { var pv2 = this.prev(); throw new ErroDart("Expected '" + v + "' after this.", pv2.p, Math.max(1, pv2.e - pv2.p)); }
    if (v === "(" || v === "{" || v === "=>" ) this.fail("Expected '" + v + "' before this.", t);
    this.fail("Expected '" + v + "' before this.", t);
  };
  P.ident = function () {
    var t = this.peek();
    if (t.t === "id" && !PALAVRAS_RESERVADAS.has(t.v)) return this.next();
    if (t.t === "eof") { var pv = this.prev(); throw new ErroDart("Expected an identifier, but got ''.", t.p, 0); }
    var d = this.desc(t);
    if (t.t === "id") throw new ErroDart("'" + d + "' can't be used as an identifier because it's a keyword.", t.p, t.e - t.p, "Try renaming this to be an identifier that isn't a keyword.");
    this.fail("Expected an identifier, but got '" + d + "'.", t);
  };
  P.no = function (k, ini, extra) { var o = extra || {}; o.k = k; o.p = ini.p; o.e = this.prev().e; return o; };

  /* ---- tipos ---- */
  // tenta ler um tipo; devolve null (e volta) se não for
  P.tryType = function () {
    var s = this.i;
    try { var t = this.parseType(); return t; } catch (e) { if (!(e instanceof ErroDart)) throw e; this.i = s; return null; }
  };
  P.parseType = function () {
    var ini = this.peek(), tipo;
    if (this.isOp("(")) { // record type
      this.next(); var campos = [], nomeados = [];
      while (!this.isOp(")")) {
        if (this.isOp("{")) {
          this.next();
          while (!this.isOp("}")) { var tt = this.parseType(); var nm = this.ident().v; nomeados.push({ nome: nm, tipo: tt }); if (!this.accept(",")) break; }
          this.expect("}"); break;
        }
        var tp = this.parseType(); if (this.isId() && !this.is("Function")) this.next();
        campos.push(tp);
        if (!this.accept(",")) break;
      }
      this.expect(")");
      tipo = { k: "TRec", pos: campos, nomeados: nomeados, nul: false };
    } else {
      var t = this.peek();
      if (t.t !== "id" || (PALAVRAS_RESERVADAS.has(t.v) && t.v !== "void")) this.fail("Expected a type, but got '" + this.desc(t) + "'.", t);
      this.next();
      var nome = t.v;
      var comPrefixo = false;
      if (this.isOp(".") && this.isId(1) && /^[A-Z]/.test(this.peek(1).v) && /^[a-z]/.test(nome)) { this.next(); t = this.next(); nome = t.v; comPrefixo = true; } // prefixo de import
      var args = [];
      if (this.isOp("<")) {
        this.next();
        do { args.push(this.parseType()); } while (this.accept(","));
        this.closeAngle();
      }
      tipo = { k: "T", nome: nome, args: args, nul: false, p: t.p, prefixo: comPrefixo };
    }
    if (this.isOp("?")) { var nx = this.peek(1); if (!(nx.t === "op" && (nx.v === "." || nx.v === "?" ))) { this.next(); tipo.nul = true; } }
    while (this.is("Function") && !this.isOp("(", 2) || (this.is("Function") && this.isOp("(", 1))) {
      if (!this.is("Function")) break;
      this.next();
      if (this.isOp("<")) { this.next(); do { this.ident(); if (this.accept("extends")) this.parseType(); } while (this.accept(",")); this.closeAngle(); }
      var ps = this.parseParams(true);
      tipo = { k: "TFun", ret: tipo, params: ps, nul: false };
      if (this.isOp("?")) { this.next(); tipo.nul = true; }
    }
    return tipo;
  };
  P.closeAngle = function () {
    var t = this.peek();
    if (t.t === "op" && t.v === ">") { this.next(); return; }
    if (t.t === "op" && (t.v === ">>" || t.v === ">>>" || t.v === ">=" || t.v === ">>=")) {
      // divide o token
      var resto = t.v.slice(1);
      this.t.splice(this.i, 1, { t: "op", v: ">", p: t.p, e: t.p + 1, nl: t.nl }, { t: "op", v: resto, p: t.p + 1, e: t.e });
      this.next(); return;
    }
    this.fail("Expected '>' after this.", this.prev());
  };

  /* ---- programa ---- */
  P.parseProgram = function () {
    var decls = [];
    while (this.peek().t !== "eof") {
      while (this.isOp("@")) this.skipAnnotation();
      if (this.is("import") || this.is("export") || this.is("library") || this.is("part")) {
        var ini = this.next(), uri = null, prefixo = null;
        if (ini.v === "part" && this.is("of")) { this.next(); }
        var show = null, hide = null;
        if (this.peek().t === "str") uri = String(this.parsePrimary().valor); else while (!this.isOp(";") && this.peek().t !== "eof") this.next();
        while (!this.isOp(";") && this.peek().t !== "eof") {
          if (this.accept("as")) prefixo = this.ident().v;
          else if (this.is("show") || this.is("hide")) { var qual = this.next().v, lista = []; do { lista.push(this.ident().v); } while (this.accept(",")); if (qual === "show") show = (show || []).concat(lista); else hide = (hide || []).concat(lista); }
          else this.next();
        }
        this.expect(";");
        decls.push(this.no("Import", ini, { uri: uri, prefixo: prefixo, tipo: ini.v, show: show, hide: hide }));
        continue;
      }
      decls.push(this.parseTopLevel());
    }
    return decls;
  };
  P.skipAnnotation = function () {
    this.next(); this.ident();
    while (this.accept(".")) this.ident();
    if (this.isOp("(")) this.parseArgs();
  };
  P.parseTopLevel = function () {
    var ini = this.peek();
    var mods = [];
    while (this.isId() && MODIFICADORES_CLASSE.has(this.peek().v) && (this.is("class", 1) || this.isId(1) && MODIFICADORES_CLASSE.has(this.peek(1).v) || (this.peek().v === "mixin" && this.isId(1)))) {
      if (this.peek().v === "mixin" && !this.is("class", 1)) break;
      if (this.peek().v === "final" && !this.is("class", 1) && !(this.isId(1) && MODIFICADORES_CLASSE.has(this.peek(1).v))) break;
      mods.push(this.next().v);
    }
    if (this.is("class")) return this.parseClass(ini, mods);
    if (this.is("mixin")) { this.next(); return this.parseClass(ini, ["mixin"], true); }
    if (this.is("enum")) return this.parseEnum(ini);
    if (this.is("extension")) return this.parseExtension(ini);
    if (this.is("typedef")) {
      this.next(); var nome = this.ident().v;
      if (this.isOp("<")) { this.next(); do { this.ident(); if (this.accept("extends")) this.parseType(); } while (this.accept(",")); this.closeAngle(); }
      this.expect("="); var tp = this.parseType(); this.expect(";");
      return this.no("Typedef", ini, { nome: nome, tipo: tp });
    }
    return this.parseMemberOrVar(ini, true, null);
  };
  P.parseTypeParams = function () {
    var r = [];
    if (this.isOp("<")) { this.next(); do { var n = this.ident().v; TPARAMS_VISTOS.add(n); var b = null; if (this.accept("extends")) b = this.parseType(); r.push({ nome: n, limite: b }); } while (this.accept(",")); this.closeAngle(); }
    return r;
  };
  P.parseClass = function (ini, mods, ehMixin) {
    if (!ehMixin) this.expect("class");
    var nomeT = this.ident(), nome = nomeT.v;
    var tparams = this.parseTypeParams();
    var primario = null;
    if (this.isOp("(") && !ehMixin) {
      var ps0 = this.parseParams();
      primario = ps0;
    }
    var sup = null, mixins = [], impls = [], on = [];
    if (this.accept("on")) { do { on.push(this.parseType()); } while (this.accept(",")); }
    if (this.accept("extends")) sup = this.parseType();
    if (this.accept("with")) { do { mixins.push(this.parseType()); } while (this.accept(",")); }
    if (this.accept("implements")) { do { impls.push(this.parseType()); } while (this.accept(",")); }
    var membros = primario && this.isOp(";") ? (this.next(), []) : this.parseClassBody(nome);
    if (primario) {
      var todosP = primario.pos.concat(primario.opc, primario.nomeados);
      todosP.forEach(function (p) { if (!p.campo && !p.superP) { membros.unshift({ k: "Field", tipo: p.tipo, vars: [{ nome: p.nome, p: p.p, init: null }], final: true, p: p.p }); p.campo = true; } });
      membros.push({ k: "Ctor", nome: "", classe: nome, params: primario, inits: [], superCall: null, redir: null, corpo: null, p: nomeT.p });
    }
    return this.no("Class", ini, { nome: nome, pNome: nomeT.p, mods: mods, mixin: !!ehMixin || mods.indexOf("mixin") >= 0, abstrata: mods.indexOf("abstract") >= 0 || mods.indexOf("sealed") >= 0 || mods.indexOf("interface") >= 0 && false, sealed: mods.indexOf("sealed") >= 0, tparams: tparams, sup: sup, mixins: mixins, impls: impls, on: on, membros: membros });
  };
  P.parseClassBody = function (nomeClasse) {
    this.expect("{");
    var membros = [];
    while (!this.isOp("}")) {
      if (this.peek().t === "eof") throw new ErroDart("Can't find '}' to match '{'.", this.t[0].p, 1);
      while (this.isOp("@")) this.skipAnnotation();
      membros.push(this.parseMemberOrVar(this.peek(), false, nomeClasse));
    }
    this.expect("}");
    return membros;
  };
  P.parseEnum = function (ini) {
    this.expect("enum");
    var nome = this.ident().v; this.parseTypeParams();
    var impls = [], mixins = [];
    if (this.accept("with")) { do { mixins.push(this.parseType()); } while (this.accept(",")); }
    if (this.accept("implements")) { do { impls.push(this.parseType()); } while (this.accept(",")); }
    this.expect("{");
    var valores = [];
    while (!this.isOp("}") && !this.isOp(";")) {
      while (this.isOp("@")) this.skipAnnotation();
      var vt = this.ident(), args = null, ctor = null;
      if (this.isOp("<")) { this.next(); do { this.parseType(); } while (this.accept(",")); this.closeAngle(); }
      if (this.accept(".")) ctor = this.ident().v;
      if (this.isOp("(")) args = this.parseArgs();
      valores.push({ nome: vt.v, args: args, ctor: ctor, p: vt.p });
      if (!this.accept(",")) break;
    }
    var membros = [];
    if (this.accept(";")) {
      while (!this.isOp("}")) { while (this.isOp("@")) this.skipAnnotation(); membros.push(this.parseMemberOrVar(this.peek(), false, nome)); }
    }
    this.expect("}");
    return this.no("Enum", ini, { nome: nome, valores: valores, membros: membros, impls: impls, mixins: mixins });
  };
  P.parseExtension = function (ini) {
    this.expect("extension");
    var nome = null;
    if (this.is("type")) { this.next(); }
    if (!this.is("on")) nome = this.ident().v;
    this.parseTypeParams();
    var rep = null;
    if (this.isOp("(")) { this.next(); rep = { tipo: this.parseType(), nome: this.ident().v }; this.expect(")"); }
    if (rep) { // extension type
      var impls = []; if (this.accept("implements")) { do { impls.push(this.parseType()); } while (this.accept(",")); }
      var mem = this.parseClassBody(nome);
      mem.push({ k: "Ctor", nome: "", classe: nome, params: { pos: [{ nome: rep.nome, campo: true, p: ini.p, tipo: rep.tipo }], opc: [], nomeados: [] }, inits: [], corpo: null, p: ini.p, sintetico: true });
      return this.no("ExtType", ini, { nome: nome, rep: rep, membros: mem });
    }
    this.expect("on");
    var tipo = this.parseType();
    var membros = this.parseClassBody(null);
    return this.no("Extension", ini, { nome: nome, tipo: tipo, membros: membros });
  };

  // membro de classe, função de topo ou variável de topo
  P.parseMemberOrVar = function (ini, topo, nomeClasse) {
    var m = { estatico: false, externo: false, abstrato: false, fabrica: false, constante: false, final: false, late: false, covariante: false };
    while (true) {
      if (this.is("static") && !topo) { this.next(); m.estatico = true; continue; }
      if (this.is("external")) { this.next(); m.externo = true; continue; }
      if (this.is("abstract") && !topo) { this.next(); continue; }
      if (this.is("covariant")) { this.next(); continue; }
      if (this.is("late")) { this.next(); m.late = true; continue; }
      if (this.is("factory") && !topo) { this.next(); m.fabrica = true; continue; }
      break;
    }
    // construtor?
    if (!topo && nomeClasse && this.is(nomeClasse) && (this.isOp("(", 1) || this.isOp(".", 1))) return this.parseCtor(ini, m, nomeClasse);
    if (!topo && nomeClasse && this.is("const") && this.is(nomeClasse, 1) && (this.isOp("(", 2) || this.isOp(".", 2))) { this.next(); m.constante = true; return this.parseCtor(ini, m, nomeClasse); }
    if (this.is("const")) { this.next(); m.constante = true; return this.parseVarDecl(ini, m, null, topo); }
    if (this.is("final")) { this.next(); m.final = true; var tp = null; if (!(this.isId() && (this.isOp("=", 1) || this.isOp(";", 1) || this.isOp(",", 1)))) tp = this.parseType(); return this.parseVarDecl(ini, m, tp, topo); }
    if (this.is("var")) { this.next(); return this.parseVarDecl(ini, m, null, topo); }
    // operador
    var tipo = null;
    if (!(this.is("operator") && !this.isOp("(", 1)) && !(this.isId() && (this.isOp("(", 1) || this.isOp("<", 1) && !this.looksLikeTypeThenName())) && !this.isGetSet()) {
      tipo = this.parseType();
    }
    if (this.is("operator")) {
      this.next(); var opt = this.next(); var op = opt.v;
      if (op === "[" ) { this.expect("]"); op = "[]"; if (this.isOp("=")) { this.next(); op = "[]="; } }
      if (op === "[]" && this.isOp("=")) { this.next(); op = "[]="; }
      if (op === "-" && this.isOp("(") && this.isOp(")", 1)) op = "unary-";
      var ps = this.parseParams();
      var corpo = this.parseFunctionBody(true);
      return this.no("Method", ini, { nome: op, operador: true, ret: tipo, params: ps, corpo: corpo.corpo, async: corpo.async, gerador: corpo.gerador, estatico: false, abstrato: !corpo.corpo });
    }
    if ((this.is("get") || this.is("set")) && this.isId(1) && !this.isOp("(", 1) && !this.isOp("=", 1) && !this.isOp(";", 1)) {
      var gs = this.next().v; var nmT = this.ident();
      var ps2 = gs === "set" ? this.parseParams() : { pos: [], opc: [], nomeados: [] };
      var cp = this.parseFunctionBody(true);
      return this.no(gs === "get" ? "Getter" : "Setter", ini, { nome: nmT.v, pNome: nmT.p, ret: tipo, params: ps2, corpo: cp.corpo, async: cp.async, gerador: cp.gerador, estatico: m.estatico, abstrato: !cp.corpo });
    }
    var nomeT = this.ident();
    if (this.isOp("(") || this.isOp("<")) {
      var tps = this.parseTypeParams();
      var ps3 = this.parseParams();
      var cp3 = this.parseFunctionBody(!topo || m.externo);
      return this.no(topo ? "Function" : "Method", ini, { nome: nomeT.v, pNome: nomeT.p, ret: tipo, tparams: tps, params: ps3, corpo: cp3.corpo, async: cp3.async, gerador: cp3.gerador, estatico: m.estatico, abstrato: !cp3.corpo });
    }
    this.i--; // volta para o nome
    return this.parseVarDecl(ini, m, tipo, topo);
  };
  P.objPattern = function () { var s = this.i; var ok = false; try { this.parseType(); ok = this.isOp("("); } catch (e) { if (!(e instanceof ErroDart)) throw e; } this.i = s; return ok; };
  // "c ? [1] : [2]" é condicional: procura o ":" depois do "]" correspondente
  P.ehCondicional = function () {
    var prof = 0;
    for (var k = this.i + 1; k < this.t.length; k++) {
      var t = this.t[k];
      if (t.t === "op" && (t.v === "[" || t.v === "(" || t.v === "{")) prof++;
      else if (t.t === "op" && (t.v === "]" || t.v === ")" || t.v === "}")) { prof--; if (prof === 0) { var nx = this.t[k + 1]; return !!nx && nx.t === "op" && nx.v === ":" && !this.ehArgNomeado(k + 1); } if (prof < 0) return false; }
      else if (t.t === "eof") return false;
    }
    return false;
  };
  P.ehArgNomeado = function () { return false; };
  P.isGetSet = function () {
    return (this.is("get") || this.is("set")) && this.isId(1) && !this.isOp("(", 1) && !this.isOp("=", 1) && !this.isOp(";", 1) && !this.isOp(",", 1);
  };
  P.looksLikeTypeThenName = function () {
    var s = this.i; var ok = false;
    try { this.parseType(); ok = this.isId() ; } catch (e) { if (!(e instanceof ErroDart)) throw e; }
    this.i = s; return ok;
  };
  P.parseVarDecl = function (ini, m, tipo, topo) {
    var vars = [];
    do {
      var nt = this.ident(), init = null;
      if (this.accept("=")) init = this.parseExpr();
      vars.push({ nome: nt.v, p: nt.p, e: nt.e, init: init });
    } while (this.accept(","));
    this.expect(";");
    return this.no(topo ? "TopVar" : "Field", ini, { tipo: tipo, vars: vars, final: m.final, constante: m.constante, late: m.late, estatico: m.estatico });
  };
  P.parseCtor = function (ini, m, nomeClasse) {
    var tNome = this.next(); var nome = "";
    if (this.accept(".")) nome = this.ident().v;
    var ps = this.parseParams();
    var inits = [], redir = null, superCall = null;
    if (this.accept(":")) {
      do {
        var it = this.peek();
        if (this.is("super")) {
          this.next(); var sn = ""; if (this.accept(".")) sn = this.ident().v;
          superCall = { nome: sn, args: this.parseArgs(), p: it.p };
        } else if (this.is("this") && (this.isOp("(", 1) || this.isOp(".", 1) && this.isOp("(", 3))) {
          this.next(); var rn = ""; if (this.accept(".")) rn = this.ident().v;
          redir = { nome: rn, args: this.parseArgs() };
        } else if (this.is("assert")) {
          this.next(); this.expect("("); var cond = this.parseExpr(); var msg = null; if (this.accept(",")) { if (!this.isOp(")")) msg = this.parseExpr(); } this.expect(")");
          inits.push({ assert: cond, msg: msg, p: it.p });
        } else {
          if (this.is("this")) { this.next(); this.expect("."); }
          var f = this.ident(); this.expect("=");
          inits.push({ campo: f.v, valor: this.parseExprNoCascade ? this.parseExpr() : this.parseExpr(), p: f.p });
        }
      } while (this.accept(","));
    }
    var corpo = null;
    if (m.fabrica && this.isOp("=")) { // factory redirecionando
      this.next(); var tp = this.parseType(); var rn2 = ""; if (this.accept(".")) rn2 = this.ident().v; this.expect(";");
      redir = { classe: tp.nome, nome: rn2 };
    } else {
      var cp = this.parseFunctionBody(true);
      corpo = cp.corpo;
    }
    return this.no("Ctor", ini, { pNomeCtor: tNome.p, nome: nome, classe: nomeClasse, params: ps, inits: inits, superCall: superCall, redir: redir, corpo: corpo, fabrica: m.fabrica, constante: m.constante });
  };
  // ( a, int b, [int c = 1] ) ou ( a, {required int b, int c = 2} )
  P.parseParams = function (soTipos) {
    var r = { pos: [], opc: [], nomeados: [] };
    this.expect("(");
    var modo = "pos";
    while (!this.isOp(")")) {
      if (this.isOp("[")) { this.next(); modo = "opc"; continue; }
      if (this.isOp("{")) { this.next(); modo = "nomeados"; continue; }
      if (this.isOp("]") || this.isOp("}")) { this.next(); continue; }
      while (this.isOp("@")) this.skipAnnotation();
      var p = { obrig: false, tipo: null, campo: false, superP: false, padrao: null };
      if (this.is("required")) { this.next(); p.obrig = true; }
      if (this.is("covariant")) this.next();
      if (this.is("final")) this.next(); else if (this.is("var")) this.next();
      if ((this.is("this") || this.is("super")) && this.isOp(".", 1)) {
        p.campo = this.next().v === "this"; p.superP = !p.campo; this.next();
        var nt = this.ident(); p.nome = nt.v; p.p = nt.p;
        if (this.isOp("(")) { this.parseParams(true); }
      } else {
        // tipo opcional
        var s = this.i;
        var tp = null;
        if (!(this.isId() && (this.isOp(",", 1) || this.isOp(")", 1) || this.isOp("=", 1) || this.isOp("]", 1) || this.isOp("}", 1) || this.isOp(":", 1)))) {
          tp = this.parseType();
        }
        if (soTipos && (this.isOp(",") || this.isOp(")") || this.isOp("]") || this.isOp("}"))) { p.tipo = tp; p.nome = "$p" + (r.pos.length + r.opc.length + r.nomeados.length); p.p = this.peek().p; }
        else {
          var nt2 = this.ident(); p.nome = nt2.v === "_" ? "$_" + (++CONT_CORINGA) : nt2.v; p.p = nt2.p; p.tipo = tp;
          if (this.isOp("(")) { var fps = this.parseParams(true); p.tipo = { k: "TFun", ret: tp, params: fps, nul: false }; if (this.accept("?")) p.tipo.nul = true; }
        }
      }
      if (this.accept("=") || (modo === "nomeados" && this.accept(":"))) p.padrao = this.parseExpr();
      r[modo].push(p);
      if (!this.accept(",")) {
        if (this.isOp("]") || this.isOp("}")) { this.next(); }
        break;
      }
    }
    this.expect(")");
    return r;
  };
  P.parseFunctionBody = function (podeVazio, lambda) {
    var async = false, gerador = false;
    if (this.is("async")) { this.next(); async = true; if (this.accept("*")) gerador = true; }
    else if (this.is("sync") && this.isOp("*", 1)) { this.next(); this.next(); gerador = true; }
    if (this.isOp("=>")) {
      var ini = this.next(); var e = this.parseExpr(); if (!lambda) this.expect(";");
      return { corpo: { k: "Block", corpo: [{ k: "Return", valor: e, p: ini.p, e: e.e, seta: true }], p: ini.p, e: e.e }, async: async, gerador: gerador };
    }
    if (this.isOp("{")) return { corpo: this.parseBlock(), async: async, gerador: gerador };
    if (podeVazio && this.isOp(";")) { this.next(); return { corpo: null }; }
    if (this.peek().t === "eof") { var pv = this.prev(); throw new ErroDart("Expected a function body, but got ''.", this.peek().p, 0); }
    this.fail("Expected a function body, but got '" + this.desc(this.peek()) + "'.");
  };

  /* ---- comandos ---- */
  P.parseBlock = function () {
    var ini = this.expect("{"), corpo = [];
    while (!this.isOp("}")) {
      if (this.peek().t === "eof") throw new ErroDart("Can't find '}' to match '{'.", ini.p, 1);
      corpo.push(this.parseStmt());
    }
    this.next();
    return this.no("Block", ini, { corpo: corpo });
  };
  P.parseStmt = function () {
    var ini = this.peek();
    if (ini.t === "op" && ini.v === "{") return this.parseBlock();
    if (ini.t === "op" && ini.v === ";") { this.next(); return this.no("Empty", ini); }
    if (ini.t === "id") {
      // rótulo
      if (this.isOp(":", 1) && !PALAVRAS_RESERVADAS.has(ini.v)) { this.next(); this.next(); var st = this.parseStmt(); return this.no("Label", ini, { nome: ini.v, corpo: st }); }
      switch (ini.v) {
        case "if": return this.parseIf();
        case "while": { this.next(); this.expect("("); var c = this.parseExpr(); this.expect(")"); var b = this.parseStmt(); return this.no("While", ini, { cond: c, corpo: b }); }
        case "do": { this.next(); var b2 = this.parseStmt(); this.expect("while"); this.expect("("); var c2 = this.parseExpr(); this.expect(")"); this.expect(";"); return this.no("DoWhile", ini, { cond: c2, corpo: b2 }); }
        case "for": return this.parseFor(false);
        case "await": if (this.is("for", 1)) { this.next(); return this.parseFor(true); } break;
        case "return": { this.next(); var v = null; if (!this.isOp(";")) v = this.parseExpr(); this.expect(";"); return this.no("Return", ini, { valor: v }); }
        case "break": { this.next(); var l = null; if (this.isId() && !this.isOp(";")) l = this.next().v; this.expect(";"); return this.no("Break", ini, { rotulo: l }); }
        case "continue": { this.next(); var l2 = null; if (this.isId()) l2 = this.next().v; this.expect(";"); return this.no("Continue", ini, { rotulo: l2 }); }
        case "throw": { var ex = this.parseExpr(); this.expect(";"); return this.no("ExprStmt", ini, { expr: ex }); }
        case "rethrow": { this.next(); this.expect(";"); return this.no("Rethrow", ini); }
        case "try": return this.parseTry();
        case "switch": return this.parseSwitch(false);
        case "assert": { this.next(); this.expect("("); var ac = this.parseExpr(); var am = null; if (this.accept(",")) { if (!this.isOp(")")) am = this.parseExpr(); } this.expect(")"); this.expect(";"); return this.no("Assert", ini, { cond: ac, msg: am }); }
        case "yield": {
          this.next(); var estrela = !!this.accept("*"); var yv = this.parseExpr(); this.expect(";");
          return this.no("Yield", ini, { valor: yv, estrela: estrela });
        }
        case "var": case "final": case "const": case "late": return this.parseLocalVar();
      }
      // declaração local com tipo, função local
      var s = this.i;
      if ((!PALAVRAS_RESERVADAS.has(ini.v) || ini.v === "void") && ini.v !== "await" && ini.v !== "yield") {
        var tp = this.tryType();
        if (tp && this.isId() && !PALAVRAS_RESERVADAS.has(this.peek().v)) {
          if (this.isOp("(", 1) || this.isOp("<", 1)) {
            // função local com tipo de retorno
            var nt = this.next();
            var tps = this.parseTypeParams();
            var ps = this.parseParams(); var cp = this.parseFunctionBody(false);
            return this.no("LocalFun", ini, { nome: nt.v, pNome: nt.p, ret: tp, params: ps, corpo: cp.corpo, async: cp.async, gerador: cp.gerador });
          }
          if (this.isOp("=", 1) || this.isOp(";", 1) || this.isOp(",", 1) || this.is("in", 1)) {
            this.i = s; return this.parseLocalVar();
          }
          // "Tipo nome" seguido de outra coisa: falta ;
          if (this.peek(1).nl) { this.i = s; return this.parseLocalVar(); }
        }
        this.i = s;
        // função local sem tipo: nome(...) { ... }
        if (ini.t === "id" && !PALAVRAS_RESERVADAS.has(ini.v) && this.isOp("(", 1)) {
          var s2 = this.i;
          try {
            this.next(); var ps2 = this.parseParams();
            if (this.isOp("{") || this.isOp("=>") || this.is("async")) {
              var ehFun = true;
              var cp2 = this.parseFunctionBody(false);
              return this.no("LocalFun", ini, { nome: ini.v, pNome: ini.p, ret: null, params: ps2, corpo: cp2.corpo, async: cp2.async, gerador: cp2.gerador });
            }
          } catch (e) { if (!(e instanceof ErroDart) || ehFun) throw e; }
          this.i = s2;
        }
      }
    }
    var ex2 = this.parseExpr();
    this.expect(";");
    return this.no("ExprStmt", ini, { expr: ex2 });
  };
  P.parseLocalVar = function (semPontoVirgula) {
    var ini = this.peek(), final = false, constante = false, late = false, tipo = null;
    if (this.accept("late")) late = true;
    if (this.accept("final")) final = true;
    else if (this.accept("const")) { constante = true; final = true; }
    else if (this.accept("var")) { }
    // padrão de desestruturação: var (a, b) = …;  final [x, y] = …;  var Pessoa(:nome) = …
    if ((this.isOp("(") || this.isOp("[") || this.isOp("{")) || (this.isId() && /^[A-Z]/.test(this.peek().v) && this.isOp("(", 1) && (ini.v === "var" || ini.v === "final"))) {
      var pat = this.parsePattern(true);
      this.expect("=");
      var valor = this.parseExpr();
      if (!semPontoVirgula) this.expect(";");
      return this.no("PatVar", ini, { padrao: pat, valor: valor, final: final });
    }
    if (!(this.isId() && (this.isOp("=", 1) || this.isOp(";", 1) || this.isOp(",", 1) || this.is("in", 1) || this.isOp(":", 1)))) tipo = this.parseType();
    var vars = [];
    do {
      var nt = this.ident(), init = null;
      if (this.accept("=")) init = this.parseExpr();
      vars.push({ nome: nt.v, p: nt.p, e: nt.e, init: init });
    } while (!semPontoVirgula && this.accept(","));
    if (!semPontoVirgula) this.expect(";");
    return this.no("VarDecl", ini, { tipo: tipo, vars: vars, final: final, constante: constante, late: late });
  };
  P.parseIf = function () {
    var ini = this.next(); this.expect("(");
    var c = this.parseExpr(), caso = null;
    if (this.is("case")) { this.next(); caso = this.parsePattern(); if (this.is("when")) { this.next(); caso = { k: "PGuard", p: caso, guarda: this.parseExpr() }; } }
    this.expect(")");
    var entao = this.parseStmt(), senao = null;
    if (this.accept("else")) senao = this.parseStmt();
    return this.no("If", ini, { cond: c, caso: caso, entao: entao, senao: senao });
  };
  P.parseFor = function (aw) {
    var ini = this.next(); this.expect("(");
    var init = null;
    // for-in
    var s = this.i;
    if (this.is("var") || this.is("final") || this.isId()) {
      try {
        var final = false, tipo = null, pat = null;
        if (this.accept("final")) final = true; else this.accept("var");
        if (this.isOp("(") || this.isOp("[") || (this.isId() && /^[A-Z]/.test(this.peek().v) && (this.isOp("(", 1) || this.isOp("<", 1) && this.objPattern()))) pat = this.parsePattern(true);
        else {
          if (!(this.isId() && this.is("in", 1))) tipo = this.parseType();
          var nt = this.ident();
        }
        if (this.is("in")) {
          var achouIn = true;
          this.next(); var it = this.parseExpr(); this.expect(")");
          var corpo = this.parseStmt();
          return this.no("ForIn", ini, { nome: nt ? nt.v : null, padrao: pat, tipo: tipo, iter: it, corpo: corpo, await: aw, final: final, p0: nt ? nt.p : 0 });
        }
      } catch (e) { if (!(e instanceof ErroDart) || achouIn) throw e; }
      this.i = s;
    }
    if (!this.isOp(";")) {
      var t = this.peek();
      if (this.is("var") || this.is("final") || (this.isId() && this.looksLikeTypeThenName())) init = this.parseLocalVar(true);
      else { var ex = this.parseExpr(); init = { k: "ExprStmt", expr: ex, p: ex.p }; var mais = []; while (this.accept(",")) mais.push(this.parseExpr()); if (mais.length) init.mais = mais; }
      // var i = 0, j = 1
      while (init.k === "VarDecl" && this.accept(",")) { var nt3 = this.ident(), in3 = null; if (this.accept("=")) in3 = this.parseExpr(); init.vars.push({ nome: nt3.v, p: nt3.p, init: in3 }); }
    }
    this.expect(";");
    var cond = this.isOp(";") ? null : this.parseExpr();
    this.expect(";");
    var upd = [];
    while (!this.isOp(")")) { upd.push(this.parseExpr()); if (!this.accept(",")) break; }
    this.expect(")");
    var corpo2 = this.parseStmt();
    return this.no("For", ini, { init: init, cond: cond, upd: upd, corpo: corpo2 });
  };
  P.parseTry = function () {
    var ini = this.next();
    var corpo = this.parseBlock(), catches = [], fin = null;
    while (this.is("on") || this.is("catch")) {
      var c = { tipo: null, e: null, st: null, p: this.peek().p };
      if (this.accept("on")) c.tipo = this.parseType();
      if (this.accept("catch")) { this.expect("("); c.e = this.ident().v; if (this.accept(",")) c.st = this.ident().v; this.expect(")"); }
      c.corpo = this.parseBlock();
      catches.push(c);
    }
    if (this.accept("finally")) fin = this.parseBlock();
    if (!catches.length && !fin) this.fail("A try block must be followed by an 'on', 'catch', or 'finally' clause.", ini);
    return this.no("Try", ini, { corpo: corpo, catches: catches, fin: fin });
  };
  P.parseSwitch = function (ehExpr) {
    var ini = this.next(); this.expect("(");
    var alvo = this.parseExpr(); this.expect(")"); this.expect("{");
    var casos = [];
    if (ehExpr) {
      while (!this.isOp("}")) {
        var ct = this.peek();
        var pat = this.parsePattern(), guarda = null;
        if (this.is("when")) { this.next(); guarda = this.parseExpr(); }
        this.expect("=>");
        var v = this.parseExpr();
        casos.push({ padrao: pat, guarda: guarda, valor: v, p: ct.p });
        if (!this.accept(",")) break;
      }
      this.expect("}");
      return this.no("SwitchExpr", ini, { alvo: alvo, casos: casos });
    }
    while (!this.isOp("}")) {
      var c = { pats: [], corpo: [], def: false, p: this.peek().p, rotulos: [] };
      while (this.is("case") || this.is("default") || (this.isId() && this.isOp(":", 1))) {
        if (this.isId() && this.isOp(":", 1) && !this.is("default")) { c.rotulos.push(this.next().v); this.next(); continue; }
        if (this.accept("default")) { c.def = true; this.expect(":"); continue; }
        this.next();
        var pt = this.parsePattern(), g = null;
        if (this.is("when")) { this.next(); g = this.parseExpr(); }
        c.pats.push({ padrao: pt, guarda: g });
        this.expect(":");
      }
      if (!c.pats.length && !c.def) this.fail("Expected 'case' or 'default'.", this.peek());
      while (!this.is("case") && !this.is("default") && !this.isOp("}")) {
        if (this.peek().t === "eof") throw new ErroDart("Can't find '}' to match '{'.", ini.p, 1);
        c.corpo.push(this.parseStmt());
      }
      casos.push(c);
    }
    this.expect("}");
    return this.no("Switch", ini, { alvo: alvo, casos: casos });
  };

  /* ---- padrões (patterns) ---- */
  P.parsePattern = function (decl) {
    var l = this.parsePatternAnd(decl);
    while (this.isOp("||")) { this.next(); var r = this.parsePatternAnd(decl); l = { k: "POr", a: l, b: r, p: l.p }; }
    return l;
  };
  P.parsePatternAnd = function (decl) {
    var l = this.parsePatternUnary(decl);
    while (this.isOp("&&")) { this.next(); var r = this.parsePatternUnary(decl); l = { k: "PAnd", a: l, b: r, p: l.p }; }
    return l;
  };
  P.parsePatternUnary = function (decl) {
    var t = this.peek();
    if (t.t === "op" && ["==", "!=", "<", ">", "<=", ">="].indexOf(t.v) >= 0) {
      this.next(); var v = this.parseExprBin(6);
      return { k: "PRel", op: t.v, valor: v, p: t.p };
    }
    var pp = this.parsePatternPrimary(decl);
    while (true) {
      if (this.isOp("?") && !this.isOp(".", 1)) { var nx = this.peek(1); if (nx.t === "op" && (nx.v === ":" ) ) break; this.next(); pp = { k: "PNullCheck", p: pp }; continue; }
      if (this.isOp("!")) { this.next(); pp = { k: "PNullAssert", p: pp }; continue; }
      if (this.is("as")) { this.next(); pp = { k: "PCast", p: pp, tipo: this.parseType() }; continue; }
      break;
    }
    return pp;
  };
  P.parsePatternPrimary = function (decl) {
    var t = this.peek();
    if (t.t === "op" && t.v === "(") {
      this.next();
      var campos = [];
      while (!this.isOp(")")) {
        var f = this.parsePatternField(decl);
        campos.push(f);
        if (!this.accept(",")) break;
      }
      this.expect(")");
      if (campos.length === 1 && campos[0].nome === null && !this.prev().v === ",") return campos[0].p;
      if (campos.length === 1 && campos[0].nome === null && this.t[this.i - 2].v !== ",") return campos[0].pat;
      return { k: "PRecord", campos: campos, p: t.p };
    }
    if (t.t === "op" && t.v === "[") {
      this.next(); var els = [];
      while (!this.isOp("]")) {
        if (this.isOp("...")) { this.next(); var rp = null; if (!this.isOp(",") && !this.isOp("]")) rp = this.parsePattern(decl); els.push({ k: "PRest", p: rp }); }
        else els.push(this.parsePattern(decl));
        if (!this.accept(",")) break;
      }
      this.expect("]");
      return { k: "PList", els: els, p: t.p };
    }
    if (t.t === "op" && t.v === "{") {
      this.next(); var ents = [];
      while (!this.isOp("}")) {
        if (this.isOp("...")) { this.next(); continue; }
        var ch = this.parseExprBin(6); this.expect(":"); var vp = this.parsePattern(decl);
        ents.push({ chave: ch, pat: vp });
        if (!this.accept(",")) break;
      }
      this.expect("}");
      return { k: "PMap", ents: ents, p: t.p };
    }
    if (t.t === "id" && (t.v === "var" || t.v === "final")) {
      this.next(); var nt = this.ident();
      if (nt.v === "_") return { k: "PWild", tipo: null, p: t.p };
      return { k: "PVar", nome: nt.v, tipo: null, p: nt.p };
    }
    if (t.t === "id" && t.v === "_" ) { this.next(); return { k: "PWild", tipo: null, p: t.p }; }
    // Tipo nome  |  Tipo(campos)  |  Tipo _  | constante
    if (t.t === "id" && !PALAVRAS_RESERVADAS.has(t.v) || (t.t === "id" && t.v === "void")) {
      var s = this.i;
      var tp = this.tryType();
      if (tp && tp.k === "T" && this.isOp("(") && /^[A-Z_]/.test(tp.nome)) {
        this.next(); var cs = [];
        while (!this.isOp(")")) { cs.push(this.parsePatternField(decl)); if (!this.accept(",")) break; }
        this.expect(")");
        return { k: "PObj", tipo: tp, campos: cs, p: t.p };
      }
      if (tp && this.isId() && !PALAVRAS_RESERVADAS.has(this.peek().v) && this.peek().v !== "when" && this.peek().v !== "as") {
        var nt2 = this.next();
        if (nt2.v === "_") return { k: "PWild", tipo: tp, p: t.p };
        return { k: "PVar", nome: nt2.v, tipo: tp, p: nt2.p };
      }
      if (tp && decl && tp.k === "T" && !tp.args.length) { return { k: "PVar", nome: tp.nome, tipo: null, p: t.p }; }
      // tipo sozinho como padrão (ex.: "case int:") quando é um tipo conhecido em maiúscula? fica como constante
      this.i = s;
      if (decl && t.t === "id") { this.next(); return { k: "PVar", nome: t.v, tipo: null, p: t.p }; }
    }
    // constante
    var e = this.parseExprBin(6);
    if (e.k === "Ident" && ["int", "double", "num", "String", "bool", "List", "Map", "Set", "Object", "Null"].indexOf(e.nome) >= 0) return { k: "PWild", tipo: { k: "T", nome: e.nome, args: [], nul: false }, p: e.p };
    return { k: "PConst", valor: e, p: e.p };
  };
  P.parsePatternField = function (decl) {
    var t = this.peek();
    if (this.isOp(":")) { // :nome  (abreviação)
      this.next(); var sub = this.parsePattern(decl);
      var nm = sub.k === "PVar" ? sub.nome : sub.p && sub.p.nome;
      return { nome: nm, pat: sub };
    }
    if (this.isId() && this.isOp(":", 1)) { var n = this.next().v; this.next(); return { nome: n, pat: this.parsePattern(decl) }; }
    return { nome: null, pat: this.parsePattern(decl) };
  };

  /* ---- expressões ---- */
  var BIN = [
    ["??"], ["||"], ["&&"], ["==", "!="], ["<", ">", "<=", ">=", "is", "as"], ["|"], ["^"], ["&"], ["<<", ">>", ">>>"], ["+", "-"], ["*", "/", "%", "~/"]
  ];
  P.parseExpr = function () {
    var ini = this.peek();
    if (this.is("throw")) { this.next(); var v = this.parseExpr(); return this.no("Throw", ini, { valor: v }); }
    var e = this.parseAssign();
    return e;
  };
  var ATRIB = ["=", "+=", "-=", "*=", "/=", "%=", "~/=", "??=", "&=", "|=", "^=", "<<=", ">>=", ">>>=", "&&=", "||="];
  P.parseAssign = function () {
    var ini = this.peek();
    var l = this.parseCond();
    var t = this.peek();
    if (t.t === "op" && ATRIB.indexOf(t.v) >= 0) {
      if (!(l.k === "Ident" || l.k === "Get" || l.k === "Index" || l.k === "NGet")) throw new ErroDart("Can't assign to this.", l.p, l.e - l.p);
      this.next(); var r = this.parseExpr();
      return this.no("Assign", ini, { op: t.v, alvo: l, valor: r, pOp: t.p });
    }
    // cascata
    if (this.isOp("..") || this.isOp("?..")) {
      var secs = [], nulo = this.isOp("?..");
      while (this.isOp("..") || this.isOp("?..")) {
        this.next();
        secs.push(this.parseCascadeSection());
      }
      return this.no("Cascade", ini, { alvo: l, secs: secs, nulo: nulo });
    }
    return l;
  };
  P.parseCascadeSection = function () {
    // começa com um nome ou [ ; usa um alvo especial
    var ini = this.peek();
    var e = { k: "CascadeAlvo", p: ini.p, e: ini.p };
    if (this.isOp("[")) { this.next(); var ix = this.parseExpr(); this.expect("]"); e = this.no("Index", ini, { alvo: e, indice: ix }); }
    else { var nt = this.ident(); e = this.no("Get", ini, { alvo: e, nome: nt.v, pNome: nt.p }); }
    e = this.parsePostfixOps(e, ini);
    var t = this.peek();
    if (t.t === "op" && ATRIB.indexOf(t.v) >= 0) { this.next(); var r = this.parseCond(); e = this.no("Assign", ini, { op: t.v, alvo: e, valor: r, pOp: t.p }); }
    return e;
  };
  P.parseCond = function () {
    var ini = this.peek();
    var c = this.parseExprBin(0);
    if (this.isOp("?")) {
      var tq = this.next(); var a = this.parseExprNoCascade(); this.expect(":"); var b = this.parseExprNoCascade();
      return this.no("Cond", ini, { cond: c, a: a, b: b, pQ: tq.p });
    }
    return c;
  };
  P.parseExprNoCascade = function () {
    var ini = this.peek();
    if (this.is("throw")) { this.next(); var v = this.parseExpr(); return this.no("Throw", ini, { valor: v }); }
    var l = this.parseCond();
    var t = this.peek();
    if (t.t === "op" && ATRIB.indexOf(t.v) >= 0) { this.next(); var r = this.parseExprNoCascade(); return this.no("Assign", ini, { op: t.v, alvo: l, valor: r, pOp: t.p }); }
    return l;
  };
  P.parseExprBin = function (nivel) {
    if (nivel >= BIN.length) return this.parseUnary();
    var ini = this.peek();
    var l = this.parseExprBin(nivel + 1);
    while (true) {
      var t = this.peek();
      if (!((t.t === "op" || t.t === "id") && BIN[nivel].indexOf(t.v) >= 0)) break;
      if (t.t === "id" && t.v !== "is" && t.v !== "as") break;
      this.next();
      if (t.v === "is") {
        var neg = !!this.accept("!");
        var tp = this.parseType();
        l = this.no("Is", ini, { valor: l, tipo: tp, neg: neg, pOp: t.p });
        continue;
      }
      if (t.v === "as") { var tp2 = this.parseType(); l = this.no("As", ini, { valor: l, tipo: tp2, pOp: t.p }); continue; }
      var r = this.parseExprBin(nivel + 1);
      l = this.no("Bin", ini, { op: t.v, a: l, b: r, pOp: t.p, eOp: t.e });
      if (nivel === 3 || nivel === 4) { var t2 = this.peek(); if (t2.t === "op" && BIN[nivel].indexOf(t2.v) >= 0 && nivel === 4 && t2.v !== "is" && t2.v !== "as") break; }
    }
    return l;
  };
  P.parseUnary = function () {
    var t = this.peek();
    if (t.t === "op" && (t.v === "-" || t.v === "!" || t.v === "~")) {
      this.next(); var v = this.parseUnary();
      if (t.v === "-" && v.k === "Num") { v.neg = !v.neg; v.p = t.p; return v; }
      return this.no("Unary", t, { op: t.v, valor: v });
    }
    if (t.t === "op" && (t.v === "++" || t.v === "--")) { this.next(); var v2 = this.parseUnary(); return this.no("PreInc", t, { op: t.v, alvo: v2 }); }
    if (t.t === "id" && t.v === "await") { this.next(); var v3 = this.parseUnary(); return this.no("Await", t, { valor: v3 }); }
    return this.parsePostfix();
  };
  P.parsePostfix = function () {
    var ini = this.peek();
    var e = this.parsePrimary();
    return this.parsePostfixOps(e, ini);
  };
  P.parsePostfixOps = function (e, ini) {
    while (true) {
      var t = this.peek();
      if (t.t !== "op") break;
      if (t.v === ".") {
        this.next(); var nt = this.peek();
        if (nt.t === "num" && /^\d+$/.test(nt.v)) { this.next(); e = this.no("Get", ini, { alvo: e, nome: "$" + nt.v, pNome: nt.p }); continue; }
        if (nt.t === "id" && nt.v === "new" ) { this.next(); e = this.no("Get", ini, { alvo: e, nome: "new", pNome: nt.p }); continue; }
        var n1 = this.ident();
        e = this.no("Get", ini, { alvo: e, nome: n1.v, pNome: n1.p, eNome: n1.e });
        continue;
      }
      if (t.v === "?.") {
        this.next();
        if (this.isOp("[")) { this.next(); var ix0 = this.parseExpr(); this.expect("]"); e = this.no("Index", ini, { alvo: e, indice: ix0, nulo: true }); continue; }
        var n2 = this.ident(); e = this.no("Get", ini, { alvo: e, nome: n2.v, pNome: n2.p, eNome: n2.e, nulo: true }); continue;
      }
      if (t.v === "?" && this.isOp("[", 1) && this.peek(1).p === t.e && !this.ehCondicional()) { this.next(); this.next(); var ixn = this.parseExpr(); this.expect("]"); e = this.no("Index", ini, { alvo: e, indice: ixn, nulo: true, pIdx: t.p }); continue; }
      if (t.v === "!") { var nx = this.peek(1); if (nx.t === "op" && nx.v === "=" ) break; this.next(); e = this.no("NotNull", ini, { valor: e, pOp: t.p }); continue; }
      if (t.v === "[") { this.next(); var ix = this.parseExpr(); this.expect("]"); e = this.no("Index", ini, { alvo: e, indice: ix, pIdx: t.p }); continue; }
      if (t.v === "(") { var a = this.parseArgs(); e = this.no("Call", ini, { alvo: e, args: a, targs: null }); continue; }
      if (t.v === "<" && (e.k === "Ident" || e.k === "Get")) {
        // chamada genérica f<int>(…)
        var s = this.i;
        try {
          this.next(); var targs = []; do { targs.push(this.parseType()); } while (this.accept(",")); this.closeAngle();
          if (this.isOp("(")) { var a2 = this.parseArgs(); e = this.no("Call", ini, { alvo: e, args: a2, targs: targs }); continue; }
          if (this.isOp(".") ) { e = this.no("TypeLit", ini, { tipo: { k: "T", nome: e.nome, args: targs } }); continue; }
        } catch (er) { if (!(er instanceof ErroDart)) throw er; }
        this.i = s; break;
      }
      if (t.v === "++" || t.v === "--") { if (t.nl) break; this.next(); e = this.no("PostInc", ini, { op: t.v, alvo: e }); continue; }
      break;
    }
    return e;
  };
  P.parseArgs = function () {
    var ini = this.expect("("), pos = [], nom = [];
    while (!this.isOp(")")) {
      if (this.isId() && this.isOp(":", 1)) { var n = this.next(); this.next(); nom.push({ nome: n.v, valor: this.parseExpr(), p: n.p }); }
      else pos.push(this.parseExpr());
      if (!this.accept(",")) {
        if (!this.isOp(")")) {
          var t = this.peek();
          if (t.t === "eof" || t.v === ";" || t.v === "}") { var pv = this.prev(); throw new ErroDart("Expected ')' before this.", t.p, Math.max(1, t.e - t.p)); }
          this.fail("Expected ',' before this.", t);
        }
        break;
      }
    }
    this.expect(")");
    return { pos: pos, nom: nom, p: ini.p };
  };
  P.parsePrimary = function () {
    var t = this.peek();
    if (t.t === "num") {
      this.next();
      return this.no("Num", t, { v: t.v, dbl: t.dbl });
    }
    if (t.t === "str") {
      var partes = [];
      while (this.peek().t === "str") { var st = this.next(); st.partes.forEach(function (x) { partes.push(x); }); }
      var self = this;
      var ps = partes.map(function (x) {
        if (typeof x === "string") return x;
        var sub = new Parser(x.toks, self.src);
        var ex = sub.parseExpr();
        if (sub.peek().t !== "eof") sub.fail("Expected '}' before this.");
        return ex;
      });
      var simples = ps.every(function (x) { return typeof x === "string"; });
      return this.no("Str", t, { partes: ps, valor: simples ? ps.join("") : null });
    }
    if (t.t === "op") {
      if (t.v === "(") {
        // lambda?
        if (this.isLambda()) return this.parseLambda();
        this.next();
        if (this.isOp(")")) { this.next(); return this.no("Record", t, { pos: [], nom: [] }); }
        // record ou parênteses
        var first = null, pos = [], nom = [], virgula = false;
        while (!this.isOp(")")) {
          if (this.isId() && this.isOp(":", 1)) { var n = this.next(); this.next(); nom.push({ nome: n.v, valor: this.parseExpr() }); }
          else pos.push(this.parseExpr());
          if (this.accept(",")) virgula = true; else break;
        }
        this.expect(")");
        if (pos.length === 1 && !nom.length && !virgula) return this.no("Paren", t, { valor: pos[0] });
        return this.no("Record", t, { pos: pos, nom: nom });
      }
      if (t.v === "[") return this.parseListLit(null, false, t);
      if (t.v === "{") return this.parseSetMapLit(null, false, t);
      if (t.v === "<") {
        this.next(); var targs = []; do { targs.push(this.parseType()); } while (this.accept(",")); this.closeAngle();
        if (this.isOp("[")) return this.parseListLit(targs, false, t);
        return this.parseSetMapLit(targs, false, t);
      }
      if (t.v === "." && this.isId(1)) { this.next(); var nm0 = this.next(); return this.no("Atalho", t, { nome: nm0.v }); }
      if (t.v === "#") { this.next(); var sy = this.ident().v; while (this.accept(".")) sy += "." + this.ident().v; return this.no("Symbol", t, { nome: sy }); }
    }
    if (t.t === "id") {
      switch (t.v) {
        case "true": case "false": this.next(); return this.no("Bool", t, { v: t.v === "true" });
        case "null": this.next(); return this.no("Null", t);
        case "this": this.next(); return this.no("This", t);
        case "super": this.next(); return this.no("Super", t);
        case "new": { this.next(); return this.parseNew(t, false); }
        case "const": {
          this.next();
          if (this.isOp("[")) return this.parseListLit(null, true, t);
          if (this.isOp("{")) return this.parseSetMapLit(null, true, t);
          if (this.isOp("<")) { this.next(); var ta = []; do { ta.push(this.parseType()); } while (this.accept(",")); this.closeAngle(); if (this.isOp("[")) return this.parseListLit(ta, true, t); return this.parseSetMapLit(ta, true, t); }
          if (this.isOp("(")) { var r = this.parsePrimary(); r.constante = true; return r; }
          return this.parseNew(t, true);
        }
        case "switch": return this.parseSwitch(true);
        case "void": break;
      }
      if (PALAVRAS_RESERVADAS.has(t.v) && t.v !== "void") {
        if (t.v === "return") throw new ErroDart("Unexpected token 'return'.", t.p, t.e - t.p);
        this.fail("Expected an identifier, but got '" + t.v + "'.", t);
      }
      // lambda sem parâmetros tipados: x => …? não existe em Dart; só (x) =>
      this.next();
      return this.no("Ident", t, { nome: t.v });
    }
    if (t.t === "eof") { throw new ErroDart("Expected an identifier, but got ''.", t.p, 0); }
    this.fail("Expected an identifier, but got '" + this.desc(t) + "'.", t);
  };
  P.parseNew = function (ini, constante) {
    var tp = this.parseType(); var nome = "";
    if (this.accept(".")) nome = this.ident().v;
    var a = this.parseArgs();
    return this.no("New", ini, { tipo: tp, ctor: nome, args: a, constante: constante });
  };
  P.isLambda = function () {
    // ( ... ) => ou ( ... ) {   ou ( ... ) async
    var prof = 0, k = this.i;
    for (; k < this.t.length; k++) {
      var t = this.t[k];
      if (t.t === "op" && (t.v === "(" )) prof++;
      else if (t.t === "op" && t.v === ")") { prof--; if (!prof) break; }
      else if (t.t === "eof") return false;
    }
    var nx = this.t[k + 1];
    if (!nx) return false;
    if (nx.t === "op" && (nx.v === "=>" || nx.v === "{")) return true;
    if (nx.t === "id" && (nx.v === "async" || nx.v === "sync")) return true;
    return false;
  };
  P.parseLambda = function () {
    var ini = this.peek();
    var ps = this.parseParams();
    var cp = this.parseFunctionBody(false, true);
    return this.no("Lambda", ini, { params: ps, corpo: cp.corpo, async: cp.async, gerador: cp.gerador });
  };
  P.parseCollectionEl = function () {
    var t = this.peek();
    if (this.isOp("...") || this.isOp("...?")) { this.next(); return { k: "Spread", valor: this.parseExpr(), nulo: t.v === "...?", p: t.p }; }
    if (this.isOp("?")) { this.next(); var vn = this.parseExpr(); if (this.isOp(":")) { this.next(); return { k: "Par", chave: vn, valor: this.parseExpr(), p: t.p, chaveNula: true }; } return { k: "NulEl", valor: vn, p: t.p }; }
    if (this.is("if")) {
      this.next(); this.expect("("); var c = this.parseExpr(), caso = null;
      if (this.is("case")) { this.next(); caso = this.parsePattern(); if (this.is("when")) { this.next(); caso = { k: "PGuard", p: caso, guarda: this.parseExpr() }; } }
      this.expect(")");
      var a = this.parseCollectionEl(), b = null;
      if (this.accept("else")) b = this.parseCollectionEl();
      return { k: "CIf", cond: c, caso: caso, a: a, b: b, p: t.p };
    }
    if (this.is("for")) {
      var f = this.parseForHeaderOnly();
      f.corpo = this.parseCollectionEl();
      return f;
    }
    var e = this.parseExpr();
    if (this.isOp(":")) { this.next(); var v = this.parseExpr(); return { k: "Par", chave: e, valor: v, p: e.p }; }
    return e;
  };
  P.parseForHeaderOnly = function () {
    var ini = this.next(); this.expect("(");
    var s = this.i;
    if (this.is("var") || this.is("final") || this.isId()) {
      try {
        var tipo = null, pat = null, nt = null;
        if (!this.accept("final")) this.accept("var");
        if (this.isOp("(") || this.isOp("[") || (this.isId() && /^[A-Z]/.test(this.peek().v) && this.isOp("(", 1))) pat = this.parsePattern(true);
        else { if (!(this.isId() && this.is("in", 1))) tipo = this.parseType(); nt = this.ident(); }
        if (this.accept("in")) { var it = this.parseExpr(); this.expect(")"); return { k: "CForIn", nome: nt ? nt.v : null, padrao: pat, iter: it, p: ini.p }; }
      } catch (e) { if (!(e instanceof ErroDart)) throw e; }
      this.i = s;
    }
    var init = null;
    if (!this.isOp(";")) { if (this.is("var") || this.is("final") || this.looksLikeTypeThenName()) init = this.parseLocalVar(true); else { var ex = this.parseExpr(); init = { k: "ExprStmt", expr: ex, p: ex.p }; } }
    this.expect(";"); var cond = this.isOp(";") ? null : this.parseExpr(); this.expect(";");
    var upd = []; while (!this.isOp(")")) { upd.push(this.parseExpr()); if (!this.accept(",")) break; }
    this.expect(")");
    return { k: "CFor", init: init, cond: cond, upd: upd, p: ini.p };
  };
  P.parseListLit = function (targs, constante, ini) {
    this.expect("["); var els = [];
    while (!this.isOp("]")) {
      if (this.peek().t === "eof") throw new ErroDart("Can't find ']' to match '['.", ini.p, 1);
      els.push(this.parseCollectionEl());
      if (!this.accept(",")) { if (!this.isOp("]")) { var t = this.peek(); if (t.t === "eof" || t.v === ";" || t.v === ")") throw new ErroDart("Expected ']' before this.", t.p, Math.max(1, t.e - t.p)); this.fail("Expected ',' before this.", t); } break; }
    }
    this.expect("]");
    return this.no("ListLit", ini, { els: els, targs: targs, constante: constante });
  };
  P.parseSetMapLit = function (targs, constante, ini) {
    this.expect("{"); var els = [];
    while (!this.isOp("}")) {
      els.push(this.parseCollectionEl());
      if (!this.accept(",")) break;
    }
    this.expect("}");
    var ehMapa = targs ? targs.length === 2 : (els.length === 0 ? true : temPar(els[0]) || els.some(temPar));
    return this.no(ehMapa ? "MapLit" : "SetLit", ini, { els: els, targs: targs, constante: constante });
    function temPar(el) { if (!el) return false; if (el.k === "Par") return true; if (el.k === "CIf") return temPar(el.a); if (el.k === "CFor" || el.k === "CForIn") return temPar(el.corpo); if (el.k === "Spread") return el.valor.k === "MapLit"; return false; }
  };

  /* ===================================================================
     3. Gerador de JavaScript
     =================================================================== */
  var JS_RESERVADAS = new Set("arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof undefined var void while with yield NaN Infinity Object Array String Number Boolean Map Set Symbol Promise Error Math JSON Date RegExp BigInt Function".split(" "));
  function jsNome(n) { return "v_" + n.replace(/\$/g, "$$$$"); }
  function mNome(n) { return "m_" + n; }
  function q(s) { return JSON.stringify(s); }

  var GLOBAIS = new Set(["print", "identical", "exit", "stdin", "stdout", "stderr", "sleep", "pi", "e", "sqrt", "pow", "max", "min", "sin", "cos", "tan", "atan", "atan2", "asin", "acos", "exp", "log", "ln10", "ln2", "log2e", "log10e", "sqrt2", "sqrt1_2", "Random", "Point",
    "int", "double", "num", "String", "bool", "List", "Map", "Set", "Object", "Iterable", "Future", "Stream", "Duration", "DateTime", "StringBuffer", "RegExp", "Exception", "Error", "StateError", "ArgumentError", "RangeError", "FormatException", "UnsupportedError", "UnimplementedError", "TypeError", "NoSuchMethodError", "IntegerDivisionByZeroException", "ConcurrentModificationError", "IndexError", "AssertionError", "Comparable", "Function", "Null", "Never", "Record", "MapEntry", "Iterator", "Symbol", "Type", "Runes", "Completer", "Timer", "File", "Directory", "Platform", "Process", "StreamController", "LinkedHashMap", "HashMap", "SplayTreeMap", "Queue", "HashSet", "LinkedHashSet", "jsonEncode", "jsonDecode", "json", "utf8", "unawaited", "scheduleMicrotask", "Zone", "BigInt", "Uri", "Encoding", "IOException", "FileSystemException", "TimeoutException", "AsyncError", "StackTrace", "Sink", "Enum", "Pattern", "Match", "RegExpMatch", "Comparator", "Expando", "WeakReference", "Finalizer", "dynamic", "void", "Isolate", "ProcessResult", "FileMode", "SystemEncoding", "LineSplitter", "JsonEncoder", "JsonDecoder", "IOSink", "Stopwatch", "UnmodifiableListView", "ListQueue", "DoubleLinkedQueue", "Deprecated", "override", "deprecated", "pragma", "Sort", "max", "min"]);

  var VALORES_GLOBAIS = new Set(["stdin", "stdout", "stderr", "pi", "e", "ln2", "ln10", "log2e", "log10e", "sqrt2", "sqrt1_2"]);
  function Gerador(prog, src, nomeArq) {
    this.prog = prog; this.src = src; this.arq = nomeArq || "main.dart";
    this.classes = {}; this.topo = {}; this.erros = []; this.tmp = 0; this.extensoes = []; this.tparams = new Set(TPARAMS_VISTOS);
    this.linhas = null;
  }
  var G = Gerador.prototype;
  // o que cada biblioteca do SDK traz (sem import, o nome não existe)
  var DE_BIBLIOTECA = {
    "dart:math": ["pi", "e", "sqrt", "pow", "max", "min", "sin", "cos", "tan", "atan", "atan2", "asin", "acos", "exp", "log", "ln10", "ln2", "log2e", "log10e", "sqrt2", "sqrt1_2", "Random", "Point", "Rectangle"],
    "dart:io": ["stdin", "stdout", "stderr", "exit", "sleep", "File", "Directory", "Platform", "Process", "ProcessResult", "FileMode", "IOSink", "Stdin", "Stdout", "FileSystemException", "IOException", "HttpClient", "SystemEncoding", "PathNotFoundException"],
    "dart:convert": ["jsonEncode", "jsonDecode", "json", "utf8", "JsonEncoder", "JsonDecoder", "LineSplitter", "Encoding", "base64", "ascii", "latin1"],
    "dart:async": ["Timer", "Completer", "StreamController", "StreamSubscription", "unawaited", "scheduleMicrotask", "TimeoutException", "Zone", "StreamTransformer", "FutureOr"],
    "dart:isolate": ["Isolate", "ReceivePort", "SendPort"],
    "dart:collection": ["HashMap", "LinkedHashMap", "SplayTreeMap", "Queue", "ListQueue", "DoubleLinkedQueue", "HashSet", "LinkedHashSet", "SplayTreeSet", "UnmodifiableListView", "UnmodifiableMapView", "LinkedList"],
  };
  var BIBLIOTECA_DE = {};
  Object.keys(DE_BIBLIOTECA).forEach(function (b) { DE_BIBLIOTECA[b].forEach(function (n) { BIBLIOTECA_DE[n] = b; }); });
  G.disponivelVia = function (n, e) { return e && e.viaPrefixo ? true : this.disponivel(n); };
  G.disponivel = function (n) {
    // o nome global n está disponível com os imports do programa? (dart:core sempre)
    var b = BIBLIOTECA_DE[n];
    if (n === "FutureOr" || n === "Future" || n === "Stream") return true;
    if (!b) return true;
    return (this.imports || []).some(function (im) { return im.uri === b && !im.prefixo && (!im.show || im.show.indexOf(n) >= 0) && (!im.hide || im.hide.indexOf(n) < 0); });
  };
  G.prefixo = function (n, esc) {
    if (esc.achar(n) || this.topo[n]) return null;
    var im = (this.imports || []).filter(function (x) { return x.prefixo === n; })[0];
    return im || null;
  };
  var SEM_CONTEXTO = new Set(["int", "double", "num", "String", "bool", "Null", "dynamic", "void", "Never", "Function"]);
  var BIB_TIPO = { Future: "dart:async", Stream: "dart:async", FutureOr: "dart:async", Completer: "dart:async", Timer: "dart:async", StreamController: "dart:async", File: "dart:io", Directory: "dart:io", Random: "dart:math", Point: "dart:math" };
  G.contexto = function (tipos) {
    var self = this, vistos = {}, linhas = [];
    (function vis(t) {
      if (!t) return;
      if (t.k === "TFun") { vis(t.ret); return; }
      if (t.k === "TRec") { t.pos.forEach(vis); return; }
      if (t.k !== "T") return;
      var n = t.nome;
      if (!vistos[n] && !SEM_CONTEXTO.has(n) && !self.tparams.has(n)) {
        vistos[n] = 1;
        var c = self.classes[n];
        if (c) linhas.push(" - '" + n + "' is from '" + (c.arq === self.arqPrincipal || !c.arq ? self.arqPrincipal || "main.dart" : "package:" + "" + c.arq).replace("package:", "") + "'.");
        else if (TIPOS_NATIVOS.has(n) || GLOBAIS.has(n)) linhas.push(" - '" + n + "' is from '" + (BIB_TIPO[n] || BIBLIOTECA_DE[n] || "dart:core") + "'.");
      }
      (t.args || []).forEach(vis);
    })({ k: "TRec", pos: tipos, nomeados: [] });
    return linhas.join("\n");
  };
  G.comCtx = function (tipos, extra) { var c = this.contexto(tipos); return c ? c + (extra ? "\n" + extra : "") : (extra || null); };
  G.erro = function (msg, p, len, extra, ctx) { var e = new ErroDart(msg, p, len, extra); if (ctx) e.ctx = ctx; this.erros.push(e); return e; };
  G.temp = function () { return "$t" + (++this.tmp); };

  // escopo
  function Escopo(pai, tipo) { this.pai = pai; this.vars = Object.create(null); this.tipo = tipo || "bloco"; }
  Escopo.prototype.achar = function (n) { var e = this; while (e) { if (n in e.vars) return e.vars[n]; e = e.pai; } return null; };
  Escopo.prototype.def = function (n, info) { this.vars[n] = info; if (this.prom) delete this.prom[n]; return info; };
  Escopo.prototype.promovido = function (n) {
    var e = this;
    while (e) { if (e.prom && n in e.prom) return e.prom[n]; if (n in e.vars) return null; e = e.pai; }
    return null;
  };
  Escopo.prototype.promover = function (m) { if (!m) return this; var k = Object.keys(m); if (!k.length) return this; this.prom = Object.assign({}, this.prom || {}, m); return this; };
  function filho(esc, m) { var e = new Escopo(esc); e.promover(m); return e; }

  G.gerar = function () {
    var self = this, out = [];
    // 1º passo: coleta nomes de topo e classes
    this.porArq = {};
    var idxArq = {}, nArq = 0;
    this.prog.forEach(function (d) {
      if (d.k !== "Function" && d.k !== "TopVar") return;
      var a = d.arq || "main.dart";
      if (!(a in idxArq)) idxArq[a] = nArq++;
      var suf = idxArq[a] ? "$" + idxArq[a] : "";
      var reg = function (nome, info) {
        (self.porArq[a] = self.porArq[a] || {})[nome] = info;
        var ant = self.topo[nome];
        if (ant && ant.arq !== a && (ant.k === "fun" || ant.k === "var" || ant.ambiguo)) { var amb = { k: "ambiguo", ambiguo: true, arqs: (ant.arqs || [ant.arq]).concat([a]) }; self.topo[nome] = amb; }
        else self.topo[nome] = info;
      };
      if (d.k === "Function") reg(d.nome, { k: "fun", js: jsNome(d.nome) + suf, decl: d, arq: a });
      else d.vars.forEach(function (v) { v.js = jsNome(v.nome) + suf; reg(v.nome, { k: "var", js: v.js, tipo: d.tipo || (v.init ? self.tipoDe(v.init, new Escopo(null)) : null), final: d.final || d.constante, constante: d.constante, arq: a }); });
    });
    this.prog.forEach(function (d) {
      if (d.k === "Class" || d.k === "Enum" || d.k === "ExtType") { self.classes[d.nome] = d; self.topo[d.nome] = { k: "classe", js: "C_" + d.nome }; }
      else if (d.k === "Function" || d.k === "TopVar") { /* já registrado */ }
      else if (d.k === "Typedef") self.topo[d.nome] = { k: "typedef", tipo: d.tipo };
      else if (d.k === "Extension") self.extensoes.push(d);
    });
    // membros de cada classe (com os herdados)
    Object.keys(this.classes).forEach(function (n) { self.membrosDe(n); });
    var esc = new Escopo(null, "topo");
    // classes em ordem (superclasse antes)
    var feitas = {}, ordem = [];
    function visita(n) {
      if (feitas[n]) return; feitas[n] = 1;
      var c = self.classes[n]; if (!c) return;
      if (c.sup && self.classes[c.sup.nome]) visita(c.sup.nome);
      (c.mixins || []).forEach(function (m) { if (self.classes[m.nome]) visita(m.nome); });
      (c.on || []).forEach(function (m) { if (self.classes[m.nome]) visita(m.nome); });
      ordem.push(c);
    }
    Object.keys(this.classes).forEach(visita);
    ordem.forEach(function (c) { out.push(self.genClasse(c, esc)); });
    ordem.forEach(function (c) { if (c.k === "Class") { self.checarAbstratos(c); self.checarFinais(c); } });
    this.extensoes.forEach(function (x) { out.push(self.genExtensao(x, esc)); });
    // variáveis de topo: preguiçosas (como no Dart)
    this.prog.forEach(function (d) {
      if (d.k === "TopVar") {
        d.vars.forEach(function (v) {
          var js = v.js || jsNome(v.nome);
          if (v.init) out.push("let " + js + "; $R.lazy(() => " + js + ", (x) => " + js + " = x, () => " + self.coagir(self.expr(v.init, esc), d.tipo, v.init) + ");");
          else out.push("let " + js + " = null;");
        });
      }
    });
    this.prog.forEach(function (d) {
      if (d.k === "Function") out.push(self.genFuncao(d, esc, "function " + self.porArq[d.arq || "main.dart"][d.nome].js, d.nome));
    });
    var main = (this.porArq[this.prog.length && this.arqPrincipal || "main.dart"] || {}).main || this.topo.main;
    if (!main || main.k !== "fun") this.erro("Undefined name 'main'.", 0, 0, "semMain");
    var ps = main && main.decl ? main.decl.params.pos.length : 0;
    var temps = []; for (var ti = 1; ti <= this.tmp; ti++) temps.push("$t" + ti);
    if (temps.length) out.unshift("var " + temps.join(", ") + ";");
    out.unshift("var $f = null;");
    out.unshift('"use strict";');
    out.push("return { main: " + (main ? main.js : "null") + ", nargs: " + ps + ", async: " + !!(main && main.decl && main.decl.async) + " };");
    return out.join("\n");
  };
  G.declsDe = function (c) {
    // membros de instância com corpo (concretos) e sem corpo (abstratos), por nome
    var r = {};
    c.membros.forEach(function (d) {
      if (d.estatico || d.k === "Ctor") return;
      if (d.k === "Field") d.vars.forEach(function (v) { r[v.nome] = { concreto: true, d: d, p: v.p, campo: true, final: d.final }; });
      else if (d.k === "Method" || d.k === "Getter" || d.k === "Setter") { var nm = d.k === "Setter" ? d.nome + "=" : d.nome; r[nm] = { concreto: !!d.corpo, d: d, p: d.pNome !== undefined ? d.pNome : d.p, len: String(d.nome).length }; }
    });
    return r;
  };
  G.checarAbstratos = function (c) {
    if (c.abstrata || c.mixin || c.sealed || (c.mods || []).indexOf("abstract") >= 0 || (c.mods || []).indexOf("interface") >= 0 && false) return;
    var self = this;
    if (c.membros.some(function (d) { return d.k === "Method" && d.nome === "noSuchMethod"; })) return;
    var concretos = {}, faltam = [];
    // o que a classe (e as superclasses e mixins) implementa
    (function junta(k) {
      if (!k) return;
      var ds = self.declsDe(k);
      Object.keys(ds).forEach(function (n) { if (ds[n].concreto) { concretos[n] = true; if (ds[n].campo) { concretos[n] = true; if (!ds[n].final) concretos[n + "="] = true; } } });
      (k.mixins || []).forEach(function (m) { junta(self.classes[m.nome]); });
      if (k.sup) { if (!self.classes[k.sup.nome]) { concretos["*"] = true; return; } junta(self.classes[k.sup.nome]); }
    })(c);
    if (concretos["*"]) return;
    var vistos = {};
    function exige(k, todos) {
      if (!k) return;
      var ds = self.declsDe(k);
      Object.keys(ds).forEach(function (n) {
        var x = ds[n];
        if (!todos && x.concreto) return;
        var nomes = x.campo ? (x.final ? [n] : [n, n + "="]) : [n];
        nomes.forEach(function (nn) { if (!concretos[nn] && !vistos[k.nome + "." + nn]) { vistos[k.nome + "." + nn] = 1; faltam.push({ nome: k.nome + "." + nn, p: x.p, len: x.len || n.length }); } });
      });
    }
    (function sobe(k, viaInterface) {
      if (!k) return;
      exige(k, viaInterface);
      (k.impls || []).forEach(function (i) { var ci = self.classes[i.nome]; if (ci) sobe(ci, true); });
      if (k.sup && self.classes[k.sup.nome]) sobe(self.classes[k.sup.nome], viaInterface);
    })(c, false);
    // os abstratos da própria classe também contam (classe concreta com método sem corpo)
    faltam = faltam.filter(function (f) { return f.nome.indexOf(c.nome + ".") !== 0 || true; });
    if (!faltam.length) return;
    this.erro("The non-abstract class '" + c.nome + "' is missing implementations for these members:\n" + faltam.map(function (f) { return " - " + f.nome; }).join("\n"), c.pNome, c.nome.length,
      "Try to either\n - provide an implementation,\n - inherit an implementation from a superclass or mixin,\n - mark the class as abstract, or\n - provide a 'noSuchMethod' implementation.",
      faltam.map(function (f) { return { msg: "'" + f.nome + "' is defined here.", pos: f.p, len: f.len }; })).fase = 0.5;
  };
  G.checarFinais = function (c) {
    var self = this;
    var finais = [];
    c.membros.forEach(function (d) { if (d.k === "Field" && !d.estatico && d.final && !d.late) d.vars.forEach(function (v) { if (!v.init) finais.push(v); }); });
    if (!finais.length) return;
    var ctors = c.membros.filter(function (d) { return d.k === "Ctor" && !d.fabrica && !d.redir; });
    if (!ctors.length) {
      finais.forEach(function (v) { self.erro("Final field '" + v.nome + "' is not initialized.", v.p, v.nome.length, "Try to initialize the field in the declaration or in every constructor.").fase = 3; });
      return;
    }
    ctors.forEach(function (k) {
      var ini = {};
      k.params.pos.concat(k.params.opc, k.params.nomeados).forEach(function (p) { if (p.campo) ini[p.nome] = 1; });
      k.inits.forEach(function (it) { if (it.campo) ini[it.campo] = 1; });
      finais.forEach(function (v) {
        if (ini[v.nome]) return;
        var pk = k.nome ? k.p : k.p;
        self.erro("Final field '" + v.nome + "' is not initialized by this constructor.", k.pNomeCtor !== undefined ? k.pNomeCtor : k.p, (k.nome ? c.nome.length + 1 + k.nome.length : c.nome.length), "Try to initialize the field using an initializing formal or a field initializer.", { msg: "'" + v.nome + "' is defined here.", pos: v.p, len: v.nome.length }).fase = 3;
      });
    });
  };
  G.membrosDe = function (n) {
    var c = this.classes[n]; if (!c) return null;
    if (c._membros) return c._membros;
    var m = c._membros = { inst: Object.create(null), est: Object.create(null), campos: [] };
    var self = this;
    var sups = [];
    if (c.sup) sups.push(c.sup.nome);
    (c.mixins || []).forEach(function (x) { sups.push(x.nome); });
    (c.on || []).forEach(function (x) { sups.push(x.nome); });
    (c.impls || []).forEach(function (x) { sups.push(x.nome); });
    sups.forEach(function (s) { var ms = self.membrosDe(s); if (ms) for (var k in ms.inst) m.inst[k] = ms.inst[k]; else if (BASE_MEMBROS[s]) BASE_MEMBROS[s].forEach(function (k) { m.inst[k] = { k: "base" }; }); });
    if (c.k === "Enum") { m.inst.index = { k: "campo" }; m.inst.name = { k: "campo" }; m.est.values = { k: "campo" }; }
    if (c.k === "ExtType") m.inst[c.rep.nome] = { k: "campo", tipo: c.rep.tipo };
    c.membros.forEach(function (d) {
      var alvo = d.estatico ? m.est : m.inst;
      if (d.k === "Field") d.vars.forEach(function (v) { alvo[v.nome] = { k: "campo", tipo: d.tipo, final: d.final }; if (!d.estatico) m.campos.push(v.nome); });
      else if (d.k === "Method" && !d.operador) alvo[d.nome] = { k: "metodo", decl: d };
      else if (d.k === "Getter") alvo[d.nome] = { k: "get", tipo: d.ret, setter: !!(alvo[d.nome] && alvo[d.nome].setter) };
      else if (d.k === "Setter") { if (!alvo[d.nome]) alvo[d.nome] = { k: "set", setter: true }; else alvo[d.nome].setter = true; }
    });
    return m;
  };
  // os membros dos tipos do dart:core (para o erro "The getter 'x' isn't defined for the type 'int'.")
  var MEMBROS_OBJ = ["toString", "hashCode", "runtimeType", "noSuchMethod"];
  var M_NUM = "abs ceil ceilToDouble clamp compareTo floor floorToDouble isFinite isInfinite isNaN isNegative remainder round roundToDouble sign toDouble toInt toString toStringAsExponential toStringAsFixed toStringAsPrecision truncate truncateToDouble".split(" ");
  var M_ITER = "any cast contains elementAt every expand first firstWhere fold followedBy forEach isEmpty isNotEmpty iterator join last lastWhere length map reduce single singleWhere skip skipWhile take takeWhile toList toSet where whereType firstOrNull lastOrNull singleOrNull indexed nonNulls elementAtOrNull wait".split(" ");
  var MEMBROS_CORE = {
    int: M_NUM.concat("bitLength gcd isEven isOdd modInverse modPow toRadixString toSigned toUnsigned".split(" ")),
    double: M_NUM.slice(),
    num: M_NUM.slice(),
    bool: [],
    String: "allMatches codeUnitAt codeUnits compareTo contains endsWith indexOf isEmpty isNotEmpty lastIndexOf length matchAsPrefix padLeft padRight replaceAll replaceAllMapped replaceFirst replaceFirstMapped replaceRange runes split splitMapJoin startsWith substring toLowerCase toUpperCase trim trimLeft trimRight".split(" "),
    List: M_ITER.concat("add addAll asMap clear fillRange getRange indexOf indexWhere insert insertAll lastIndexOf lastIndexWhere remove removeAt removeLast removeRange removeWhere replaceRange retainWhere reversed setAll setRange shuffle sort sublist".split(" ")),
    Set: M_ITER.concat("add addAll clear containsAll difference intersection lookup remove removeAll removeWhere retainAll retainWhere union".split(" ")),
    Iterable: M_ITER.slice(),
    Map: "addAll addEntries cast clear containsKey containsValue entries forEach isEmpty isNotEmpty keys length map putIfAbsent remove removeWhere update updateAll values".split(" "),
  };
  var BASE_MEMBROS = { Exception: ["message", "toString"], Error: ["stackTrace", "toString"], Comparable: ["compareTo"] };

  var TIPOS_NATIVOS = new Set(["int", "double", "num", "String", "bool", "List", "Map", "Set", "Object", "Iterable", "Future", "FutureOr", "Stream", "Duration", "DateTime", "StringBuffer", "RegExp", "Exception", "Error", "StateError", "ArgumentError", "RangeError", "FormatException", "UnsupportedError", "UnimplementedError", "TypeError", "NoSuchMethodError", "IntegerDivisionByZeroException", "Comparable", "Function", "Null", "Never", "Record", "MapEntry", "Iterator", "Symbol", "Type", "Runes", "Completer", "Timer", "File", "Directory", "Random", "StreamController", "StreamSubscription", "LinkedHashMap", "HashMap", "SplayTreeMap", "Queue", "HashSet", "LinkedHashSet", "BigInt", "Uri", "StackTrace", "Enum", "Pattern", "Match", "RegExpMatch", "Comparator", "dynamic", "void", "Stopwatch", "IOSink", "Stdin", "Stdout", "Point", "Sink", "TimeoutException", "FileSystemException", "IOException", "Isolate", "JsonEncoder", "JsonDecoder", "Encoding", "Platform", "Process", "ProcessResult", "FileMode", "Object", "Invocation", "Expando", "WeakReference", "Deprecated", "ConcurrentModificationError", "IndexError", "AssertionError", "LateInitializationError", "Sort", "UnmodifiableListView", "ListQueue", "Element", "Widget", "BuildContext", "State", "StatelessWidget", "StatefulWidget", "Text", "MaterialApp", "Scaffold"]);
  G.checarTipo = function (t, onde) {
    if (!t) return;
    if (t.k === "TFun") { this.checarTipo(t.ret); (t.params.pos || []).concat(t.params.opc || [], t.params.nomeados || []).forEach(function (p) { this.checarTipo(p.tipo); }, this); return; }
    if (t.k === "TRec") { t.pos.forEach(function (x) { this.checarTipo(x); }, this); t.nomeados.forEach(function (x) { this.checarTipo(x.tipo); }, this); return; }
    if (t.k !== "T") return;
    (t.args || []).forEach(function (x) { this.checarTipo(x); }, this);
    var n = t.nome;
    if (BIBLIOTECA_DE[n] && !this.disponivel(n) && !(t.prefixo)) { if (t.p !== undefined) this.erro(onde === "super" ? "Type '" + n + "' not found." : "'" + n + "' isn't a type.", t.p, n.length); return; }
    if (TIPOS_NATIVOS.has(n) || this.classes[n] || (this.topo[n] && this.topo[n].k === "typedef") || this.tparams.has(n) || GLOBAIS.has(n)) return;
    if (t.p === undefined) return;
    if (onde === "super") this.erro("Type '" + n + "' not found.", t.p, n.length).fase = 0.5;
    else this.erro("'" + n + "' isn't a type.", t.p, n.length);
  };
  G.tipoNome = function (t) { return t ? (t.k === "T" ? t.nome : t.k === "TFun" ? "Function" : "Record") : null; };
  G.tipoRt = function (t) {
    // descrição do tipo em tempo de execução
    if (!t) return "null";
    if (t.k === "TFun") return q({ n: "Function", nul: t.nul });
    if (t.k === "TRec") return q({ n: "Record", nul: t.nul, pos: t.pos.length });
    var td = this.topo[t.nome];
    if (td && td.k === "typedef") { var r = JSON.parse(this.tipoRt(td.tipo)); if (t.nul) r.nul = true; return q(r); }
    var o = { n: t.nome, nul: t.nul };
    if (t.args && t.args.length) o.a = t.args.map(function (x) { return JSON.parse(this.tipoRt(x)); }, this);
    return q(o);
  };
  G.tipoTexto = function (t) {
    if (!t) return "dynamic";
    if (t.k === "TFun") return (t.ret ? this.tipoTexto(t.ret) : "dynamic") + " Function(" + t.params.pos.map(function (p) { return this.tipoTexto(p.tipo); }, this).join(", ") + ")" + (t.nul ? "?" : "");
    if (t.k === "TRec") { var nm = t.nomeados.slice().sort(function (a, b) { return a.nome < b.nome ? -1 : 1; }); return "(" + t.pos.map(this.tipoTexto, this).join(", ") + (nm.length ? (t.pos.length ? ", " : "") + "{" + nm.map(function (x) { return this.tipoTexto(x.tipo) + " " + x.nome; }, this).join(", ") + "}" : "") + ")" + (t.nul ? "?" : ""); }
    return t.nome + (t.args && t.args.length ? "<" + t.args.map(this.tipoTexto, this).join(", ") + ">" : "") + (t.nul ? "?" : "");
  };
  // converte int → double quando o destino é double (o Dart faz isso com literais)
  G.exprT = function (e, esc, tipo) {
    if (tipo && e && tipo.k === "T" && !e.targs && tipo.args && tipo.args.length) {
      if (e.k === "ListLit" && (tipo.nome === "List" || tipo.nome === "Iterable") && tipo.args.length === 1) e.targsCtx = tipo.args;
      if (e.k === "SetLit" && tipo.nome === "Set" && tipo.args.length === 1) e.targsCtx = tipo.args;
      if (e.k === "MapLit" && tipo.nome === "Map" && tipo.args.length === 2) e.targsCtx = tipo.args;
    }
    // gera a expressão sabendo o tipo esperado (o Dart converte 3 → 3.0 e passa o tipo às funções anônimas)
    if (tipo && e && e.k === "Lambda" && tipo.k === "TFun") e.retEsperado = tipo.ret;
    if (tipo && e && e.k === "Cond") { this.marcarEsperado(e.a, tipo); this.marcarEsperado(e.b, tipo); }
    return this.coagir(this.expr(e, esc), tipo, e);
  };
  G.marcarEsperado = function (e, tipo) { if (e && e.k === "Lambda" && tipo.k === "TFun") e.retEsperado = tipo.ret; };
  G.coagir = function (js, tipo, no) {
    if (!tipo || tipo.k !== "T") return js;
    if (tipo.nome === "double") return "$R.D(" + js + ")";
    if ((tipo.nome === "List" || tipo.nome === "Set" || tipo.nome === "Iterable") && tipo.args.length === 1 && tipo.args[0].k === "T" && tipo.args[0].nome === "double") return "$R.DL(" + js + ")";
    if (tipo.nome === "Map" && tipo.args.length === 2 && tipo.args[1].k === "T" && tipo.args[1].nome === "double") return "$R.DM(" + js + ")";
    return js;
  };

  /* ---- classes ---- */
  G.genClasse = function (c, esc) {
    var self = this, js = "C_" + c.nome, L = [];
    if (c.sup) this.checarTipo(c.sup, "super");
    (c.mixins || []).concat(c.impls || [], c.on || []).forEach(function (t) { self.checarTipo(t, "super"); });
    c.membros.forEach(function (d) { if (d.k === "Field") self.checarTipo(d.tipo); if (d.k === "Method" || d.k === "Getter") self.checarTipo(d.ret); });
    var ehEnum = c.k === "Enum", ehExt = c.k === "ExtType";
    var base = "$R.DObject";
    if (c.sup) base = this.classes[c.sup.nome] ? "C_" + c.sup.nome : "$R.classeBase(" + q(c.sup.nome) + ")";
    if (ehEnum) base = "$R.DEnum";
    var mix = (c.mixins || []).map(function (m) { return self.classes[m.nome] ? "C_" + m.nome : "$R.classeBase(" + q(m.nome) + ")"; });
    if (mix.length) base = "$R.mixin(" + base + ", " + mix.join(", ") + ")";
    L.push("class " + js + " extends " + base + " {");
    var cesc = new Escopo(esc, "classe"); cesc.classe = c;
    // métodos, getters, setters, operadores
    c.membros.forEach(function (d) {
      var est = d.estatico ? "static " : "";
      if (d.k === "Method") {
        if (!d.corpo) return;
        var nm = d.operador ? q(mNome(d.nome)) : mNome(d.nome);
        L.push(self.genFuncao(d, cesc, est + (d.async && !d.gerador ? "async " : "") + (d.gerador && !d.async ? "*" : d.gerador ? "async *" : "") + "[" + (d.operador ? nm : q(nm)) + "]", (c.nome) + "." + d.nome, true, d.estatico));
      } else if (d.k === "Getter") {
        if (!d.corpo) return;
        L.push(self.genFuncao(d, cesc, est + "get " + mNome(d.nome), c.nome + "." + d.nome, true, d.estatico));
      } else if (d.k === "Setter") {
        if (!d.corpo) return;
        L.push(self.genFuncao(d, cesc, est + "set " + mNome(d.nome), c.nome + "." + d.nome + "=", true, d.estatico));
      }
    });
    L.push("}");
    L.push(js + ".prototype.$nome = " + q(c.nome) + ";");
    L.push(js + ".$nome = " + q(c.nome) + ";");
    var impls = (c.impls || []).concat(c.mixins || []).concat(c.on || []).map(function (t) { return t.nome; });
    L.push(js + ".$impl = " + q(impls) + ";");
    L.push("$R.classes[" + q(c.nome) + "] = " + js + ";");
    if (c.abstrata || c.mixin) L.push(js + ".$abstrata = true;");
    // campos: inicialização
    var campos = [];
    c.membros.forEach(function (d) { if (d.k === "Field" && !d.estatico) d.vars.forEach(function (v) { campos.push({ nome: v.nome, init: v.init, tipo: d.tipo, late: d.late }); }); });
    var fesc = new Escopo(cesc, "funcao"); fesc.ehMetodo = true; fesc.nomeFun = c.nome;
    L.push(js + ".prototype.$campos = function () {" + (c.sup || mix.length ? " if (super.$campos) super.$campos.call(this);" : "") +
      campos.map(function (f) { return " this." + mNome(f.nome) + " = " + (f.init ? self.coagir(self.expr(f.init, fesc), f.tipo, f.init) : (f.late ? "$R.LATE" : "null")) + ";"; }).join("") + " };");
    // o $campos com super não funciona em function comum: troca por cadeia explícita
    L[L.length - 1] = js + ".prototype.$campos = function () {" + (c.sup || mix.length ? " const s = Object.getPrototypeOf(" + js + ".prototype).$campos; if (s) s.call(this);" : "") +
      campos.map(function (f) { return " this." + mNome(f.nome) + " = " + (f.init ? self.coagir(self.expr(f.init, fesc), f.tipo, f.init) : (f.late ? "$R.LATE" : "null")) + ";"; }).join("") + " };";
    if (ehExt) L.push(js + ".prototype.$campos = function () {};");
    // estáticos
    c.membros.forEach(function (d) {
      if (d.k === "Field" && d.estatico) d.vars.forEach(function (v) {
        var nm = js + "." + mNome(v.nome);
        if (v.init) L.push("$R.lazyStatic(" + js + ", " + q(mNome(v.nome)) + ", () => " + self.coagir(self.expr(v.init, fesc), d.tipo, v.init) + ");");
        else L.push(nm + " = null;");
      });
    });
    // construtores
    var ctors = c.membros.filter(function (d) { return d.k === "Ctor"; });
    if (ehExt) { L.push(js + ".prototype.m_toString = function () { return $R.str(this." + mNome(c.rep.nome) + "); };"); L.push(js + ".prototype.$eq = function (o) { return o instanceof " + js + " && $R.eq(o." + mNome(c.rep.nome) + ", this." + mNome(c.rep.nome) + "); };"); }
    if (!ctors.length && !c.mixin) ctors.push({ k: "Ctor", nome: "", params: { pos: [], opc: [], nomeados: [] }, inits: [], corpo: null, p: c.p, sintetico: true });
    ctors.forEach(function (k) { L.push(self.genCtor(c, k, cesc)); });
    if (ehEnum) {
      var vals = c.valores.map(function (v, i) {
        var ctor = v.ctor || "";
        var args = v.args ? self.argsJs(v.args, fesc) : "";
        return "$R.enumValor(" + js + ", " + q(v.nome) + ", " + i + ", (o) => " + js + ".$i_" + (ctor || "$") + "(o" + (args ? ", " + args : "") + "))";
      });
      L.push(js + ".m_values = [" + vals.join(", ") + "];");
      c.valores.forEach(function (v, i) { L.push(js + "." + mNome(v.nome) + " = " + js + ".m_values[" + i + "];"); });
      L.push("$R.listaFixa(" + js + ".m_values, true);");
    }
    return L.join("\n");
  };
  G.genCtor = function (c, k, cesc) {
    var self = this, js = "C_" + c.nome, nm = k.nome || "$";
    var fesc = new Escopo(cesc, "funcao"); fesc.ehMetodo = true; fesc.ehCtor = true;
    fesc.nomeFun = c.nome + (k.nome ? "." + k.nome : "");
    var membros = this.membrosDe(c.nome);
    var ps = this.paramsJs(k.params, fesc, true);
    var corpo = [];
    var pre = [];
    // parâmetros this.x
    var campoTipo = function (n) { var f = membros.inst[n]; return f ? f.tipo : null; };
    if (k.fabrica) {
      if (k.redir && k.redir.classe) {
        corpo.push("return C_" + k.redir.classe + "." + (k.redir.nome ? mNome(k.redir.nome) : "$new") + "(..." + "arguments);");
      } else {
        corpo.push(this.blocoJs(k.corpo, fesc, true));
      }
      var fab = "static " + (k.nome ? mNome(k.nome) : "$new") + "(" + ps.lista + ") {" + ps.pre + "\nconst $f = $R.entrar(" + q(this.nomeFrame(fesc.nomeFun, true)) + ");\ntry {\n" + corpo.join("\n") + "\n} finally { $R.sair($f); }\n}";
      return "Object.assign(" + js + ", { " + fab.replace(/^static /, "") + " });" + (k.nome ? "" : "");
    }
    var tudo = [];
    tudo.push("const $f = $R.entrar(" + q(this.nomeFrame(fesc.nomeFun, true)) + ");");
    tudo.push("try {");
    if (k.redir) {
      tudo.push(js + ".$i_" + (k.redir.nome || "$") + "(o" + (this.argsJs(k.redir.args, fesc) ? ", " + this.argsJs(k.redir.args, fesc) : "") + ");");
    } else {
      tudo.push("if (!o.$iniciado) { o.$iniciado = true; o.$campos(); }");
      var todos = k.params.pos.concat(k.params.opc, k.params.nomeados);
      todos.forEach(function (p) { if (p.campo) tudo.push("o." + mNome(p.nome) + " = " + self.coagir(jsNome(p.nome), campoTipo(p.nome)) + ";"); });
      k.inits.forEach(function (it) {
        if (it.assert) tudo.push("$R.afirmar(" + self.expr(it.assert, fesc) + ", " + (it.msg ? self.expr(it.msg, fesc) : "null") + ", " + it.p + ");");
        else tudo.push("o." + mNome(it.campo) + " = " + self.coagir(self.exprComThis(it.valor, fesc, "o"), campoTipo(it.campo)) + ";");
      });
      // super
      var supNome = c.sup ? c.sup.nome : null;
      if (supNome) {
        var sargs = [];
        var superPs = todos.filter(function (p) { return p.superP; });
        if (k.superCall || superPs.length) {
          var a = k.superCall ? { pos: k.superCall.args.pos.slice(), nom: k.superCall.args.nom.slice() } : { pos: [], nom: [] };
          var sjs = this.argsJs(a, fesc, "o");
          var extrasPos = superPs.filter(function (p) { return k.params.nomeados.indexOf(p) < 0; }).map(function (p) { return jsNome(p.nome); });
          var extrasNom = superPs.filter(function (p) { return k.params.nomeados.indexOf(p) >= 0; });
          var lista = [];
          if (extrasPos.length) lista = lista.concat(extrasPos);
          if (a.pos.length) lista = lista.concat(a.pos.map(function (x) { return self.exprComThis(x, fesc, "o"); }));
          var nomObj = a.nom.map(function (x) { return x.nome + ": " + self.exprComThis(x.valor, fesc, "o"); }).concat(extrasNom.map(function (p) { return p.nome + ": " + jsNome(p.nome); }));
          if (nomObj.length) lista.push("{" + nomObj.join(", ") + "}");
          var sc = this.classes[supNome] ? "C_" + supNome : "$R.classeBase(" + q(supNome) + ")";
          tudo.push(sc + ".$i_" + ((k.superCall && k.superCall.nome) || "$") + "(o" + (lista.length ? ", " + lista.join(", ") : "") + ");");
        } else {
          var sc2 = this.classes[supNome] ? "C_" + supNome : "$R.classeBase(" + q(supNome) + ")";
          tudo.push(sc2 + ".$i_$(o);");
        }
      }
      if (k.corpo) {
        tudo.push("(function () {" + this.blocoJs(k.corpo, fesc, true) + "}).call(o);");
      }
    }
    tudo.push("} finally { $R.sair($f); }");
    var ini = js + ".$i_" + nm + " = function (o" + (ps.lista ? ", " + ps.lista : "") + ") {" + ps.pre + "\n" + tudo.join("\n") + "\n};";
    var abst = c.abstrata ? "$R.erroAbstrata(" + q(c.nome) + ");" : "";
    var fabrica = js + "." + (k.nome ? mNome(k.nome) : "$new") + " = function (" + ps.lista + ") { const o = Object.create(" + js + ".prototype); " + js + ".$i_" + nm + "(o" + (ps.lista ? ", " + ps.nomes : "") + "); return o; };";
    if (c.k === "Enum") fabrica = "";
    return ini + "\n" + fabrica;
  };
  G.nomeFrame = function (n, ctor) { return ctor ? (n.indexOf(".") < 0 ? "new " + n : n) : n; };
  G.genExtensao = function (x, esc) {
    var self = this, L = [];
    var cesc = new Escopo(esc, "classe"); cesc.extensao = x;
    var tn = x.tipo.k === "T" ? x.tipo.nome : "Object";
    x.membros.forEach(function (d) {
      if (d.k === "Method" && d.corpo) {
        L.push("$R.extensao(" + q(tn) + ", " + q(d.operador ? d.nome : d.nome) + ", " + q(d.estatico ? "static" : "metodo") + ", " + self.genFuncao(d, cesc, "function", tn + "." + d.nome, true) + ");");
      } else if (d.k === "Getter" && d.corpo) {
        L.push("$R.extensao(" + q(tn) + ", " + q(d.nome) + ", \"get\", " + self.genFuncao(d, cesc, "function", tn + "." + d.nome, true) + ");");
      } else if (d.k === "Setter" && d.corpo) {
        L.push("$R.extensao(" + q(tn) + ", " + q(d.nome) + ", \"set\", " + self.genFuncao(d, cesc, "function", tn + "." + d.nome, true) + ");");
      }
    });
    return L.join("\n");
  };

  /* ---- funções ---- */
  function chaveNom(p) { return p.campo && p.nome.charAt(0) === "_" && p.nome.length > 1 ? p.nome.slice(1) : p.nome; }
  G.paramsJs = function (ps, fesc, ctor) {
    var self = this, nomes = [], pre = "";
    ps.pos.concat(ps.opc, ps.nomeados).forEach(function (p) { self.checarTipo(p.tipo); });
    ps.opc.concat(ps.nomeados).forEach(function (p) {
      var t = p.tipo || (p.campo ? self.tipoCampo(fesc, p.nome) : null);
      if (p.obrig || p.padrao || !t || t.k !== "T" || t.nul || ["dynamic", "Null", "void", "Object?"].indexOf(t.nome) >= 0 || self.tparams.has(t.nome)) return;
      if (fesc.pai && fesc.pai.tipo === "funcao" && false) return;
      self.erro("The parameter '" + p.nome + "' can't have a value of 'null' because of its type '" + self.tipoTexto(t) + "', but the implicit default value is 'null'.", p.p, p.nome.length, (self.contexto([t]) ? self.contexto([t]) + "\n" : "") + "Try adding either an explicit non-'null' default value or the 'required' modifier.");
    });
    ps.pos.forEach(function (p) { nomes.push(jsNome(p.nome)); fesc.def(p.nome, { k: "local", js: jsNome(p.nome), tipo: p.tipo || (p.campo ? self.tipoCampo(fesc, p.nome) : null), param: true }); });
    ps.opc.forEach(function (p) {
      nomes.push(jsNome(p.nome));
      fesc.def(p.nome, { k: "local", js: jsNome(p.nome), tipo: p.tipo || (p.campo ? self.tipoCampo(fesc, p.nome) : null), param: true });
      pre += " if (" + jsNome(p.nome) + " === undefined) " + jsNome(p.nome) + " = " + (p.padrao ? self.expr(p.padrao, fesc) : "null") + ";";
    });
    var lista = nomes.slice();
    if (ps.nomeados.length) {
      lista.push("$n = {}");
      nomes.push("$n");
      ps.nomeados.forEach(function (p) {
        fesc.def(p.nome, { k: "local", js: jsNome(p.nome), tipo: p.tipo || (p.campo ? self.tipoCampo(fesc, p.nome) : null), param: true });
        pre += " let " + jsNome(p.nome) + " = $n[" + q(chaveNom(p)) + "]; if (" + jsNome(p.nome) + " === undefined) " + jsNome(p.nome) + " = " + (p.padrao ? self.expr(p.padrao, fesc) : "null") + ";";
      });
    }
    ps.pos.concat(ps.opc, ps.nomeados).forEach(function (p) {
      var t = p.tipo || (p.campo ? self.tipoCampo(fesc, p.nome) : null);
      if (t && t.k === "T" && t.nome === "double") pre += " " + jsNome(p.nome) + " = $R.D(" + jsNome(p.nome) + ");";
    });
    return { lista: lista.join(", "), nomes: nomes.join(", "), pre: pre };
  };
  G.tipoCampo = function (esc, n) {
    var e = esc; while (e && !e.classe) e = e.pai;
    if (!e) return null;
    var m = this.membrosDe(e.classe.nome); var f = m && m.inst[n];
    return f ? f.tipo : null;
  };
  function terminaSempre(b) {
    if (!b) return false;
    switch (b.k) {
      case "Return": case "Rethrow": return true;
      case "ExprStmt": return b.expr.k === "Throw" || (b.expr.k === "Call" && b.expr.alvo.k === "Ident" && b.expr.alvo.nome === "exit");
      case "Block": return b.corpo.some(terminaSempre);
      case "If": return !!b.senao && terminaSempre(b.entao) && terminaSempre(b.senao);
      case "While": return b.cond.k === "Bool" && b.cond.v === true;
      case "DoWhile": return terminaSempre(b.corpo) || (b.cond.k === "Bool" && b.cond.v === true);
      case "For": return !b.cond;
      case "Switch": case "Try": case "Label": return true; // não confere (evita falso erro)
    }
    return false;
  }
  G.checarRetorno = function (d) {
    var r = d.ret;
    if (!r || !d.corpo || d.gerador || r.k !== "T" || r.nul) return;
    if (d.corpo.corpo.length === 1 && d.corpo.corpo[0].k === "Return" && d.corpo.corpo[0].seta) return;
    var nome = r.nome;
    if (d.async) { if (nome !== "Future" || !r.args.length) return; var a = r.args[0]; if (a.k !== "T" || a.nul) return; nome = a.nome; if (["void", "dynamic", "Null", "Object?"].indexOf(nome) >= 0) return; }
    if (["void", "dynamic", "Null", "FutureOr", "Never"].indexOf(nome) >= 0 || this.tparams.has(nome)) return;
    if (terminaSempre(d.corpo)) return;
    this.erro("A non-null value must be returned since the return type '" + this.tipoTexto(r) + "' doesn't allow null.", d.pNome !== undefined && d.k !== "LocalFun" ? d.pNome : (r.p !== undefined ? r.p : d.p), 1, this.contexto([r]) || null);
  };
  G.genFuncao = function (d, esc, cabeca, nomeFrame, metodo, estatico) {
    if (d.k !== "Getter" && d.k !== "Setter") this.checarRetorno(d);
    var fesc = new Escopo(esc, "funcao");
    fesc.ehMetodo = !!metodo && !estatico; fesc.ehEstatico = !!estatico; fesc.nomeFun = nomeFrame; fesc.ret = d.ret; fesc.async = d.async; fesc.gerador = d.gerador;
    var ps = this.paramsJs(d.params, fesc);
    var corpo = this.blocoJs(d.corpo, fesc, true);
    if (d.k === "Function" || d.k === "LocalFun") {
      if (d.gerador) cabeca = cabeca.replace(/^function /, "function* ");
      if (d.async) cabeca = "async " + cabeca;
    }
    var nf = q(nomeFrame);
    var pre = d.async && !d.gerador ? "" : "";
    var corpoF = "const $f = $R.entrar(" + nf + ");\ntry {\n" + corpo + "\n} finally { $R.sair($f); }";
    if (d.gerador) {
      // sync* e async*: o frame só vale durante cada passo
      corpoF = corpo;
      if (d.async) return this.envolverGerador(cabeca, ps, corpoF, true);
      return this.envolverGerador(cabeca, ps, corpoF, false);
    }
    if (d.async) {
      var tf = d.ret && d.ret.k === "T" && (d.ret.nome === "Future" || d.ret.nome === "FutureOr") && d.ret.args.length ? this.tipoTexto(d.ret.args[0]) : (d.ret && d.ret.k === "T" && d.ret.nome === "void" ? "void" : "dynamic");
      var cab2 = cabeca.replace(/^(static )?async /, "$1");
      return cab2 + "(" + ps.lista + ") {" + ps.pre + "\nreturn $R.futuro((async () => {\n" + corpoF + "\n})(), " + q(tf) + ");\n}";
    }
    return cabeca + "(" + ps.lista + ") {" + ps.pre + "\n" + corpoF + "\n}";
  };
  G.envolverGerador = function (cabeca, ps, corpo, async) {
    // devolve uma função que cria um Iterable (sync*) ou Stream (async*)
    var gen = (async ? "async function* " : "function* ") + "(" + ")" + " {" + corpo + "}";
    var limpo = cabeca.replace(/^async \*?/, "").replace(/^\*/, "").replace(/^async /, "").replace(/^function\* /, "function ").replace(/\*\[/, "[");
    limpo = limpo.replace(/^(static )?(async )?\*?\s*/, "$1");
    if (/^function\*?\s*$/.test(limpo)) limpo = "function";
    return limpo + "(" + ps.lista + ") {" + ps.pre + "\nconst $self = this;\nreturn $R." + (async ? "stream" : "iteravel") + "((" + gen.replace(/^(async )?function\* \(\)/, "$1function* ()") + ").bind(this));\n}";
  };
  G.blocoJs = function (b, esc, novoEscopo) {
    if (!b) return "";
    var self = this, e2 = novoEscopo ? new Escopo(esc) : esc;
    // funções locais: declara antes (podem ser chamadas antes da linha? não no Dart; mas recursão sim)
    return b.corpo.map(function (s) { return self.stmt(s, e2); }).join("\n");
  };

  /* ---- comandos ---- */
  G.stmt = function (s, esc) {
    var self = this;
    switch (s.k) {
      case "Block": return "{\n" + this.blocoJs(s, esc, true) + "\n}";
      case "Empty": return ";";
      case "ExprStmt": return this.exprStmt(s.expr, esc) + ";" + (s.mais ? s.mais.map(function (x) { return self.expr(x, esc) + ";"; }).join("") : "");
      case "VarDecl": {
        this.checarTipo(s.tipo);
        var kw = "let";
        return s.vars.map(function (v) {
          if (v.nome === "_") return v.init ? "void (" + self.expr(v.init, esc) + ");" : "";
          var tipo = s.tipo || (v.init ? self.tipoDe(v.init, esc) : null);
          var info = { k: "local", js: jsNome(v.nome), tipo: tipo, final: s.final, declTipo: s.tipo, late: s.late, p: v.p, constante: s.constante };
          if (!v.init && !s.late && s.tipo && s.tipo.k === "T" && !s.tipo.nul && s.tipo.nome !== "dynamic" && s.tipo.nome !== "Null" && !(s.tipo.nome === "void")) info.naoAtribuida = true;
          if (!v.init && !s.late && s.final) info.finalSemValor = true;
          if (s.constante && v.init) self.checarConst(v.init, esc);
          var init = v.init ? self.exprT(v.init, esc, s.tipo) : (s.late ? "$R.LATE" : "null");
          if (esc.vars[v.nome] && esc.vars[v.nome].k === "local" && !esc.vars[v.nome].param) self.erro("'" + v.nome + "' is already declared in this scope.", v.p, v.nome.length);
          esc.def(v.nome, info);
          if (s.tipo && v.init) self.checarAtrib(s.tipo, v.init, esc);
          return kw + " " + jsNome(v.nome) + " = " + init + ";";
        }).join(" ");
      }
      case "PatVar": {
        var t = this.temp();
        var vars = [];
        var cond = this.padraoJs(s.padrao, t, esc, vars);
        var decl = vars.map(function (v) { esc.def(v.nome, { k: "local", js: jsNome(v.nome), tipo: v.tipo }); return jsNome(v.nome); });
        return "let " + (decl.length ? decl.join(", ") + ", " : "") + t + " = " + this.expr(s.valor, esc) + "; if (!(" + cond + ")) $R.erroPadrao(" + t + ");";
      }
      case "LocalFun": {
        esc.def(s.nome, { k: "localfun", js: jsNome(s.nome), decl: s });
        var f = this.genFuncao(s, esc, "function " + jsNome(s.nome), this.nomeLocal(esc, s.nome));
        return f;
      }
      case "If": {
        if (s.caso) {
          var t2 = this.temp(), e3 = new Escopo(esc), vs = [];
          var c = this.padraoJs(s.caso, t2, e3, vs);
          vs.forEach(function (v) { e3.def(v.nome, { k: "local", js: jsNome(v.nome), tipo: v.tipo }); });
          return "{ let " + vs.map(function (v) { return jsNome(v.nome) + ", "; }).join("") + t2 + " = " + this.expr(s.cond, esc) + "; if (" + c + ") " + this.stmtBloco(s.entao, e3) + (s.senao ? " else " + this.stmtBloco(s.senao, esc) : "") + " }";
        }
        this.checarBool(s.cond, esc);
        var pv = this.promCond(s.cond, true), pf = this.promCond(s.cond, false);
        var codIf = "if ($R.cond(" + this.expr(s.cond, esc) + ")) " + this.stmtBloco(s.entao, filho(esc, pv)) + (s.senao ? " else " + this.stmtBloco(s.senao, filho(esc, pf)) : "");
        if (s.senao) { var ae = this.atribuidas(s.entao), as2 = this.atribuidas(s.senao); var amb2 = ae.filter(function (x) { return as2.indexOf(x) >= 0 || sai(s.senao); }); if (sai(s.entao)) amb2 = as2; if (amb2.length) { esc.atrib = esc.atrib || {}; amb2.forEach(function (x) { esc.atrib[x] = true; }); } }
        if (sai(s.entao)) esc.promover(pf);
        else if (s.senao && sai(s.senao)) esc.promover(pv);
        return codIf;
      }
      case "While": return "while ($R.cond(" + this.expr(s.cond, esc) + ")) { $R.passo(); " + this.stmtBloco(s.corpo, filho(esc, this.promCond(s.cond, true)), true) + " }";
      case "DoWhile": return "do { $R.passo(); " + this.stmtBloco(s.corpo, esc, true) + " } while ($R.cond(" + this.expr(s.cond, esc) + "));";
      case "For": {
        var e4 = new Escopo(esc);
        var ini = s.init ? this.stmt(s.init, e4) : "";
        var cond = s.cond ? "$R.cond(" + this.expr(s.cond, e4) + ")" : "";
        var upd = s.upd.map(function (u) { return self.exprStmt(u, e4); }).join(", ");
        // cada volta tem a sua variável (closures capturam o valor da volta): "for (let …"
        if (s.init && s.init.k === "VarDecl") ini = "let " + ini.replace(/;\s*let /g, ", ").replace(/^let /, "").replace(/;\s*$/, "");
        else ini = ini.replace(/;\s*$/, "");
        return "for (" + ini + "; " + cond + "; " + upd + ") { $R.passo(); " + this.stmtBloco(s.corpo, e4, true) + " }";
      }
      case "ForIn": {
        var e5 = new Escopo(esc);
        var it = this.expr(s.iter, esc);
        var tipoEl = s.tipo || this.tipoElemento(this.tipoDe(s.iter, esc));
        if (s.padrao) {
          var t3 = this.temp(), vs2 = [];
          var c2 = this.padraoJs(s.padrao, t3, e5, vs2);
          vs2.forEach(function (v) { e5.def(v.nome, { k: "local", js: jsNome(v.nome), tipo: v.tipo }); });
          return "for " + (s.await ? "await " : "") + "(const " + t3 + " of $R." + (s.await ? "iterAsync" : "iter") + "(" + it + ")) { $R.passo(); let " + vs2.map(function (v) { return jsNome(v.nome); }).join(", ") + "; if (!(" + c2 + ")) $R.erroPadrao(" + t3 + "); " + this.stmtBloco(s.corpo, e5, true) + " }";
        }
        e5.def(s.nome, { k: "local", js: jsNome(s.nome), tipo: tipoEl, final: s.final });
        return "for " + (s.await ? "await " : "") + "(let " + jsNome(s.nome) + " of $R." + (s.await ? "iterAsync" : "iter") + "(" + it + ")) { $R.passo(); " + this.stmtBloco(s.corpo, e5, true) + " }";
      }
      case "Label": {
        var lab = "L_" + s.nome;
        var e6 = new Escopo(esc); e6.rotulo = s.nome;
        return lab + ": " + this.stmt(s.corpo, e6);
      }
      case "Break": {
        if (s.rotulo) return "break L_" + s.rotulo + ";";
        var e = esc; while (e) { if (e.loop) break; if (e.sw) return "break " + e.sw + ";"; e = e.pai; }
        return "break;";
      }
      case "Continue": return s.rotulo ? "continue L_" + s.rotulo + ";" : "continue;";
      case "Return": {
        var fe = esc; while (fe && fe.tipo !== "funcao") fe = fe.pai;
        if (!s.valor) return "return;";
        if (fe && fe.gerador) return "return;";
        var rt = fe && fe.ret;
        if (rt && fe.async && rt.k === "T" && (rt.nome === "Future" || rt.nome === "FutureOr") && rt.args.length) rt = rt.args[0];
        if (rt && rt.k === "T" && rt.nome === "void" && s.valor && !s.seta) {
          // retornar valor em função void
        }
        if (fe && !fe.async && fe.ret && fe.ret.k === "T" && fe.ret.nome === "Future" && fe.ret.args.length) return "return $R.futuroT(" + this.exprT(s.valor, esc, rt) + ", " + q(this.tipoTexto(fe.ret.args[0])) + ");";
        return "return " + this.exprT(s.valor, esc, rt) + ";";
      }
      case "Rethrow": { var ce = esc; while (ce && !ce.catchVar) ce = ce.pai; return "throw " + (ce ? ce.catchVar : "$e") + ";"; }
      case "Try": {
        var r = "try " + this.stmtBloco(s.corpo, esc);
        if (s.catches.length) {
          var ev = this.temp();
          var partes = [];
          var e7 = new Escopo(esc); e7.catchVar = ev;
          r += " catch (" + ev + ") { " + ev + " = $R.capturar(" + ev + "); const " + ev + "v = " + ev + ".valor;";
          s.catches.forEach(function (c, i) {
            var ce2 = new Escopo(e7); ce2.catchVar = ev;
            if (c.e) ce2.def(c.e, { k: "local", js: jsNome(c.e), tipo: c.tipo || { k: "T", nome: "Object", args: [] } });
            if (c.st) ce2.def(c.st, { k: "local", js: jsNome(c.st), tipo: { k: "T", nome: "StackTrace", args: [] } });
            var cond = c.tipo ? "$R.is(" + ev + "v, " + self.tipoRt(c.tipo) + ")" : "true";
            partes.push((i ? " else " : " ") + "if (" + cond + ") { " + (c.e ? "let " + jsNome(c.e) + " = " + ev + "v; " : "") + (c.st ? "let " + jsNome(c.st) + " = " + ev + ".pilha(); " : "") + self.blocoJs(c.corpo, ce2, true) + " }");
          });
          r += partes.join("") + " else throw " + ev + "; }";
        }
        if (s.fin) r += " finally " + this.stmtBloco(s.fin, esc);
        return r;
      }
      case "Switch": return this.genSwitch(s, esc);
      case "Assert": return "$R.afirmar(" + this.expr(s.cond, esc) + ", " + (s.msg ? this.expr(s.msg, esc) : "null") + ", " + s.p + ");";
      case "Yield": return s.estrela ? "yield* $R." + (this.dentroAsync(esc) ? "iterAsync" : "iter") + "(" + this.expr(s.valor, esc) + ");" : "yield " + this.expr(s.valor, esc) + ";";
      case "Return": break;
    }
    throw new Error("comando não suportado: " + s.k);
  };
  G.dentroAsync = function (esc) { var e = esc; while (e && e.tipo !== "funcao") e = e.pai; return e && e.async; };
  G.nomeLocal = function (esc, n) {
    var e = esc; while (e && e.tipo !== "funcao") e = e.pai;
    return (e && e.nomeFun ? e.nomeFun + "." : "") + n;
  };
  G.stmtBloco = function (s, esc, loop) {
    var e = new Escopo(esc); if (loop) e.loop = true;
    if (s.k === "Block") return "{\n" + this.blocoJs(s, e, false) + "\n}";
    return "{ " + this.stmt(s, e) + " }";
  };
  G.checarExaustivo = function (alvo, casos, esc, ehExpr, temDefault) {
    if (temDefault) return;
    var t = this.tipoDe(alvo, esc);
    if (!t || t.k !== "T") return;
    var self = this;
    function coringa(p) {
      if (!p) return false;
      if (p.k === "PWild") return !p.tipo || p.tipo.nome === t.nome || p.tipo.nome === "Object" || p.tipo.nome === "dynamic";
      if (p.k === "PVar") return !p.tipo || p.tipo.nome === t.nome || p.tipo.nome === "Object";
      if (p.k === "POr") return coringa(p.a) || coringa(p.b);
      if (p.k === "PAnd") return coringa(p.a) && coringa(p.b);
      return false;
    }
    var semGuarda = casos.filter(function (c) { return !c.guarda && !(c.padrao && c.padrao.k === "PGuard"); });
    if (semGuarda.some(function (c) { return coringa(c.padrao); })) return;
    function consts(p, l) { if (!p) return l; if (p.k === "PConst") l.push(p.valor); else if (p.k === "POr") { consts(p.a, l); consts(p.b, l); } return l; }
    var vals = []; semGuarda.forEach(function (c) { consts(c.padrao, vals); });
    var falta = null, nome = this.tipoTexto(t);
    if (t.nul && !semGuarda.some(function (c) { return c.padrao && c.padrao.k === "PConst" && c.padrao.valor.k === "Null"; })) {
      // tipo anulável: falta o null (se o resto for exaustivo)
    }
    if (t.nome === "bool") {
      var tem = function (b) { return vals.some(function (v) { return v.k === "Bool" && v.v === b; }); };
      if (!tem(true)) falta = "true"; else if (!tem(false)) falta = "false";
    } else if (this.classes[t.nome] && this.classes[t.nome].k === "Enum") {
      var c = this.classes[t.nome];
      var nomes = vals.map(function (v) { return v.k === "Get" && v.alvo.k === "Ident" && v.alvo.nome === t.nome ? v.nome : v.k === "Atalho" ? v.nome : null; });
      var f = c.valores.filter(function (v) { return nomes.indexOf(v.nome) < 0; })[0];
      if (f) falta = t.nome + "." + f.nome;
    } else if (["int", "double", "num", "String"].indexOf(t.nome) >= 0 && ehExpr) {
      falta = t.nome + "()";
    } else if (this.classes[t.nome] && this.classes[t.nome].sealed) {
      var subs = Object.keys(this.classes).filter(function (k) { var x = self.classes[k]; return x.sup && x.sup.nome === t.nome || (x.impls || []).some(function (i) { return i.nome === t.nome; }); });
      var cobre = function (sub) { return semGuarda.some(function (cc) { var p = cc.padrao; return p && ((p.k === "PObj" && p.tipo.nome === sub && p.campos.every(function (f2) { return coringa(f2.pat); })) || ((p.k === "PVar" || p.k === "PWild") && p.tipo && p.tipo.nome === sub)); }); };
      var f3 = subs.filter(function (k) { return !cobre(k); })[0];
      if (f3) falta = f3 + "()";
    }
    if (t.nul && !falta && t.nome !== "dynamic" && !vals.some(function (v) { return v.k === "Null"; }) && (t.nome === "bool" || (this.classes[t.nome] && (this.classes[t.nome].k === "Enum" || this.classes[t.nome].sealed)) || ehExpr)) falta = "null";
    if (!falta) return;
    var kind = ehExpr ? "switch cases" : "switch cases";
    this.erro("The type '" + nome + "' is not exhaustively matched by the switch cases since it doesn't match '" + falta + "'.", alvo.p, 1, "Try adding a wildcard pattern or cases that match '" + falta + "'.");
  };
  G.genSwitch = function (s, esc) {
    var temDef = s.casos.some(function (c) { return c.def; });
    var todosPats = []; s.casos.forEach(function (c) { c.pats.forEach(function (p) { todosPats.push({ padrao: p.padrao, guarda: p.guarda }); }); });
    var ta0 = this.tipoDe(s.alvo, esc);
    if (ta0 && ta0.k === "T" && (ta0.nome === "bool" || (this.classes[ta0.nome] && (this.classes[ta0.nome].k === "Enum" || this.classes[ta0.nome].sealed)))) this.checarExaustivo(s.alvo, todosPats, esc, false, temDef);
    var self = this, sw = "S" + (++this.tmp), t = this.temp();
    var r = sw + ": { const " + t + " = " + this.expr(s.alvo, esc) + ";\n";
    var primeiro = true;
    // casos vazios caem no próximo (case 1: case 2: …)
    var pend = [];
    s.casos.forEach(function (c, i) {
      var conds = [];
      var e = new Escopo(esc); e.sw = sw;
      var vs = [];
      pend = pend.concat(c.pats);
      if (!c.corpo.length && !c.def) return;
      var pats = pend; pend = [];
      pats.forEach(function (pp) {
        var c1 = self.padraoJs(pp.padrao, t, e, vs);
        if (pp.guarda) { vs.forEach(function (v) { e.def(v.nome, { k: "local", js: jsNome(v.nome), tipo: v.tipo }); }); c1 = "(" + c1 + ") && $R.cond(" + self.expr(pp.guarda, e) + ")"; }
        conds.push("(" + c1 + ")");
      });
      vs.forEach(function (v) { e.def(v.nome, { k: "local", js: jsNome(v.nome), tipo: v.tipo }); });
      var cond = c.def ? "true" : conds.join(" || ");
      var decl = vs.length ? "let " + vs.map(function (v) { return jsNome(v.nome); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(", ") + "; " : "";
      r += "{ " + decl + "if (" + cond + ") {\n" + c.corpo.map(function (x) { return self.stmt(x, e); }).join("\n") + "\nbreak " + sw + "; } }\n";
    });
    return r + "}";
  };

  /* ---- padrões → condição JS (que também atribui as variáveis) ---- */
  G.padraoJs = function (p, v, esc, vars) {
    var self = this;
    switch (p.k) {
      case "PWild": return p.tipo ? "$R.is(" + v + ", " + this.tipoRt(p.tipo) + ")" : "true";
      case "PVar": {
        if (vars.filter(function (x) { return x.nome === p.nome; }).length === 0) vars.push({ nome: p.nome, tipo: p.tipo });
        var tst = p.tipo ? "$R.is(" + v + ", " + this.tipoRt(p.tipo) + ") && " : "";
        return "(" + tst + "((" + jsNome(p.nome) + " = " + v + "), true))";
      }
      case "PConst": return "$R.eq(" + v + ", " + this.expr(p.valor, esc) + ")";
      case "PRel": {
        var op = { "==": "eq", "!=": "ne", "<": "lt", ">": "gt", "<=": "le", ">=": "ge" }[p.op];
        return "$R.rel(" + q(op) + ", " + v + ", " + this.expr(p.valor, esc) + ")";
      }
      case "POr": {
        var a = this.padraoJs(p.a, v, esc, vars), b = this.padraoJs(p.b, v, esc, vars);
        return "(" + a + " || " + b + ")";
      }
      case "PAnd": return "(" + this.padraoJs(p.a, v, esc, vars) + " && " + this.padraoJs(p.b, v, esc, vars) + ")";
      case "PGuard": {
        var c = this.padraoJs(p.p, v, esc, vars);
        vars.forEach(function (x) { esc.def(x.nome, { k: "local", js: jsNome(x.nome), tipo: x.tipo }); });
        return "(" + c + " && $R.cond(" + this.expr(p.guarda, esc) + "))";
      }
      case "PNullCheck": { var t = this.temp(); return "(" + v + " != null && " + this.padraoJs(p.p, v, esc, vars) + ")"; }
      case "PNullAssert": return "($R.nc(" + v + ", 0) , " + this.padraoJs(p.p, v, esc, vars) + ")";
      case "PCast": return "($R.as(" + v + ", " + this.tipoRt(p.tipo) + ", 0), " + this.padraoJs(p.p, v, esc, vars) + ")";
      case "PRecord": {
        var nPos = p.campos.filter(function (f) { return f.nome === null; }).length;
        var nomes = p.campos.filter(function (f) { return f.nome !== null; }).map(function (f) { return f.nome; });
        var r = ["$R.ehRecord(" + v + ", " + nPos + ", " + q(nomes) + ")"];
        var i = 0;
        p.campos.forEach(function (f) {
          var acc = f.nome === null ? v + ".pos[" + (i++) + "]" : v + ".nom[" + q(f.nome) + "]";
          r.push(self.padraoJs(f.pat, acc, esc, vars));
        });
        return "(" + r.join(" && ") + ")";
      }
      case "PList": {
        var rest = p.els.findIndex(function (x) { return x.k === "PRest"; });
        var n = p.els.length - (rest >= 0 ? 1 : 0);
        var r2 = ["$R.ehLista(" + v + ", " + n + ", " + (rest >= 0) + ")"];
        p.els.forEach(function (el, i) {
          if (el.k === "PRest") { if (el.p) r2.push(self.padraoJs(el.p, v + ".slice(" + i + ", " + v + ".length - " + (p.els.length - 1 - i) + ")", esc, vars)); return; }
          var idx = rest >= 0 && i > rest ? v + "[" + v + ".length - " + (p.els.length - i) + "]" : v + "[" + i + "]";
          r2.push(self.padraoJs(el, idx, esc, vars));
        });
        return "(" + r2.join(" && ") + ")";
      }
      case "PMap": {
        var r3 = ["$R.ehMapa(" + v + ")"];
        p.ents.forEach(function (en) {
          var k = self.expr(en.chave, esc);
          r3.push(v + ".containsKey(" + k + ")");
          r3.push(self.padraoJs(en.pat, v + ".get(" + k + ")", esc, vars));
        });
        return "(" + r3.join(" && ") + ")";
      }
      case "PObj": {
        var r4 = ["$R.is(" + v + ", " + this.tipoRt(p.tipo) + ")"];
        p.campos.forEach(function (f) {
          r4.push(self.padraoJs(f.pat, "$R.get(" + v + ", " + q(f.nome) + ")", esc, vars));
        });
        return "(" + r4.join(" && ") + ")";
      }
    }
    throw new Error("padrão não suportado: " + p.k);
  };

  /* ---- tipos estáticos (simples: o bastante para os erros mais comuns) ---- */
  function T(nome, args, nul) { return { k: "T", nome: nome, args: args || [], nul: !!nul }; }
  G.tipoDe = function (e, esc) {
    if (!e) return null;
    switch (e.k) {
      case "Num": return T(e.dbl ? "double" : "int");
      case "Str": return T("String");
      case "Bool": return T("bool");
      case "Null": return T("Null");
      case "Paren": return this.tipoDe(e.valor, esc);
      case "Ident": {
        var pr = esc.promovido(e.nome);
        if (pr) { var base = this.tipoDe(Object.assign({}, e, { k: "IdentCru" }), esc); if (pr === true) return base ? Object.assign({}, base, { nul: false }) : null; return pr; }
        return this.tipoDe(Object.assign({}, e, { k: "IdentCru" }), esc);
      }
      case "IdentCru": {
        var i = esc.achar(e.nome);
        if (i && i.k === "local") return i.tipo;
        if (i) return null;
        var c = this.membroImplicito(e.nome, esc);
        if (c && c.tipo) return c.tipo;
        var tp = this.topo[e.nome];
        if (tp && tp.k === "var") return tp.tipo;
        return null;
      }
      case "ListLit": {
        if (e.targs) return T("List", e.targs);
        var el = this.unirTipos(e.els.map(function (x) { return x.k === "Spread" || x.k === "CIf" || x.k === "CFor" || x.k === "CForIn" ? null : this.tipoDe(x, esc); }, this));
        return T("List", el ? [el] : []);
      }
      case "SetLit": return T("Set", e.targs || []);
      case "MapLit": {
        if (e.targs) return T("Map", e.targs);
        var ks = this.unirTipos(e.els.map(function (x) { return x.k === "Par" ? this.tipoDe(x.chave, esc) : null; }, this));
        var vs = this.unirTipos(e.els.map(function (x) { return x.k === "Par" ? this.tipoDe(x.valor, esc) : null; }, this));
        return T("Map", ks && vs ? [ks, vs] : []);
      }
      case "Bin": {
        var a = this.tipoDe(e.a, esc), b = this.tipoDe(e.b, esc);
        var an = a && a.k === "T" && !a.nul ? a.nome : null, bn = b && b.k === "T" && !b.nul ? b.nome : null;
        if (["==", "!=", "<", ">", "<=", ">=", "&&", "||"].indexOf(e.op) >= 0) return T("bool");
        if (e.op === "/") return (an === "int" || an === "double" || an === "num") ? T("double") : null;
        if (e.op === "~/") return (an === "int" || an === "double" || an === "num") ? T("int") : null;
        if (e.op === "??") return b;
        if (an === "String" && e.op === "+") return T("String");
        if (an === "String" && e.op === "*") return T("String");
        if (["+", "-", "*", "%"].indexOf(e.op) >= 0) {
          if (an === "int" && bn === "int") return T("int");
          if ((an === "double" && (bn === "int" || bn === "double" || bn === "num")) || (bn === "double" && (an === "int" || an === "num"))) return T("double");
          if ((an === "num" || bn === "num") && an && bn) return T("num");
        }
        if (["&", "|", "^", "<<", ">>", ">>>"].indexOf(e.op) >= 0 && an === "int") return T("int");
        return null;
      }
      case "Unary": return e.op === "!" ? T("bool") : this.tipoDe(e.valor, esc);
      case "Is": return T("bool");
      case "As": return e.tipo;
      case "Cond": { var x = this.tipoDe(e.a, filho(esc, this.promCond(e.cond, true))), y = this.tipoDe(e.b, filho(esc, this.promCond(e.cond, false))); return this.unirTipos([x, y]); }
      case "Record": return null;
      case "Get": {
        if (e.alvo.k === "Ident" && this.classes[e.alvo.nome] && !esc.achar(e.alvo.nome)) {
          var cE = this.classes[e.alvo.nome];
          if (cE.k === "Enum" && e.nome === "values") return T("List", [T(cE.nome)]);
          if (cE.k === "Enum" && cE.valores.some(function (v) { return v.nome === e.nome; })) return T(cE.nome);
          var mE = this.membrosDe(cE.nome).est[e.nome];
          if (mE && (mE.k === "campo" || mE.k === "get")) return mE.tipo || null;
          return null;
        }
        var at = this.tipoDe(e.alvo, esc);
        if (e.nome === "length" && at && at.k === "T" && ["String", "List", "Set", "Map", "Iterable"].indexOf(at.nome) >= 0) return T("int");
        if ((e.nome === "isEmpty" || e.nome === "isNotEmpty" || e.nome === "isEven" || e.nome === "isOdd") && at && at.k === "T") return T("bool");
        if (at && at.k === "T" && this.classes[at.nome]) {
          var m = this.membrosDe(at.nome);
          var f = m.inst[e.nome];
          if (f && (f.k === "campo" || f.k === "get")) return f.tipo ? Object.assign({}, f.tipo, { nul: f.tipo.nul || !!e.nulo }) : null;
        }
        return null;
      }
      case "Call": {
        if (e.alvo.k === "Ident") {
          var tp2 = this.topo[e.alvo.nome];
          if (!esc.achar(e.alvo.nome) && tp2 && tp2.k === "fun") return tp2.decl.ret && !tp2.decl.async ? tp2.decl.ret : null;
          if (!esc.achar(e.alvo.nome) && tp2 && tp2.k === "classe") return T(e.alvo.nome);
          if (!esc.achar(e.alvo.nome) && !tp2 && /^[A-Z]/.test(e.alvo.nome) && TIPOS_NATIVOS.has(e.alvo.nome) && ["Object", "Function", "List", "Map", "Set", "Future", "Stream", "Iterable"].indexOf(e.alvo.nome) < 0) return T(e.alvo.nome);
          var lf = esc.achar(e.alvo.nome);
          if (lf && lf.k === "localfun") return lf.decl.ret && !lf.decl.async ? lf.decl.ret : null;
        }
        if (e.alvo.k === "Get") {
          var at2 = this.tipoDe(e.alvo.alvo, esc), nm = e.alvo.nome;
          if (at2 && at2.k === "T") {
            if (at2.nome === "String" && ["toUpperCase", "toLowerCase", "trim", "substring", "replaceAll", "padLeft", "padRight", "toString", "trimLeft", "trimRight", "replaceFirst"].indexOf(nm) >= 0) return T("String");
            if (["int", "double", "num", "bool"].indexOf(at2.nome) >= 0 && nm === "toString") return T("String");
            if (["int", "double", "num"].indexOf(at2.nome) >= 0 && (nm === "toStringAsFixed" || nm === "toStringAsPrecision")) return T("String");
            if (at2.nome === "double" && ["round", "floor", "ceil", "toInt", "truncate"].indexOf(nm) >= 0) return T("int");
            if (at2.nome === "int" && nm === "toDouble") return T("double");
            if ((at2.nome === "int" || at2.nome === "double") && nm === "abs") return T(at2.nome);
            if (nm === "contains" || nm === "startsWith" || nm === "endsWith" || nm === "containsKey" || nm === "any" || nm === "every") return T("bool");
            if (this.classes[at2.nome]) {
              var mm = this.membrosDe(at2.nome).inst[nm];
              if (mm && mm.k === "metodo" && mm.decl.ret && !mm.decl.async) return mm.decl.ret;
            }
          }
          if (e.alvo.alvo.k === "Ident" && !esc.achar(e.alvo.alvo.nome)) {
            var cn = e.alvo.alvo.nome;
            if (cn === "int" && (nm === "parse")) return T("int");
            if (cn === "int" && (nm === "tryParse")) return T("int", [], true);
            if (cn === "double" && nm === "parse") return T("double");
            if (cn === "double" && nm === "tryParse") return T("double", [], true);
            if (this.classes[cn]) {
              var ms = this.membrosDe(cn).est[nm];
              if (ms && ms.k === "metodo" && ms.decl.ret && !ms.decl.async) return ms.decl.ret;
              if (!ms) return T(cn); // construtor nomeado
            }
          }
        }
        return null;
      }
      case "New": return T(e.tipo.nome, e.tipo.args);
      case "NotNull": { var t = this.tipoDe(e.valor, esc); return t ? Object.assign({}, t, { nul: false }) : null; }
      case "Assign": return this.tipoDe(e.valor, esc);
      case "Index": {
        var it = this.tipoDe(e.alvo, esc);
        if (it && it.k === "T" && it.nome === "List" && it.args.length === 1) return it.args[0];
        if (it && it.k === "T" && it.nome === "Map" && it.args.length === 2) return Object.assign({}, it.args[1], { nul: true });
        if (it && it.k === "T" && it.nome === "String") return T("String");
        return null;
      }
      case "PostInc": case "PreInc": return this.tipoDe(e.alvo, esc);
      case "Await": { var at3 = this.tipoDe(e.valor, esc); return at3 && at3.k === "T" && at3.nome === "Future" && at3.args.length ? at3.args[0] : null; }
    }
    return null;
  };
  // o que a condição garante quando dá "v" (true/false): { nome: true (não nulo) | tipo }
  G.promCond = function (c, v) {
    var r = {};
    if (!c) return r;
    var self = this;
    if (c.k === "Paren") return this.promCond(c.valor, v);
    if (c.k === "Unary" && c.op === "!") return this.promCond(c.valor, !v);
    if (c.k === "Bin" && (c.op === "!=" || c.op === "==")) {
      var id = c.a.k === "Ident" && c.b.k === "Null" ? c.a : c.b.k === "Ident" && c.a.k === "Null" ? c.b : null;
      if (id && ((c.op === "!=") === v)) r[id.nome] = true;
      return r;
    }
    if (c.k === "Bin" && c.op === "&&" && v) return Object.assign(this.promCond(c.a, true), this.promCond(c.b, true));
    if (c.k === "Bin" && c.op === "||" && !v) return Object.assign(this.promCond(c.a, false), this.promCond(c.b, false));
    if (c.k === "Is" && c.valor.k === "Ident" && (!c.neg) === v) r[c.valor.nome] = c.tipo;
    return r;
  };
  G.atribuidas = function (s) {
    var r = [];
    (function vis(x) {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) { x.forEach(vis); return; }
      if (x.k === "Assign" && x.op === "=" && x.alvo.k === "Ident") r.push(x.alvo.nome);
      if (x.k === "Lambda" || x.k === "LocalFun") return;
      for (var k in x) if (k !== "p" && k !== "e" && x[k] && typeof x[k] === "object") vis(x[k]);
    })(s);
    return r;
  };
  function sai(s) {
    if (!s) return false;
    switch (s.k) {
      case "Return": case "Break": case "Continue": case "Rethrow": return true;
      case "ExprStmt": return s.expr.k === "Throw" || (s.expr.k === "Call" && s.expr.alvo.k === "Ident" && s.expr.alvo.nome === "exit");
      case "Block": return s.corpo.length > 0 && sai(s.corpo[s.corpo.length - 1]);
      case "If": return !!s.senao && sai(s.entao) && sai(s.senao);
    }
    return false;
  }
  G.unirTipos = function (ts) {
    if (!ts.length) return null;
    var r = null, nul = false;
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i];
      if (!t) return null;
      if (t.k === "T" && t.nome === "Null") { nul = true; continue; }
      if (!r) { r = t; continue; }
      if (r.k === "T" && t.k === "T" && r.nome === t.nome && !r.args.length && !t.args.length) { if (t.nul) nul = true; continue; }
      if (r.k === "T" && t.k === "T" && ((r.nome === "int" && t.nome === "double") || (r.nome === "double" && t.nome === "int") || ((r.nome === "num") && (t.nome === "int" || t.nome === "double")))) { r = T("num"); continue; }
      if (r.k === "T" && t.k === "T" && r.nome === "String" !== (t.nome === "String")) { r = T("Object"); continue; }
      return null;
    }
    if (!r) return T("Null");
    return nul ? Object.assign({}, r, { nul: true }) : r;
  };
  G.tipoElemento = function (t) {
    if (t && t.k === "T" && (t.nome === "List" || t.nome === "Set" || t.nome === "Iterable") && t.args.length === 1) return t.args[0];
    return null;
  };
  // erros de compilação mais comuns: atribuir um tipo errado
  var SUBTIPOS = { int: ["num", "Object", "Comparable", "dynamic"], double: ["num", "Object", "Comparable", "dynamic"], num: ["Object", "Comparable", "dynamic"], String: ["Object", "Comparable", "Pattern", "dynamic"], bool: ["Object", "dynamic"], Null: ["dynamic"] };
  G.ehSubclasse = function (a, b) {
    if (a === b) return true;
    var c = this.classes[a]; if (!c) return true;
    if (!this.classes[b] && !SUBTIPOS[b]) return true;
    var sup = [].concat(c.sup ? [c.sup] : [], c.impls || [], c.mixins || [], c.on || []);
    if (c.k === "Enum" && (b === "Enum" || b === "Comparable")) return true;
    for (var i = 0; i < sup.length; i++) { if (!this.classes[sup[i].nome]) { if (sup[i].nome === b) return true; if (!TIPOS_NATIVOS.has(sup[i].nome)) return true; continue; } if (this.ehSubclasse(sup[i].nome, b)) return true; }
    return false;
  };
  G.atribuivel = function (de, para) {
    if (!de || !para || de.k !== "T" || para.k !== "T") return true;
    if (this.tparams.has(para.nome) || this.tparams.has(de.nome)) return true;
    var conhecido = function (n) { return TIPOS_NATIVOS.has(n) || GLOBAIS.has(n) || this.classes[n] || (this.topo[n] && this.topo[n].k === "typedef"); }.bind(this);
    if (!conhecido(para.nome) || !conhecido(de.nome)) return true;
    var tp = this.topo[para.nome]; if (tp && tp.k === "typedef") return true;
    if (para.nome === "dynamic" || para.nome === "Object" && (!de.nul || para.nul)) return true;
    if (de.nome === "Null") return para.nul || para.nome === "dynamic" || para.nome === "Null" || para.nome === "void";
    if (de.nul && !para.nul && para.nome !== "dynamic") return false;
    if (de.nome === para.nome) {
      if (de.args.length && para.args.length && de.args.length === para.args.length) {
        for (var i = 0; i < de.args.length; i++) if (!this.atribuivel(de.args[i], para.args[i]) && !(de.args[i].nome === "int" && para.args[i].nome === "double")) return false;
      }
      return true;
    }
    var s = SUBTIPOS[de.nome];
    if (s) return s.indexOf(para.nome) >= 0 || (para.nome === "FutureOr");
    if (this.classes[de.nome] && (this.classes[para.nome] || SUBTIPOS[para.nome])) return this.ehSubclasse(de.nome, para.nome);
    if (TIPOS_NATIVOS.has(de.nome) && SUBTIPOS[para.nome] && ["Object", "dynamic", "Null", "Function", "Comparable", "Pattern", "FutureOr", "Never"].indexOf(de.nome) < 0) return false;
    return true;
  };
  function offsetDe(e) {
    if (!e) return 0;
    switch (e.k) {
      case "Bin": return e.pOp;
      case "Get": return e.pNome;
      case "Call": return e.alvo.k === "Get" ? e.alvo.pNome : e.alvo.p;
      case "Index": return e.pIdx || e.p;
      case "NotNull": case "As": case "Is": return e.pOp;
      case "Cond": return e.pQ || e.p;
      case "Paren": return offsetDe(e.valor);
      case "Assign": return e.pOp;
    }
    return e.p;
  }
  G.checarAtrib = function (tipo, valor, esc, ehRetorno) {
    if (!tipo || tipo.k !== "T") return;
    var de = this.tipoDe(valor, esc);
    if (!de || de.k !== "T") return;
    if (valor.k === "Num" && !valor.dbl && tipo.nome === "double") return; // 10 → 10.0
    if (valor.k === "ListLit" && !valor.targs || valor.k === "MapLit" && !valor.targs || valor.k === "SetLit") return;
    if (!this.atribuivel(de, tipo)) {
      var ini = offsetDe(valor);
      this.erro("A value of type '" + this.tipoTexto(de) + "' can't be " + (ehRetorno ? "returned from " + ehRetorno : "assigned to a variable of type '" + this.tipoTexto(tipo) + "'") + ".", ini, 1, this.comCtx([de, tipo]));
    }
  };
  G.checarConst = function (e, esc) {
    var self = this;
    function ruim(x) {
      if (!x) return null;
      switch (x.k) {
        case "Num": case "Bool": case "Null": case "Symbol": case "TypeLit": return null;
        case "Str": for (var i = 0; i < x.partes.length; i++) if (typeof x.partes[i] !== "string") { var r = ruim(x.partes[i]); if (r) return r; } return null;
        case "Paren": return ruim(x.valor);
        case "Unary": return ruim(x.valor);
        case "Bin": return ruim(x.a) || ruim(x.b);
        case "Cond": return ruim(x.cond) || ruim(x.a) || ruim(x.b);
        case "Is": case "As": return ruim(x.valor);
        case "ListLit": case "SetLit": case "MapLit": { for (var j = 0; j < x.els.length; j++) { var el = x.els[j]; var r2 = el.k === "Par" ? ruim(el.chave) || ruim(el.valor) : el.k === "Spread" ? ruim(el.valor) : ruim(el); if (r2) return r2; } return null; }
        case "Record": { var r3 = null; x.pos.forEach(function (y) { r3 = r3 || ruim(y); }); x.nom.forEach(function (y) { r3 = r3 || ruim(y.valor); }); return r3; }
        case "Ident": {
          var i2 = esc.achar(x.nome);
          if (i2) return i2.constante ? null : { no: x, msg: "Not a constant expression." };
          var tp = self.topo[x.nome];
          if (tp && tp.k === "var") return tp.constante ? null : { no: x, msg: "Not a constant expression." };
          return null;
        }
        case "Get": {
          if (x.alvo.k === "Ident" && self.classes[x.alvo.nome] && !esc.achar(x.alvo.nome)) return null;
          if (x.nome === "length") return ruim(x.alvo);
          return { no: x, msg: "Not a constant expression." };
        }
        case "New": if (x.constante) return null; return { no: x, msg: "Not a constant expression." };
        case "Call": {
          var a = x.alvo;
          if (a.k === "Get" && a.alvo.k === "Ident" && !esc.achar(a.alvo.nome)) {
            var c = self.classes[a.alvo.nome];
            var ct = c && c.membros.filter(function (d) { return d.k === "Ctor" && d.nome === a.nome; })[0];
            if (ct && ct.constante) return null;
            if (CONST_SDK.has(a.alvo.nome + "." + a.nome)) return null;
            if (c || GLOBAIS.has(a.alvo.nome)) return { no: { p: a.pNome, e: a.pNome + a.nome.length }, msg: "Cannot invoke a non-'const' constructor where a const expression is expected.", extra: "Try using a constructor or factory that is 'const'." };
          }
          if (a.k === "Ident" && !esc.achar(a.nome)) {
            var c2 = self.classes[a.nome];
            var ct2 = c2 && c2.membros.filter(function (d) { return d.k === "Ctor" && d.nome === ""; })[0];
            if (ct2 && ct2.constante) return null;
            if (CONST_SDK.has(a.nome)) return null;
            if (c2 || (GLOBAIS.has(a.nome) && /^[A-Z]/.test(a.nome))) return { no: { p: a.p, e: a.p + a.nome.length }, msg: "Cannot invoke a non-'const' constructor where a const expression is expected.", extra: "Try using a constructor or factory that is 'const'." };
          }
          return { no: x, msg: "Methods can't be invoked in constant expressions." };
        }
      }
      return { no: x, msg: "Not a constant expression." };
    }
    var r = ruim(e);
    if (r) this.erro(r.msg, r.no.p, r.extra ? Math.max(1, (r.no.e || r.no.p + 1) - r.no.p) : 1, r.extra || null);
  };
  G.checarBool = function (cond, esc) {
    var t = this.tipoDe(cond, esc);
    if (t && t.k === "T" && t.nome !== "bool" && t.nome !== "dynamic" && SUBTIPOS[t.nome] && !t.nul) {
      this.erro("A value of type '" + this.tipoTexto(t) + "' can't be assigned to a variable of type 'bool'.", cond.p, 1);
    }
  };

  /* ---- expressões ---- */
  G.exprStmt = function (e, esc) { return this.expr(e, esc); };
  G.exprComThis = function (e, esc, oNome) {
    // nas listas de inicialização, "this" ainda não existe no Dart; usamos o objeto o
    var js = this.expr(e, esc);
    return js;
  };
  G.argsJs = function (a, esc, thisNome) {
    var self = this;
    var l = a.pos.map(function (x) { return self.expr(x, esc); });
    if (a.nom.length) l.push("{" + a.nom.map(function (x) { return q(x.nome) + ": " + self.expr(x.valor, esc); }).join(", ") + "}");
    return l.join(", ");
  };
  G.membroImplicito = function (nome, esc) {
    // dentro de um método: campo/método da classe (ou herdado)
    var e = esc; while (e && !e.classe && !e.extensao) e = e.pai;
    if (!e) return null;
    if (e.extensao) {
      var x = e.extensao;
      var achou = x.membros.filter(function (d) { return d.nome === nome || (d.vars && d.vars.some(function (v) { return v.nome === nome; })); })[0];
      if (achou) return { k: achou.estatico ? "est" : "inst", tipo: achou.ret || achou.tipo, ext: true, decl: achou };
      var tn = x.tipo.k === "T" ? x.tipo.nome : null;
      if (tn && this.classes[tn]) { var mm = this.membrosDe(tn); if (mm.inst[nome]) return { k: "inst", tipo: mm.inst[nome].tipo }; }
      if (tn && TIPO_MEMBROS[tn] && TIPO_MEMBROS[tn].indexOf(nome) >= 0) return { k: "inst" };
      return null;
    }
    var m = this.membrosDe(e.classe.nome);
    if (m.est[nome]) return { k: "est", classe: e.classe.nome, tipo: m.est[nome].tipo };
    if (m.inst[nome]) return { k: "inst", tipo: m.inst[nome].tipo, info: m.inst[nome] };
    // estáticos das superclasses
    var c = e.classe;
    while (c && c.sup && this.classes[c.sup.nome]) { c = this.classes[c.sup.nome]; var ms = this.membrosDe(c.nome); if (ms.est[nome]) return { k: "est", classe: c.nome }; }
    return null;
  };
  var TIPO_MEMBROS = { String: ["length", "isEmpty", "isNotEmpty", "toUpperCase", "toLowerCase", "trim", "split", "contains", "substring", "codeUnits", "runes"], int: ["isEven", "isOdd", "abs", "toDouble", "toString"], List: ["length", "isEmpty", "isNotEmpty", "first", "last", "add", "where", "map", "fold", "reduce", "forEach", "contains", "join", "sort", "reversed"], Iterable: ["length", "isEmpty", "isNotEmpty", "first", "last", "where", "map", "fold", "reduce", "forEach", "contains", "join", "toList"], double: ["round", "floor", "ceil", "abs", "toInt", "toStringAsFixed"], num: ["abs", "round", "toInt", "toDouble"] };

  G.thisJs = function (esc) {
    return "this";
  };
  G.atribuidaAntes = function (n, esc) { var e = esc; while (e) { if (e.atrib && e.atrib[n]) return true; if (n in e.vars) return false; e = e.pai; } return false; };
  G.topoDe = function (n, no) {
    if (no && no.viaPrefixo && no.viaPrefixo.uri) { var pa = this.porArq[no.viaPrefixo.uri.replace(/^\.\//, "")]; if (pa && pa[n]) return pa[n]; }
    var tp = this.topo[n];
    if (tp && tp.ambiguo) {
      var a = no && this.arqDe ? this.arqDe(no.p) : null;
      if (a && this.porArq[a] && this.porArq[a][n]) return this.porArq[a][n];
      if (!no || !no.jaAvisado) { this.erro("'" + n + "' is imported from both '" + tp.arqs[0] + "' and '" + tp.arqs[1] + "'.", no ? no.p : 0, n.length); if (no) no.jaAvisado = true; }
      return { k: "fun", js: "null", decl: null, erro: true };
    }
    return tp;
  };
  G.ident = function (e, esc, chamada) {
    var n = e.nome;
    var i = esc.achar(n);
    if (i) {
      if (i.naoAtribuida && !e.alvoDeAtrib && !this.atribuidaAntes(n, esc)) { this.erro("Non-nullable variable '" + n + "' must be assigned before it can be used.", e.p, n.length); i.naoAtribuida = false; }
      if (i.k === "local" || i.k === "localfun") return i.late ? "$R.lateGet(" + i.js + ", " + q(n) + ")" : i.js;
    }
    var mi = this.membroImplicito(n, esc);
    if (!mi && (n === "runtimeType" || n === "hashCode" || n === "toString") && !this.topo[n]) { var ce = esc; while (ce && !ce.classe) ce = ce.pai; if (ce) return chamada ? "$R.extMetodoThis(this, " + q(n) + ")" : "$R.get(this, " + q(n) + ")"; }
    if (mi) {
      if (mi.k === "est") return "C_" + mi.classe + "." + mNome(n);
      var fe = esc; while (fe && fe.tipo !== "funcao") fe = fe.pai;
      var ee = esc; var estat = false; while (ee) { if (ee.ehEstatico) { estat = true; break; } if (ee.classe || ee.extensao) break; ee = ee.pai; }
      if (estat) { this.erro("Undefined name '" + n + "'.", e.p, n.length); return "null"; }
      if (mi.ext) {
        if (mi.decl && mi.decl.k === "Method") return "$R.extMetodo(this, " + q(n) + ")";
        return "$R.get(this, " + q(n) + ")";
      }
      if (mi.info && mi.info.k === "metodo" && !chamada) return "$R.get(this, " + q(n) + ")";
      return "this." + mNome(n);
    }
    var tp = this.topoDe(n, e);
    if (tp) {
      if (tp.k === "classe") return "C_" + n;
      if (tp.k === "typedef") return "$R.tipo(" + this.tipoRt({ k: "T", nome: n, args: [] }) + ")";
      return tp.js;
    }
    if (GLOBAIS.has(n) && (e.viaPrefixo || this.disponivel(n))) return "$R.g." + n;
    var ex = esc; while (ex && !ex.extensao) ex = ex.pai;
    if (ex) return chamada ? "$R.extMetodoThis(this, " + q(n) + ")" : "$R.get(this, " + q(n) + ")";
    var cm = esc; while (cm && !cm.classe) cm = cm.pai;
    var fm = esc; var estatico = false; while (fm) { if (fm.ehEstatico) estatico = true; if (fm.classe) break; fm = fm.pai; }
    if (chamada && cm && cm.classe && !estatico) { var tC = { k: "T", nome: cm.classe.nome, args: [] }; this.erro("The method '" + n + "' isn't defined for the type '" + cm.classe.nome + "'.", e.p, n.length, this.contexto([tC]) + "\nTry correcting the name to the name of an existing method, or defining a method named '" + n + "'."); return "null"; }
    if (chamada) this.erro("Method not found: '" + n + "'.", e.p, n.length);
    else this.erro("Undefined name '" + n + "'.", e.p, n.length);
    return "null";
  };
  G.lit = function (e) {
    if (e.dbl) { var v = Number(e.v); return e.neg ? "(-" + String(v) + ")" : String(v); }
    var s = e.v;
    var big;
    try { big = BigInt(s); } catch (x) { big = 0n; }
    if (e.neg) big = -big;
    if (big > 9223372036854775807n || big < -9223372036854775808n) {
      this.erro("The integer literal " + (e.neg ? "-" : "") + s + " can't be represented in 64 bits.", e.p, s.length + (e.neg ? 1 : 0));
    }
    return (big < 0n ? "(" + big + "n)" : big + "n");
  };
  G.expr = function (e, esc) {
    var self = this;
    switch (e.k) {
      case "Num": return this.lit(e);
      case "Str": {
        if (e.valor !== null) return q(e.valor);
        return "(" + e.partes.map(function (p) { return typeof p === "string" ? q(p) : "$R.str(" + self.expr(p, esc) + ")"; }).join(" + ") + ")";
      }
      case "Bool": return String(e.v);
      case "Null": return "null";
      case "This": return this.thisJs(esc);
      case "Paren": return "(" + this.expr(e.valor, esc) + ")";
      case "Ident": return this.ident(e, esc, false);
      case "Symbol": return "$R.simbolo(" + q(e.nome) + ")";
      case "TypeLit": return "$R.tipo(" + this.tipoRt(e.tipo) + ")";
      case "ListLit": {
        var tsL = e.targs || e.targsCtx;
        if (tsL) e.els.forEach(function (x) { x.tipoEl = tsL[0]; });
        var tA = tsL ? this.tipoRt(tsL[0]) : this.tipoRt(this.tipoElemento(this.tipoDe(e, esc)));
        if (e.els.some(function (x) { return x.k === "Spread" || x.k === "CIf" || x.k === "CFor" || x.k === "CForIn" || x.k === "NulEl"; }))
          return (e.targs && e.targs[0].k === "T" && e.targs[0].nome === "double" ? "$R.DL(" : "(") + "$R.lista($R.colecao((l) => {" + e.els.map(function (x) { return self.elemAdd(x, esc, "l"); }).join(" ") + "}), " + tA + (e.constante ? ", true" : "") + "))";
        var lista = "$R.lista([" + e.els.map(function (x) { return self.elemColecao(x, esc, "l"); }).join(", ") + "], " + tA + (e.constante ? ", true" : "") + ")";
        if (e.targs && e.targs[0].k === "T" && e.targs[0].nome === "double") return "$R.DL(" + lista + ")";
        return lista;
      }
      case "SetLit": {
        var tsS = e.targs || e.targsCtx;
        if (tsS) e.els.forEach(function (x) { x.tipoEl = tsS[0]; });
        return "$R.conjunto($R.colecao((l) => {" + e.els.map(function (x) { return self.elemAdd(x, esc, "l"); }).join(" ") + "}), " + (e.targs ? this.tipoRt(e.targs[0]) : "null") + (e.constante ? ", true" : "") + ")";
      }
      case "MapLit": {
        var tsM = e.targs || e.targsCtx;
        if (tsM) e.els.forEach(function (x) { x.tipoChave = tsM[0]; x.tipoEl = tsM[1]; });
        var tt = e.targs ? "[" + this.tipoRt(e.targs[0]) + ", " + this.tipoRt(e.targs[1]) + "]" : "null";
        return "$R.mapa($R.colecao((l) => {" + e.els.map(function (x) { return self.elemAdd(x, esc, "l", true); }).join(" ") + "}), " + tt + (e.constante ? ", true" : "") + ")";
      }
      case "Record": {
        return "$R.record([" + e.pos.map(function (x) { return self.expr(x, esc); }).join(", ") + "], {" + e.nom.map(function (x) { return q(x.nome) + ": " + self.expr(x.valor, esc); }).join(", ") + "})";
      }
      case "Bin": return this.bin(e, esc);
      case "Unary": {
        var v = this.expr(e.valor, esc);
        if (e.op === "!") return "!$R.cond(" + v + ")";
        if (e.op === "-") return "$R.neg(" + v + ")";
        return "$R.inv(" + v + ")";
      }
      case "Is": return (e.neg ? "!" : "") + "$R.is(" + this.expr(e.valor, esc) + ", " + this.tipoRt(e.tipo) + ")";
      case "As": return "$R.as(" + this.expr(e.valor, esc) + ", " + this.tipoRt(e.tipo) + ", " + e.pOp + ")";
      case "Cond": this.checarBool(e.cond, esc); return "($R.cond(" + this.expr(e.cond, esc) + ") ? " + this.expr(e.a, filho(esc, this.promCond(e.cond, true))) + " : " + this.expr(e.b, filho(esc, this.promCond(e.cond, false))) + ")";
      case "NotNull": return "$R.nc(" + this.expr(e.valor, esc) + ", " + e.pOp + ")";
      case "Throw": return "$R.lancar(" + this.expr(e.valor, esc) + ", " + e.p + ")";
      case "Await": return "$R.retomou($f, await $R.aguardar(" + this.expr(e.valor, esc) + ", $f, " + e.p + "))";
      case "Get": return this.get(e, esc);
      case "Index": {
        var a = this.expr(e.alvo, esc), i = this.expr(e.indice, esc);
        return "$R.idx(" + a + ", " + i + ", " + (e.pIdx || e.p) + (e.nulo ? ", true" : "") + ")";
      }
      case "Call":
        if (e.alvo.k === "Atalho") return "$R.chamarF($R.atalho(" + q(e.alvo.nome) + ", null, " + e.p + ", true), [" + this.argsArr(e.args, esc) + "], " + q(e.alvo.nome) + ", " + e.p + ")";
        return this.call(e, esc);
      case "New": {
        var cn = e.tipo.nome;
        if (this.classes[cn]) return "$R.cf(" + e.p + ", C_" + cn + "." + (e.ctor ? mNome(e.ctor) : "$new") + ", [" + this.argsJs(e.args, esc) + "])";
        return "$R.criar(" + q(cn) + ", " + q(e.ctor) + ", [" + this.argsArr(e.args, esc) + "], " + this.tipoRt(e.tipo) + ", " + e.p + ")";
      }
      case "Lambda": {
        var fe = new Escopo(esc, "funcao"); fe.nomeFun = this.nomeLocal(esc, "<anonymous closure>"); fe.async = e.async; fe.gerador = e.gerador; fe.ret = e.retEsperado || null;
        var ps = this.paramsJs(e.params, fe);
        var corpo = this.blocoJs(e.corpo, fe, true);
        if (e.gerador) return "((" + ps.lista + ") => {" + ps.pre + " return $R." + (e.async ? "stream" : "iteravel") + "((" + (e.async ? "async " : "") + "function* () {" + corpo + "}).bind(this)); })";
        return "$R.fn(" + (e.async ? "async " : "") + "(" + ps.lista + ") => {" + ps.pre + " const $f = $R.entrar(" + q(fe.nomeFun) + "); try {\n" + corpo + "\n} finally { $R.sair($f); } })";
      }
      case "Assign": return this.assign(e, esc);
      case "PostInc": case "PreInc": {
        var op = e.op === "++" ? "add" : "sub";
        var alvo = e.alvo;
        if (alvo.k === "Ident") {
          var js = this.ident(alvo, esc, false);
          var info = esc.achar(alvo.nome);
          if (info && info.final) this.erro("Can't assign to the final variable '" + alvo.nome + "'.", alvo.p, alvo.nome.length);
          if (e.k === "PreInc") return "(" + js + " = $R." + op + "(" + js + ", 1n))";
          var t = this.temp();
          return "((" + t + " = " + js + "), " + js + " = $R." + op + "(" + t + ", 1n), " + t + ")";
        }
        return "$R.incr(" + this.lvalue(alvo, esc) + ", " + q(op) + ", " + (e.k === "PreInc") + ")";
      }
      case "Cascade": {
        var t2 = this.temp();
        var e2 = new Escopo(esc); e2.cascata = t2;
        return "((" + t2 + ") => { " + (e.nulo ? "if (" + t2 + " == null) return null; " : "") + e.secs.map(function (s) { return self.expr(s, e2) + ";"; }).join(" ") + " return " + t2 + "; })(" + this.expr(e.alvo, esc) + ")";
      }
      case "CascadeAlvo": { var ce = esc; while (ce && !ce.cascata) ce = ce.pai; return ce.cascata; }
      case "SwitchExpr": {
        this.checarExaustivo(e.alvo, e.casos.map(function (c) { return { padrao: c.padrao, guarda: c.guarda }; }), esc, true);
        var t3 = this.temp();
        var partes = e.casos.map(function (c) {
          var e3 = new Escopo(esc), vs = [];
          var cond = self.padraoJs(c.padrao, t3, e3, vs);
          vs.forEach(function (v) { e3.def(v.nome, { k: "local", js: jsNome(v.nome), tipo: v.tipo }); });
          if (c.guarda) cond = "(" + cond + ") && $R.cond(" + self.expr(c.guarda, e3) + ")";
          return "{ " + (vs.length ? "let " + vs.map(function (v) { return jsNome(v.nome); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(", ") + "; " : "") + "if (" + cond + ") return " + self.expr(c.valor, e3) + "; }";
        });
        return "((" + t3 + ") => { " + partes.join(" ") + " return $R.semCaso(" + t3 + ", " + e.p + "); })(" + this.expr(e.alvo, esc) + ")";
      }
      case "Super": return "super";
      case "Atalho": return "$R.atalho(" + q(e.nome) + ", " + (e.tipoCtx ? q(e.tipoCtx) : "null") + ", " + e.p + ")";
    }
    throw new Error("expressão não suportada: " + e.k);
  };
  G.elemColecao = function (x, esc) { if (x.tipoEl && x.k !== "NulEl" && x.k !== "Spread" && x.k !== "Par") this.checarAtrib(x.tipoEl, x, esc); return x.tipoEl ? this.exprT(x, esc, x.tipoEl) : this.expr(x, esc); };
  G.elemAdd = function (x, esc, l, mapa) {
    var self = this;
    if (x.tipoEl || x.tipoChave) ["a", "b", "corpo"].forEach(function (k) { if (x[k] && typeof x[k] === "object") { x[k].tipoEl = x[k].tipoEl || x.tipoEl; x[k].tipoChave = x[k].tipoChave || x.tipoChave; } });
    switch (x.k) {
      case "Spread": return "$R.espalhar(" + l + ", " + this.expr(x.valor, esc) + ", " + !!x.nulo + ");";
      case "CIf": {
        if (x.caso) {
          var t = this.temp(), e3 = new Escopo(esc), vs = [];
          var c = this.padraoJs(x.caso, t, e3, vs);
          vs.forEach(function (v) { e3.def(v.nome, { k: "local", js: jsNome(v.nome) }); });
          return "{ let " + vs.map(function (v) { return jsNome(v.nome) + ", "; }).join("") + t + " = " + this.expr(x.cond, esc) + "; if (" + c + ") { " + this.elemAdd(x.a, e3, l, mapa) + " }" + (x.b ? " else { " + this.elemAdd(x.b, esc, l, mapa) + " }" : "") + " }";
        }
        return "if ($R.cond(" + this.expr(x.cond, esc) + ")) { " + this.elemAdd(x.a, esc, l, mapa) + " }" + (x.b ? " else { " + this.elemAdd(x.b, esc, l, mapa) + " }" : "");
      }
      case "CForIn": {
        var e5 = new Escopo(esc);
        if (x.padrao) {
          var t4 = this.temp(), vs2 = [];
          var c2 = this.padraoJs(x.padrao, t4, e5, vs2);
          vs2.forEach(function (v) { e5.def(v.nome, { k: "local", js: jsNome(v.nome) }); });
          return "for (const " + t4 + " of $R.iter(" + this.expr(x.iter, esc) + ")) { let " + vs2.map(function (v) { return jsNome(v.nome); }).join(", ") + "; " + c2 + "; " + this.elemAdd(x.corpo, e5, l, mapa) + " }";
        }
        e5.def(x.nome, { k: "local", js: jsNome(x.nome), tipo: this.tipoElemento(this.tipoDe(x.iter, esc)) });
        return "for (let " + jsNome(x.nome) + " of $R.iter(" + this.expr(x.iter, esc) + ")) { " + this.elemAdd(x.corpo, e5, l, mapa) + " }";
      }
      case "CFor": {
        var e4 = new Escopo(esc);
        var ini = x.init ? this.stmt(x.init, e4) : "";
        return "{ " + ini + " for (; " + (x.cond ? "$R.cond(" + this.expr(x.cond, e4) + ")" : "") + "; " + x.upd.map(function (u) { return self.expr(u, e4); }).join(", ") + ") { " + this.elemAdd(x.corpo, e4, l, mapa) + " } }";
      }
      case "Par": return l + ".push([" + (x.tipoChave ? this.exprT(x.chave, esc, x.tipoChave) : this.expr(x.chave, esc)) + ", " + (x.tipoEl ? this.exprT(x.valor, esc, x.tipoEl) : this.expr(x.valor, esc)) + "]);";
      case "NulEl": { var tn = this.temp(); return "if ((" + tn + " = " + this.expr(x.valor, esc) + ") != null) " + l + ".push(" + tn + ");"; }
    }
    return l + ".push(" + this.elemColecao(x, esc) + ");";
  };
  var OPS_JS = { "+": "add", "-": "sub", "*": "mul", "/": "div", "%": "mod", "~/": "idiv", "<": "lt", ">": "gt", "<=": "le", ">=": "ge", "&": "and", "|": "or", "^": "xor", "<<": "shl", ">>": "shr", ">>>": "ushr" };
  G.bin = function (e, esc) {
    var a = this.expr(e.a, esc), b;
    if (e.op === "&&") { b = this.expr(e.b, filho(esc, this.promCond(e.a, true))); return "($R.cond(" + a + ") && $R.cond(" + b + "))"; }
    if (e.op === "||") { b = this.expr(e.b, filho(esc, this.promCond(e.a, false))); return "($R.cond(" + a + ") || $R.cond(" + b + "))"; }
    if (e.op === "??") { b = this.expr(e.b, esc); return "(" + a + " ?? " + b + ")"; }
    b = this.expr(e.b, esc);
    if (e.op === "==") return "$R.eq(" + a + ", " + b + ")";
    if (e.op === "!=") return "!$R.eq(" + a + ", " + b + ")";
    // erros de tipo comuns: "texto" + 1, int + String
    var ta = this.tipoDe(e.a, esc), tb = this.tipoDe(e.b, esc);
    if (ta && tb && ta.k === "T" && tb.k === "T" && !ta.nul && !tb.nul) {
      if (ta.nome === "String" && e.op === "*" && tb.nome !== "int" && SUBTIPOS[tb.nome])
        this.erro("A value of type '" + this.tipoTexto(tb) + "' can't be assigned to a variable of type 'int'.", offsetDe(e.b), 1);
      else if (ta.nome === "String" && e.op === "+" && tb.nome !== "String" && SUBTIPOS[tb.nome])
        this.erro("A value of type '" + this.tipoTexto(tb) + "' can't be assigned to a variable of type 'String'.", e.b.p, 1);
      else if ((ta.nome === "int" || ta.nome === "double" || ta.nome === "num") && tb.nome === "String" && ["+", "-", "*", "/"].indexOf(e.op) >= 0)
        this.erro("A value of type 'String' can't be assigned to a variable of type 'num'.", e.b.p, 1);
    }
    if (ta && ta.k === "T" && ta.nul && ["+", "-", "*", "/", "<", ">", "<=", ">=", "~/", "%"].indexOf(e.op) >= 0 && ta.nome !== "dynamic") {
      this.erro("Operator '" + e.op + "' cannot be called on '" + this.tipoTexto(ta) + "' because it is potentially null.", e.pOp, e.op.length);
    }
    return "$R." + OPS_JS[e.op] + "(" + a + ", " + b + ", " + (e.op === "~/" || e.op === "%" ? e.pOp : offsetDe(e.b)) + ")";
  };
  G.get = function (e, esc) {
    var nome = e.nome;
    if (e.alvo.k === "Ident" && this.prefixo(e.alvo.nome, esc)) return this.ident({ k: "Ident", nome: nome, p: e.pNome, viaPrefixo: true }, esc, false);
    if (e.alvo.k === "Super") return "super." + mNome(nome);
    // Classe.estatico / Enum.valor / prefixo.algo
    if (e.alvo.k === "Ident" && !esc.achar(e.alvo.nome) && !this.membroImplicito(e.alvo.nome, esc)) {
      var cn = e.alvo.nome;
      if (this.classes[cn]) {
        var m = this.membrosDe(cn);
        var c = this.classes[cn];
        if (m.est[nome] || (c.k === "Enum" && c.valores.some(function (v) { return v.nome === nome; }))) return "C_" + cn + "." + mNome(nome);
        if (c.membros.some(function (d) { return d.k === "Ctor" && d.nome === nome; })) return "C_" + cn + "." + mNome(nome);
        // estático herdado não existe no Dart
        this.erro("Member not found: '" + cn + "." + nome + "'.", e.pNome, nome.length);
        return "null";
      }
      if (!this.topo[cn] && GLOBAIS.has(cn) && !VALORES_GLOBAIS.has(cn)) return "$R.estatico(" + q(cn) + ", " + q(nome) + ", " + e.pNome + ")";
    }
    var alvo = this.expr(e.alvo, esc);
    this.checarNulo(e, esc);
    this.checarMembro(e, esc);
    if (e.nulo) return "$R.nget(" + alvo + ", " + q(nome) + ", " + e.pNome + ")";
    if (e.alvo.k === "This") return "$R.get(this, " + q(nome) + ", " + e.pNome + ")";
    return "$R.get(" + alvo + ", " + q(nome) + ", " + e.pNome + ")";
  };
  G.checarNulo = function (e, esc) {
    if (e.nulo) return;
    var t = this.tipoDe(e.alvo, esc);
    if (t && t.k === "T" && t.nul && t.nome !== "dynamic" && t.nome !== "Null" && e.nome !== "toString" && e.nome !== "hashCode" && e.nome !== "runtimeType") {
      this.erro("Property '" + e.nome + "' cannot be accessed on '" + this.tipoTexto(t) + "' because it is potentially null.", e.pNome, e.nome.length, "Try accessing using ?. instead.");
    }
  };
  G.checarNuloCall = function (e, esc) {
    var g = e.alvo;
    if (g.nulo) return;
    var t = this.tipoDe(g.alvo, esc);
    if (t && t.k === "T" && t.nul && t.nome !== "dynamic" && t.nome !== "Null" && g.nome !== "toString") {
      this.erro("Method '" + g.nome + "' cannot be called on '" + this.tipoTexto(t) + "' because it is potentially null.", g.pNome, g.nome.length, "Try calling using ?. instead.");
      return true;
    }
  };
  G.checarMembro = function (e, esc, chamada) {
    var t = this.tipoDe(e.alvo, esc);
    if (t && t.k === "T" && t.nome === "Object" && ["toString", "hashCode", "runtimeType", "noSuchMethod"].indexOf(e.nome) < 0 && !this.extensoes.some(function (x) { return x.membros.some(function (d) { return d.nome === e.nome; }); })) {
      if (chamada) this.erro("The method '" + e.nome + "' isn't defined for the type '" + (t.nul ? "Object?" : "Object") + "'.", e.pNome, e.nome.length, " - 'Object' is from 'dart:core'.\nTry correcting the name to the name of an existing method, or defining a method named '" + e.nome + "'.");
      else this.erro("The getter '" + e.nome + "' isn't defined for the type '" + (t.nul ? "Object?" : "Object") + "'.", e.pNome, e.nome.length, " - 'Object' is from 'dart:core'.\nTry correcting the name to the name of an existing getter, or defining a getter or field named '" + e.nome + "'.");
      return;
    }
    if (t && t.k === "T" && !t.nul && MEMBROS_CORE[t.nome] && !this.classes[t.nome]) {
      var lista = MEMBROS_CORE[t.nome];
      if (lista.indexOf(e.nome) >= 0 || MEMBROS_OBJ.indexOf(e.nome) >= 0) return;
      if (this.extensoes.some(function (x) { return x.membros.some(function (d) { return d.nome === e.nome || (d.vars && d.vars.some(function (v) { return v.nome === e.nome; })); }); })) return;
      var tn1 = this.tipoTexto(t), cx1 = this.contexto([t]);
      if (chamada) this.erro("The method '" + e.nome + "' isn't defined for the type '" + tn1 + "'.", e.pNome, e.nome.length, (cx1 ? cx1 + "\n" : "") + "Try correcting the name to the name of an existing method, or defining a method named '" + e.nome + "'.");
      else this.erro("The getter '" + e.nome + "' isn't defined for the type '" + tn1 + "'.", e.pNome, e.nome.length, (cx1 ? cx1 + "\n" : "") + "Try correcting the name to the name of an existing getter, or defining a getter or field named '" + e.nome + "'.");
      return;
    }
    if (!t || t.k !== "T" || !this.classes[t.nome]) return;
    var m = this.membrosDe(t.nome);
    var c = this.classes[t.nome];
    if (e.nome.charAt(0) === "_" && this.arqDe && c.arq && this.arqDe(e.pNome) !== c.arq) {
      var tn0 = this.tipoTexto(t), ctx0 = this.contexto([t]);
      if (chamada) this.erro("The method '" + e.nome + "' isn't defined for the type '" + tn0 + "'.", e.pNome, e.nome.length, ctx0 + "\nTry correcting the name to the name of an existing method, or defining a method named '" + e.nome + "'.");
      else if (e.setter) this.erro("The setter '" + e.nome + "' isn't defined for the type '" + tn0 + "'.", e.pNome, e.nome.length, ctx0 + "\nTry correcting the name to the name of an existing setter, or defining a setter or field named '" + e.nome + "'.").ordemPos = e.ordemPos;
      else this.erro("The getter '" + e.nome + "' isn't defined for the type '" + tn0 + "'.", e.pNome, e.nome.length, ctx0 + "\nTry correcting the name to the name of an existing getter, or defining a getter or field named '" + e.nome + "'.");
      return;
    }
    if (m.inst[e.nome]) return;
    if (["toString", "hashCode", "runtimeType", "noSuchMethod"].indexOf(e.nome) >= 0) return;
    if (c.k === "Enum" && (e.nome === "index" || e.nome === "name")) return;
    // extensões
    if (this.extensoes.some(function (x) { return x.membros.some(function (d) { return d.nome === e.nome; }); })) return;
    // superclasses que não são do usuário
    var cc = c; while (cc && cc.sup) { if (!this.classes[cc.sup.nome]) return; cc = this.classes[cc.sup.nome]; }
    if (c.impls && c.impls.some(function (i) { return !this.classes[i.nome]; }, this)) return;
    if (c.mixins && c.mixins.some(function (i) { return !this.classes[i.nome]; }, this)) return;
    var tn = this.tipoTexto(t);
    if (chamada) this.erro("The method '" + e.nome + "' isn't defined for the type '" + tn + "'.", e.pNome, e.nome.length, this.contexto([t]) + "\nTry correcting the name to the name of an existing method, or defining a method named '" + e.nome + "'.");
    else this.erro("The getter '" + e.nome + "' isn't defined for the type '" + tn + "'.", e.pNome, e.nome.length, this.contexto([t]) + "\nTry correcting the name to the name of an existing getter, or defining a getter or field named '" + e.nome + "'.");
  };
  G.argsArr = function (a, esc) {
    var self = this;
    var l = a.pos.map(function (x) { return self.expr(x, esc); });
    if (a.nom.length) l.push("$R.nomeados({" + a.nom.map(function (x) { return q(x.nome) + ": " + self.expr(x.valor, esc); }).join(", ") + "})");
    return l.join(", ");
  };
  G.call = function (e, esc) {
    var a = e.alvo, self = this;
    this._esc = esc;
    if (a.k === "Get" && a.alvo.k === "Ident" && this.prefixo(a.alvo.nome, esc)) {
      var im = this.prefixo(a.alvo.nome, esc);
      var e2 = Object.assign({}, e, { alvo: { k: "Ident", nome: a.nome, p: a.pNome, e: a.pNome + a.nome.length, viaPrefixo: im } });
      return this.call(e2, esc);
    }
    var pos = e.p;
    if (a.k === "Ident") {
      var n = a.nome;
      var i = esc.achar(n);
      if (!i) {
        var mi = this.membroImplicito(n, esc);
        if (mi) {
          if (mi.k === "est") return "$R.cf(" + pos + ", C_" + mi.classe + "." + mNome(n) + ", [" + this.argsJs(e.args, esc) + "])";
          if (mi.ext) return "$R.chamar(this, " + q(n) + ", [" + this.argsArr(e.args, esc) + "], " + a.p + ")";
          return "$R.chamar(this, " + q(n) + ", [" + this.argsArr(e.args, esc) + "], " + a.p + ")";
        }
        var tp = this.topoDe(n, a);
        if (tp && tp.erro) return "null";
        if (tp && tp.k === "classe") {
          var cl = this.classes[n];
          if (cl.abstrata && !cl.membros.some(function (d) { return d.k === "Ctor" && d.fabrica && !d.nome; })) this.erro("The class '" + n + "' is abstract and can't be instantiated.", a.p, n.length);
          if (cl.k === "Enum") this.erro("Enums can't be instantiated.", a.p, n.length);
          this.checarArgsCtor(cl, "", e);
          return "$R.cf(" + pos + ", C_" + n + ".$new, [" + this.argsJs(e.args, esc) + "])";
        }
        if (tp && tp.k === "fun") {
          this.checarArgs(tp.decl, e, n);
          return "$R.cf(" + pos + ", " + tp.js + ", [" + this.argsCoagidos(tp.decl.params, e.args, esc) + "])";
        }
        var exc = esc; while (exc && !exc.extensao) exc = exc.pai;
        if (!tp && !GLOBAIS.has(n) && exc) return "$R.chamar(this, " + q(n) + ", [" + this.argsArr(e.args, esc) + "], " + a.p + ")";
        if (!tp && GLOBAIS.has(n) && !a.viaPrefixo && !this.disponivel(n)) { this.erro("Method not found: '" + n + "'.", a.p, n.length); return "null"; }
        if (!tp && GLOBAIS.has(n)) return "$R.global(" + q(n) + ", [" + this.argsArr(e.args, esc) + "], " + (e.targs ? this.tipoRt(e.targs[0]) : "null") + ", " + pos + ")";
      }
      if (i && i.k === "localfun") { this.checarArgs(i.decl, e, n); return "$R.cf(" + pos + ", " + i.js + ", [" + this.argsJs(e.args, esc) + "])"; }
      var f = this.ident(a, esc, true);
      return "$R.chamarF(" + f + ", [" + this.argsArr(e.args, esc) + "], " + q(n) + ", " + pos + ")";
    }
    if (a.k === "Get") {
      var nome = a.nome;
      if (a.alvo.k === "Super") return "($R.at(" + pos + "), super." + mNome(nome) + "(" + this.argsJs(e.args, esc) + "))";
      if (a.alvo.k === "Ident" && !esc.achar(a.alvo.nome) && !this.membroImplicito(a.alvo.nome, esc)) {
        var cn = a.alvo.nome;
        if (this.classes[cn]) {
          var c = this.classes[cn], m = this.membrosDe(cn);
          if (m.est[nome]) return "$R.cf(" + a.pNome + ", C_" + cn + "." + mNome(nome) + ", [" + this.argsJs(e.args, esc) + "])";
          if (c.membros.some(function (d) { return d.k === "Ctor" && d.nome === nome; })) return "$R.cf(" + a.pNome + ", C_" + cn + "." + mNome(nome) + ", [" + this.argsJs(e.args, esc) + "])";
          this.erro("Member not found: '" + cn + "." + nome + "'.", a.pNome, nome.length);
          return "null";
        }
        if (!this.topo[cn] && GLOBAIS.has(cn) && !VALORES_GLOBAIS.has(cn)) return "$R.criar(" + q(cn) + ", " + q(nome) + ", [" + this.argsArr(e.args, esc) + "], null, " + a.pNome + ")";
      }
      var alvo = this.expr(a.alvo, esc);
      // tipo esperado das funções passadas a métodos de coleções (orElse: () => -1 numa List<double> dá -1.0)
      var tr0 = this.tipoDe(a.alvo, esc);
      if (tr0 && tr0.k === "T" && tr0.args && tr0.args.length) {
        var tEl = tr0.args[tr0.args.length - 1];
        if (["firstWhere", "lastWhere", "singleWhere"].indexOf(nome) >= 0) e.args.nom.forEach(function (x) { if (x.nome === "orElse" && x.valor.k === "Lambda") x.valor.retEsperado = tEl; });
        if (tr0.nome === "Map" && nome === "putIfAbsent" && e.args.pos[1] && e.args.pos[1].k === "Lambda") e.args.pos[1].retEsperado = tEl;
        if (tr0.nome === "Map" && nome === "update") { if (e.args.pos[1] && e.args.pos[1].k === "Lambda") e.args.pos[1].retEsperado = tEl; e.args.nom.forEach(function (x) { if (x.nome === "ifAbsent" && x.valor.k === "Lambda") x.valor.retEsperado = tEl; }); }
        if ((tr0.nome === "List" || tr0.nome === "Set") && (nome === "add" || nome === "contains" || nome === "indexOf" || nome === "remove") && e.args.pos[0] && e.args.pos[0].k === "Num" && tEl.k === "T" && tEl.nome === "double") e.args.pos[0].dbl = true;
      }
      if (!this.checarNuloCall(e, esc)) this.checarMembro(a, esc, true);
      return "$R." + (a.nulo ? "nchamar" : "chamar") + "(" + alvo + ", " + q(nome) + ", [" + this.argsArr(e.args, esc) + "], " + a.pNome + ")";
    }
    var f2 = this.expr(a, esc);
    return "$R.chamarF(" + f2 + ", [" + this.argsArr(e.args, esc) + "], null, " + pos + ")";
  };
  G.argsCoagidos = function (ps, a, esc) {
    var self = this;
    var todos = ps.pos.concat(ps.opc);
    var l = a.pos.map(function (x, i) { var p = todos[i]; return p ? self.exprT(x, esc, p.tipo) : self.expr(x, esc); });
    if (a.nom.length) l.push("{" + a.nom.map(function (x) { var p = ps.nomeados.filter(function (y) { return chaveNom(y) === x.nome; })[0]; return q(x.nome) + ": " + (p ? self.exprT(x.valor, esc, p.tipo) : self.expr(x.valor, esc)); }).join(", ") + "}");
    return l.join(", ");
  };
  G.checarArgs = function (d, e, nome, cl) {
    var ps = d.params, a = e.args;
    var ctx = d.k === "Function" || d.k === "LocalFun" ? { msg: "Found this candidate, but the arguments don't match.", pos: d.pNome, len: d.nome.length } : d.padrao && cl ? { msg: "The class '" + cl.nome + "' has a constructor that takes no arguments.", pos: cl.pNome, len: 1 } : null;
    var self0 = this;
    var tipoP = function (p) { return p.tipo || (p.campo && cl ? (self0.membrosDe(cl.nome).inst[p.nome] || {}).tipo : null); };
    var min = ps.pos.length, max = ps.pos.length + ps.opc.length;
    var self = this;
    if (a.pos.length < min) {
      this.erro("Too few positional arguments: " + min + " required, " + a.pos.length + " given.", a.p, 1, null, ctx);
      return;
    }
    if (a.pos.length > max) {
      this.erro("Too many positional arguments: " + max + " allowed, but " + a.pos.length + " found.", a.p, 1, "Try removing the extra positional arguments.", ctx);
      return;
    }
    a.pos.forEach(function (x, i) { var p = ps.pos[i] || ps.opc[i - ps.pos.length]; var tp = p && tipoP(p); if (tp) self.checarArgTipo(tp, x, self._esc); });
    a.nom.forEach(function (x) { var p = ps.nomeados.filter(function (y) { return chaveNom(y) === x.nome; })[0]; var tp = p && tipoP(p); if (tp) self.checarArgTipo(tp, x.valor, self._esc); });
    var semNome = a.nom.filter(function (x) { return !ps.nomeados.some(function (p) { return chaveNom(p) === x.nome; }); })[0];
    if (semNome) { self.erro("No named parameter with the name '" + semNome.nome + "'.", semNome.p, semNome.nome.length, null, ctx); return; }
    ps.nomeados.forEach(function (p) {
      if (p.obrig && !a.nom.some(function (x) { return x.nome === chaveNom(p); })) self.erro("Required named parameter '" + chaveNom(p) + "' must be provided.", a.p, 1);
    });
  };
  G.checarArgTipo = function (tipo, x, esc) {
    if (!tipo || tipo.k !== "T") return;
    var de = this.tipoDe(x, esc || new Escopo(null));
    if (!de || de.k !== "T") return;
    if (x.k === "Num" && !x.dbl && tipo.nome === "double") return;
    if (x.k === "ListLit" || x.k === "MapLit" || x.k === "SetLit") return;
    if (!this.atribuivel(de, tipo)) this.erro("The argument type '" + this.tipoTexto(de) + "' can't be assigned to the parameter type '" + this.tipoTexto(tipo) + "'.", offsetDe(x), 1, this.comCtx([de, tipo]));
  };
  G.checarArgsCtor = function (cl, nome, e) {
    var k = cl.membros.filter(function (d) { return d.k === "Ctor" && d.nome === nome; })[0];
    if (!k) { if (!cl.membros.some(function (d) { return d.k === "Ctor"; })) k = { params: { pos: [], opc: [], nomeados: [] }, padrao: true }; else return; }
    this.checarArgs(k, e, cl.nome, cl);
  };
  G.lvalue = function (alvo, esc) {
    // devolve um objeto {g: getter, s: setter} em JS
    if (alvo.k === "Get") {
      var o = alvo.alvo.k === "Ident" && this.classes[alvo.alvo.nome] && !esc.achar(alvo.alvo.nome) ? "C_" + alvo.alvo.nome : this.expr(alvo.alvo, esc);
      var t = this.temp();
      if (o.indexOf("C_") === 0) return "{ g: () => " + o + "." + mNome(alvo.nome) + ", s: (v) => " + o + "." + mNome(alvo.nome) + " = v }";
      return "((" + t + ") => ({ g: () => $R.get(" + t + ", " + q(alvo.nome) + "), s: (v) => $R.set(" + t + ", " + q(alvo.nome) + ", v) }))(" + o + ")";
    }
    if (alvo.k === "Index") {
      var t2 = this.temp(), t3 = this.temp();
      return "((" + t2 + ", " + t3 + ") => ({ g: () => $R.idx(" + t2 + ", " + t3 + ", " + alvo.p + "), s: (v) => $R.setIdx(" + t2 + ", " + t3 + ", v, " + alvo.p + ") }))(" + this.expr(alvo.alvo, esc) + ", " + this.expr(alvo.indice, esc) + ")";
    }
    if (alvo.k === "Ident") {
      var js = this.ident(alvo, esc, false);
      return "{ g: () => " + js + ", s: (v) => " + js + " = v }";
    }
    throw new ErroDart("Can't assign to this.", alvo.p, 1);
  };
  G.assign = function (e, esc) {
    var alvo = e.alvo, self = this;
    var op = e.op;
    var tipoAlvo = null;
    if (alvo.k === "Ident") {
      var info = esc.achar(alvo.nome);
      alvo.alvoDeAtrib = op === "=";
      if (op === "=") { esc.atrib = esc.atrib || {}; esc.atrib[alvo.nome] = true; if (info && info.naoAtribuida) { var eT = esc; while (eT && !(alvo.nome in eT.vars)) eT = eT.pai; if (eT === esc) info.naoAtribuida = false; } }
      if (info && info.k === "local") {
        tipoAlvo = info.declTipo || info.tipo;
        if (info.final && !(info.late && op === "=")) this.erro("Can't assign to the final variable '" + alvo.nome + "'.", alvo.p, alvo.nome.length);
        if (info.final && info.late) { }
      } else if (!info) {
        var mi = this.membroImplicito(alvo.nome, esc);
        if (mi) tipoAlvo = mi.tipo;
        else if (this.topo[alvo.nome] && this.topo[alvo.nome].k === "var") { tipoAlvo = this.topo[alvo.nome].tipo; if (this.topo[alvo.nome].final) this.erro("Can't assign to the final variable '" + alvo.nome + "'.", alvo.p, alvo.nome.length); }
      }
      if (op === "=" && tipoAlvo) this.checarAtrib(tipoAlvo, e.valor, esc);
      var js = this.ident(alvo, esc, false);
      if (info && info.late) js = info.js;
      var v = this.expr(e.valor, esc);
      var tv = this.tipoDe(e.valor, esc);
      if (op === "??=" || (op === "=" && tv && tv.k === "T" && !tv.nul && tv.nome !== "Null")) { var mm = {}; mm[alvo.nome] = true; esc.promover(mm); }
      else if (op === "=") { var mm2 = {}; mm2[alvo.nome] = null; esc.promover(mm2); }
      if (op === "=") return "(" + js + " = " + this.coagir(v, tipoAlvo, e.valor) + ")";
      if (op === "??=") return "(" + js + " ??= " + v + ")";
      if (op === "&&=" || op === "||=") return "(" + js + " " + op + " " + v + ")";
      var bop = OPS_JS[op.slice(0, -1)];
      if (tipoAlvo && tipoAlvo.k === "T" && ["+", "-", "*", "/", "%", "~/"].indexOf(op.slice(0, -1)) >= 0) {
        var tr = this.tipoDe({ k: "Bin", op: op.slice(0, -1), a: alvo, b: e.valor, p: alvo.p, pOp: e.pOp }, esc);
        if (tr && tr.k === "T" && !this.atribuivel(tr, tipoAlvo)) this.erro("A value of type '" + this.tipoTexto(tr) + "' can't be assigned to a variable of type '" + this.tipoTexto(tipoAlvo) + "'.", e.pOp, 1, this.comCtx([tr, tipoAlvo]));
      }
      return "(" + js + " = " + this.coagir("$R." + bop + "(" + js + ", " + v + ", " + (bop === "idiv" || bop === "mod" ? e.pOp : offsetDe(e.valor)) + ")", tipoAlvo) + ")";
    }
    if (alvo.k === "Get" && op === "=") {
      if (alvo.alvo.k === "CascadeAlvo" || alvo.alvo.k !== "Ident" || esc.achar(alvo.alvo.nome) || !this.classes[alvo.alvo.nome]) {
        var tobj = this.tipoDe(alvo.alvo, esc), tcampo = null;
        if (tobj && tobj.k === "T" && this.classes[tobj.nome]) { var mf = this.membrosDe(tobj.nome).inst[alvo.nome]; if (mf) { tcampo = mf.tipo; if (mf.final || (mf.k === "get" && !mf.setter) || mf.k === "metodo") this.erro("The setter '" + alvo.nome + "' isn't defined for the type '" + this.tipoTexto(tobj) + "'.", alvo.pNome, alvo.nome.length, this.contexto([tobj]) + "\nTry correcting the name to the name of an existing setter, or defining a setter or field named '" + alvo.nome + "'.").ordemPos = e.valor.e; } }
        if (alvo.alvo.k === "This") { var mi2 = this.membroImplicito(alvo.nome, esc); if (mi2) tcampo = mi2.tipo; }
        this.checarNulo(alvo, esc);
        if (alvo.nome.charAt(0) === "_") this.checarMembro(Object.assign({}, alvo, { setter: true, ordemPos: e.valor.e }), esc);
        if (tcampo) this.checarAtrib(tcampo, e.valor, esc);
        return "$R." + (alvo.nulo ? "nset" : "set") + "(" + this.expr(alvo.alvo, esc) + ", " + q(alvo.nome) + ", " + this.coagir(this.expr(e.valor, esc), tcampo) + ", " + alvo.pNome + ")";
      }
      return "(C_" + alvo.alvo.nome + "." + mNome(alvo.nome) + " = " + this.expr(e.valor, esc) + ")";
    }
    if (alvo.k === "Index" && op === "=") {
      return "$R.setIdx(" + this.expr(alvo.alvo, esc) + ", " + this.expr(alvo.indice, esc) + ", " + this.expr(e.valor, esc) + ", " + (alvo.pIdx || alvo.p) + ")";
    }
    var lv = this.lvalue(alvo, esc);
    var v2 = this.expr(e.valor, esc);
    if (op === "??=") return "$R.atribNulo(" + lv + ", () => " + v2 + ")";
    if (op === "&&=" || op === "||=") return "$R.atribLog(" + lv + ", " + q(op) + ", () => " + v2 + ")";
    return "$R.atribOp(" + lv + ", " + q(OPS_JS[op.slice(0, -1)]) + ", " + v2 + ", " + e.pOp + ")";
  };

  /* ===================================================================
     4. Compilar: fonte → JS (ou erros no formato do dart run)
     =================================================================== */
  function linhaCol(src, p) {
    var l = 1, ini = 0;
    for (var i = 0; i < p && i < src.length; i++) if (src[i] === "\n") { l++; ini = i + 1; }
    return { l: l, c: p - ini + 1, ini: ini };
  }
  function formatarErro(arq, src, e) {
    var lc = linhaCol(src, e.pos);
    var fimLinha = src.indexOf("\n", lc.ini); if (fimLinha < 0) fimLinha = src.length;
    var linha = src.slice(lc.ini, fimLinha);
    var r = arq + ":" + lc.l + ":" + lc.c + ": " + (e.rotulo || "Error") + ": " + e.msg + "\n";
    if (e.extra) r += e.extra + "\n";
    if (e.pos >= src.length && e.len === 0) {
      // fim do arquivo
      return r;
    }
    r += linha + "\n" + " ".repeat(lc.c - 1) + "^".repeat(Math.max(1, Math.min(e.len, linha.length - lc.c + 1))) + "\n";
    return r;
  }
  function deslocar(toks, base) {
    toks.forEach(function (t) { t.p += base; t.e += base; if (t.partes) t.partes.forEach(function (x) { if (typeof x !== "string") { x.p += base; deslocar(x.toks, base); } }); });
    return toks;
  }
  function compilar(src, arq, outros) {
    arq = arq || "main.dart"; outros = outros || {};
    var fontes = [{ nome: arq, src: src, base: 0 }], combinado = src, prog = [];
    function fonteDe(p) { for (var i = fontes.length - 1; i >= 0; i--) if (p >= fontes[i].base) return fontes[i]; return fontes[0]; }
    function erroFmt(e) {
      var f = fonteDe(e.pos); var e2 = new ErroDart(e.msg, e.pos - f.base, e.len, e.extra); e2.rotulo = e.rotulo;
      var r = formatarErro(f.nome, f.src, e2);
      if (e.ctx) [].concat(e.ctx).forEach(function (cx) { var c = new ErroDart(cx.msg, cx.pos, cx.len, null); c.rotulo = "Context"; r += erroFmt(c); });
      return r;
    }
    var incluidos = {}; incluidos[arq] = true;
    ERROS_LEX.length = 0;
    var imports = [];
    var errosRec = [];
    try {
      var fila = [{ nome: arq, src: src, base: 0 }];
      while (fila.length) {
        var f = fila.shift();
        var toks = deslocar(lexer(f.src), f.base);
        // como o CFE: falta de ";" no fim da linha vira erro e a análise continua (o ";" é "inserido")
        var ds = null;
        for (var volta = 0; ; volta++) {
          try { ds = new Parser(toks.slice(), combinado).parseProgram(); break; }
          catch (e) {
            if (!(e instanceof ErroDart) || e.msg !== "Expected ';' after this." || volta > 30) throw e;
            var k = -1;
            for (var j = 0; j < toks.length; j++) if (toks[j].p === e.pos) k = j;
            if (k < 0 || !toks[k + 1] || !(toks[k + 1].nl || toks[k + 1].t === "eof" || (toks[k + 1].t === "op" && toks[k + 1].v === "}"))) throw e;
            toks.splice(k + 1, 0, { t: "op", v: ";", p: toks[k].e, e: toks[k].e, virtual: true });
            errosRec.push(e);
          }
        }
        ds.forEach(function (d) {
          if (d.k === "Import") imports.push(d);
          if (d.k === "Import" && d.uri && !/^(dart|package):/.test(d.uri)) {
            var nome = d.uri.replace(/^\.\//, "");
            if (incluidos[nome]) return;
            if (!Object.prototype.hasOwnProperty.call(outros, nome)) throw new ErroDart("Error when reading '" + nome + "': No such file or directory", d.p + 7, d.uri.length + 2);
            incluidos[nome] = true;
            var base = combinado.length + 1;
            combinado += "\n" + outros[nome];
            var nf = { nome: nome, src: outros[nome], base: base };
            fontes.push(nf); fila.push(nf);
            return;
          }
          if (d.k === "Import" && d.uri && /^package:/.test(d.uri)) throw new ErroDart("Couldn't resolve the package '" + d.uri.replace(/^package:/, "").split("/")[0] + "' in '" + d.uri + "'.", d.p + 7, d.uri.length + 2);
          d.arq = f.nome;
          prog.push(d);
        });
      }
    } catch (e) {
      if (e instanceof ErroDart) { var todos = ERROS_LEX.slice().concat(errosRec); todos.push(e); todos.sort(function (a, b) { return a.pos - b.pos; }); return { erros: todos.map(erroFmt).join(""), n: todos.length }; }
      throw e;
    }
    var g = new Gerador(prog, combinado, arq);
    g.arqDe = function (p) { return fonteDe(p).nome; };
    g.imports = imports;
    g.arqPrincipal = arq;
    ERROS_LEX.forEach(function (e) { e.lex = true; g.erros.push(e); });
    errosRec.forEach(function (e) { g.erros.push(e); });
    var js;
    try { js = g.gerar(); }
    catch (e) {
      if (e instanceof ErroDart) g.erros.push(e); else throw e;
    }
    if (g.erros.length) {
      var vistos = {};
      var errs = g.erros.filter(function (x) { var k = x.pos + x.msg; if (vistos[k]) return false; vistos[k] = 1; return true; });
      var fase = function (x) {
        if (x.lex) return 0;
        if (x.fase !== undefined) return x.fase;
        if (/^(Undefined name|Method not found|Member not found|Setter not found|Getter not found|'.*' isn't a type|Type '.*' not found|'.*' can't be used as an identifier|Expected|Can't find|Unexpected|'.*' is imported from both|Error when reading|Couldn't resolve|Too (few|many) positional|Required named parameter|No named parameter|Not a constant expression|Cannot invoke a non-'const'|Methods can't be invoked in constant)/.test(x.msg)) return 1;
        return 2;
      };
      var posOrd = function (x) { return x.ordemPos !== undefined && x.ordemPos !== null ? x.ordemPos : x.pos; };
      errs.sort(function (a, b) { return fase(a) - fase(b) || posOrd(a) - posOrd(b); });
      var semMain = errs.filter(function (x) { return x.extra === "semMain"; });
      if (semMain.length && errs.length === 1) return { erros: arq + ": Error: Undefined name 'main'.\n", n: 1 };
      errs = errs.filter(function (x) { return x.extra !== "semMain"; });
      return { erros: errs.map(erroFmt).join(""), n: errs.length };
    }
    return { js: js, linhaCol: function (p) { var f = fonteDe(p); var r = linhaCol(f.src, p - f.base); r.arq = f.nome; return r; } };
  }

  var Motor = { VERSAO: VERSAO, compilar: compilar, lexer: lexer, Parser: Parser, ErroDart: ErroDart, linhaCol: linhaCol };
  if (typeof module === "object" && module.exports) module.exports = Motor;
  else raiz.DartMotor = Motor;
})(typeof self !== "undefined" ? self : this);
