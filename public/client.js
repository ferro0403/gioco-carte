// =============================================================
//  CLIENT: il codice che gira nel browser del telefono.
//
//  Funziona così:
//  1. "stato" contiene tutto quello che il telefono sa in questo momento.
//  2. Quando lo stato cambia chiamiamo disegna(), che ricostruisce la pagina.
//  3. I bottoni non cambiano la stanza: mandano una RICHIESTA al server.
//     Il server decide, e manda a tutti la stanza aggiornata.
// =============================================================

import { CONFIG } from '/game/config.js';
import { riempiTesto } from '/game/testi.js';
import { el } from './dom.js';
import { schermataPartita } from './partita.js';

// "io" arriva dallo script /socket.io/socket.io.js caricato in index.html.
const socket = io();
const app = document.querySelector('#app');
const avviso = document.querySelector('#avviso');

// Se il link contiene ?stanza=BCDF, il codice è già compilato.
const codiceDalLink = new URLSearchParams(location.search).get('stanza') ?? '';

const stato = {
  collegato: true, // diventa false solo se il collegamento cade
  stanza: null, // la stanza come ce la manda il server (null = non siamo in una stanza)
  mioId: null,
  nome: leggi('nome') ?? '',
  codice: codiceDalLink.toUpperCase(),
  errore: '',

  // ---- Durante la partita ----
  partita: null, // la vista della partita, personale per questo telefono
  bozza: null, // la scelta che stai ancora componendo
  scadenza: null, // quando scade il timer, secondo l'orologio di questo telefono
  durataTimer: 1, // quanto durava il timer quando è partito, in millisecondi
  conteggio: null, // 3, 2, 1 prima della rivelazione (null = niente conteggio)
  roundRivelato: 0, // l'ultimo round di cui abbiamo già mostrato i risultati
};

// ---- Memoria del telefono (resta anche se chiudi la pagina) ----
// Qui salviamo il nome e la "chiave" segreta che serve per rientrare
// nella stanza se cade il collegamento.

function leggi(nome) {
  try {
    return localStorage.getItem(`ultimo-eroe-${nome}`);
  } catch {
    return null; // in navigazione privata la memoria può non funzionare
  }
}

function salva(nome, valore) {
  try {
    if (valore == null) localStorage.removeItem(`ultimo-eroe-${nome}`);
    else localStorage.setItem(`ultimo-eroe-${nome}`, valore);
  } catch {
    // pazienza: il gioco funziona lo stesso
  }
}

// ---- Parlare con il server ----

// Manda una richiesta e aspetta la risposta: { ok: true, ... } oppure { ok: false, errore }.
async function chiedi(evento, dati = {}) {
  const risposta = await socket.emitWithAck(evento, dati);
  if (!risposta.ok) mostraAvviso(risposta.errore);
  return risposta;
}

function entrato(risposta) {
  stato.stanza = risposta.stanza;
  stato.mioId = risposta.idGiocatore;
  stato.errore = '';
  if (risposta.chiave) salva('chiave', risposta.chiave);
  // Mettiamo il codice nell'indirizzo, così il link si può condividere.
  history.replaceState(null, '', `?stanza=${risposta.stanza.codice}`);
  disegna();
}

function uscito({ dimenticaChiave = true } = {}) {
  stato.stanza = null;
  stato.partita = null;
  stato.mioId = null;
  if (dimenticaChiave) salva('chiave', null);
  history.replaceState(null, '', location.pathname);
  disegna();
}

socket.on('connect', async () => {
  stato.collegato = true;
  // Avevamo già un posto in una stanza? Proviamo a riprenderlo.
  const chiave = leggi('chiave');
  if (chiave) {
    const risposta = await socket.emitWithAck('rientra', { chiave });
    if (risposta.ok) return entrato(risposta);
    salva('chiave', null);
    stato.stanza = null;
  }
  disegna();
});

socket.on('disconnect', () => {
  stato.collegato = false;
  disegna();
});

// Il server manda questo messaggio ogni volta che nella stanza cambia qualcosa.
socket.on('stanza', (stanza) => {
  stato.stanza = stanza;
  if (stanza.fase === 'lobby') stato.partita = null;
  disegna();
});

// Durante la partita il server manda questo messaggio a ogni cambiamento.
socket.on('partita', (partita) => {
  const prima = stato.partita;
  stato.partita = partita;

  // Il server dice quanti millisecondi mancano: li sommiamo al NOSTRO orologio.
  stato.scadenza = partita.msRimanenti == null ? null : Date.now() + partita.msRimanenti;
  const faseNuova = !prima || prima.fase !== partita.fase || prima.round !== partita.round;
  if (faseNuova) stato.durataTimer = partita.msRimanenti || 1;

  if (partita.fase === 'scelta') {
    stato.roundRivelato = 0;
    if (faseNuova) stato.bozza = null;
  } else if (partita.ultimoRound.round !== stato.roundRivelato) {
    // Risultati nuovi: prima il "3… 2… 1…", poi la rivelazione.
    stato.roundRivelato = partita.ultimoRound.round;
    avviaConteggio();
  }

  disegna();
  if (faseNuova) window.scrollTo(0, 0);
});

let timerConteggio;
function avviaConteggio() {
  clearInterval(timerConteggio);
  stato.conteggio = 3;
  timerConteggio = setInterval(() => {
    stato.conteggio--;
    if (stato.conteggio === 0) {
      stato.conteggio = null;
      clearInterval(timerConteggio);
    }
    disegna();
    window.scrollTo(0, 0);
  }, 800);
}

// Quattro volte al secondo aggiorniamo solo il timer, senza ridisegnare tutto.
setInterval(() => {
  const testo = document.querySelector('#timer-testo');
  if (!testo || !stato.scadenza) return;
  const mancano = Math.max(0, stato.scadenza - Date.now());
  testo.textContent = `${Math.ceil(mancano / 1000)} s`;
  const barra = document.querySelector('#timer-barra');
  if (barra) barra.style.width = `${Math.min(100, (mancano / stato.durataTimer) * 100)}%`;
}, 250);

socket.on('stanza-chiusa', () => {
  mostraAvviso('Sei uscito dalla stanza.');
  // La chiave resta: potrebbe servire a un'altra scheda dello stesso telefono.
  uscito({ dimenticaChiave: false });
});

// ---- Azioni dei bottoni ----

async function creaStanza() {
  salva('nome', stato.nome);
  const risposta = await chiedi('crea-stanza', { nome: stato.nome });
  if (risposta.ok) entrato(risposta);
}

async function entraInStanza() {
  salva('nome', stato.nome);
  const risposta = await chiedi('entra-stanza', { codice: stato.codice, nome: stato.nome });
  if (risposta.ok) entrato(risposta);
}

async function esci() {
  await chiedi('esci');
  uscito();
}

async function invita() {
  const link = `${location.origin}/?stanza=${stato.stanza.codice}`;
  const testo = `Entra nella mia stanza de L'Ultimo Eroe! Codice: ${stato.stanza.codice}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "L'Ultimo Eroe", text: testo, url: link });
    } else {
      await navigator.clipboard.writeText(link);
      mostraAvviso('Link copiato!');
    }
  } catch {
    // l'utente ha chiuso la finestra di condivisione: nessun problema
  }
}

let timerAvviso;
function mostraAvviso(testo) {
  avviso.textContent = testo;
  avviso.classList.add('visibile');
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => avviso.classList.remove('visibile'), 2500);
}

// ---- Disegnare la pagina ----

function disegna() {
  let schermata;
  if (!stato.stanza) schermata = schermataIniziale();
  else if (stato.stanza.fase === 'lobby') schermata = schermataLobby();
  else schermata = schermataPartita(stato, { chiedi, disegna });

  if (!stato.collegato) {
    schermata.push(el('p', { class: 'striscia-errore' }, 'Collegamento perso, riprovo…'));
  }
  // replaceChildren toglie tutto quello che c'era e mette la schermata nuova.
  // filter(Boolean) scarta i "false" lasciati da scritture come: sonoHost && bottone
  app.replaceChildren(...schermata.filter(Boolean));
}

function schermataIniziale() {
  const nomeOk = stato.nome.trim().length > 0;
  const codiceOk = stato.codice.length === CONFIG.stanza.lunghezzaCodice;

  // Quando scrivi aggiorniamo lo stato e accendiamo/spegniamo i bottoni,
  // senza ridisegnare tutto (altrimenti la tastiera si chiuderebbe).
  const aggiornaBottoni = () => {
    const nome = stato.nome.trim().length > 0;
    bottoneCrea.disabled = !nome;
    bottoneEntra.disabled = !nome || stato.codice.length !== CONFIG.stanza.lunghezzaCodice;
  };

  const bottoneCrea = el(
    'button',
    { class: 'bottone bottone-oro', disabled: !nomeOk, onclick: creaStanza },
    'Crea una stanza',
  );
  const bottoneEntra = el(
    'button',
    { class: 'bottone', disabled: !nomeOk || !codiceOk, onclick: entraInStanza },
    'Entra',
  );

  return [
    el('h1', { class: 'titolo' }, "L'Ultimo Eroe"),
    el('p', { class: 'sottotitolo' }, 'Solo uno uscirà vivo dalla torre.'),

    el(
      'div',
      { class: 'cartello' },
      el('label', { class: 'etichetta', for: 'nome' }, 'Come ti chiami?'),
      el('input', {
        id: 'nome',
        class: 'campo',
        value: stato.nome,
        maxlength: CONFIG.stanza.lunghezzaMassimaNome,
        autocomplete: 'off',
        placeholder: 'Il tuo nome',
        oninput: (evento) => {
          stato.nome = evento.target.value;
          aggiornaBottoni();
        },
      }),
    ),

    el(
      'div',
      { class: 'cartello' },
      el('label', { class: 'etichetta', for: 'codice' }, 'Hai un codice?'),
      el(
        'div',
        { class: 'riga' },
        el('input', {
          id: 'codice',
          class: 'campo campo-codice',
          value: stato.codice,
          maxlength: CONFIG.stanza.lunghezzaCodice,
          autocomplete: 'off',
          autocapitalize: 'characters',
          placeholder: 'ABCD',
          oninput: (evento) => {
            stato.codice = evento.target.value.toUpperCase().replace(/[^A-Z]/g, '');
            evento.target.value = stato.codice;
            aggiornaBottoni();
          },
        }),
        bottoneEntra,
      ),
    ),

    el('p', { class: 'oppure' }, 'oppure'),
    bottoneCrea,
  ];
}

function trovaPersonaggio(id) {
  return CONFIG.personaggi.find((p) => p.id === id);
}

function schermataLobby() {
  const { stanza, mioId } = stato;
  const sonoHost = stanza.idHost === mioId;
  const ioStesso = stanza.giocatori.find((g) => g.id === mioId);
  const piena = stanza.giocatori.length >= CONFIG.stanza.maxGiocatori;

  return [
    el(
      'div',
      { class: 'testata' },
      el('button', { class: 'bottone-piccolo', onclick: esci }, '← Esci'),
      el('button', { class: 'bottone-piccolo', onclick: invita }, 'Invita ↗'),
    ),

    el(
      'div',
      { class: 'cartello cartello-codice' },
      el('p', { class: 'etichetta' }, 'Codice della stanza'),
      el('p', { class: 'codice' }, stanza.codice),
    ),

    el(
      'h2',
      { class: 'sezione' },
      `Giocatori (${stanza.giocatori.length}/${CONFIG.stanza.maxGiocatori})`,
    ),
    el(
      'ul',
      { class: 'lista-giocatori' },
      stanza.giocatori.map((g) => rigaGiocatore(g, stanza, sonoHost)),
    ),
    sonoHost &&
      el(
        'button',
        { class: 'bottone', disabled: piena, onclick: () => chiedi('aggiungi-bot') },
        '+ Aggiungi un bot',
      ),

    el('h2', { class: 'sezione' }, 'Scegli il tuo personaggio'),
    el(
      'div',
      { class: 'lista-personaggi' },
      CONFIG.personaggi.map((p) => cartaPersonaggio(p, stanza, ioStesso)),
    ),

    // La barra in fondo resta sempre visibile mentre scorri.
    el(
      'div',
      { class: 'barra-fondo' },
      el('p', { class: 'attesa' }, stanza.motivoAttesa ?? 'Tutto pronto!'),
      sonoHost
        ? el(
            'button',
            {
              class: 'bottone bottone-oro',
              disabled: Boolean(stanza.motivoAttesa),
              onclick: () => chiedi('inizia-partita'),
            },
            'Inizia la partita',
          )
        : el('p', { class: 'nota' }, "Sarà l'host a far partire la partita."),
    ),
  ];
}

function rigaGiocatore(giocatore, stanza, sonoHost) {
  const personaggio = trovaPersonaggio(giocatore.idPersonaggio);

  return el(
    'li',
    { class: `giocatore ${giocatore.collegato ? '' : 'scollegato'}` },
    el(
      'span',
      { class: 'pallino', style: { background: personaggio?.colore ?? 'transparent' } },
      personaggio ? personaggio.nome[0] : '?',
    ),
    el(
      'span',
      { class: 'giocatore-testo' },
      el(
        'span',
        { class: 'giocatore-nome' },
        giocatore.nome,
        giocatore.id === stato.mioId && ' (tu)',
      ),
      el(
        'span',
        { class: 'giocatore-dettagli' },
        [
          personaggio ? personaggio.nome : 'sta scegliendo…',
          giocatore.id === stanza.idHost && 'host',
          !giocatore.collegato && 'scollegato',
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    ),
    sonoHost &&
      giocatore.bot &&
      el(
        'button',
        {
          class: 'bottone-piccolo',
          'aria-label': `Togli ${giocatore.nome}`,
          onclick: () => chiedi('rimuovi-bot', { idBot: giocatore.id }),
        },
        '✕',
      ),
  );
}

// Ogni caratteristica ha la sua icona e il suo colore (vedi style.css).
const CARATTERISTICHE = [
  { chiave: 'vita', nome: 'Vita', icona: '♥' },
  { chiave: 'forza', nome: 'Forza', icona: '✊' },
  { chiave: 'agilita', nome: 'Agilità', icona: '➶' },
  { chiave: 'magia', nome: 'Magia', icona: '✦' },
];

function cartaPersonaggio(personaggio, stanza, ioStesso) {
  const proprietario = stanza.giocatori.find((g) => g.idPersonaggio === personaggio.id);
  const mio = proprietario?.id === ioStesso?.id;
  // Bloccato solo se lo ha un altro umano: ai bot lo si può "rubare".
  const bloccato = proprietario && !mio && !proprietario.bot;

  return el(
    'button',
    {
      class: `personaggio ${mio ? 'mio' : ''}`,
      style: { '--colore': personaggio.colore },
      disabled: bloccato,
      'aria-pressed': String(mio),
      onclick: () => chiedi('scegli-personaggio', { idPersonaggio: personaggio.id }),
    },
    el(
      'span',
      { class: 'personaggio-testa' },
      el('span', { class: 'pallino', style: { background: personaggio.colore } }, personaggio.nome[0]),
      el(
        'span',
        { class: 'giocatore-testo' },
        el('span', { class: 'personaggio-nome' }, personaggio.nome),
        el('span', { class: 'giocatore-dettagli' }, personaggio.titolo),
      ),
      proprietario &&
        el('span', { class: 'etichetta-preso' }, mio ? 'Tu' : proprietario.nome),
    ),
    el(
      'span',
      { class: 'caratteristiche' },
      CARATTERISTICHE.map((c) =>
        el(
          'span',
          { class: `caratteristica ${c.chiave}`, title: c.nome },
          `${c.icona} ${personaggio[c.chiave]}`,
          el('span', { class: 'solo-lettori' }, ` ${c.nome}`),
        ),
      ),
    ),
    el(
      'span',
      { class: 'tratto' },
      el('b', {}, `${personaggio.abilita.nome}: `),
      riempiTesto(personaggio.abilita.descrizione, personaggio.numeri),
    ),
    el(
      'span',
      { class: 'tratto debolezza' },
      el('b', {}, `${personaggio.debolezza.nome}: `),
      riempiTesto(personaggio.debolezza.descrizione, personaggio.numeri),
    ),
  );
}

// Prima schermata. Se abbiamo una chiave aspettiamo la risposta a "rientra",
// così non si vede lampeggiare la schermata iniziale.
if (!leggi('chiave')) disegna();
