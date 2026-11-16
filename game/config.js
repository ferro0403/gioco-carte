// =============================================================
//  CONFIGURAZIONE DEL GIOCO
//  Tutti i numeri del gioco stanno QUI e solo qui.
//  Per bilanciare il gioco basta cambiare un valore in questo file:
//  il resto del codice legge da qui e non contiene numeri "magici".
// =============================================================

export const CONFIG = {
  // --- Stanza ---
  stanza: {
    minGiocatori: 3,
    maxGiocatori: 6,
    lunghezzaCodice: 4, // lettere del codice per entrare (stile Kahoot)
    // Solo consonanti: così il codice non forma parole e non si confondono O e 0, I e 1.
    lettereCodice: 'BCDFGHJKLMNPQRSTVWXZ',
    lunghezzaMassimaNome: 12,
    // Chi perde il collegamento nella lobby ha questo tempo per rientrare.
    secondiPrimaDiRimuovere: 60,
    // Una stanza senza nessun umano collegato viene cancellata dopo questo tempo.
    minutiStanzaAbbandonata: 10,
  },

  // --- Bot ---
  bot: {
    nomi: ['Sasso', 'Rugiada', 'Brodo', 'Ciuffo', 'Tegola', 'Fischio'],
    probabilitaAttacco: 0.7, // un bot vivo attacca 7 volte su 10, altrimenti si difende
    probabilitaPerseguita: 0.7, // un bot Spettro perseguita 7 volte su 10, altrimenti benedice
    probabilitaEsplora: 0.25, // se ha posto per un Oggetto
    probabilitaAbilita: 0.3, // se la sua abilità attiva è pronta
    probabilitaPatto: 0.15, // se può allearsi
    probabilitaOggetto: 0.5, // se ha un Oggetto che può usare
  },

  // --- Round ---
  round: {
    secondiScelta: 30, // tempo per la scelta segreta
    secondiRisultati: 30, // tempo massimo per leggere i risultati prima del round dopo
    bonusDifenditi: 2, // "Difenditi": +2 alla difesa
    malusEsplora: 1, // "Esplora": -1 alla difesa
    roundAttesaAbilita: 1, // round di attesa dopo un'abilità attiva
  },

  // --- Attacco ---
  attacco: {
    dannoBase: 1, // danno = differenza + 1
  },

  // --- Crollo della Torre ---
  // Ogni voce dice: "dal round X tutti perdono Y Vita a fine round".
  crollo: [
    { dalRound: 3, danno: 1 },
    { dalRound: 6, danno: 2 },
  ],

  // --- Alleanze e tradimenti ---
  alleanza: {
    bonusDifesa: 1,
    bonusPugnalata: 3,
    roundTraditore: 3,
  },

  // --- Taglia ---
  taglia: {
    dannoExtra: 1,
    ricompensaVita: 4,
    ricompensaOggetti: 2,
    vitaExtraPerRound: 1,
  },

  // --- Giorno e notte ---
  notte: {
    roundDiGiorno: 5,
    roundDiNotte: 2,
  },

  // --- Spettri ---
  spettro: {
    dannoPerseguita: 1,
    bonusBenedizione: 1,
  },

  // --- Oggetti ---
  // Esplorando si pesca un oggetto a caso da questa lista.
  // "peso" = quanto è facile trovarlo (2 = il doppio delle volte rispetto a 1).
  oggetti: {
    massimoATesta: 2,
    lista: [
      { id: 'pozione', nome: 'Pozione', peso: 1, descrizione: '+{cura} Vita.', numeri: { cura: 3 } },
      { id: 'pugnale', nome: 'Pugnale', peso: 1, descrizione: '+{bonus} al tuo attacco di questo round.', numeri: { bonus: 2 } },
      { id: 'mantello', nome: 'Mantello', peso: 1, descrizione: '+{bonus} alla difesa per questo round.', numeri: { bonus: 2 } },
      { id: 'pergamena', nome: 'Pergamena del Fato', peso: 1, descrizione: 'Guardi le prime {carte} carte del Destino.', numeri: { carte: 3 } },
      { id: 'bomba', nome: 'Bomba', peso: 1, descrizione: '{danno} danno a tutti gli altri.', numeri: { danno: 1 } },
      { id: 'amuleto', nome: 'Amuleto', peso: 1, descrizione: 'Annulla una Sventura. Si usa da solo.', numeri: {} },
      { id: 'fumogeno', nome: 'Fumogeno', peso: 1, descrizione: 'Annulla il primo attacco contro di te in questo round.', numeri: {} },
      { id: 'trappola', nome: 'Trappola', peso: 1, descrizione: 'Il primo che ti attacca in questo round subisce {danno} danni.', numeri: { danno: 2 } },
      { id: 'rampino', nome: 'Rampino', peso: 1, descrizione: 'Rubi un Oggetto a caso a un giocatore.', numeri: {} },
      { id: 'fiala', nome: 'Fiala del Fato', peso: 1, descrizione: 'Al tuo prossimo tiro di questo round peschi 2 carte Destino e tieni la migliore.', numeri: {} },
      { id: 'campanella', nome: 'Campanella degli Spiriti', peso: 1, descrizione: 'Uno Spettro a tua scelta deve benedirti.', numeri: {} },
    ],
  },

  // --- Eventi ---
  eventi: {
    ogniQuantiRound: 2,
  },

  // --- Mazzo del Destino ---
  // "copie" = quante carte di quel tipo ci sono nel mazzo.
  // Totale: 4 + 6 + 5 + 3 numeri + 4 speciali = 22 carte.
  destino: {
    valoreSpeciale: 0, // nelle somme, una carta speciale vale come questo numero
    numeri: [
      { valore: 0, copie: 4 },
      { valore: 1, copie: 6 },
      { valore: 2, copie: 5 },
      { valore: 3, copie: 3 },
    ],
    speciali: [
      { id: 'colpo-del-fato', nome: 'Colpo del Fato', copie: 1 },
      { id: 'sventura', nome: 'Sventura', copie: 1 },
      { id: 'ribaltone', nome: 'Ribaltone', copie: 1 },
      { id: 'specchio', nome: 'Specchio', copie: 1 },
    ],
  },

  // --- Personaggi ---
  // I numeri delle abilità (cura, danni, ecc.) stanno dentro "numeri",
  // così anche quelli si bilanciano da qui. Nelle descrizioni, {cura} viene
  // sostituito dal valore di numeri.cura (vedi game/testi.js): in questo modo
  // il testo non può mai dire un numero diverso da quello vero.
  personaggi: [
    {
      id: 'brunna',
      colore: '#ff9a3c',
      nome: 'Brunna',
      titolo: 'Guardiana',
      vita: 12,
      forza: 4,
      agilita: 1,
      magia: 1,
      abilita: {
        nome: 'Scudo',
        tipo: 'attiva',
        descrizione: 'Protegge un giocatore per un round: gli attacchi contro di lui colpiscono lei.',
      },
      debolezza: {
        nome: 'Lenta',
        descrizione: 'Quando esplora ha -{malusEsplora} alla difesa.',
      },
      numeri: { malusEsplora: 2 },
    },
    {
      id: 'vesper',
      colore: '#4fd67a',
      nome: 'Vesper',
      titolo: 'Assassina',
      vita: 7,
      forza: 3,
      agilita: 5,
      magia: 1,
      abilita: {
        nome: "Colpo nell'ombra",
        tipo: 'passiva',
        descrizione: 'Danno x{moltiplicatoreDanno} a chi è già ferito.',
      },
      debolezza: {
        nome: 'Fragile',
        descrizione: 'Ha poca Vita.',
      },
      numeri: { moltiplicatoreDanno: 2 },
    },
    {
      id: 'ottavio',
      colore: '#ffd34d',
      nome: 'Ottavio',
      titolo: 'Baro del Destino',
      vita: 8,
      forza: 2,
      agilita: 3,
      magia: 2,
      abilita: {
        nome: 'Mano truccata',
        tipo: 'attiva',
        descrizione: 'Vede sempre la prima carta del Destino e può scartarla.',
      },
      debolezza: {
        nome: 'Perseguitato',
        descrizione: 'Se pesca la Sventura perde anche {dannoSventura} Vita.',
      },
      numeri: { dannoSventura: 1 },
    },
    {
      id: 'mirra',
      colore: '#ff7ab8',
      nome: 'Mirra',
      titolo: 'Erborista',
      vita: 9,
      forza: 1,
      agilita: 2,
      magia: 4,
      abilita: {
        nome: 'Infuso',
        tipo: 'attiva',
        descrizione: 'Cura {cura} Vita a sé o a un altro giocatore.',
      },
      debolezza: {
        nome: 'Cuore tenero',
        descrizione: 'Curare un altro le costa {costoCuraAltri} Vita.',
      },
      numeri: { cura: 3, costoCuraAltri: 1 },
    },
    {
      id: 'zolfo',
      colore: '#ff4d5e',
      nome: 'Zolfo',
      titolo: 'Mago del caos',
      vita: 8,
      forza: 1,
      agilita: 2,
      magia: 5,
      abilita: {
        nome: 'Fiamma instabile',
        tipo: 'attiva',
        descrizione: 'Attacco di Magia contro TUTTI gli altri, alleati compresi.',
      },
      debolezza: {
        nome: 'Esplosivo',
        descrizione: 'Se attaccando pesca uno 0, fallisce e subisce {dannoEsplosione} danni.',
      },
      numeri: { dannoEsplosione: 2 },
    },
    {
      id: 'corvina',
      colore: '#b06bff',
      nome: 'Corvina',
      titolo: 'Voce dei morti',
      vita: 8,
      forza: 2,
      agilita: 2,
      magia: 4,
      abilita: {
        nome: 'Patto delle anime',
        tipo: 'passiva',
        descrizione: 'Ogni volta che un giocatore muore: +{magiaPerMorte} Magia (massimo {magiaMassima}).',
      },
      debolezza: {
        nome: 'Gelida',
        descrizione: 'Nessuno può curarla.',
      },
      numeri: { magiaPerMorte: 1, magiaMassima: 7 },
    },
  ],
};
