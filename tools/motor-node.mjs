/* motor-node.mjs — o motor do editor (assets/dart: motor.js + runtime.js + executar.js)
   rodando no Node 24, num worker_thread (para poder parar um laço infinito), com o MESMO
   protocolo do Web Worker do navegador. Usado por tools/sim.js e tools/testar-missoes.js.

   import { abrirMotor } from "./motor-node.mjs";
   const m = await abrirMotor();            // { info, rodar(req, opc), fechar() }
   const r = await m.rodar({ arquivos:[{nome:"main.dart", codigo:"void main() => print(1);\n"}], stdin:null },
                           { digitar: ["Ana"], tempo: 10000, aoSaida(t, s) {} });
   r = { saida, segs:[{t,s}], eco, exit, excecao, traceback, arquivos, interrompido, motivo, ms }
*/
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, "..");
const DART = path.join(RAIZ, "assets", "dart");

if (!isMainThread && workerData && workerData.guiaMotor) {
  const require = createRequire(import.meta.url);
  const E = require(path.join(DART, "executar.js"));
  E.servir((m) => parentPort.postMessage(m), (f) => parentPort.on("message", f));
}

export async function abrirMotor(opc = {}) {
  if (!process.env.TZ) process.env.TZ = opc.tz || "America/Sao_Paulo";
  let w = null, info = null, seq = 0;
  async function iniciar() {
    w = new Worker(fileURLToPath(import.meta.url), { workerData: { guiaMotor: true }, stdout: true, stderr: true });
    w.stdout.on("data", () => {}); w.stderr.on("data", (d) => { if (opc.depurar) process.stderr.write(d); });
    info = await new Promise((ok, falha) => {
      const f = (m) => { if (m.ev === "pronto") { w.off("message", f); ok(m.info); } else if (m.ev === "falha") falha(new Error(m.msg)); };
      w.on("message", f);
      w.once("error", falha);
      w.postMessage({ op: "carregar" });
    });
  }
  await iniciar();

  /* opc: { digitar: [linhas] (o leitor digitando; null = sem teclado: fim de entrada),
            tempo: ms (limite, sem contar a espera pelo teclado), aoSaida(t, s), aoEspera(), aoEco(texto) } */
  async function rodar(req, o = {}) {
    if (!w) await iniciar();
    const id = ++seq, segs = [], t0 = Date.now();
    const digitar = o.digitar ? o.digitar.slice() : [];
    const limite = o.tempo || 10000;
    const eco = [];
    let esperando = 0, desde = 0;
    return await new Promise((ok) => {
      let fim = false;
      const relogio = setInterval(() => {
        if (Date.now() - t0 - esperando > limite) terminar({ interrompido: true, motivo: "tempo" });
      }, 100);
      function terminar(extra) {
        if (fim) return;
        fim = true; clearInterval(relogio);
        const ms = Date.now() - t0;
        const acabar = () => {
          const saida = segs.map((x) => x.s).join("");
          ok(Object.assign({ saida, segs, eco, ms, interrompido: false }, extra));
        };
        if (!extra.interrompido) { w.off("message", ouvir); acabar(); return; }
        const morto = w; w = null;
        morto.terminate().then(() => setTimeout(() => { morto.off("message", ouvir); acabar(); }, 20));
      }
      function ouvir(m) {
        if (fim && m.ev !== "saida") return;
        if (m.id !== id) { if (m.ev === "falha" && !m.id) terminar({ interrompido: true, motivo: "falha", msg: m.msg }); return; }
        if (m.ev === "saida") {
          for (const p of m.partes) {
            const u = segs[segs.length - 1];
            if (u && u.t === p.t) u.s += p.s; else segs.push({ t: p.t, s: p.s });
            if (o.aoSaida) o.aoSaida(p.t, p.s);
          }
        } else if (m.ev === "eco") { eco.push(m.texto); if (o.aoEco) o.aoEco(m.texto); }
        else if (m.ev === "espera") {
          if (o.aoEspera) o.aoEspera();
          if (o.digitar && digitar.length) { const l = digitar.shift(); const e = l + "\n"; eco.push(e); if (o.aoEco) o.aoEco(e); w.postMessage({ op: "entrada", texto: l + "\n" }); }
          else w.postMessage({ op: "eof" });
        } else if (m.ev === "limite") terminar({ interrompido: true, motivo: "limite" });
        else if (m.ev === "fim") terminar(Object.assign({}, m.res));
        else if (m.ev === "falha") terminar({ interrompido: true, motivo: "falha", msg: m.msg });
      }
      w.on("message", ouvir);
      w.postMessage({ op: "executar", id, req });
    });
  }
  return {
    get info() { return info; },
    rodar,
    async fechar() { if (w) { await w.terminate(); w = null; } },
  };
}
