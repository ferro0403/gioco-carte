// =============================================================
//  LA STANZA (lobby)
//  Logica pura: chi è nella stanza, chi è l'host, chi ha scelto
//  quale personaggio, i bot, quando si può iniziare.
//
//  Ogni funzione che può fallire restituisce un "risultato":
//    { ok: true, ... }            se è andata bene
//    { ok: false, errore: '...' } se no (il testo si mostra al giocatore)
// =============================================================

import { CONFIG } from './config.js';

const errore = (testo) => ({ ok: false, errore: testo });

// Crea una stanza vuota.
export function creaStanza(codice) {
  return {
    codice,
    fase: 'lobby', // 'lobby' oppure 'partita'
    idHost: null, // l'id di chi comanda la stanza
    giocatori: [],
    contatore: 0, // serve a dare a ognuno un id diverso: g1, g2, g3...
  };
}

export function trovaGiocatore(stanza, idGiocatore) {
  return stanza.giocatori.find((g) => g.id === idGiocatore);
}

// Toglie spazi inutili e taglia i nomi troppo lunghi.
export function pulisciNome(nome) {
  if (typeof nome !== 'string') return '';
  return nome
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, CONFIG.stanza.lunghezzaMassimaNome)
    .trim();
}

// Se il nome c'è già, aggiunge un numero: "Luca" -> "Luca 2".
function nomeLibero(stanza, nome) {
  const usati = stanza.giocatori.map((g) => g.nome.toLowerCase());
  let candidato = nome;
  for (let n = 2; usati.includes(candidato.toLowerCase()); n++) {
    candidato = `${nome} ${n}`;
  }
  return candidato;
}

function personaggiLiberi(stanza) {
  const presi = stanza.giocatori.map((g) => g.idPersonaggio);
  return CONFIG.personaggi.filter((p) => !presi.includes(p.id));
}

function aCaso(lista, casuale) {
  return lista[Math.floor(casuale() * lista.length)];
}

function controllaIngresso(stanza) {
  if (stanza.fase !== 'lobby') return errore('La partita è già iniziata.');
  if (stanza.giocatori.length >= CONFIG.stanza.maxGiocatori) {
    return errore('La stanza è piena.');
  }
  return null; // nessun problema
}

// Aggiunge una persona. Il primo umano che entra diventa l'host.
export function aggiungiGiocatore(stanza, nome) {
  const problema = controllaIngresso(stanza);
  if (problema) return problema;

  const pulito = pulisciNome(nome);
  if (!pulito) return errore('Scrivi il tuo nome.');

  const giocatore = {
    id: `g${++stanza.contatore}`,
    nome: nomeLibero(stanza, pulito),
    bot: false,
    idPersonaggio: null,
    collegato: true,
  };
  stanza.giocatori.push(giocatore);
  if (!stanza.idHost) stanza.idHost = giocatore.id;

  return { ok: true, giocatore };
}

// Solo l'host può aggiungere un bot. Il bot prende un personaggio libero a caso.
export function aggiungiBot(stanza, idRichiedente, casuale = Math.random) {
  if (idRichiedente !== stanza.idHost) return errore('Solo l\'host può aggiungere bot.');
  const problema = controllaIngresso(stanza);
  if (problema) return problema;

  const nomiUsati = stanza.giocatori.map((g) => g.nome);
  const nomiLiberi = CONFIG.bot.nomi
    .map((nome) => `Bot ${nome}`)
    .filter((nome) => !nomiUsati.includes(nome));

  const giocatore = {
    id: `g${++stanza.contatore}`,
    nome: nomeLibero(stanza, aCaso(nomiLiberi, casuale) ?? 'Bot'),
    bot: true,
    idPersonaggio: aCaso(personaggiLiberi(stanza), casuale).id,
    collegato: true,
  };
  stanza.giocatori.push(giocatore);

  return { ok: true, giocatore };
}

// Toglie un giocatore. Se era l'host, il comando passa a un altro umano.
export function rimuoviGiocatore(stanza, idGiocatore) {
  if (!trovaGiocatore(stanza, idGiocatore)) return errore('Giocatore non trovato.');

  stanza.giocatori = stanza.giocatori.filter((g) => g.id !== idGiocatore);

  if (stanza.idHost === idGiocatore) {
    const umani = stanza.giocatori.filter((g) => !g.bot);
    // Meglio un umano collegato; se non c'è, uno qualsiasi; se non c'è nessuno, null.
    const nuovoHost = umani.find((g) => g.collegato) ?? umani[0];
    stanza.idHost = nuovoHost ? nuovoHost.id : null;
  }
  return { ok: true };
}

export function rimuoviBot(stanza, idRichiedente, idBot) {
  if (idRichiedente !== stanza.idHost) return errore('Solo l\'host può togliere i bot.');
  if (stanza.fase !== 'lobby') return errore('La partita è già iniziata.');
  const bot = trovaGiocatore(stanza, idBot);
  if (!bot || !bot.bot) return errore('Bot non trovato.');
  return rimuoviGiocatore(stanza, idBot);
}

// Ogni personaggio può essere di un solo giocatore.
// Se però lo ha preso un bot, il bot si sposta su un altro: gli umani hanno la precedenza.
export function scegliPersonaggio(stanza, idGiocatore, idPersonaggio, casuale = Math.random) {
  if (stanza.fase !== 'lobby') return errore('La partita è già iniziata.');
  const giocatore = trovaGiocatore(stanza, idGiocatore);
  if (!giocatore) return errore('Giocatore non trovato.');
  if (!CONFIG.personaggi.some((p) => p.id === idPersonaggio)) {
    return errore('Personaggio sconosciuto.');
  }

  const occupante = stanza.giocatori.find(
    (g) => g.idPersonaggio === idPersonaggio && g.id !== idGiocatore,
  );
  if (occupante && !occupante.bot) {
    return errore(`Già scelto da ${occupante.nome}.`);
  }

  giocatore.idPersonaggio = idPersonaggio;
  if (occupante) {
    occupante.idPersonaggio = null;
    occupante.idPersonaggio = aCaso(personaggiLiberi(stanza), casuale).id;
  }
  return { ok: true };
}

export function impostaCollegato(stanza, idGiocatore, collegato) {
  const giocatore = trovaGiocatore(stanza, idGiocatore);
  if (giocatore) giocatore.collegato = collegato;
}

// Restituisce il motivo per cui NON si può ancora iniziare,
// oppure null se è tutto pronto.
export function motivoAttesa(stanza) {
  const { minGiocatori } = CONFIG.stanza;
  if (stanza.giocatori.length < minGiocatori) {
    return `Servono almeno ${minGiocatori} giocatori.`;
  }
  const indeciso = stanza.giocatori.find((g) => !g.idPersonaggio);
  if (indeciso) return `${indeciso.nome} deve scegliere un personaggio.`;
  return null;
}

export function iniziaPartita(stanza, idRichiedente) {
  if (idRichiedente !== stanza.idHost) return errore('Solo l\'host può iniziare.');
  if (stanza.fase !== 'lobby') return errore('La partita è già iniziata.');
  const motivo = motivoAttesa(stanza);
  if (motivo) return errore(motivo);

  stanza.fase = 'partita';
  return { ok: true };
}

export function tornaInLobby(stanza, idRichiedente) {
  if (idRichiedente !== stanza.idHost) return errore('Solo l\'host può farlo.');
  stanza.fase = 'lobby';
  return { ok: true };
}

// Quello che i telefoni possono vedere della stanza.
// È una COPIA: così nessuno modifica per sbaglio la stanza vera.
export function vistaStanza(stanza) {
  return {
    codice: stanza.codice,
    fase: stanza.fase,
    idHost: stanza.idHost,
    giocatori: stanza.giocatori.map((g) => ({ ...g })),
    motivoAttesa: motivoAttesa(stanza),
  };
}
