// Test delle regole della stanza. Si lanciano con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../game/config.js';
import { riempiTesto } from '../game/testi.js';
import {
  aggiungiBot,
  aggiungiGiocatore,
  creaStanza,
  iniziaPartita,
  motivoAttesa,
  rimuoviBot,
  rimuoviGiocatore,
  scegliPersonaggio,
  vistaStanza,
} from '../game/stanza.js';

// Prepara una stanza con dentro le persone indicate.
function stanzaCon(...nomi) {
  const stanza = creaStanza('BCDF');
  const giocatori = nomi.map((nome) => aggiungiGiocatore(stanza, nome).giocatore);
  return { stanza, giocatori };
}

test('il primo che entra è l\'host', () => {
  const { stanza, giocatori } = stanzaCon('Anna', 'Luca');
  assert.equal(stanza.idHost, giocatori[0].id);
});

test('i nomi vengono puliti, e i doppioni ricevono un numero', () => {
  const { giocatori } = stanzaCon('  Anna  ', 'anna', 'UnNomeDavveroTroppoLungo');
  assert.equal(giocatori[0].nome, 'Anna');
  assert.equal(giocatori[1].nome, 'anna 2');
  assert.equal(giocatori[2].nome.length, CONFIG.stanza.lunghezzaMassimaNome);
});

test('un nome vuoto viene rifiutato', () => {
  const stanza = creaStanza('BCDF');
  assert.equal(aggiungiGiocatore(stanza, '   ').ok, false);
  assert.equal(aggiungiGiocatore(stanza, undefined).ok, false);
  assert.equal(stanza.giocatori.length, 0);
});

test('la stanza non accetta più del massimo di giocatori', () => {
  const { stanza } = stanzaCon('A', 'B', 'C', 'D', 'E', 'F');
  const risultato = aggiungiGiocatore(stanza, 'G');
  assert.equal(risultato.ok, false);
  assert.equal(stanza.giocatori.length, CONFIG.stanza.maxGiocatori);
});

test('un personaggio può essere scelto da un solo umano', () => {
  const { stanza, giocatori } = stanzaCon('Anna', 'Luca');
  assert.equal(scegliPersonaggio(stanza, giocatori[0].id, 'vesper').ok, true);

  const risultato = scegliPersonaggio(stanza, giocatori[1].id, 'vesper');
  assert.equal(risultato.ok, false);
  assert.equal(giocatori[1].idPersonaggio, null);
});

test('cambiando personaggio, quello vecchio torna libero', () => {
  const { stanza, giocatori } = stanzaCon('Anna', 'Luca');
  scegliPersonaggio(stanza, giocatori[0].id, 'vesper');
  scegliPersonaggio(stanza, giocatori[0].id, 'zolfo');

  assert.equal(scegliPersonaggio(stanza, giocatori[1].id, 'vesper').ok, true);
});

test('un personaggio che non esiste viene rifiutato', () => {
  const { stanza, giocatori } = stanzaCon('Anna');
  assert.equal(scegliPersonaggio(stanza, giocatori[0].id, 'drago').ok, false);
});

test('solo l\'host aggiunge i bot, e ogni bot ha un personaggio diverso', () => {
  const { stanza, giocatori } = stanzaCon('Anna', 'Luca');
  assert.equal(aggiungiBot(stanza, giocatori[1].id).ok, false);

  for (let i = 0; i < 4; i++) {
    assert.equal(aggiungiBot(stanza, giocatori[0].id).ok, true);
  }
  assert.equal(aggiungiBot(stanza, giocatori[0].id).ok, false); // stanza piena

  const bot = stanza.giocatori.filter((g) => g.bot);
  const nomi = new Set(bot.map((b) => b.nome));
  const personaggi = new Set(bot.map((b) => b.idPersonaggio));
  assert.equal(nomi.size, 4);
  assert.equal(personaggi.size, 4);
});

test('se un umano sceglie il personaggio di un bot, il bot si sposta', () => {
  const { stanza, giocatori } = stanzaCon('Anna');
  for (let i = 0; i < 5; i++) aggiungiBot(stanza, giocatori[0].id);
  const bot = stanza.giocatori[1];
  const voluto = bot.idPersonaggio;

  assert.equal(scegliPersonaggio(stanza, giocatori[0].id, voluto).ok, true);
  assert.equal(giocatori[0].idPersonaggio, voluto);

  // Nessun doppione: 6 giocatori, 6 personaggi diversi.
  const scelti = new Set(stanza.giocatori.map((g) => g.idPersonaggio));
  assert.equal(scelti.size, 6);
  assert.ok(!scelti.has(null));
});

test('se l\'host esce, il comando passa a un altro umano e non a un bot', () => {
  const { stanza, giocatori } = stanzaCon('Anna');
  aggiungiBot(stanza, giocatori[0].id);
  const luca = aggiungiGiocatore(stanza, 'Luca').giocatore;

  rimuoviGiocatore(stanza, giocatori[0].id);
  assert.equal(stanza.idHost, luca.id);

  rimuoviGiocatore(stanza, luca.id);
  assert.equal(stanza.idHost, null);
});

test('l\'host può togliere un bot ma non un umano', () => {
  const { stanza, giocatori } = stanzaCon('Anna', 'Luca');
  const bot = aggiungiBot(stanza, giocatori[0].id).giocatore;

  assert.equal(rimuoviBot(stanza, giocatori[0].id, giocatori[1].id).ok, false);
  assert.equal(rimuoviBot(stanza, giocatori[1].id, bot.id).ok, false);
  assert.equal(rimuoviBot(stanza, giocatori[0].id, bot.id).ok, true);
  assert.equal(stanza.giocatori.length, 2);
});

test('la partita inizia solo con abbastanza giocatori, tutti con un personaggio', () => {
  const { stanza, giocatori } = stanzaCon('Anna', 'Luca');
  const [anna, luca] = giocatori;

  assert.match(motivoAttesa(stanza), /almeno 3/);
  aggiungiBot(stanza, anna.id);
  assert.match(motivoAttesa(stanza), /Anna deve scegliere/);

  const liberi = CONFIG.personaggi
    .map((p) => p.id)
    .filter((id) => id !== stanza.giocatori[2].idPersonaggio);
  scegliPersonaggio(stanza, anna.id, liberi[0]);
  scegliPersonaggio(stanza, luca.id, liberi[1]);
  assert.equal(motivoAttesa(stanza), null);

  assert.equal(iniziaPartita(stanza, luca.id).ok, false); // non è l'host
  assert.equal(iniziaPartita(stanza, anna.id).ok, true);
  assert.equal(stanza.fase, 'partita');

  // A partita iniziata non si entra più.
  assert.equal(aggiungiGiocatore(stanza, 'Ritardatario').ok, false);
});

test('la vista della stanza è una copia: modificarla non tocca la stanza vera', () => {
  const { stanza } = stanzaCon('Anna');
  const vista = vistaStanza(stanza);
  vista.giocatori[0].nome = 'Imbroglione';
  assert.equal(stanza.giocatori[0].nome, 'Anna');
});

test('le descrizioni dei personaggi non hanno segnaposto dimenticati', () => {
  assert.equal(riempiTesto('Cura {cura} Vita', { cura: 3 }), 'Cura 3 Vita');

  for (const p of CONFIG.personaggi) {
    for (const parte of [p.abilita, p.debolezza]) {
      const testo = riempiTesto(parte.descrizione, p.numeri);
      assert.ok(!testo.includes('{'), `${p.nome}: manca un numero in "${testo}"`);
    }
  }
});
