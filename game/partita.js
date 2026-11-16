// =============================================================
//  LA PARTITA: il cuore del gioco
//  Logica pura: round, scelte segrete, scontri, abilità, Oggetti,
//  alleanze, Taglia, crollo della Torre, Spettri e vittoria.
//  Niente server e niente schermo.
//
//  Un round funziona così:
//   1. fase 'scelta'    -> ognuno registra la sua scelta segreta
//   2. risolviRound()   -> si calcola tutto in un colpo solo
//   3. fase 'risultati' -> tutti guardano cos'è successo
//   4. prossimoRound()  -> si ricomincia (oppure fase 'finita')
// =============================================================

import { CONFIG } from './config.js';
import { creaMazzoDestino, mescola } from './mazzo.js';

const errore = (testo) => ({ ok: false, errore: testo });

// ---- Piccoli aiuti ----

export function trovaInPartita(partita, idGiocatore) {
  return partita.giocatori.find((g) => g.id === idGiocatore);
}

const personaggioDi = (giocatore) =>
  CONFIG.personaggi.find((p) => p.id === giocatore.idPersonaggio);
const numeriDi = (giocatore) => personaggioDi(giocatore).numeri;
const e = (giocatore, idPersonaggio) => giocatore.idPersonaggio === idPersonaggio;

export function trovaOggetto(idOggetto) {
  return CONFIG.oggetti.lista.find((o) => o.id === idOggetto);
}
const numeriOggetto = (idOggetto) => trovaOggetto(idOggetto).numeri;

// Di notte le azioni sono anonime. Con 5 round di giorno e 2 di notte:
// giorno nei round 1-5, notte nei round 6-7, giorno 8-12, notte 13-14...
export function eNotte(round) {
  const { roundDiGiorno, roundDiNotte } = CONFIG.notte;
  // % è il "resto della divisione": fa ripartire il conto ogni 7 round.
  return (round - 1) % (roundDiGiorno + roundDiNotte) >= roundDiGiorno;
}

// Quanta Vita toglie il crollo della Torre in un certo round.
export function dannoCrollo(round) {
  let danno = 0;
  for (const livello of CONFIG.crollo) {
    if (round >= livello.dalRound) danno = livello.danno;
  }
  return danno;
}

export const eTraditore = (partita, giocatore) => partita.round <= giocatore.traditoreFino;
const nonCurabile = (giocatore) => e(giocatore, 'corvina'); // "Gelida"

// Quanta Vita guadagna chi elimina il giocatore con la Taglia.
export function ricompensaTaglia(partita) {
  const { ricompensaVita, vitaExtraPerRound } = CONFIG.taglia;
  return ricompensaVita + Math.max(0, partita.taglia.round - 1) * vitaExtraPerRound;
}

// Pesca un Oggetto a caso, tenendo conto dei "pesi" della configurazione.
function oggettoACaso(casuale) {
  const { lista } = CONFIG.oggetti;
  const totale = lista.reduce((somma, o) => somma + o.peso, 0);
  let tiro = casuale() * totale;
  for (const oggetto of lista) {
    tiro -= oggetto.peso;
    if (tiro < 0) return oggetto.id;
  }
  return lista.at(-1).id;
}

// Dà un Oggetto al giocatore, se ha ancora posto. Restituisce true se l'ha preso.
function daiOggetto(giocatore, casuale) {
  if (giocatore.oggetti.length >= CONFIG.oggetti.massimoATesta) return false;
  giocatore.oggetti.push(oggettoACaso(casuale));
  return true;
}

function togliOggetto(giocatore, idOggetto) {
  const indice = giocatore.oggetti.indexOf(idOggetto);
  if (indice === -1) return false;
  giocatore.oggetti.splice(indice, 1);
  return true;
}

// ---- Creazione ----

// Crea una partita nuova a partire dai giocatori della stanza.
export function creaPartita(giocatoriStanza, casuale = Math.random) {
  return {
    round: 1,
    fase: 'scelta', // 'scelta', 'risultati' oppure 'finita'
    giocatori: giocatoriStanza.map((g) => {
      const personaggio = CONFIG.personaggi.find((p) => p.id === g.idPersonaggio);
      return {
        id: g.id,
        nome: g.nome,
        bot: g.bot,
        idPersonaggio: personaggio.id,
        vita: personaggio.vita,
        vitaMax: personaggio.vita,
        forza: personaggio.forza,
        agilita: personaggio.agilita,
        magia: personaggio.magia,
        vivo: true, // false = è uno Spettro
        benedizioni: 0, // bonus al prossimo tiro, regalato dagli Spettri
        danniInflitti: 0, // serve per decidere il vincitore se muoiono tutti insieme
        oggetti: [], // gli id degli Oggetti che possiede
        alleato: null, // l'id del suo alleato
        traditoreFino: 0, // è "Traditore" fino a questo round compreso
        abilitaDalRound: 1, // l'abilità attiva si può usare da questo round in poi
      };
    }),
    mazzo: mescola(creaMazzoDestino(), casuale),
    scarti: [], // le carte uscite: le vedono tutti
    scelte: {}, // idGiocatore -> scelta. SEGRETE fino alla risoluzione!
    taglia: { id: null, round: 0 }, // su chi è la Taglia, e da quanti round
    ultimoRound: null, // il racconto dell'ultimo round risolto
    vincitori: null, // a partita finita: la lista degli id di chi ha vinto
  };
}

// ---- Le scelte segrete ----

// Si può fare un patto solo se nessuno dei due ha già un alleato o è un Traditore.
export function motivoNientePatto(partita, giocatore, altro) {
  if (giocatore.alleato) return 'Hai già un alleato.';
  if (eTraditore(partita, giocatore)) return 'Sei un Traditore: nessuno si fida di te.';
  if (altro.alleato) return `${altro.nome} ha già un alleato.`;
  if (eTraditore(partita, altro)) return `${altro.nome} è un Traditore.`;
  return null;
}

// Controlla l'Oggetto che il giocatore vuole usare insieme all'azione.
function controllaOggetto(partita, giocatore, oggetto) {
  if (!oggetto || typeof oggetto !== 'object') return errore('Oggetto non valido.');
  if (!giocatore.vivo) return errore('Gli Spettri non usano Oggetti.');
  if (!giocatore.oggetti.includes(oggetto.id)) return errore('Non hai questo Oggetto.');

  const altro = trovaInPartita(partita, oggetto.bersaglio);
  if (oggetto.id === 'amuleto') return errore("L'Amuleto si usa da solo.");
  if (oggetto.id === 'pozione' && nonCurabile(giocatore)) return errore('Non puoi essere curata.');
  if (oggetto.id === 'rampino') {
    if (!altro || !altro.vivo || altro.id === giocatore.id) return errore('Scegli a chi rubare.');
    return { ok: true, oggetto: { id: oggetto.id, bersaglio: altro.id } };
  }
  if (oggetto.id === 'campanella') {
    if (!altro || altro.vivo) return errore('Scegli uno Spettro.');
    return { ok: true, oggetto: { id: oggetto.id, bersaglio: altro.id } };
  }
  return { ok: true, oggetto: { id: oggetto.id } };
}

// Controlla la scelta e la salva. I tipi possibili:
//   vivi:    { tipo: 'attacca', bersaglio, con: 'forza' | 'magia' }
//            { tipo: 'difenditi' }   { tipo: 'esplora' }
//            { tipo: 'abilita', bersaglio? }   { tipo: 'patto', bersaglio }
//            più, se vuoi:  oggetto: { id, bersaglio? }
//   Spettri: { tipo: 'perseguita', bersaglio }  { tipo: 'benedici', bersaglio }
export function registraScelta(partita, idGiocatore, scelta) {
  if (partita.fase !== 'scelta') return errore('Non è il momento di scegliere.');
  const giocatore = trovaInPartita(partita, idGiocatore);
  if (!giocatore) return errore('Non sei in questa partita.');
  if (!scelta || typeof scelta !== 'object') return errore('Scelta non valida.');

  const { tipo, con } = scelta;
  const altro = trovaInPartita(partita, scelta.bersaglio);
  const altroVivo = altro && altro.vivo && altro.id !== idGiocatore;
  let pulita; // salviamo solo i campi che ci servono: tutto il resto viene ignorato

  if (!giocatore.vivo) {
    if (tipo !== 'perseguita' && tipo !== 'benedici') return errore('Non puoi fare questa azione.');
    if (!altroVivo) return errore('Scegli un giocatore vivo.');
    pulita = { tipo, bersaglio: altro.id };
  } else if (tipo === 'attacca') {
    if (!altroVivo) return errore('Scegli un giocatore vivo.');
    if (con !== 'forza' && con !== 'magia') return errore('Scegli Forza o Magia.');
    pulita = { tipo, bersaglio: altro.id, con };
  } else if (tipo === 'difenditi' || tipo === 'esplora') {
    pulita = { tipo };
  } else if (tipo === 'patto') {
    if (!altroVivo) return errore('Scegli un giocatore vivo.');
    const motivo = motivoNientePatto(partita, giocatore, altro);
    if (motivo) return errore(motivo);
    pulita = { tipo, bersaglio: altro.id };
  } else if (tipo === 'abilita') {
    if (personaggioDi(giocatore).abilita.tipo !== 'attiva') {
      return errore('La tua abilità funziona da sola.');
    }
    if (partita.round < giocatore.abilitaDalRound) return errore("L'abilità si sta ricaricando.");

    pulita = { tipo };
    if (e(giocatore, 'brunna')) {
      if (!altroVivo) return errore('Scegli chi proteggere.');
      pulita.bersaglio = altro.id;
    }
    if (e(giocatore, 'mirra')) {
      if (!altro || !altro.vivo) return errore('Scegli chi curare.');
      if (nonCurabile(altro)) return errore(`${altro.nome} non può essere curata.`);
      pulita.bersaglio = altro.id;
    }
  } else {
    return errore('Non puoi fare questa azione.');
  }

  if (scelta.oggetto) {
    const controllo = controllaOggetto(partita, giocatore, scelta.oggetto);
    if (!controllo.ok) return controllo;
    pulita.oggetto = controllo.oggetto;
  }

  partita.scelte[idGiocatore] = pulita;
  return { ok: true };
}

// ---- Il mazzo ----

// Pesca la prima carta. Se il mazzo è finito, prima si rimescolano gli scarti.
function pesca(partita, eventi, casuale) {
  if (partita.mazzo.length === 0) {
    partita.mazzo = mescola(partita.scarti, casuale);
    partita.scarti = [];
    eventi.push({ tipo: 'rimescola' });
  }
  const carta = partita.mazzo.pop();
  partita.scarti.push(carta);
  return carta;
}

// ---- Lo scontro ----

const eSpeciale = (carta, id) => carta.tipo === 'speciale' && carta.id === id;
const valoreCarta = (carta) =>
  carta.tipo === 'numero' ? carta.valore : CONFIG.destino.valoreSpeciale;

// Quanto è "buona" una carta per chi la pesca (serve alla Fiala del Fato).
function bontaCarta(carta) {
  if (eSpeciale(carta, 'colpo-del-fato')) return 10;
  if (eSpeciale(carta, 'sventura')) return -10;
  return valoreCarta(carta);
}

// Risolve UN attacco. "attacco" e "difesa" sono i valori prima della carta
// (caratteristica + bonus). L'ordine delle regole:
//   1. si sommano le carte (una carta speciale vale 0)
//   2. Ribaltone: i due totali si scambiano
//   3. Colpo del Fato e Sventura decidono il vincitore, qualunque sia il totale
//   4. se vince l'attaccante: danno = differenza + 1 (mai meno di 1)
//   5. Specchio (solo se pescato da chi si difende): il danno torna a chi attacca
export function risolviScontro({ attacco, difesa, cartaAttacco, cartaDifesa }) {
  const sommaAttacco = attacco + valoreCarta(cartaAttacco);
  const sommaDifesa = difesa + valoreCarta(cartaDifesa);

  const ribaltone = eSpeciale(cartaAttacco, 'ribaltone') || eSpeciale(cartaDifesa, 'ribaltone');
  const totaleAttacco = ribaltone ? sommaDifesa : sommaAttacco;
  const totaleDifesa = ribaltone ? sommaAttacco : sommaDifesa;

  // Contiamo i "punti del destino": sopra zero vince l'attaccante, sotto il difensore.
  let destino = 0;
  if (eSpeciale(cartaAttacco, 'colpo-del-fato')) destino++;
  if (eSpeciale(cartaDifesa, 'sventura')) destino++;
  if (eSpeciale(cartaDifesa, 'colpo-del-fato')) destino--;
  if (eSpeciale(cartaAttacco, 'sventura')) destino--;
  const automatico = [cartaAttacco, cartaDifesa].some(
    (c) => eSpeciale(c, 'colpo-del-fato') || eSpeciale(c, 'sventura'),
  );

  // Se non decide il destino, decide chi ha il totale più alto.
  const differenza = automatico ? destino : totaleAttacco - totaleDifesa;
  let vincitore = 'nessuno';
  if (differenza > 0) vincitore = 'attaccante';
  if (differenza < 0) vincitore = 'difensore';

  const danno =
    vincitore === 'attaccante'
      ? Math.max(totaleAttacco - totaleDifesa, 0) + CONFIG.attacco.dannoBase
      : 0;
  const riflesso = danno > 0 && eSpeciale(cartaDifesa, 'specchio');

  return {
    sommaAttacco,
    sommaDifesa,
    totaleAttacco,
    totaleDifesa,
    ribaltone,
    automatico,
    vincitore,
    danno,
    riflesso,
  };
}

// ---- La risoluzione del round ----

// Calcola tutto quello che succede nel round e lo racconta in una lista di
// "eventi" (partita.ultimoRound.eventi), che l'interfaccia mostrerà ai giocatori.
//
// L'ordine: Oggetti -> patti -> abilità -> esplorazioni -> benedizioni ->
// TUTTI gli attacchi -> Spettri -> danni -> Taglia -> crollo -> vittoria.
export function risolviRound(partita, casuale = Math.random) {
  if (partita.fase !== 'scelta') return errore('Il round è già stato risolto.');

  const eventi = [];
  const privati = {}; // cose che può vedere un solo giocatore (es. la Pergamena)
  const vivi = partita.giocatori.filter((g) => g.vivo);
  const spettri = partita.giocatori.filter((g) => !g.vivo);
  const sceltaDi = (giocatore) => partita.scelte[giocatore.id];
  const trova = (id) => trovaInPartita(partita, id);
  const idTaglia = partita.taglia.id;

  // Gli effetti che durano solo per questo round (Mantello, Scudo, Trappola...).
  const effetti = new Map(partita.giocatori.map((g) => [g.id, {}]));
  const effettiDi = (giocatore) => effetti.get(giocatore.id);

  // I danni non si tolgono subito: si segnano qui e si applicano tutti insieme.
  // Per questo due giocatori possono uccidersi a vicenda.
  const danni = new Map();
  const colpi = new Map(); // vittima -> (colpevole -> danni): serve per la Taglia
  const ferisci = (colpevole, vittima, quanti) => {
    danni.set(vittima.id, (danni.get(vittima.id) ?? 0) + quanti);
    if (!colpevole) return;
    colpevole.danniInflitti += quanti;
    if (!colpi.has(vittima.id)) colpi.set(vittima.id, new Map());
    const diLui = colpi.get(vittima.id);
    diLui.set(colpevole.id, (diLui.get(colpevole.id) ?? 0) + quanti);
  };

  const cura = (giocatore, quanta) => {
    const prima = giocatore.vita;
    giocatore.vita = Math.min(giocatore.vitaMax, giocatore.vita + quanta);
    return giocatore.vita - prima;
  };

  // Usa (e consuma) le benedizioni di un giocatore per il suo prossimo tiro.
  const usaBenedizioni = (giocatore, bonus) => {
    if (giocatore.benedizioni > 0) {
      bonus.push({ nome: 'Benedizione', valore: giocatore.benedizioni });
      giocatore.benedizioni = 0;
    }
  };
  const somma = (bonus) => bonus.reduce((totale, b) => totale + b.valore, 0);

  // Pesca una carta per un giocatore, applicando Fiala, Amuleto e "Perseguitato".
  const pescaPer = (giocatore) => {
    let carta = pesca(partita, eventi, casuale);

    if (effettiDi(giocatore).fiala) {
      effettiDi(giocatore).fiala = false;
      const altra = pesca(partita, eventi, casuale);
      const tenuta = bontaCarta(altra) > bontaCarta(carta) ? altra : carta;
      eventi.push({ tipo: 'fiala', giocatore: giocatore.id, carte: [carta, altra], tenuta });
      carta = tenuta;
    }

    if (eSpeciale(carta, 'sventura')) {
      if (togliOggetto(giocatore, 'amuleto')) {
        eventi.push({ tipo: 'amuleto', giocatore: giocatore.id });
        // La carta resta nel racconto, ma non ha più nessun effetto.
        carta = { tipo: 'speciale', id: 'sventura-annullata', nome: 'Sventura annullata' };
      } else if (e(giocatore, 'ottavio')) {
        const danno = numeriDi(giocatore).dannoSventura;
        ferisci(null, giocatore, danno);
        eventi.push({ tipo: 'perseguitato', giocatore: giocatore.id, danno });
      }
    }
    return carta;
  };

  // --- 1. Gli Oggetti ---
  // Prima si tolgono dalle mani tutti gli Oggetti usati (così il Rampino
  // non può rubare un Oggetto che è stato appena usato), poi si applicano.
  const usati = [];
  for (const giocatore of vivi) {
    const oggetto = sceltaDi(giocatore)?.oggetto;
    if (oggetto && togliOggetto(giocatore, oggetto.id)) usati.push([giocatore, oggetto]);
  }
  for (const [giocatore, oggetto] of usati) {
    const evento = { tipo: 'oggetto', giocatore: giocatore.id, oggetto: oggetto.id };
    const numeri = numeriOggetto(oggetto.id);

    if (oggetto.id === 'pozione') evento.cura = cura(giocatore, numeri.cura);
    if (oggetto.id === 'pugnale') effettiDi(giocatore).pugnale = numeri.bonus;
    if (oggetto.id === 'mantello') effettiDi(giocatore).mantello = numeri.bonus;
    if (oggetto.id === 'fumogeno') effettiDi(giocatore).fumogeno = true;
    if (oggetto.id === 'trappola') effettiDi(giocatore).trappola = numeri.danno;
    if (oggetto.id === 'fiala') effettiDi(giocatore).fiala = true;
    if (oggetto.id === 'pergamena') effettiDi(giocatore).pergamena = numeri.carte;
    if (oggetto.id === 'bomba') {
      evento.danno = numeri.danno;
      for (const altro of vivi) {
        if (altro.id !== giocatore.id) ferisci(giocatore, altro, numeri.danno);
      }
    }
    if (oggetto.id === 'rampino') {
      const derubato = trova(oggetto.bersaglio);
      evento.bersaglio = derubato.id;
      evento.riuscito = derubato.oggetti.length > 0;
      if (evento.riuscito) {
        const indice = Math.floor(casuale() * derubato.oggetti.length);
        giocatore.oggetti.push(...derubato.oggetti.splice(indice, 1));
      }
    }
    if (oggetto.id === 'campanella') {
      const spettro = trova(oggetto.bersaglio);
      evento.bersaglio = spettro.id;
      // Lo Spettro non può rifiutarsi: la sua scelta diventa "benedici".
      partita.scelte[spettro.id] = { tipo: 'benedici', bersaglio: giocatore.id, obbligato: true };
    }
    eventi.push(evento);
  }

  // --- 2. I patti: servono DUE proposte, una per parte, nello stesso round ---
  for (const giocatore of vivi) {
    const scelta = sceltaDi(giocatore);
    if (scelta?.tipo !== 'patto') continue;
    const altro = trova(scelta.bersaglio);
    const ricambia =
      sceltaDi(altro)?.tipo === 'patto' && sceltaDi(altro).bersaglio === giocatore.id;
    if (ricambia && !giocatore.alleato && !altro.alleato) {
      giocatore.alleato = altro.id;
      altro.alleato = giocatore.id;
      eventi.push({ tipo: 'alleanza', a: giocatore.id, b: altro.id });
    }
  }

  // --- 3. Le abilità attive (tranne la Fiamma di Zolfo, che è un attacco) ---
  for (const giocatore of vivi) {
    const scelta = sceltaDi(giocatore);
    if (scelta?.tipo !== 'abilita') continue;
    giocatore.abilitaDalRound = partita.round + 1 + CONFIG.round.roundAttesaAbilita;

    if (e(giocatore, 'brunna')) {
      effettiDi(trova(scelta.bersaglio)).scudoDi = giocatore;
      eventi.push({ tipo: 'scudo', da: giocatore.id, a: scelta.bersaglio });
    }
    if (e(giocatore, 'mirra')) {
      const paziente = trova(scelta.bersaglio);
      const numeri = numeriDi(giocatore);
      const curata = cura(paziente, numeri.cura);
      const costo = paziente.id === giocatore.id ? 0 : numeri.costoCuraAltri;
      if (costo > 0) ferisci(null, giocatore, costo); // "Cuore tenero"
      eventi.push({ tipo: 'cura', da: giocatore.id, a: paziente.id, cura: curata, costo });
    }
    if (e(giocatore, 'ottavio')) {
      const carta = partita.mazzo.pop();
      if (carta) partita.scarti.push(carta);
      eventi.push({ tipo: 'scarta', giocatore: giocatore.id, carta: carta ?? null });
    }
  }

  // --- 4. Chi esplora trova un Oggetto (se ha posto) ---
  for (const giocatore of vivi) {
    if (sceltaDi(giocatore)?.tipo !== 'esplora') continue;
    const trovato = daiOggetto(giocatore, casuale);
    eventi.push({ tipo: 'esplora', giocatore: giocatore.id, trovato });
  }

  // --- 5. Le benedizioni degli Spettri valgono già da questo round ---
  for (const spettro of spettri) {
    const scelta = sceltaDi(spettro);
    if (scelta?.tipo !== 'benedici') continue;
    const fortunato = trova(scelta.bersaglio);
    fortunato.benedizioni += CONFIG.spettro.bonusBenedizione;
    eventi.push({ tipo: 'benedizione', da: spettro.id, a: fortunato.id });
  }

  // --- 6. Tutti gli attacchi ---
  const pugnalate = [];

  // "Esplosivo": se Zolfo attaccando pesca uno 0, l'attacco fallisce e si fa male.
  const esplode = (attaccante, carta) => {
    if (!e(attaccante, 'zolfo') || carta.tipo !== 'numero' || carta.valore !== 0) return false;
    const danno = numeriDi(attaccante).dannoEsplosione;
    ferisci(null, attaccante, danno);
    eventi.push({ tipo: 'esplosione', giocatore: attaccante.id, carta, danno });
    return true;
  };

  // Un singolo attacco. Per la Fiamma di Zolfo la carta d'attacco è una sola
  // per tutti i bersagli, e arriva già pescata in "cartaGiaPescata".
  const attacco = (attaccante, bersaglio, con, cartaGiaPescata = null) => {
    const fiamma = cartaGiaPescata !== null;

    // Attaccare il proprio alleato è una Pugnalata.
    const pugnalata = !fiamma && attaccante.alleato === bersaglio.id;
    if (pugnalata) pugnalate.push([attaccante, bersaglio]);

    // Lo Scudo di Brunna: il colpo lo prende lei.
    let difensore = bersaglio;
    const scudo = effettiDi(bersaglio).scudoDi;
    if (scudo && scudo.vivo && scudo.id !== attaccante.id) difensore = scudo;
    const deviato = difensore.id !== bersaglio.id ? bersaglio.id : null;

    if (effettiDi(difensore).fumogeno) {
      effettiDi(difensore).fumogeno = false;
      eventi.push({ tipo: 'fumogeno', attaccante: attaccante.id, difensore: difensore.id });
      return;
    }
    if (effettiDi(difensore).trappola) {
      const danno = effettiDi(difensore).trappola;
      effettiDi(difensore).trappola = 0;
      ferisci(difensore, attaccante, danno);
      eventi.push({ tipo: 'trappola', attaccante: attaccante.id, difensore: difensore.id, danno });
    }

    const bonusAttacco = [];
    if (pugnalata) bonusAttacco.push({ nome: 'Pugnalata', valore: CONFIG.alleanza.bonusPugnalata });
    if (effettiDi(attaccante).pugnale) {
      bonusAttacco.push({ nome: 'Pugnale', valore: effettiDi(attaccante).pugnale });
    }
    usaBenedizioni(attaccante, bonusAttacco);

    const bonusDifesa = [];
    const azioneDifensore = sceltaDi(difensore)?.tipo;
    if (azioneDifensore === 'difenditi') {
      bonusDifesa.push({ nome: 'Difenditi', valore: CONFIG.round.bonusDifenditi });
    }
    if (azioneDifensore === 'esplora') {
      // "Lenta": Brunna quando esplora è più scoperta degli altri.
      const malus = numeriDi(difensore).malusEsplora ?? CONFIG.round.malusEsplora;
      bonusDifesa.push({ nome: 'Esplora', valore: -malus });
    }
    if (effettiDi(difensore).mantello) {
      bonusDifesa.push({ nome: 'Mantello', valore: effettiDi(difensore).mantello });
    }
    if (difensore.alleato && difensore.alleato !== attaccante.id) {
      bonusDifesa.push({ nome: 'Alleato', valore: CONFIG.alleanza.bonusDifesa });
    }
    usaBenedizioni(difensore, bonusDifesa);

    const cartaAttacco = cartaGiaPescata ?? pescaPer(attaccante);
    if (!fiamma && esplode(attaccante, cartaAttacco)) return;
    const cartaDifesa = pescaPer(difensore);

    const esito = risolviScontro({
      attacco: attaccante[con] + somma(bonusAttacco),
      difesa: difensore.agilita + somma(bonusDifesa),
      cartaAttacco,
      cartaDifesa,
    });

    // I ritocchi al danno: prima il "Colpo nell'ombra", poi la Taglia.
    const modificatori = [];
    let danno = esito.danno;
    if (esito.riflesso) {
      ferisci(difensore, attaccante, danno);
    } else if (danno > 0) {
      if (e(attaccante, 'vesper') && difensore.vita < difensore.vitaMax) {
        danno *= numeriDi(attaccante).moltiplicatoreDanno;
        modificatori.push("Colpo nell'ombra");
      }
      if (difensore.id === idTaglia) {
        danno += CONFIG.taglia.dannoExtra;
        modificatori.push('Taglia');
      }
      ferisci(attaccante, difensore, danno);
    }

    eventi.push({
      tipo: 'scontro',
      attaccante: attaccante.id,
      difensore: difensore.id,
      deviato, // chi era il bersaglio vero, se lo Scudo ha deviato il colpo
      con,
      valoreAttacco: attaccante[con],
      valoreDifesa: difensore.agilita,
      bonusAttacco,
      bonusDifesa,
      cartaAttacco,
      cartaDifesa,
      ...esito,
      danno,
      modificatori,
    });
  };

  for (const attaccante of vivi) {
    const scelta = sceltaDi(attaccante);
    if (scelta?.tipo === 'attacca') {
      attacco(attaccante, trova(scelta.bersaglio), scelta.con);
    }
    if (scelta?.tipo === 'abilita' && e(attaccante, 'zolfo')) {
      // "Fiamma instabile": una carta sola, contro tutti gli altri.
      const carta = pescaPer(attaccante);
      eventi.push({ tipo: 'fiamma', giocatore: attaccante.id });
      if (esplode(attaccante, carta)) continue;
      for (const bersaglio of vivi) {
        if (bersaglio.id !== attaccante.id) attacco(attaccante, bersaglio, 'magia', carta);
      }
    }
  }

  // Le Pugnalate rompono il patto e marchiano il Traditore.
  for (const [traditore, vittima] of pugnalate) {
    traditore.alleato = null;
    vittima.alleato = null;
    traditore.traditoreFino = partita.round + CONFIG.alleanza.roundTraditore;
    eventi.push({ tipo: 'tradimento', traditore: traditore.id, vittima: vittima.id });
  }

  // --- 7. Gli Spettri che perseguitano ---
  for (const spettro of spettri) {
    const scelta = sceltaDi(spettro);
    if (scelta?.tipo !== 'perseguita') continue;
    const vittima = trova(scelta.bersaglio);
    const danno = CONFIG.spettro.dannoPerseguita;
    ferisci(null, vittima, danno);
    eventi.push({ tipo: 'perseguita', da: spettro.id, a: vittima.id, danno });
  }

  // --- 8. Ora i danni si applicano davvero, tutti nello stesso momento ---
  const mortiNelRound = [];
  const applicaDanni = () => {
    const mortiOra = [];
    for (const giocatore of partita.giocatori) {
      const danno = danni.get(giocatore.id) ?? 0;
      if (!giocatore.vivo || danno === 0) continue;
      giocatore.vita = Math.max(0, giocatore.vita - danno);
      if (giocatore.vita === 0) mortiOra.push(giocatore);
    }
    danni.clear();

    for (const morto of mortiOra) {
      morto.vivo = false;
      morto.benedizioni = 0;
      morto.oggetti = [];
      // Il patto finisce con la morte.
      const alleato = trova(morto.alleato);
      if (alleato) alleato.alleato = null;
      morto.alleato = null;
      mortiNelRound.push(morto);
      eventi.push({ tipo: 'morte', giocatore: morto.id });
    }

    // "Patto delle anime": Corvina diventa più forte a ogni morte.
    for (const giocatore of partita.giocatori) {
      if (!giocatore.vivo || !e(giocatore, 'corvina') || mortiOra.length === 0) continue;
      const { magiaPerMorte, magiaMassima } = numeriDi(giocatore);
      const nuova = Math.min(magiaMassima, giocatore.magia + magiaPerMorte * mortiOra.length);
      if (nuova > giocatore.magia) {
        giocatore.magia = nuova;
        eventi.push({ tipo: 'anime', giocatore: giocatore.id, magia: nuova });
      }
    }
    return mortiOra;
  };

  // --- 9. La Taglia: chi ha eliminato il ricercato incassa la ricompensa ---
  const ricercato = applicaDanni().find((g) => g.id === idTaglia);
  if (ricercato) {
    // Incassa chi gli ha fatto più danni in questo round (se è ancora vivo).
    const colpevoli = [...(colpi.get(ricercato.id) ?? [])]
      .map(([id, quanti]) => ({ giocatore: trova(id), quanti }))
      .filter((c) => c.giocatore.vivo);
    const record = Math.max(0, ...colpevoli.map((c) => c.quanti));
    for (const { giocatore, quanti } of colpevoli) {
      if (quanti !== record) continue;
      const vita = ricompensaTaglia(partita);
      giocatore.vita += vita; // la ricompensa può superare la Vita massima
      let oggetti = 0;
      for (let i = 0; i < CONFIG.taglia.ricompensaOggetti; i++) {
        if (daiOggetto(giocatore, casuale)) oggetti++;
      }
      eventi.push({ tipo: 'taglia-riscossa', giocatore: giocatore.id, vittima: ricercato.id, vita, oggetti });
    }
  }

  // --- 10. Il crollo della Torre colpisce chi è ancora vivo ---
  const crollo = dannoCrollo(partita.round);
  const sopravvissuti = partita.giocatori.filter((g) => g.vivo);
  if (crollo > 0 && sopravvissuti.length > 0) {
    eventi.push({ tipo: 'crollo', danno: crollo });
    for (const giocatore of sopravvissuti) ferisci(null, giocatore, crollo);
    applicaDanni();
  }

  // --- 11. C'è un vincitore? ---
  const ancoraVivi = partita.giocatori.filter((g) => g.vivo);
  if (ancoraVivi.length === 1) {
    partita.vincitori = [ancoraVivi[0].id];
  } else if (ancoraVivi.length === 0) {
    // Sono morti tutti insieme: vince chi ha inflitto più danni in partita.
    const record = Math.max(...mortiNelRound.map((g) => g.danniInflitti));
    partita.vincitori = mortiNelRound.filter((g) => g.danniInflitti === record).map((g) => g.id);
  }

  // --- 12. La Taglia va a chi ha più Vita (in caso di pareggio, a nessuno) ---
  if (!partita.vincitori) {
    const piuVita = Math.max(...ancoraVivi.map((g) => g.vita));
    const primi = ancoraVivi.filter((g) => g.vita === piuVita);
    const nuovoId = primi.length === 1 ? primi[0].id : null;
    if (nuovoId && nuovoId === partita.taglia.id) {
      partita.taglia.round++; // resta sulla stessa persona: la ricompensa cresce
    } else {
      if (nuovoId !== partita.taglia.id) eventi.push({ tipo: 'taglia', giocatore: nuovoId });
      partita.taglia = { id: nuovoId, round: nuovoId ? 1 : 0 };
    }
  }

  // --- 13. La Pergamena del Fato: uno sguardo alle prossime carte, solo per chi l'ha usata ---
  for (const giocatore of partita.giocatori) {
    const quante = effettiDi(giocatore).pergamena;
    if (quante) privati[giocatore.id] = { pergamena: partita.mazzo.slice(-quante).reverse() };
  }

  partita.ultimoRound = {
    round: partita.round,
    notte: eNotte(partita.round),
    scelte: partita.scelte,
    eventi,
    privati,
  };
  partita.scelte = {};
  partita.fase = partita.vincitori ? 'finita' : 'risultati';
  return { ok: true };
}

export function prossimoRound(partita) {
  if (partita.fase !== 'risultati') return errore('Non si può ancora andare avanti.');
  partita.round++;
  partita.fase = 'scelta';
  return { ok: true };
}

// ---- Cosa può vedere un telefono ----

// Di notte ognuno vede solo quello che lo riguarda, e non sa CHI è stato.
// Per ogni tipo di evento diciamo quale campo contiene chi agisce ("da")
// e quale chi subisce ("a").
const RUOLI = {
  scontro: { da: 'attaccante', a: 'difensore' },
  fumogeno: { da: 'attaccante', a: 'difensore' },
  trappola: { da: 'attaccante', a: 'difensore' },
  benedizione: { da: 'da', a: 'a' },
  perseguita: { da: 'da', a: 'a' },
  cura: { da: 'da', a: 'a' },
  scudo: { da: 'da', a: 'a' },
  oggetto: { da: 'giocatore', a: 'bersaglio' },
  fiala: { da: 'giocatore' },
  amuleto: { da: 'giocatore' },
  perseguitato: { da: 'giocatore' },
  esplosione: { da: 'giocatore' },
  fiamma: { da: 'giocatore' },
  scarta: { da: 'giocatore' },
  esplora: { da: 'giocatore' },
};

function eventiDiNotte(eventi, idGiocatore) {
  const visti = [];
  for (const evento of eventi) {
    const ruoli = RUOLI[evento.tipo];
    if (!ruoli) {
      visti.push(evento); // morti, crollo, Taglia, patti...: li vedono tutti
    } else if (evento[ruoli.da] === idGiocatore) {
      visti.push(evento); // l'ho fatto io: lo vedo per intero
    } else if (evento.tipo === 'oggetto' && evento.oggetto === 'bomba') {
      visti.push({ tipo: 'oggetto', oggetto: 'bomba', danno: evento.danno, giocatore: null });
    } else if (ruoli.a && evento[ruoli.a] === idGiocatore) {
      // L'ho subito: so cosa mi è successo, ma non chi è stato.
      if (evento.tipo === 'scontro') {
        visti.push({
          tipo: 'scontro',
          anonimo: true,
          attaccante: null,
          difensore: evento.difensore,
          vincitore: evento.vincitore,
          riflesso: evento.riflesso,
          danno: evento.danno,
        });
      } else {
        visti.push({ ...evento, [ruoli.da]: null });
      }
    }
  }
  return visti;
}

// Ogni telefono riceve una vista DIVERSA: delle scelte degli altri sa solo
// "ha scelto / non ha scelto", mai che cosa. È così che restano segrete.
export function vistaPartita(partita, idGiocatore) {
  const ioStesso = trovaInPartita(partita, idGiocatore);

  let ultimoRound = null;
  if (partita.ultimoRound) {
    const { round, notte, scelte, eventi, privati } = partita.ultimoRound;
    const miaScelta = scelte[idGiocatore];
    ultimoRound = {
      round,
      notte,
      scelte: notte ? (miaScelta ? { [idGiocatore]: miaScelta } : {}) : scelte,
      eventi: notte ? eventiDiNotte(eventi, idGiocatore) : eventi,
      privato: privati[idGiocatore] ?? null,
    };
  }

  return {
    round: partita.round,
    fase: partita.fase,
    notte: eNotte(partita.round),
    notteInArrivo: !eNotte(partita.round) && eNotte(partita.round + 1),
    dannoCrollo: dannoCrollo(partita.round),
    taglia: { ...partita.taglia, ricompensa: ricompensaTaglia(partita) },
    giocatori: partita.giocatori.map((g) => {
      // Gli Oggetti li vedi solo se sono tuoi o del tuo alleato.
      const vedoOggetti = g.id === idGiocatore || (ioStesso && ioStesso.alleato === g.id);
      const { oggetti, ...pubblico } = g;
      return {
        ...pubblico,
        numeroOggetti: oggetti.length,
        oggetti: vedoOggetti ? oggetti : null,
        traditore: eTraditore(partita, g),
        haScelto: g.id in partita.scelte,
      };
    }),
    carteNelMazzo: partita.mazzo.length, // quante, non quali!
    // "Mano truccata": solo Ottavio vede la prima carta del mazzo.
    primaCarta:
      ioStesso?.vivo && e(ioStesso, 'ottavio') ? (partita.mazzo.at(-1) ?? null) : undefined,
    scarti: partita.scarti,
    miaScelta: partita.scelte[idGiocatore] ?? null,
    ultimoRound,
    vincitori: partita.vincitori,
  };
}
