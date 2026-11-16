// =============================================================
//  CLIENT: il codice che gira nel browser del telefono.
//  Per ora fa una cosa sola: si collega al server e mostra se
//  il collegamento funziona e quante persone sono collegate.
// =============================================================

// "io" arriva dallo script /socket.io/socket.io.js caricato in index.html.
// Chiamandola, il telefono apre il canale in tempo reale con il server.
const socket = io();

const stato = document.querySelector('#stato');
const collegati = document.querySelector('#collegati');

socket.on('connect', () => {
  stato.textContent = 'Collegato al server ✔';
  stato.className = 'stato ok';
});

socket.on('disconnect', () => {
  stato.textContent = 'Collegamento perso, riprovo…';
  stato.className = 'stato errore';
  collegati.textContent = '';
});

// Il server manda questo messaggio ogni volta che qualcuno entra o esce.
socket.on('giocatori-collegati', (quanti) => {
  collegati.textContent =
    quanti === 1 ? 'Ci sei solo tu, per ora.' : `Dispositivi collegati: ${quanti}`;
});
