# Registro delle attività di trattamento (art. 30 GDPR) — BOZZA

**Stato:** bozza interna del 2026-10-18, da far rivedere a un consulente privacy prima di considerarla definitiva.
**Fonte:** informativa privacy e cookie policy in vigore (`src/content/legal.ts`, `src/content/legal-values.ts`) e codice della piattaforma. Questo registro **non aggiunge** fatti nuovi: se un'informazione cambia, va aggiornata prima in `legal.ts` e poi qui.

Perché serve: l'esenzione dell'art. 30.5 (meno di 250 dipendenti) non si applica, perché i trattamenti di OneSpec non sono occasionali. Il registro va tenuto in forma scritta (anche elettronica) ed esibito all'autorità di controllo su richiesta (ANSPDCP, Romania, autorità capofila).

---

## Parte A — Titolare del trattamento (art. 30.1)

| Voce | Valore |
|---|---|
| Titolare | CORE829 SRL, Str. Mihai Eminescu 10, Roman, România — CUI/CIF RO54616345, Reg. com. J2026029428009 |
| Rappresentante legale | Stefan Serban, amministratore |
| Contatto privacy | hello@onespec.eu |
| Contatto legale | office@core829.net |
| DPO | Non nominato alla data di revisione |
| Rappresentante UE (art. 27) | Non necessario: il Titolare ha sede nell'UE |

### A1. Account utenti della piattaforma

| Voce | Contenuto |
|---|---|
| Finalità | Erogazione del servizio, gestione dell'account e dell'organizzazione |
| Base giuridica | Esecuzione del contratto (art. 6.1.b) |
| Interessati | Utenti registrati (titolari, amministratori e membri del team delle aziende clienti) |
| Categorie di dati | Nome, email, lingua, paese, data di nascita (solo per verificare la maggiore età), data di registrazione, stato di verifica email, dati dell'organizzazione (ragione sociale, P.IVA, indirizzo, telefono, email), segreto TOTP cifrato e hash dei codici di recupero se la verifica in due passaggi è attiva |
| Destinatari | Convex (database e backend), Resend (email transazionali), Vercel (hosting), Cloudflare Turnstile (anti-bot su accesso e registrazione) |
| Trasferimenti extra UE | Sì, Stati Uniti (Convex, Resend, Vercel, Cloudflare) — Clausole Contrattuali Standard |
| Conservazione | Per la durata del rapporto; cancellazione entro 30 giorni dalla richiesta |
| Misure di sicurezza | Vedi Parte C |

### A2. Abbonamenti, pagamenti e adempimenti fiscali

| Voce | Contenuto |
|---|---|
| Finalità | Gestione degli abbonamenti a pagamento, fatturazione, obblighi fiscali e contabili |
| Base giuridica | Esecuzione del contratto (art. 6.1.b); obbligo legale (art. 6.1.c) per i documenti fiscali |
| Interessati | Clienti paganti (persone di riferimento delle aziende) |
| Categorie di dati | Dati di fatturazione, piano, stato dell'abbonamento, identificativi Stripe. I dati della carta sono trattati solo da Stripe |
| Destinatari | Stripe Payments Europe, Ltd.; consulente contabile del Titolare |
| Trasferimenti extra UE | Secondo le condizioni di Stripe (SCC) |
| Conservazione | Documenti fiscali per il periodo previsto dalla normativa romena applicabile |

### A3. Programma inviti (referral)

| Voce | Contenuto |
|---|---|
| Finalità | Gestione degli inviti, dello sconto per l'invitato e del premio per chi invita (credito o pagamento via Stripe Connect), controlli anti-abuso |
| Base giuridica | Esecuzione del contratto / regolamento del programma (art. 6.1.b); legittimo interesse alla prevenzione delle frodi (art. 6.1.f) |
| Interessati | Utenti che invitano e aziende invitate |
| Categorie di dati | Codice invito, account collegati, stato della qualifica, importi, identificativi Stripe; nella pagina vengono mostrati solo dati mascherati |
| Destinatari | Stripe (credito, Connect) |
| Conservazione | Per la durata del programma e del rapporto, oltre agli obblighi fiscali sui pagamenti |

### A4. Assistenza: ticket e pagina «Contattaci»

| Voce | Contenuto |
|---|---|
| Finalità | Rispondere alle richieste di assistenza degli utenti e ai messaggi di chi non riesce ad accedere |
| Base giuridica | Esecuzione del contratto o misure precontrattuali (art. 6.1.b); legittimo interesse a rispondere alle richieste non contrattuali (art. 6.1.f) |
| Interessati | Utenti registrati; persone che scrivono da «Contattaci» |
| Categorie di dati | Oggetto, testo, allegati (immagini o PDF), categoria, stato, valutazione, risposte, note interne; per «Contattaci»: nome, email, messaggio, argomento, lingua, hash dell'IP |
| Destinatari | Convex (archiviazione, anche degli allegati), Resend (avvisi senza il testo dei messaggi); personale di supporto autorizzato e vincolato alla riservatezza |
| Conservazione | Ticket chiusi: 730 giorni dall'ultima attività; file mai inviati: 24 ore; «Contattaci»: 90 giorni dopo la gestione, al massimo 365 giorni |

### A5. Sicurezza, prevenzione degli abusi e registro attività

| Voce | Contenuto |
|---|---|
| Finalità | Sicurezza del servizio, limitazione della frequenza, anti-spam, audit delle operazioni sensibili, rilevamento errori |
| Base giuridica | Legittimo interesse (art. 6.1.f) |
| Interessati | Utenti; visitatori del widget e dei moduli pubblici |
| Categorie di dati | Hash dell'IP (l'IP in chiaro non è conservato), user agent, esito anti-bot, punteggio anti-spam, registro azioni (identificativi e tipo di azione, senza testo), segnalazioni di errore tecnico |
| Destinatari | Convex, Cloudflare Turnstile, Sentry (solo segnalazione errori; la registrazione visiva della sessione solo con consenso) |
| Conservazione | Per la durata di attività dell'organizzazione sulla piattaforma; eliminazione su richiesta (nessuna cancellazione automatica programmata al momento) |

### A6. Statistiche e analisi di prodotto (solo con consenso)

| Voce | Contenuto |
|---|---|
| Finalità | Statistiche di visita aggregate (sito e piattaforma), analisi di prodotto e registrazione della sessione per correggere malfunzionamenti |
| Base giuridica | Consenso (art. 6.1.a e art. 5.3 Direttiva ePrivacy), raccolto con il banner cookie e revocabile in ogni momento |
| Interessati | Visitatori del sito onespec.eu e utenti della piattaforma |
| Categorie di dati | Vercel Web Analytics: pagina senza parametri, paese, tipo di dispositivo e browser, senza cookie. PostHog e Sentry Session Replay: click, scroll e navigazione, con i valori dei campi oscurati |
| Destinatari | Vercel, Inc.; PostHog Inc.; Functional Software, Inc. (Sentry) |
| Trasferimenti extra UE | Sì, Stati Uniti — Clausole Contrattuali Standard |
| Conservazione | Secondo le impostazioni dei fornitori; la scelta del visitatore resta nel suo browser |

### A7. Comunicazioni sul prodotto e commerciali

| Voce | Contenuto |
|---|---|
| Finalità | Invio di novità sul prodotto e comunicazioni commerciali |
| Base giuridica | Consenso (art. 6.1.a), revocabile dalla pagina Account |
| Interessati | Utenti registrati che hanno dato il consenso |
| Categorie di dati | Nome, email, lingua, stato del consenso |
| Destinatari | Resend |
| Conservazione | Fino alla revoca del consenso o alla chiusura dell'account |

---

## Parte B — Responsabile del trattamento per conto dei clienti (art. 30.2)

OneSpec tratta dati personali **per conto** delle aziende clienti (serramentisti, rivenditori), che ne restano Titolari, secondo l'accordo sul trattamento dei dati (DPA) firmato alla registrazione.

| Voce | Contenuto |
|---|---|
| Responsabile | CORE829 SRL (dati in Parte A) |
| Titolari per conto dei quali si tratta | Ciascuna azienda cliente registrata sulla piattaforma (elenco ricavabile dalla tabella delle organizzazioni) |
| Categorie di trattamenti | Raccolta delle richieste di preventivo dal widget; gestione di clienti, cantieri, lead importati, preventivi, rilievi, posa, collaudi, forniture e logistica; generazione di PDF e firme; invio delle email di notifica; archiviazione dei documenti caricati |
| Interessati | Clienti finali e potenziali clienti delle aziende; loro referenti; membri del team delle aziende |
| Categorie di dati | Nome, email, telefono, azienda, indirizzo del cantiere, messaggio, configurazione tecnica e prezzo, firme grafiche, documenti caricati (es. preventivi finali in PDF) |
| Sub-responsabili | Convex, Resend, Cloudflare Turnstile, Vercel, Sentry (vedi elenco nell'informativa privacy) |
| Trasferimenti extra UE | Sì, Stati Uniti — Clausole Contrattuali Standard |
| Conservazione | Per la durata del contratto con l'azienda cliente; cancellazione o esportazione su sua istruzione |
| Misure di sicurezza | Vedi Parte C |

---

## Parte C — Misure tecniche e organizzative (art. 32), sintesi

Dettaglio in `docs/SICUREZZA.md`, `docs/OWASP_TOP10_2025.md` e `docs/PROCEDURA_INCIDENTI.md`.

- Comunicazioni solo su TLS; dati a riposo cifrati dai fornitori di infrastruttura (AES-256).
- Isolamento dei dati per organizzazione e controllo dei permessi lato server su ogni funzione.
- Verifica in due passaggi facoltativa (TOTP) e blocco dei tentativi.
- IP conservato solo come hash con salt; limitazione della frequenza; verifica anti-bot sui moduli pubblici.
- Allegati controllati prima della pubblicazione (firme e struttura dei file) e firmati per l'integrità; download protetti.
- Webhook in ingresso verificati con firma e marca temporale.
- Registro delle operazioni sensibili; avvisi automatici sugli errori in produzione.
- Personale di supporto autorizzato e vincolato alla riservatezza (`docs/MODELLO_IMPEGNO_RISERVATEZZA.md`).
- Procedura per le violazioni di dati: comunicazione al cliente entro 72 ore dalla scoperta.

---

## Da completare prima della versione definitiva

1. Verifica del consulente privacy su basi giuridiche e tempi di conservazione.
2. Tempi di conservazione di PostHog, Sentry e Vercel come configurati negli account reali dei fornitori.
3. Data e riferimento dei DPA firmati con ciascun fornitore (Convex, Stripe, Resend, Cloudflare, Vercel, PostHog, Sentry).
4. Nome del consulente contabile, se riceve dati personali.
5. Revisione almeno annuale o a ogni nuovo fornitore o nuova funzione che tratta dati personali.
