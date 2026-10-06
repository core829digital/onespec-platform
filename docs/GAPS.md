# Audit full-stack — stato e lacune residue (6 ottobre 2026)

Cosa è stato verificato (con esito) e cosa NON è coperto. Aggiornare a ogni giro.

## Verifiche automatiche (tutte verdi in locale)
| Controllo | Esito |
|---|---|
| `tsc --noEmit` | 0 errori |
| `eslint .` | 0 errori, 0 avvisi (prima: 10 avvisi) |
| `vitest run` | tutti i test passano (inclusi nuovi: limiti testi, monitoraggio) |
| `next build` (produzione) | ok |
| `npm audit --omit=dev` | 0 vulnerabilità |
| E2E widget in iframe di terzi + firma (Playwright) | ok dopo la correzione sotto |
| Pagine orfane/file inutilizzati in `src/` | 0 |

## Problemi trovati e corretti in questo giro
1. **CI rossa da 10 commit (job "Widget in a third-party iframe")**: la demo pubblica `/demo/showroom` caricava solo alcuni gruppi di testi e mancava `structure` (pannello traversi) → errore `MISSING_MESSAGE` in console → il test E2E falliva. Corretto in `src/app/demo/showroom/page.tsx`. Era un difetto reale anche per i visitatori (testi mancanti nel pannello).
2. **Testi liberi senza limite lato server** (il form li limitava, il server no): note attività cliente, cliente/indirizzo/squadra del collaudo, note posa, raccomandazione diagnostica rilievo, motivo di sospensione. Ora: limiti (200/300/120/500/5000 caratteri) e rifiuto dei caratteri di controllo (`INVALID_INPUT`). `setProductBase` ora accetta solo categorie reali.
3. **10 avvisi ESLint** (import inutilizzati, dipendenza mancante in un `useMemo` del preventivo — il numero di pezzi poteva restare vecchio nel calcolo dei forfait regionali —, navigazione con ricarica completa, `embed.js` volutamente ES5).

## Lacune NON coperte (onesto)
| # | Lacuna | Rischio | Cosa serve |
|---|---|---|---|
| 1 | Pagine dopo il login mai provate in un browser reale in CI (solo widget, firma, accesso/registrazione) | Medio | Backend di prova + test Playwright dei percorsi: preventivo, bozza, PDF |
| 2 | CSP completa (`script-src` con nonce) sulle pagine `/app` e `/auth` | Medio | Introdurla in modalità report-only, poi bloccante (tocca Sentry, PostHog, Turnstile, Vercel) |
| 3 | `CONVEX_DEPLOY_KEY` comparsa in chat | Alto finché non ruotata | Ruotarla dal Convex Dashboard (azione tua) |
| 4 | Stripe/Resend/VIES provati solo con simulazioni | Medio | Prova in modalità test reale (guida in `docs/`) |
| 5 | Lighthouse in produzione e prova su telefono reale | Basso/Medio | Misura su dominio vero |
| 6 | Letture `.collect()` su tabelle di dimensione "aziendale" (fornitori, vettori, attività di un cantiere, contatori d'uso): limitate dal dominio ma non da un tetto | Basso | Tetti `take(n)` se un'azienda supera migliaia di righe |
| 7 | Validazione testi: scansione euristica delle mutation pubbliche, non una prova formale | Basso | Test che enumera ogni argomento stringa e il suo limite |
| 8 | Firme già salvate dentro il documento del preventivo (prima della tabella separata) | Basso | Migrazione facoltativa |
| 9 | Avvisi GitHub Actions su Node 20 (azioni `checkout`/`setup-node`/`upload-artifact` v4) | Basso | Aggiornare alle versioni nuove quando disponibili |
| 10 | Monitoraggio caricato "a riposo": va verificato in produzione che Sentry/PostHog ricevano eventi | Medio | Controllare dashboard dopo il deploy |
