#!/usr/bin/env node
// sim.js — roda um programa Dart como o editor do guia rodaria (o MESMO motor:
// assets/dart/motor.js + runtime.js + executar.js), e mostra o terminal da caixa e o código de saída.
//
//   timeout 60 node tools/sim.js main.dart [contas.dart dados.txt…] [opções]
//   timeout 60 node tools/sim.js -e 'void main() => print(1);' [opções]
//   timeout 60 node tools/sim.js - [contas.dart…] [opções] < programa.dart   (o programa vem da entrada; vira main.dart)
//
// O 1º arquivo é o que roda (dart run main.dart); os outros vão para a mesma pasta (/home/ana),
// mantendo a subpasta relativa à do 1º (como data-file="lib/contas.dart").
//   --stdin TEXTO     o data-stdin da caixa ("Ana\n30": \n = Enter). O que o stdin.readLineSync() lê.
//   --digitar TEXTO   o leitor DIGITANDO no terminal da caixa (sem data-stdin): uma linha por \n
//   --args "a 'b c'"  o data-args (main(List<String> args): args[0], args[1]…)
//   --goal META       o data-goal: diz se a missão passaria e qual meta falhou
//   --tempo MS        limite (padrão 10000, como o editor)
//   --json            o resultado em JSON (saida, exit, excecao, traceback…)
//   --js              mostra o JavaScript que o motor gerou (para achar defeitos do motor)
// Sem --stdin nem --digitar, o stdin.readLineSync() recebe "fim de entrada" (null), como
// `dart run main.dart < /dev/null`. No editor o leitor digitaria.
"use strict";
const fs = require("fs");
const path = require("path");
const DartSim = require("../assets/dartsim.js");

const a = process.argv.slice(2);
const arqs = [];
let codigo = null, stdin = null, digitar = null, args = [], goal = null, tempo = 10000, json = false, verJs = false;
function uso(c) {
  console.error("uso: timeout 60 node tools/sim.js main.dart [outros…] [--stdin TEXTO | --digitar TEXTO] [--args \"a b\"] [--goal META] [--tempo MS] [--json] [--js]\n" +
    "     timeout 60 node tools/sim.js -e 'CÓDIGO' […]\n" +
    "     timeout 60 node tools/sim.js - […] < programa.dart");
  process.exit(c);
}
for (let i = 0; i < a.length; i++) {
  const x = a[i];
  if (x === "-e" || x === "-c") codigo = a[++i];
  else if (x === "--stdin") stdin = a[++i];
  else if (x === "--digitar") digitar = a[++i];
  else if (x === "--args") args = DartSim.dividirArgs(a[++i]);
  else if (x === "--goal") goal = a[++i];
  else if (x === "--tempo") tempo = +a[++i];
  else if (x === "--json") json = true;
  else if (x === "--js") verJs = true;
  else if (x === "-h" || x === "--help") uso(0);
  else if (x.startsWith("--")) { console.error("opção desconhecida: " + x); uso(2); }
  else arqs.push(x);
}
if (codigo === null && !arqs.length) uso(2);
const arquivos = [];
if (codigo !== null) arquivos.push({ nome: "main.dart", codigo: codigo.endsWith("\n") ? codigo : codigo + "\n" });
// o 1º arquivo (o que roda) fica na pasta da Ana com o nome dele; os outros mantêm a pasta
// relativa à do 1º (como o data-file="lib/contas.dart" da caixa: a subpasta é criada).
// Arquivo fora da pasta do 1º (ou com "..") vai para a pasta da Ana com o nome dele.
let base = null;
for (const p of arqs) {
  if (p === "-") { arquivos.push({ nome: "main.dart", codigo: fs.readFileSync(0, "utf8") }); if (base === null) base = process.cwd(); continue; }
  if (!fs.existsSync(p)) { console.error("não achei " + p); process.exit(2); }
  const c = fs.readFileSync(p, "utf8");
  let nome = path.basename(p);
  if (base === null) base = path.dirname(path.resolve(p));
  else {
    const rel = path.relative(base, path.resolve(p));
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) nome = rel.split(path.sep).join("/");
  }
  arquivos.push({ nome, codigo: /\.dart$/i.test(p) || !arquivos.length ? c : DartSim.comEnter(c) });
}
if (!arquivos.length) arquivos.push({ nome: "main.dart", codigo: "" });

(async () => {
  const { abrirMotor } = await import("./motor-node.mjs");
  if (verJs) {
    const Motor = require("../assets/dart/motor.js");
    const outros = {}; arquivos.slice(1).forEach((x) => { outros[x.nome] = x.codigo; });
    const c = Motor.compilar(arquivos[0].codigo, arquivos[0].nome, outros);
    console.log(c.erros ? "(erros de compilação)\n" + c.erros : c.js);
    console.log("-----");
  }
  const m = await abrirMotor();
  const req = {
    arquivos, args,
    stdin: stdin !== null ? DartSim.textoEntrada(stdin) : null,
    conferir: goal ? DartSim.arquivosDaMeta(goal) : [],
  };
  const linhas = digitar !== null ? DartSim.decodificarAttr(digitar).replace(/\n$/, "").split("\n") : null;
  if (!json) process.stdout.write("ana@notebook:~$ " + DartSim.linhaComando(arquivos[0].nome, args) + "\n");
  const r = await m.rodar(req, {
    digitar: linhas, tempo,
    aoSaida: json ? null : (t, s) => process.stdout.write(s),
    aoEco: json ? null : (s) => process.stdout.write(s),
  });
  await m.fechar();
  let falhas = null;
  if (goal && !r.interrompido) {
    falhas = DartSim.checarMeta(goal, { out: r.saida, excecao: r.excecao, traceback: r.traceback, exit: r.exit, src: arquivos.map((x) => x.codigo.replace(/\n$/, "")).join("\n"), arquivos: r.arquivos });
  }
  if (json) {
    console.log(JSON.stringify({ saida: r.saida, segs: r.segs, eco: r.eco, exit: r.exit, excecao: r.excecao, traceback: r.traceback, interrompido: r.interrompido, motivo: r.motivo, arquivos: r.arquivos, ms: r.ms, dart: m.info.dart, falhas }, null, 1));
  } else {
    if (r.saida && !/\n$/.test(r.saida)) process.stdout.write("\n");
    if (r.interrompido) {
      console.log(r.motivo === "tempo" ? "(o editor parou o programa: ele rodou mais de " + tempo / 1000 + " segundos sem terminar — laço infinito?)\n[programa interrompido]"
        : r.motivo === "limite" ? "(o programa escreveu demais: mais de 2 milhões de caracteres; o editor o parou)\n[programa interrompido]"
        : "(o Dart do editor falhou: " + String(r.msg || r.motivo).split("\n")[0] + ")\n[programa interrompido]");
    } else console.log("[código de saída: " + r.exit + "]");
    const extra = [];
    if (r.excecao) extra.push(r.exit === 254 ? "erro de compilação" : "exceção não tratada (Unhandled exception)");
    if (stdin === null && digitar === null && /readLineSync/.test(arquivos.map((x) => x.codigo).join("\n")))
      extra.push("sem --stdin/--digitar o stdin.readLineSync() recebe fim de entrada (null); no editor, sem data-stdin, o leitor digita");
    console.log("-- editor: Dart " + m.info.dart + " (motor do guia), " + r.ms + " ms" + (extra.length ? "; " + extra.join("; ") : ""));
    if (goal) {
      if (falhas === null) console.log("-- meta: não avaliada (o programa foi interrompido)");
      else if (!falhas.length) console.log("-- meta \"" + goal + "\": CUMPRIDA");
      else console.log("-- meta \"" + goal + "\": NÃO cumprida; falharam: " + falhas.join(" ;; ") + (r.eco && r.eco.length ? "  (lembre: o out: não inclui o eco do que foi lido/digitado)" : ""));
    }
  }
  process.exitCode = r.interrompido ? 3 : (falhas && falhas.length ? 1 : 0);
})().catch((e) => { console.error("erro: " + (e.stack || e)); process.exitCode = 2; });
