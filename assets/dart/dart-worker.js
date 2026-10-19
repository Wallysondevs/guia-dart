/* dart-worker.js — o Web Worker do editor do Guia Dart (assets/dartsim.js o cria).
   Carrega o motor (motor.js), a biblioteca (runtime.js) e o executor (executar.js). */
"use strict";
var v = (self.location.search.match(/[?&]v=([^&]*)/) || [])[1] || "";
importScripts("motor.js?v=" + v, "runtime.js?v=" + v, "executar.js?v=" + v);
self.DartExecutar.servir(function (m) { self.postMessage(m); }, function (f) { self.onmessage = function (e) { f(e.data); }; });
