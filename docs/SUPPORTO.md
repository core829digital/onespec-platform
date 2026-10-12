# Sistema di supporto (ticket) — progetto, sicurezza, lacune

Versione 1.22.0 · 12 ottobre 2026 (1.17.0: ticket; 1.18.0: email e allegati; 1.19.0: pallino non letti e pagina Contattaci; 1.20.0: risposte rapide e avviso di ritardo; 1.21.0: statistiche e ricerca; 1.22.0: privacy/GDPR, risposta ai messaggi Contattaci, ricerca per azienda, andamento e statistiche per agente, test in browser reale). Analisi legale: `docs/SUPPORTO_LEGALE.md`.

## Cosa c'è
- **Cliente** (`/app/support`, voce «Supporto» nel menu Account): apre un ticket (categoria, oggetto, messaggio), vede lo storico, risponde, chiude, valuta (1–5) a ticket risolto. Le risposte del team arrivano come notifica nel campanello **e per email** (nella lingua dell'utente).
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
| Email | Una sola email per «turno»: i messaggi di follow-up del cliente prima della risposta del team restano solo in-app. L'email contiene numero e oggetto del ticket e un link, **mai il testo del messaggio**; si può spegnere dalle preferenze notifiche (tipo «system»). Il link è accettato solo se è un percorso interno `/app/...` |
| Allegati | Fino a 3 file per messaggio, 8 MB, solo PNG/JPG/WebP/PDF. Il server **legge i byte** (non si fida del tipo dichiarato dal browser): un file finto (HTML rinominato .png, eseguibile, HEIC, PDF con script) viene cancellato dallo storage. Il tipo è quello rilevato dai byte; il nome file è ripulito; i file non inviati (in attesa) si cancellano dopo 24 h; un file può essere usato solo dall'utente che l'ha caricato e una volta sola; il download usa un link breve generato al momento, con le stesse regole di visibilità del ticket, e viene registrato nell'audit |
| Pagina pubblica «Contattaci» (`/auth/contact`) | Per chi non riesce ad accedere. Passa dal server (non scrive direttamente nel database): corpo max 16 KB, campo trappola anti-bot (finta conferma), verifica Turnstile quando configurata, limiti 3/ora per indirizzo, 3/giorno per email, 100/ora globali. Nessun account ⇒ nessun ticket: i messaggi finiscono in una casella separata solo per admin (`/app/admin/support/contacts`), con avviso email agli admin (senza il testo). Si risponde dal proprio programma di posta. Minimizzazione dati: gestiti cancellati dopo 90 giorni, tutti dopo 1 anno |
| Risposte rapide | Modelli di testo condivisi dal team, solo per admin piattaforma (max 100, titolo 2–60, testo 3–4000 come ogni messaggio). Il modello viene solo *inserito* nella casella di risposta: lo staff lo rilegge e lo modifica prima di inviare. Gestione in `/app/admin/support/replies` |
| Avviso di ritardo (SLA) | Ogni 30 minuti un controllo cerca i ticket ancora «da gestire», senza prima risposta, oltre l'obiettivo (4/8/24/72 h secondo la priorità). Avvisa **una sola volta** per ticket (notifica + email) la persona assegnata, o tutti gli admin se nessuno è assegnato; scrive nell'audit. Un ticket già risposto non avvisa mai |
| Ricerca e statistiche (solo admin) | Ricerca per numero (`TKT-0007` o `7`), parole dell'oggetto e parole di qualsiasi messaggio (indici di ricerca di Convex), max 25 risultati; le note interne non sono indicizzate. Filtro per categoria nella coda. Statistiche su 7/30/90 giorni: ticket aperti, risolti, prima risposta (mediana), % entro l'obiettivo, tempo di risoluzione (mediana), valutazione media, ripartizione per categoria e priorità; sui 1000 ticket più recenti del periodo (lo dice a schermo se si supera) |
| Crescita infinita dei dati | Messaggi in tabella figlia con tetto; cron di pulizia: ticket chiusi da > 730 giorni e ticket di aziende cancellate (con messaggi e note) |

## File
`convex/support.ts` (cliente) · `convex/supportAdmin.ts` (admin + cron) · `convex/lib/support.ts` (regole comuni) · `src/shared/support.ts` (costanti) · pagine in `src/app/[locale]/app/support` e `admin/support` · stringhe `support`, `supportAdmin`, `nav.support` in 6 lingue · codici errore `TICKET_*` in `src/lib/errors.ts`.

## Lacune (onesto) — cosa resta
| # | Lacuna | Priorità | Nota |
|---|---|---|---|
| 1 | **Antivirus dedicato sugli allegati**: oggi i file sono verificati sui byte (tipo reale, PDF senza script, dimensioni) ma non scansionati da un antivirus | Media | Richiede un servizio esterno a pagamento (es. ClamAV gestito) e una decisione tua; vedi `docs/SUPPORTO_LEGALE.md` §9.7 |
| 2 | **Revisione legale umana**: i testi privacy/termini/DPA e le scelte di conservazione sono state preparate con cura ma vanno validate da un avvocato (elenco in `docs/SUPPORTO_LEGALE.md` §9) | **Alta** | Prima del lancio commerciale |
| 3 | Verifica che il servizio email sia in modalità **live** e che il dominio mittente (SPF/DKIM/DMARC) sia a posto: senza, le email dei ticket non partono | Alta | Guida in `docs/RESEND_SPF_DKIM_DMARC_SETUP.md` |
| 4 | Il modulo pubblico «Contattaci» è provato in browser solo come pagina (non l'invio reale, che passa dal server Convex vero) | Media | Prova manuale dopo il deploy |
| 5 | Le statistiche coprono i 1000 ticket più recenti del periodo; nessun export CSV | Bassa | Da fare se i volumi crescono |
| 6 | Nessuna traduzione automatica dei messaggi e nessun assistente AI sui ticket (e se si aggiungesse: rifare la DPIA) | Bassa | — |

Chiuso nelle versioni 1.18–1.22: email, allegati, pallino non letti, pagina Contattaci (con risposta dalla piattaforma), risposte rapide, avviso di ritardo, statistiche (andamento giornaliero, per agente), ricerca (numero, oggetto, messaggi, azienda), filtro categoria, esportazione/cancellazione GDPR, testi legali aggiornati e sincronizzati con il sito, test in browser reale.
