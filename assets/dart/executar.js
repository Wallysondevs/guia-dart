/* =====================================================================
   executar.js — roda um programa Dart no editor: compila (motor.js),
   cria a biblioteca (runtime.js) e roda o main(), como o `dart run`.
   Usado pelo worker do navegador (dart-worker.js) e pelo Node
   (tools/motor-node.mjs). Entrada digitada: o programa é rodado de novo
   desde o começo com as linhas já digitadas (a saída repetida não é
   mostrada outra vez) — o Dart do editor não pode "parar e esperar".
   ===================================================================== */
(function (raiz) {
  "use strict";
  var Motor = raiz.DartMotor || (typeof require === "function" ? require("./motor.js") : null);
  var RT = raiz.DartRuntime || (typeof require === "function" ? require("./runtime.js") : null);
  var LIMITE = 2000000;
  var aoRejeitar = null;
  // um Future que falhou sem ninguém esperar por ele: o Dart para o programa (Unhandled exception)
  function rejeicao(e) { if (aoRejeitar) aoRejeitar(e && e.reason !== undefined ? e.reason : e); }
  if (typeof process === "object" && process.on) process.on("unhandledRejection", function (r) { rejeicao({ reason: r }); });
  else if (typeof self === "object" && self.addEventListener) self.addEventListener("unhandledrejection", function (ev) { ev.preventDefault(); rejeicao(ev); });

  /* req: { arquivos: [{nome, codigo}], args: [], stdin: texto|null, conferir: [nomes] }
     io:  { saida(t, s), eco(s), pedirLinha() → Promise<string|null>, limite(), setTimeout, clearTimeout, agora() }
     → Promise<{ exit, excecao, traceback, arquivos, ms }> */
  function executar(req, io) {
    var t0 = Date.now();
    var arqs = req.arquivos || [];
    var principal = arqs[0] || { nome: "main.dart", codigo: "" };
    var outros = {};
    arqs.slice(1).forEach(function (a) { outros[a.nome] = a.codigo; });
    var comp = Motor.compilar(principal.codigo, principal.nome, outros);
    var traceback = "";
    if (comp.erros) {
      io.saida("err", comp.erros);
      return Promise.resolve({ exit: 254, excecao: true, traceback: comp.erros, compilacao: true, arquivos: arquivosFinais(req, null), ms: Date.now() - t0 });
    }
    var entradas = [];       // linhas digitadas (null = Ctrl+D)
    var emitidos = 0;        // caracteres já mostrados (das tentativas anteriores)
    var total = 0;
    var semente = Math.floor(Math.random() * 2147483647);
    var relogio0 = io.agora ? io.agora() : Date.now();
    var stdinTexto = req.stdin === null || req.stdin === undefined ? null : String(req.stdin);

    return new Promise(function (resolver) {
      function tentativa() {
        var produzidos = 0, acabou = false, lidas = 0, posStdin = 0;
        var fs = {};
        arqs.slice(1).forEach(function (a) { fs[a.nome] = a.codigo; });
        var R;
        var ctx = {
          arquivo: principal.nome,
          arquivos: fs,
          linhaCol: function (p) { return comp.linhaCol(p); },
          setTimeout: function (f, ms) { return setTimeout(f, ms); }, clearTimeout: function (h) { return clearTimeout(h); },
          semente: function () { return semente; },
          agora: function () { return Date.now(); },
          stdinRedirecionado: stdinTexto !== null,
          escrever: function (t, s) {
            if (acabou || !s) return;
            var ini = produzidos; produzidos += s.length;
            if (produzidos <= emitidos) return;
            var parte = ini < emitidos ? s.slice(emitidos - ini) : s;
            emitidos = produzidos; total += parte.length;
            io.saida(t, parte);
            if (total > LIMITE) { acabou = true; if (R) R.parar(); if (io.limite) io.limite(); }
          },
          lerLinha: function () {
            if (stdinTexto !== null) {
              if (posStdin >= stdinTexto.length) return null;
              var f = stdinTexto.indexOf("\n", posStdin);
              var linha = f < 0 ? stdinTexto.slice(posStdin) : stdinTexto.slice(posStdin, f);
              var eco = f < 0 ? stdinTexto.slice(posStdin) : stdinTexto.slice(posStdin, f + 1);
              posStdin = f < 0 ? stdinTexto.length : f + 1;
              // o eco aparece no terminal como se a Ana tivesse digitado (só na 1ª vez)
              if (lidas >= ecoados) { ecoados++; if (io.eco) io.eco(eco + (f < 0 ? "\n" : "")); }
              lidas++;
              return linha;
            }
            if (lidas < entradas.length) { var l = entradas[lidas]; if (l === null) return null; lidas++; return l; }
            throw new R.Sinal("entrada");
          },
          aoErro: function (e) { fim(e); },
          aoSinal: function (s) { fim(s); },
        };
        R = RT.criarRuntime(ctx);
        aoRejeitar = function (e) { if (!acabou) { if (e instanceof R.Lancado) e.assincrono = true; fim(e); } };
        var prog;
        try {
          prog = new Function("$R", comp.js)(R);
        } catch (e) {
          return fim(e);
        }
        function fim(e) {
          if (acabou) return;
          if (e instanceof R.Sinal && e.tipo === "entrada") {
            acabou = true; R.parar(); R.cancelarTudo();
            Promise.resolve(io.pedirLinha()).then(function (l) { entradas.push(l === undefined ? null : l); tentativa(); });
            return;
          }
          acabou = true; R.parar(); R.cancelarTudo();
          var res = { exit: 0, excecao: false, traceback: "", arquivos: null, ms: Date.now() - t0 };
          if (e instanceof R.Sinal) {
            if (e.tipo === "exit") res.exit = e.v;
            else if (e.tipo === "parado") { res.exit = 0; }
          } else if (e) {
            var lan = null;
            try { lan = e instanceof R.Lancado ? e : R.capturar(e); } catch (x) { lan = null; }
            if (lan) {
              var texto = "Unhandled exception:\n" + R.str(lan.valor) + "\n" + R.formatarPilha(lan.frames, lan.nativos, lan.assincrono);
              acabou = false; ctx.escrever("err", texto); acabou = true;
              res.exit = 255; res.excecao = true; res.traceback = texto;
            } else {
              // erro interno do editor (bug): mostra o que der
              var msg = "Erro interno do editor do guia (não é do seu programa): " + (e && e.message ? e.message : String(e)) + "\n";
              acabou = false; ctx.escrever("err", msg); acabou = true;
              res.exit = 255; res.excecao = true; res.traceback = msg; res.interno = String(e && e.stack || e);
            }
          }
          res.arquivos = arquivosFinais(req, fs);
          resolver(res);
        }
        // roda o main
        try {
          var args = req.args || [];
          var lista = R.lista(args.slice(), { n: "String" });
          var r = prog.nargs ? prog.main(lista) : prog.main();
          if (r && typeof r.then === "function") {
            r.then(function () { R.esperarFim(function () { fim(null); }); }, function (e) { if (e instanceof R.Lancado) e.assincrono = true; fim(e); });
          } else {
            R.esperarFim(function () { fim(null); });
          }
        } catch (e) {
          fim(e);
        }
      }
      var ecoados = 0;
      tentativa();
    });
  }
  function arquivosFinais(req, fs) {
    var r = {};
    (req.conferir || []).forEach(function (n) { r[n] = fs && Object.prototype.hasOwnProperty.call(fs, n) ? fs[n] : null; });
    return r;
  }

  /* o protocolo do worker (o mesmo do Guia Lua): navegador (dart-worker.js) e Node (motor-node.mjs)
     recebe {op:"carregar"} {op:"executar", id, req} {op:"entrada", texto} {op:"eof"}
     manda  {ev:"pronto", info} {ev:"saida", id, partes:[{t,s}]} {ev:"eco", id, texto} {ev:"espera", id}
            {ev:"limite", id} {ev:"fim", id, res} {ev:"falha", id, msg} */
  function servir(enviar, aoReceber, tempo) {
    var esperaLinha = null, fila = [], ultimo = 0, idAtual = 0, timerFila = null;
    function despejar() {
      if (timerFila) { clearTimeout(timerFila); timerFila = null; }
      if (!fila.length) return;
      var p = fila; fila = [];
      enviar({ ev: "saida", id: idAtual, partes: p });
      ultimo = Date.now();
    }
    aoReceber(function (m) {
      if (m.op === "carregar") { enviar({ ev: "pronto", info: { dart: Motor.VERSAO } }); return; }
      if (m.op === "entrada" || m.op === "eof") {
        if (esperaLinha) { var f = esperaLinha; esperaLinha = null; f(m.op === "eof" ? null : String(m.texto).replace(/\n$/, "")); }
        return;
      }
      if (m.op === "executar") {
        idAtual = m.id;
        var id = m.id;
        var io = {
          saida: function (t, s) {
            var u = fila[fila.length - 1];
            if (u && u.t === t) u.s += s; else fila.push({ t: t, s: s });
            if (Date.now() - ultimo > 40) despejar();
            else if (!timerFila) timerFila = setTimeout(despejar, 30);
          },
          eco: function (s) { despejar(); enviar({ ev: "eco", id: id, texto: s }); },
          pedirLinha: function () { despejar(); enviar({ ev: "espera", id: id }); return new Promise(function (ok) { esperaLinha = ok; }); },
          limite: function () { despejar(); enviar({ ev: "limite", id: id }); },
        };
        var r;
        try { r = executar(m.req, io); }
        catch (e) { despejar(); enviar({ ev: "falha", id: id, msg: String(e && e.stack || e) }); return; }
        r.then(function (res) { despejar(); enviar({ ev: "fim", id: id, res: res }); }, function (e) { despejar(); enviar({ ev: "falha", id: id, msg: String(e && e.stack || e) }); });
      }
    });
  }

  var exp = { executar: executar, servir: servir, VERSAO: Motor.VERSAO };
  if (typeof module === "object" && module.exports) module.exports = exp;
  else raiz.DartExecutar = exp;
})(typeof self !== "undefined" ? self : this);
