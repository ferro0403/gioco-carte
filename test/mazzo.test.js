// Test del Mazzo del Destino. Si lanciano con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../game/config.js';
import { creaMazzoDestino, mescola } from '../game/mazzo.js';

test('il mazzo ha 22 carte, di cui 4 speciali', () => {
  const mazzo = creaMazzoDestino();
  const speciali = mazzo.filter((carta) => carta.tipo === 'speciale');

  assert.equal(mazzo.length, 22);
  assert.equal(speciali.length, 4);
});

test('le carte numero vanno da 0 a 3', () => {
  const numeri = creaMazzoDestino().filter((carta) => carta.tipo === 'numero');

  for (const carta of numeri) {
    assert.ok(carta.valore >= 0 && carta.valore <= 3);
  }
});

test('mescolare non perde carte e non modifica il mazzo originale', () => {
  const mazzo = creaMazzoDestino();
  const copiaOriginale = structuredClone(mazzo);

  const mescolato = mescola(mazzo);

  assert.deepEqual(mazzo, copiaOriginale);
  assert.equal(mescolato.length, mazzo.length);
  // Stesse carte, in un altro ordine: le confrontiamo dopo averle ordinate.
  const ordina = (carte) => carte.map((c) => JSON.stringify(c)).sort();
  assert.deepEqual(ordina(mescolato), ordina(mazzo));
});

test('con lo stesso generatore casuale il risultato è sempre uguale', () => {
  const finto = () => 0.5; // un "caso" finto, sempre uguale
  const carte = [1, 2, 3, 4, 5];

  assert.deepEqual(mescola(carte, finto), mescola(carte, finto));
  assert.notDeepEqual(mescola(carte, finto), carte);
});

test('ci sono 6 personaggi, con id diversi e caratteristiche da 1 a 5', () => {
  const { personaggi } = CONFIG;
  const idUnici = new Set(personaggi.map((p) => p.id));

  assert.equal(personaggi.length, 6);
  assert.equal(idUnici.size, 6);

  for (const p of personaggi) {
    assert.ok(p.vita > 0, `${p.nome} deve avere Vita`);
    for (const caratteristica of ['forza', 'agilita', 'magia']) {
      assert.ok(
        p[caratteristica] >= 1 && p[caratteristica] <= 5,
        `${p.nome}: ${caratteristica} fuori scala`,
      );
    }
  }
});
