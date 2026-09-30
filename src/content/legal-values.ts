/**
 * Real-world values for the `[[…]]` placeholders in `legal.ts`. The key is the
 * exact text inside the brackets; a non-empty value replaces the yellow
 * "to complete" chip with plain text. Only put verified facts or reviewed
 * contractual wording here; leave a value empty rather than inventing it.
 */
export const LEGAL_VALUES: Record<string, string> = {
  "email di contatto privacy": "hello@onespec.eu",
  "email di contatto sicurezza": "hello@onespec.eu",
  "email di contatto legale": "office@core829.net",

  // Operating company identity — verified from the company registration.
  "ragione sociale": "CORE829 SRL",
  "indirizzo completo": "Str. Mihai Eminescu, 10, Roman, România",
  "P.IVA / codice fiscale": "CUI/CIF RO54616345 — Reg. com. J2026029428009",
  telefono: "+40 766 668 482 (Romania) · +39 375 946 8881 (Italia)",
  // Romanian entities have no PEC (istituto specifico del diritto italiano) —
  // "non applicabile" is a verified fact about the legal form, not a gap.
  "indirizzo PEC": "non applicabile — CORE829 SRL è una società di diritto romeno, priva dell'istituto della PEC",

  // Data protection / hosting.
  // No DPO has actually been appointed — stating this is the true, current fact.
  "è / non è": "non è",
  "recapiti DPO oppure «non applicabile»": "non applicabile — nessun DPO nominato alla data di revisione",
  // Confirmed by the operating company: Convex's US region. The platform is
  // sold and used in the EU, so this is a real third-country transfer —
  // covered by the Standard Contractual Clauses already referenced below.
  "regione di hosting Convex": "Stati Uniti d'America",

  // Retention periods.
  // Matches the 30-day grace window actually implemented in convex/account.ts (requestDeletion).
  numero: "30",

  // Contract terms — drafted for CORE829 SRL on the basis of its Romanian seat and
  // B2B offer. Reviewed by the company; a lawyer should validate before the first
  // enterprise contract (see docs in the launch plan).
  "legge applicabile": "romena (con applicazione inderogabile delle norme UE, in particolare il GDPR), esclusa la Convenzione di Vienna sulla vendita internazionale di beni",
  "foro / tribunale": "i tribunali competenti di Roman / Neamț (Romania), sede legale di CORE829 SRL, salvo il foro inderogabile del consumatore ove applicabile",
  "massimale di responsabilità / riferimento al corrispettivo":
    "quanto versato dal Cliente a OneSpec nei dodici mesi precedenti l'evento che ha causato il danno, escluse in ogni caso le perdite indirette (mancato guadagno, perdita di clienti o di dati non dovuta a OneSpec); restano ferme le responsabilità che la legge non consente di limitare (dolo, colpa grave, danni alla persona)",
  "da completare con i termini economici definitivi":
    "i prezzi sono quelli indicati nella pagina Piani e al momento dell'acquisto nel checkout; l'abbonamento si rinnova automaticamente con cadenza mensile o annuale e può essere disdetto in qualsiasi momento dalla pagina Fatturazione, con effetto a fine periodo già pagato; i pagamenti sono gestiti da Stripe; le imposte applicabili sono calcolate e indicate al checkout secondo la normativa in vigore; in caso di mancato pagamento l'accesso può essere sospeso dopo i solleciti previsti dal servizio",
  "da definire per il piano Enterprise":
    "salvo diverso accordo scritto, OneSpec si impegna a una disponibilità mensile obiettivo del 99,5% (esclusa la manutenzione programmata comunicata in anticipo), senza crediti automatici; livelli di servizio e tempi di risposta dedicati possono essere concordati per iscritto con il Cliente Enterprise",

  // Security & compliance statements — limited to what the infrastructure providers publicly document.
  "da completare con la documentazione del fornitore":
    "i dati a riposo sono cifrati con algoritmi standard di settore (AES-256) dai fornitori di infrastruttura e le chiavi sono gestite da questi ultimi; OneSpec non ha accesso alle chiavi e non ne conserva copia",
  "da completare e verificare con Convex":
    "il fornitore esegue backup dell'infrastruttura e OneSpec può esportare i dati; non sono al momento garantiti obiettivi contrattuali di RPO/RTO, che vengono verificati periodicamente e comunicati su richiesta",
  "da completare":
    "in caso di violazione di dati personali OneSpec avvia la procedura interna di contenimento e analisi e ne dà comunicazione al Cliente senza ingiustificato ritardo e comunque entro 72 ore dalla scoperta, affinché possa adempiere agli obblighi dell'art. 33 GDPR",
  "da completare a cura del responsabile compliance":
    "Regolamento (UE) 2016/679 (GDPR); Direttiva 2002/58/CE (ePrivacy); Direttiva 98/6/CE sull'indicazione dei prezzi; Direttiva 2005/29/CE sulle pratiche commerciali scorrette; per il mercato italiano D.Lgs. 196/2003, D.Lgs. 206/2005 (Codice del consumo) e la disciplina sulle detrazioni fiscali per la riqualificazione energetica; le regole di ciascun paese sono riviste a ogni aggiornamento del servizio e riportate con data e fonte nelle impostazioni del configuratore",
};

export function legalValue(key: string): string | undefined {
  const v = LEGAL_VALUES[key]?.trim();
  return v ? v : undefined;
}
