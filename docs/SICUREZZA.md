# Sicurezza — stato, controlli fatti e cosa resta (ottobre 2026)

## Come è protetta la piattaforma (in parole semplici)
1. **Ogni dato appartiene a un'azienda.** Ogni funzione del backend (Convex) controlla chi sei, di quale azienda sei e cosa puoi fare (`requirePermission`). Due livelli: *accesso* (owner / admin / membro) e *grado professionale* (es. un montatore non vede i preventivi).
2. **Il prezzo lo decide il server.** Anche se il browser invia un prezzo, il server ricalcola tutto dal catalogo pubblicato. Vale per i preventivi B2B, per i traversi e per i pannelli collegati.
3. **Accesso del team senza account**: link + codice a 6 cifre monouso + password della sala (mostrata una sola volta, salvata solo come hash). Blocco dopo 5 errori, scadenza 7 giorni / 15 minuti.
4. **Firme**: un'immagine vuota o bianca è rifiutata anche dal server; un preventivo si firma una volta sola e non se è una bozza.
5. **Limiti di frequenza** su accesso, richieste di link, VIES, esportazioni.

## Controlli eseguiti in questa sessione
| Controllo | Esito |
|---|---|
| Scansione di tutte le funzioni Convex pubbliche per gate di permesso (273) | 38 senza gate diretto: tutte verificate a mano → gate dentro un helper o pubbliche per scelta (PIN ospite, token, widget pubblico). Nessun buco. |
| Funzioni che usavano solo "sei membro" | **Corrette**: `quotes.getRequest`, `getQuoteForPrint`, `linksForQuote` (ora richiedono `quotes.use` + grado), statistiche ricavi/lead (`analytics.use`). Test negativi: altra azienda e grado fuori area vendite. |
| `signQuote` | Ora richiede `quotes.use`, rifiuta bozze e seconda firma (prima poteva sovrascrivere la firma). |
| Eliminazione preventivi | Mai se firmato o con fornitura; i membri solo le proprie bozze. Audit log su ogni cancellazione. |
| Intestazioni HTTP (verificate dal vivo) | X-Frame-Options DENY, HSTS 2 anni + preload, nosniff, Referrer-Policy, Permissions-Policy. Pagine widget (/w /c /demo): CSP con nonce e `strict-dynamic`. |
| E-mail | Tutto l'HTML è escapato; test su 16 modelli × 6 lingue (anche con tentativi di iniezione). |

## Cosa NON è ancora fatto (onesto)
- **CSP completa sulle pagine della piattaforma** (/app, /auth): oggi hanno `frame-ancestors 'none'` ma non un `script-src` con nonce. Si può fare, ma tocca PostHog, Sentry, Turnstile, Vercel: da introdurre prima in modalità *report-only* con un endpoint di raccolta.
- **Chiave di deploy Convex**: era stata incollata in chat → **ruotarla** (Convex Dashboard → Settings → Deploy keys).
- **Firma come immagine dentro il documento del preventivo**: appesantisce le liste (le liste non la leggono più, ma le statistiche sì). Passo successivo consigliato: spostarla in file storage.
- Test automatici delle pagine dopo il login (richiedono un backend di prova): sono stati verificati solo accesso/registrazione/unisciti a 360–768 px.

## Checklist prima di ogni deploy
1. `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `npx next build` verdi.
2. `SITE_URL`, `CONVEX_DEPLOY_KEY` nuova, `STRIPE_*`, `RESEND_*` presenti in Convex produzione.
3. `npx convex deploy` **prima** del deploy del sito (lo schema cambia: nuovo stato `draft`, campo `grade`, tabelle `teams`/`teamTickets`).
4. Dopo il deploy: provare un invito di team, una bozza di preventivo, un PDF da telefono.
