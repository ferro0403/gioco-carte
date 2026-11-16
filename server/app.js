// =============================================================
//  SERVER: stanze e messaggi in tempo reale
//
//  Il server è l'unico a conoscere lo stato vero delle stanze.
//  I telefoni mandano RICHIESTE ("voglio entrare", "scelgo Vesper"):
//  il server controlla con le regole di game/ se sono valide e poi
//  manda a tutti la stanza aggiornata. Un telefono non può mai
//  cambiare la stanza da solo: per questo non si può barare.
// =============================================================

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import { Server } from 'socket.io';

import { CONFIG } from '../game/config.js';
import {
  aggiungiBot,
  aggiungiGiocatore,
  creaStanza,
  impostaCollegato,
  iniziaPartita,
  rimuoviBot,
  rimuoviGiocatore,
  scegliPersonaggio,
  tornaInLobby,
  trovaGiocatore,
  vistaStanza,
} from '../game/stanza.js';

const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Crea il server senza avviarlo: lo avvia server/index.js (e i test).
export function creaApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  // I file dell'interfaccia.
  app.use(express.static(path.join(radice, 'public')));
  // Anche la cartella game/ è leggibile dal browser: così l'interfaccia usa
  // lo stesso config.js del server. Le regole non sono un segreto;
  // i segreti (le scelte dei giocatori) restano nella memoria del server.
  app.use('/game', express.static(path.join(radice, 'game')));

  // Indirizzo usato dall'hosting per controllare che il server sia vivo.
  app.get('/salute', (richiesta, risposta) => {
    risposta.json({ ok: true, stanze: stanze.size });
  });

  // ---- La memoria del server ----

  // codice -> "voce": la stanza più i dati tecnici che servono solo al server.
  const stanze = new Map();
  // chiave segreta -> { codice, idGiocatore }. La chiave è il "biglietto"
  // con cui un telefono dimostra chi è quando si ricollega.
  const chiavi = new Map();

  function generaCodice() {
    const { lettereCodice, lunghezzaCodice } = CONFIG.stanza;
    let codice;
    do {
      codice = '';
      for (let i = 0; i < lunghezzaCodice; i++) {
        codice += lettereCodice[Math.floor(Math.random() * lettereCodice.length)];
      }
    } while (stanze.has(codice)); // se esiste già, ne proviamo un altro
    return codice;
  }

  // Manda a tutti i telefoni della stanza la situazione aggiornata.
  function aggiorna(voce) {
    io.to(voce.stanza.codice).emit('stanza', vistaStanza(voce.stanza));
  }

  function cancellaStanza(voce) {
    for (const timer of voce.timerUscita.values()) clearTimeout(timer);
    clearTimeout(voce.timerAbbandono);
    for (const [chiave, dati] of chiavi) {
      if (dati.codice === voce.stanza.codice) chiavi.delete(chiave);
    }
    io.to(voce.stanza.codice).emit('stanza-chiusa');
    io.socketsLeave(voce.stanza.codice);
    stanze.delete(voce.stanza.codice);
  }

  // Se non c'è più nessun umano collegato parte un conto alla rovescia,
  // alla fine del quale la stanza viene cancellata.
  function controllaAbbandono(voce) {
    const umani = voce.stanza.giocatori.filter((g) => !g.bot);
    if (umani.length === 0) return cancellaStanza(voce);

    clearTimeout(voce.timerAbbandono);
    if (umani.some((g) => g.collegato)) return;

    voce.timerAbbandono = setTimeout(
      () => cancellaStanza(voce),
      CONFIG.stanza.minutiStanzaAbbandonata * 60 * 1000,
    );
    voce.timerAbbandono.unref(); // non tiene acceso il server solo per questo timer
  }

  function dimenticaChiave(voce, idGiocatore) {
    for (const [chiave, dati] of chiavi) {
      if (dati.codice === voce.stanza.codice && dati.idGiocatore === idGiocatore) {
        chiavi.delete(chiave);
      }
    }
  }

  // Toglie davvero un umano dalla stanza.
  function espelli(voce, idGiocatore) {
    clearTimeout(voce.timerUscita.get(idGiocatore));
    voce.timerUscita.delete(idGiocatore);
    voce.socketDi.delete(idGiocatore);
    dimenticaChiave(voce, idGiocatore);
    rimuoviGiocatore(voce.stanza, idGiocatore);
    aggiorna(voce);
    controllaAbbandono(voce);
  }

  // Collega un socket (un telefono) a un giocatore della stanza.
  function collega(socket, voce, idGiocatore) {
    // Se lo stesso giocatore era aperto in un'altra scheda, quella viene staccata.
    const vecchioId = voce.socketDi.get(idGiocatore);
    const vecchio = vecchioId && io.sockets.sockets.get(vecchioId);
    if (vecchio && vecchio.id !== socket.id) {
      vecchio.data = {};
      vecchio.leave(voce.stanza.codice);
      vecchio.emit('stanza-chiusa');
    }

    clearTimeout(voce.timerUscita.get(idGiocatore));
    voce.timerUscita.delete(idGiocatore);
    voce.socketDi.set(idGiocatore, socket.id);
    socket.data = { codice: voce.stanza.codice, idGiocatore };
    socket.join(voce.stanza.codice);
    impostaCollegato(voce.stanza, idGiocatore, true);
    aggiorna(voce);
    controllaAbbandono(voce);
  }

  // Stacca il socket dal suo giocatore, senza toglierlo dalla stanza.
  function scollega(socket) {
    const voce = stanze.get(socket.data.codice);
    const { idGiocatore } = socket.data;
    socket.data = {};
    if (!voce || voce.socketDi.get(idGiocatore) !== socket.id) return null;

    socket.leave(voce.stanza.codice);
    voce.socketDi.delete(idGiocatore);
    impostaCollegato(voce.stanza, idGiocatore, false);
    return { voce, idGiocatore };
  }

  function entra(socket, voce, nome) {
    const risultato = aggiungiGiocatore(voce.stanza, nome);
    if (!risultato.ok) return risultato;

    const chiave = randomUUID();
    chiavi.set(chiave, { codice: voce.stanza.codice, idGiocatore: risultato.giocatore.id });
    collega(socket, voce, risultato.giocatore.id);
    return {
      ok: true,
      chiave,
      idGiocatore: risultato.giocatore.id,
      stanza: vistaStanza(voce.stanza),
    };
  }

  // ---- I messaggi che arrivano dai telefoni ----

  io.on('connection', (socket) => {
    socket.data = {};

    // Piccolo aiuto per non ripetere gli stessi controlli in ogni messaggio.
    // "rispondi" è una funzione che Socket.IO ci dà per rispondere
    // direttamente al telefono che ha fatto la richiesta.
    function ascolta(evento, gestore) {
      socket.on(evento, (dati, rispondi) => {
        if (typeof dati === 'function') [dati, rispondi] = [{}, dati];
        if (!dati || typeof dati !== 'object') dati = {};

        let risultato;
        try {
          risultato = gestore(dati);
        } catch (problema) {
          // Un errore imprevisto non deve far cadere il server per tutti.
          console.error(`Errore in "${evento}":`, problema);
          risultato = { ok: false, errore: 'Errore del server.' };
        }
        if (typeof rispondi === 'function') rispondi(risultato);
      });
    }

    // Come "ascolta", ma per i messaggi che hanno senso solo dentro una stanza.
    // Dopo ogni azione riuscita, tutti ricevono la stanza aggiornata.
    function ascoltaInStanza(evento, gestore) {
      ascolta(evento, (dati) => {
        const voce = stanze.get(socket.data.codice);
        if (!voce) return { ok: false, errore: 'Non sei in una stanza.' };

        const risultato = gestore(voce.stanza, socket.data.idGiocatore, dati);
        if (risultato.ok) aggiorna(voce);
        return risultato.ok ? { ok: true } : risultato;
      });
    }

    ascolta('crea-stanza', ({ nome }) => {
      if (socket.data.codice) return { ok: false, errore: 'Sei già in una stanza.' };

      const voce = {
        stanza: creaStanza(generaCodice()),
        socketDi: new Map(), // idGiocatore -> id del socket collegato
        timerUscita: new Map(), // idGiocatore -> conto alla rovescia per toglierlo
        timerAbbandono: null,
      };
      const risultato = entra(socket, voce, nome);
      // La stanza viene salvata solo se chi la crea è entrato davvero.
      if (risultato.ok) stanze.set(voce.stanza.codice, voce);
      return risultato;
    });

    ascolta('entra-stanza', ({ codice, nome }) => {
      if (socket.data.codice) return { ok: false, errore: 'Sei già in una stanza.' };

      const voce = stanze.get(String(codice ?? '').trim().toUpperCase());
      if (!voce) return { ok: false, errore: 'Stanza non trovata. Controlla il codice.' };
      return entra(socket, voce, nome);
    });

    // Un telefono che aveva perso il collegamento torna con la sua chiave segreta.
    ascolta('rientra', ({ chiave }) => {
      const dati = chiavi.get(chiave);
      const voce = dati && stanze.get(dati.codice);
      if (!voce || !trovaGiocatore(voce.stanza, dati.idGiocatore)) {
        return { ok: false, errore: 'La stanza non esiste più.' };
      }
      if (socket.data.codice) scollega(socket);
      collega(socket, voce, dati.idGiocatore);
      return { ok: true, idGiocatore: dati.idGiocatore, stanza: vistaStanza(voce.stanza) };
    });

    ascoltaInStanza('scegli-personaggio', (stanza, idGiocatore, { idPersonaggio }) =>
      scegliPersonaggio(stanza, idGiocatore, idPersonaggio),
    );
    ascoltaInStanza('aggiungi-bot', (stanza, idGiocatore) => aggiungiBot(stanza, idGiocatore));
    ascoltaInStanza('rimuovi-bot', (stanza, idGiocatore, { idBot }) =>
      rimuoviBot(stanza, idGiocatore, idBot),
    );
    ascoltaInStanza('inizia-partita', (stanza, idGiocatore) =>
      iniziaPartita(stanza, idGiocatore),
    );
    ascoltaInStanza('torna-in-lobby', (stanza, idGiocatore) =>
      tornaInLobby(stanza, idGiocatore),
    );

    // Uscita volontaria: si lascia subito il posto.
    ascolta('esci', () => {
      const staccato = scollega(socket);
      if (staccato) espelli(staccato.voce, staccato.idGiocatore);
      return { ok: true };
    });

    // Collegamento perso (schermo spento, galleria, Wi-Fi che salta...).
    // Nella lobby il posto resta riservato per un po', poi si libera.
    // A partita iniziata il giocatore resta in gioco e può rientrare.
    socket.on('disconnect', () => {
      const staccato = scollega(socket);
      if (!staccato) return;
      const { voce, idGiocatore } = staccato;

      if (voce.stanza.fase === 'lobby') {
        const timer = setTimeout(
          () => espelli(voce, idGiocatore),
          CONFIG.stanza.secondiPrimaDiRimuovere * 1000,
        );
        timer.unref();
        voce.timerUscita.set(idGiocatore, timer);
      }
      aggiorna(voce);
      controllaAbbandono(voce);
    });
  });

  return { app, httpServer, io, stanze };
}
