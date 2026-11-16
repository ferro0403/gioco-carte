// =============================================================
//  I BOT
//  Un bot è un giocatore finto: quando tocca a lui, questa funzione
//  decide la sua scelta. Ragiona in modo semplice: tira a caso tra
//  le azioni che in quel momento hanno senso.
// =============================================================

import { CONFIG } from './config.js';
import { motivoNientePatto, trovaInPartita } from './partita.js';

function aCaso(lista, casuale) {
  return lista[Math.floor(casuale() * lista.length)];
}

// Quale Oggetto usare (oppure null). Ogni Oggetto ha la sua condizione.
function scegliOggetto(partita, bot, azione, altri, casuale) {
  const spettri = partita.giocatori.filter((g) => !g.vivo);
  const attaccando = azione.tipo === 'attacca';

  const utili = bot.oggetti.filter((id) => {
    if (id === 'amuleto') return false; // si usa da solo
    if (id === 'pozione') return bot.vita < bot.vitaMax && bot.idPersonaggio !== 'corvina';
    if (id === 'pugnale') return attaccando;
    if (id === 'rampino') return altri.some((g) => g.oggetti.length > 0);
    if (id === 'campanella') return spettri.length > 0;
    return true;
  });
  if (utili.length === 0 || casuale() >= CONFIG.bot.probabilitaOggetto) return null;

  const id = aCaso(utili, casuale);
  if (id === 'rampino') return { id, bersaglio: aCaso(altri, casuale).id };
  if (id === 'campanella') return { id, bersaglio: aCaso(spettri, casuale).id };
  return { id };
}

// L'abilità attiva del bot, se è pronta e ha senso usarla (altrimenti null).
function scegliAbilita(partita, bot, altri, casuale) {
  if (partita.round < bot.abilitaDalRound) return null;

  if (bot.idPersonaggio === 'ottavio') {
    // Scarta la prima carta solo se è brutta.
    const prima = partita.mazzo.at(-1);
    const brutta = prima && (prima.id === 'sventura' || prima.valore === 0);
    return brutta ? { tipo: 'abilita' } : null;
  }
  if (casuale() >= CONFIG.bot.probabilitaAbilita) return null;

  if (bot.idPersonaggio === 'zolfo') return { tipo: 'abilita' };
  if (bot.idPersonaggio === 'mirra' && bot.vita < bot.vitaMax) {
    return { tipo: 'abilita', bersaglio: bot.id };
  }
  if (bot.idPersonaggio === 'brunna') {
    // Protegge l'alleato se ne ha uno, altrimenti uno a caso.
    return { tipo: 'abilita', bersaglio: bot.alleato ?? aCaso(altri, casuale).id };
  }
  return null;
}

// Restituisce la scelta del bot (oppure null se non può fare niente).
export function scegliPerBot(partita, idBot, casuale = Math.random) {
  const bot = trovaInPartita(partita, idBot);
  const altri = partita.giocatori.filter((g) => g.vivo && g.id !== idBot);
  if (!bot || altri.length === 0) return null;

  if (!bot.vivo) {
    const perseguita = casuale() < CONFIG.bot.probabilitaPerseguita;
    return { tipo: perseguita ? 'perseguita' : 'benedici', bersaglio: aCaso(altri, casuale).id };
  }

  // Non attacca il proprio alleato (i bot sono leali... per ora).
  const nemici = altri.filter((g) => g.id !== bot.alleato);
  const possibiliAlleati = altri.filter((g) => !motivoNientePatto(partita, bot, g));
  const haPosto = bot.oggetti.length < CONFIG.oggetti.massimoATesta;

  let azione = scegliAbilita(partita, bot, altri, casuale);
  if (!azione && possibiliAlleati.length > 0 && casuale() < CONFIG.bot.probabilitaPatto) {
    azione = { tipo: 'patto', bersaglio: aCaso(possibiliAlleati, casuale).id };
  }
  if (!azione && haPosto && casuale() < CONFIG.bot.probabilitaEsplora) {
    azione = { tipo: 'esplora' };
  }
  if (!azione && nemici.length > 0 && casuale() < CONFIG.bot.probabilitaAttacco) {
    // Attacca con la caratteristica più alta.
    azione = {
      tipo: 'attacca',
      bersaglio: aCaso(nemici, casuale).id,
      con: bot.magia > bot.forza ? 'magia' : 'forza',
    };
  }
  if (!azione) azione = { tipo: 'difenditi' };

  const oggetto = scegliOggetto(partita, bot, azione, altri, casuale);
  return oggetto ? { ...azione, oggetto } : azione;
}
