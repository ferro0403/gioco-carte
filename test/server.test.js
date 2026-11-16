// Test del server "vero": avviamo il server e ci colleghiamo con dei
// telefoni finti (socket.io-client), come farebbero i giocatori.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { io as collegati } from 'socket.io-client';

import { creaApp } from '../server/app.js';

let server;
let indirizzo;
const telefoni = [];

before(async () => {
  server = creaApp();
  // Porta 0 = "scegline tu una libera".
  await new Promise((fatto) => server.httpServer.listen(0, fatto));
  indirizzo = `http://localhost:${server.httpServer.address().port}`;
});

after(() => {
  for (const telefono of telefoni) telefono.close();
  server.io.close();
});

function nuovoTelefono() {
  const telefono = collegati(indirizzo, { forceNew: true });
  telefoni.push(telefono);
  return telefono;
}

// Manda una richiesta e aspetta la risposta del server.
const chiedi = (telefono, evento, dati = {}) => telefono.emitWithAck(evento, dati);

// Aspetta il prossimo aggiornamento della stanza che soddisfa la condizione.
function attendiStanza(telefono, condizione) {
  return new Promise((fatto) => {
    const ascolta = (stanza) => {
      if (!condizione(stanza)) return;
      telefono.off('stanza', ascolta);
      fatto(stanza);
    };
    telefono.on('stanza', ascolta);
  });
}

test('una partita completa nella lobby: crea, entra, bot, personaggi, inizio', async () => {
  const anna = nuovoTelefono();
  const luca = nuovoTelefono();

  const creata = await chiedi(anna, 'crea-stanza', { nome: 'Anna' });
  assert.equal(creata.ok, true);
  assert.match(creata.stanza.codice, /^[A-Z]{4}$/);
  const { codice } = creata.stanza;

  // Luca entra scrivendo il codice in minuscolo: deve funzionare lo stesso.
  const annaVedeLuca = attendiStanza(anna, (s) => s.giocatori.length === 2);
  const entrato = await chiedi(luca, 'entra-stanza', { codice: codice.toLowerCase(), nome: 'Luca' });
  assert.equal(entrato.ok, true);
  await annaVedeLuca;

  // Luca non è l'host: non può aggiungere bot né iniziare.
  assert.equal((await chiedi(luca, 'aggiungi-bot')).ok, false);
  assert.equal((await chiedi(luca, 'inizia-partita')).ok, false);

  assert.equal((await chiedi(anna, 'aggiungi-bot')).ok, true);

  // Non si può iniziare finché tutti non hanno un personaggio.
  assert.equal((await chiedi(anna, 'inizia-partita')).ok, false);

  assert.equal((await chiedi(anna, 'scegli-personaggio', { idPersonaggio: 'brunna' })).ok, true);
  // Brunna è di Anna: Luca non può prenderla.
  assert.equal((await chiedi(luca, 'scegli-personaggio', { idPersonaggio: 'brunna' })).ok, false);
  assert.equal((await chiedi(luca, 'scegli-personaggio', { idPersonaggio: 'zolfo' })).ok, true);

  const lucaVedeInizio = attendiStanza(luca, (s) => s.fase === 'partita');
  assert.equal((await chiedi(anna, 'inizia-partita')).ok, true);
  const stanza = await lucaVedeInizio;

  const personaggi = new Set(stanza.giocatori.map((g) => g.idPersonaggio));
  assert.equal(stanza.giocatori.length, 3);
  assert.equal(personaggi.size, 3);
});

test('codice sbagliato e richieste senza senso vengono rifiutati', async () => {
  const telefono = nuovoTelefono();

  assert.equal((await chiedi(telefono, 'entra-stanza', { codice: 'ZZZZ', nome: 'Eva' })).ok, false);
  assert.equal((await chiedi(telefono, 'crea-stanza', { nome: '' })).ok, false);
  assert.equal((await chiedi(telefono, 'crea-stanza', 'non sono un oggetto')).ok, false);
  assert.equal((await chiedi(telefono, 'scegli-personaggio', { idPersonaggio: 'vesper' })).ok, false);
  assert.equal((await chiedi(telefono, 'rientra', { chiave: 'inventata' })).ok, false);
});

test('chi perde il collegamento può rientrare con la sua chiave', async () => {
  const anna = nuovoTelefono();
  const luca = nuovoTelefono();

  const creata = await chiedi(anna, 'crea-stanza', { nome: 'Anna' });
  const entrato = await chiedi(luca, 'entra-stanza', { codice: creata.stanza.codice, nome: 'Luca' });

  // Luca perde il collegamento: Anna lo vede "scollegato", ma è ancora in stanza.
  const annaVedeScollegato = attendiStanza(anna, (s) =>
    s.giocatori.some((g) => g.nome === 'Luca' && !g.collegato),
  );
  luca.close();
  await annaVedeScollegato;

  // Luca torna con un telefono "nuovo" ma con la stessa chiave.
  const lucaTornato = nuovoTelefono();
  const rientro = await chiedi(lucaTornato, 'rientra', { chiave: entrato.chiave });
  assert.equal(rientro.ok, true);
  assert.equal(rientro.idGiocatore, entrato.idGiocatore);
  assert.equal(rientro.stanza.giocatori.find((g) => g.nome === 'Luca').collegato, true);
});

test('quando l\'ultimo umano esce, la stanza sparisce', async () => {
  const anna = nuovoTelefono();
  const creata = await chiedi(anna, 'crea-stanza', { nome: 'Anna' });
  await chiedi(anna, 'aggiungi-bot');
  assert.equal(server.stanze.has(creata.stanza.codice), true);

  await chiedi(anna, 'esci');
  assert.equal(server.stanze.has(creata.stanza.codice), false);
});
