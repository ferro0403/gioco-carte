// Riempie i segnaposto {nome} di un testo con i numeri veri.
// Esempio: riempiTesto('Cura {cura} Vita', { cura: 3 })  ->  'Cura 3 Vita'
//
// replace() con una funzione: per ogni {parola} trovata, la funzione
// riceve la parola e restituisce cosa metterci al suo posto.
export function riempiTesto(testo, numeri = {}) {
  return testo.replace(/\{(\w+)\}/g, (tutto, nome) =>
    nome in numeri ? String(numeri[nome]) : tutto,
  );
}
