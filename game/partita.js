// =============================================================
//  LA PARTITA: il cuore del gioco
//  Logica pura: round, scelte segrete, scontri, crollo della Torre,
//  morte, Spettri e vittoria. Niente server e niente schermo.
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
      };
    }),
    mazzo: mescola(creaMazzoDestino(), casuale),
    scarti: [], // le carte uscite: le vedono tutti
    scelte: {}, // idGiocatore -> scelta. SEGRETE fino alla risoluzione!
    ultimoRound: null, // il racconto dell'ultimo round risolto
    vincitori: null, // a partita finita: la lista degli id di chi ha vinto
  };
}

export function trovaInPartita(partita, idGiocatore) {
  return partita.giocatori.find((g) => g.id === idGiocatore);
}

// Quanta Vita toglie il crollo della Torre in un certo round.
export function dannoCrollo(round) {
  let danno = 0;
  for (const livello of CONFIG.crollo) {
    if (round >= livello.dalRound) danno = livello.danno;
  }
  return danno;
}

// ---- Le scelte segrete ----

// Controlla la scelta e la salva. I tipi possibili:
//   vivi:    { tipo: 'attacca', bersaglio, con: 'forza' | 'magia' }
//            { tipo: 'difenditi' }
//   Spettri: { tipo: 'perseguita', bersaglio }  { tipo: 'benedici', bersaglio }
export function registraScelta(partita, idGiocatore, scelta) {
  if (partita.fase !== 'scelta') return errore('Non è il momento di scegliere.');
  const giocatore = trovaInPartita(partita, idGiocatore);
  if (!giocatore) return errore('Non sei in questa partita.');
  if (!scelta || typeof scelta !== 'object') return errore('Scelta non valida.');

  const { tipo, bersaglio, con } = scelta;
  const serveBersaglio = ['attacca', 'perseguita', 'benedici'].includes(tipo);
  if (serveBersaglio) {
    const altro = trovaInPartita(partita, bersaglio);
    if (!altro || !altro.vivo) return errore('Scegli un giocatore vivo.');
    if (altro.id === idGiocatore) return errore('Non puoi scegliere te stesso.');
  }

  // Salviamo solo i campi che ci servono: tutto il resto viene ignorato.
  if (giocatore.vivo && tipo === 'attacca') {
    if (con !== 'forza' && con !== 'magia') return errore('Scegli Forza o Magia.');
    partita.scelte[idGiocatore] = { tipo, bersaglio, con };
  } else if (giocatore.vivo && tipo === 'difenditi') {
    partita.scelte[idGiocatore] = { tipo };
  } else if (!giocatore.vivo && (tipo === 'perseguita' || tipo === 'benedici')) {
    partita.scelte[idGiocatore] = { tipo, bersaglio };
  } else {
    return errore('Non puoi fare questa azione.');
  }
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
export function risolviRound(partita, casuale = Math.random) {
  if (partita.fase !== 'scelta') return errore('Il round è già stato risolto.');

  const eventi = [];
  const vivi = partita.giocatori.filter((g) => g.vivo);
  const spettri = partita.giocatori.filter((g) => !g.vivo);
  const sceltaDi = (giocatore) => partita.scelte[giocatore.id];

  // I danni non si tolgono subito: si segnano qui e si applicano tutti insieme.
  // Per questo due giocatori possono uccidersi a vicenda.
  const danni = new Map();
  const ferisci = (colpevole, vittima, quanti) => {
    danni.set(vittima.id, (danni.get(vittima.id) ?? 0) + quanti);
    if (colpevole) colpevole.danniInflitti += quanti;
  };

  // Usa (e consuma) le benedizioni di un giocatore per il suo prossimo tiro.
  const usaBenedizioni = (giocatore, bonus) => {
    if (giocatore.benedizioni > 0) {
      bonus.push({ nome: 'Benedizione', valore: giocatore.benedizioni });
      giocatore.benedizioni = 0;
    }
  };
  const somma = (bonus) => bonus.reduce((totale, b) => totale + b.valore, 0);

  // 1. Le benedizioni degli Spettri valgono già da questo round.
  for (const spettro of spettri) {
    const scelta = sceltaDi(spettro);
    if (scelta?.tipo !== 'benedici') continue;
    const fortunato = trovaInPartita(partita, scelta.bersaglio);
    fortunato.benedizioni += CONFIG.spettro.bonusBenedizione;
    eventi.push({ tipo: 'benedizione', da: spettro.id, a: fortunato.id });
  }

  // 2. Tutti gli attacchi.
  for (const attaccante of vivi) {
    const scelta = sceltaDi(attaccante);
    if (scelta?.tipo !== 'attacca') continue;
    const difensore = trovaInPartita(partita, scelta.bersaglio);

    const bonusAttacco = [];
    const bonusDifesa = [];
    usaBenedizioni(attaccante, bonusAttacco);
    if (sceltaDi(difensore)?.tipo === 'difenditi') {
      bonusDifesa.push({ nome: 'Difenditi', valore: CONFIG.round.bonusDifenditi });
    }
    usaBenedizioni(difensore, bonusDifesa);

    const cartaAttacco = pesca(partita, eventi, casuale);
    const cartaDifesa = pesca(partita, eventi, casuale);
    const esito = risolviScontro({
      attacco: attaccante[scelta.con] + somma(bonusAttacco),
      difesa: difensore.agilita + somma(bonusDifesa),
      cartaAttacco,
      cartaDifesa,
    });

    if (esito.riflesso) ferisci(difensore, attaccante, esito.danno);
    else if (esito.danno > 0) ferisci(attaccante, difensore, esito.danno);

    eventi.push({
      tipo: 'scontro',
      attaccante: attaccante.id,
      difensore: difensore.id,
      con: scelta.con,
      valoreAttacco: attaccante[scelta.con],
      valoreDifesa: difensore.agilita,
      bonusAttacco,
      bonusDifesa,
      cartaAttacco,
      cartaDifesa,
      ...esito,
    });
  }

  // 3. Gli Spettri che perseguitano.
  for (const spettro of spettri) {
    const scelta = sceltaDi(spettro);
    if (scelta?.tipo !== 'perseguita') continue;
    const vittima = trovaInPartita(partita, scelta.bersaglio);
    const danno = CONFIG.spettro.dannoPerseguita;
    ferisci(null, vittima, danno);
    eventi.push({ tipo: 'perseguita', da: spettro.id, a: vittima.id, danno });
  }

  // 4. Ora i danni si applicano davvero, tutti nello stesso momento.
  const mortiNelRound = [];
  const applicaDanni = () => {
    for (const giocatore of partita.giocatori) {
      const danno = danni.get(giocatore.id) ?? 0;
      if (!giocatore.vivo || danno === 0) continue;
      giocatore.vita = Math.max(0, giocatore.vita - danno);
      if (giocatore.vita === 0) {
        giocatore.vivo = false;
        giocatore.benedizioni = 0;
        mortiNelRound.push(giocatore);
        eventi.push({ tipo: 'morte', giocatore: giocatore.id });
      }
    }
    danni.clear();
  };
  applicaDanni();

  // 5. Il crollo della Torre colpisce chi è ancora vivo.
  const crollo = dannoCrollo(partita.round);
  const sopravvissuti = partita.giocatori.filter((g) => g.vivo);
  if (crollo > 0 && sopravvissuti.length > 0) {
    eventi.push({ tipo: 'crollo', danno: crollo });
    for (const giocatore of sopravvissuti) ferisci(null, giocatore, crollo);
    applicaDanni();
  }

  // 6. C'è un vincitore?
  const ancoraVivi = partita.giocatori.filter((g) => g.vivo);
  if (ancoraVivi.length === 1) {
    partita.vincitori = [ancoraVivi[0].id];
  } else if (ancoraVivi.length === 0) {
    // Sono morti tutti insieme: vince chi ha inflitto più danni in partita.
    const record = Math.max(...mortiNelRound.map((g) => g.danniInflitti));
    partita.vincitori = mortiNelRound.filter((g) => g.danniInflitti === record).map((g) => g.id);
  }

  partita.ultimoRound = { round: partita.round, scelte: partita.scelte, eventi };
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

// Ogni telefono riceve una vista DIVERSA: delle scelte degli altri sa solo
// "ha scelto / non ha scelto", mai che cosa. È così che restano segrete.
export function vistaPartita(partita, idGiocatore) {
  return {
    round: partita.round,
    fase: partita.fase,
    dannoCrollo: dannoCrollo(partita.round),
    giocatori: partita.giocatori.map((g) => ({
      ...g,
      haScelto: g.id in partita.scelte,
    })),
    carteNelMazzo: partita.mazzo.length, // quante, non quali!
    scarti: partita.scarti,
    miaScelta: partita.scelte[idGiocatore] ?? null,
    ultimoRound: partita.ultimoRound,
    vincitori: partita.vincitori,
  };
}
