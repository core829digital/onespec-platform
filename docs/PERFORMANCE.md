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
Da indagare: il JS iniziale delle pagine auth resta ~1,3 MB grezzi; verificare con un analyzer quale chunk condiviso lo domina.

## Messaggi i18n: nessuno split

I messaggi pesano 128 KB totali (~25 KB gzip), ~100 namespace, nessuno dominante. Dividerli darebbe un guadagno trascurabile e rischio di regressioni (chiavi mancanti a runtime): decisione di NON farlo.

## Firma del preventivo

La firma (immagine) vive nella tabella `quoteSignatures`, separata dal preventivo: le liste e le letture normali non la trasportano più. I preventivi vecchi con firma inline restano leggibili (fallback).
