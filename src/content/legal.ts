/**
 * Legal register for OneSpec.
 *
 * These texts describe ONLY treatments that are actually implemented in this
 * repository (Convex backend, Resend email, Cloudflare Turnstile, Vercel
 * hosting, hashed widget IPs). Anything that depends on the operating company's
 * real-world identity or commercial terms is left as an explicit `[[…]]`
 * placeholder — never invented. Fill the placeholders before publishing.
 *
 * `[[text]]` in any paragraph renders as a visible "to complete" chip.
 */

export interface LegalSection {
  h: string;
  p: string[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  /** ISO date the wording was last revised in the repo. */
  updated: string;
  summary: string;
  sections: LegalSection[];
}

const IDENTITY_INTRO: LegalSection = {
  h: "Titolare del trattamento",
  p: [
    "Il servizio OneSpec è gestito da [[ragione sociale]], con sede legale in [[indirizzo completo]], [[P.IVA / codice fiscale]], PEC [[indirizzo PEC]].",
    "Per qualsiasi richiesta relativa ai dati personali è possibile scrivere a [[email di contatto privacy]]. Un Responsabile della protezione dei dati (DPO) [[è / non è]] stato nominato; recapiti del DPO: [[recapiti DPO oppure «non applicabile»]].",
  ],
};

const SUBPROCESSORS: LegalSection = {
  h: "Fornitori e sub-responsabili",
  p: [
    "OneSpec si appoggia ai seguenti fornitori, che trattano dati per conto del Titolare sulla base di accordi ai sensi dell'art. 28 GDPR:",
    "• Convex (Convex, Inc.) — database e backend applicativo. Ubicazione dei dati: [[regione di hosting Convex]].",
    "• Resend (Resend, Inc.) — invio delle email transazionali (codici di verifica, notifiche di preventivo).",
    "• Cloudflare Turnstile (Cloudflare, Inc.) — verifica anti-bot sull'invio dei preventivi dal widget.",
    "• Vercel (Vercel, Inc.) — hosting dell'applicazione web e misurazione delle prestazioni (Speed Insights, senza cookie).",
    "Eventuali trasferimenti verso paesi terzi avvengono sulla base delle Clausole Contrattuali Standard della Commissione Europea. L'elenco aggiornato dei sub-responsabili con i relativi dettagli è disponibile su richiesta a [[email di contatto privacy]].",
  ],
};

const RIGHTS: LegalSection = {
  h: "Diritti dell'interessato",
  p: [
    "In qualità di interessato puoi esercitare i diritti previsti dagli artt. 15–22 GDPR: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso.",
    "Accesso e portabilità: dalla pagina Account puoi scaricare in qualsiasi momento una copia dei tuoi dati in formato JSON.",
    "Cancellazione: dalla pagina Account puoi richiedere l'eliminazione dell'account; la richiesta viene eseguita dopo un periodo di ripensamento di 30 giorni, salvo obblighi di conservazione.",
    "Reclamo: puoi rivolgerti all'autorità di controllo competente (per l'Italia, il Garante per la protezione dei dati personali) se ritieni che il trattamento violi la normativa.",
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Informativa sulla privacy",
    updated: "2026-09-02",
    summary: "Quali dati personali trattiamo, perché e per quanto tempo.",
    sections: [
      IDENTITY_INTRO,
      {
        h: "Dati trattati",
        p: [
          "Account: nome, indirizzo email, lingua preferita, data di registrazione, stato di verifica dell'email.",
          "Organizzazione: ragione sociale, P.IVA, indirizzo, telefono ed email inseriti dall'utente nelle impostazioni di branding.",
          "Richieste di preventivo generate dal widget: nome, email, telefono, azienda e messaggio del potenziale cliente, insieme alla configurazione tecnica scelta e al prezzo indicativo calcolato.",
          "Dati tecnici del widget: hash dell'indirizzo IP (l'IP in chiaro non viene conservato), user agent, esito della verifica anti-bot, punteggio anti-spam.",
          "Registro attività (audit log) delle azioni amministrative e delle operazioni sensibili.",
        ],
      },
      {
        h: "Finalità e basi giuridiche",
        p: [
          "Erogazione del servizio e gestione dell'account — esecuzione del contratto (art. 6.1.b GDPR).",
          "Sicurezza, prevenzione degli abusi, limitazione della frequenza e audit — legittimo interesse (art. 6.1.f).",
          "Invio di comunicazioni sul prodotto e commerciali — consenso (art. 6.1.a), revocabile dalla pagina Account.",
          "Adempimenti fiscali e contabili relativi agli abbonamenti a pagamento — obbligo legale (art. 6.1.c).",
        ],
      },
      {
        h: "Conservazione",
        p: [
          "Dati dell'account: per tutta la durata del rapporto e cancellati entro [[numero]] giorni dalla chiusura dell'account, salvo la richiesta di cancellazione anticipata.",
          "Richieste di preventivo: conservate finché l'organizzazione è attiva e comunque non oltre [[periodo di conservazione]].",
          "Registro attività e log di sicurezza: [[periodo di conservazione]].",
          "Documenti fiscali: per il periodo previsto dalla legge ([[riferimento normativo]]).",
        ],
      },
      SUBPROCESSORS,
      RIGHTS,
      {
        h: "Modifiche",
        p: [
          "Eventuali aggiornamenti dell'informativa sono pubblicati su questa pagina con la nuova data di revisione. Le modifiche sostanziali sono comunicate anche via email agli utenti registrati.",
        ],
      },
    ],
  },
  {
    slug: "termini-di-servizio",
    title: "Termini di servizio",
    updated: "2026-09-02",
    summary: "Le condizioni contrattuali tra OneSpec e l'organizzazione cliente.",
    sections: [
      {
        h: "Oggetto",
        p: [
          "I presenti Termini regolano l'uso della piattaforma OneSpec da parte dell'organizzazione cliente («Cliente») e delle persone da essa autorizzate.",
          "Il fornitore del servizio è [[ragione sociale]] («OneSpec»).",
        ],
      },
      {
        h: "Account e programma Alpha",
        p: [
          "L'accesso richiede la creazione di un account e la verifica dell'indirizzo email.",
          "Il programma Alpha è riservato alle prime 250 organizzazioni registrate e attribuisce lo stato di «Alpha Member» con uno sconto del 15% bloccato sui piani a pagamento, alle condizioni indicate al momento dell'adesione. Esauriti i posti, le nuove registrazioni non-Alpha restano sospese fino a diversa decisione di OneSpec.",
        ],
      },
      {
        h: "Piani e corrispettivi",
        p: [
          "I piani, i limiti e i prezzi in vigore sono quelli pubblicati nella pagina dei prezzi al momento della sottoscrizione.",
          "Condizioni economiche di dettaglio, fatturazione, imposte applicabili e modalità di pagamento: [[da completare con i termini economici definitivi]].",
          "Il mancato pagamento può comportare la sospensione dell'accesso previa comunicazione.",
        ],
      },
      {
        h: "Uso accettabile",
        p: [
          "Il Cliente si impegna a non utilizzare il servizio per attività illecite, a non tentare di aggirare i limiti tecnici o di sicurezza e a non caricare contenuti di cui non detiene i diritti.",
          "Il Cliente è responsabile dei contenuti, dei listini e dei dati che inserisce e della loro conformità alle normative applicabili.",
        ],
      },
      {
        h: "Prezzi indicativi del configuratore",
        p: [
          "I prezzi mostrati dal widget sono stime orientative calcolate sui listini forniti dal Cliente e non costituiscono un'offerta contrattuale verso il consumatore finale, salvo diversa impostazione consentita dai regolamenti locali.",
        ],
      },
      {
        h: "Limitazione di responsabilità",
        p: [
          "Il servizio è fornito «così com'è». Nei limiti consentiti dalla legge, la responsabilità di OneSpec è limitata a [[massimale di responsabilità / riferimento al corrispettivo]].",
          "Restano impregiudicati i diritti inderogabili del Cliente consumatore, ove applicabili.",
        ],
      },
      {
        h: "Durata, recesso e legge applicabile",
        p: [
          "Il contratto ha durata pari al periodo di abbonamento e si rinnova salvo disdetta.",
          "Il rapporto è regolato dalla legge [[legge applicabile]]. Foro competente: [[foro / tribunale]].",
        ],
      },
    ],
  },
  {
    slug: "termini-di-utilizzo",
    title: "Termini di utilizzo",
    updated: "2026-09-02",
    summary: "Regole d'uso dell'applicazione web e del widget incorporabile.",
    sections: [
      {
        h: "Utenti autorizzati",
        p: [
          "L'accesso all'area riservata è consentito alle sole persone autorizzate dall'organizzazione, ciascuna con credenziali personali e ruolo assegnato.",
          "L'utente è tenuto a custodire le proprie credenziali e a segnalare tempestivamente ogni accesso non autorizzato.",
        ],
      },
      {
        h: "Widget incorporabile",
        p: [
          "Il widget può essere incorporato esclusivamente nei domini indicati nella configurazione. L'incorporamento è controllato tramite intestazioni di sicurezza (Content-Security-Policy con elenco dei domini autorizzati).",
          "È vietato modificare, offuscare o reimpacchettare il widget o utilizzarlo per raccogliere dati con finalità diverse dalla richiesta di preventivo.",
        ],
      },
      {
        h: "Disponibilità e manutenzione",
        p: [
          "OneSpec può sospendere temporaneamente il servizio per manutenzione o ragioni di sicurezza, riducendo per quanto possibile i disagi.",
          "Livelli di servizio (SLA) specifici: [[da definire per il piano Enterprise]].",
        ],
      },
      {
        h: "Proprietà intellettuale",
        p: [
          "Il software, l'interfaccia e la documentazione di OneSpec restano di proprietà di [[ragione sociale]]. I dati, i listini e i marchi del Cliente restano di proprietà del Cliente.",
        ],
      },
    ],
  },
  {
    slug: "cookie",
    title: "Cookie e tecnologie simili",
    updated: "2026-09-02",
    summary: "Quali cookie e archiviazioni locali utilizza l'applicazione.",
    sections: [
      {
        h: "Cookie tecnici essenziali",
        p: [
          "L'autenticazione utilizza un cookie di sessione necessario al funzionamento dell'area riservata. Senza questo cookie non è possibile effettuare l'accesso. Non richiede consenso.",
        ],
      },
      {
        h: "Archiviazione locale funzionale",
        p: [
          "La preferenza di tema (chiaro/scuro) è salvata nel browser tramite localStorage con la chiave «onespec-theme». È un dato tecnico che non lascia il dispositivo.",
        ],
      },
      {
        h: "Misurazione delle prestazioni",
        p: [
          "Le prestazioni delle pagine sono misurate tramite Vercel Speed Insights, che non utilizza cookie e non traccia i singoli utenti.",
        ],
      },
      {
        h: "Assenza di cookie di profilazione",
        p: [
          "Non sono utilizzati cookie di profilazione o pubblicitari di terze parti. Per questo motivo non è presente un banner di consenso ai cookie: se in futuro verranno introdotti strumenti non essenziali, sarà richiesto il consenso preventivo, gestito separatamente dall'accesso.",
        ],
      },
    ],
  },
  {
    slug: "gdpr",
    title: "Diritti degli interessati (GDPR)",
    updated: "2026-09-02",
    summary: "Come esercitare accesso, portabilità, rettifica, cancellazione e opposizione.",
    sections: [
      IDENTITY_INTRO,
      RIGHTS,
      {
        h: "Come esercitare i diritti",
        p: [
          "Dalla pagina Account: esportazione dati (JSON), aggiornamento del profilo, gestione dei consensi, richiesta di cancellazione.",
          "Via email a [[email di contatto privacy]] per richieste che non è possibile evadere in autonomia. Rispondiamo entro un mese, prorogabile di due mesi per richieste complesse.",
        ],
      },
      {
        h: "Trattamenti automatizzati",
        p: [
          "Il calcolo del prezzo indicativo e i controlli anti-abuso (limitazione della frequenza, verifica anti-bot, punteggio anti-spam) sono automatizzati ma non producono effetti giuridici sull'interessato. Le decisioni commerciali sulla richiesta restano in capo all'organizzazione.",
        ],
      },
    ],
  },
  {
    slug: "sicurezza",
    title: "Sicurezza e controlli",
    updated: "2026-09-02",
    summary: "Le misure tecniche e organizzative effettivamente adottate.",
    sections: [
      {
        h: "Protezione dei dati in transito e a riposo",
        p: [
          "Tutte le comunicazioni avvengono su TLS. I dati a riposo sono cifrati dai fornitori di infrastruttura (Convex, Vercel).",
          "Dettagli sulle chiavi e sulla gestione della cifratura a riposo: [[da completare con la documentazione del fornitore]].",
        ],
      },
      {
        h: "Controllo degli accessi",
        p: [
          "Accesso basato su ruoli (titolare, amministratore, membro) con verifica lato server su ogni operazione. Ogni record sensibile è associato all'organizzazione e le query sono isolate per organizzazione.",
          "Un unico super-amministratore di piattaforma è definito tramite lista di indirizzi email in variabile d'ambiente.",
          "Gestione delle sessioni con possibilità di revoca dei singoli dispositivi e disconnessione da tutti i dispositivi.",
        ],
      },
      {
        h: "Segreti e configurazione",
        p: [
          "Le chiavi e i segreti sono gestiti tramite variabili d'ambiente della piattaforma di deployment e non sono presenti nel codice, nei log o nelle risposte di errore.",
        ],
      },
      {
        h: "Intestazioni di sicurezza",
        p: [
          "L'applicazione applica HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy e una Content-Security-Policy che vieta l'incorporamento dell'area riservata. Il widget usa una CSP dedicata con elenco dei domini autorizzati per organizzazione.",
        ],
      },
      {
        h: "Limitazione della frequenza e anti-abuso",
        p: [
          "Limiti applicati a: accesso, invio di preventivi dal widget (per IP e per configuratore), esportazioni dati. Verifica anti-bot Cloudflare Turnstile sugli invii del widget.",
        ],
      },
      {
        h: "Registro attività",
        p: [
          "Le azioni amministrative e le operazioni sensibili (pubblicazione cataloghi, cambi di stato, esportazioni, richieste di cancellazione) sono registrate con attore, oggetto e momento.",
        ],
      },
      {
        h: "Backup e continuità",
        p: [
          "I backup e il ripristino sono gestiti dal fornitore del database. Politica di backup, obiettivi RPO/RTO e test di ripristino periodici: [[da completare e verificare con Convex]].",
        ],
      },
      {
        h: "Gestione delle vulnerabilità e risposta agli incidenti",
        p: [
          "Scansione delle dipendenze e dei segreti, aggiornamenti e revisione di sicurezza prima dei rilasci.",
          "Runbook di risposta agli incidenti e tempi di notifica: [[da completare]].",
          "Per segnalazioni di sicurezza: [[email di contatto sicurezza]].",
        ],
      },
    ],
  },
  {
    slug: "qualita",
    title: "Qualità e certificazioni",
    updated: "2026-09-02",
    summary: "Registro delle certificazioni e degli attestati effettivamente posseduti.",
    sections: [
      {
        h: "Stato",
        p: [
          "Alla data di revisione, OneSpec non dichiara certificazioni di terze parti (ad esempio ISO/IEC 27001) se non elencate esplicitamente qui sotto. Nessuna certificazione viene affermata senza attestato verificabile.",
        ],
      },
      {
        h: "Certificazioni e attestati posseduti",
        p: [
          "[[elenco delle certificazioni con ente, numero e data di validità — lasciare vuoto se nessuna]].",
        ],
      },
      {
        h: "Conformità normativa dei prezzi per regione",
        p: [
          "Le regole regionali sulla comunicazione dei prezzi al consumatore (modalità «generazione di contatti / fascia indicativa» per IT/FR/BE/DE/LU, modalità con prezzi più trasparenti per NL sui piani ammessi) sono gestite come regole configurabili con data di validità e fonte.",
          "Riferimenti normativi puntuali e date di aggiornamento: [[da completare a cura del responsabile compliance]].",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
