// Test del cuore del gioco. Si lanciano con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../game/config.js';
import { scegliPerBot } from '../game/bot.js';
import {
  creaPartita,
  dannoCrollo,
  prossimoRound,
  registraScelta,
  risolviRound,
  risolviScontro,
  trovaInPartita,
  vistaPartita,
} from '../game/partita.js';

// ---- Aiuti per scrivere i test ----

const numero = (valore) => ({ tipo: 'numero', valore });
const speciale = (id) => ({ tipo: 'speciale', id, nome: id });

// Una partita con Brunna (g1), Vesper (g2) e Zolfo (g3).
//   Brunna: Vita 12, Forza 4, Agilità 1, Magia 1
//   Vesper: Vita 7,  Forza 3, Agilità 5, Magia 1
//   Zolfo:  Vita 8,  Forza 1, Agilità 2, Magia 5
function nuovaPartita(personaggi = ['brunna', 'vesper', 'zolfo']) {
  const giocatori = personaggi.map((idPersonaggio, i) => ({
    id: `g${i + 1}`,
    nome: idPersonaggio,
    bot: false,
    idPersonaggio,
  }));
  return creaPartita(giocatori);
}

// Decide quali carte usciranno, nell'ordine indicato.
// (Si pesca dalla fine dell'array, quindi le mettiamo al contrario.)
function prossimeCarte(partita, ...carte) {
  partita.mazzo = [...carte].reverse();
}

const vita = (partita, id) => trovaInPartita(partita, id).vita;
const attacca = (bersaglio, con = 'forza') => ({ tipo: 'attacca', bersaglio, con });
const difenditi = { tipo: 'difenditi' };

function eventiDiTipo(partita, tipo) {
  return partita.ultimoRound.eventi.filter((e) => e.tipo === tipo);
}

// ---- Lo scontro, una regola alla volta ----

test('se vince l\'attaccante il danno è differenza + 1', () => {
  const esito = risolviScontro({
    attacco: 4,
    difesa: 1,
    cartaAttacco: numero(2), // 4 + 2 = 6
    cartaDifesa: numero(1), // 1 + 1 = 2
  });
  assert.equal(esito.vincitore, 'attaccante');
  assert.equal(esito.danno, 4 + CONFIG.attacco.dannoBase);
});

test('in caso di pareggio non succede niente', () => {
  const esito = risolviScontro({ attacco: 3, difesa: 3, cartaAttacco: numero(1), cartaDifesa: numero(1) });
  assert.equal(esito.vincitore, 'nessuno');
  assert.equal(esito.danno, 0);
});

test('se vince il difensore non c\'è danno', () => {
  const esito = risolviScontro({ attacco: 1, difesa: 5, cartaAttacco: numero(3), cartaDifesa: numero(0) });
  assert.equal(esito.vincitore, 'difensore');
  assert.equal(esito.danno, 0);
});

test('Colpo del Fato: chi lo pesca vince anche se è più debole', () => {
  const inAttacco = risolviScontro({
    attacco: 1,
    difesa: 5,
    cartaAttacco: speciale('colpo-del-fato'),
    cartaDifesa: numero(3),
  });
  assert.equal(inAttacco.vincitore, 'attaccante');
  assert.equal(inAttacco.danno, 1); // vince, ma era più debole: danno minimo

  const inDifesa = risolviScontro({
    attacco: 5,
    difesa: 1,
    cartaAttacco: numero(3),
    cartaDifesa: speciale('colpo-del-fato'),
  });
  assert.equal(inDifesa.vincitore, 'difensore');
  assert.equal(inDifesa.danno, 0);
});

test('Sventura: chi la pesca perde anche se è più forte', () => {
  const inAttacco = risolviScontro({
    attacco: 5,
    difesa: 1,
    cartaAttacco: speciale('sventura'),
    cartaDifesa: numero(0),
  });
  assert.equal(inAttacco.vincitore, 'difensore');

  const inDifesa = risolviScontro({
    attacco: 4,
    difesa: 1,
    cartaAttacco: numero(1), // 5
    cartaDifesa: speciale('sventura'), // 1
  });
  assert.equal(inDifesa.vincitore, 'attaccante');
  assert.equal(inDifesa.danno, 5);
});

test('Ribaltone: i due risultati si scambiano', () => {
  // Senza Ribaltone vincerebbe l'attaccante 7 a 1. Con il Ribaltone è 1 a 7.
  const esito = risolviScontro({
    attacco: 4,
    difesa: 1,
    cartaAttacco: numero(3),
    cartaDifesa: speciale('ribaltone'),
  });
  assert.equal(esito.totaleAttacco, 1);
  assert.equal(esito.totaleDifesa, 7);
  assert.equal(esito.vincitore, 'difensore');
});

test('Specchio: funziona solo se lo pesca chi si difende', () => {
  const inDifesa = risolviScontro({
    attacco: 4,
    difesa: 1,
    cartaAttacco: numero(2),
    cartaDifesa: speciale('specchio'),
  });
  assert.equal(inDifesa.riflesso, true);
  assert.equal(inDifesa.danno, 6);

  const inAttacco = risolviScontro({
    attacco: 4,
    difesa: 1,
    cartaAttacco: speciale('specchio'),
    cartaDifesa: numero(0),
  });
  assert.equal(inAttacco.riflesso, false);
  assert.equal(inAttacco.vincitore, 'attaccante');
});

// ---- Le scelte ----

test('le scelte non valide vengono rifiutate', () => {
  const partita = nuovaPartita();

  assert.equal(registraScelta(partita, 'g1', attacca('g1')).ok, false); // se stesso
  assert.equal(registraScelta(partita, 'g1', attacca('g9')).ok, false); // non esiste
  assert.equal(registraScelta(partita, 'g1', attacca('g2', 'agilita')).ok, false);
  assert.equal(registraScelta(partita, 'g1', { tipo: 'perseguita', bersaglio: 'g2' }).ok, false);
  assert.equal(registraScelta(partita, 'g1', { tipo: 'vinci' }).ok, false);
  assert.equal(registraScelta(partita, 'g1', null).ok, false);
  assert.equal(registraScelta(partita, 'g9', difenditi).ok, false);
  assert.deepEqual(partita.scelte, {});
});

test('si può cambiare idea finché il round non è risolto', () => {
  const partita = nuovaPartita();
  registraScelta(partita, 'g1', attacca('g2'));
  registraScelta(partita, 'g1', difenditi);
  assert.deepEqual(partita.scelte.g1, difenditi);

  risolviRound(partita);
  assert.equal(registraScelta(partita, 'g1', difenditi).ok, false);
});

test('le scelte degli altri restano segrete fino alla risoluzione', () => {
  const partita = nuovaPartita();
  registraScelta(partita, 'g1', attacca('g2'));

  const vistaDiVesper = vistaPartita(partita, 'g2');
  assert.equal(vistaDiVesper.miaScelta, null);
  assert.equal(vistaDiVesper.giocatori[0].haScelto, true);
  // In tutta la vista non deve comparire da nessuna parte la parola "attacca".
  assert.ok(!JSON.stringify(vistaDiVesper).includes('attacca'));
  // E nemmeno le carte ancora nel mazzo.
  assert.equal(vistaDiVesper.mazzo, undefined);

  assert.deepEqual(vistaPartita(partita, 'g1').miaScelta, attacca('g2'));
});

// ---- Il round ----

test('un attacco riuscito toglie Vita e finisce nel racconto del round', () => {
  const partita = nuovaPartita();
  registraScelta(partita, 'g1', attacca('g3')); // Brunna (Forza 4) contro Zolfo (Agilità 2)
  prossimeCarte(partita, numero(2), numero(1)); // 6 contro 3

  risolviRound(partita);

  assert.equal(vita(partita, 'g3'), 8 - 4);
  assert.equal(trovaInPartita(partita, 'g1').danniInflitti, 4);
  assert.equal(partita.scarti.length, 2); // le carte uscite restano visibili
  assert.equal(partita.fase, 'risultati');
  assert.equal(eventiDiTipo(partita, 'scontro').length, 1);
});

test('si può attaccare con la Magia', () => {
  const partita = nuovaPartita();
  registraScelta(partita, 'g3', attacca('g1', 'magia')); // Zolfo (Magia 5) contro Brunna (Agilità 1)
  prossimeCarte(partita, numero(1), numero(0)); // 6 contro 1

  risolviRound(partita);
  assert.equal(vita(partita, 'g1'), 12 - 6);
});

test('Difenditi dà il bonus alla difesa', () => {
  const partita = nuovaPartita();
  registraScelta(partita, 'g1', attacca('g3')); // 4 + 1 = 5
  registraScelta(partita, 'g3', difenditi); // 2 + 1 + 2 = 5 -> pareggio
  prossimeCarte(partita, numero(1), numero(1));

  risolviRound(partita);
  assert.equal(vita(partita, 'g3'), 8);
});

test('gli attacchi sono contemporanei: due giocatori possono uccidersi a vicenda', () => {
  const partita = nuovaPartita();
  trovaInPartita(partita, 'g1').vita = 1;
  trovaInPartita(partita, 'g3').vita = 1;
  registraScelta(partita, 'g1', attacca('g3'));
  registraScelta(partita, 'g3', attacca('g1', 'magia'));
  prossimeCarte(partita, numero(3), numero(0), numero(3), numero(0));

  risolviRound(partita);

  assert.equal(trovaInPartita(partita, 'g1').vivo, false);
  assert.equal(trovaInPartita(partita, 'g3').vivo, false);
  assert.deepEqual(partita.vincitori, ['g2']); // resta solo Vesper
  assert.equal(partita.fase, 'finita');
});

test('con lo Specchio il danno torna a chi attacca', () => {
  const partita = nuovaPartita();
  registraScelta(partita, 'g1', attacca('g3'));
  prossimeCarte(partita, numero(2), speciale('specchio')); // 6 contro 2: danno 5

  risolviRound(partita);

  assert.equal(vita(partita, 'g3'), 8);
  assert.equal(vita(partita, 'g1'), 12 - 5);
  assert.equal(trovaInPartita(partita, 'g3').danniInflitti, 5);
});

test('quando il mazzo finisce, le carte uscite vengono rimescolate', () => {
  const partita = nuovaPartita();
  partita.scarti = [numero(1), numero(1), numero(1)];
  prossimeCarte(partita, numero(2)); // nel mazzo resta una sola carta
  registraScelta(partita, 'g1', attacca('g3'));

  risolviRound(partita);

  assert.equal(eventiDiTipo(partita, 'rimescola').length, 1);
  // 4 carte in tutto, 1 pescata dopo aver rimescolato: nessuna è andata persa.
  assert.equal(partita.mazzo.length + partita.scarti.length, 4);
  assert.equal(partita.scarti.length, 1);
});

// ---- Il crollo della Torre ----

test('il crollo segue i numeri della configurazione', () => {
  assert.equal(dannoCrollo(1), 0);
  assert.equal(dannoCrollo(2), 0);
  assert.equal(dannoCrollo(3), 1);
  assert.equal(dannoCrollo(5), 1);
  assert.equal(dannoCrollo(6), 2);
  assert.equal(dannoCrollo(20), 2);
});

test('dal round 3 tutti i vivi perdono Vita a fine round', () => {
  const partita = nuovaPartita();
  risolviRound(partita);
  assert.equal(vita(partita, 'g1'), 12); // round 1: niente crollo

  prossimoRound(partita);
  risolviRound(partita);
  prossimoRound(partita);
  assert.equal(partita.round, 3);
  risolviRound(partita);

  assert.equal(vita(partita, 'g1'), 11);
  assert.equal(vita(partita, 'g2'), 6);
  assert.equal(vita(partita, 'g3'), 7);
});

// ---- Morte, Spettri, vittoria ----

test('chi arriva a 0 Vita diventa uno Spettro e non può più attaccare', () => {
  const partita = nuovaPartita();
  trovaInPartita(partita, 'g3').vita = 1;
  registraScelta(partita, 'g1', attacca('g3'));
  prossimeCarte(partita, numero(3), numero(0));
  risolviRound(partita);

  assert.equal(trovaInPartita(partita, 'g3').vivo, false);
  assert.equal(vita(partita, 'g3'), 0); // mai sotto zero
  assert.equal(eventiDiTipo(partita, 'morte').length, 1);

  prossimoRound(partita);
  assert.equal(registraScelta(partita, 'g3', attacca('g1', 'magia')).ok, false);
  assert.equal(registraScelta(partita, 'g1', attacca('g3')).ok, false); // non si attacca uno Spettro
  assert.equal(registraScelta(partita, 'g3', { tipo: 'perseguita', bersaglio: 'g1' }).ok, true);
});

test('lo Spettro che perseguita toglie Vita', () => {
  const partita = nuovaPartita();
  trovaInPartita(partita, 'g3').vivo = false;
  registraScelta(partita, 'g3', { tipo: 'perseguita', bersaglio: 'g1' });

  risolviRound(partita);
  assert.equal(vita(partita, 'g1'), 12 - CONFIG.spettro.dannoPerseguita);
});

test('la benedizione vale per un solo tiro, già da questo round', () => {
  const partita = nuovaPartita();
  trovaInPartita(partita, 'g2').vivo = false;
  registraScelta(partita, 'g2', { tipo: 'benedici', bersaglio: 'g1' });
  registraScelta(partita, 'g1', attacca('g3'));
  prossimeCarte(partita, numero(0), numero(0)); // 4 + 0 + 1 contro 2: danno 4

  risolviRound(partita);
  assert.equal(vita(partita, 'g3'), 8 - 4);
  assert.equal(trovaInPartita(partita, 'g1').benedizioni, 0); // consumata

  prossimoRound(partita);
  registraScelta(partita, 'g1', attacca('g3'));
  prossimeCarte(partita, numero(0), numero(0)); // senza benedizione: danno 3
  risolviRound(partita);
  assert.equal(vita(partita, 'g3'), 4 - 3);
});

test('vince l\'ultimo rimasto in vita', () => {
  const partita = nuovaPartita();
  trovaInPartita(partita, 'g2').vivo = false;
  trovaInPartita(partita, 'g3').vita = 1;
  registraScelta(partita, 'g1', attacca('g3'));
  prossimeCarte(partita, numero(3), numero(0));

  risolviRound(partita);

  assert.deepEqual(partita.vincitori, ['g1']);
  assert.equal(partita.fase, 'finita');
  assert.equal(prossimoRound(partita).ok, false);
});

test('se gli ultimi muoiono insieme, vince chi ha inflitto più danni', () => {
  const partita = nuovaPartita();
  partita.round = 3; // c'è il crollo
  const [brunna, vesper, zolfo] = partita.giocatori;
  zolfo.vivo = false;
  zolfo.danniInflitti = 99; // è morto prima: non conta
  brunna.vita = 1;
  brunna.danniInflitti = 5;
  vesper.vita = 1;
  vesper.danniInflitti = 8;

  risolviRound(partita); // il crollo li uccide entrambi

  assert.deepEqual(partita.vincitori, ['g2']);
});

test('se anche i danni sono pari, vincono entrambi', () => {
  const partita = nuovaPartita();
  partita.round = 3;
  partita.giocatori[2].vivo = false;
  partita.giocatori[0].vita = 1;
  partita.giocatori[1].vita = 1;

  risolviRound(partita);
  assert.deepEqual(partita.vincitori, ['g1', 'g2']);
});

// ---- I bot ----

test('i bot fanno sempre scelte valide, da vivi e da Spettri', () => {
  const partita = nuovaPartita();
  for (let i = 0; i < 50; i++) {
    const scelta = scegliPerBot(partita, 'g1');
    assert.equal(registraScelta(partita, 'g1', scelta).ok, true);
  }
  trovaInPartita(partita, 'g1').vivo = false;
  for (let i = 0; i < 50; i++) {
    const scelta = scegliPerBot(partita, 'g1');
    assert.equal(registraScelta(partita, 'g1', scelta).ok, true);
  }
});

test('una partita intera di soli bot arriva sempre a un vincitore', () => {
  for (let volta = 0; volta < 30; volta++) {
    const partita = nuovaPartita(CONFIG.personaggi.map((p) => p.id));

    while (partita.fase !== 'finita') {
      assert.ok(partita.round < 100, 'la partita non finisce mai');
      for (const giocatore of partita.giocatori) {
        registraScelta(partita, giocatore.id, scegliPerBot(partita, giocatore.id));
      }
      risolviRound(partita);
      if (partita.fase === 'risultati') prossimoRound(partita);
    }

    assert.ok(partita.vincitori.length >= 1);
    assert.equal(partita.mazzo.length + partita.scarti.length, 22); // nessuna carta persa
  }
});
