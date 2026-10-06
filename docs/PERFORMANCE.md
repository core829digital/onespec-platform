# Performance — cosa è stato fatto e cosa resta

## Fatto (con la misura dove c'è)
- **Motore PDF fuori dalle pagine normali**: era 1,2 MB di JavaScript caricato anche su preventivo, showroom e lista installazioni; ora solo dove si fa un PDF e al clic (verificato nei manifest della build). Test di guardia: `tests/bundle-guard.test.ts`.
- **Liste preventivi/richieste**: niente più immagine della firma né elenco pezzi in ogni riga (le liste erano rimandate a ogni schermata ad ogni modifica).
- **Query più leggere**: guida iniziale (gira su ogni pagina), riepilogo logistica (leggeva tutte le consegne di sempre).
- **Font**: solo il testo base è precaricato su ogni pagina.
- **Scheletri di caricamento** al posto dello spinner nella lista preventivi (le altre liste avevano già lo scheletro di rotta).
- **Layout /app**: una sola lettura lato server (tenant) a ogni caricamento a freddo; le sottoscrizioni dei componenti uguali sono unite da Convex. Nessun duplicato da eliminare.

## Resta (consigliato)
- Spostare la firma del preventivo in file separato (pesa ancora nelle statistiche della dashboard).
- Messaggi di traduzione: ~145 KB di JSON per lingua inviati in ogni pagina; si possono dividere per sezione.
- Misura reale con Lighthouse su produzione (qui non misurabile: serve il sito pubblicato).

## Misure locali (build di produzione, pagine pubbliche)

Misurate con Playwright/Chromium su `next start` locale (senza CDN né compressione, quindi i KB sono "grezzi"):

| Pagina | TTFB | FCP | Load |
|---|---|---|---|
| `/auth/join`, `/auth/register` (desktop) | ~40 ms | ~220 ms | ~950 ms |
| stesse, telefono 390 px | — | ~170-190 ms | ~815-894 ms |
| `/auth/login` primo hit a freddo | 561 ms | 956 ms | 1720 ms |

Limiti: le pagine dopo il login non sono misurate (serve un backend di prova); Lighthouse su produzione e prova su telefono reale vanno fatti dal team.
### Perché il JS di login è ~1,3 MB grezzi (indagato)

Il motore PDF (1,2 MB) NON è caricato in login: verificato. La somma è fatta da pochi blocchi condivisi:

| Blocco | Grezzi | Cosa contiene |
|---|---|---|
| PostHog | ~298 KB | analytics, caricato in ogni pagina |
| Sentry | ~265 KB | segnalazione errori, caricato in ogni pagina |
| React + Next (router) | ~235 + ~129 KB | indispensabili |
| Convex + UI (Radix) | ~83 + ~60 KB | indispensabili |
| resto | ~275 KB | codice della pagina, i18n, stile |

### Rimedio applicato: monitoraggio caricato "a riposo" (modalità sicura)

PostHog e Sentry non sono più nel primo caricamento. `src/lib/monitoring.ts` è una facciata leggera: le chiamate fatte prima del caricamento vengono messe in coda (ordinata, max 100) e rigiocate appena le librerie arrivano. Le librerie vere e la loro inizializzazione sono in `src/lib/monitoring-init.ts`, caricate:
- a pagina finita e browser a riposo (max ~4 s), oppure
- subito, se qualcosa segnala un errore (le segnalazioni di crash non vengono ritardate di proposito).

Garanzie:
- Errori nei primissimi istanti: due listener minimi (`error`, `unhandledrejection`) li catturano, caricano Sentry e li inviano (verificato nel browser: l'evento arriva a `/monitoring`).
- Consenso cookie invariato: PostHog e Replay partono sempre disattivati; "Accetta" carica subito e attiva; "Rifiuta" prima del caricamento non fa nulla.
- Nessuno può reintrodurre il peso per sbaglio: `tests/monitoring.test.ts` fallisce se un file diverso da `monitoring-init.ts` e `instrumentation.ts` (server) importa `posthog-js` o `@sentry/nextjs`.

Misura (login, build di produzione locale): JS fino all'evento load **1316 KB → 733 KB (-44%)**; i ~780 KB di monitoraggio arrivano dopo, a browser libero. FCP ~230-260 ms.

## Messaggi i18n: nessuno split

I messaggi pesano 128 KB totali (~25 KB gzip), ~100 namespace, nessuno dominante. Dividerli darebbe un guadagno trascurabile e rischio di regressioni (chiavi mancanti a runtime): decisione di NON farlo.

## Firma del preventivo

La firma (immagine) vive nella tabella `quoteSignatures`, separata dal preventivo: le liste e le letture normali non la trasportano più. I preventivi vecchi con firma inline restano leggibili (fallback).
