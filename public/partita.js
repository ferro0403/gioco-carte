// =============================================================
//  LE SCHERMATE DELLA PARTITA
//  Qui si decide solo COSA MOSTRARE. Le regole stanno sul server:
//  questo file riceve la "vista" della partita e la disegna.
// =============================================================

import { CONFIG } from '/game/config.js';
import { el } from './dom.js';

const NOMI = { forza: 'Forza', magia: 'Magia', agilita: 'Agilità' };

function trovaPersonaggio(id) {
  return CONFIG.personaggi.find((p) => p.id === id);
}

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

  const nomi = Object.fromEntries(partita.giocatori.map((g) => [g.id, g.nome]));
  const ioStesso = partita.giocatori.find((g) => g.id === stato.mioId);
  const contesto = { stato, azioni, partita, nomi, ioStesso };

  return [
    testata(partita),
    tavolo(contesto),
    // Nei risultati le carte uscite stanno sopra la barra con il bottone "Avanti".
    ...(partita.fase === 'scelta'
      ? [...pannelloScelta(contesto), carteUscite(partita)]
      : pannelloRisultati(contesto)),
  ];
}

// ---- In alto: round e crollo della Torre ----

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
    el('h1', { class: 'round' }, `Round ${partita.round}`),
    crollo && el('p', { class: `crollo ${partita.dannoCrollo > 0 ? 'attivo' : ''}` }, crollo),
  );
}

// ---- Il tavolo: tutti i giocatori con la loro Vita ----

function tavolo({ partita, stato }) {
  return el(
    'ul',
    { class: 'tavolo' },
    partita.giocatori.map((g) => {
      const personaggio = trovaPersonaggio(g.idPersonaggio);
      let stato2 = '';
      if (!g.vivo) stato2 = 'Spettro';
      else if (partita.fase === 'scelta') stato2 = g.haScelto ? '✔ pronto' : 'sta scegliendo…';
      if (partita.vincitori?.includes(g.id)) stato2 = '★ Vince!';

      return el(
        'li',
        { class: `posto ${g.vivo ? '' : 'spettro'} ${g.id === stato.mioId ? 'mio' : ''}` },
        el('span', { class: 'pallino', style: { background: personaggio.colore } }, personaggio.nome[0]),
        el(
          'span',
          { class: 'giocatore-testo' },
          el('span', { class: 'giocatore-nome' }, g.nome, g.id === stato.mioId && ' (tu)'),
          el('span', { class: 'giocatore-dettagli' }, stato2),
        ),
        g.benedizioni > 0 && el('span', { class: 'benedetto', title: 'Benedetto' }, `✦+${g.benedizioni}`),
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
function descriviScelta(scelta, nomi) {
  if (!scelta) return 'Resta a guardare';
  const chi = nomi[scelta.bersaglio];
  if (scelta.tipo === 'attacca') return `Attacca ${chi} con ${NOMI[scelta.con]}`;
  if (scelta.tipo === 'difenditi') return 'Si difende';
  if (scelta.tipo === 'perseguita') return `Perseguita ${chi}`;
  if (scelta.tipo === 'benedici') return `Benedice ${chi}`;
  return '?';
}

function pannelloScelta({ stato, azioni, partita, nomi, ioStesso }) {
  const timer = el(
    'div',
    { class: 'timer' },
    el('div', { id: 'timer-barra', class: 'timer-barra' }),
    el('span', { id: 'timer-testo', class: 'timer-testo' }),
  );

  // "bozza" è la scelta che stai ancora componendo (es. Attacca -> chi? -> con cosa?).
  // Vive solo su questo telefono: il server la riceve quando è completa.
  const bozza = stato.bozza;
  const imposta = (nuovaBozza) => {
    stato.bozza = nuovaBozza;
    azioni.disegna();
  };
  const invia = async (scelta) => {
    const risposta = await azioni.chiedi('scegli-azione', { scelta });
    if (risposta.ok) stato.bozza = null;
    azioni.disegna();
  };
  const indietro = (a) => el('button', { class: 'bottone-piccolo', onclick: () => imposta(a) }, '← Indietro');

  // Hai già scelto e non stai cambiando idea: riepilogo.
  if (partita.miaScelta && !bozza) {
    const inAttesa = partita.giocatori.filter((g) => !g.haScelto).map((g) => g.nome);
    return [
      timer,
      el(
        'div',
        { class: 'cartello' },
        el('p', { class: 'etichetta' }, 'La tua scelta segreta'),
        el('p', { class: 'scelta-fatta' }, descriviScelta(partita.miaScelta, nomi).replace(/^Si /, 'Ti ')),
        el('button', { class: 'bottone-piccolo', onclick: () => imposta({}) }, 'Cambia'),
      ),
      el('p', { class: 'nota' }, inAttesa.length ? `In attesa di: ${inAttesa.join(', ')}` : ''),
    ];
  }

  const bersagli = partita.giocatori.filter((g) => g.vivo && g.id !== stato.mioId);
  const listaBersagli = (domanda, alTocco) => [
    el('p', { class: 'etichetta' }, domanda),
    ...bersagli.map((g) =>
      el('button', { class: 'bottone', onclick: () => alTocco(g.id) }, `${g.nome}  ♥ ${g.vita}`),
    ),
    indietro({}),
  ];

  let contenuto;
  if (!ioStesso.vivo) {
    // ---- Spettro ----
    if (bozza?.tipo) {
      const verbo = bozza.tipo === 'perseguita' ? 'perseguiti' : 'benedici';
      contenuto = listaBersagli(`Chi ${verbo}?`, (bersaglio) => invia({ tipo: bozza.tipo, bersaglio }));
    } else {
      contenuto = [
        el('p', { class: 'etichetta' }, 'Sei uno Spettro. Cosa fai?'),
        el(
          'button',
          { class: 'bottone bottone-vita', onclick: () => imposta({ tipo: 'perseguita' }) },
          `Perseguita (${CONFIG.spettro.dannoPerseguita} danno)`,
        ),
        el(
          'button',
          { class: 'bottone', onclick: () => imposta({ tipo: 'benedici' }) },
          `Benedici (+${CONFIG.spettro.bonusBenedizione} al prossimo tiro)`,
        ),
      ];
    }
  } else if (bozza?.tipo === 'attacca' && bozza.bersaglio) {
    // ---- Attacco, passo 3: con cosa? ----
    contenuto = [
      el('p', { class: 'etichetta' }, `Attacchi ${nomi[bozza.bersaglio]}. Con cosa?`),
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
      indietro({ tipo: 'attacca' }),
    ];
  } else if (bozza?.tipo === 'attacca') {
    // ---- Attacco, passo 2: chi? ----
    contenuto = listaBersagli('Chi attacchi?', (bersaglio) => imposta({ tipo: 'attacca', bersaglio }));
  } else {
    // ---- Passo 1: quale azione? ----
    contenuto = [
      el('p', { class: 'etichetta' }, 'Scegli in segreto la tua azione'),
      el(
        'button',
        { class: 'bottone bottone-forza', onclick: () => imposta({ tipo: 'attacca' }) },
        'Attacca',
      ),
      el(
        'button',
        { class: 'bottone bottone-agilita', onclick: () => invia({ tipo: 'difenditi' }) },
        `Difenditi (+${CONFIG.round.bonusDifenditi} alla difesa)`,
      ),
    ];
  }

  return [timer, el('div', { class: 'cartello azioni' }, contenuto)];
}

// ---- Fase dei risultati ----

function carta(carta) {
  const speciale = carta.tipo === 'speciale';
  return el('span', { class: `carta ${speciale ? 'speciale' : ''}` }, speciale ? carta.nome : String(carta.valore));
}

// Una riga del tipo:  Forza 4 + [2] + Benedizione 1 = 7
function conto(nome, valore, cartaPescata, bonus, somma) {
  return el(
    'span',
    { class: 'conto' },
    `${nome} ${valore} + `,
    carta(cartaPescata),
    bonus.map((b) => ` + ${b.nome} ${b.valore}`),
    ' = ',
    el('b', {}, String(somma)),
  );
}

function eSpeciale(carta, id) {
  return carta.tipo === 'speciale' && carta.id === id;
}

function eventoScontro(e, nomi) {
  const a = nomi[e.attaccante];
  const d = nomi[e.difensore];

  const note = [];
  if (e.ribaltone) {
    note.push(`Ribaltone! I risultati si scambiano: ${e.totaleAttacco} contro ${e.totaleDifesa}.`);
  }
  if (eSpeciale(e.cartaAttacco, 'colpo-del-fato')) note.push(`Colpo del Fato: ${a} vince lo scontro!`);
  if (eSpeciale(e.cartaDifesa, 'colpo-del-fato')) note.push(`Colpo del Fato: ${d} vince lo scontro!`);
  if (eSpeciale(e.cartaAttacco, 'sventura')) note.push(`Sventura: ${a} perde lo scontro!`);
  if (eSpeciale(e.cartaDifesa, 'sventura')) note.push(`Sventura: ${d} perde lo scontro!`);

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

  return el(
    'li',
    { class: 'evento scontro' },
    el('p', { class: 'evento-titolo' }, `${a} attacca ${d}`),
    el('p', { class: 'riga-conto' }, el('span', { class: 'chi' }, a), conto(NOMI[e.con], e.valoreAttacco, e.cartaAttacco, e.bonusAttacco, e.sommaAttacco)),
    el('p', { class: 'riga-conto' }, el('span', { class: 'chi' }, d), conto(NOMI.agilita, e.valoreDifesa, e.cartaDifesa, e.bonusDifesa, e.sommaDifesa)),
    note.map((testo) => el('p', { class: 'nota-evento' }, testo)),
    el('p', { class: `esito ${classe}` }, esito),
  );
}

function evento(e, nomi) {
  if (e.tipo === 'scontro') return eventoScontro(e, nomi);

  const semplice = (classe, testo) => el('li', { class: `evento ${classe}` }, testo);
  if (e.tipo === 'benedizione') {
    return semplice('', `${nomi[e.da]} benedice ${nomi[e.a]}: +${CONFIG.spettro.bonusBenedizione} al prossimo tiro.`);
  }
  if (e.tipo === 'perseguita') {
    return semplice('danno', `${nomi[e.da]} perseguita ${nomi[e.a]}: −${e.danno} Vita.`);
  }
  if (e.tipo === 'crollo') return semplice('danno', `La Torre crolla: tutti perdono ${e.danno} Vita.`);
  if (e.tipo === 'morte') return semplice('morte', `${nomi[e.giocatore]} è diventato uno Spettro!`);
  if (e.tipo === 'rimescola') return semplice('', 'Il mazzo del Destino è finito: si rimescola.');
  return null;
}

function pannelloRisultati({ stato, azioni, partita, nomi }) {
  const { ultimoRound } = partita;
  const finita = partita.fase === 'finita';
  const sonoHost = stato.stanza.idHost === stato.mioId;
  const pronto = partita.pronti.includes(stato.mioId);

  let striscione = null;
  if (finita) {
    const vincitori = partita.vincitori.map((id) => nomi[id]);
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

  return [
    striscione,
    el('h2', { class: 'sezione' }, `Round ${ultimoRound.round}: le scelte`),
    el(
      'ul',
      { class: 'lista-scelte' },
      partita.giocatori.map((g) =>
        el('li', {}, el('b', {}, `${g.nome}: `), descriviScelta(ultimoRound.scelte[g.id], nomi)),
      ),
    ),
    ultimoRound.eventi.length > 0 && el('h2', { class: 'sezione' }, 'Cosa è successo'),
    el('ul', { class: 'lista-eventi' }, ultimoRound.eventi.map((e) => evento(e, nomi))),
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
