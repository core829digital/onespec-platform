# Audit full-stack del widget incorporato (iframe) — ottobre 2026

Perimetro: il widget sul sito del montatore (`/w/<id>`, pagina ospitata `/c/<id>`, wizard, demo), gli endpoint pubblici che usa, la catena di
build/rilascio. Metodo: lettura del codice + **prova in un browser reale** con il widget in un iframe su un'altra origine (`e2e/`).

## Risposta alla domanda "basta un link?"
**Sì, in due modi, entrambi implementati:**
1. **Una riga di codice** (`<script async src=".../embed.js" data-onespec="ID">`): crea da sola il riquadro, ne adatta l'altezza, avvisa il
   sito quando arriva una richiesta (evento `onespec:submitted`, utile per Google Analytics). Funziona su qualsiasi sito che permetta un blocco HTML/script.
2. **Solo il link** della pagina ospitata (`/c/<id>`): la pagina espone l'indirizzo oEmbed (`/api/oembed`), quindi i costruttori di siti che
   incorporano "da link" (Notion, Ghost, Squarespace e simili, tramite il loro servizio oEmbed) mostrano il configuratore da soli.
   **Limite onesto:** incollare un URL in un sito qualsiasi non fa apparire nulla se quel sito non sa leggere oEmbed (es. WordPress senza plugin,
   Wix): lì serve la riga di codice (o l'iframe). In ogni caso il **dominio del sito va autorizzato** (vedi sotto): è una protezione, non un difetto.

## Problemi trovati e corretti
| # | Gravità | Problema | Correzione |
|---|---|---|---|
| 1 | **Alta** | In browser che bloccano lo storage di terze parti (Chrome in incognito, Brave, impostazione "blocca cookie di terze parti") **tutto il widget crollava** ("Something went wrong"): il provider di autenticazione, nel layout radice, leggeva `window.localStorage` durante il rendering anche sulle pagine pubbliche. | Il provider vive ora solo nel layout `[locale]` (area autenticata): `/w`, `/c`, `/demo`, `/f`, `/i`, `/k` non lo toccano più. Prova automatica con storage bloccato. |
| 2 | **Alta** | L'invio del preventivo non aveva **timeout**: con rete morta o backend lento il visitatore restava su uno spinner senza fine. | `postQuote` (20 s, `AbortController`) per widget avanzato e wizard; messaggio chiaro e possibilità di riprovare. |
| 3 | Media | Il messaggio di errore dell'invio non era annunciato dai lettori di schermo (nessun `role="alert"`). | `role="alert"` su entrambi i widget. |
| 4 | Media | Un montatore senza siti autorizzati vedeva un riquadro **vuoto** sul proprio sito (CSP `frame-ancestors 'self'`) senza sapere perché. | Scheda Incorporamento: elenco siti autorizzati, avviso rosso se vuoto, pulsante per modificarli. |
| 5 | Media | `https://sito.it` autorizzato ma il sito vive anche su `www.sito.it` (o viceversa): il widget restava vuoto sull'altra variante. | `withWwwVariants`: un dominio nudo copre anche il gemello `www.` (e viceversa); mai IP, localhost o sotto-domini più profondi. |
| 6 | Media | Il "controllo origine morbido" in `convex/http.ts` era **codice morto** (confrontava una lista che il payload pubblico non contiene) e comunque inutile: la richiesta parte dal documento del widget, quindi l'Origin è sempre quello della piattaforma. Dava un falso senso di sicurezza. | Rimosso; commento che spiega che l'origine è imposta da `frame-ancestors`, l'abuso da Turnstile + honeypot + rate limit. |
| 7 | Media | Il limite di 256 KB sul corpo dell'invio guardava solo l'intestazione `content-length` (aggirabile con upload a blocchi). | Il corpo viene misurato davvero. |
| 8 | Bassa | Il token-bucket buttava via la frazione di gettone guadagnata a ogni richiesta (chi riprovava ogni 1–2 minuti non recuperava mai un gettone) e scriveva anche sui rifiuti. | L'orologio di ricarica avanza solo dei gettoni restituiti; i rifiuti non scrivono. Test dedicati. |
| 9 | Bassa (privacy) | Sulle pagine pubbliche (visitatori del sito del montatore) Sentry campionava il 20% delle **tracce di prestazioni**. | `tracesSampler` = 0 su `/w /c /demo /f /i /k`; restano solo i crash report (senza contenuto utente), come da informativa. |
| 10 | Bassa | `experimental.turbo` non valido in `next.config.mjs`: avviso a ogni build. | Rimosso. |
| 11 | Bassa | La CSP del widget esiste in due copie (`next.config.mjs` e `src/proxy.ts`): rischio di deriva. | Test `csp-sync` che le confronta e blocca `unsafe-eval`, caratteri jolly e `frame-ancestors` statico. |
| 12 | Bassa | 1 vulnerabilità **alta** nelle dipendenze di produzione (`source-map-js`, denial of service). | `npm audit fix`: 0 vulnerabilità di produzione. |

## Verificato e a posto (con prova)
Widget in iframe su sito autorizzato (rendering, `ready`/`resize`, altezza adattiva, nessun errore in console); sito non autorizzato (bloccato dal
browser); invio completo e payload coerente (quote ante che sommano 1); backend 500 / 429 / risposta non JSON (messaggi chiari, nessun codice
grezzo, si può riprovare); backend che non risponde; storage bloccato; telefono 360 px (nessuno scroll orizzontale); id sconosciuto (404) e id
malformato (non riflesso); stile wizard; nessun `innerHTML` / `eval` nel codice; testi del dealer sempre escapati; messaggi `postMessage` accettati solo dal parent e dall'origine del sito.

## Rischi residui (consigliati, non bloccanti)
- **CSP con `'unsafe-inline'` negli script** (necessario a Next senza nonce): passare a una CSP con nonce richiede pagine sempre dinamiche; da valutare.
- **IP del visitatore**: se la piattaforma non sta dietro a Cloudflare, `X-Forwarded-For` (primo valore) è falsificabile e aggira il limite per IP; restano il limite globale per configuratore, Turnstile e honeypot. Attivare Turnstile (chiavi in ambiente) in produzione.
- **Turnstile** va configurato (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET`), altrimenti l'anti-bot è disattivato.
- Il file `/embed.js` è codice eseguito sulle pagine dei montatori: è minimo, senza dipendenze, senza `eval`/`innerHTML`, accetta solo messaggi del proprio iframe e della propria origine; va tenuto protetto come il resto del repository (revisione obbligatoria sui cambi).
- Attivare nel repository GitHub: *secret scanning* + *push protection*, protezione del ramo `main` con i controlli CI obbligatori.

## CI/CD (`.github/`)
- `ci.yml`: tipi, lint, test, build · **widget end-to-end in browser reale** · audit delle dipendenze di produzione (alta gravità blocca).
- `codeql.yml`: analisi statica di sicurezza a ogni push/PR e ogni settimana.
- `dependabot.yml`: aggiornamenti settimanali (npm + GitHub Actions), minori/patch raggruppati.
- `deploy-convex.yml`: rilascio del backend **manuale**, con ambiente `production` (segreto `CONVEX_DEPLOY_KEY`), dopo tipi e test.
- Test `no-secrets`: nessuna chiave privata/live nei file tracciati.
