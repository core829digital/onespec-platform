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
