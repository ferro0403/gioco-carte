// =============================================================
//  SERVER
//  Fa due cose:
//  1. consegna ai telefoni i file dell'interfaccia (cartella public/)
//  2. tiene aperto un canale in tempo reale con ogni telefono (Socket.IO)
// =============================================================

import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import { Server } from 'socket.io';

// Cartella "public", calcolata a partire dalla posizione di questo file.
const cartellaPublic = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// 1. File statici: chi apre il sito riceve public/index.html
app.use(express.static(cartellaPublic));

// Indirizzo usato dall'hosting per controllare che il server sia vivo.
app.get('/salute', (richiesta, risposta) => {
  risposta.json({ ok: true });
});

// 2. Tempo reale: questa funzione parte ogni volta che un telefono si collega.
io.on('connection', (socket) => {
  console.log(`Collegato: ${socket.id}`);
  // Diciamo A TUTTI quante persone sono collegate adesso.
  io.emit('giocatori-collegati', io.engine.clientsCount);

  socket.on('disconnect', () => {
    console.log(`Scollegato: ${socket.id}`);
    io.emit('giocatori-collegati', io.engine.clientsCount);
  });
});

// L'hosting sceglie la porta con la variabile PORT; in locale usiamo la 3000.
const porta = process.env.PORT || 3000;
httpServer.listen(porta, () => {
  console.log(`L'Ultimo Eroe è in ascolto su http://localhost:${porta}`);
});
