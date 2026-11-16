// Avvia il server. Tutto il resto sta in server/app.js.
import { creaApp } from './app.js';

const { httpServer } = creaApp();

// L'hosting sceglie la porta con la variabile PORT; in locale usiamo la 3000.
const porta = process.env.PORT || 3000;
httpServer.listen(porta, () => {
  console.log(`L'Ultimo Eroe è in ascolto su http://localhost:${porta}`);
});
