// =============================================================
//  LE SCHERMATE DELLA PARTITA
//  Qui si decide solo COSA MOSTRARE. Le regole stanno sul server:
//  questo file riceve la "vista" della partita e la disegna.
// =============================================================

import { CONFIG } from '/game/config.js';
import { riempiTesto } from '/game/testi.js';
import { el } from './dom.js';

const NOMI = { forza: 'Forza', magia: 'Magia', agilita: 'Agilità' };

const trovaPersonaggio = (id) => CONFIG.personaggi.find((p) => p.id === id);
const trovaOggetto = (id) => CONFIG.oggetti.lista.find((o) => o.id === id);
const nomeOggetto = (id) => trovaOggetto(id).nome;

// "stato" è lo stato del telefono (vedi client.js).
// "azioni" sono le funzioni che questo file può chiamare: chiedi() e disegna().
export function schermataPartita(stato, azioni) {
  const { partita } = stato;
  if (!partita) return [el('p', { class: 'sottotitolo' }, 'Caricamento…')];

  // Il "3… 2… 1…" prima della rivelazione.
  if (stato.conteggio) {
    return [
      el(
        'div',
        { class: 'conteggio' },
        el('p', { class: 'sottotitolo' }, 'Le scelte si rivelano tra…'),
        el('p', { class: 'conteggio-numero' }, String(stato.conteggio)),
      ),
    ];
  }

  const perId = Object.fromEntries(partita.giocatori.map((g) => [g.id, g]));
  const contesto = {
    stato,
    azioni,
    partita,
    perId,
    ioStesso: perId[stato.mioId],
    // Di notte non sempre si sa chi è stato: in quel caso l'id è null.
    nome: (id) => (id == null ? 'Qualcuno' : perId[id].nome),
  };

  return [
    testata(partita),
    tavolo(contesto),
    // Nei risultati le carte uscite stanno sopra la barra con il bottone "Avanti".
    ...(partita.fase === 'scelta'
      ? [...pannelloScelta(contesto), carteUscite(partita)]
      : pannelloRisultati(contesto)),
  ];
}

// ---- In alto: round, notte e crollo della Torre ----

function testata(partita) {
  const prossimo = CONFIG.crollo.find((livello) => livello.dalRound > partita.round);
  let crollo;
  if (partita.dannoCrollo > 0) {
    crollo = `La Torre crolla: −${partita.dannoCrollo} Vita a tutti a fine round`;
  } else if (prossimo) {
    crollo = `La Torre inizia a crollare dal round ${prossimo.dalRound}`;
  }

  return el(
    'div',
    { class: 'testata-partita' },
    el('h1', { class: 'round' }, `Round ${partita.round}`, partita.notte && ' · Notte'),
    partita.notte && el('p', { class: 'avviso-notte' }, 'È notte: le azioni sono anonime.'),
    partita.notteInArrivo &&
      el('p', { class: 'avviso-notte' }, 'Sta calando la notte: dal prossimo round le azioni saranno anonime.'),
    crollo && el('p', { class: `crollo ${partita.dannoCrollo > 0 ? 'attivo' : ''}` }, crollo),
  );
}

// ---- Il tavolo: tutti i giocatori con la loro Vita ----

function tavolo({ partita, stato, perId }) {
  return el(
    'ul',
    { class: 'tavolo' },
    partita.giocatori.map((g) => {
      const personaggio = trovaPersonaggio(g.idPersonaggio);
      const dettagli = [];
      if (partita.vincitori?.includes(g.id)) dettagli.push('★ Vince!');
      else if (!g.vivo) dettagli.push('Spettro');
      else if (partita.fase === 'scelta') dettagli.push(g.haScelto ? '✔ pronto' : 'sta scegliendo…');
      if (g.alleato) dettagli.push(`alleato di ${perId[g.alleato].nome}`);
      if (g.traditore && g.vivo) dettagli.push('Traditore');

      return el(
        'li',
        { class: `posto ${g.vivo ? '' : 'spettro'} ${g.id === stato.mioId ? 'mio' : ''}` },
        el('span', { class: 'pallino', style: { background: personaggio.colore } }, personaggio.nome[0]),
        el(
          'span',
          { class: 'giocatore-testo' },
          el('span', { class: 'giocatore-nome' }, g.nome, g.id === stato.mioId && ' (tu)'),
          el('span', { class: 'giocatore-dettagli' }, dettagli.join(' · ')),
        ),
        g.id === partita.taglia.id &&
          el(
            'span',
            { class: 'etichetta-taglia', title: `Chi lo elimina: +${partita.taglia.ricompensa} Vita` },
            `Taglia +${partita.taglia.ricompensa}`,
          ),
        g.benedizioni > 0 && el('span', { class: 'benedetto', title: 'Benedetto' }, `✦+${g.benedizioni}`),
        g.vivo && g.numeroOggetti > 0 &&
          el('span', { class: 'zaino', title: 'Oggetti' }, `▣ ${g.numeroOggetti}`),
        g.vivo &&
          el(
            'span',
            { class: 'vita' },
            `♥ ${g.vita}`,
            el('span', { class: 'solo-lettori' }, ` Vita su ${g.vitaMax}`),
          ),
      );
    }),
  );
}

// ---- Fase di scelta ----

// Trasforma una scelta in una frase.
function descriviScelta(scelta, { nome, perId }, idGiocatore) {
  if (!scelta) return 'Resta a guardare';
  const chi = scelta.bersaglio ? nome(scelta.bersaglio) : '';
  let frase = '?';
  if (scelta.tipo === 'attacca') frase = `Attacca ${chi} con ${NOMI[scelta.con]}`;
  if (scelta.tipo === 'difenditi') frase = 'Si difende';
  if (scelta.tipo === 'esplora') frase = 'Esplora';
  if (scelta.tipo === 'patto') frase = `Propone un patto a ${chi}`;
  if (scelta.tipo === 'perseguita') frase = `Perseguita ${chi}`;
  if (scelta.tipo === 'benedici') frase = `Benedice ${chi}`;
  if (scelta.tipo === 'abilita') {
    const abilita = trovaPersonaggio(perId[idGiocatore].idPersonaggio).abilita.nome;
    frase = `Usa ${abilita}${chi ? ` su ${chi}` : ''}`;
  }
  if (scelta.oggetto) frase += ` + ${nomeOggetto(scelta.oggetto.id)}`;
  return frase;
}

function pannelloScelta(contesto) {
  const { stato, azioni, partita, perId, ioStesso, nome } = contesto;
  const timer = el(
    'div',
    { class: 'timer' },
    el('div', { id: 'timer-barra', class: 'timer-barra' }),
    el('span', { id: 'timer-testo', class: 'timer-testo' }),
  );

  // "bozza" è la scelta che stai ancora componendo (es. Attacca -> chi? -> con cosa?).
  // Vive solo su questo telefono: il server la riceve quando è completa.
  const bozza = stato.bozza ?? {};
  const imposta = (nuovaBozza) => {
    stato.bozza = nuovaBozza;
    azioni.disegna();
  };
  // Cambia solo alcuni campi della bozza, lasciando gli altri come sono.
  const aggiungi = (campi) => imposta({ ...bozza, ...campi });
  const invia = async (azione) => {
    const scelta = bozza.oggetto ? { ...azione, oggetto: bozza.oggetto } : azione;
    const risposta = await azioni.chiedi('scegli-azione', { scelta });
    if (risposta.ok) stato.bozza = null;
    azioni.disegna();
  };
  const indietro = (campi) =>
    el('button', { class: 'bottone-piccolo', onclick: () => aggiungi(campi) }, '← Indietro');

  // Hai già scelto e non stai cambiando idea: riepilogo.
  if (partita.miaScelta && !stato.bozza) {
    const inAttesa = partita.giocatori.filter((g) => !g.haScelto).map((g) => g.nome);
    return [
      timer,
      el(
        'div',
        { class: 'cartello' },
        el('p', { class: 'etichetta' }, 'La tua scelta segreta'),
        el('p', { class: 'scelta-fatta' }, descriviScelta(partita.miaScelta, contesto, ioStesso.id)),
        el('button', { class: 'bottone-piccolo', onclick: () => imposta({}) }, 'Cambia'),
      ),
      el('p', { class: 'nota' }, inAttesa.length ? `In attesa di: ${inAttesa.join(', ')}` : ''),
    ];
  }

  const altriVivi = partita.giocatori.filter((g) => g.vivo && g.id !== ioStesso.id);
  // Una lista di bottoni, uno per giocatore, per rispondere a "chi?".
  const listaBersagli = (domanda, candidati, alTocco, tornaA) => [
    el('p', { class: 'etichetta' }, domanda),
    ...candidati.map((g) =>
      el(
        'button',
        { class: 'bottone', onclick: () => alTocco(g.id) },
        g.id === ioStesso.id ? 'Te' : g.nome,
        g.vivo && `  ♥ ${g.vita}`,
        g.id === ioStesso.alleato && ' (alleato)',
      ),
    ),
    candidati.length === 0 && el('p', { class: 'nota' }, 'Nessuno disponibile.'),
    indietro(tornaA),
  ];

  let contenuto;
  if (!ioStesso.vivo) {
    // ---- Spettro ----
    if (bozza.tipo) {
      const verbo = bozza.tipo === 'perseguita' ? 'perseguiti' : 'benedici';
      contenuto = listaBersagli(
        `Chi ${verbo}?`,
        altriVivi,
        (bersaglio) => invia({ tipo: bozza.tipo, bersaglio }),
        { tipo: null },
      );
    } else {
      contenuto = [
        el('p', { class: 'etichetta' }, 'Sei uno Spettro. Cosa fai?'),
        el(
          'button',
          { class: 'bottone bottone-vita', onclick: () => aggiungi({ tipo: 'perseguita' }) },
          `Perseguita (${CONFIG.spettro.dannoPerseguita} danno)`,
        ),
        el(
          'button',
          { class: 'bottone', onclick: () => aggiungi({ tipo: 'benedici' }) },
          `Benedici (+${CONFIG.spettro.bonusBenedizione} al prossimo tiro)`,
        ),
      ];
    }
  } else if (bozza.oggettoInAttesa) {
    // ---- Un Oggetto che ha bisogno di un bersaglio (Rampino, Campanella) ----
    const id = bozza.oggettoInAttesa;
    const candidati = id === 'campanella' ? partita.giocatori.filter((g) => !g.vivo) : altriVivi;
    contenuto = listaBersagli(
      id === 'campanella' ? 'Quale Spettro deve benedirti?' : 'A chi rubi un Oggetto?',
      candidati,
      (bersaglio) => aggiungi({ oggetto: { id, bersaglio }, oggettoInAttesa: null }),
      { oggettoInAttesa: null },
    );
  } else if (bozza.tipo === 'attacca' && bozza.bersaglio) {
    // ---- Attacco: con cosa? ----
    const pugnalata = bozza.bersaglio === ioStesso.alleato;
    contenuto = [
      el(
        'p',
        { class: 'etichetta' },
        pugnalata
          ? `Pugnalata a ${nome(bozza.bersaglio)}! +${CONFIG.alleanza.bonusPugnalata}, ma diventi un Traditore.`
          : `Attacchi ${nome(bozza.bersaglio)}. Con cosa?`,
      ),
      ...['forza', 'magia'].map((con) =>
        el(
          'button',
          {
            class: `bottone bottone-${con}`,
            onclick: () => invia({ tipo: 'attacca', bersaglio: bozza.bersaglio, con }),
          },
          `${NOMI[con]} (${ioStesso[con]})`,
        ),
      ),
      indietro({ bersaglio: null }),
    ];
  } else if (bozza.tipo === 'attacca') {
    contenuto = listaBersagli('Chi attacchi?', altriVivi, (bersaglio) => aggiungi({ bersaglio }), {
      tipo: null,
    });
  } else if (bozza.tipo === 'patto') {
    const liberi = altriVivi.filter((g) => !g.alleato && !g.traditore);
    contenuto = listaBersagli(
      'A chi proponi un patto? Nasce solo se anche lui lo propone a te.',
      liberi,
      (bersaglio) => invia({ tipo: 'patto', bersaglio }),
      { tipo: null },
    );
  } else if (bozza.tipo === 'abilita') {
    // Solo Brunna (chi proteggere) e Mirra (chi curare) arrivano qui.
    const mirra = ioStesso.idPersonaggio === 'mirra';
    const candidati = mirra
      ? partita.giocatori.filter((g) => g.vivo && g.idPersonaggio !== 'corvina')
      : altriVivi;
    contenuto = listaBersagli(
      mirra ? 'Chi curi?' : 'Chi proteggi?',
      candidati,
      (bersaglio) => invia({ tipo: 'abilita', bersaglio }),
      { tipo: null },
    );
  } else {
    contenuto = menuPrincipale(contesto, { bozza, aggiungi, invia });
  }

  return [
    timer,
    // "Mano truccata": solo Ottavio riceve questa informazione dal server.
    partita.primaCarta !== undefined &&
      ioStesso.vivo &&
      el(
        'p',
        { class: 'info-segreta' },
        'Prima carta del Destino: ',
        partita.primaCarta ? carta(partita.primaCarta) : 'il mazzo è finito',
      ),
    el('div', { class: 'cartello azioni' }, contenuto),
    ioStesso.alleato &&
      el(
        'p',
        { class: 'nota' },
        `Oggetti di ${nome(ioStesso.alleato)}: `,
        (perId[ioStesso.alleato].oggetti ?? []).map(nomeOggetto).join(', ') || 'nessuno',
      ),
  ];
}

// Il primo passo: gli Oggetti (gratis) e le cinque azioni.
function menuPrincipale({ partita, ioStesso }, { bozza, aggiungi, invia }) {
  const personaggio = trovaPersonaggio(ioStesso.idPersonaggio);
  const { abilita } = personaggio;
  const roundMancanti = ioStesso.abilitaDalRound - partita.round;
  const puoAllearsi = !ioStesso.alleato && !ioStesso.traditore;
  const pieno = ioStesso.oggetti.length >= CONFIG.oggetti.massimoATesta;

  const scegliOggetto = (id) => {
    if (bozza.oggetto?.id === id) return aggiungi({ oggetto: null }); // secondo tocco: lo togli
    if (id === 'rampino' || id === 'campanella') return aggiungi({ oggettoInAttesa: id });
    return aggiungi({ oggetto: { id } });
  };

  const oggetti = ioStesso.oggetti.map((id, indice) => {
    const oggetto = trovaOggetto(id);
    const daSolo = id === 'amuleto';
    // Se hai due Oggetti uguali, solo il primo si illumina.
    const scelto = bozza.oggetto?.id === id && ioStesso.oggetti.indexOf(id) === indice;
    return el(
      'button',
      {
        class: `oggetto ${scelto ? 'scelto' : ''}`,
        disabled: daSolo,
        'aria-pressed': String(scelto),
        onclick: () => scegliOggetto(id),
      },
      el('b', {}, oggetto.nome, scelto && ' ✔'),
      el('span', {}, riempiTesto(oggetto.descrizione, oggetto.numeri)),
    );
  });

  return [
    oggetti.length > 0 && el('p', { class: 'etichetta' }, 'Vuoi usare un Oggetto? (gratis, uno per round)'),
    ...oggetti,

    el('p', { class: 'etichetta' }, 'Scegli in segreto la tua azione'),
    el('button', { class: 'bottone bottone-forza', onclick: () => aggiungi({ tipo: 'attacca' }) }, 'Attacca'),
    el(
      'button',
      { class: 'bottone bottone-agilita', onclick: () => invia({ tipo: 'difenditi' }) },
      `Difenditi (+${CONFIG.round.bonusDifenditi} alla difesa)`,
    ),
    el(
      'button',
      { class: 'bottone bottone-oro', onclick: () => invia({ tipo: 'esplora' }) },
      pieno
        ? 'Esplora (hai già le mani piene!)'
        : `Esplora (un Oggetto, −${personaggio.numeri.malusEsplora ?? CONFIG.round.malusEsplora} alla difesa)`,
    ),
    abilita.tipo === 'attiva' &&
      el(
        'button',
        {
          class: 'bottone bottone-magia',
          disabled: roundMancanti > 0,
          // Brunna e Mirra devono scegliere un giocatore; Zolfo e Ottavio no.
          onclick: () =>
            ['brunna', 'mirra'].includes(personaggio.id)
              ? aggiungi({ tipo: 'abilita' })
              : invia({ tipo: 'abilita' }),
        },
        roundMancanti > 0 ? `${abilita.nome} (si ricarica)` : `Abilità: ${abilita.nome}`,
      ),
    abilita.tipo === 'attiva' &&
      el('p', { class: 'nota' }, riempiTesto(abilita.descrizione, personaggio.numeri)),
    el(
      'button',
      { class: 'bottone', disabled: !puoAllearsi, onclick: () => aggiungi({ tipo: 'patto' }) },
      ioStesso.alleato
        ? 'Hai già un alleato'
        : ioStesso.traditore
          ? 'Traditore: niente patti'
          : 'Proponi un patto',
    ),
  ];
}

// ---- Fase dei risultati ----

function carta(carta) {
  const speciale = carta.tipo === 'speciale';
  return el('span', { class: `carta ${speciale ? 'speciale' : ''}` }, speciale ? carta.nome : String(carta.valore));
}

// Una riga del tipo:  Forza 4 + [2] + Benedizione 1 − Esplora 1 = 7
function conto(nome, valore, cartaPescata, bonus, somma) {
  return el(
    'span',
    { class: 'conto' },
    `${nome} ${valore} + `,
    carta(cartaPescata),
    bonus.map((b) => ` ${b.valore < 0 ? '−' : '+'} ${b.nome} ${Math.abs(b.valore)}`),
    ' = ',
    el('b', {}, String(somma)),
  );
}

function eSpeciale(carta, id) {
  return carta.tipo === 'speciale' && carta.id === id;
}

function eventoScontro(e, nome) {
  const a = nome(e.attaccante);
  const d = nome(e.difensore);

  // Di notte, chi subisce l'attacco riceve dal server solo l'essenziale.
  if (e.anonimo) {
    let testo = `Qualcuno attacca ${d} nel buio, ma senza successo.`;
    if (e.riflesso) testo = `Qualcuno attacca ${d} nel buio, ma lo Specchio rimanda il colpo.`;
    else if (e.danno > 0) testo = `Qualcuno colpisce ${d} nel buio: −${e.danno} Vita.`;
    return el('li', { class: `evento ${e.danno > 0 && !e.riflesso ? 'danno' : ''}` }, testo);
  }

  const note = [];
  if (e.ribaltone) {
    note.push(`Ribaltone! I risultati si scambiano: ${e.totaleAttacco} contro ${e.totaleDifesa}.`);
  }
  if (eSpeciale(e.cartaAttacco, 'colpo-del-fato')) note.push(`Colpo del Fato: ${a} vince lo scontro!`);
  if (eSpeciale(e.cartaDifesa, 'colpo-del-fato')) note.push(`Colpo del Fato: ${d} vince lo scontro!`);
  if (eSpeciale(e.cartaAttacco, 'sventura')) note.push(`Sventura: ${a} perde lo scontro!`);
  if (eSpeciale(e.cartaDifesa, 'sventura')) note.push(`Sventura: ${d} perde lo scontro!`);
  if (!e.riflesso && e.modificatori.includes("Colpo nell'ombra")) {
    note.push(`Colpo nell'ombra: ${d} era già ferito, danno doppio!`);
  }
  if (!e.riflesso && e.modificatori.includes('Taglia')) {
    note.push(`${d} ha la Taglia: +${CONFIG.taglia.dannoExtra} danno.`);
  }

  let esito;
  let classe = 'neutro';
  if (e.riflesso) {
    esito = `Specchio! Il colpo torna indietro: ${a} perde ${e.danno} Vita.`;
    classe = 'danno';
  } else if (e.vincitore === 'attaccante') {
    esito = `Colpito! ${d} perde ${e.danno} Vita.`;
    classe = 'danno';
  } else if (e.vincitore === 'difensore') {
    esito = `${d} schiva il colpo.`;
  } else {
    esito = 'Pareggio: non succede niente.';
  }

  const titolo = e.deviato
    ? `${a} attacca ${nome(e.deviato)}, ma ${d} fa da Scudo`
    : `${a} attacca ${d}`;

  return el(
    'li',
    { class: 'evento scontro' },
    el('p', { class: 'evento-titolo' }, titolo),
    el('p', { class: 'riga-conto' }, el('span', { class: 'chi' }, a), conto(NOMI[e.con], e.valoreAttacco, e.cartaAttacco, e.bonusAttacco, e.sommaAttacco)),
    el('p', { class: 'riga-conto' }, el('span', { class: 'chi' }, d), conto(NOMI.agilita, e.valoreDifesa, e.cartaDifesa, e.bonusDifesa, e.sommaDifesa)),
    note.map((testo) => el('p', { class: 'nota-evento' }, testo)),
    el('p', { class: `esito ${classe}` }, esito),
  );
}

// La frase per l'uso di un Oggetto.
function fraseOggetto(e, nome) {
  const g = nome(e.giocatore);
  const b = e.bersaglio ? nome(e.bersaglio) : '';
  switch (e.oggetto) {
    case 'pozione':
      return `${g} beve una Pozione: +${e.cura} Vita.`;
    case 'pugnale':
      return `${g} impugna un Pugnale.`;
    case 'mantello':
      return `${g} si avvolge nel Mantello.`;
    case 'fumogeno':
      return `${g} lancia un Fumogeno.`;
    case 'trappola':
      return `${g} piazza una Trappola.`;
    case 'fiala':
      return `${g} beve una Fiala del Fato.`;
    case 'pergamena':
      return `${g} legge una Pergamena del Fato.`;
    case 'bomba':
      return `${g} lancia una Bomba: tutti gli altri perdono ${e.danno} Vita.`;
    case 'rampino':
      return e.riuscito ? `${g} ruba un Oggetto a ${b}.` : `${g} prova a derubare ${b}, ma non trova niente.`;
    case 'campanella':
      return `${g} suona la Campanella: ${b} deve benedire.`;
    default:
      return `${g} usa ${nomeOggetto(e.oggetto)}.`;
  }
}

function evento(e, nome) {
  if (e.tipo === 'scontro') return eventoScontro(e, nome);

  // Un evento semplice: una frase, a volte con delle carte in mezzo.
  const riga = (classe, ...pezzi) => el('li', { class: `evento ${classe}` }, pezzi);
  const g = e.giocatore !== undefined ? nome(e.giocatore) : '';

  switch (e.tipo) {
    case 'oggetto':
      return riga(e.oggetto === 'bomba' ? 'danno' : '', fraseOggetto(e, nome));
    case 'fiala':
      return riga('', `Fiala del Fato: ${g} pesca `, carta(e.carte[0]), ' e ', carta(e.carte[1]), ' e tiene ', carta(e.tenuta), '.');
    case 'amuleto':
      return riga('', `L'Amuleto di ${g} annulla la Sventura!`);
    case 'perseguitato':
      return riga('danno', `${g} ha pescato la Sventura: −${e.danno} Vita.`);
    case 'fiamma':
      return riga('', `${g} scatena la Fiamma instabile contro tutti!`);
    case 'esplosione':
      return riga('danno', `La magia di ${g} esplode (ha pescato `, carta(e.carta), `): −${e.danno} Vita.`);
    case 'scarta':
      return riga('', `${g} scarta la prima carta del Destino`, e.carta ? [': ', carta(e.carta)] : '', '.');
    case 'esplora':
      return riga('', e.trovato ? `${g} esplora e trova un Oggetto.` : `${g} esplora, ma ha già le mani piene.`);
    case 'alleanza':
      return riga('patto', `${nome(e.a)} e ${nome(e.b)} stringono un patto!`);
    case 'tradimento':
      return riga('morte', `${nome(e.traditore)} ha pugnalato ${nome(e.vittima)}: il patto è rotto. ${nome(e.traditore)} è un Traditore!`);
    case 'cura':
      return riga(
        '',
        e.da === e.a ? `${nome(e.da)} si cura` : `${nome(e.da)} cura ${nome(e.a)}`,
        `: +${e.cura} Vita.`,
        e.costo > 0 && ` Le costa ${e.costo} Vita.`,
      );
    case 'scudo':
      return riga('', `${nome(e.da)} protegge ${nome(e.a)} con lo Scudo.`);
    case 'fumogeno':
      return riga('', `${nome(e.attaccante)} attacca ${nome(e.difensore)}, ma il Fumogeno annulla l'attacco.`);
    case 'trappola':
      return riga('danno', `${nome(e.attaccante)} cade nella Trappola di ${nome(e.difensore)}: −${e.danno} Vita.`);
    case 'benedizione':
      return riga('', `${nome(e.da)} benedice ${nome(e.a)}: +${CONFIG.spettro.bonusBenedizione} al prossimo tiro.`);
    case 'perseguita':
      return riga('danno', `${nome(e.da)} perseguita ${nome(e.a)}: −${e.danno} Vita.`);
    case 'taglia-riscossa':
      return riga('patto', `${g} incassa la Taglia su ${nome(e.vittima)}: +${e.vita} Vita e ${e.oggetti} Oggetti.`);
    case 'taglia':
      return riga('', e.giocatore ? `La Taglia ora è su ${g}.` : 'Ora nessuno ha la Taglia.');
    case 'anime':
      return riga('', `${g} assorbe le anime dei caduti: Magia ${e.magia}.`);
    case 'crollo':
      return riga('danno', `La Torre crolla: tutti perdono ${e.danno} Vita.`);
    case 'morte':
      return riga('morte', `${g} è diventato uno Spettro!`);
    case 'rimescola':
      return riga('', 'Il mazzo del Destino è finito: si rimescola.');
    default:
      return null;
  }
}

function pannelloRisultati(contesto) {
  const { stato, azioni, partita, nome } = contesto;
  const { ultimoRound } = partita;
  const finita = partita.fase === 'finita';
  const sonoHost = stato.stanza.idHost === stato.mioId;
  const pronto = partita.pronti.includes(stato.mioId);

  let striscione = null;
  if (finita) {
    const vincitori = partita.vincitori.map(nome);
    striscione = el(
      'div',
      { class: 'cartello vittoria' },
      el('p', { class: 'etichetta' }, vincitori.length > 1 ? 'Pareggio!' : 'Abbiamo un vincitore!'),
      el('p', { class: 'vincitore' }, vincitori.join(' e ')),
      el(
        'p',
        { class: 'nota' },
        partita.vincitori.includes(stato.mioId) ? "L'artefatto è tuo." : 'Sarà per la prossima torre.',
      ),
    );
  }

  // Di notte il server manda solo la tua scelta.
  const scelte = partita.giocatori.filter((g) => !ultimoRound.notte || g.id === stato.mioId);

  return [
    striscione,
    el('h2', { class: 'sezione' }, `Round ${ultimoRound.round}: le scelte`),
    ultimoRound.notte &&
      el('p', { class: 'avviso-notte' }, 'Era notte: vedi solo quello che riguarda te.'),
    el(
      'ul',
      { class: 'lista-scelte' },
      scelte.map((g) =>
        el('li', {}, el('b', {}, `${g.nome}: `), descriviScelta(ultimoRound.scelte[g.id], contesto, g.id)),
      ),
    ),
    // La Pergamena del Fato: il server manda queste carte solo a chi l'ha usata.
    ultimoRound.privato?.pergamena &&
      el(
        'p',
        { class: 'info-segreta' },
        'Solo per te, le prossime carte del Destino: ',
        ultimoRound.privato.pergamena.map((c) => [carta(c), ' ']),
        ultimoRound.privato.pergamena.length === 0 && 'il mazzo è finito.',
      ),
    ultimoRound.eventi.length > 0 && el('h2', { class: 'sezione' }, 'Cosa è successo'),
    el('ul', { class: 'lista-eventi' }, ultimoRound.eventi.map((e) => evento(e, nome))),
    carteUscite(partita),

    el(
      'div',
      { class: 'barra-fondo' },
      finita
        ? sonoHost
          ? el('button', { class: 'bottone bottone-oro', onclick: () => azioni.chiedi('torna-in-lobby') }, 'Torna alla lobby')
          : el('p', { class: 'nota' }, "L'host può riportare tutti alla lobby.")
        : [
            el('span', { id: 'timer-testo', class: 'nota' }),
            el(
              'button',
              { class: 'bottone bottone-oro', disabled: pronto, onclick: () => azioni.chiedi('avanti') },
              pronto ? 'In attesa degli altri…' : 'Avanti',
            ),
          ],
    ),
  ];
}

// ---- Le carte del Destino già uscite ----

function carteUscite(partita) {
  // Contiamo quante volte è uscita ogni carta: { "0": 2, "Sventura": 1, ... }
  const conteggi = {};
  for (const c of partita.scarti) {
    const nome = c.tipo === 'numero' ? String(c.valore) : c.nome;
    conteggi[nome] = (conteggi[nome] ?? 0) + 1;
  }

  return el(
    'details',
    { class: 'carte-uscite' },
    el('summary', {}, `Carte uscite: ${partita.scarti.length} · nel mazzo: ${partita.carteNelMazzo}`),
    el(
      'p',
      { class: 'elenco-carte' },
      Object.entries(conteggi).map(([nome, quante]) =>
        el('span', { class: `carta ${/^\d$/.test(nome) ? '' : 'speciale'}` }, `${nome} ×${quante}`),
      ),
      partita.scarti.length === 0 && 'Ancora nessuna.',
    ),
  );
}
