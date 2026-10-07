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

## Secondo giro (7 ottobre 2026) — lacune chiuse
| Lacuna | Cosa è stato fatto |
|---|---|
| CI | Verificato su GitHub: CI e CodeQL verdi sul commit del primo giro |
| #2 CSP sulle pagine `/app` e `/auth` | Policy **solo-segnalazione** (`Content-Security-Policy-Report-Only`, file `csp-report-only.mjs`): non blocca nulla, invia a Sentry ciò che una policy rigida avrebbe bloccato. Dopo 2-3 settimane di segnalazioni si passa alla policy bloccante con nonce |
| #6 Letture senza tetto | Fornitori, vettori, attività di cantiere: tetto alto (500 / 1000 / 2000 righe) |
| #7 Validazione testi non provata | Test di guardia `tests/server-text-guard.test.ts`: fallisce se una nuova mutation pubblica accetta testo libero senza alcun controllo riconoscibile (verificato togliendo un controllo: il test diventa rosso) |
| #8 Firme vecchie nel preventivo | Migrazione pronta `migrations:moveQuoteSignatures` (idempotente, a blocchi, con test). **Da lanciare dopo il deploy**: `npx convex run migrations:moveQuoteSignatures`, ripetere con `{"cursor":"..."}` finché `done` è `true` |

## Lacune NON coperte (onesto)
| # | Lacuna | Rischio | Cosa serve |
|---|---|---|---|
| 1 | Pagine dopo il login mai provate in un browser reale in CI (solo widget, firma, accesso/registrazione) | Medio | Backend di prova + test Playwright dei percorsi: preventivo, bozza, PDF |
| 2 | CSP **bloccante** con nonce su `/app` e `/auth` (la fase solo-segnalazione è attiva) | Medio | Leggere le segnalazioni in Sentry, poi irrigidire |
| 3 | `CONVEX_DEPLOY_KEY` comparsa in chat | Alto finché non ruotata | Ruotarla dal Convex Dashboard (azione tua) |
| 4 | Stripe/Resend/VIES provati solo con simulazioni | Medio | Prova in modalità test reale (guida in `docs/`) |
| 5 | Lighthouse in produzione e prova su telefono reale | Basso/Medio | Misura su dominio vero |
| 6 | Restano senza tetto i contatori d'uso e le cancellazioni a cascata (volutamente: troncare lascerebbe righe orfane) | Molto basso | Cancellazione a blocchi se serve |
| 7 | La guardia sui testi è euristica (cerca un controllo, non ne verifica il valore del limite) | Basso | Revisione dei limiti caso per caso |
| 8 | Migrazione firme vecchie pronta ma da lanciare a mano dopo il deploy | Basso | Un comando (vedi sopra) |
| 9 | Avvisi GitHub Actions su Node 20 (azioni v4) | Basso | Dependabot propone già gli aggiornamenti: accettare le sue PR |
| 10 | Monitoraggio caricato "a riposo": va verificato in produzione che Sentry/PostHog ricevano eventi | Medio | Controllare dashboard dopo il deploy |
