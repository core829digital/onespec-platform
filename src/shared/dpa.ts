/**
 * Data Processing Agreement (Art. 28 GDPR) between a tenant (Titolare) and the
 * platform operator (Responsabile). Shared by the Convex backend (which only
 * needs the version) and the UI / PDF (which render the text).
 *
 * The wording below is the operator's own document, transcribed verbatim.
 * ⚠ Bump DPA_VERSION whenever any wording changes: acceptances are bound to the
 * version, and a new version asks every tenant to accept again.
 */

export const DPA_VERSION = "2026-09-21";

export interface DpaController {
  name: string;
  vatId?: string;
  address?: string;
  email?: string;
  /** Legal representative signing on behalf of the tenant. */
  representative?: string;
}

/** The operator's identity, as written in the agreement. */
export const DPA_PROCESSOR = {
  name: "CORE829 / ONESPEC",
  vatId: "CUI/CIF RO54616345 — Reg. com. J2026029428009",
  address: "Str. Mihai Eminescu, 10, Roman, România",
  representative: "Vasile Vasea Serban",
  privacyEmail: "privacy@onespec.it",
  offerEmail: "offerta@serbanferrestre.it",
  phone: "+40 766 668 482",
};

export interface DpaSection {
  h: string;
  p: string[];
}

const BLANK = "____________";
const or = (v: string | undefined) => (v && v.trim() ? v.trim() : BLANK);

export interface DpaDocument {
  title: string;
  legalBasis: string;
  parties: string;
  premises: { intro: string; items: string[]; definitions: string };
  articles: DpaSection[];
  annexes: string[];
  annexC: { h: string; lines: string[] };
  annexD: { h: string; lines: string[] };
}

export function buildDpa(controller: DpaController): DpaDocument {
  const P = DPA_PROCESSOR;
  return {
    title: "ACCORDO SUL TRATTAMENTO DEI DATI PERSONALI",
    legalBasis: "ex Art. 28 Regolamento (UE) 2016/679 (GDPR) e D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018",
    parties: "TRA: Titolare del Trattamento e Responsabile del Trattamento - ONESPEC Configuratore Serramenti PVC",
    premises: {
      intro: "Premesso che:",
      items: [
        "a) Il presente Accordo costituisce atto giuridico vincolante ai sensi dell'Art. 28 GDPR che disciplina il trattamento di dati personali effettuato dal Responsabile per conto del Titolare nell'ambito del servizio di configuratore PWA white-label per serramenti PVC (di seguito \"Servizio ONESPEC\").",
        `b) Il Titolare è l'azienda cliente rivenditore/installatore di infissi con sede in Italia (${or(controller.name)}, P.IVA ${or(controller.vatId)}, con sede in ${or(controller.address)}, email ${or(controller.email)}) che utilizza il configuratore sul proprio sito web.`,
        `c) Il Responsabile è ${P.name}, con sede in ${or(P.address)}, P.IVA/CF ${or(P.vatId)}, email privacy: ${P.privacyEmail} / ${P.offerEmail}, che fornisce il Servizio in modalità SaaS / PWA / widget embeddabile con hosting EU.`,
        "d) Le Parti hanno letto le Linee Guida EDPB 07/2020 sul Titolare e Responsabile e il Provvedimento del Garante per la Protezione dei Dati Personali del 2024 sull'uso di WhatsApp Business e trasferimenti extra-UE.",
      ],
      definitions:
        "Definizioni: GDPR, Codice Privacy (D.Lgs. 196/2003 mod. D.Lgs. 101/2018), Trattamento, Dato Personale, Interessato (cliente finale che configura finestra), Violazione (Data Breach), DPA, Sub-Responsabile.",
    },
    articles: [
      {
        h: "Art. 1 - OGGETTO E DURATA",
        p: [
          "1.1 Oggetto: trattamento di dati personali di clienti finali (interessati) che utilizzano il configuratore per richiedere preventivo serramenti. Il trattamento avviene tramite PWA / iframe embeddato su sito del Titolare, con invio lead su WhatsApp del Titolare e eventuale salvataggio in dashboard ONESPEC.",
          "1.2 Durata: pari alla durata del contratto principale di servizio (abbonamento BASE 97€ / PRO 197€ / AGENCY 397€) più 30 giorni per restituzione/cancellazione dati, salvo obblighi di conservazione di legge (garanzia 10 anni profilo).",
          "1.3 Luogo trattamento: Unione Europea - data center Hetzner Germania (Nuremberg/Falkenstein) / OVH Francia (Roubaix/Gravelines). Nessun trasferimento in USA salvo WhatsApp, disciplinato all'Art. 6.",
        ],
      },
      {
        h: "Art. 2 - NATURA, FINALITÀ E TIPOLOGIA DEI DATI",
        p: [
          "2.1 Finalità: esclusivamente (i) esecuzione di misure precontrattuali su richiesta dell'interessato (Art. 6(1)(b) GDPR) - elaborazione preventivo infissi, (ii) consenso esplicito per marketing diretto del Titolare se raccolto dal Titolare (Art. 6(1)(a)), (iii) adempimento obblighi fiscali / garanzia legale serramenti.",
          "2.2 Categorie interessati: persone fisiche che configurano infissi (potenziali clienti), residenti in Italia.",
          "2.3 Categorie dati: dati comuni: nome, cognome, numero WhatsApp/telefono, comune (es. Prato), indirizzo cantiere opzionale, misure infissi, tipologia profilo (Aluplast Ideal 4000, Rehau Synego, Deceuninck, Salamander, Schüco), colore, vetro (4/20/4 Low-E + Argon Ug 1.0), osservazioni, foto del vecchio infisso (facoltative), IP anonimizzato /24, log tecnico. NON sono trattati dati particolari ex Art. 9 GDPR.",
          "2.4 Modalità: elettronica, tramite PWA self-contained, localStorage tecnico per backup configurazione, trasmissione TLS 1.3, cifratura AES-256 at rest.",
        ],
      },
      {
        h: "Art. 3 - OBBLIGHI DEL RESPONSABILE (ONESPEC)",
        p: [
          "3.1 Tratta i dati solo su istruzione documentata del Titolare (presente DPA + config client JSON), salvo obbligo di legge UE/italiana, previa informazione al Titolare.",
          "3.2 Garantisce che le persone autorizzate al trattamento (developer, supporto) abbiano firmato impegno riservatezza e formazione GDPR.",
          "3.3 Adotta misure di sicurezza ex Art. 32 GDPR: (a) pseudonimizzazione e cifratura, (b) capacità di garantire riservatezza, integrità, disponibilità e resilienza, (c) procedure di ripristino (backup giornaliero cifrato, RPO 24h, RTO 12h), (d) test periodici vulnerabilità OWASP, (e) isolamento CSS/JS widget per evitare XSS su sito host, (f) log accessi.",
          "3.4 Non conserva dati identificativi in chiaro nel DB centrale oltre 12 mesi per preventivi non chiusi; per preventivi chiusi, conservazione 10 anni profilo / 5 anni ferramenta / 2 anni posa come da garanzia italiana, poi cancellazione o anonimizzazione.",
          "3.5 Assistenza al Titolare per adempimento obblighi Artt. 12-22 GDPR (diritti interessati) e Artt. 32-36 (sicurezza, DPIA, consultazione Garante).",
          "3.6 Su scelta del Titolare, cancella o restituisce tutti i dati al termine del servizio e cancella le copie esistenti, salvo obbligo legale UE/IT.",
        ],
      },
      {
        h: "Art. 4 - OBBLIGHI DEL TITOLARE",
        p: [
          "4.1 Il Titolare garantisce di aver fornito informativa privacy ex Art. 13 GDPR agli interessati PRIMA della raccolta tramite checkbox obbligatorio nel widget (testo concordato: \"Ho letto l'informativa privacy disponibile su [URL privacy Titolare] e acconsento...\").",
          "4.2 Il Titolare garantisce base giuridica valida (contratto / consenso) e che i dati comunicati al Responsabile sono pertinenti, esatti e leciti.",
          "4.3 Il Titolare mantiene Registro Trattamenti ex Art. 30(1) GDPR e, se necessario, nomina DPO.",
          "4.4 Il Titolare istruisce il Responsabile mediante configurazione JSON (listini, WhatsApp number, privacyUrl) e non impartisce istruzioni in violazione del GDPR.",
        ],
      },
      {
        h: "Art. 5 - SUB-RESPONSABILI",
        p: [
          "5.1 Elenco Sub-Responsabili autorizzati: (i) Hetzner Online GmbH (Germania) - hosting; (ii) OVH S.A.S. (Francia) - backup; (iii) Cloudflare Inc. (EU POP) - CDN/WAF (solo dati tecnici anonimizzati); (iv) WhatsApp Ireland Ltd / Meta Platforms Inc. - per invio lead su WhatsApp su istruzione del Titolare (vedi Art. 6).",
          "5.2 Autorizzazione generale ex Art. 28(2) GDPR concessa dal Titolare. Il Responsabile informa il Titolare con 15 giorni preavviso via email di eventuali nuovi Sub-Responsabili, con diritto di opposizione motivata del Titolare entro 10 giorni.",
          "5.3 Il Responsabile impone ai Sub-Responsabili obblighi non meno stringenti del presente DPA mediante contratto.",
        ],
      },
      {
        h: "Art. 6 - TRASFERIMENTI EXTRA-UE (WhatsApp)",
        p: [
          "6.1 L'invio del preventivo su WhatsApp comporta trasferimento verso Meta Platforms Inc. (USA) quale Titolare autonomo. Tale trasferimento avviene su istruzione esplicita del Titolare che ha scelto WhatsApp come canale di contatto e con consenso dell'interessato raccolto nel widget.",
          "6.2 Base trasferimento: Clausole Contrattuali Standard (SCC) UE approvate da Commissione UE 2021/914 Modulo 2 + misure supplementari (cifratura E2E di WhatsApp, minimizzazione - invio solo dati necessari: nome, telefono, comune, totale, lista pezzi).",
          "6.3 Il Titolare è informato che USA è paese terzo senza adeguatezza dopo Schrems II e accetta rischio residuo. Il Responsabile non è responsabile per trattamento autonomo di WhatsApp/Meta dopo la consegna.",
          "6.4 Per hosting e dashboard, NESSUN trasferimento extra-UE. Dati restano in SEE.",
        ],
      },
      {
        h: "Art. 7 - SICUREZZA E DATA BREACH",
        p: [
          "7.1 Misure tecniche: TLS 1.3, HSTS, CSP, AES-256 at rest, Argon2 per credenziali admin, 2FA per accesso dashboard, WAF, isolamento tenant per clientId, backup cifrato giornaliero in regione diversa, retention 30gg.",
          "7.2 In caso di Data Breach che riguardi dati del Titolare, il Responsabile notifica al Titolare senza ingiustificato ritardo e comunque entro 24 ore dalla scoperta, con descrizione natura, categorie, numero approssimativo interessati, conseguenze probabili, misure adottate. Fornisce assistenza per notifica Garante ex Art. 33 (72h) e comunicazione interessati ex Art. 34 se necessaria.",
          "7.3 Il Responsabile mantiene registro violazioni ex Art. 33(5).",
        ],
      },
      {
        h: "Art. 8 - DIRITTI DEGLI INTERESSATI",
        p: [
          "8.1 Il Responsabile, tenuto conto della natura del trattamento, assiste il Titolare con misure tecniche/organizzative per soddisfare richieste di accesso, rettifica, cancellazione, limitazione, portabilità, opposizione degli interessati. Inoltra al Titolare entro 48h eventuali richieste ricevute direttamente.",
          "8.2 Implementazione nel widget: pulsante \"Richiedi cancellazione preventivo\" che invia richiesta a privacy@[dominio Titolare] + a privacy@onespec.it con ID preventivo.",
        ],
      },
      {
        h: "Art. 9 - DPIA E CONSULTAZIONE PREVIA",
        p: [
          "9.1 Il Responsabile assiste il Titolare per DPIA ex Art. 35 GDPR se trattamento comporta rischio elevato (es. geolocalizzazione precisa cantiere + foto). Mette a disposizione documentazione misure di sicurezza e Sub-Responsabili.",
          "9.2 Se necessario consultazione Garante ex Art. 36, il Responsabile fornisce supporto.",
        ],
      },
      {
        h: "Art. 10 - AUDIT E ISPEZIONI",
        p: [
          "10.1 Il Responsabile mette a disposizione del Titolare tutte le informazioni necessarie per dimostrare rispetto Art. 28 e consente e contribuisce ad audit, anche ispezioni, con preavviso 15 giorni lavorativi, max 1 audit/anno salvo breach, in orario lavorativo, senza interferire con altri tenant, costi a carico Titolare se non emergono non conformità gravi.",
          "10.2 Il Titolare può richiedere report SOC 2 / ISO 27001 del provider hosting e report pen test annuale del Responsabile.",
        ],
      },
      {
        h: "Art. 11 - CONSERVAZIONE E CANCELLAZIONE",
        p: [
          "11.1 Periodi: lead non convertito: 12 mesi dalla raccolta, poi cancellazione automatica; lead convertito in contratto di fornitura/posa: 10 anni (garanzia profilo) + 1 anno per contenzioso, poi anonimizzazione.",
          "11.2 Al termine del contratto, entro 30 giorni: (i) restituzione export JSON cifrato di tutti i preventivi del Titolare, (ii) cancellazione sicura (secure wipe) da DB attivo e backup entro 90 giorni per ciclo backup.",
        ],
      },
      {
        h: "Art. 12 - RESPONSABILITÀ E MANLEVA",
        p: [
          "12.1 Ciascuna Parte è responsabile per violazione GDPR imputabile alla stessa. Sanzioni Garante a carico della Parte inadempiente.",
          "12.2 Il Responsabile risponde solo per violazione obblighi Art. 28 GDPR o istruzioni documentate del Titolare. Non risponde per trattamento autonomo del Titolare dopo ricezione lead su WhatsApp/CRM.",
          "12.3 Massimale responsabilità Responsabile: canoni totali corrisposti dal Titolare nei 12 mesi precedenti l'evento, salvo dolo/colpa grave o violazione Art. 82 GDPR verso interessati.",
        ],
      },
      {
        h: "Art. 13 - LEGGE APPLICABILE E FORO",
        p: [
          "13.1 Legge applicabile: italiana, con rinvio a GDPR, D.Lgs. 196/2003 mod. D.Lgs. 101/2018, Provvedimenti Garante.",
          "13.2 Per qualsiasi controversia relativa al presente DPA, foro competente esclusivo è Prato (o Milano/Verona su accordo), previo tentativo di conciliazione stragiudiziale 30 giorni.",
          "13.3 Lingua: italiano. Comunicazioni privacy a privacy@onespec.it e PEC Titolare.",
        ],
      },
      {
        h: "Art. 14 - DISPOSIZIONI FINALI",
        p: [
          "14.1 Il presente DPA integra e prevale su clausole confliggenti del contratto principale per materia privacy.",
          "14.2 Modifiche solo per iscritto.",
          "14.3 Nullità parziale non travolge intero accordo.",
        ],
      },
    ],
    annexes: [
      "Allegato A - Descrizione tecnica misure sicurezza (Hetzner/OVH, TLS, AES, backup, WAF)",
      "Allegato B - Elenco Sub-Responsabili aggiornato",
      "Allegato C - Modello informativa privacy per widget (IT)",
      "Allegato D - Istruzioni configurazione checkbox consenso e ?embed=1",
    ],
    annexC: {
      h: "ALLEGATO C - INFORMATIVA PRIVACY MODELLO WIDGET (da pubblicare su URL privacy Titolare)",
      lines: [
        "Informativa ex Art. 13 GDPR per configuratore serramenti PVC",
        `Titolare: ${or(controller.name)}, P.IVA ${or(controller.vatId)}, sede ${or(controller.address)}, email ${or(controller.email)}`,
        `Responsabile: ${P.name} - ${P.privacyEmail}`,
        "Finalità: (a) elaborazione preventivo serramenti su vostra richiesta (base art.6(1)(b)), (b) invio preventivo su WhatsApp da voi indicato (base consenso art.6(1)(a) + esecuzione richiesta), (c) adempimento garanzia legale.",
        "Dati: nome, telefono/WhatsApp, comune, misure, tipologia infisso, foto facoltative.",
        "Conservazione: 12 mesi se non acquistate, 10 anni se acquistate per garanzia.",
        "Diritti: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione, reclamo a Garante (www.garanteprivacy.it). Per esercitare: scrivere al Titolare all'indirizzo email indicato sopra.",
        "Trasferimento extra-UE: WhatsApp (Meta USA) con SCC. Hosting resta in UE (Germania/Francia).",
        "Obbligatorietà: senza dati non è possibile elaborare preventivo.",
      ],
    },
    annexD: {
      h: "ALLEGATO D - CHECKBOX CONSENSO WIDGET (testo legale validato)",
      lines: [
        "Codice HTML da inserire prima di bottone Invia su WhatsApp:",
        "<label><input type=\"checkbox\" required id=\"privacy-consent\"> Ho letto l'<a href=\"[URL PRIVACY TITOLARE]\" target=\"_blank\">informativa privacy</a> e acconsento al trattamento dei miei dati personali per l'elaborazione del preventivo e l'invio su WhatsApp ai sensi dell'Art. 13 GDPR e Art. 6(1)(b) e (a) GDPR. </label>",
        "Validazione JS: button disabled se !checked. Log consenso: salva timestamp + IP anonimizzato + versione informativa.",
      ],
    },
  };
}

/** Whether the tenant has the identity data the agreement needs before it can be signed. */
export function controllerComplete(c: DpaController): boolean {
  return !!(c.name?.trim() && c.vatId?.trim() && c.address?.trim());
}
