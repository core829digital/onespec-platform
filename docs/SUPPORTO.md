# Sistema di supporto (ticket) — progetto, sicurezza, lacune

Versione 1.17.0 · 11 ottobre 2026

## Cosa c'è
- **Cliente** (`/app/support`, voce «Supporto» nel menu Account): apre un ticket (categoria, oggetto, messaggio), vede lo storico, risponde, chiude, valuta (1–5) a ticket risolto. Le risposte del team arrivano anche come notifica nel campanello.
- **Admin piattaforma** (`/app/admin/support`, link dalla pagina Admin): coda per stato (Da gestire / In attesa cliente / Risolti / Chiusi), filtro «Assegnati a me», contatori, obiettivo di prima risposta (SLA indicativo 4/8/24/72 h per urgente/alta/normale/bassa), dettaglio con dati azienda e piano, risposta al cliente, «invia e segna come risolto», **note interne**, priorità, assegnazione, chiusura definitiva, riapertura.
- **Ciclo di vita**: `open` (tocca al team) → `waiting` (tocca al cliente) → `resolved` → `closed`. Se il cliente risponde a un ticket risolto, si riapre. Un ticket risolto e senza risposte per 7 giorni si chiude da solo (cron). `closed` è definitivo.

## Modello di sicurezza (verificato da `tests/convex/support.test.ts`)
| Rischio | Difesa |
|---|---|
| Lettura/risposta ai ticket di altri (IDOR) | Ogni accesso passa da `assertCustomerAccess`: solo il richiedente (membro attivo) oppure owner/admin della **stessa** azienda. Per tutti gli altri l'errore è `TICKET_NOT_FOUND` (non rivela che il ticket esiste) |
| Un membro vede i ticket dei colleghi | La lista del membro è per utente; owner/admin vedono quelli dell'azienda |
| Fuga delle note interne o dell'identità dello staff | Le note stanno in una **tabella separata** (`supportInternalNotes`) che nessuna query cliente legge; ai clienti lo staff appare solo come «Team CORE829» |
| Falso staff | Tutte le funzioni admin partono da `requirePlatformAdmin` (utente verificato + flag admin) |
| Spam / abuso | Rate limit: 5 ticket/ora, 30 risposte/ora per utente, max 10 ticket aperti per utente, max 200 messaggi per ticket, testi 3–4000 caratteri senza caratteri di controllo |
| XSS | Testo mostrato solo come testo React (`whitespace-pre-wrap`), mai HTML; `pagePath` accettato solo se è un percorso interno |
| Falsificazione del registro | Audit (`auditLog`) scritto solo dal server: crea, risposta, stato, priorità, assegnazione, nota, valutazione |
| Transizioni di stato incoerenti | Tabella delle transizioni condivisa (`src/shared/support.ts`), `closed` finale, valutazione una sola volta |
| Crescita infinita dei dati | Messaggi in tabella figlia con tetto; cron di pulizia: ticket chiusi da > 730 giorni e ticket di aziende cancellate (con messaggi e note) |

## File
`convex/support.ts` (cliente) · `convex/supportAdmin.ts` (admin + cron) · `convex/lib/support.ts` (regole comuni) · `src/shared/support.ts` (costanti) · pagine in `src/app/[locale]/app/support` e `admin/support` · stringhe `support`, `supportAdmin`, `nav.support` in 6 lingue · codici errore `TICKET_*` in `src/lib/errors.ts`.

## Lacune (onesto) — cosa manca per completare
| # | Lacuna | Priorità | Nota |
|---|---|---|---|
| 1 | **Email** al cliente quando il team risponde, e allo staff per un nuovo ticket (oggi: solo notifica nel campanello) | Alta | Serve un nuovo template in 6 lingue in `convex/emails` e l'invio con `internal.email.send`; rispettare `notificationPrefs` |
| 2 | **Allegati/screenshot** nei ticket | Alta | Riusare `assertStoredFile` + quarantena `uploadsGuard.sniff` (stesso schema degli upload esistenti); non farlo senza quel controllo |
| 3 | Badge «risposta non letta» sulla voce di menu | Media | Query `support.unreadCount` già pronta; manca solo il punto nel menu laterale e nell'isola mobile |
| 4 | Chi non riesce ad accedere non può aprire ticket | Media | Pagina pubblica «Contattaci» con Turnstile + rate limit per IP, oppure indirizzo email di supporto |
| 5 | Risposte rapide (modelli) per lo staff, ricerca per testo/azienda, filtro per categoria | Media | Tabella `supportCannedReplies` e indice di ricerca |
| 6 | SLA solo **informativo** (nessun avviso automatico di superamento) | Media | Cron che notifica gli admin oltre l'obiettivo |
| 7 | Esportazione dati personali (GDPR art. 15/20) non include i ticket; alla cancellazione account i ticket restano (record aziendale) con richiedente non più risolvibile | Media | Decidere con il consulente legale: anonimizzare o cancellare; aggiornare informativa privacy |
| 8 | Statistiche (tempo medio di risposta, valutazione media) | Bassa | I dati ci sono (`firstResponseAt`, `rating`) |
| 9 | Test in browser reale (E2E) delle nuove pagine e demo online senza ticket | Bassa | Le pagine sono coperte da test di render in 6 lingue e da 13 test backend, non da Playwright |
| 10 | Il supporto è per ora **solo** nella lingua dei messaggi scritti dall'utente: nessuna traduzione automatica | Bassa | Valutare con volumi reali |
