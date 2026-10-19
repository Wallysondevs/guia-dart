#!/usr/bin/env node
// diferencial.js — o teste diferencial do motor do editor contra o Dart SDK oficial do lab.
//
//   timeout 600 node tools/diferencial.js            compara o editor com tools/testes/*.esperado
//   timeout 900 node tools/diferencial.js --sdk      (re)gera os .esperado rodando no lab (dart run)
//   timeout 600 node tools/diferencial.js nome …     só esses testes (nome sem .dart)
//
// Cada teste: tools/testes/NOME.dart (+ NOME.stdin opcional, o que o stdin lê).
// O .esperado guarda a saída do lab (stdout+stderr) e, na última linha, "[exit N]".
"use strict";
const fs = require("fs");
const path = require("path");
const PASTA = path.join(__dirname, "testes");
const args = process.argv.slice(2);
const sdk = args.includes("--sdk");
const so = args.filter((a) => !a.startsWith("--"));
const nomes = fs.readdirSync(PASTA).filter((f) => f.endsWith(".dart")).map((f) => f.slice(0, -5)).filter((n) => !so.length || so.includes(n)).sort();

(async () => {
  if (sdk) {
    const lab = require("./lab-nativo.js");
    const prob = lab.problema();
    if (prob) { console.error(prob); process.exit(2); }
    for (const n of nomes) {
      const stdin = fs.existsSync(path.join(PASTA, n + ".stdin")) ? fs.readFileSync(path.join(PASTA, n + ".stdin"), "utf8") : "";
      const r = lab.rodar([{ nome: n + ".dart", codigo: fs.readFileSync(path.join(PASTA, n + ".dart"), "utf8") }], { stdin });
      fs.writeFileSync(path.join(PASTA, n + ".esperado"), r.saida + "[exit " + r.exit + "]\n");
      console.log("gerado " + n + " (exit " + r.exit + ")");
    }
    return;
  }
  const { abrirMotor } = await import("./motor-node.mjs");
  const m = await abrirMotor();
  let ok = 0, ruins = 0;
  for (const n of nomes) {
    const esp = path.join(PASTA, n + ".esperado");
    if (!fs.existsSync(esp)) { console.log("??  " + n + ": sem .esperado (rode com --sdk)"); continue; }
    const stdinArq = path.join(PASTA, n + ".stdin");
    const r = await m.rodar({ arquivos: [{ nome: n + ".dart", codigo: fs.readFileSync(path.join(PASTA, n + ".dart"), "utf8") }], args: [], stdin: fs.existsSync(stdinArq) ? fs.readFileSync(stdinArq, "utf8") : "" }, { tempo: 10000 });
    const editor = (r.interrompido ? "(interrompido: " + r.motivo + ")\n" : r.saida) + "[exit " + r.exit + "]\n";
    const real = fs.readFileSync(esp, "utf8");
    if (editor === real) { ok++; console.log("ok  " + n); continue; }
    ruins++;
    console.log("DIF " + n);
    const a = editor.split("\n"), b = real.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log("    linha " + (i + 1) + ":\n      editor: " + JSON.stringify(a[i]) + "\n      lab:    " + JSON.stringify(b[i])); break; }
  }
  await m.fechar();
  console.log(ok + " iguais, " + ruins + " diferentes");
  process.exitCode = ruins ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 2; });
