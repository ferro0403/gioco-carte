// Test di alleanze, Taglia, Notte, abilità e Oggetti. Si lanciano con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../game/config.js';
import { scegliPerBot } from '../game/bot.js';
import {
  creaPartita,
  eNotte,
  prossimoRound,
  registraScelta,
  risolviRound,
  trovaInPartita,
  vistaPartita,
} from '../game/partita.js';

// ---- Aiuti ----

const numero = (valore) => ({ tipo: 'numero', valore });
const speciale = (id) => ({ tipo: 'speciale', id, nome: id });

// I giocatori si chiamano come il loro personaggio: così nei test
// scriviamo g('zolfo') invece di ricordarci che è "g3".
function nuovaPartita(...personaggi) {
  const partita = creaPartita(
    personaggi.map((idPersonaggio, i) => ({
      id: `g${i + 1}`,
      nome: idPersonaggio,
      bot: false,
      idPersonaggio,
    })),
  );
  const g = (nome) => partita.giocatori.find((x) => x.nome === nome);
  const id = (nome) => g(nome).id;
  const sceglie = (nome, scelta) => registraScelta(partita, id(nome), scelta);
  const attacca = (chi, bersaglio, con = 'forza', extra = {}) =>
    sceglie(chi, { tipo: 'attacca', bersaglio: id(bersaglio), con, ...extra });
  // Decide le prossime carte, nell'ordine in cui verranno pescate.
  const carte = (...lista) => {
    partita.mazzo = [...lista].reverse();
  };
  // Risolve il round. Il "caso" è fisso a 0: il primo Oggetto pescato è sempre la Pozione.
  const risolvi = () => risolviRound(partita, () => 0);
  const eventi = (tipo) => partita.ultimoRound.eventi.filter((ev) => ev.tipo === tipo);
  const avanti = () => prossimoRound(partita);
  return { partita, g, id, sceglie, attacca, carte, risolvi, eventi, avanti };
}

const difenditi = { tipo: 'difenditi' };

// =============================================================
//  ALLEANZE E TRADIMENTI
// =============================================================

function conAlleati(t, a, b) {
  t.sceglie(a, { tipo: 'patto', bersaglio: t.id(b) });
  t.sceglie(b, { tipo: 'patto', bersaglio: t.id(a) });
  t.risolvi();
  t.avanti();
}

test('il patto nasce solo se entrambi lo propongono nello stesso round', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.sceglie('brunna', { tipo: 'patto', bersaglio: t.id('zolfo') });
  t.risolvi();
  assert.equal(t.g('brunna').alleato, null);
  t.avanti();

  conAlleati(t, 'brunna', 'zolfo');
  assert.equal(t.g('brunna').alleato, t.id('zolfo'));
  assert.equal(t.g('zolfo').alleato, t.id('brunna'));
});

test('un solo alleato alla volta', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  conAlleati(t, 'brunna', 'zolfo');
  assert.equal(t.sceglie('brunna', { tipo: 'patto', bersaglio: t.id('vesper') }).ok, false);
  assert.equal(t.sceglie('vesper', { tipo: 'patto', bersaglio: t.id('zolfo') }).ok, false);
});

test('chi ha un alleato ha +1 alla difesa', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  conAlleati(t, 'brunna', 'zolfo');
  t.attacca('vesper', 'zolfo'); // 3 + 1 = 4 contro 2 + 1 + 1 (alleato) = 4
  t.carte(numero(1), numero(1));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 8);
});

test('gli alleati vedono gli Oggetti l\'uno dell\'altro, gli altri no', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  conAlleati(t, 'brunna', 'zolfo');
  t.g('zolfo').oggetti = ['bomba'];

  const zolfoVistoDa = (nome) =>
    vistaPartita(t.partita, t.id(nome)).giocatori.find((x) => x.nome === 'zolfo');
  assert.deepEqual(zolfoVistoDa('brunna').oggetti, ['bomba']);
  assert.equal(zolfoVistoDa('vesper').oggetti, null);
  assert.equal(zolfoVistoDa('vesper').numeroOggetti, 1); // quanti sì, quali no
});

test('la Pugnalata dà +3, rompe il patto e crea un Traditore per 3 round', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  conAlleati(t, 'brunna', 'zolfo');
  const roundPugnalata = t.partita.round;

  t.attacca('brunna', 'zolfo'); // 4 + 3 + 0 = 7 contro 2 + 0 (niente bonus alleato) = 2
  t.carte(numero(0), numero(0));
  t.risolvi();

  assert.equal(t.g('zolfo').vita, 8 - 6);
  assert.equal(t.g('brunna').alleato, null);
  assert.equal(t.g('zolfo').alleato, null);
  assert.equal(t.eventi('tradimento').length, 1);

  // Per 3 round nessuno può allearsi con Brunna, in nessuna direzione.
  for (let i = 0; i < CONFIG.alleanza.roundTraditore; i++) {
    t.avanti();
    assert.equal(t.sceglie('brunna', { tipo: 'patto', bersaglio: t.id('vesper') }).ok, false);
    assert.equal(t.sceglie('vesper', { tipo: 'patto', bersaglio: t.id('brunna') }).ok, false);
    t.g('brunna').vita = 12; // teniamola in vita nonostante il crollo
    t.risolvi();
  }
  t.avanti();
  assert.equal(t.partita.round, roundPugnalata + 4);
  assert.equal(t.sceglie('brunna', { tipo: 'patto', bersaglio: t.id('vesper') }).ok, true);
});

test('il patto finisce quando l\'alleato muore', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo', 'mirra');
  conAlleati(t, 'brunna', 'zolfo');
  t.g('zolfo').vita = 1;
  t.attacca('vesper', 'zolfo');
  t.carte(numero(3), numero(0));
  t.risolvi();
  assert.equal(t.g('zolfo').vivo, false);
  assert.equal(t.g('brunna').alleato, null);
});

// =============================================================
//  LA TAGLIA
// =============================================================

test('a fine round la Taglia va a chi ha più Vita; in caso di pareggio a nessuno', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.risolvi();
  assert.equal(t.partita.taglia.id, t.id('brunna')); // 12 Vita
  t.avanti();

  t.g('brunna').vita = 8; // ora pari con Zolfo
  t.risolvi();
  assert.equal(t.partita.taglia.id, null);
});

test('chi colpisce il giocatore con la Taglia fa +1 danno', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.risolvi();
  t.avanti();
  t.attacca('zolfo', 'brunna', 'magia'); // 5 + 1 contro 1 + 0: danno 6, +1 Taglia
  t.carte(numero(1), numero(0));
  t.risolvi();
  assert.equal(t.g('brunna').vita, 12 - 7);
});

test('chi elimina il ricercato incassa Vita e Oggetti, e la ricompensa cresce col tempo', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo', 'mirra');
  t.risolvi(); // round 1: Taglia su Brunna
  t.avanti();
  t.risolvi(); // round 2: la Taglia resta su Brunna -> ricompensa +1
  t.avanti();
  assert.equal(t.partita.taglia.round, 2);

  t.g('brunna').vita = 7;
  t.attacca('zolfo', 'brunna', 'magia');
  t.carte(numero(1), numero(0)); // 6 contro 1: danno 6, +1 per la Taglia = 7
  t.risolvi();

  assert.equal(t.g('brunna').vivo, false);
  const [incasso] = t.eventi('taglia-riscossa');
  assert.equal(incasso.giocatore, t.id('zolfo'));
  assert.equal(incasso.vita, CONFIG.taglia.ricompensaVita + CONFIG.taglia.vitaExtraPerRound);
  assert.equal(incasso.oggetti, 2);
  assert.equal(t.g('zolfo').oggetti.length, 2);
  // 8 + 5 di ricompensa - 1 di crollo (round 3)
  assert.equal(t.g('zolfo').vita, 8 + 5 - 1);
});

// =============================================================
//  LA NOTTE
// =============================================================

test('giorno nei round 1-5, notte nei round 6-7, poi si ricomincia', () => {
  const notti = [];
  for (let round = 1; round <= 14; round++) if (eNotte(round)) notti.push(round);
  assert.deepEqual(notti, [6, 7, 13, 14]);
});

test('di notte chi viene colpito non sa da chi, e gli altri non vedono niente', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo', 'mirra');
  for (const x of t.partita.giocatori) x.vita = 50;
  t.partita.round = 6;
  t.attacca('brunna', 'zolfo');
  t.sceglie('mirra', difenditi);
  t.carte(numero(3), numero(0));
  t.risolvi();

  const vista = (nome) => vistaPartita(t.partita, t.id(nome)).ultimoRound;
  const scontro = (nome) => vista(nome).eventi.find((ev) => ev.tipo === 'scontro');

  // Chi attacca vede tutto.
  assert.equal(scontro('brunna').attaccante, t.id('brunna'));
  // Chi subisce vede il danno, ma non chi è stato né con cosa.
  assert.equal(scontro('zolfo').attaccante, null);
  assert.equal(scontro('zolfo').danno, 6);
  assert.equal(scontro('zolfo').valoreAttacco, undefined);
  assert.ok(!JSON.stringify(vista('zolfo')).includes(t.id('brunna')));
  // Chi non c'entra non vede lo scontro.
  assert.equal(scontro('mirra'), undefined);
  // Ognuno vede solo la propria scelta.
  assert.deepEqual(Object.keys(vista('mirra').scelte), [t.id('mirra')]);

  // Di giorno, invece, tutti vedono tutto.
  t.partita.ultimoRound.notte = false;
  assert.equal(scontro('mirra').attaccante, t.id('brunna'));
});

// =============================================================
//  LE ABILITÀ DEI PERSONAGGI
// =============================================================

test('Brunna, Scudo: gli attacchi contro il protetto colpiscono lei', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.sceglie('brunna', { tipo: 'abilita', bersaglio: t.id('zolfo') });
  t.attacca('vesper', 'zolfo'); // 3 + 2 contro l'Agilità di Brunna: 1 + 0
  t.carte(numero(2), numero(0));
  t.risolvi();

  assert.equal(t.g('zolfo').vita, 8);
  assert.equal(t.g('brunna').vita, 12 - 5);
});

test('le abilità attive richiedono un round di attesa', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  const scudo = { tipo: 'abilita', bersaglio: t.id('zolfo') };
  assert.equal(t.sceglie('brunna', scudo).ok, true);
  t.risolvi();
  t.avanti();
  assert.equal(t.sceglie('brunna', scudo).ok, false); // round dopo: in ricarica
  t.risolvi();
  t.avanti();
  assert.equal(t.sceglie('brunna', scudo).ok, true);
});

test('le abilità passive non si possono "usare"', () => {
  const t = nuovaPartita('brunna', 'vesper', 'corvina');
  assert.equal(t.sceglie('vesper', { tipo: 'abilita' }).ok, false);
  assert.equal(t.sceglie('corvina', { tipo: 'abilita' }).ok, false);
});

test('chi esplora ha -1 alla difesa; Brunna, che è Lenta, -2', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.sceglie('zolfo', { tipo: 'esplora' });
  t.sceglie('brunna', { tipo: 'esplora' });
  t.attacca('vesper', 'zolfo'); // 3 + 0 contro 2 - 1 + 0: danno 3
  t.carte(numero(0), numero(0));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 8 - 3);
  t.avanti();

  t.sceglie('brunna', { tipo: 'esplora' });
  t.attacca('vesper', 'brunna'); // 3 + 0 contro 1 - 2 + 0: danno 5, +1 Taglia
  t.carte(numero(0), numero(0));
  t.risolvi();
  assert.equal(t.g('brunna').vita, 12 - 6);
});

test('Vesper, Colpo nell\'ombra: danno doppio solo a chi è già ferito', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.attacca('vesper', 'zolfo'); // 3 + 1 contro 2 + 1: danno 2
  t.carte(numero(1), numero(1));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 8 - 2);
  t.avanti();

  t.attacca('vesper', 'zolfo'); // stesso scontro, ma ora Zolfo è ferito: 2 x 2
  t.carte(numero(1), numero(1));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 6 - 4);
});

test('Ottavio, Mano truccata: vede la prima carta, e con l\'abilità la scarta', () => {
  const t = nuovaPartita('ottavio', 'vesper', 'zolfo');
  t.carte(speciale('sventura'), numero(3));

  assert.equal(vistaPartita(t.partita, t.id('ottavio')).primaCarta.id, 'sventura');
  assert.equal(vistaPartita(t.partita, t.id('vesper')).primaCarta, undefined);

  t.sceglie('ottavio', { tipo: 'abilita' });
  t.risolvi();
  assert.equal(t.eventi('scarta')[0].carta.id, 'sventura');
  assert.deepEqual(vistaPartita(t.partita, t.id('ottavio')).primaCarta, numero(3));
});

test('Ottavio, Perseguitato: se pesca la Sventura perde anche 1 Vita', () => {
  const t = nuovaPartita('ottavio', 'vesper', 'zolfo');
  t.attacca('ottavio', 'zolfo');
  t.carte(speciale('sventura'), numero(0));
  t.risolvi();
  assert.equal(t.g('ottavio').vita, 8 - 1);
  assert.equal(t.g('zolfo').vita, 8);
});

test('Mirra, Infuso: cura 3 Vita, mai oltre il massimo', () => {
  const t = nuovaPartita('mirra', 'vesper', 'zolfo');
  t.g('mirra').vita = 4;
  t.sceglie('mirra', { tipo: 'abilita', bersaglio: t.id('mirra') });
  t.risolvi();
  assert.equal(t.g('mirra').vita, 7);
  t.avanti();
  t.risolvi(); // l'abilità è in ricarica: lasciamo passare un round
  t.avanti();

  t.g('mirra').vita = 8;
  t.sceglie('mirra', { tipo: 'abilita', bersaglio: t.id('mirra') });
  t.risolvi();
  assert.equal(t.g('mirra').vita, 9 - 1); // 9 è il massimo; -1 per il crollo del round 3
});

test('Mirra, Cuore tenero: curare un altro le costa 1 Vita', () => {
  const t = nuovaPartita('mirra', 'vesper', 'zolfo');
  t.g('zolfo').vita = 2;
  t.sceglie('mirra', { tipo: 'abilita', bersaglio: t.id('zolfo') });
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 5);
  assert.equal(t.g('mirra').vita, 9 - 1);
});

test('Corvina, Gelida: nessuno può curarla, nemmeno con una Pozione', () => {
  const t = nuovaPartita('mirra', 'corvina', 'zolfo');
  t.g('corvina').oggetti = ['pozione'];
  assert.equal(t.sceglie('mirra', { tipo: 'abilita', bersaglio: t.id('corvina') }).ok, false);
  assert.equal(t.sceglie('corvina', { ...difenditi, oggetto: { id: 'pozione' } }).ok, false);
});

test('Corvina, Patto delle anime: +1 Magia a ogni morte, fino a 7', () => {
  const t = nuovaPartita('corvina', 'vesper', 'zolfo', 'mirra');
  t.g('zolfo').vita = 1;
  t.attacca('vesper', 'zolfo');
  t.carte(numero(3), numero(0));
  t.risolvi();
  assert.equal(t.g('corvina').magia, 5);
  t.avanti();

  t.g('corvina').magia = 7;
  t.g('mirra').vita = 1;
  t.attacca('vesper', 'mirra');
  t.carte(numero(3), numero(0));
  t.risolvi();
  assert.equal(t.g('corvina').magia, 7);
});

test('Zolfo, Fiamma instabile: una carta sola, contro tutti gli altri', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.sceglie('zolfo', { tipo: 'abilita' });
  // Zolfo pesca 1 (totale 6), poi Brunna 0 (totale 1) e Vesper 1 (totale 6).
  t.carte(numero(1), numero(0), numero(1));
  t.risolvi();

  assert.equal(t.g('brunna').vita, 12 - 6);
  assert.equal(t.g('vesper').vita, 7); // pareggio
  assert.equal(t.partita.scarti.length, 3);
});

test('Zolfo, Esplosivo: se attaccando pesca uno 0 fallisce e subisce 2 danni', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.sceglie('zolfo', { tipo: 'abilita' });
  t.carte(numero(0));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 8 - 2);
  assert.equal(t.g('brunna').vita, 12);
  t.avanti();

  t.attacca('zolfo', 'brunna', 'magia'); // vale anche per l'attacco normale
  t.carte(numero(0));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 6 - 2);
  assert.equal(t.g('brunna').vita, 12);
});

// =============================================================
//  GLI OGGETTI
// =============================================================

test('esplorando si trova un Oggetto, ma se ne possono tenere al massimo 2', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  for (let i = 0; i < 3; i++) {
    t.sceglie('vesper', { tipo: 'esplora' });
    t.risolvi();
    t.avanti();
  }
  assert.deepEqual(t.g('vesper').oggetti, ['pozione', 'pozione']);
});

test('non si può usare un Oggetto che non si ha', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  assert.equal(t.sceglie('brunna', { ...difenditi, oggetto: { id: 'bomba' } }).ok, false);
  assert.equal(t.sceglie('brunna', { ...difenditi, oggetto: { id: 'inventato' } }).ok, false);
  assert.equal(t.sceglie('brunna', { ...difenditi, oggetto: 'bomba' }).ok, false);
});

test('Pozione: +3 Vita, e l\'Oggetto si consuma', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('zolfo').vita = 3;
  t.g('zolfo').oggetti = ['pozione'];
  t.sceglie('zolfo', { ...difenditi, oggetto: { id: 'pozione' } });
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 6);
  assert.deepEqual(t.g('zolfo').oggetti, []);
});

test('Pugnale: +2 all\'attacco', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('vesper').oggetti = ['pugnale'];
  t.attacca('vesper', 'zolfo', 'forza', { oggetto: { id: 'pugnale' } }); // 3 + 2 contro 2
  t.carte(numero(0), numero(0));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 8 - 4);
});

test('Mantello: +2 alla difesa per il round', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('zolfo').oggetti = ['mantello'];
  t.sceglie('zolfo', { tipo: 'esplora', oggetto: { id: 'mantello' } }); // 2 - 1 + 2 = 3
  t.attacca('vesper', 'zolfo'); // 3
  t.carte(numero(0), numero(0));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 8);
});

test('Pergamena del Fato: mostra le prossime 3 carte solo a chi la usa', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('zolfo').oggetti = ['pergamena'];
  t.sceglie('zolfo', { ...difenditi, oggetto: { id: 'pergamena' } });
  t.carte(numero(3), speciale('specchio'), numero(1), numero(2));
  t.risolvi();

  const privato = (nome) => vistaPartita(t.partita, t.id(nome)).ultimoRound.privato;
  assert.deepEqual(privato('zolfo').pergamena, [numero(3), speciale('specchio'), numero(1)]);
  assert.equal(privato('vesper'), null);
});

test('Bomba: 1 danno a tutti gli altri', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('zolfo').oggetti = ['bomba'];
  t.sceglie('zolfo', { ...difenditi, oggetto: { id: 'bomba' } });
  t.risolvi();
  assert.deepEqual(
    t.partita.giocatori.map((x) => x.vita),
    [11, 6, 8],
  );
  assert.equal(t.g('zolfo').danniInflitti, 2);
});

test('Amuleto: annulla una Sventura da solo, senza doverlo usare', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('brunna').oggetti = ['amuleto'];
  assert.equal(t.sceglie('brunna', { ...difenditi, oggetto: { id: 'amuleto' } }).ok, false);

  t.attacca('brunna', 'zolfo'); // la Sventura diventa una carta da 0: 4 contro 2
  t.carte(speciale('sventura'), numero(0));
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 8 - 3);
  assert.deepEqual(t.g('brunna').oggetti, []);
});

test('Fumogeno: annulla solo il primo attacco del round', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('zolfo').oggetti = ['fumogeno'];
  t.sceglie('zolfo', { ...difenditi, oggetto: { id: 'fumogeno' } });
  t.attacca('brunna', 'zolfo'); // annullato
  t.attacca('vesper', 'zolfo'); // 3 + 3 contro 2 + 2 + 0: danno 3
  t.carte(numero(3), numero(0));
  t.risolvi();
  assert.equal(t.eventi('fumogeno').length, 1);
  assert.equal(t.g('zolfo').vita, 8 - 3);
});

test('Trappola: il primo che ti attacca subisce 2 danni', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('zolfo').oggetti = ['trappola'];
  t.sceglie('zolfo', { ...difenditi, oggetto: { id: 'trappola' } });
  t.attacca('brunna', 'zolfo');
  t.attacca('vesper', 'zolfo');
  t.carte(numero(0), numero(3), numero(0), numero(3)); // entrambi gli attacchi falliscono
  t.risolvi();
  assert.equal(t.g('brunna').vita, 12 - 2);
  assert.equal(t.g('vesper').vita, 7);
});

test('Rampino: ruba un Oggetto, ma non uno appena usato', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('vesper').oggetti = ['rampino'];
  t.g('zolfo').oggetti = ['mantello', 'bomba'];
  t.sceglie('zolfo', { ...difenditi, oggetto: { id: 'mantello' } });
  t.sceglie('vesper', { ...difenditi, oggetto: { id: 'rampino', bersaglio: t.id('zolfo') } });
  t.risolvi();
  assert.deepEqual(t.g('vesper').oggetti, ['bomba']);
  assert.deepEqual(t.g('zolfo').oggetti, []);
});

test('Fiala del Fato: peschi 2 carte e tieni la migliore', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo');
  t.g('vesper').oggetti = ['fiala'];
  t.attacca('vesper', 'zolfo', 'forza', { oggetto: { id: 'fiala' } });
  t.carte(speciale('sventura'), numero(3), numero(0)); // tiene il 3: 6 contro 2
  t.risolvi();
  assert.equal(t.g('zolfo').vita, 8 - 5);
  assert.equal(t.partita.scarti.length, 3); // anche la carta scartata è "uscita"
});

test('Campanella degli Spiriti: lo Spettro scelto deve benedirti', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo', 'mirra');
  t.g('mirra').vivo = false;
  t.g('vesper').oggetti = ['campanella'];
  // Lo Spettro vorrebbe perseguitare proprio Vesper...
  t.sceglie('mirra', { tipo: 'perseguita', bersaglio: t.id('vesper') });
  // ...e la Campanella si può suonare solo a uno Spettro.
  const campanella = (bersaglio) => ({ id: 'campanella', bersaglio: t.id(bersaglio) });
  assert.equal(t.sceglie('vesper', { ...difenditi, oggetto: campanella('brunna') }).ok, false);
  assert.equal(t.sceglie('vesper', { ...difenditi, oggetto: campanella('mirra') }).ok, true);
  t.risolvi();

  assert.equal(t.g('vesper').vita, 7);
  assert.equal(t.g('vesper').benedizioni, 1);
  assert.equal(t.eventi('perseguita').length, 0);
});

test('gli Spettri non hanno Oggetti', () => {
  const t = nuovaPartita('brunna', 'vesper', 'zolfo', 'mirra');
  t.g('zolfo').oggetti = ['bomba'];
  t.g('zolfo').vita = 1;
  t.attacca('vesper', 'zolfo');
  t.carte(numero(3), numero(0));
  t.risolvi();
  assert.deepEqual(t.g('zolfo').oggetti, []);
});

// =============================================================
//  PARTITE INTERE
// =============================================================

test('partite intere di bot con tutte le regole: finiscono sempre e senza errori', () => {
  for (let volta = 0; volta < 200; volta++) {
    const partita = creaPartita(
      CONFIG.personaggi.map((p, i) => ({ id: `g${i}`, nome: p.nome, bot: true, idPersonaggio: p.id })),
    );

    while (partita.fase !== 'finita') {
      assert.ok(partita.round < 100, 'la partita non finisce mai');
      for (const giocatore of partita.giocatori) {
        const scelta = scegliPerBot(partita, giocatore.id);
        const risultato = registraScelta(partita, giocatore.id, scelta);
        assert.equal(risultato.ok, true, `${giocatore.nome}: ${risultato.errore} ${JSON.stringify(scelta)}`);
      }
      risolviRound(partita);

      // Controlli che devono valere SEMPRE, in qualunque partita.
      assert.equal(partita.mazzo.length + partita.scarti.length, 22);
      for (const g of partita.giocatori) {
        assert.ok(g.vita >= 0);
        assert.ok(g.oggetti.length <= CONFIG.oggetti.massimoATesta);
        if (g.alleato) assert.equal(trovaInPartita(partita, g.alleato).alleato, g.id);
        // La vista si deve poter costruire per tutti, di giorno e di notte.
        vistaPartita(partita, g.id);
      }
      if (partita.fase === 'risultati') prossimoRound(partita);
    }
    assert.ok(partita.vincitori.length >= 1);
  }
});
