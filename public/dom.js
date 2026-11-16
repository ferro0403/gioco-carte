// Piccolo aiuto per costruire pezzi di pagina dal JavaScript.
//
//   el('button', { class: 'bottone', onclick: saluta }, 'Ciao')
//
// crea <button class="bottone">Ciao</button> e chiama saluta() al tocco.
//
// IMPORTANTE: i testi (per esempio i nomi dei giocatori) vengono inseriti
// come testo semplice, mai come HTML. Così se qualcuno si chiama
// "<script>..." vede solo quella scritta strana e non succede niente.
export function el(tag, proprieta = {}, ...figli) {
  const elemento = document.createElement(tag);

  for (const [nome, valore] of Object.entries(proprieta)) {
    if (valore === false || valore == null) continue;
    if (nome.startsWith('on')) {
      // onclick, oninput... diventano "ascoltatori" di eventi.
      elemento.addEventListener(nome.slice(2), valore);
    } else if (nome === 'style') {
      // setProperty funziona anche con le variabili CSS, come '--colore'.
      for (const [chiave, v] of Object.entries(valore)) {
        elemento.style.setProperty(chiave, v);
      }
    } else if (nome === 'value') {
      elemento.value = valore;
    } else {
      elemento.setAttribute(nome, valore === true ? '' : valore);
    }
  }

  // flat(Infinity) "apre" le liste dentro altre liste, a qualunque profondità.
  for (const figlio of figli.flat(Infinity)) {
    if (figlio === false || figlio == null) continue;
    elemento.append(figlio); // le stringhe diventano testo semplice
  }
  return elemento;
}
