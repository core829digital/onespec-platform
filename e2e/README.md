# Widget end-to-end (browser reale, iframe su un altro sito)

Prova il widget **come lo mette il montatore**: dentro un `<iframe>` di un sito con un'altra origine, contro un backend finto
(`mock-convex.mjs`). Controlla: intestazioni di incorporamento, messaggi tra finestre, errori in console, backend che fallisce o non risponde,
browser che bloccano lo storage, telefono, script a una riga (`/embed.js`), link oEmbed, stile "wizard".

## In CI
Tutte le suite di questa cartella partono da sole nel workflow **Frontend (Playwright)** (`.github/workflows/frontend-e2e.yml`):
a ogni push su `main`, a ogni pull request, ogni notte alle 03:17 UTC e a mano (Actions → «Frontend (Playwright)» → Run workflow).
Ogni suite è un job separato e girano in parallelo; se una fallisce, il job carica screenshot e log dell'app come artefatto (14 giorni).

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

Dal 12/10/2026 percorre anche il **supporto**: un cliente apre un ticket, il team lo trova (ricerca) e risponde, il cliente vede il pallino «non letto» e lo azzera aprendo il ticket, pagine statistiche / risposte rapide / casella «Contattaci» per il team, un cliente non entra nelle pagine del team, e la pagina pubblica «Contattaci» (desktop e telefono, senza invio reale: l'invio passa dal server HTTP di Convex, che il backend finto non riproduce).

Prima: `NEXT_PUBLIC_CONVEX_URL=http://localhost:3210 npm run build` e `npx next start -p 3100`; poi `npm run e2e:app`.
Se la porta 3210 è occupata, lo script si ferma con un messaggio (non riusa un backend altrui).

# Demo pubblica (`npm run e2e:demo`)
Percorre le 12 pagine principali su `demo.localhost:3100` (desktop, tablet, telefono): contenuto presente, niente overflow, niente errori in console, banner demo. Non serve alcun backend. Vedi `docs/DEMO.md`.

# Tutte le pagine pubbliche (`npm run e2e:routes`)
`e2e/route-sweep.mjs` apre **ogni pagina pubblica** (accesso, registrazione, password dimenticata, unisciti, contattaci, tutte le pagine
legali, widget e showroom demo) in **6 lingue × tema scuro/chiaro × desktop/telefono** e per ognuna controlla: nessun errore HTTP, nessun
errore in console o della pagina, `<html lang>` giusto, titolo e `<h1>` presenti, niente più largo dello schermo, immagini con testo
alternativo, accessibilità con axe-core (le violazioni «critical» fanno fallire, le «serious» finiscono nel report). Alla fine richiede una
volta ogni link interno trovato: un link che risponde 404/5xx fa fallire. Controlla anche che la pagina 404 sia una pagina vera.

L'elenco delle pagine legali viene letto da `src/content/legal.ts`: un documento nuovo viene controllato senza toccare il test.
In CI gira con Chromium su tutte le lingue e con **Firefox** e **WebKit** (il motore di Safari) su italiano e inglese.
Il report finisce nel riepilogo del job su GitHub.

Prima: `NEXT_PUBLIC_CONVEX_URL=http://localhost:3210 npm run build` e `npx next start -p 3100`; poi `npm run e2e:routes`.
Variabili: `BROWSER` (chromium | firefox | webkit), `SWEEP_LOCALES`, `SWEEP_THEMES`, `SWEEP_VIEWPORTS`, `SWEEP_CONCURRENCY`, `E2E_SHOT_DIR`.
