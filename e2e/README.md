# Widget end-to-end (browser reale, iframe su un altro sito)

Prova il widget **come lo mette il montatore**: dentro un `<iframe>` di un sito con un'altra origine, contro un backend finto
(`mock-convex.mjs`). Controlla: intestazioni di incorporamento, messaggi tra finestre, errori in console, backend che fallisce o non risponde,
browser che bloccano lo storage, telefono, script a una riga (`/embed.js`), link oEmbed, stile "wizard".

## In CI
Parte da solo (job `widget-e2e` in `.github/workflows/ci.yml`).

## In locale
```powershell
# 1. build di produzione con il backend finto
$env:NEXT_PUBLIC_CONVEX_URL = "http://localhost:3210"
$env:NEXT_PUBLIC_CONVEX_SITE_URL = "https://e2e.convex.site"
npm run build
# 2. avvio dell'app (lascia questa finestra aperta)
npx next start -p 3100
# 3. in un'altra finestra
npx playwright install chromium   # solo la prima volta
npm run e2e
```
Variabili utili: `APP_URL` (default `http://localhost:3100`), `PLAYWRIGHT_CHROMIUM` (binario del browser), `E2E_SHOT` (dove salvare lo screenshot se un passo fallisce).


# Percorsi dopo il login (`npm run e2e:app`)
Il backend è finto ma **le funzioni sono quelle vere** del repo (convex-test dietro il protocollo HTTP/WebSocket di Convex: `e2e/app-backend.host.ts`).
Lo script `e2e/app-flows.mjs` lo avvia da solo, accede come titolare con i cookie di Convex Auth e percorre:
accesso negato se non autenticati, 27 pagine `/app` (nessun errore in console, nessuno scroll orizzontale, contenuto presente), l'editor misure
del preventivo B2B (larghezza/altezza digitate sul disegno), bozza preventivo (salva → «Bozze» → riapri), traverso su una singola anta, firma sul canvas → documento stampabile (desktop e telefono), e su iPhone 390 px: isola in basso,
niente overflow, menu «Altro» con «Aggiungi alla schermata Home».

Prima: `NEXT_PUBLIC_CONVEX_URL=http://localhost:3210 npm run build` e `npx next start -p 3100`; poi `npm run e2e:app`.
Se la porta 3210 è occupata, lo script si ferma con un messaggio (non riusa un backend altrui).

# Demo pubblica (`npm run e2e:demo`)
Percorre le 12 pagine principali su `demo.localhost:3100` (desktop, tablet, telefono): contenuto presente, niente overflow, niente errori in console, banner demo. Non serve alcun backend. Vedi `docs/DEMO.md`.
