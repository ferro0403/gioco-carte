// =============================================================
//  MAZZO DEL DESTINO
//  Qui c'è solo LOGICA PURA: niente server, niente schermo.
//  Funzioni che ricevono dati e restituiscono dati: per questo
//  sono facili da provare con i test (vedi test/mazzo.test.js).
// =============================================================

import { CONFIG } from './config.js';

// Costruisce il mazzo ordinato leggendo la configurazione.
// Ogni carta è un piccolo oggetto, per esempio:
//   { tipo: 'numero', valore: 2 }
//   { tipo: 'speciale', id: 'sventura', nome: 'Sventura' }
export function creaMazzoDestino(configDestino = CONFIG.destino) {
  const mazzo = [];

  for (const { valore, copie } of configDestino.numeri) {
    for (let i = 0; i < copie; i++) {
      mazzo.push({ tipo: 'numero', valore });
    }
  }

  for (const { id, nome, copie } of configDestino.speciali) {
    for (let i = 0; i < copie; i++) {
      mazzo.push({ tipo: 'speciale', id, nome });
    }
  }

  return mazzo;
}

// Mescola le carte (algoritmo "Fisher-Yates") e restituisce un NUOVO array,
// senza toccare quello originale.
//
// "casuale" è la funzione che genera i numeri a caso (di solito Math.random).
// La passiamo come parametro così nei test possiamo usarne una finta e
// ottenere sempre lo stesso risultato.
export function mescola(carte, casuale = Math.random) {
  const copia = [...carte];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(casuale() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]]; // scambia le due carte
  }
  return copia;
}
