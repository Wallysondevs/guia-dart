/* =====================================================================
   runtime.js — a biblioteca do Dart do editor (dart:core, dart:io,
   dart:math, dart:async, dart:convert, só o que o guia usa).
   int = BigInt (64 bits, como no Dart nativo), double = number,
   String = string, List = Array, Map = DMap, Set = DSet.
   ===================================================================== */
(function (raiz) {
  "use strict";
  var MIN64 = -(1n << 63n), MAX64 = (1n << 63n) - 1n;
  function w64(x) { return (x > MAX64 || x < MIN64) ? BigInt.asIntN(64, x) : x; }

  function criarRuntime(ctx) {
    // ctx: { escrever(t, s), lerLinha() → string|null, args, arquivo, agora(), sorteio }
    var R = {};
    var g = R.g = {};
    var ARQ = ctx.arquivo || "main.dart";
    var HOME = "/home/ana/";

    /* ---------- sinais internos (não são exceções do Dart) ---------- */
    function Sinal(tipo, v) { this.tipo = tipo; this.v = v; }
    R.Sinal = Sinal;
    var parado = false;
    R.parar = function () { parado = true; };

    /* ---------- pilha (para o stack trace) ---------- */
    var pilha = [];
    var raizFrame = { n: "main", p: 0 };
    R.entrar = function (n) { if (parado) throw new Sinal("parado"); var f = { n: n, p: 0 }; pilha.push(f); if (pilha.length > 9000) { pilha.length = 0; throw new Lancado(new (classeBase("StackOverflowError"))(), [], true); } return f; };
    R.sair = function (f) { var i = pilha.lastIndexOf(f); if (i >= 0) pilha.length = i; };
    function topo() { return pilha.length ? pilha[pilha.length - 1] : raizFrame; }
    R.at = function (p) { topo().p = p; };
    var passos = 0;
    R.passo = function () { if (++passos > 5e6) { passos = 0; if (parado) throw new Sinal("parado"); } };

    function lc(p) { return ctx.linhaCol ? ctx.linhaCol(p) : { l: 0, c: 0 }; }
    function fotoPilha() { return pilha.map(function (f) { return { n: f.n, p: f.p, async: f.async }; }); }
    function formatarPilha(frames, nativos, async) {
      var linhas = [], k = 0;
      (nativos || []).forEach(function (n) { linhas.push(pad("#" + (k++)) + n); });
      for (var i = frames.length - 1; i >= 0; i--) {
        var f = frames[i], c = lc(f.p);
        linhas.push(pad("#" + (k++)) + f.n + " (file://" + HOME + (c.arq || ARQ) + ":" + c.l + ":" + c.c + ")");
        if (f.async) { linhas.push("<asynchronous suspension>"); }
      }
      if (!async && !frames.some(function (f) { return f.async; })) {
        linhas.push(pad("#" + (k++)) + "_delayEntrypointInvocation.<anonymous closure> (dart:isolate-patch/isolate_patch.dart:313:19)");
        linhas.push(pad("#" + (k++)) + "_RawReceivePort._handleMessage (dart:isolate-patch/isolate_patch.dart:192:12)");
      }
      return linhas.join("\n") + "\n";
    }
    function pad(s) { while (s.length < 8) s += " "; return s; }

    /* ---------- exceções ---------- */
    function Lancado(valor, nativos, assincrono) {
      this.valor = valor; this.frames = fotoPilha(); this.nativos = nativos || []; this.assincrono = !!assincrono;
    }
    Lancado.prototype.pilha = function () { var t = this; return new DStackTrace(formatarPilha(t.frames, t.nativos)); };
    R.Lancado = Lancado;
    R.lancar = function (v, p) {
      if (v === null || v === undefined) { topo().p = p; throw new Lancado(erroTipo("Throw of null.")); }
      topo().p = p; throw new Lancado(v);
    };
    function lancarErro(v, p, nativos) { if (p !== undefined && p !== null) topo().p = p; throw new Lancado(v, nativos); }
    R.lancarErro = lancarErro;
    R.capturar = function (e) {
      if (e instanceof Sinal) throw e;
      if (e instanceof Lancado) return e;
      // erro do JavaScript: vira um erro do Dart (ou é um bug do editor)
      if (e instanceof RangeError && /call stack/.test(e.message)) { var so = new Lancado(new (classeBase("StackOverflowError"))()); return so; }
      if (e && e.$dart) return new Lancado(e.$dart);
      throw e;
    };
    function DStackTrace(t) { this.t = t; }
    DStackTrace.prototype.toString = function () { return this.t; };

    /* ---------- classes base ---------- */
    function DObject() {}
    DObject.prototype.m_toString = function () { return "Instance of '" + (this.$nome || "Object") + "'"; };
    Object.defineProperty(DObject.prototype, "m_hashCode", { get: function () { if (!this.$hash) this.$hash = BigInt(Math.floor(Math.random() * 1073741823)); return this.$hash; }, configurable: true });
    Object.defineProperty(DObject.prototype, "m_runtimeType", { get: function () { return new DTipo({ n: this.$nome || "Object" }); }, configurable: true });
    DObject.prototype.$campos = function () {};
    DObject.$i_$ = function () {};
    DObject.$nome = "Object"; DObject.prototype.$nome = "Object";
    DObject.$impl = [];
    R.DObject = DObject;

    function DEnum() {}
    DEnum.prototype = Object.create(DObject.prototype); DEnum.prototype.constructor = DEnum;
    DEnum.$i_$ = function () {};
    DEnum.prototype.m_toString = function () { return this.$nome + "." + this.m_name; };
    R.DEnum = DEnum;
    R.enumValor = function (C, nome, i, init) {
      var o = Object.create(C.prototype); o.m_name = nome; o.m_index = BigInt(i);
      if (o.$campos) o.$campos();
      o.$iniciado = C; init(o); return o;
    };
    Object.defineProperty(DEnum.prototype, "m_hashCode", { get: function () { return this.m_index; } });

    R.mixin = function (base) {
      var C = class extends base {};
      for (var i = 1; i < arguments.length; i++) {
        var M = arguments[i];
        var cadeia = []; var pr = M.prototype;
        while (pr && pr !== DObject.prototype && pr !== Object.prototype) { cadeia.unshift(pr); pr = Object.getPrototypeOf(pr); }
        cadeia.forEach(function (pp) {
          Object.getOwnPropertyNames(pp).forEach(function (k) { if (k !== "constructor" && k !== "$nome") Object.defineProperty(C.prototype, k, Object.getOwnPropertyDescriptor(pp, k)); });
        });
        var camposMixin = M.prototype.$campos, camposBase = Object.getPrototypeOf(C.prototype).$campos;
        C.prototype.$campos = function () { if (camposBase) camposBase.call(this); if (camposMixin) camposMixin.call(this); };
        C.$impl = (C.$impl || []).concat([M.$nome], M.$impl || []);
        base = C; C = class extends base {};
      }
      return base;
    };

    // classes do dart:core que o usuário pode estender ou criar
    var BASES = {};
    function defBase(nome, sup, toStr, init) {
      var S = sup ? BASES[sup] : DObject;
      var C = class extends S {};
      C.$nome = nome; C.prototype.$nome = nome; C.$impl = [];
      if (toStr) C.prototype.m_toString = toStr;
      C.$i_$ = init || function (o, msg) { if (msg !== undefined) o.m_message = msg; else if (o.m_message === undefined) o.m_message = null; };
      C.$new = function () { var o = Object.create(C.prototype); C.$i_$.apply(null, [o].concat([].slice.call(arguments))); return o; };
      BASES[nome] = C;
      return C;
    }
    function classeBase(n) { if (BASES[n]) return BASES[n]; return defBase(n, null); }
    R.classeBase = classeBase;
    defBase("Exception", null, function () { return this.m_message == null ? "Exception" : "Exception: " + str(this.m_message); });
    defBase("Error", null, function () { return "Instance of '" + this.$nome + "'"; }, function (o) {});
    Object.defineProperty(BASES.Error.prototype, "m_stackTrace", { get: function () { return this.$pilha || null; }, configurable: true });
    defBase("StateError", "Error", function () { return "Bad state: " + str(this.m_message); });
    defBase("ArgumentError", "Error", function () {
      if (this.$valorInv !== undefined) return "Invalid argument" + (this.m_name ? " (" + this.m_name + ")" : "") + ": " + (this.m_message != null ? str(this.m_message) + ": " : "") + strArg(this.$valorInv);
      return this.m_message == null ? "Invalid argument(s)" : "Invalid argument(s): " + str(this.m_message);
    });
    function strArg(v) { return typeof v === "string" ? '"' + v + '"' : str(v); }
    defBase("RangeError", "ArgumentError", function () {
      if (this.$texto) return this.$texto;
      return "RangeError: " + str(this.m_message);
    });
    defBase("IndexError", "RangeError");
    defBase("FormatException", null, function () {
      var r = "FormatException";
      if (this.m_message != null && this.m_message !== "") r += ": " + str(this.m_message);
      if (this.$extra) r += this.$extra;
      return r;
    }, function (o, msg, fonte, off) { o.m_message = msg === undefined ? "" : msg; o.m_source = fonte === undefined ? null : fonte; o.m_offset = off === undefined ? null : off; if (fonte != null && typeof fonte === "string") o.$extra = "\n" + fonte; });
    defBase("UnsupportedError", "Error", function () { return "Unsupported operation: " + str(this.m_message); });
    defBase("UnimplementedError", "UnsupportedError", function () { return this.m_message == null ? "UnimplementedError" : "UnimplementedError: " + str(this.m_message); });
    defBase("TypeError", "Error", function () { return this.$texto || "Instance of 'TypeError'"; });
    defBase("NoSuchMethodError", "Error", function () { return this.$texto; });
    defBase("IntegerDivisionByZeroException", null, function () { return "IntegerDivisionByZeroException"; }, function () {});
    defBase("ConcurrentModificationError", "Error", function () { return "Concurrent modification during iteration: " + str(this.m_modifiedObject) + "."; }, function (o, m) { o.m_modifiedObject = m; });
    defBase("StackOverflowError", "Error", function () { return "Stack Overflow"; }, function () {});
    defBase("AssertionError", "Error", function () { return "Assertion failed"; });
    defBase("LateInitializationError", "Error", function () { return "LateInitializationError: " + this.m_message; });
    defBase("TimeoutException", null, function () { return "TimeoutException" + (this.m_duration ? " after " + str(this.m_duration) : "") + (this.m_message ? ": " + this.m_message : ""); });
    defBase("FileSystemException", null, function () { return "FileSystemException: " + this.m_message + (this.m_path ? ", path = '" + this.m_path + "'" : "") + (this.$os ? " (" + this.$os + ")" : ""); }, function (o, m, p) { o.m_message = m || ""; o.m_path = p || null; });
    defBase("PathNotFoundException", "FileSystemException", function () { return "PathNotFoundException: " + this.m_message + ", path = '" + this.m_path + "' (OS Error: No such file or directory, errno = 2)"; }, function (o, p, m) { o.m_path = p; o.m_message = m || "Cannot open file"; });
    function erroTipo(t) { var o = new (BASES.TypeError)(); o.$texto = t; return o; }
    function erroEstado(m) { var o = new (BASES.StateError)(); o.m_message = m; return o; }
    function erroUnsup(m) { var o = new (BASES.UnsupportedError)(); o.m_message = m; return o; }
    function erroFormato(m, fonte, extra) { var o = new (BASES.FormatException)(); o.m_message = m; o.m_source = fonte; if (extra !== undefined) o.$extra = extra; return o; }
    function erroRange(texto) { var o = new (BASES.RangeError)(); o.$texto = texto; return o; }
    function erroArg(m) { var o = new (BASES.ArgumentError)(); o.m_message = m; return o; }
    function erroIndice(i, len, nome) {
      var o = new (BASES.IndexError)();
      o.$texto = len === 0 ? "RangeError (" + (nome || "length") + "): Invalid value: Valid value range is empty: " + str(i) : "RangeError (" + (nome || "length") + "): Invalid value: Not in inclusive range 0.." + (len - 1) + ": " + str(i);
      return o;
    }
    R.erroAbstrata = function (n) { lancarErro(erroTipo("Cannot instantiate abstract class " + n)); };

    /* ---------- tipos ---------- */
    function DTipo(d) { this.d = d; }
    DTipo.prototype.m_toString = function () { return tipoTexto(this.d); };
    DTipo.prototype.$eq = function (o) { return o instanceof DTipo && tipoTexto(o.d) === tipoTexto(this.d); };
    R.tipo = function (d) { return new DTipo(d); };
    function tipoTexto(d) { if (!d) return "dynamic"; return d.n + (d.a ? "<" + d.a.map(tipoTexto).join(", ") + ">" : "") + (d.nul ? "?" : ""); }
    function tipoDe(v) {
      if (v === null || v === undefined) return { n: "Null" };
      switch (typeof v) {
        case "bigint": return { n: "int" };
        case "number": return { n: "double" };
        case "string": return { n: "String" };
        case "boolean": return { n: "bool" };
        case "function": return { n: "Function" };
      }
      if (Array.isArray(v)) return { n: "List", a: [v.$t || { n: "dynamic" }] };
      if (v instanceof DMap) return { n: "_Map", a: v.$t || [{ n: "dynamic" }, { n: "dynamic" }] };
      if (v instanceof DSet) return { n: "_Set", a: [v.$t || { n: "dynamic" }] };
      if (v instanceof DRecord) return { n: "(" + v.pos.map(function (x) { return tipoTexto(tipoDe(x)); }).join(", ") + (Object.keys(v.nom).length ? ", {" + Object.keys(v.nom).map(function (k) { return tipoTexto(tipoDe(v.nom[k])) + " " + k; }).join(", ") + "}" : "") + ")" };
      if (v instanceof Promise) return { n: "Future", a: [{ n: "dynamic" }] };
      if (v instanceof DIteravel) return { n: "Iterable", a: [{ n: "dynamic" }] };
      if (v.$nome) return { n: v.$nome };
      return { n: "Object" };
    }
    R.tipoDe = tipoDe;
    function nomeTipo(v) { var d = tipoDe(v); if (d.n === "List") return "List<" + tipoTexto(d.a[0]) + ">"; if (d.n === "_Map") return "_Map<" + d.a.map(tipoTexto).join(", ") + ">"; if (d.n === "_Set") return "_Set<" + tipoTexto(d.a[0]) + ">"; return tipoTexto(d); }
    function ehSub(C, nome) {
      // a classe JS C (ou suas superclasses/interfaces) tem o nome?
      var p = C;
      while (p && p !== Object && p !== Function.prototype) {
        if (p.$nome === nome) return true;
        if (p.$impl && p.$impl.some(function (n) { if (n === nome) return true; var CI = ctx.classes && ctx.classes[n]; return CI ? ehSub(CI, nome) : (BASES[n] ? ehSub(BASES[n], nome) : false); })) return true;
        p = Object.getPrototypeOf(p);
      }
      return false;
    }
    function is(v, d) {
      if (!d) return true;
      if (typeof d === "string") d = { n: d };
      var n = d.n;
      if (v === null || v === undefined) return !!d.nul || n === "Null" || n === "dynamic" || n === "void";
      switch (n) {
        case "dynamic": case "Object": case "void": return true;
        case "int": return typeof v === "bigint";
        case "double": return typeof v === "number";
        case "num": return typeof v === "bigint" || typeof v === "number";
        case "String": return typeof v === "string";
        case "bool": return typeof v === "boolean";
        case "Function": return typeof v === "function";
        case "Null": return false;
        case "List": return Array.isArray(v) && (!d.a || elementosSao(v, d.a[0]));
        case "Map": return v instanceof DMap;
        case "Set": return v instanceof DSet;
        case "Iterable": return Array.isArray(v) || v instanceof DSet || v instanceof DIteravel;
        case "Record": return v instanceof DRecord;
        case "Future": case "FutureOr": return v instanceof Promise || n === "FutureOr";
        case "Stream": return v instanceof DStream;
        case "Comparable": return typeof v === "bigint" || typeof v === "number" || typeof v === "string" || (v.m_compareTo !== undefined);
        case "Pattern": return typeof v === "string" || v instanceof DRegExp;
        case "Enum": return v instanceof DEnum;
        case "Exception": if (v instanceof BASES.FormatException || v instanceof BASES.IntegerDivisionByZeroException || v instanceof BASES.TimeoutException || v instanceof BASES.FileSystemException) return true; break;
        case "Error": if (v instanceof BASES.Error) return true; break;
      }
      if (n === "MapEntry" && v instanceof DMapEntry) return true;
      if (n === "Duration" && v instanceof DDuration) return true;
      if (n === "DateTime" && v instanceof DDateTime) return true;
      if (n === "StringBuffer" && v instanceof DStringBuffer) return true;
      if (n === "Random" && v instanceof DRandom) return true;
      if (v && v.constructor && v instanceof DObject) return ehSub(v.constructor, n);
      if (n === "Duration") return v instanceof DDuration;
      if (n === "DateTime") return v instanceof DDateTime;
      if (n === "StringBuffer") return v instanceof DStringBuffer;
      if (n === "MapEntry") return v instanceof DMapEntry;
      if (n === "StackTrace") return v instanceof DStackTrace;
      if (n === "RegExp") return v instanceof DRegExp;
      if (n === "Type") return v instanceof DTipo;
      return false;
    }
    function elementosSao(l, d) { if (!d || d.n === "dynamic" || d.n === "Object" && d.nul) return true; if (l.$t && tipoTexto(l.$t) === tipoTexto(d)) return true; if (l.$t && (l.$t.n === "dynamic" || l.$t.n === "Object")) return d.n === "dynamic" || d.n === "Object"; if (l.$t) return subTipoNome(l.$t, d); return true; }
    function subTipoNome(a, b) { if (b.n === "Object" || b.n === "dynamic") return true; if (a.n === b.n) return true; if (b.n === "num" && (a.n === "int" || a.n === "double")) return true; if (b.nul && a.n === "Null") return true; var C = ctx.classes && ctx.classes[a.n]; return C ? ehSub(C, b.n) : false; }
    R.is = is;
    R.as = function (v, d, p) {
      if (is(v, d)) return v;
      topo().p = p;
      throw new Lancado(erroTipo("type '" + nomeTipo(v) + "' is not a subtype of type '" + tipoTexto(d) + "' in type cast"));
    };
    R.nc = function (v, p) {
      if (v === null || v === undefined) { if (p) topo().p = p; throw new Lancado(erroTipo("Null check operator used on a null value")); }
      return v;
    };
    R.LATE = { late: true };
    R.lateGet = function (v, nome) { if (v === R.LATE) lancarErro(lateErro("Local '" + nome + "' has not been initialized.")); return v; };
    function lateErro(m) { var o = new (BASES.LateInitializationError)(); o.m_message = m; return o; }
    R.cond = function (v) { if (v === true) return true; if (v === false) return false; if (v === null || v === undefined) lancarErro(erroTipo("type 'Null' is not a subtype of type 'bool'")); lancarErro(erroTipo("type '" + nomeTipo(v) + "' is not a subtype of type 'bool'")); };

    /* ---------- toString do Dart ---------- */
    function dstr(x) {
      if (x !== x) return "NaN";
      if (x === Infinity) return "Infinity"; if (x === -Infinity) return "-Infinity";
      if (Number.isInteger(x) && Math.abs(x) < 1e21) return (Object.is(x, -0) ? "-0" : String(x)) + ".0";
      var s = String(x);
      return s;
    }
    R.dstr = dstr;
    function str(v) {
      if (v === null || v === undefined) return "null";
      switch (typeof v) {
        case "string": return v;
        case "bigint": return v.toString();
        case "number": return dstr(v);
        case "boolean": return v ? "true" : "false";
        case "function": return v.$dartStr || "Closure: " + (v.$sig || "(dynamic) => dynamic");
      }
      if (Array.isArray(v)) return listaStr(v);
      if (v.m_toString) return str(v.m_toString());
      if (v instanceof Promise) return "Instance of 'Future<" + (v.$t || "dynamic") + ">'";
      if (v.toString !== Object.prototype.toString) return v.toString();
      return "Instance of 'Object'";
    }
    R.str = str;
    var emStr = [];
    function listaStr(l) {
      if (emStr.indexOf(l) >= 0) return "[...]";
      emStr.push(l);
      try { return "[" + l.map(str).join(", ") + "]"; } finally { emStr.pop(); }
    }
    function iterCurto(it, ab, fe) {
      var parts = [], length = 0, count = 0, i = it[Symbol.iterator](), r;
      var LL = 80, HC = 3, TC = 2, MC = 100, OV = 2, ES = 3;
      while (length < LL || count < HC) { r = i.next(); if (r.done) return ab + parts.join(", ") + fe; var nx = str(r.value); parts.push(nx); length += nx.length + OV; count++; }
      var pen, ult;
      r = i.next();
      if (r.done) {
        if (count <= HC + TC) return ab + parts.join(", ") + fe;
        ult = parts.pop(); pen = parts.pop();
      } else {
        var penV = r.value; count++;
        r = i.next();
        if (r.done) {
          if (count <= HC + 1) { parts.push(str(penV)); return ab + parts.join(", ") + fe; }
          ult = str(penV); pen = parts.pop(); length += ult.length + OV;
        } else {
          var ultV = r.value; count++;
          while (!(r = i.next()).done) {
            penV = ultV; ultV = r.value; count++;
            if (count > MC) {
              while (length > LL - ES - OV && count > HC) { length -= parts.pop().length + OV; count--; }
              parts.push("...");
              return ab + parts.join(", ") + fe;
            }
          }
          pen = str(penV); ult = str(ultV);
          length += ult.length + pen.length + 2 * OV;
        }
      }
      var elis = null;
      if (count > parts.length + TC) { elis = "..."; length += ES + OV; }
      while (length > LL && parts.length > HC) { length -= parts.pop().length + OV; if (elis === null) { elis = "..."; length += ES + OV; } }
      if (elis !== null) parts.push(elis);
      parts.push(pen); parts.push(ult);
      return ab + parts.join(", ") + fe;
    }

    /* ---------- igualdade e hash ---------- */
    function eq(a, b) {
      if (a === b) return true;
      if (a === null || a === undefined) return b === null || b === undefined;
      if (b === null || b === undefined) return false;
      var ta = typeof a, tb = typeof b;
      if (ta === "bigint" && tb === "number" || ta === "number" && tb === "bigint") return Number(a) === Number(b);
      if (ta === "number" && tb === "number") return a === b;
      if (ta !== "object") return false;
      if (a["m_=="]) return !!a["m_=="](b);
      if (a instanceof DRecord) return b instanceof DRecord && a.pos.length === b.pos.length && a.pos.every(function (x, i) { return eq(x, b.pos[i]); }) && Object.keys(a.nom).length === Object.keys(b.nom).length && Object.keys(a.nom).every(function (k) { return k in b.nom && eq(a.nom[k], b.nom[k]); });
      if (a.$eq) return a.$eq(b);
      return false;
    }
    R.eq = eq;
    function hash(v) {
      if (v === null || v === undefined) return "n";
      switch (typeof v) {
        case "string": return "s" + v;
        case "bigint": return "i" + v;
        case "number": return Number.isInteger(v) ? "i" + v : "d" + v;
        case "boolean": return "b" + v;
      }
      if (v instanceof DRecord) return "r(" + v.pos.map(hash).join(",") + ";" + Object.keys(v.nom).map(function (k) { return k + ":" + hash(v.nom[k]); }).join(",") + ")";
      if (v.m_hashCode !== undefined && v["m_=="]) return "h" + v.m_hashCode;
      if (v instanceof DDuration) return "D" + v.us;
      if (v instanceof DDateTime) return "T" + v.ms;
      if (v instanceof DTipo) return "t" + tipoTexto(v.d);
      return v;
    }
    R.hash = hash;

    /* ---------- números ---------- */
    function ehNum(x) { return typeof x === "bigint" || typeof x === "number"; }
    function semNum(op, a, b, p) {
      if (p) topo().p = p;
      if (ehNum(a) && b !== null && b !== undefined && !ehNum(b) && typeof b !== "object") lancarErro(erroTipo("type '" + nomeTipo(b) + "' is not a subtype of type 'num'"));
      if (a === null || a === undefined) lancarErro(nsm(a, op, [b]));
      if (typeof a === "object" && a["m_" + op]) return a["m_" + op](b);
      if (typeof a === "object" && extensoes[op]) { var f = acharExt(a, op); if (f) return f.f.call(a, b); }
      lancarErro(nsm(a, op, [b]));
    }
    R.add = function (a, b) {
      var ta = typeof a, tb = typeof b;
      if (ta === "bigint" && tb === "bigint") return w64(a + b);
      if (ta === "number" && tb === "number") return a + b;
      if (ta === "string" && tb === "string") return a + b;
      if (ehNum(a) && ehNum(b)) return Number(a) + Number(b);
      if (ta === "string") lancarErro(erroTipo("type '" + nomeTipo(b) + "' is not a subtype of type 'String'"));
      if (Array.isArray(a) && Array.isArray(b)) return lista(a.concat(b), a.$t);
      return semNum("+", a, b, arguments[2]);
    };
    R.sub = function (a, b) {
      var ta = typeof a, tb = typeof b;
      if (ta === "bigint" && tb === "bigint") return w64(a - b);
      if (ehNum(a) && ehNum(b)) return Number(a) - Number(b);
      return semNum("-", a, b, arguments[2]);
    };
    R.mul = function (a, b) {
      var ta = typeof a, tb = typeof b;
      if (ta === "bigint" && tb === "bigint") return w64(a * b);
      if (ehNum(a) && ehNum(b)) return Number(a) * Number(b);
      if (ta === "string" && tb === "bigint") { if (b < 0n) return ""; return a.repeat(Number(b)); }
      return semNum("*", a, b, arguments[2]);
    };
    R.div = function (a, b) {
      if (ehNum(a) && ehNum(b)) return Number(a) / Number(b);
      return semNum("/", a, b, arguments[2]);
    };
    R.idiv = function (a, b, p) {
      var ta = typeof a, tb = typeof b;
      if (ta === "bigint" && tb === "bigint") { if (b === 0n) { topo().p = p; throw new Lancado(new (BASES.IntegerDivisionByZeroException)(), ["int.~/ (dart:core-patch/integers.dart:27:7)"]); } return w64(a / b); }
      if (ehNum(a) && ehNum(b)) {
        var r = Number(a) / Number(b);
        if (!isFinite(r)) { topo().p = p; throw new Lancado(erroUnsup("Result of truncating division is " + dstr(r) + ": " + str(a) + " ~/ " + str(b))); }
        return BigInt(Math.trunc(r));
      }
      return semNum("~/", a, b);
    };
    R.mod = function (a, b, p) {
      var ta = typeof a, tb = typeof b;
      if (ta === "bigint" && tb === "bigint") {
        if (b === 0n) { topo().p = p; throw new Lancado(new (BASES.IntegerDivisionByZeroException)(), ["int.% (dart:core-patch/integers.dart)"]); }
        var r = a % b; if (r < 0n) r += b < 0n ? -b : b; return r;
      }
      if (ehNum(a) && ehNum(b)) { var x = Number(a), y = Number(b), m = x % y; if (m < 0) m += Math.abs(y); return m === 0 ? 0 : m; }
      return semNum("%", a, b);
    };
    function cmp(op) {
      return function (a, b) {
        var ta = typeof a, tb = typeof b;
        if ((ta === "bigint" || ta === "number") && (tb === "bigint" || tb === "number")) {
          switch (op) { case "<": return a < b; case ">": return a > b; case "<=": return a <= b; default: return a >= b; }
        }
        return semNum(op, a, b, arguments[2]);
      };
    }
    R.lt = cmp("<"); R.gt = cmp(">"); R.le = cmp("<="); R.ge = cmp(">=");
    R.rel = function (op, a, b) {
      switch (op) { case "eq": return eq(a, b); case "ne": return !eq(a, b); case "lt": return R.lt(a, b); case "gt": return R.gt(a, b); case "le": return R.le(a, b); default: return R.ge(a, b); }
    };
    function inteiros(op, f) { return function (a, b) { if (typeof a === "bigint" && typeof b === "bigint") return f(a, b); if (typeof a === "boolean" && typeof b === "boolean") return op === "&" ? a && b : op === "|" ? a || b : a !== b; return semNum(op, a, b); }; }
    R.and = inteiros("&", function (a, b) { return a & b; });
    R.or = inteiros("|", function (a, b) { return a | b; });
    R.xor = inteiros("^", function (a, b) { return a ^ b; });
    R.shl = inteiros("<<", function (a, b) { return w64(a << b); });
    R.shr = inteiros(">>", function (a, b) { return a >> b; });
    R.ushr = inteiros(">>>", function (a, b) { return BigInt.asIntN(64, BigInt.asUintN(64, a) >> b); });
    R.neg = function (a) { if (typeof a === "bigint") return w64(-a); if (typeof a === "number") return -a; if (a && a["m_unary-"]) return a["m_unary-"](); return semNum("unary-", a); };
    R.inv = function (a) { if (typeof a === "bigint") return ~a; return semNum("~", a); };
    R.D = function (x) { return typeof x === "bigint" ? Number(x) : x; };
    R.DL = function (l) { if (Array.isArray(l)) { for (var i = 0; i < l.length; i++) if (typeof l[i] === "bigint") l[i] = Number(l[i]); l.$t = { n: "double" }; } return l; };
    R.DM = function (m) { if (m instanceof DMap) m.forEachEntry(function (k, v, e) { if (typeof v === "bigint") e[1] = Number(v); }); return m; };

    /* ---------- coleções ---------- */
    function lista(arr, t, constante) { if (t) arr.$t = t; if (constante) { arr.$fixa = true; arr.$imut = true; } return arr; }
    R.lista = lista;
    R.listaFixa = function (l, imut) { l.$fixa = true; if (imut) l.$imut = true; return l; };
    R.colecao = function (f) { var l = []; f(l); return l; };
    R.espalhar = function (l, v, nulo) {
      if (v === null || v === undefined) { if (nulo) return; lancarErro(erroTipo("type 'Null' is not a subtype of type 'Iterable<dynamic>'")); }
      if (v instanceof DMap) { v.forEachEntry(function (k, x) { l.push([k, x]); }); return; }
      for (var x of iter(v)) l.push(x);
    };
    function DMap(t) { this.m = new Map(); this.$t = t || null; }
    DMap.prototype.chave = function (k) { return hash(k); };
    DMap.prototype.get = function (k) { var e = this.m.get(hash(k)); return e ? e[1] : null; };
    DMap.prototype.set = function (k, v) { if (this.$imut) lancarErro(erroUnsup("Cannot modify unmodifiable map")); var h = hash(k), e = this.m.get(h); if (e) e[1] = v; else this.m.set(h, [k, v]); };
    DMap.prototype.containsKey = function (k) { return this.m.has(hash(k)); };
    DMap.prototype.remove = function (k) { if (this.$imut) lancarErro(erroUnsup("Cannot modify unmodifiable map")); var h = hash(k), e = this.m.get(h); if (!e) return null; this.m.delete(h); return e[1]; };
    DMap.prototype.forEachEntry = function (f) { this.m.forEach(function (e) { f(e[0], e[1], e); }); };
    DMap.prototype.m_toString = function () {
      if (emStr.indexOf(this) >= 0) return "{...}";
      emStr.push(this);
      try { var p = []; this.m.forEach(function (e) { p.push(str(e[0]) + ": " + str(e[1])); }); return "{" + p.join(", ") + "}"; } finally { emStr.pop(); }
    };
    DMap.prototype.$nome = "_Map";
    R.DMap = DMap;
    R.mapa = function (pares, t, constante) { var m = new DMap(t); pares.forEach(function (p) { m.set(p[0], p[1]); }); if (constante) m.$imut = true; return m; };
    function DSet(t) { this.m = new Map(); this.$t = t || null; }
    DSet.prototype.add = function (v) { if (this.$imut) lancarErro(erroUnsup("Cannot change an unmodifiable set")); var h = hash(v); if (this.m.has(h)) return false; this.m.set(h, v); return true; };
    DSet.prototype.has = function (v) { return this.m.has(hash(v)); };
    DSet.prototype.remove = function (v) { var h = hash(v); return this.m.delete(h); };
    DSet.prototype[Symbol.iterator] = function () { return this.m.values(); };
    DSet.prototype.m_toString = function () { return "{" + Array.from(this.m.values()).map(str).join(", ") + "}"; };
    DSet.prototype.$nome = "_Set";
    R.DSet = DSet;
    R.conjunto = function (els, t, constante) { var s = new DSet(t); els.forEach(function (x) { s.add(x); }); if (constante) s.$imut = true; return s; };
    function DRecord(pos, nom) { this.pos = pos; this.nom = nom; }
    DRecord.prototype.m_toString = function () {
      var self = this;
      var p = this.pos.map(str).concat(Object.keys(this.nom).sort().map(function (k) { return k + ": " + str(self.nom[k]); }));
      return "(" + p.join(", ") + (this.pos.length === 1 && !Object.keys(this.nom).length ? "," : "") + ")";
    };
    Object.defineProperty(DRecord.prototype, "m_hashCode", { get: function () { var h = 0; var s = hash(this); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return BigInt(h & 0x3fffffff); } });
    R.record = function (pos, nom) { return new DRecord(pos, nom); };
    R.ehRecord = function (v, n, nomes) { return v instanceof DRecord && v.pos.length === n && Object.keys(v.nom).length === nomes.length && nomes.every(function (k) { return k in v.nom; }); };
    R.ehLista = function (v, n, resto) { return Array.isArray(v) && (resto ? v.length >= n : v.length === n); };
    R.ehMapa = function (v) { return v instanceof DMap; };
    R.erroPadrao = function (v) { lancarErro(erroEstado("Pattern matching error")); };
    R.semCaso = function (v, p) { topo().p = p; throw new Lancado(erroEstado("No switch case matched " + str(v))); };
    function DMapEntry(k, v) { this.m_key = k; this.m_value = v; }
    DMapEntry.prototype = Object.create(DObject.prototype);
    DMapEntry.prototype.m_toString = function () { return "MapEntry(" + str(this.m_key) + ": " + str(this.m_value) + ")"; };
    DMapEntry.prototype.$nome = "MapEntry";

    // Iterable preguiçoso (map, where, …)
    function DIteravel(f) { this.f = f; }
    DIteravel.prototype[Symbol.iterator] = function () { return this.f(); };
    DIteravel.prototype.m_toString = function () { return iterCurto(this, "(", ")"); };
    DIteravel.prototype.$nome = "Iterable";
    R.DIteravel = DIteravel;
    function iteravel(f) { return new DIteravel(f); }
    R.iteravel = function (gen) { return new DIteravel(function () { return gen(); }); };
    function iter(v) {
      if (v === null || v === undefined) lancarErro(erroTipo("type 'Null' is not a subtype of type 'Iterable<dynamic>'"));
      if (Array.isArray(v)) return iterLista(v);
      if (v instanceof DSet || v instanceof DIteravel) return v;
      if (typeof v === "string") lancarErro(erroTipo("type 'String' is not a subtype of type 'Iterable<dynamic>'"));
      if (v instanceof DMap) lancarErro(erroTipo("type '" + nomeTipo(v) + "' is not a subtype of type 'Iterable<dynamic>'"));
      if (v[Symbol.iterator]) return v;
      if (v.m_iterator) { var it = v.m_iterator; return { [Symbol.iterator]: function () { return { next: function () { return it.m_moveNext() ? { done: false, value: it.m_current } : { done: true }; } }; } }; }
      lancarErro(erroTipo("type '" + nomeTipo(v) + "' is not a subtype of type 'Iterable<dynamic>'"));
    }
    function iterLista(l) {
      // detecta modificação durante o for-in
      return { [Symbol.iterator]: function () { var i = 0, n = l.length; return { next: function () { if (l.length !== n) lancarErro(new (BASES.ConcurrentModificationError)(l)); if (i < l.length) return { done: false, value: l[i++] }; return { done: true }; } }; } };
    }
    R.iter = iter;
    R.iterAsync = function (v) { if (v instanceof DStream) return v.asyncIter(); return iter(v); };
    function paraArray(v) { if (Array.isArray(v)) return v; return Array.from(iter(v)); }

    /* ---------- acesso a membros ---------- */
    var extensoes = {};
    R.extensao = function (tipo, nome, tipoM, f) { (extensoes[nome] = extensoes[nome] || []).push({ tipo: tipo, k: tipoM, f: f }); };
    function acharExt(v, nome) {
      var l = extensoes[nome]; if (!l) return null;
      for (var i = 0; i < l.length; i++) if (l[i].k !== "static" && is(v, { n: l[i].tipo })) return l[i];
      return null;
    }
    R.extMetodo = function (o, nome) { var e = acharExt(o, nome); return e.f.bind(o); };
    R.extMetodoThis = function (o, nome) { return function () { return R.chamar(o, nome, [].slice.call(arguments)); }; };
    // .valor (dot shorthand do Dart 3.10): procura o membro estático nas classes e enums do programa
    R.atalho = function (nome, tipo, p, chamada) {
      var achados = [];
      Object.keys(R.classes).forEach(function (k) { var C = R.classes[k]; if (Object.prototype.hasOwnProperty.call(C, "m_" + nome) || (nome === "new" && C.$new)) achados.push(C); });
      if (tipo && R.classes[tipo]) achados = [R.classes[tipo]];
      if (achados.length) { var C = achados[0]; return nome === "new" ? C.$new : C["m_" + nome]; }
      if (p) topo().p = p;
      lancarErro(nsm(null, "." + nome, null, true));
    };
    function nsm(v, nome, args, getter) {
      var o = new (BASES.NoSuchMethodError)();
      if (v === null || v === undefined) {
        o.$texto = "NoSuchMethodError: The " + (getter ? "getter" : "method") + " '" + nome + "' was called on null.\nReceiver: null\nTried calling: " + nome + (getter ? "" : "(" + (args || []).map(str).join(", ") + ")");
      } else {
        o.$texto = "NoSuchMethodError: Class '" + nomeTipo(v) + "' has no instance " + (getter ? "getter" : "method") + " '" + nome + "'.\nReceiver: " + str(v) + "\nTried calling: " + nome + (getter ? "" : "(" + (args || []).map(str).join(", ") + ")");
      }
      return o;
    }
    function tabela(v) {
      switch (typeof v) {
        case "string": return STR; case "bigint": return INT; case "number": return DBL; case "boolean": return BOOL; case "function": return FUN;
      }
      if (Array.isArray(v)) return LIST;
      if (v instanceof DMap) return MAP;
      if (v instanceof DSet) return SET;
      if (v instanceof DIteravel) return ITER;
      if (v instanceof DRecord) return REC;
      if (v instanceof Promise) return FUT;
      if (v instanceof DStream) return STREAM;
      return null;
    }
    R.get = function (o, nome, p) {
      if (o === null || o === undefined) {
        if (nome === "hashCode") return 2011n; if (nome === "runtimeType") return new DTipo({ n: "Null" });
        if (p) topo().p = p; lancarErro(nsm(o, nome, null, true));
      }
      var t = tabela(o);
      if (t) {
        var m = t.get[nome];
        if (m) return m(o);
        if (t.met[nome]) return metodoComoFuncao(o, nome, t);
        if (nome === "hashCode") return hashCodeDe(o);
        if (nome === "runtimeType") return new DTipo(tipoDe(o));
        if (t === REC) { if (/^\$\d+$/.test(nome)) { var i = +nome.slice(1) - 1; if (i < o.pos.length) return o.pos[i]; } else if (nome in o.nom) return o.nom[nome]; }
      } else {
        var k = "m_" + nome;
        if (k in o) { var r = o[k]; if (typeof r === "function" && !Object.prototype.hasOwnProperty.call(o, k) && !temGetter(o, k)) return r.bind(o); if (r === R.LATE) { if (p) topo().p = p; lancarErro(lateErro("Field '" + nome + "' has not been initialized.")); } return r; }
        if (nome === "hashCode") return hashCodeDe(o);
        if (nome === "runtimeType") return new DTipo(tipoDe(o));
      }
      var e = acharExt(o, nome);
      if (e) { if (e.k === "get") return e.f.call(o); return e.f.bind(o); }
      if (p) topo().p = p;
      lancarErro(nsm(o, nome, null, true));
    };
    function temGetter(o, k) { var p = o; while (p) { var d = Object.getOwnPropertyDescriptor(p, k); if (d) return !!d.get; p = Object.getPrototypeOf(p); } return false; }
    function hashCodeDe(o) {
      if (typeof o === "bigint") return o;
      if (typeof o === "string") { var h = 0; for (var i = 0; i < o.length; i++) h = (h * 31 + o.charCodeAt(i)) & 0x3fffffff; return BigInt(h); }
      if (typeof o === "boolean") return o ? 1231n : 1237n;
      if (typeof o === "number") { if (Number.isInteger(o) && Math.abs(o) < 2 ** 53) return BigInt(o); var buf = new DataView(new ArrayBuffer(8)); buf.setFloat64(0, o); return BigInt((buf.getUint32(0) ^ buf.getUint32(4)) & 0x3fffffff); }
      if (o === null || o === undefined) return 2011n;
      if (o && o.m_hashCode !== undefined) return o.m_hashCode;
      return BigInt(Math.floor(Math.random() * 1e9));
    }
    function metodoComoFuncao(o, nome, t) { var f = function () { return t.met[nome].apply(null, [o].concat([].slice.call(arguments))); }; return f; }
    R.nget = function (o, nome, p) { if (o === null || o === undefined) return null; return R.get(o, nome, p); };
    R.set = function (o, nome, v, p) {
      if (p) topo().p = p;
      if (o === null || o === undefined) { if (p) topo().p = p; lancarErro(nsm(o, nome + "=", [v])); }
      var t = tabela(o);
      if (t) {
        if (t.set && t.set[nome]) return t.set[nome](o, v), v;
        var e0 = acharExt(o, nome); if (e0 && e0.k === "set") { e0.f.call(o, v); return v; }
        lancarErro(nsm(o, nome + "=", [v]));
      }
      var k = "m_" + nome;
      if (!(k in o)) { var e = acharExt(o, nome); if (e && e.k === "set") { e.f.call(o, v); return v; } }
      o[k] = v; return v;
    };
    R.nset = function (o, nome, v, p) { if (o === null || o === undefined) return null; return R.set(o, nome, v, p); };
    var NOMEADOS = Symbol("nomeados");
    R.nomeados = function (o) { o[NOMEADOS] = true; return o; };
    function separar(args) {
      var u = args[args.length - 1];
      if (u && typeof u === "object" && u[NOMEADOS]) return { pos: args.slice(0, -1), nom: u };
      return { pos: args, nom: {} };
    }
    R.chamar = function (o, nome, args, p) {
      if (p) topo().p = p;
      if (o === null || o === undefined) {
        if (nome === "toString") return "null";
        lancarErro(nsm(o, nome, args));
      }
      var t = tabela(o);
      if (t) {
        var m = t.met[nome];
        if (m) { var a = separar(args); return m.apply(null, [o].concat(a.pos, Object.keys(a.nom).length ? [a.nom] : [])); }
        if (nome === "toString") return str(o);
        if (t === FUN && nome === "call") return o.apply(null, args);
        if (t.get[nome]) return R.chamarF(t.get[nome](o), args, nome);
        if (t === REC) return R.chamarF(R.get(o, nome), args, nome);
      } else {
        var f = o["m_" + nome];
        if (typeof f === "function") return f.apply(o, args);
        if (f !== undefined && f !== null && typeof f === "object" && f.m_call) return f.m_call.apply(f, args);
        if (nome === "toString") return str(o);
        if (nome === "noSuchMethod") return null;
      }
      var e = acharExt(o, nome);
      if (e) { if (e.k === "get") return R.chamarF(e.f.call(o), args, nome); return e.f.apply(o, args); }
      lancarErro(nsm(o, nome, args));
    };
    R.nchamar = function (o, nome, args, p) { if (o === null || o === undefined) return null; return R.chamar(o, nome, args, p); };
    R.chamarF = function (f, args, nome, p) {
      if (p) topo().p = p;
      if (typeof f === "function") return f.apply(null, args);
      if (f && typeof f === "object" && f.m_call) return f.m_call.apply(f, args);
      if (f === null || f === undefined) lancarErro(nsm(null, nome || "call", args));
      lancarErro(nsm(f, "call", args));
    };
    R.pos = function (p, v) { return v; };
    R.cf = function (p, f, args) { topo().p = p; return f.apply(null, args); };
    R.fn = function (f) { return f; };
    R.idx = function (o, i, p, nulo) {
      if (o === null || o === undefined) { if (nulo) return null; topo().p = p; lancarErro(nsm(o, "[]", [i])); }
      if (Array.isArray(o)) {
        if (typeof i !== "bigint") lancarErro(erroTipo("type '" + nomeTipo(i) + "' is not a subtype of type 'int' of 'index'"));
        if (i < 0n || i >= BigInt(o.length)) { topo().p = p; throw new Lancado(erroIndice(i, o.length), ["List.[] (dart:core-patch/growable_array.dart)"]); }
        return o[Number(i)];
      }
      if (o instanceof DMap) return o.get(i);
      if (typeof o === "string") {
        if (i < 0n || i >= BigInt(o.length)) { topo().p = p; throw new Lancado(erroIndice(i, o.length), ["_StringBase.[] (dart:core-patch/string_patch.dart)"]); }
        return o[Number(i)];
      }
      if (o["m_[]"]) return o["m_[]"](i);
      topo().p = p; lancarErro(nsm(o, "[]", [i]));
    };
    R.setIdx = function (o, i, v, p) {
      if (o === null || o === undefined) { topo().p = p; lancarErro(nsm(o, "[]=", [i, v])); }
      if (Array.isArray(o)) {
        if (o.$imut) { topo().p = p; lancarErro(erroUnsup("Cannot modify an unmodifiable list")); }
        if (i < 0n || i >= BigInt(o.length)) { topo().p = p; throw new Lancado(erroIndice(i, o.length), ["List.[]= (dart:core-patch/growable_array.dart)"]); }
        if (o.$t && o.$t.n === "double" && typeof v === "bigint") v = Number(v);
        o[Number(i)] = v; return v;
      }
      if (o instanceof DMap) { o.set(i, v); return v; }
      if (o["m_[]="]) { o["m_[]="](i, v); return v; }
      topo().p = p; lancarErro(nsm(o, "[]=", [i, v]));
    };
    R.incr = function (lv, op, pre) { var a = lv.g(); var b = R[op](a, 1n); lv.s(b); return pre ? b : a; };
    R.atribOp = function (lv, op, v, p) { var r = R[op](lv.g(), v, p); lv.s(r); return r; };
    R.atribNulo = function (lv, f) { var a = lv.g(); if (a !== null && a !== undefined) return a; var v = f(); lv.s(v); return v; };
    R.atribLog = function (lv, op, f) { var a = lv.g(); var r = op === "&&=" ? (a && R.cond(f())) : (a || R.cond(f())); lv.s(r); return r; };
    R.afirmar = function () { /* o dart run não liga os asserts (precisa de --enable-asserts) */ };
    R.lazy = function (g0, s0, init) { s0(init()); };
    R.lazyStatic = function (C, k, init) {
      var feito = false, valor;
      Object.defineProperty(C, k, { get: function () { if (!feito) { feito = true; valor = init(); } return valor; }, set: function (v) { feito = true; valor = v; }, configurable: true });
    };
    R.estatico = function (classe, nome, p) {
      var t = ESTATICOS[classe];
      if (t && nome in t) { var v = t[nome]; return typeof v === "function" && v.$getter ? v() : v; }
      topo().p = p;
      lancarErro(nsm(null, classe + "." + nome, null, true));
    };
    R.simbolo = function (n) { return { $nome: "Symbol", m_toString: function () { return 'Symbol("' + n + '")'; }, $eq: function (o) { return o && o.m_toString && o.m_toString() === this.m_toString(); } }; };

    /* ---------- funções globais ---------- */
    function out(s) { ctx.escrever("out", s); }
    function err(s) { ctx.escrever("err", s); }
    R.out = out; R.err = err;
    var GLOBAL = {
      print: function (v) { out(str(v) + "\n"); return null; },
      identical: function (a, b) { if (typeof a === "bigint" || typeof a === "number") return eq(a, b) && typeof a === typeof b; return a === b; },
      exit: function (c) { throw new Sinal("exit", Number(c)); },
      sleep: function (d) { return null; },
      sqrt: function (x) { return Math.sqrt(Number(x)); }, pow: function (a, b) { if (typeof a === "bigint" && typeof b === "bigint" && b >= 0n) return w64(a ** b); return Math.pow(Number(a), Number(b)); },
      max: function (a, b) { return R.lt(a, b) ? b : (R.lt(b, a) ? a : (typeof a === "number" && isNaN(a) ? a : b)); }, min: function (a, b) { return R.gt(a, b) ? b : (R.gt(b, a) ? a : (typeof a === "number" && isNaN(a) ? a : a)); },
      sin: function (x) { return Math.sin(Number(x)); }, cos: function (x) { return Math.cos(Number(x)); }, tan: function (x) { return Math.tan(Number(x)); },
      asin: function (x) { return Math.asin(Number(x)); }, acos: function (x) { return Math.acos(Number(x)); }, atan: function (x) { return Math.atan(Number(x)); }, atan2: function (a, b) { return Math.atan2(Number(a), Number(b)); },
      exp: function (x) { return Math.exp(Number(x)); }, log: function (x) { return Math.log(Number(x)); },
      jsonEncode: function (v) { return jsonEncode(v); }, jsonDecode: function (s) { return jsonDecode(s); },
      unawaited: function () { return null; },
      scheduleMicrotask: function (f) { agendarMicro(f); return null; },
    };
    Object.assign(g, GLOBAL, { pi: Math.PI, e: Math.E, ln2: Math.LN2, ln10: Math.LN10, log2e: Math.LOG2E, log10e: Math.LOG10E, sqrt2: Math.SQRT2, sqrt1_2: Math.SQRT1_2 });
    R.global = function (n, args, targ, p) {
      if (p) topo().p = p;
      var a = separar(args);
      if (GLOBAL[n]) return GLOBAL[n].apply(null, a.pos.concat(Object.keys(a.nom).length ? [a.nom] : []));
      return R.criar(n, "", args, targ ? { n: n, a: [targ] } : null);
    };

    /* ---------- stdin/stdout ---------- */
    var STDOUT = { $nome: "Stdout", m_toString: function () { return "Instance of 'Stdout'"; } };
    var STDERR = { $nome: "Stdout", m_toString: function () { return "Instance of 'Stdout'"; } };
    function escritor(f) {
      return {
        write: function (o, v) { f(str(v)); return null; },
        writeln: function (o, v) { f((v === undefined || (v && typeof v === "object" && Object.keys(v).length === 0 && !(v instanceof DObject) && !Array.isArray(v) && !(v instanceof DMap)) ? "" : str(v)) + "\n"); return null; },
        writeAll: function (o, l, sep) { f(paraArray(l).map(str).join(typeof sep === "string" ? sep : "")); return null; },
        flush: function () { return Promise.resolve(null); }, close: function () { return Promise.resolve(null); },
      };
    }
    var ESC_OUT = escritor(out), ESC_ERR = escritor(err);
    var STDIN = { $nome: "Stdin" };
    g.stdout = STDOUT; g.stderr = STDERR; g.stdin = STDIN;
    function lerLinha() { var l = ctx.lerLinha(); return l; }
    var IO = {
      readLineSync: function () { return lerLinha(); },
    };

    /* ---------- tabelas de membros dos tipos nativos ---------- */
    function M(get, met, set) { return { get: get || {}, met: met || {}, set: set || {} }; }
    function I(n) { return BigInt(n); }
    function toInt(x) { return typeof x === "bigint" ? Number(x) : x; }
    function checarIndice(i, len, nome) { if (i < 0 || i >= len) lancarErro(erroIndice(BigInt(i), len, nome)); }
    function rangeCheck(ini, fim, len) {
      if (ini < 0 || ini > len) lancarErro(erroRange("RangeError (start): Invalid value: Not in inclusive range 0.." + len + ": " + ini));
      if (fim !== null && (fim < ini || fim > len)) lancarErro(erroRange("RangeError (end): Invalid value: Not in inclusive range " + ini + ".." + len + ": " + fim));
    }
    function fnArg(f) { return typeof f === "function" ? f : function () { return R.chamarF(f, [].slice.call(arguments)); }; }
    function comparar(a, b) {
      if (typeof a === "bigint" && typeof b === "bigint") return a < b ? -1 : a > b ? 1 : 0;
      if (ehNum(a) && ehNum(b)) { a = Number(a); b = Number(b); return a < b ? -1 : a > b ? 1 : (a === b ? 0 : (isNaN(a) ? (isNaN(b) ? 0 : 1) : -1)); }
      if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
      if (typeof a === "boolean") lancarErro(erroTipo("type 'bool' is not a subtype of type 'Comparable<dynamic>' in type cast"));
      if (a && a.m_compareTo) return Number(a.m_compareTo(b));
      lancarErro(erroTipo("type '" + nomeTipo(a) + "' is not a subtype of type 'Comparable<dynamic>' in type cast"));
    }
    R.comparar = comparar;
    function sortDart(arr, f) {
      var cmpf = f ? function (a, b) { return Number(f(a, b)); } : comparar;
      // ordenação estável (o Dart usa insertion sort para listas pequenas e dual-pivot quicksort; listas com chaves iguais podem diferir)
      return arr.sort(cmpf);
    }
    function vazio(nome) { return erroEstado("No element"); }

    // Iterable (comum a List, Set e Iterable preguiçoso)
    var ITER_MET = {
      map: function (o, f) { f = fnArg(f); return iteravel(function* () { for (var x of iter(o)) yield f(x); }); },
      where: function (o, f) { f = fnArg(f); return iteravel(function* () { for (var x of iter(o)) if (R.cond(f(x))) yield x; }); },
      whereType: function (o) { return iteravel(function* () { for (var x of iter(o)) yield x; }); },
      expand: function (o, f) { f = fnArg(f); return iteravel(function* () { for (var x of iter(o)) for (var y of iter(f(x))) yield y; }); },
      forEach: function (o, f) { f = fnArg(f); for (var x of iter(o)) f(x); return null; },
      toList: function (o, n) { var l = lista(Array.from(iter(o)), o.$t || null); if (n && n.growable === false) l.$fixa = true; return l; },
      toSet: function (o) { var s = new DSet(o.$t || null); for (var x of iter(o)) s.add(x); return s; },
      join: function (o, sep) { return paraArray(o).map(str).join(typeof sep === "string" ? sep : ""); },
      contains: function (o, v) { for (var x of iter(o)) if (eq(x, v)) return true; return false; },
      any: function (o, f) { f = fnArg(f); for (var x of iter(o)) if (R.cond(f(x))) return true; return false; },
      every: function (o, f) { f = fnArg(f); for (var x of iter(o)) if (!R.cond(f(x))) return false; return true; },
      fold: function (o, ini, f) { f = fnArg(f); var a = ini; for (var x of iter(o)) a = f(a, x); return a; },
      reduce: function (o, f) { f = fnArg(f); var prim = true, a; for (var x of iter(o)) { if (prim) { a = x; prim = false; } else a = f(a, x); } if (prim) lancarErro(erroEstado("No element")); return a; },
      firstWhere: function (o, f, n) { f = fnArg(f); for (var x of iter(o)) if (R.cond(f(x))) return x; if (n && n.orElse) return R.chamarF(n.orElse, []); throw new Lancado(erroEstado("No element"), [Array.isArray(o) ? "ListBase.firstWhere (dart:collection/list.dart:132:5)" : "Iterable.firstWhere (dart:core/iterable.dart:765:5)"]); },
      lastWhere: function (o, f, n) { f = fnArg(f); var r, achou = false; for (var x of iter(o)) if (R.cond(f(x))) { r = x; achou = true; } if (achou) return r; if (n && n.orElse) return R.chamarF(n.orElse, []); lancarErro(erroEstado("No element")); },
      singleWhere: function (o, f, n) { f = fnArg(f); var r, c = 0; for (var x of iter(o)) if (R.cond(f(x))) { r = x; c++; } if (c === 1) return r; if (c > 1) lancarErro(erroEstado("Too many elements")); if (n && n.orElse) return R.chamarF(n.orElse, []); lancarErro(erroEstado("No element")); },
      skip: function (o, n) { n = Number(n); return iteravel(function* () { var i = 0; for (var x of iter(o)) { if (i++ >= n) yield x; } }); },
      take: function (o, n) { n = Number(n); return iteravel(function* () { var i = 0; if (n <= 0) return; for (var x of iter(o)) { yield x; if (++i >= n) return; } }); },
      skipWhile: function (o, f) { f = fnArg(f); return iteravel(function* () { var pulando = true; for (var x of iter(o)) { if (pulando && R.cond(f(x))) continue; pulando = false; yield x; } }); },
      takeWhile: function (o, f) { f = fnArg(f); return iteravel(function* () { for (var x of iter(o)) { if (!R.cond(f(x))) return; yield x; } }); },
      followedBy: function (o, b) { return iteravel(function* () { for (var x of iter(o)) yield x; for (var y of iter(b)) yield y; }); },
      elementAt: function (o, i) { var a = paraArray(o); checarIndice(Number(i), a.length, "index"); return a[Number(i)]; },
      cast: function (o) { return o; },
      toString: function (o) { return str(o); },
      firstOrNull: null,
    };
    var ITER_GET = {
      length: function (o) { return I(paraArray(o).length); },
      isEmpty: function (o) { return paraArray(o).length === 0; },
      isNotEmpty: function (o) { return paraArray(o).length > 0; },
      first: function (o) { for (var x of iter(o)) return x; lancarErro(erroEstado("No element")); },
      last: function (o) { var a = paraArray(o); if (!a.length) lancarErro(erroEstado("No element")); return a[a.length - 1]; },
      single: function (o) { var a = paraArray(o); if (!a.length) lancarErro(erroEstado("No element")); if (a.length > 1) lancarErro(erroEstado("Too many elements")); return a[0]; },
      firstOrNull: function (o) { for (var x of iter(o)) return x; return null; },
      lastOrNull: function (o) { var a = paraArray(o); return a.length ? a[a.length - 1] : null; },
      iterator: function (o) { var it = iter(o)[Symbol.iterator](), atual = null; return { $nome: "Iterator", m_moveNext: function () { var r = it.next(); if (r.done) { atual = null; return false; } atual = r.value; return true; }, get m_current() { return atual; } }; },
      indexed: function (o) { return iteravel(function* () { var i = 0; for (var x of iter(o)) yield new DRecord([I(i++), x], {}); }); },
      nonNulls: function (o) { return iteravel(function* () { for (var x of iter(o)) if (x !== null && x !== undefined) yield x; }); },
      hashCode: function (o) { return hashCodeDe(o); },
      runtimeType: function (o) { return new DTipo(tipoDe(o)); },
    };
    delete ITER_MET.firstOrNull;
    var ITER = M(ITER_GET, ITER_MET);
    function semMud(l, oque) { if (l.$imut) lancarErro(erroUnsup("Cannot " + oque + " an unmodifiable list")); if (l.$fixa) lancarErro(erroUnsup("Cannot " + oque + " a fixed-length list")); }
    var LIST = M(Object.assign({}, ITER_GET, {
      length: function (o) { return I(o.length); },
      isEmpty: function (o) { return o.length === 0; }, isNotEmpty: function (o) { return o.length > 0; },
      first: function (o) { if (!o.length) lancarErro(erroEstado("No element")); return o[0]; },
      last: function (o) { if (!o.length) lancarErro(erroEstado("No element")); return o[o.length - 1]; },
      reversed: function (o) { return iteravel(function* () { for (var i = o.length - 1; i >= 0; i--) yield o[i]; }); },
    }), Object.assign({}, ITER_MET, {
      add: function (o, v) { semMud(o, "add to"); if (o.$t && o.$t.n === "double" && typeof v === "bigint") v = Number(v); o.push(v); return null; },
      addAll: function (o, v) { semMud(o, "add to"); var a = paraArray(v).slice(); for (var x of a) o.push(x); return null; },
      insert: function (o, i, v) { semMud(o, "add to"); i = Number(i); if (i < 0 || i > o.length) lancarErro(erroRange("RangeError (index): Invalid value: Not in inclusive range 0.." + o.length + ": " + i)); o.splice(i, 0, v); return null; },
      insertAll: function (o, i, v) { semMud(o, "add to"); o.splice.apply(o, [Number(i), 0].concat(paraArray(v))); return null; },
      remove: function (o, v) { semMud(o, "remove from"); for (var i = 0; i < o.length; i++) if (eq(o[i], v)) { o.splice(i, 1); return true; } return false; },
      removeAt: function (o, i) { semMud(o, "remove from"); i = Number(i); checarIndice(i, o.length, "index"); return o.splice(i, 1)[0]; },
      removeLast: function (o) { semMud(o, "remove from"); if (!o.length) lancarErro(erroRange("RangeError (index): Invalid value: Valid value range is empty: -1")); return o.pop(); },
      removeWhere: function (o, f) { semMud(o, "remove from"); f = fnArg(f); var r = o.filter(function (x) { return !R.cond(f(x)); }); o.length = 0; r.forEach(function (x) { o.push(x); }); return null; },
      retainWhere: function (o, f) { semMud(o, "remove from"); f = fnArg(f); var r = o.filter(function (x) { return R.cond(f(x)); }); o.length = 0; r.forEach(function (x) { o.push(x); }); return null; },
      removeRange: function (o, a, b) { semMud(o, "remove from"); o.splice(Number(a), Number(b) - Number(a)); return null; },
      clear: function (o) { semMud(o, "clear"); o.length = 0; return null; },
      indexOf: function (o, v, ini) { for (var i = ini ? Number(ini) : 0; i < o.length; i++) if (eq(o[i], v)) return I(i); return -1n; },
      lastIndexOf: function (o, v) { for (var i = o.length - 1; i >= 0; i--) if (eq(o[i], v)) return I(i); return -1n; },
      indexWhere: function (o, f, ini) { f = fnArg(f); for (var i = ini ? Number(ini) : 0; i < o.length; i++) if (R.cond(f(o[i]))) return I(i); return -1n; },
      lastIndexWhere: function (o, f) { f = fnArg(f); for (var i = o.length - 1; i >= 0; i--) if (R.cond(f(o[i]))) return I(i); return -1n; },
      sort: function (o, f) { if (o.$imut) lancarErro(erroUnsup("Cannot modify an unmodifiable list")); sortDart(o, f ? fnArg(f) : null); return null; },
      shuffle: function (o, rnd) { for (var i = o.length - 1; i > 0; i--) { var j = Number((rnd || aleatorioPadrao()).m_nextInt(BigInt(i + 1))); var t = o[i]; o[i] = o[j]; o[j] = t; } return null; },
      sublist: function (o, a, b) { a = Number(a); b = b === undefined || b === null ? o.length : Number(b); rangeCheck(a, b, o.length); return lista(o.slice(a, b), o.$t); },
      getRange: function (o, a, b) { a = Number(a); b = Number(b); rangeCheck(a, b, o.length); return iteravel(function* () { for (var i = a; i < b; i++) yield o[i]; }); },
      fillRange: function (o, a, b, v) { for (var i = Number(a); i < Number(b); i++) o[i] = v === undefined ? null : v; return null; },
      setAll: function (o, i, v) { var a = paraArray(v); for (var k = 0; k < a.length; k++) o[Number(i) + k] = a[k]; return null; },
      setRange: function (o, a, b, v) { var src = paraArray(v); for (var i = Number(a); i < Number(b); i++) o[i] = src[i - Number(a)]; return null; },
      replaceRange: function (o, a, b, v) { o.splice.apply(o, [Number(a), Number(b) - Number(a)].concat(paraArray(v))); return null; },
      asMap: function (o) { var m = new DMap(); o.forEach(function (x, i) { m.set(I(i), x); }); return m; },
      toList: function (o, n) { var l = lista(o.slice(), o.$t); if (n && n.growable === false) l.$fixa = true; return l; },
      contains: function (o, v) { for (var i = 0; i < o.length; i++) if (eq(o[i], v)) return true; return false; },
      join: function (o, sep) { return o.map(str).join(typeof sep === "string" ? sep : ""); },
      forEach: function (o, f) { f = fnArg(f); var n = o.length; for (var i = 0; i < o.length; i++) { f(o[i]); if (o.length !== n) lancarErro(new (BASES.ConcurrentModificationError)(o)); } return null; },
      elementAt: function (o, i) { i = Number(i); checarIndice(i, o.length, "index"); return o[i]; },
    }), {
      length: function (o, v) { semMud(o, "change the length of"); var n = Number(v); if (n > o.length) { if (o.$t && !o.$t.nul && o.$t.n !== "dynamic") lancarErro(erroTipo("type 'Null' is not a subtype of type '" + tipoTexto(o.$t) + "'")); while (o.length < n) o.push(null); } else o.length = n; },
      first: function (o, v) { if (!o.length) lancarErro(erroIndice(0n, 0, "index")); o[0] = v; },
      last: function (o, v) { if (!o.length) lancarErro(erroIndice(0n, 0, "index")); o[o.length - 1] = v; },
    });
    var SET = M(Object.assign({}, ITER_GET, {
      length: function (o) { return I(o.m.size); }, isEmpty: function (o) { return o.m.size === 0; }, isNotEmpty: function (o) { return o.m.size > 0; },
    }), Object.assign({}, ITER_MET, {
      add: function (o, v) { return o.add(v); },
      addAll: function (o, v) { for (var x of paraArray(v)) o.add(x); return null; },
      remove: function (o, v) { return o.remove(v); },
      contains: function (o, v) { return o.has(v); },
      containsAll: function (o, v) { for (var x of iter(v)) if (!o.has(x)) return false; return true; },
      union: function (o, b) { var s = new DSet(o.$t); for (var x of o) s.add(x); for (var y of iter(b)) s.add(y); return s; },
      intersection: function (o, b) { var s = new DSet(o.$t); for (var x of o) if (b.has(x)) s.add(x); return s; },
      difference: function (o, b) { var s = new DSet(o.$t); for (var x of o) if (!b.has(x)) s.add(x); return s; },
      clear: function (o) { o.m.clear(); return null; },
      removeWhere: function (o, f) { f = fnArg(f); Array.from(o).forEach(function (x) { if (R.cond(f(x))) o.remove(x); }); return null; },
      retainWhere: function (o, f) { f = fnArg(f); Array.from(o).forEach(function (x) { if (!R.cond(f(x))) o.remove(x); }); return null; },
      lookup: function (o, v) { return o.has(v) ? o.m.get(hash(v)) : null; },
      toSet: function (o) { var s = new DSet(o.$t); for (var x of o) s.add(x); return s; },
    }));
    var MAP = M({
      length: function (o) { return I(o.m.size); }, isEmpty: function (o) { return o.m.size === 0; }, isNotEmpty: function (o) { return o.m.size > 0; },
      keys: function (o) { return iteravel(function* () { for (var e of o.m.values()) yield e[0]; }); },
      values: function (o) { return iteravel(function* () { for (var e of o.m.values()) yield e[1]; }); },
      entries: function (o) { return iteravel(function* () { for (var e of o.m.values()) yield new DMapEntry(e[0], e[1]); }); },
      hashCode: function (o) { return hashCodeDe(o); }, runtimeType: function (o) { return new DTipo(tipoDe(o)); },
    }, {
      containsKey: function (o, k) { return o.containsKey(k); },
      containsValue: function (o, v) { for (var e of o.m.values()) if (eq(e[1], v)) return true; return false; },
      remove: function (o, k) { return o.remove(k); },
      putIfAbsent: function (o, k, f) { if (o.containsKey(k)) return o.get(k); var v = R.chamarF(f, []); o.set(k, v); return v; },
      update: function (o, k, f, n) { if (o.containsKey(k)) { var v = R.chamarF(f, [o.get(k)]); o.set(k, v); return v; } if (n && n.ifAbsent) { var v2 = R.chamarF(n.ifAbsent, []); o.set(k, v2); return v2; } lancarErro(erroArg("Key not in map.")); },
      updateAll: function (o, f) { o.forEachEntry(function (k, v, e) { e[1] = R.chamarF(f, [k, v]); }); return null; },
      forEach: function (o, f) { var es = Array.from(o.m.values()); var n = o.m.size; es.forEach(function (e) { R.chamarF(f, [e[0], e[1]]); if (o.m.size !== n) lancarErro(new (BASES.ConcurrentModificationError)(o)); }); return null; },
      addAll: function (o, b) { b.forEachEntry(function (k, v) { o.set(k, v); }); return null; },
      addEntries: function (o, es) { for (var e of iter(es)) o.set(e.m_key, e.m_value); return null; },
      clear: function (o) { o.m.clear(); return null; },
      removeWhere: function (o, f) { Array.from(o.m.values()).forEach(function (e) { if (R.cond(R.chamarF(f, [e[0], e[1]]))) o.remove(e[0]); }); return null; },
      map: function (o, f) { var m = new DMap(); o.forEachEntry(function (k, v) { var e = R.chamarF(f, [k, v]); m.set(e.m_key, e.m_value); }); return m; },
      cast: function (o) { return o; },
      toString: function (o) { return str(o); },
    });
    var REC = M({ hashCode: function (o) { return o.m_hashCode; }, runtimeType: function (o) { return new DTipo(tipoDe(o)); } }, {});
    var BOOL = M({ hashCode: function (o) { return hashCodeDe(o); }, runtimeType: function () { return new DTipo({ n: "bool" }); } }, { toString: function (o) { return o ? "true" : "false"; } });
    var FUN = M({ runtimeType: function () { return new DTipo({ n: "Function" }); } }, { call: function (o) { return o.apply(null, [].slice.call(arguments, 1, -1)); } });
    // números
    function fixo(x, d) {
      d = Number(d);
      if (d < 0 || d > 20) lancarErro(erroRange("RangeError: Invalid value: Not in inclusive range 0..20: " + d));
      x = Number(x);
      if (!isFinite(x)) return dstr(x);
      if (Math.abs(x) >= 1e21) return dstr(x);
      return x.toFixed(d);
    }
    function precisao(x, d) { x = Number(x); return x.toPrecision(Number(d)); }
    function arred(x) { if (!isFinite(x)) lancarErro(erroUnsup(dstr(x))); return BigInt(Math.sign(x) * Math.round(Math.abs(x))); }
    var NUM_GET = {
      isEven: function (o) { return typeof o === "bigint" ? o % 2n === 0n : undefined; },
      isOdd: function (o) { return typeof o === "bigint" ? o % 2n !== 0n : undefined; },
      isNegative: function (o) { return typeof o === "bigint" ? o < 0n : (o < 0 || Object.is(o, -0)); },
      isNaN: function (o) { return typeof o === "number" && isNaN(o); },
      isInfinite: function (o) { return o === Infinity || o === -Infinity; },
      isFinite: function (o) { return typeof o === "bigint" || isFinite(o); },
      sign: function (o) { return typeof o === "bigint" ? (o > 0n ? 1n : o < 0n ? -1n : 0n) : Math.sign(o); },
      hashCode: function (o) { return hashCodeDe(o); },
      runtimeType: function (o) { return new DTipo(tipoDe(o)); },
      bitLength: function (o) { var n = o < 0n ? ~o : o; return BigInt(n.toString(2).length - (n === 0n ? 1 : 0)); },
    };
    var NUM_MET = {
      toString: function (o) { return str(o); },
      abs: function (o) { return typeof o === "bigint" ? (o < 0n ? -o : o) : Math.abs(o); },
      toDouble: function (o) { return Number(o); },
      toInt: function (o) { if (typeof o === "bigint") return o; if (!isFinite(o)) throw new Lancado(erroUnsup("Infinity or NaN toInt"), ["double.toInt (dart:core-patch/double.dart)"]); return BigInt(Math.trunc(o)); },
      round: function (o) { return typeof o === "bigint" ? o : arred(o); },
      floor: function (o) { if (typeof o === "bigint") return o; if (!isFinite(o)) lancarErro(erroUnsup(dstr(o))); return BigInt(Math.floor(o)); },
      ceil: function (o) { if (typeof o === "bigint") return o; if (!isFinite(o)) lancarErro(erroUnsup(dstr(o))); return BigInt(Math.ceil(o)); },
      truncate: function (o) { if (typeof o === "bigint") return o; return BigInt(Math.trunc(o)); },
      roundToDouble: function (o) { return Math.sign(Number(o)) * Math.round(Math.abs(Number(o))); },
      floorToDouble: function (o) { return Math.floor(Number(o)); }, ceilToDouble: function (o) { return Math.ceil(Number(o)); }, truncateToDouble: function (o) { return Math.trunc(Number(o)); },
      toStringAsFixed: function (o, d) { return fixo(o, d); },
      toStringAsPrecision: function (o, d) { return precisao(o, d); },
      toStringAsExponential: function (o, d) { return Number(o).toExponential(d === undefined || d === null || typeof d === "object" ? undefined : Number(d)); },
      toRadixString: function (o, r) { return o.toString(Number(r)); },
      compareTo: function (o, b) { return BigInt(comparar(o, b)); },
      clamp: function (o, a, b) { if (R.lt(o, a)) return a; if (R.gt(o, b)) return b; return o; },
      remainder: function (o, b) { if (typeof o === "bigint" && typeof b === "bigint") { if (b === 0n) lancarErro(new (BASES.IntegerDivisionByZeroException)()); return o % b; } return Number(o) % Number(b); },
      gcd: function (o, b) { var a = o < 0n ? -o : o; b = b < 0n ? -b : b; while (b) { var t = a % b; a = b; b = t; } return a; },
      pow: function (o, e) { return w64(o ** e); },
      modPow: function (o, e, m) { var r = 1n, b = o % m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; },
      toUnsigned: function (o, w) { return BigInt.asUintN(Number(w), o); }, toSigned: function (o, w) { return BigInt.asIntN(Number(w), o); },
    };
    var INT = M(NUM_GET, NUM_MET), DBL = M(NUM_GET, NUM_MET);
    // String
    function padrao(p) { return p instanceof DRegExp ? p.re : p; }
    function reGlobal(p) { if (p instanceof DRegExp) return new RegExp(p.re.source, p.re.flags.replace("g", "") + "g"); return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"); }
    var STR = M({
      length: function (o) { return I(o.length); },
      isEmpty: function (o) { return o.length === 0; }, isNotEmpty: function (o) { return o.length > 0; },
      codeUnits: function (o) { var l = []; for (var i = 0; i < o.length; i++) l.push(I(o.charCodeAt(i))); return lista(l, { n: "int" }); },
      runes: function (o) { return iteravel(function* () { for (var c of o) yield I(c.codePointAt(0)); }); },
      hashCode: function (o) { return hashCodeDe(o); }, runtimeType: function () { return new DTipo({ n: "String" }); },
    }, {
      toUpperCase: function (o) { return o.toUpperCase(); }, toLowerCase: function (o) { return o.toLowerCase(); },
      trim: function (o) { return o.trim(); }, trimLeft: function (o) { return o.trimStart(); }, trimRight: function (o) { return o.trimEnd(); },
      contains: function (o, p, ini) { var s = ini ? o.slice(Number(ini)) : o; return p instanceof DRegExp ? p.re.test(s) : s.indexOf(p) >= 0; },
      startsWith: function (o, p, i) { return p instanceof DRegExp ? new RegExp("^(?:" + p.re.source + ")").test(o.slice(i ? Number(i) : 0)) : o.startsWith(p, i ? Number(i) : 0); },
      endsWith: function (o, p) { return o.endsWith(p); },
      indexOf: function (o, p, i) { if (p instanceof DRegExp) { var m = o.slice(i ? Number(i) : 0).search(p.re); return I(m < 0 ? -1 : m + (i ? Number(i) : 0)); } return I(o.indexOf(p, i ? Number(i) : 0)); },
      lastIndexOf: function (o, p, i) { return I(i === undefined || i === null || typeof i === "object" ? o.lastIndexOf(p) : o.lastIndexOf(p, Number(i))); },
      substring: function (o, a, b) { a = Number(a); var bb = b === undefined || b === null || typeof b === "object" ? o.length : Number(b); if (a < 0 || a > o.length) lancarErro(erroRange("RangeError: Value not in range: " + a)); if (bb < a || bb > o.length) lancarErro(erroRange("RangeError: Invalid value: Not in inclusive range " + a + ".." + o.length + ": " + bb)); return o.substring(a, bb); },
      split: function (o, p) { var r = p instanceof DRegExp ? o.split(p.re) : (p === "" ? Array.from(o).reduce(function (a, c) { for (var k = 0; k < c.length; k++) a.push(c[k]); return a; }, []) : o.split(p)); if (o === "" && p !== "") r = [""]; if (o === "" && p === "") r = []; return lista(r, { n: "String" }); },
      replaceAll: function (o, p, r) { return o.replace(reGlobal(p), function () { return r; }); },
      replaceFirst: function (o, p, r) { var re = reGlobal(p); var feito = false; return o.replace(re, function (m) { if (feito) return m; feito = true; return r; }); },
      replaceAllMapped: function (o, p, f) { return o.replace(reGlobal(p), function () { var a = [].slice.call(arguments); var m = criarMatch(a); return str(R.chamarF(f, [m])); }); },
      replaceRange: function (o, a, b, r) { return o.slice(0, Number(a)) + r + o.slice(b === null ? o.length : Number(b)); },
      padLeft: function (o, n, c) { n = Number(n); c = typeof c === "string" ? c : " "; var falta = n - o.length; return falta > 0 ? c.repeat(falta) + o : o; },
      padRight: function (o, n, c) { n = Number(n); c = typeof c === "string" ? c : " "; var falta = n - o.length; return falta > 0 ? o + c.repeat(falta) : o; },
      compareTo: function (o, b) { return BigInt(comparar(o, b)); },
      codeUnitAt: function (o, i) { i = Number(i); checarIndice(i, o.length, "index"); return I(o.charCodeAt(i)); },
      toString: function (o) { return o; },
      allMatches: function (o, s) { return ocorrencias(o, s); },
      matchAsPrefix: function (o, s) { return null; },
    });
    // Future (Promise) e Stream
    var FUT = M({}, {
      then: function (o, f, n) { var r = o.then(function (v) { return R.chamarF(f, [v]); }); if (n && n.onError) r = r.catch(function (e) { return R.chamarF(n.onError, [valorErro(e)]); }); return r; },
      catchError: function (o, f) { return o.catch(function (e) { var v = valorErro(e); return R.chamarF(f, f.length >= 2 ? [v, new DStackTrace("")] : [v]); }); },
      whenComplete: function (o, f) { return o.finally(function () { return R.chamarF(f, []); }); },
      timeout: function (o, d, n) { return Promise.race([o, new Promise(function (ok, falha) { timer(function () { if (n && n.onTimeout) ok(R.chamarF(n.onTimeout, [])); else { var t = new (BASES.TimeoutException)(); t.m_message = "Future not completed"; t.m_duration = d; falha(new Lancado(t)); } }, d.us / 1000); })]); },
      ignore: function () { return null; },
    });
    function valorErro(e) { return e instanceof Lancado ? e.valor : e; }

    /* ---------- classes da biblioteca: construtores ---------- */
    function DDuration(us) { this.us = us; }
    DDuration.prototype = Object.create(DObject.prototype);
    DDuration.prototype.$nome = "Duration";
    DDuration.prototype.m_toString = function () {
      var us = this.us, neg = us < 0; if (neg) us = -us;
      var h = Math.floor(us / 3600e6), m = Math.floor(us / 60e6) % 60, s = Math.floor(us / 1e6) % 60, f = us % 1e6;
      return (neg ? "-" : "") + h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + String(f).padStart(6, "0");
    };
    DDuration.prototype.$eq = function (o) { return o instanceof DDuration && o.us === this.us; };
    ["inDays:864e8", "inHours:36e8", "inMinutes:6e7", "inSeconds:1e6", "inMilliseconds:1e3", "inMicroseconds:1"].forEach(function (x) {
      var p = x.split(":"); Object.defineProperty(DDuration.prototype, "m_" + p[0], { get: function () { return BigInt(Math.trunc(this.us / Number(p[1]))); } });
    });
    DDuration.prototype["m_+"] = function (o) { return new DDuration(this.us + o.us); };
    DDuration.prototype["m_-"] = function (o) { return new DDuration(this.us - o.us); };
    DDuration.prototype["m_*"] = function (n) { return new DDuration(Math.round(this.us * Number(n))); };
    DDuration.prototype["m_<"] = function (o) { return this.us < o.us; }; DDuration.prototype["m_>"] = function (o) { return this.us > o.us; };
    DDuration.prototype["m_<="] = function (o) { return this.us <= o.us; }; DDuration.prototype["m_>="] = function (o) { return this.us >= o.us; };
    DDuration.prototype.m_compareTo = function (o) { return BigInt(Math.sign(this.us - o.us)); };
    Object.defineProperty(DDuration.prototype, "m_isNegative", { get: function () { return this.us < 0; } });
    DDuration.prototype.m_abs = function () { return new DDuration(Math.abs(this.us)); };
    function duracao(n) { n = n || {}; var us = 0; var f = { days: 864e8, hours: 36e8, minutes: 6e7, seconds: 1e6, milliseconds: 1e3, microseconds: 1 }; for (var k in f) if (n[k] !== undefined && n[k] !== null) us += Number(n[k]) * f[k]; return new DDuration(Math.round(us)); }

    function DDateTime(ms, utc) { this.ms = ms; this.utc = !!utc; this.d = new Date(ms); }
    DDateTime.prototype = Object.create(DObject.prototype);
    DDateTime.prototype.$nome = "DateTime";
    function p2(n) { return String(n).padStart(2, "0"); }
    var DT_CAMPOS = { year: "FullYear", month: "Month", day: "Date", hour: "Hours", minute: "Minutes", second: "Seconds", millisecond: "Milliseconds" };
    Object.keys(DT_CAMPOS).forEach(function (k) {
      Object.defineProperty(DDateTime.prototype, "m_" + k, { get: function () { var v = this.d[(this.utc ? "getUTC" : "get") + DT_CAMPOS[k]](); return BigInt(k === "month" ? v + 1 : v); } });
    });
    Object.defineProperty(DDateTime.prototype, "m_weekday", { get: function () { var w = this.d[this.utc ? "getUTCDay" : "getDay"](); return BigInt(w === 0 ? 7 : w); } });
    Object.defineProperty(DDateTime.prototype, "m_microsecond", { get: function () { return 0n; } });
    Object.defineProperty(DDateTime.prototype, "m_millisecondsSinceEpoch", { get: function () { return BigInt(this.ms); } });
    Object.defineProperty(DDateTime.prototype, "m_isUtc", { get: function () { return this.utc; } });
    DDateTime.prototype.m_toString = function () {
      var y = Number(this.m_year), s = (y < 0 ? "-" : "") + String(Math.abs(y)).padStart(4, "0") + "-" + p2(this.m_month) + "-" + p2(this.m_day) + " " + p2(this.m_hour) + ":" + p2(this.m_minute) + ":" + p2(this.m_second) + "." + String(this.m_millisecond).padStart(3, "0");
      return s + (this.utc ? "Z" : "");
    };
    DDateTime.prototype.m_toIso8601String = function () { return this.m_toString().replace(" ", "T"); };
    DDateTime.prototype.m_add = function (d) { return new DDateTime(this.ms + d.us / 1000, this.utc); };
    DDateTime.prototype.m_subtract = function (d) { return new DDateTime(this.ms - d.us / 1000, this.utc); };
    DDateTime.prototype.m_difference = function (o) { return new DDuration((this.ms - o.ms) * 1000); };
    DDateTime.prototype.m_isBefore = function (o) { return this.ms < o.ms; };
    DDateTime.prototype.m_isAfter = function (o) { return this.ms > o.ms; };
    DDateTime.prototype.m_isAtSameMomentAs = function (o) { return this.ms === o.ms; };
    DDateTime.prototype.m_compareTo = function (o) { return BigInt(Math.sign(this.ms - o.ms)); };
    DDateTime.prototype.m_toUtc = function () { return new DDateTime(this.ms, true); };
    DDateTime.prototype.m_toLocal = function () { return new DDateTime(this.ms, false); };
    DDateTime.prototype.$eq = function (o) { return o instanceof DDateTime && o.ms === this.ms && o.utc === this.utc; };
    function dataDe(a, utc) {
      var n = a.map(function (x) { return x === undefined || x === null ? null : Number(x); });
      var args = [n[0], n[1] == null ? 0 : n[1] - 1, n[2] == null ? 1 : n[2], n[3] || 0, n[4] || 0, n[5] || 0, n[6] || 0];
      var ms = utc ? Date.UTC.apply(null, args) : new (Function.prototype.bind.apply(Date, [null].concat(args)))().getTime();
      if (n[0] >= 0 && n[0] < 100) { var d = new Date(ms); if (utc) d.setUTCFullYear(n[0]); else d.setFullYear(n[0]); ms = d.getTime(); }
      return new DDateTime(ms, utc);
    }

    function DStringBuffer(s) { this.s = s === undefined || s === null ? "" : str(s); }
    DStringBuffer.prototype = Object.create(DObject.prototype);
    DStringBuffer.prototype.$nome = "StringBuffer";
    DStringBuffer.prototype.m_write = function (v) { this.s += str(v); return null; };
    DStringBuffer.prototype.m_writeln = function (v) { this.s += (v === undefined ? "" : str(v)) + "\n"; return null; };
    DStringBuffer.prototype.m_writeAll = function (l, sep) { this.s += paraArray(l).map(str).join(typeof sep === "string" ? sep : ""); return null; };
    DStringBuffer.prototype.m_writeCharCode = function (c) { this.s += String.fromCharCode(Number(c)); return null; };
    DStringBuffer.prototype.m_clear = function () { this.s = ""; return null; };
    DStringBuffer.prototype.m_toString = function () { return this.s; };
    Object.defineProperty(DStringBuffer.prototype, "m_length", { get: function () { return BigInt(this.s.length); } });
    Object.defineProperty(DStringBuffer.prototype, "m_isEmpty", { get: function () { return this.s.length === 0; } });
    Object.defineProperty(DStringBuffer.prototype, "m_isNotEmpty", { get: function () { return this.s.length > 0; } });

    function DRegExp(src, n) { n = n || {}; this.src = src; this.re = new RegExp(src, (n.caseSensitive === false ? "i" : "") + (n.multiLine ? "m" : "") + (n.dotAll ? "s" : "") + (n.unicode ? "u" : "")); }
    DRegExp.prototype = Object.create(DObject.prototype);
    DRegExp.prototype.$nome = "RegExp";
    DRegExp.prototype.m_hasMatch = function (s) { return this.re.test(s); };
    DRegExp.prototype.m_firstMatch = function (s) { var m = this.re.exec(s); return m ? criarMatch(m) : null; };
    DRegExp.prototype.m_allMatches = function (s) { return ocorrencias(this, s); };
    DRegExp.prototype.m_stringMatch = function (s) { var m = this.re.exec(s); return m ? m[0] : null; };
    DRegExp.prototype.m_toString = function () { return "RegExp: pattern=" + this.src + " flags=" + this.re.flags; };
    Object.defineProperty(DRegExp.prototype, "m_pattern", { get: function () { return this.src; } });
    function ocorrencias(padrao, s) { var re = reGlobal(padrao), l = [], m; while ((m = re.exec(s))) { l.push(criarMatch(m)); if (m[0] === "") re.lastIndex++; } return iteravel(function* () { yield* l; }); }
    function criarMatch(m) {
      var arr = Array.isArray(m) ? m : m;
      var grupos = Array.isArray(m) && typeof m[m.length - 1] === "object" && !Array.isArray(m[m.length - 1]) && m.index === undefined ? m[m.length - 1] : m.groups;
      var idx = m.index !== undefined ? m.index : m[m.length - 2 - (typeof m[m.length - 1] === "object" ? 1 : 0)];
      var gs = Array.isArray(m) && m.index === undefined ? m.slice(0, m.length - 2 - (typeof m[m.length - 1] === "object" ? 1 : 0)) : Array.from(m);
      return {
        $nome: "RegExpMatch",
        m_group: function (i) { var v = gs[Number(i)]; return v === undefined ? null : v; },
        m_namedGroup: function (n) { return grupos && grupos[n] !== undefined ? grupos[n] : null; },
        "m_[]": function (i) { var v = gs[Number(i)]; return v === undefined ? null : v; },
        get m_start() { return BigInt(idx); }, get m_end() { return BigInt(idx + gs[0].length); },
        get m_groupCount() { return BigInt(gs.length - 1); },
        m_toString: function () { return "Instance of '_RegExpMatch'"; },
      };
    }

    // Random do Dart (mesmo algoritmo da VM: sementes iguais dão os mesmos números)
    var MASK64 = (1n << 64n) - 1n, MASK32 = (1n << 32n) - 1n, A = 0xffffda61n;
    function DRandom(seed) {
      if (seed === null || seed === undefined) seed = BigInt(ctx.semente ? ctx.semente() : Math.floor(Math.random() * 2 ** 31));
      var s = BigInt.asUintN(64, setupSeed(BigInt(seed)));
      if (s === 0n) s = 0x5a17n;
      this.s = s;
      for (var i = 0; i < 4; i++) this.prox();
    }
    function setupSeed(seed) {
      var n = BigInt.asIntN(64, seed);
      n = BigInt.asIntN(64, (~n) + (n << 21n));
      n = n ^ (BigInt.asUintN(64, n) >> 24n); n = BigInt.asIntN(64, n);
      n = BigInt.asIntN(64, (n + (n << 3n)) + (n << 8n));
      n = BigInt.asIntN(64, n ^ (BigInt.asUintN(64, n) >> 14n));
      n = BigInt.asIntN(64, (n + (n << 2n)) + (n << 4n));
      n = BigInt.asIntN(64, n ^ (BigInt.asUintN(64, n) >> 28n));
      n = BigInt.asIntN(64, n + (n << 31n));
      if (n === 0n) n = 0x5a17n;
      return n;
    }
    DRandom.prototype = Object.create(DObject.prototype);
    DRandom.prototype.$nome = "Random";
    DRandom.prototype.prox = function () { var lo = this.s & MASK32, hi = this.s >> 32n; this.s = (A * lo + hi) & MASK64; };
    DRandom.prototype.m_nextInt = function (max) {
      max = BigInt(max);
      if (max <= 0n || max > (1n << 32n)) lancarErro(erroRange("RangeError: max must be in range 0 < max ≤ 2^32, was " + max));
      if ((max & -max) === max) { this.prox(); return (this.s & MASK32) & (max - 1n); }
      var rnd, r;
      do { this.prox(); rnd = this.s & MASK32; r = rnd % max; } while ((rnd - r + max) > (1n << 32n));
      return r;
    };
    DRandom.prototype.m_nextDouble = function () { return (Number(this.m_nextInt(1n << 26n)) * 134217728 + Number(this.m_nextInt(1n << 27n))) / 9007199254740992; };
    DRandom.prototype.m_nextBool = function () { return this.m_nextInt(2n) === 0n; };
    var _aleat = null;
    function aleatorioPadrao() { return _aleat || (_aleat = new DRandom(null)); }

    // Stream (simples): fonte assíncrona
    function DStream(fonte) { this.fonte = fonte; } // fonte(): async iterator
    DStream.prototype.$nome = "Stream";
    DStream.prototype.asyncIter = function () { var f = this.fonte; return { [Symbol.asyncIterator]: function () { return f(); } }; };
    DStream.prototype.m_toString = function () { return "Instance of 'Stream<dynamic>'"; };
    R.DStream = DStream;
    R.stream = function (gen) { return new DStream(function () { return gen(); }); };
    function streamDe(asyncGen) { return new DStream(asyncGen); }
    var STREAM = M({
      first: function (o) { return (async function () { for await (var x of o.asyncIter()) return x; lancarErro(erroEstado("No element")); })(); },
      last: function (o) { return (async function () { var u, tem = false; for await (var x of o.asyncIter()) { u = x; tem = true; } if (!tem) lancarErro(erroEstado("No element")); return u; })(); },
      length: function (o) { return (async function () { var n = 0n; for await (var x of o.asyncIter()) n++; return n; })(); },
      isEmpty: function (o) { return (async function () { for await (var x of o.asyncIter()) return false; return true; })(); },
      isBroadcast: function () { return false; },
    }, {
      listen: function (o, f, n) {
        n = n || {}; var cancelado = false, pausado = null;
        var sub = { $nome: "StreamSubscription", m_cancel: function () { cancelado = true; return Promise.resolve(null); }, m_pause: function () {}, m_resume: function () {}, m_toString: function () { return "Instance of '_ControllerSubscription<dynamic>'"; } };
        pendentes++;
        (async function () {
          try { for await (var x of o.asyncIter()) { if (cancelado) break; if (f) R.chamarF(f, [x]); } if (!cancelado && n.onDone) R.chamarF(n.onDone, []); }
          catch (e) { if (e instanceof Sinal) throw e; if (n.onError) R.chamarF(n.onError, [valorErro(e)]); else erroNaoTratado(e); }
          finally { pendentes--; verificarFim(); }
        })();
        return sub;
      },
      map: function (o, f) { return streamDe(async function* () { for await (var x of o.asyncIter()) yield R.chamarF(f, [x]); }); },
      where: function (o, f) { return streamDe(async function* () { for await (var x of o.asyncIter()) if (R.chamarF(f, [x])) yield x; }); },
      take: function (o, n) { return streamDe(async function* () { var i = 0; if (n <= 0n) return; for await (var x of o.asyncIter()) { yield x; if (++i >= Number(n)) return; } }); },
      skip: function (o, n) { return streamDe(async function* () { var i = 0; for await (var x of o.asyncIter()) { if (i++ >= Number(n)) yield x; } }); },
      asyncMap: function (o, f) { return streamDe(async function* () { for await (var x of o.asyncIter()) yield await R.chamarF(f, [x]); }); },
      toList: function (o) { return (async function () { var l = []; for await (var x of o.asyncIter()) l.push(x); return lista(l); })(); },
      forEach: function (o, f) { return (async function () { for await (var x of o.asyncIter()) R.chamarF(f, [x]); return null; })(); },
      fold: function (o, ini, f) { return (async function () { var a = ini; for await (var x of o.asyncIter()) a = R.chamarF(f, [a, x]); return a; })(); },
      reduce: function (o, f) { return (async function () { var a, p = true; for await (var x of o.asyncIter()) { if (p) { a = x; p = false; } else a = R.chamarF(f, [a, x]); } return a; })(); },
      join: function (o, sep) { return (async function () { var l = []; for await (var x of o.asyncIter()) l.push(str(x)); return l.join(typeof sep === "string" ? sep : ""); })(); },
      contains: function (o, v) { return (async function () { for await (var x of o.asyncIter()) if (eq(x, v)) return true; return false; })(); },
      handleError: function (o, f) { return streamDe(async function* () { try { for await (var x of o.asyncIter()) yield x; } catch (e) { if (e instanceof Sinal) throw e; R.chamarF(f, [valorErro(e)]); } }); },
      timeout: function (o) { return o; },
      distinct: function (o) { return streamDe(async function* () { var prim = true, ant; for await (var x of o.asyncIter()) { if (prim || !eq(x, ant)) yield x; prim = false; ant = x; } }); },
      expand: function (o, f) { return streamDe(async function* () { for await (var x of o.asyncIter()) for (var y of iter(R.chamarF(f, [x]))) yield y; }); },
      asBroadcastStream: function (o) { return o; },
      cast: function (o) { return o; },
    });

    function controlador() {
      var fila = [], esperando = null, fechado = false, ouvintes = [];
      var c = { $nome: "StreamController" };
      function empurra(item) { if (esperando) { var w = esperando; esperando = null; w(item); } else fila.push(item); }
      c.m_add = function (v) { empurra({ v: v }); return null; };
      c.m_addError = function (e) { empurra({ e: e }); return null; };
      c.m_close = function () { fechado = true; empurra({ fim: true }); return Promise.resolve(null); };
      Object.defineProperty(c, "m_isClosed", { get: function () { return fechado; } });
      Object.defineProperty(c, "m_sink", { get: function () { return c; } });
      Object.defineProperty(c, "m_hasListener", { get: function () { return true; } });
      var st = new DStream(async function* () {
        while (true) {
          var item = fila.length ? fila.shift() : await new Promise(function (ok) { esperando = ok; });
          if (item.fim) return;
          if ("e" in item) throw new Lancado(item.e);
          yield item.v;
        }
      });
      Object.defineProperty(c, "m_stream", { get: function () { return st; } });
      c.m_toString = function () { return "Instance of '_AsyncStreamController<dynamic>'"; };
      return c;
    }

    /* ---------- tempo, timers e o laço de eventos ---------- */
    var pendentes = 0, timers = new Set(), aoFim = null;
    function timer(f, ms) {
      pendentes++;
      var h = ctx.setTimeout(function () { timers.delete(h); pendentes--; if (parado) return; try { f(); } catch (e) { erroNaoTratado(e); } verificarFim(); }, Math.max(0, ms));
      timers.add(h);
      return h;
    }
    function cancelarTimer(h) { if (timers.has(h)) { ctx.clearTimeout(h); timers.delete(h); pendentes--; verificarFim(); } }
    R.cancelarTudo = function () { timers.forEach(function (h) { ctx.clearTimeout(h); }); timers.clear(); pendentes = 0; };
    function agendarMicro(f) { Promise.resolve().then(function () { if (parado) return; try { R.chamarF(f, []); } catch (e) { erroNaoTratado(e); } }); }
    function verificarFim() { if (aoFim && pendentes === 0) { var f = aoFim; ctx.setTimeout(function () { if (pendentes === 0 && aoFim === f) { aoFim = null; f(); } }, 0); } }
    R.esperarFim = function (f) { aoFim = f; verificarFim(); };
    var naoTratado = null;
    function erroNaoTratado(e) { if (e instanceof Sinal) { if (ctx.aoSinal) ctx.aoSinal(e); return; } if (ctx.aoErro) ctx.aoErro(e, true); }
    R.erroNaoTratado = erroNaoTratado;
    R.aguardar = function (v, f, p) { if (f) { f.async = true; f.p = p; } return v; };
    R.retomou = function (f, v) { if (f) f.async = true; return v; };
    R.futuro = function (p, t) { p.$t = t; return p; };
    R.futuroT = function (p, t) { if (p instanceof Promise && !p.$t) p.$t = t; return p; };

    function futuroDelayed(d, f) {
      return new Promise(function (ok, falha) {
        timer(function () { try { ok(f ? R.chamarF(f, []) : null); } catch (e) { falha(e); } }, d ? d.us / 1000 : 0);
      });
    }
    function completer() {
      var ok, falha, feito = false;
      var p = new Promise(function (a, b) { ok = a; falha = b; });
      p.catch(function () {});
      pendentes++;
      return { $nome: "Completer", m_complete: function (v) { if (feito) lancarErro(erroEstado("Future already completed")); feito = true; pendentes--; ok(v === undefined ? null : v); verificarFim(); return null; }, m_completeError: function (e) { feito = true; pendentes--; falha(new Lancado(e)); verificarFim(); return null; }, get m_future() { return p; }, get m_isCompleted() { return feito; }, m_toString: function () { return "Instance of '_AsyncCompleter<dynamic>'"; } };
    }

    /* ---------- parse ---------- */
    function intParse(s, n, tentar) {
      var radix = n && n.radix !== undefined && n.radix !== null ? Number(n.radix) : 10;
      if (typeof s !== "string") lancarErro(erroTipo("type '" + nomeTipo(s) + "' is not a subtype of type 'String'"));
      var t = s.trim();
      var re = radix === 10 ? /^[+-]?\d+$/ : radix === 16 ? /^[+-]?(0x)?[0-9a-f]+$/i : new RegExp("^[+-]?[" + "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, radix) + "]+$", "i");
      if (radix === 10 && /^[+-]?0x[0-9a-f]+$/i.test(t)) { var neg = t[0] === "-"; var v0 = BigInt(t.replace(/^[+-]/, "")); return neg ? -v0 : v0; }
      if (!re.test(t)) {
        if (tentar) return null;
        var ex = erroFormato("Invalid radix-" + radix + " number", s, " (at character 1)\n" + s + "\n^\n");
        throw new Lancado(ex, ["int._handleFormatError (dart:core-patch/integers_patch.dart:150:5)", "int._parseRadix (dart:core-patch/integers_patch.dart:179:14)", "int._parse (dart:core-patch/integers_patch.dart:121:12)", "int.parse (dart:core-patch/integers_patch.dart:81:12)"]);
      }
      var neg2 = t[0] === "-"; var corpo = t.replace(/^[+-]/, "").replace(/^0x/i, "");
      var v = 0n, R2 = BigInt(radix);
      for (var i = 0; i < corpo.length; i++) v = v * R2 + BigInt(parseInt(corpo[i], radix));
      v = neg2 ? -v : v;
      if (v > MAX64 || v < MIN64) { if (tentar) return null; throw new Lancado(erroFormato("Invalid radix-" + radix + " number", s, " (at character 1)\n" + s + "\n^\n"), ["int._handleFormatError (dart:core-patch/integers_patch.dart:150:5)", "int.parse (dart:core-patch/integers_patch.dart:81:12)"]); }
      return v;
    }
    function doubleParse(s, tentar) {
      var t = String(s).trim();
      if (/^[+-]?(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?|Infinity|NaN)$/.test(t)) return Number(t);
      if (/^[+-]?0x[0-9a-f]+$/i.test(t)) return Number(BigInt(t.replace(/^[+-]/, ""))) * (t[0] === "-" ? -1 : 1);
      if (tentar) return null;
      throw new Lancado(erroFormato("Invalid double", s), ["double.parse (dart:core-patch/double_patch.dart:111:7)"]);
    }

    /* ---------- dart:convert ---------- */
    function jsonEncode(v, ind) {
      function enc(x, nivel) {
        if (x === null || x === undefined) return "null";
        if (typeof x === "bigint") return x.toString();
        if (typeof x === "number") { if (!isFinite(x)) lancarErro(erroArg("Converting object did not return an encodable object")); return Number.isInteger(x) ? dstr(x) : String(x); }
        if (typeof x === "boolean") return String(x);
        if (typeof x === "string") return JSON.stringify(x);
        var sep = ind ? "\n" + ind.repeat(nivel + 1) : "", fim = ind ? "\n" + ind.repeat(nivel) : "";
        if (Array.isArray(x)) return x.length ? "[" + sep + x.map(function (y) { return enc(y, nivel + 1); }).join("," + sep) + fim + "]" : "[]";
        if (x instanceof DMap) { var p = []; x.forEachEntry(function (k, y) { p.push(JSON.stringify(str(k)) + (ind ? ": " : ":") + enc(y, nivel + 1)); }); return p.length ? "{" + sep + p.join("," + sep) + fim + "}" : "{}"; }
        if (x.m_toJson) return enc(x.m_toJson(), nivel);
        var e = new (classeBase("JsonUnsupportedObjectError"))(); e.$texto = "Converting object to an encodable object failed: " + str(x); e.m_toString = function () { return this.$texto; };
        lancarErro(e);
      }
      return enc(v, 0);
    }
    function jsonDecode(s) {
      var v;
      try { v = JSON.parse(s, function (k, x) { return x; }); }
      catch (e) { throw new Lancado(erroFormato("Unexpected character", s, " (at character 1)\n" + s + "\n^\n")); }
      function conv(x) {
        if (x === null) return null;
        if (typeof x === "number") return Number.isInteger(x) && !/[.eE]/.test(String(x)) ? BigInt(x) : x;
        if (Array.isArray(x)) return lista(x.map(conv));
        if (typeof x === "object") { var m = new DMap(); Object.keys(x).forEach(function (k) { m.set(k, conv(x[k])); }); return m; }
        return x;
      }
      // números: preserva int × double olhando o texto
      var nums = [];
      String(s).replace(/"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, function (m, n) { if (n !== undefined) nums.push(n); return m; });
      var k = 0;
      function conv2(x) {
        if (x === null) return null;
        if (typeof x === "number") { var t = nums[k++] || String(x); return /[.eE]/.test(t) ? x : BigInt(t); }
        if (Array.isArray(x)) return lista(x.map(conv2));
        if (typeof x === "object") { var m = new DMap(); Object.keys(x).forEach(function (kk) { m.set(kk, conv2(x[kk])); }); return m; }
        return x;
      }
      return conv2(v);
    }

    /* ---------- dart:io: File (pasta da Ana, na memória) ---------- */
    var FS = ctx.arquivos || {};
    function arquivo(caminho) {
      var nome = String(caminho).replace(/^\.\//, "").replace(/^\/home\/ana\//, "");
      var f = { $nome: "_File" };
      function existe() { return Object.prototype.hasOwnProperty.call(FS, nome); }
      function ler() { if (!existe()) { var e = new (BASES.PathNotFoundException)(); e.m_path = caminho; e.m_message = "Cannot open file"; lancarErro(e); } return FS[nome]; }
      f.m_existsSync = function () { return existe(); };
      f.m_exists = function () { return Promise.resolve(existe()); };
      f.m_readAsStringSync = function () { return ler(); };
      f.m_readAsString = function () { return new Promise(function (ok) { ok(ler()); }); };
      f.m_readAsLinesSync = function () { var t = ler(); var l = t.split("\n"); if (l[l.length - 1] === "") l.pop(); return lista(l, { n: "String" }); };
      f.m_readAsLines = function () { return Promise.resolve(f.m_readAsLinesSync()); };
      f.m_writeAsStringSync = function (s, n) { var modo = n && n.mode; FS[nome] = (modo && modo.$append && existe() ? FS[nome] : "") + str(s); return null; };
      f.m_writeAsString = function (s, n) { f.m_writeAsStringSync(s, n); return Promise.resolve(f); };
      f.m_deleteSync = function () { ler(); delete FS[nome]; return null; };
      f.m_delete = function () { f.m_deleteSync(); return Promise.resolve(f); };
      f.m_createSync = function () { if (!existe()) FS[nome] = ""; return null; };
      f.m_create = function () { f.m_createSync(); return Promise.resolve(f); };
      f.m_lengthSync = function () { return BigInt(new TextEncoder().encode(ler()).length); };
      f.m_openWrite = function (n) { var modo = n && n.mode; if (!(modo && modo.$append) || !existe()) FS[nome] = ""; return { $nome: "_IOSinkImpl", m_write: function (v) { FS[nome] += str(v); return null; }, m_writeln: function (v) { FS[nome] += (v === undefined ? "" : str(v)) + "\n"; return null; }, m_close: function () { return Promise.resolve(null); }, m_flush: function () { return Promise.resolve(null); } }; };
      Object.defineProperty(f, "m_path", { get: function () { return caminho; } });
      f.m_toString = function () { return "File: '" + caminho + "'"; };
      return f;
    }
    R.arquivos = FS;

    /* ---------- criar objetos da biblioteca ---------- */
    var ESTATICOS = {
      int: { parse: function (s, n) { return intParse(s, n, false); }, tryParse: function (s, n) { return intParse(s, n, true); }, fromEnvironment: function () { return 0n; } },
      double: { parse: function (s) { return doubleParse(s, false); }, tryParse: function (s) { return doubleParse(s, true); }, infinity: Infinity, negativeInfinity: -Infinity, nan: NaN, maxFinite: Number.MAX_VALUE, minPositive: 5e-324 },
      num: { parse: function (s) { var t = String(s).trim(); if (/^[+-]?\d+$/.test(t)) return intParse(s, null, false); return doubleParse(s, false); }, tryParse: function (s) { var t = String(s).trim(); if (/^[+-]?\d+$/.test(t)) return intParse(s, null, true); return doubleParse(s, true); } },
      String: { fromCharCode: function (c) { return String.fromCodePoint(Number(c)); }, fromCharCodes: function (l) { return paraArray(l).map(function (c) { return String.fromCodePoint(Number(c)); }).join(""); } },
      bool: { parse: function (s) { if (s === "true") return true; if (s === "false") return false; lancarErro(erroFormato("Invalid boolean", s)); }, tryParse: function (s) { return s === "true" ? true : s === "false" ? false : null; } },
      DateTime: { now: function () { return new DDateTime(ctx.agora ? ctx.agora() : Date.now()); }, parse: function (s) { var d = Date.parse(s.replace(" ", "T")); if (isNaN(d)) lancarErro(erroFormato("Invalid date format", s)); return new DDateTime(d, /Z$/.test(s)); }, tryParse: function (s) { var d = Date.parse(String(s).replace(" ", "T")); return isNaN(d) ? null : new DDateTime(d, /Z$/.test(s)); }, utc: function () { return dataDe([].slice.call(arguments), true); }, fromMillisecondsSinceEpoch: function (ms, n) { return new DDateTime(Number(ms), n && n.isUtc); }, monday: 1n, tuesday: 2n, wednesday: 3n, thursday: 4n, friday: 5n, saturday: 6n, sunday: 7n, january: 1n, december: 12n },
      Duration: { zero: new DDuration(0), microsecondsPerSecond: 1000000n, millisecondsPerSecond: 1000n, secondsPerMinute: 60n, minutesPerHour: 60n, hoursPerDay: 24n },
      List: {
        filled: function (n, v, o) { var l = lista(new Array(Number(n)).fill(v)); if (!(o && o.growable)) l.$fixa = true; return l; },
        generate: function (n, f, o) { var l = []; for (var i = 0; i < Number(n); i++) l.push(R.chamarF(f, [I(i)])); return lista(l); },
        empty: function (o) { var l = lista([]); if (!(o && o.growable)) l.$fixa = true; return l; },
        from: function (it, o) { var l = lista(Array.from(iter(it))); if (o && o.growable === false) l.$fixa = true; return l; },
        of: function (it) { return lista(Array.from(iter(it))); },
        unmodifiable: function (it) { var l = lista(Array.from(iter(it))); l.$fixa = true; l.$imut = true; return l; },
        copyRange: function () { return null; },
      },
      Map: { from: function (m) { var r = new DMap(); m.forEachEntry(function (k, v) { r.set(k, v); }); return r; }, of: function (m) { return ESTATICOS.Map.from(m); }, fromEntries: function (es) { var r = new DMap(); for (var e of iter(es)) r.set(e.m_key, e.m_value); return r; }, fromIterables: function (ks, vs) { var r = new DMap(), a = paraArray(ks), b = paraArray(vs); a.forEach(function (k, i) { r.set(k, b[i]); }); return r; }, fromIterable: function (it, n) { var r = new DMap(); for (var x of iter(it)) r.set(n && n.key ? R.chamarF(n.key, [x]) : x, n && n.value ? R.chamarF(n.value, [x]) : x); return r; }, unmodifiable: function (m) { var r = ESTATICOS.Map.from(m); r.$imut = true; return r; } },
      Set: { from: function (it) { var s = new DSet(); for (var x of iter(it)) s.add(x); return s; }, of: function (it) { return ESTATICOS.Set.from(it); }, unmodifiable: function (it) { var s = ESTATICOS.Set.from(it); s.$imut = true; return s; } },
      Iterable: { generate: function (n, f) { return iteravel(function* () { for (var i = 0; i < Number(n); i++) yield f ? R.chamarF(f, [I(i)]) : I(i); }); }, empty: function () { return iteravel(function* () {}); } },
      Future: {
        delayed: function (d, f) { return futuroDelayed(d, f); },
        value: function (v) { return Promise.resolve(v === undefined ? null : v); },
        error: function (e) { var p = Promise.reject(new Lancado(e)); return p; },
        wait: function (l) { return Promise.all(paraArray(l)).then(function (r) { return lista(r); }); },
        sync: function (f) { try { return Promise.resolve(R.chamarF(f, [])); } catch (e) { return Promise.reject(e); } },
        microtask: function (f) { return Promise.resolve().then(function () { return R.chamarF(f, []); }); },
        any: function (l) { return Promise.race(paraArray(l)); },
        forEach: function (l, f) { return (async function () { for (var x of iter(l)) await R.chamarF(f, [x]); return null; })(); },
      },
      Stream: {
        fromIterable: function (it) { var a = paraArray(it); return streamDe(async function* () { for (var x of a) yield x; }); },
        value: function (v) { return streamDe(async function* () { yield v; }); },
        empty: function () { return streamDe(async function* () {}); },
        periodic: function (d, f) { var i = 0; return streamDe(async function* () { while (true) { await futuroDelayed(d); yield f ? R.chamarF(f, [I(i++)]) : null; } }); },
        fromFuture: function (fu) { return streamDe(async function* () { yield await fu; }); },
        error: function (e) { return streamDe(async function* () { throw new Lancado(e); }); },
      },
      Platform: { get operatingSystem() { return "linux"; }, isLinux: true, isWindows: false, isMacOS: false, isAndroid: false, isIOS: false, numberOfProcessors: 8n, pathSeparator: "/", localHostname: "notebook", version: "3.13.5 (stable) (Tue Sep 29 01:00:52 2026 -0700) on \"linux_x64\"", environment: null, get script() { return { $nome: "_Uri", m_toString: function () { return "file:///home/ana/" + ARQ; }, get m_path() { return "/home/ana/" + ARQ; } }; }, executable: "/usr/lib/dart/bin/dart", resolvedExecutable: "/usr/lib/dart/bin/dart", lineTerminator: "\n" },
      FileMode: { append: { $append: true, $nome: "FileMode", m_toString: function () { return "Instance of 'FileMode'"; } }, write: { $nome: "FileMode" }, read: { $nome: "FileMode" }, writeOnly: { $nome: "FileMode" }, writeOnlyAppend: { $append: true, $nome: "FileMode" } },
      Directory: { get current() { return { $nome: "_Directory", m_path: "/home/ana", m_toString: function () { return "Directory: '/home/ana'"; } }; } },
      Uri: { parse: function (s) { return { $nome: "_Uri", m_toString: function () { return s; } }; } },
      Object: { hash: function () { var h = 17; for (var i = 0; i < arguments.length; i++) { var x = arguments[i]; if (x && typeof x === "object" && !(x instanceof DObject) && Object.keys(x).length === 0) continue; h = (h * 31 + Number(hashCodeDe(x) % 1000000007n)) | 0; } return BigInt(h & 0x3fffffff); }, hashAll: function (l) { var h = 17; for (var x of iter(l)) h = (h * 31 + Number(hashCodeDe(x) % 1000000007n)) | 0; return BigInt(h & 0x3fffffff); } },
      Comparable: { compare: function (a, b) { return BigInt(comparar(a, b)); } },
      json: { encode: function (v) { return jsonEncode(v); }, decode: function (s) { return jsonDecode(s); } },
      JsonEncoder: { withIndent: function (ind) { return { $nome: "JsonEncoder", m_convert: function (v) { return jsonEncode(v, ind); } }; } },
      utf8: { encode: function (s) { return lista(Array.from(new TextEncoder().encode(s)).map(I), { n: "int" }); }, decode: function (l) { return new TextDecoder().decode(new Uint8Array(paraArray(l).map(Number))); } },
      Timer: { periodic: function (d, f) { var h = { $nome: "_Timer", ativo: true, tick: 0n }; var ms = Math.max(1, d.us / 1000); (function prox() { h.t = timer(function () { if (!h.ativo) return; h.tick++; R.chamarF(f, [h]); if (h.ativo) prox(); }, ms); })(); h.m_cancel = function () { h.ativo = false; cancelarTimer(h.t); return null; }; Object.defineProperty(h, "m_tick", { get: function () { return h.tick; } }); Object.defineProperty(h, "m_isActive", { get: function () { return h.ativo; } }); return h; }, run: function (f) { return timerUnico(new DDuration(0), f); } },
      StackTrace: { get current() { return new DStackTrace(formatarPilha(fotoPilha(), [])); } },
      RegExp: { escape: function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); } },
      Error: { safeToString: function (o) { return typeof o === "string" ? JSON.stringify(o) : str(o); } },
      BigInt: { parse: function (s) { return BigInt(s); }, from: function (n) { return BigInt(n); }, zero: 0n, one: 1n, two: 2n },
      ArgumentError: { checkNotNull: function (v, n) { if (v === null || v === undefined) lancarErro(erroArg("Must not be null")); return v; }, notNull: function (n) { var e = erroArg("Must not be null"); e.m_name = n; return e; }, value: function (v, n, m) { var e = new (BASES.ArgumentError)(); e.$valorInv = v; e.m_name = n || null; e.m_message = m === undefined ? null : m; return e; } },
      RangeError: { range: function (v, a, b, n, m) { return erroRange("RangeError" + (typeof n === "string" ? " (" + n + ")" : "") + ": " + (typeof m === "string" ? m : "Invalid value") + ": Not in inclusive range " + a + ".." + b + ": " + str(v)); }, checkValueInInterval: function (v, a, b) { if (v < a || v > b) lancarErro(ESTATICOS.RangeError.range(v, a, b)); return v; }, value: function (v, n, m) { return erroRange("RangeError" + (n ? " (" + n + ")" : "") + ": " + (m || "Value not in range") + ": " + str(v)); }, checkNotNegative: function (v, n) { if (v < 0n) lancarErro(erroRange("RangeError (" + (n || "index") + "): Invalid value: Not greater than or equal to 0: " + v)); return v; } },
      StateError: {}, Exception: {},
      Isolate: { run: function (f) { return new Promise(function (ok, falha) { timer(function () { try { ok(R.chamarF(f, [])); } catch (e) { falha(e); } }, 0); }); }, spawn: function (f, msg) { timer(function () { R.chamarF(f, [msg]); }, 0); return Promise.resolve({ $nome: "Isolate", m_kill: function () { return null; } }); } },
      String_: {},
    };
    function timerUnico(d, f) { var h = { $nome: "_Timer", ativo: true }; h.t = timer(function () { h.ativo = false; R.chamarF(f, []); }, d.us / 1000); h.m_cancel = function () { h.ativo = false; cancelarTimer(h.t); return null; }; Object.defineProperty(h, "m_isActive", { get: function () { return h.ativo; } }); h.m_toString = function () { return "Instance of '_Timer'"; }; return h; }
    R.ESTATICOS = ESTATICOS;
    R.criar = function (classe, ctor, args, tipo, p) {
      if (p) topo().p = p;
      var a = separar(args), n = a.nom, x = a.pos;
      if (ctor) {
        var t = ESTATICOS[classe];
        if (t && typeof t[ctor] === "function") return t[ctor].apply(null, x.concat(Object.keys(n).length ? [n] : []));
        if (classe === "DateTime" && ctor === "utc") return dataDe(x, true);
        if (BASES[classe] && ESTATICOS[classe] && ESTATICOS[classe][ctor]) return ESTATICOS[classe][ctor].apply(null, x);
        lancarErro(nsm(null, classe + "." + ctor, x));
      }
      switch (classe) {
        case "Duration": return duracao(n);
        case "DateTime": return dataDe(x, false);
        case "StringBuffer": return new DStringBuffer(x[0]);
        case "RegExp": return new DRegExp(x[0], n);
        case "Random": return x.length && x[0] !== null ? new DRandom(x[0]) : aleatorioPadrao2();
        case "Object": return new DObject();
        case "MapEntry": return new DMapEntry(x[0], x[1]);
        case "List": return lista([]);
        case "Map": case "LinkedHashMap": case "HashMap": case "SplayTreeMap": return new DMap();
        case "Set": case "LinkedHashSet": case "HashSet": return new DSet();
        case "Completer": return completer();
        case "StreamController": return controlador();
        case "Timer": return timerUnico(x[0], x[1]);
        case "File": return arquivo(x[0]);
        case "Future": return (function () { var f = x[0]; return new Promise(function (ok, falha) { timer(function () { try { ok(R.chamarF(f, [])); } catch (e) { falha(e); } }, 0); }); })();
        case "Stopwatch": { var sw = { $nome: "Stopwatch", ini: null, acum: 0 }; sw.m_start = function () { if (sw.ini === null) sw.ini = Date.now(); return null; }; sw.m_stop = function () { if (sw.ini !== null) { sw.acum += Date.now() - sw.ini; sw.ini = null; } return null; }; sw.m_reset = function () { sw.acum = 0; if (sw.ini !== null) sw.ini = Date.now(); return null; }; Object.defineProperty(sw, "m_elapsedMilliseconds", { get: function () { return BigInt(sw.acum + (sw.ini !== null ? Date.now() - sw.ini : 0)); } }); Object.defineProperty(sw, "m_elapsed", { get: function () { return new DDuration((sw.acum + (sw.ini !== null ? Date.now() - sw.ini : 0)) * 1000); } }); Object.defineProperty(sw, "m_isRunning", { get: function () { return sw.ini !== null; } }); return sw; }
        case "JsonEncoder": return { $nome: "JsonEncoder", m_convert: function (v) { return jsonEncode(v, null); } };
        case "LineSplitter": return { $nome: "LineSplitter", m_convert: function (s) { var l = String(s).split(/\r?\n/); if (l[l.length - 1] === "") l.pop(); return lista(l, { n: "String" }); } };
      }
      if (BASES[classe]) return BASES[classe].$new.apply(null, x);
      lancarErro(nsm(null, classe, x));
    };
    function aleatorioPadrao2() { return new DRandom(null); }

    // R.estatico precisa achar getters "vivos"
    R.estatico = function (classe, nome, p) {
      var t = ESTATICOS[classe];
      if (t && nome in t) {
        var v = t[nome];
        return v;
      }
      if (BASES[classe] && nome === "new") return BASES[classe].$new;
      topo().p = p;
      lancarErro(nsm(null, classe + "." + nome, null, true));
    };
    // stdin/stdout como objetos com métodos
    STDOUT.m_write = function (v) { out(str(v)); return null; };
    STDOUT.m_writeln = function (v) { out((v === undefined ? "" : str(v)) + "\n"); return null; };
    STDOUT.m_writeAll = function (l, sep) { out(paraArray(l).map(str).join(typeof sep === "string" ? sep : "")); return null; };
    STDOUT.m_flush = function () { return Promise.resolve(null); };
    Object.defineProperty(STDOUT, "m_hasTerminal", { get: function () { return true; } });
    Object.defineProperty(STDOUT, "m_terminalColumns", { get: function () { return 80n; } });
    Object.defineProperty(STDOUT, "m_supportsAnsiEscapes", { get: function () { return true; } });
    STDERR.m_write = function (v) { err(str(v)); return null; };
    STDERR.m_writeln = function (v) { err((v === undefined ? "" : str(v)) + "\n"); return null; };
    STDERR.m_writeAll = STDOUT.m_writeAll;
    STDIN.m_readLineSync = function () { return lerLinha(); };
    Object.defineProperty(STDIN, "m_hasTerminal", { get: function () { return !ctx.stdinRedirecionado; } });
    STDIN.m_echoMode = true; STDIN.m_lineMode = true;
    STDIN.m_toString = function () { return "Instance of 'Stdin'"; };

    R.classes = {};
    R.rodar = function (prog) {
      // prog: { main, nargs, async }
      ctx.classes = R.classes;
    };
    R.formatarPilha = formatarPilha;
    R.DStackTrace = DStackTrace;
    R.BASES = BASES;
    R.DDuration = DDuration;
    return R;
  }

  var exp = { criarRuntime: criarRuntime };
  if (typeof module === "object" && module.exports) module.exports = exp;
  else raiz.DartRuntime = exp;
})(typeof self !== "undefined" ? self : this);
