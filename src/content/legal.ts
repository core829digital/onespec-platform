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
    "Il servizio OneSpec è gestito da [[ragione sociale]], con sede legale in [[indirizzo completo]], [[P.IVA / codice fiscale]], telefono [[telefono]], PEC [[indirizzo PEC]].",
    "Per qualsiasi richiesta relativa ai dati personali è possibile scrivere a [[email di contatto privacy]]. Un Responsabile della protezione dei dati (DPO) [[è / non è]] stato nominato; recapiti del DPO: [[recapiti DPO oppure «non applicabile»]].",
  ],
};

const SUBPROCESSORS: LegalSection = {
  h: "Fornitori e sub-responsabili",
  p: [
    "OneSpec si appoggia ai seguenti fornitori, che trattano dati per conto del Titolare sulla base di accordi ai sensi dell'art. 28 GDPR:",
    "• Convex (Convex, Inc.) — database, backend applicativo e archiviazione dei file allegati ai ticket di assistenza. Ubicazione dei dati: [[regione di hosting Convex]].",
    "• Stripe (Stripe Payments Europe, Ltd.) — gestione degli abbonamenti e dei pagamenti; i dati della carta sono trattati direttamente da Stripe e non transitano né sono conservati da OneSpec.",
    "• Resend (Resend, Inc.) — invio delle email transazionali (codici di verifica, notifiche di preventivo, avvisi sui ticket di assistenza; queste ultime non riportano il testo dei messaggi).",
    "• Cloudflare Turnstile (Cloudflare, Inc.) — verifica anti-bot sull'invio dei preventivi dal widget e sui moduli di accesso, registrazione, recupero password e «Contattaci».",
    "• Vercel (Vercel, Inc.) — hosting dell'applicazione web e misurazione delle prestazioni (Speed Insights, senza cookie).",
    "• PostHog (PostHog Inc.) — analisi di prodotto e registrazione della sessione (click, scroll, navigazione) per individuare e correggere malfunzionamenti; i valori digitati nei campi dei moduli restano oscurati. Attivo solo dopo il consenso esplicito tramite il banner cookie.",
    "• Sentry (Functional Software, Inc.) — rilevamento errori tecnici; la registrazione visiva della sessione (Session Replay) è attiva solo dopo lo stesso consenso, la sola segnalazione degli errori resta sempre attiva per garantire la sicurezza e la stabilità del servizio.",
    "Eventuali trasferimenti verso paesi terzi avvengono sulla base delle Clausole Contrattuali Standard della Commissione Europea. L'elenco aggiornato dei sub-responsabili con i relativi dettagli è disponibile su richiesta a [[email di contatto privacy]].",
  ],
};

const LEGAL_CONTACT: LegalSection = {
  h: "Contatti per questioni legali e contrattuali",
  p: [
    "Per questioni contrattuali, contestazioni o comunicazioni legali relative al presente documento: [[email di contatto legale]].",
  ],
};

const RIGHTS: LegalSection = {
  h: "Diritti dell'interessato",
  p: [
    "In qualità di interessato puoi esercitare i diritti previsti dagli artt. 15–22 GDPR: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso.",
    "Accesso e portabilità: dalla pagina Account puoi scaricare in qualsiasi momento una copia dei tuoi dati in formato JSON; l'esportazione comprende anche i ticket di assistenza che hai aperto (con le risposte del nostro team e i nomi dei file allegati) e i messaggi inviati dalla pagina «Contattaci» con il tuo indirizzo email. L'esportazione comprende anche le note interne di lavorazione dei tuoi ticket, nei limiti previsti dalla legge (sono escluse le informazioni che riguardano altre persone o che violerebbero diritti altrui). I dati tecnici di sicurezza (ad esempio l'indirizzo IP conservato solo in forma di hash) sono dati personali pseudonimizzati e possono essere richiesti a [[email di contatto privacy]].",
    "Cancellazione: dalla pagina Account puoi richiedere l'eliminazione dell'account; la richiesta viene eseguita dopo un periodo di ripensamento di 30 giorni, salvo obblighi di conservazione. Con l'account vengono eliminati anche i ticket di assistenza che hai aperto, i relativi messaggi, note interne e allegati, e i messaggi inviati dalla pagina «Contattaci» con la tua email.",
    "Reclamo: puoi proporre reclamo all'autorità di controllo se ritieni che il trattamento violi la normativa. Poiché il Titolare ha sede in Romania, l'autorità capofila è l'Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP, dataprotection.ro); puoi in ogni caso rivolgerti all'autorità del paese in cui risiedi o lavori (per l'Italia, il Garante per la protezione dei dati personali).",
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Informativa sulla privacy",
    updated: "2026-10-12",
    summary: "Quali dati personali trattiamo, perché e per quanto tempo.",
    sections: [
      IDENTITY_INTRO,
      {
        h: "Dati trattati",
        p: [
          "Account: nome, indirizzo email, lingua preferita, data di registrazione, stato di verifica dell'email.",
          "Verifica in due passaggi (facoltativa): se la attivi conserviamo il segreto dell'app di autenticazione in forma cifrata, l'impronta (hash) dei codici di recupero e il numero di tentativi errati; non conserviamo i codici monouso generati dalla tua app.",
          "Organizzazione: ragione sociale, P.IVA, indirizzo, telefono ed email inseriti dall'utente nelle impostazioni di branding.",
          "Richieste di preventivo generate dal widget: nome, email, telefono, azienda e messaggio del potenziale cliente, insieme alla configurazione tecnica scelta e al prezzo indicativo calcolato.",
          "Dati tecnici del widget: hash dell'indirizzo IP (l'IP in chiaro non viene conservato), user agent, esito della verifica anti-bot, punteggio anti-spam.",
          "Assistenza: oggetto, testo e allegati (immagini o PDF) dei ticket che apri dalla piattaforma, categoria, stato, eventuale valutazione da 1 a 5, le risposte del nostro team e le note interne di lavorazione (non visibili a te).",
          "Pagina «Contattaci» (per chi non riesce ad accedere): nome, indirizzo email e messaggio che inserisci, argomento scelto, lingua e hash dell'indirizzo IP (l'IP in chiaro non viene conservato) usato per limitare gli abusi.",
          "Registro attività (audit log) delle azioni amministrative e delle operazioni sensibili, comprese le azioni sui ticket (identificativi e tipo di azione, senza il testo dei messaggi).",
        ],
      },
      {
        h: "Finalità e basi giuridiche",
        p: [
          "Erogazione del servizio e gestione dell'account — esecuzione del contratto (art. 6.1.b GDPR).",
          "Assistenza tramite ticket — esecuzione del contratto (art. 6.1.b). Risposta ai messaggi inviati dalla pagina «Contattaci» da chi non ha un account — misure precontrattuali o contrattuali adottate su richiesta dell'interessato (art. 6.1.b) e, per le richieste non contrattuali, legittimo interesse a rispondere (art. 6.1.f).",
          "Sicurezza, prevenzione degli abusi, limitazione della frequenza e audit (anche sulla pagina «Contattaci» e sui ticket) — legittimo interesse (art. 6.1.f).",
          "Le email sui ticket (nuova risposta, ticket risolto) sono comunicazioni di servizio legate alla tua richiesta, non comunicazioni commerciali; puoi disattivarle dalle preferenze di notifica.",
          "Invio di comunicazioni sul prodotto e commerciali — consenso (art. 6.1.a), revocabile dalla pagina Account.",
          "Adempimenti fiscali e contabili relativi agli abbonamenti a pagamento — obbligo legale (art. 6.1.c).",
        ],
      },
      {
        h: "Conservazione",
        p: [
          "Dati dell'account: per tutta la durata del rapporto e cancellati entro [[numero]] giorni dalla richiesta di cancellazione.",
          "Richieste di preventivo, registro attività e log di sicurezza: conservati per tutta la durata di attività dell'organizzazione sulla piattaforma; non esiste al momento una cancellazione automatica programmata di questi dati, che vengono eliminati su richiesta secondo la procedura descritta nella sezione «Diritti dell'interessato».",
          "Ticket di assistenza: i ticket chiusi sono eliminati automaticamente con messaggi, note interne e allegati 730 giorni (24 mesi) dopo l'ultima attività; i ticket risolti senza ulteriori risposte si chiudono da soli dopo 7 giorni; i file caricati ma mai inviati sono eliminati dopo 24 ore. Questo periodo serve a gestire eventuali contestazioni sull'assistenza prestata e a difendere un diritto in giudizio.",
          "Messaggi della pagina «Contattaci»: eliminati 90 giorni dopo essere stati gestiti e in ogni caso entro 365 giorni dalla ricezione.",
          "Notifiche nell'applicazione: 365 giorni. Registro delle email di servizio inviate: 90 giorni.",
          "Alla cancellazione dell'account eliminiamo anche i ticket, i messaggi, le note interne e gli allegati che hai aperto e i messaggi «Contattaci» inviati con la tua email; nel registro attività restano soltanto identificativi e tipo di azione, senza testo.",
          "Documenti fiscali relativi ad abbonamenti a pagamento: per il periodo previsto dalla normativa fiscale e contabile applicabile alla sede legale del Titolare.",
        ],
      },
      {
        h: "Assistenza e ticket: chi vede cosa",
        p: [
          "Un ticket è visibile alla persona che lo ha aperto, ai proprietari e agli amministratori della sua organizzazione sulla piattaforma e al personale di supporto di OneSpec espressamente autorizzato e vincolato alla riservatezza. Ogni apertura di un allegato da parte del nostro personale è registrata. Prima di essere resi disponibili, gli allegati sono sottoposti a un controllo di sicurezza automatico (rilevamento di contenuti dannosi e firma di integrità); i file respinti non vengono conservati. Si tratta di un controllo interno, non di un servizio antivirus di terzi. Le note interne del team non sono visibili al cliente.",
          "Per i tuoi dati di contatto e per la gestione dell'assistenza OneSpec agisce come Titolare. Se invece nel ticket inserisci dati personali di terzi (ad esempio i clienti della tua organizzazione), OneSpec li tratta come Responsabile, per conto della tua organizzazione, secondo l'accordo sul trattamento dei dati (DPA) e solo per risolvere la richiesta. Inserisci soltanto i dati strettamente necessari.",
          "Non inviare mai password, codici di verifica, dati di carte di pagamento né categorie particolari di dati personali (art. 9 GDPR, ad esempio dati sulla salute) o documenti d'identità: non servono per l'assistenza.",
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
    updated: "2026-10-12",
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
        h: "Account e registrazione",
        p: [
          "L'accesso richiede la creazione di un account e la verifica dell'indirizzo email.",
          "Le nuove registrazioni possono essere aperte o sospese da OneSpec. Ogni organizzazione accede con il piano a pagamento scelto, alle condizioni indicate al momento dell'adesione.",
        ],
      },
      {
        h: "Piani e corrispettivi",
        p: [
          "OneSpec offre due famiglie di abbonamento: i piani «Preventivi online» (Level 1, Level 2, Level 3), dedicati al preventivatore pubblicabile sul sito del Cliente e, dove incluso, al preventivatore Showroom; e i piani «Piattaforma completa» (Base, Pro, Agency, Enterprise), che comprendono anche i moduli di gestione del lavoro. Il Cliente sceglie liberamente la famiglia e il piano e può passare dall'una all'altra in qualsiasi momento dalla sezione «Piano e fatturazione».",
          "I piani, i limiti e i prezzi in vigore sono quelli pubblicati nella pagina dei prezzi al momento della sottoscrizione. I prezzi sono indicati al netto dell'IVA, che viene applicata in fattura secondo la normativa vigente.",
          "Condizioni economiche di dettaglio, fatturazione, imposte applicabili e modalità di pagamento: [[da completare con i termini economici definitivi]].",
          "Il mancato pagamento può comportare la sospensione dell'accesso previa comunicazione.",
        ],
      },
      {
        h: "Piani «Preventivi online» (Level 1, Level 2, Level 3)",
        p: [
          "I piani Level sono fatturati esclusivamente su base mensile, non prevedono un periodo di prova gratuito e possono essere disdetti in qualsiasi momento con effetto dalla fine del periodo già pagato.",
          "Ogni piano Level include, per ciascun mese solare, un numero massimo di: richieste di preventivo ricevute dal preventivatore pubblico; documenti PDF scaricabili dal Cliente; invii tramite WhatsApp effettuati dal Cliente dall'applicazione; e, dove previsto, preventivi, documenti e invii WhatsApp del preventivatore Showroom. Include inoltre un numero massimo di configuratori e di utenti. I valori di ciascun piano sono quelli pubblicati nella pagina dei prezzi; Level 2 e Level 3 prevedono rispettivamente il doppio e il quintuplo dei limiti mensili di Level 1.",
          "Un documento PDF o un invio WhatsApp relativo alla stessa richiesta o allo stesso preventivo viene conteggiato una sola volta: scaricarlo o inviarlo di nuovo non consuma ulteriori unità. I contatori si azzerano il primo giorno di ogni mese solare.",
          "Le richieste ricevute oltre il limite mensile non vanno perse: vengono registrate, ma i dati di contatto del richiedente restano visibili al Cliente solo dopo il passaggio a un piano superiore oppure dal primo giorno del mese successivo. Superato il limite mensile di PDF o di invii WhatsApp, le relative funzioni restano disponibili dal mese successivo o con un piano superiore.",
          "I moduli non inclusi nei piani Level (tra cui preventivi B2B con firma, clienti e trattative, cantieri, rilievi, posa, collaudi, fascicoli QR, statistiche e, a seconda del piano, Showroom e logistica) restano visibili ma non utilizzabili. Il marchio «Powered by OneSpec» è mostrato nel preventivatore del piano Level 1; i piani Level 2 e Level 3 includono la personalizzazione con il marchio del Cliente (white-label).",
          "I limiti misurano l'uso delle funzioni dell'applicazione; il Cliente si impegna a non aggirarli con mezzi tecnici (vedi «Uso accettabile»).",
        ],
      },
      {
        h: "Cambio di piano, disdetta e sospensione",
        p: [
          "Il passaggio a un piano superiore ha effetto immediato: i nuovi limiti si applicano subito e le richieste registrate oltre il limite del mese in corso diventano visibili. Il passaggio a un piano inferiore o da un piano «Piattaforma completa» a un piano Level non comporta la cancellazione dei dati: i moduli non inclusi nel nuovo piano restano temporaneamente non utilizzabili e tornano disponibili con un piano che li comprende.",
          "Il passaggio a un piano con un numero di utenti inferiore a quello degli utenti attivi del Cliente è possibile solo dopo aver rimosso gli utenti in eccesso. Se il Cliente dispone di più configuratori pubblicati di quanti ne preveda il nuovo piano Level, restano accessibili al pubblico solo i configuratori più anziani entro il limite del piano.",
          "In caso di disdetta o di sospensione dell'abbonamento, per qualsiasi piano, il preventivatore pubblico smette di essere disponibile per i visitatori al termine del periodo pagato. Le eventuali richieste pervenute durante la sospensione vengono registrate, ma i relativi dati di contatto diventano visibili solo con la riattivazione dell'abbonamento.",
        ],
      },
      {
        h: "Rimborsi",
        p: [
          "OneSpec è un prodotto digitale erogato in abbonamento (mensile o annuale): l'accesso alla piattaforma e alle sue funzionalità è messo a disposizione del Cliente immediatamente al momento del pagamento o del rinnovo. Per questa ragione, salvo quanto previsto inderogabilmente dalla legge applicabile, i corrispettivi versati non sono rimborsabili, né in tutto né in parte, incluso in caso di mancato utilizzo del servizio durante il periodo già pagato.",
          "In caso di passaggio a un piano di livello inferiore (downgrade), l'eventuale differenza a credito maturata sul periodo già pagato non viene rimborsata in denaro, ma resta disponibile come credito sulla piattaforma, applicato automaticamente al successivo rinnovo o addebito — consultabile in ogni momento nella sezione «Piano e fatturazione» dell'account.",
          "La disdetta dell'abbonamento (cancellazione del rinnovo) non dà diritto ad alcun rimborso della quota già corrisposta per il periodo in corso: l'accesso resta comunque attivo fino al termine di tale periodo, come indicato al momento della disdetta.",
          "Restano fermi gli eventuali diritti inderogabili previsti dalla legge applicabile per i casi di mancata erogazione del servizio imputabile a OneSpec.",
        ],
      },
      {
        h: "Uso accettabile",
        p: [
          "Il Cliente si impegna a non utilizzare il servizio per attività illecite, a non tentare di aggirare i limiti tecnici, di sicurezza o i limiti di utilizzo del proprio piano e a non caricare contenuti di cui non detiene i diritti. Il Cliente custodisce le proprie credenziali e i codici di recupero della verifica in due passaggi, che consigliamo di attivare per tutte le persone con accesso alla piattaforma.",
          "Il Cliente è responsabile dei contenuti, dei listini e dei dati che inserisce e della loro conformità alle normative applicabili.",
        ],
      },
      {
        h: "Assistenza",
        p: [
          "L'assistenza è prestata tramite i ticket della sezione «Supporto» della piattaforma e, per chi non riesce ad accedere, tramite la pagina «Contattaci». Risponde il personale di OneSpec nei giorni lavorativi.",
          "I tempi di prima risposta e di risoluzione che OneSpec si prefigge sono obiettivi interni, non garanzie né livelli di servizio vincolanti, salvo diverso accordo scritto con il Cliente Enterprise (v. «Limitazione di responsabilità» e le condizioni di disponibilità concordate).",
          "Nei ticket il Cliente si impegna a non inserire password, codici di verifica, dati di carte di pagamento o dati personali non necessari, a non allegare contenuti illeciti, offensivi o di cui non detiene i diritti, e a usare solo gli allegati consentiti (immagini PNG, JPG, WebP e PDF, fino a 3 file per messaggio e 8 MB ciascuno). OneSpec può rimuovere contenuti non conformi e chiudere i ticket che abusano del servizio. Gli allegati sono verificati automaticamente e quelli che non superano il controllo di sicurezza sono respinti.",
          "Un ticket risolto senza ulteriori risposte si chiude automaticamente dopo 7 giorni; i ticket chiusi e i relativi allegati sono eliminati secondo i tempi indicati nell'informativa sulla privacy.",
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
          "Portabilità e cambio fornitore (Regolamento UE 2023/2854, «Data Act»): in qualsiasi momento, anche dopo la disdetta e per almeno 30 giorni, il Cliente può esportare i propri dati dalla pagina Account in formato strutturato (JSON) o richiedere assistenza alla migrazione verso un altro fornitore scrivendo a [[email di contatto privacy]]; dopo tale periodo i dati sono cancellati secondo l'informativa privacy.",
          "Trattandosi di un servizio in abbonamento destinato a un'organizzazione professionale, il diritto di recesso previsto dal Codice del Consumo per i contratti a distanza con i consumatori non trova applicazione. Anche laddove applicabile, tale diritto decadrebbe comunque in relazione alla fornitura di contenuto digitale non su supporto materiale la cui esecuzione è iniziata con l'accordo espresso del Cliente, con rinuncia al diritto di recesso, al momento dell'attivazione dell'abbonamento (art. 59, lett. o, D.Lgs. 206/2005).",
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
    updated: "2026-10-12",
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
        h: "Codice invito (archiviazione locale)",
        p: [
          "Se arrivi su OneSpec da un link d'invito (contenente «?ref=…»), il codice invito viene salvato nel browser tramite localStorage con la chiave «onespec-ref» per 30 giorni, al solo scopo di collegare la tua registrazione a chi ti ha invitato. Non è un cookie, non contiene dati personali e non viene inviato a terzi; puoi cancellarlo in qualsiasi momento svuotando i dati del sito.",
        ],
      },
      {
        h: "Verifica anti-bot (Cloudflare Turnstile)",
        p: [
          "I moduli di accesso, registrazione, recupero password e «Contattaci», e l'invio dei preventivi dal widget, usano Cloudflare Turnstile per verificare che a compilarli sia una persona. È una misura di sicurezza strettamente necessaria e non richiede consenso; non è usata per pubblicità né per profilare gli utenti.",
        ],
      },
      {
        h: "Misurazione delle prestazioni",
        p: [
          "Le prestazioni delle pagine sono misurate tramite Vercel Speed Insights, che non utilizza cookie e non traccia i singoli utenti.",
        ],
      },
      {
        h: "Analisi e registrazione della sessione (previo consenso)",
        p: [
          "Utilizziamo PostHog per l'analisi di prodotto e la registrazione della sessione (click, scorrimento, percorso di navigazione) e Sentry Replay per rivedere visivamente cosa ha causato un errore tecnico — entrambi servono a individuare e correggere malfunzionamenti della piattaforma. I valori digitati nei campi dei moduli restano sempre oscurati nella registrazione.",
          "Questi strumenti non si attivano automaticamente: al primo accesso viene mostrato un banner che chiede il consenso; finché non viene accettato, nessun dato di navigazione viene raccolto da questi strumenti. La sola segnalazione tecnica degli errori (senza registrazione visiva né dati di navigazione) resta invece sempre attiva, come misura di sicurezza e stabilità del servizio.",
          "Non sono utilizzati cookie pubblicitari o di profilazione commerciale di terze parti.",
        ],
      },
    ],
  },
  {
    slug: "gdpr",
    title: "Diritti degli interessati (GDPR)",
    updated: "2026-10-12",
    summary: "Come esercitare accesso, portabilità, rettifica, cancellazione e opposizione.",
    sections: [
      IDENTITY_INTRO,
      RIGHTS,
      {
        h: "Come esercitare i diritti",
        p: [
          "Dalla pagina Account: esportazione dati (JSON, inclusi ticket di assistenza e messaggi «Contattaci»), aggiornamento del profilo, gestione dei consensi, richiesta di cancellazione.",
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
    slug: "regolamento-inviti",
    title: "Regolamento del programma inviti",
    updated: "2026-10-02",
    summary: "Come funzionano premi, sconti, pagamenti e controlli del programma «Invita e risparmia».",
    sections: [
      {
        h: "Cos'è il programma",
        p: [
          "Il programma «Invita e risparmia» permette a un'organizzazione cliente di OneSpec (l'«invitante») di invitare un'altra azienda (l'«invitato») tramite il proprio codice o link personale. Il programma è un'iniziativa commerciale di OneSpec, può essere attivato, modificato o sospeso in qualsiasi momento e riguarda esclusivamente clienti professionali (B2B).",
          "Bozza in attesa di revisione legale: [[revisione legale del regolamento]].",
        ],
      },
      {
        h: "Vantaggi",
        p: [
          "L'invitato ottiene uno sconto del 10% sulla prima fattura dell'abbonamento a pagamento, calcolato sul prezzo di listino del piano e del ciclo scelti.",
          "L'invitante ottiene un premio pari al 10% del prezzo di listino, IVA esclusa, del piano e del ciclo di fatturazione effettivamente acquistati dall'invitato (l'annuale è calcolato come dieci mensilità). Il premio spetta una sola volta per ciascun account invitato.",
          "Il piano Enterprise, gestito commercialmente, è escluso dal programma automatico.",
        ],
      },
      {
        h: "Quando matura il premio",
        p: [
          "Il premio matura solo dopo il primo pagamento reale dell'invitato e trascorsi 30 giorni, a condizione che nel frattempo il pagamento non sia stato rimborsato o contestato e che l'abbonamento dell'invitato risulti regolare.",
          "Ogni invitante può ricevere al massimo 10 premi in 12 mesi consecutivi. Se l'invitante non è idoneo entro 90 giorni dal termine del periodo di attesa, l'invito scade senza premio.",
        ],
      },
      {
        h: "Come viene pagato il premio",
        p: [
          "Il titolare dell'organizzazione sceglie tra due modalità: credito sul saldo Stripe, che riduce le prossime fatture di OneSpec, oppure bonifico in denaro tramite Stripe Connect sul conto collegato dall'invitante. Il pagamento in denaro richiede il completamento della verifica di identità richiesta da Stripe.",
          "Il credito non è convertibile in denaro. Gli eventuali profili fiscali del premio in denaro (fatturazione, ritenute, IVA) sono a carico dell'invitante, salvo diversa disposizione di legge: [[trattamento fiscale del premio, da definire con il commercialista]].",
        ],
      },
      {
        h: "Revoca del premio",
        p: [
          "Se entro 60 giorni dal pagamento qualificante l'invitato ottiene un rimborso o apre una contestazione, il premio già riconosciuto viene revocato: il credito viene stornato dal saldo Stripe oppure il bonifico viene annullato tramite storno del trasferimento.",
        ],
      },
      {
        h: "Controlli e uso improprio",
        p: [
          "Non sono ammessi: auto-inviti, inviti tra società dello stesso gruppo o con lo stesso dominio aziendale, indirizzi email temporanei, account creati al solo scopo di ottenere il premio e uso della stessa carta o dello stesso cliente di pagamento da parte di invitante e invitato.",
          "Gli inviti che non rispettano queste regole sono respinti, e OneSpec può sospendere il codice di un invitante e annullare i premi ottenuti in modo improprio. Nell'applicare i controlli, OneSpec tratta l'indirizzo email dei titolari e l'identificativo di pagamento Stripe per le sole finalità di prevenzione degli abusi.",
        ],
      },
      {
        h: "Riservatezza dell'invitato",
        p: [
          "All'invitante è mostrato il nome dell'azienda invitata in forma mascherata (ad esempio «Se*** Srl») e lo stato dell'invito, senza altri dati sull'invitato.",
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
          "Nessuna certificazione di terze parti risulta posseduta alla data di revisione. Questa sezione sarà aggiornata non appena, e solo se, una certificazione verrà effettivamente conseguita.",
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

// Every legal document ends with the same legal/contract contact line
// (office@core829.net), appended once here instead of duplicated per doc.
for (const doc of LEGAL_DOCS) {
  doc.sections.push(LEGAL_CONTACT);
}

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
