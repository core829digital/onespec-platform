import { legalValue } from "@/content/legal-values";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Addendum sul trattamento dei dati (DPA) | OneSpec",
  description: "Accordo per il trattamento dei dati personali ai sensi dell'art. 28 GDPR.",
};

function interpolateLegalText(text: string) {
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const key = match[1];
    const v = legalValue(key);
    parts.push(
      v ? (
        <span key={key} className="text-[var(--color-mint)] font-medium">
          {v}
        </span>
      ) : (
        <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
          da completare: {key}
        </span>
      )
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

const DPA_SECTIONS = [
  {
    h: "1. Definizioni",
    p: [
      "«Titolare del trattamento»: l'organizzazione cliente di OneSpec (di seguito «Titolare»).",
      "«Responsabile del trattamento»: OneSpec (di seguito «Responsabile»), gestito da [[ragione sociale]].",
      "«Dati personali»: qualsiasi informazione relativa a una persona fisica identificata o identificabile trattata dal Responsabile per conto del Titolare.",
      "«Trattamento»: qualsiasi operazione effettuata sui dati personali per conto del Titolare.",
      "«Sub-responsabile»: qualsiasi soggetto incaricato dal Responsabile per svolgere attività di trattamento specifiche.",
    ],
  },
  {
    h: "2. Oggetto e durata",
    p: [
      "Il presente Addendum disciplina il trattamento dei dati personali effettuato dal Responsabile per conto del Titolare nell'ambito della fornitura del servizio OneSpec (piattaforma SaaS per preventivazione, configurazione, gestione cantieri, rilievi, collaudi e fascicoli serramenti).",
      "Il trattamento ha durata pari al contratto di servizio e cessa alla sua scadenza o risoluzione. Alla cessazione, il Responsabile cancella o restituisce i dati personali su richiesta del Titolare, salvo obblighi di conservazione legale.",
    ],
  },
  {
    h: "3. Categorie di dati e interessati",
    p: [
      "Categorie di dati: dati di account (nome, email, lingua), dati organizzativi (ragione sociale, P.IVA, indirizzo, contatti), richieste di preventivo (dati anagrafici e tecnici del potenziale cliente, configurazione tecnica, prezzo indicativo), dati tecnici del widget (hash IP, user agent, esito anti-bot), log di audit e attività amministrative.",
      "Categorie di interessati: utenti registrati (titolari, amministratori, membri), potenziali clienti che compilano il widget, eventuali installatori/tecnici coinvolti nei processi di rilievo e collaudo.",
    ],
  },
  {
    h: "4. Finalità del trattamento",
    p: [
      "Erogazione del servizio SaaS OneSpec: configurazione prodotti, calcolo prezzi, generazione preventivi, gestione cantieri, rilievi, collaudi, fascicoli QR, reporting.",
      "Sicurezza, prevenzione abusi, rate limiting, audit.",
      "Adempimenti fiscali/contabili per abbonamenti a pagamento.",
      "Comunicazioni di servizio (codici verifica, notifiche preventivo, alert sistema).",
    ],
  },
  {
    h: "5. Obblighi del Responsabile",
    p: [
      "Trattare i dati solo su istruzioni documentate del Titolare (il presente Addendum e la configurazione del servizio).",
      "Garantire che le persone autorizzate al trattamento si siano impegnate alla riservatezza o siano soggette a obbligo legale di riservatezza.",
      "Implementare misure tecniche e organizzative adeguate (vedi §7).",
      "Non coinvolgere sub-responsabili senza autorizzazione scritta preventiva o generale del Titolare (vedi §6).",
      "Assistere il Titolare per l'esercizio dei diritti degli interessati (accesso, rettifica, cancellazione, limitazione, portabilità, opposizione).",
      "Assistere il Titolare per la notifica di violazioni dei dati (data breach) entro 72 ore dalla scoperta.",
      "Alla cessazione: cancellare o restituire tutti i dati personali e cancellare le copie esistenti, salvo obblighi di legge.",
      "Mettere a disposizione del Titolare le informazioni necessarie per dimostrare la conformità e consentire audit/inspezioni.",
    ],
  },
  {
    h: "6. Sub-responsabili autorizzati",
    p: [
      "Il Titolare autorizza generalmente i seguenti sub-responsabili, che trattano dati per conto del Responsabile sulla base di accordi ai sensi dell'art. 28 GDPR:",
      "• Convex (Convex, Inc.) — database e backend applicativo. Ubicazione dati: [[regione di hosting Convex]].",
      "• Resend (Resend, Inc.) — invio email transazionali (codici verifica, notifiche preventivo).",
      "• Cloudflare Turnstile (Cloudflare, Inc.) — verifica anti-bot invio preventivi widget.",
      "• Vercel (Vercel, Inc.) — hosting applicazione web e misurazione prestazioni (Speed Insights).",
      "Il Responsabile informa il Titolare di eventuali cambiamenti ai sub-responsabili con ragionevole preavviso, consentendo opposizione motivata.",
    ],
  },
  {
    h: "7. Misure di sicurezza",
    p: [
      "Cifratura in transito (TLS 1.2+) e a riposo (gestita dai fornitori infrastrutturali).",
      "Controllo accessi basato su ruoli (titolare, amministratore, membro) con verifica server-side su ogni operazione; isolamento per tenant.",
      "Gestione sessioni con revoca dispositivi singoli e disconnessione globale.",
      "Segreti gestiti tramite variabili d'ambiente della piattaforma di deployment, mai nel codice o log.",
      "Intestazioni di sicurezza: HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP dedicata per widget.",
      "Rate limiting su accesso, invio preventivi widget, esportazioni dati; verifica anti-bot Cloudflare Turnstile.",
      "Registro attività (audit log) per azioni amministrative e operazioni sensibili.",
      "Backup e continuità gestiti da Convex; politiche RPO/RTO: [[da completare e verificare con Convex]].",
    ],
  },
  {
    h: "8. Trasferimenti verso paesi terzi",
    p: [
      "Eventuali trasferimenti verso paesi fuori dallo SEE avvengono sulla base delle Clausole Contrattuali Standard (SCC) della Commissione Europea, integrate dalle misure supplementari raccomandate dall'EDPB.",
      "I fornitori statunitensi (Convex, Resend, Vercel, Cloudflare) aderiscono al Data Privacy Framework UE-USA o applicano SCC.",
    ],
  },
  {
    h: "9. Notifica di violazione (Data Breach)",
    p: [
      "Il Responsabile notifica al Titolare senza ingiustificato ritardo e comunque entro 72 ore dalla scoperta di una violazione dei dati personali, fornendo: natura della violazione, categorie e numero approssimativo di interessati e record, conseguenze probabili, misure adottate/proposte.",
      "Contatto per segnalazioni sicurezza: [[email di contatto sicurezza]].",
    ],
  },
  {
    h: "10. Diritti degli interessati",
    p: [
      "Il Responsabile assiste il Titolare nel rispondere alle richieste di esercizio dei diritti (artt. 15–22 GDPR) entro i termini di legge.",
      "Il Titolare può evadere autonomamente molte richieste dalla pagina Account (esportazione JSON, aggiornamento profilo, cancellazione account).",
    ],
  },
  {
    h: "11. Audit e verifiche",
    p: [
      "Il Titolare può richiedere audit o verifiche della conformità del Responsabile, con preavviso ragionevole e nell'orario lavorativo. Il Responsabile fornisce la documentazione necessaria (es. report SOC 2 dei sub-responsabili, policy interne).",
      "I costi di audit straordinari sono a carico del Titolare salvo diversa pattuizione.",
    ],
  },
  {
    h: "12. Legge applicabile e foro competente",
    p: [
      "Il presente Addendum è regolato dalla legge [[legge applicabile]]. Foro competente: [[foro / tribunale]].",
    ],
  },
  {
    h: "13. Modifiche",
    p: [
      "Eventuali modifiche sono comunicate per iscritto con ragionevole preavviso. L'uso continuato del servizio dopo l'entrata in vigore delle modifiche costituisce accettazione.",
    ],
  },
];

export default function DpaPage() {
  return (
    <article>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Addendum sul trattamento dei dati (DPA)</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Accordo per il trattamento dei dati personali ai sensi dell&apos;art. 28 GDPR</p>
      </header>

      {DPA_SECTIONS.map((section) => (
        <section key={section.h} className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">{section.h}</h2>
          <div className="space-y-3 text-[var(--color-text)]">
            {section.p.map((paragraph, idx) => (
              <p key={idx} className="leading-relaxed">
                {interpolateLegalText(paragraph)}
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}