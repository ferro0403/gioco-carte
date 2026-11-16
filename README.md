# L'Ultimo Eroe

Party game fantasy da 3 a 6 giocatori, 15–20 minuti a partita. Ognuno gioca dal proprio
telefono, nel browser, entrando in una stanza con un codice. Vince l'ultimo rimasto in vita.

> Titolo provvisorio. Il gioco è originale.

## Come provarlo sul tuo computer

Serve [Node.js](https://nodejs.org) versione 20 o più recente.

```bash
npm install
```

```bash
npm start
```

Poi apri <http://localhost:3000>.

Per provarlo da un telefono collegato alla stessa Wi-Fi, apri sul telefono
`http://INDIRIZZO-IP-DEL-COMPUTER:3000`.

Altri comandi:

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Avvia il server e lo riavvia da solo quando salvi un file |
| `npm test` | Lancia i test delle regole |

## Com'è organizzato

| Cartella | Contenuto |
|---|---|
| `game/` | Le **regole** del gioco: logica pura, senza server né schermo |
| `game/config.js` | **Tutti i numeri** del gioco (Vita, danni, round…): si bilancia da qui |
| `server/` | Il server: stanze, giocatori, messaggi in tempo reale |
| `public/` | L'interfaccia che vedono i telefoni (HTML, CSS, JavaScript) |
| `test/` | I test delle regole |

Regola d'oro: `game/` non sa niente di server e schermo. Il server usa le regole,
l'interfaccia mostra quello che il server le manda. Così nessuno può barare e le
regole si possono provare con i test.

## Tecnologie

- **Node.js + Express**: il server.
- **Socket.IO**: i messaggi in tempo reale tra server e telefoni.
- **JavaScript puro** nel browser, senza framework e senza passaggi di build.
- **node --test**: i test, già inclusi in Node.
- **Render** (piano gratuito): l'hosting. Solo servizi gratuiti, senza carta di credito.

## Come si lavora

- Mai modifiche dirette su `main`.
- Ogni passo sta su un branch separato, con la sua Pull Request.
- Il merge in `main` si fa solo dopo aver provato che funziona.

## Milestone

1. ✅ Tecnologie, hosting e struttura del progetto
2. Stanza con codice, lobby, scelta dei personaggi, bot
3. Il cuore del gioco: round, attacchi, Destino, crollo della Torre, Spettri, vittoria
4. Alleanze, tradimenti, Taglia, Notte, abilità, Oggetti
5. Eventi, Mercante, Patti oscuri
6. Grafica cartoon e animazioni
