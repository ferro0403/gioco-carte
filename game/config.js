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
  },

  // --- Round ---
  round: {
    secondiScelta: 30, // tempo per la scelta segreta
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
  oggetti: {
    massimoATesta: 2,
  },

  // --- Eventi ---
  eventi: {
    ogniQuantiRound: 2,
  },

  // --- Mazzo del Destino ---
  // "copie" = quante carte di quel tipo ci sono nel mazzo.
  // Totale: 4 + 6 + 5 + 3 numeri + 4 speciali = 22 carte.
  destino: {
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
  // così anche quelli si bilanciano da qui.
  personaggi: [
    {
      id: 'brunna',
      nome: 'Brunna',
      titolo: 'Guardiana',
      vita: 12,
      forza: 4,
      agilita: 1,
      magia: 1,
      abilita: { nome: 'Scudo', tipo: 'attiva' },
      debolezza: { nome: 'Lenta' },
      numeri: { malusEsplora: 2 },
    },
    {
      id: 'vesper',
      nome: 'Vesper',
      titolo: 'Assassina',
      vita: 7,
      forza: 3,
      agilita: 5,
      magia: 1,
      abilita: { nome: "Colpo nell'ombra", tipo: 'passiva' },
      debolezza: { nome: 'Fragile' },
      numeri: { moltiplicatoreDanno: 2 },
    },
    {
      id: 'ottavio',
      nome: 'Ottavio',
      titolo: 'Baro del Destino',
      vita: 8,
      forza: 2,
      agilita: 3,
      magia: 2,
      abilita: { nome: 'Mano truccata', tipo: 'attiva' },
      debolezza: { nome: 'Perseguitato' },
      numeri: { dannoSventura: 1 },
    },
    {
      id: 'mirra',
      nome: 'Mirra',
      titolo: 'Erborista',
      vita: 9,
      forza: 1,
      agilita: 2,
      magia: 4,
      abilita: { nome: 'Infuso', tipo: 'attiva' },
      debolezza: { nome: 'Cuore tenero' },
      numeri: { cura: 3, costoCuraAltri: 1 },
    },
    {
      id: 'zolfo',
      nome: 'Zolfo',
      titolo: 'Mago del caos',
      vita: 8,
      forza: 1,
      agilita: 2,
      magia: 5,
      abilita: { nome: 'Fiamma instabile', tipo: 'attiva' },
      debolezza: { nome: 'Esplosivo' },
      numeri: { dannoEsplosione: 2 },
    },
    {
      id: 'corvina',
      nome: 'Corvina',
      titolo: 'Voce dei morti',
      vita: 8,
      forza: 2,
      agilita: 2,
      magia: 4,
      abilita: { nome: 'Patto delle anime', tipo: 'passiva' },
      debolezza: { nome: 'Gelida' },
      numeri: { magiaPerMorte: 1, magiaMassima: 7 },
    },
  ],
};
