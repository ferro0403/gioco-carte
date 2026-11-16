// =============================================================
//  I BOT
//  Un bot è un giocatore finto: quando tocca a lui, questa funzione
//  decide la sua scelta. Per ora ragiona in modo molto semplice.
// =============================================================

import { CONFIG } from './config.js';
import { trovaInPartita } from './partita.js';

function aCaso(lista, casuale) {
  return lista[Math.floor(casuale() * lista.length)];
}

// Restituisce la scelta del bot (oppure null se non può fare niente).
export function scegliPerBot(partita, idBot, casuale = Math.random) {
  const bot = trovaInPartita(partita, idBot);
  const bersagli = partita.giocatori.filter((g) => g.vivo && g.id !== idBot);
  if (!bot || bersagli.length === 0) return null;
  const bersaglio = aCaso(bersagli, casuale).id;

  if (!bot.vivo) {
    const perseguita = casuale() < CONFIG.bot.probabilitaPerseguita;
    return { tipo: perseguita ? 'perseguita' : 'benedici', bersaglio };
  }

  if (casuale() < CONFIG.bot.probabilitaAttacco) {
    // Attacca con la caratteristica più alta.
    return { tipo: 'attacca', bersaglio, con: bot.magia > bot.forza ? 'magia' : 'forza' };
  }
  return { tipo: 'difenditi' };
}
