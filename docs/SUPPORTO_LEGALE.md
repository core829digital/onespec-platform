# Sistema di supporto — analisi legale e privacy (documento di lavoro)

Redatto il 12 ottobre 2026 per CORE829 SRL (titolare del servizio OneSpec). Versione piattaforma 1.22.0.

> **Avvertenza onesta.** Questo è un documento di lavoro preparato da un assistente software sulla base del testo del GDPR, delle linee guida pubbliche delle autorità europee e della prassi corrente. **Non sostituisce il parere di un avvocato abilitato** (idealmente uno esperto di diritto rumeno e italiano della protezione dei dati). Ogni punto della sezione 9 è indicato come «da validare». Tutto ciò che dichiara l'informativa è stato verificato contro il codice con un test automatico (`tests/legal-support-guard.test.ts`).

## 1. Che cosa tratta il sistema di supporto

| Dato | Dove | Chi lo vede |
|---|---|---|
| Oggetto, testo, categoria, stato, valutazione 1–5 del ticket | `supportTickets`, `supportMessages` | Chi ha aperto il ticket, owner/admin della stessa azienda, personale OneSpec autorizzato |
| Allegati (PNG/JPG/WebP/PDF) | archivio file Convex + `supportAttachments` | Come sopra; ogni apertura da parte del personale è nell'audit |
| Note interne del team | `supportInternalNotes` | Solo personale OneSpec |
| Messaggi della pagina «Contattaci» (nome, email, messaggio, argomento, lingua, **hash** dell'IP) | `supportContacts` | Solo personale OneSpec |
| Email di servizio sui ticket | Resend + `emailLog` (anteprima) | Destinatario |
| Notifiche in app | `notifications` | Destinatario |
| Registro attività (id, azione, senza testo) | `auditLog` | Personale OneSpec |

## 2. Ruoli (art. 4, 24, 28 GDPR)
- **CORE829 SRL è Titolare** dei dati di contatto della persona che scrive, del contenuto dei ticket sull'uso del servizio e dei messaggi «Contattaci».
- **Responsabile (art. 28) per conto del Cliente** quando il ticket contiene dati personali dei clienti finali del Cliente (es. un preventivo con nome di un suo cliente). Questo scenario è coperto dal DPA già in vigore (`src/shared/dpa.ts`: punto 3.2 cita già il personale di supporto vincolato alla riservatezza; punto 3.5 l'assistenza ai diritti degli interessati). **Non è stato modificato il DPA**, per non costringere tutti i clienti a riaccettarlo.
- Mitigazione: l'interfaccia e le informative invitano a non inserire dati non necessari; è vietato inviare password, codici, dati di carte e categorie particolari (art. 9).
- **Sub-responsabili** (già in informativa): Convex (database e **archiviazione degli allegati**), Resend (email), Cloudflare Turnstile (anti-bot, ora anche su «Contattaci»), Vercel (hosting). Trasferimento extra-UE (Convex, regione USA): Clausole Contrattuali Standard già richiamate nell'informativa.

## 3. Basi giuridiche (art. 6)
| Trattamento | Base |
|---|---|
| Ticket di un cliente | Esecuzione del contratto — 6.1.b |
| «Contattaci» da chi non ha account | Misure precontrattuali/contrattuali su richiesta dell'interessato — 6.1.b; per richieste non contrattuali, legittimo interesse a rispondere — 6.1.f |
| Limiti di frequenza, hash IP, honeypot, Turnstile, audit | Legittimo interesse alla sicurezza — 6.1.f (vedi bilanciamento al punto 6) |
| Email sui ticket | Comunicazione di servizio (non marketing): non serve il consenso ePrivacy; sono disattivabili dalle preferenze. **Nessun contenuto promozionale** nelle email di supporto |

## 4. Conservazione (art. 5.1.e) — tutto automatico
| Dato | Periodo | Meccanismo |
|---|---|---|
| Ticket chiuso (messaggi, note, allegati) | 730 giorni dall'ultima attività | cron `support-purge` |
| Ticket risolto senza risposta | si chiude dopo 7 giorni | cron `support-auto-close` |
| Allegato caricato ma non inviato | 24 ore | cron `support-purge-pending-files` |
| «Contattaci» gestito | 90 giorni | cron `support-purge-contacts` |
| «Contattaci» qualunque | 365 giorni | idem |
| Notifiche in app | 365 giorni | cron esistente |
| Log delle email | 90 giorni | cron esistente |
| Ticket di aziende cancellate | alla prima esecuzione del cron | `support-purge` (orfani) |
| **Account cancellato (art. 17)** | ticket, messaggi, note, allegati e «Contattaci» con la sua email vengono **cancellati** al termine dei 30 giorni di ripensamento | `eraseUserSupportData` |

**Perché 24 mesi:** servono a gestire contestazioni sull'assistenza e a difendere un diritto in giudizio (art. 17.3.e), restando ben sotto il termine generale di prescrizione di 3 anni del diritto rumeno. È una scelta di proporzionalità: se il consulente preferisce 12 mesi basta cambiare `retentionDays` in `src/shared/support.ts` e l'informativa (il test di coerenza fallirà finché i due non coincidono).

## 5. Diritti dell'interessato (artt. 15–22)
- **Accesso e portabilità (15, 20):** l'esportazione JSON dall'Account include ora i ticket (testo proprio e risposte del team, nomi file degli allegati, senza identificativi interni) e i messaggi «Contattaci» con la stessa email. I file allegati restano scaricabili dal ticket finché esiste.
- **Note interne:** escluse dall'export automatico; fornite su richiesta a `hello@onespec.eu` nei limiti di legge (art. 15.4: non ledere diritti altrui; possibili limiti nazionali ex art. 23). Scelta prudente: le note possono contenere valutazioni su terzi o elementi utili alla difesa.
- **Cancellazione (17):** vedi tabella. Il registro attività conserva solo identificativi e tipo di azione (interesse legittimo/sicurezza), senza testo.
- **Rettifica (16), limitazione (18), opposizione (21):** per richiesta email; il testo dei messaggi non è modificabile dall'utente dopo l'invio (è una registrazione della comunicazione) ma può essere cancellato dal supporto su richiesta.
- **Reclamo (77):** l'informativa ora indica come autorità capofila la **ANSPDCP** (Romania, sede del titolare) oltre al Garante italiano (correzione: prima indicava solo il Garante).
- **Termini di risposta:** un mese, prorogabile (già in informativa GDPR).

## 6. Bilanciamento del legittimo interesse (LIA) — sicurezza della pagina «Contattaci»
- *Interesse:* evitare che un modulo pubblico diventi un canale di spam/abuso o di invio di email indesiderate agli admin.
- *Necessità:* limiti per IP/email/globali; hash dell'IP (non l'IP in chiaro); honeypot; Turnstile. Nessun profilo, nessun tracciamento pubblicitario.
- *Impatto sull'interessato:* minimo (hash non reversibile in pratica con sale/pepper del server; conservato al massimo 365 giorni e solo con il messaggio). Aspettativa ragionevole: chi scrive a un fornitore si attende controlli anti-abuso.
- *Esito:* prevalente l'interesse del titolare; opposizione sempre possibile.

## 7. Registro dei trattamenti (art. 30) — voce da aggiungere al registro aziendale
- **Trattamento:** Assistenza clienti (ticket e «Contattaci»).
- **Titolare:** CORE829 SRL, Str. Mihai Eminescu 10, Roman (RO), CUI RO54616345. DPO: non nominato.
- **Finalità:** gestire richieste di assistenza; sicurezza.
- **Interessati:** utenti dei clienti OneSpec; persone che scrivono da «Contattaci».
- **Categorie di dati:** identificativi e contatto, contenuto delle comunicazioni, allegati, valutazione, hash IP, log di azione. Nessuna categoria particolare richiesta.
- **Destinatari:** personale autorizzato; sub-responsabili Convex, Resend, Cloudflare, Vercel.
- **Trasferimenti extra-UE:** USA (Convex) con CCS.
- **Termini di cancellazione:** punto 4.
- **Misure di sicurezza:** accesso per ruolo (IDOR testato), note interne in tabella separata, upload verificati sui byte, link di download temporanei, audit, limiti di frequenza, cifratura a riposo del fornitore, nessun testo dei messaggi nelle email.

## 8. DPIA (art. 35) — valutazione preliminare
Non richiesta: nessun trattamento su larga scala di categorie particolari, nessun monitoraggio sistematico, nessuna profilazione con effetti giuridici. Rivalutare se si aggiungessero registrazioni di chiamate, analisi automatica dei messaggi o assistenti AI sui ticket.

## 9. Da validare con un avvocato / consulente (non risolvibile dal codice)
1. **Periodo di 24 mesi** per i ticket chiusi e coerenza con la prassi del consulente.
2. **Ruolo di CORE829 sui dati dei clienti finali nei ticket** (Titolare vs Responsabile) e se il DPA vada integrato con un cenno esplicito all'assistenza (oggi non è stato toccato per non forzare la riaccettazione).
3. **Contratti sub-responsabili:** verificare di avere firmato/accettato i DPA di Convex, Resend, Cloudflare, Vercel (di norma sono clic-accept nei termini dei fornitori) e conservarne copia.
4. **Trasferimenti USA:** controllare che i fornitori siano certificati EU-US Data Privacy Framework o che le CCS siano effettivamente in vigore, e documentare il *transfer impact assessment*.
5. **Note interne e accesso (art. 15.4):** conferma dell'approccio «su richiesta».
6. **Consumatori:** il servizio è B2B; se mai si aprisse a consumatori, rivedere termini di assistenza e informative.
7. **Allegati:** scansione interna + firma HMAC + download firmato introdotti (non è un motore commerciale); vedi `docs/REVISIONE_LEGALE_2026-10.md`.
8. **Lingue:** i testi legali sono redatti in italiano; per clienti non italiani valutare le traduzioni giurate/di cortesia.
9. **Nomina e formazione del personale di supporto** (impegno di riservatezza scritto, DPA punto 3.2): predisporre il modulo interno.

> Stato dei punti 1–9: risolti o assegnati in `docs/REVISIONE_LEGALE_2026-10.md`.

## 10. Cosa è stato modificato nei testi pubblici (12/10/2026)
Informativa privacy (dati, basi, conservazione, nuova sezione «Assistenza e ticket: chi vede cosa», sub-responsabili, reclamo), Diritti GDPR, Termini di servizio (nuova sezione «Assistenza», con precisazione che i tempi sono obiettivi e non SLA), Cookie (Turnstile). I testi sono sincronizzati con il sito (`npm run check:legal-sync`).
