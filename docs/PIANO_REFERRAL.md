# Piano del sistema referral di OneSpec

Stato: **R1 implementata** (codici e collegamento alla registrazione, spenta di default); R2–R5 da fare. Piano da approvare nelle parti economiche. Data: 2026-10-02.

### Stato di implementazione

- **R1 (fatta):** tabelle `referralCodes` e `referrals`, campo `tenants.referredBy`, codice `OS-XXXXXX`, collegamento in `registerTenant`, regole anti auto-invito (stessa persona, stessa azienda, email usa-e-getta, invitante non pagante), cattura di `?ref=` nel browser (30 giorni), 31 test nuovi.
- **Interruttore:** tutto è **spento** finché non imposti `REFERRALS_ENABLED=1` nelle variabili Convex (`npx convex env set REFERRALS_ENABLED 1`). Spento: nessun codice si crea, ogni `?ref=` viene ignorato e la registrazione funziona come prima.
- **Non ancora fatto:** sconto al Checkout, qualifica dal pagamento, premio dopo 30 giorni, stesso Stripe customer / stessa carta, interfaccia, email, sito, limite per IP (R2–R5).
Obiettivo: far portare nuovi clienti dai clienti attuali, a costo basso e senza aprire falle (frodi, costi fuori controllo, problemi legali).

---

## 1. Decisioni da prendere prima di scrivere codice (servono a Stefan)

| # | Decisione | Mia raccomandazione |
|---|-----------|---------------------|
| 1 | Cosa riceve **chi invita** | **Credito sul proprio abbonamento** (non denaro). Importo fisso per piano dell'invitato, vedi tabella sotto. |
| 2 | Cosa riceve **chi viene invitato** | **−20% sul primo mese** (sconto Stripe una tantum). Sul Pro resta anche la prova gratuita già esistente. |
| 3 | Quando scatta il premio | Dopo il **primo pagamento reale** dell'invitato (non alla registrazione, non durante la prova) **e** dopo **30 giorni** senza rimborsi né contestazioni. |
| 4 | Limiti | Max **10 premi per cliente ogni 12 mesi**; credito mai convertibile in denaro. |
| 5 | Chi può invitare | Solo account con **abbonamento attivo** (non in prova, non sospesi, non "accesso completo" fondatore). |
| 6 | Regolamento | Un breve **regolamento referral** (pagina legale nuova) da far rivedere all'avvocato insieme agli altri testi. |

**Perché credito e non denaro.** Il pagamento in denaro apre obblighi fiscali e contabili (compenso a terzi, ritenute, fatture dell'invitante) e attira chi cerca solo il premio. Il credito è uno sconto sul prezzo: più semplice, già supportato da Stripe, e i clienti che lo ricevono restano.

**Importi proposti (da confermare, sono ordini di grandezza).**

| Piano dell'invitato | Prezzo/mese | Credito all'invitante | Sconto all'invitato (1° mese) | Costo massimo per te |
|---|---|---|---|---|
| Level 1 | €49,95 | €15 | €10 | €25 |
| Level 2 | €62,44 | €20 | €12,50 | €32,50 |
| Level 3 | €79,90 | €25 | €16 | €41 |
| Base | €97 | €30 | €19,40 | €49,40 |
| Pro | €197 | €60 | €39,40 | €99,40 |
| Agency | €397 | €100 | €79,40 | €179,40 |
| Enterprise (€690) | trattativa commerciale, fuori dal referral automatico |

Regola di sicurezza: il costo totale del premio non supera mai **un mese di abbonamento del nuovo cliente**. Un cliente che resta 12 mesi rende 12 volte quel costo.

**Cosa non farei all'inizio:** provvigioni ricorrenti (% a vita), più livelli (chi invita chi invita), pagamenti in denaro. Per agenzie e posatori che portano molti clienti, conviene un **programma partner** separato, più avanti.

---

## 2. Come funziona, passo per passo

1. **Codice personale.** Ogni cliente con abbonamento attivo ha un codice (es. `OS-7K4M2Q`, senza caratteri ambigui) e un link `https://onespec.eu/?ref=OS-7K4M2Q`.
2. **Arrivo dal sito.** Il sito legge `?ref=` e lo conserva 30 giorni nel browser (solo memoria locale, nessun cookie di tracciamento). Tutti i pulsanti verso la piattaforma ("Inizia ora", "Registrati") aggiungono `?ref=…` al link.
3. **Registrazione.** La piattaforma salva il codice sul nuovo account (`referredBy`). Controlli: il codice esiste, è attivo, non è dello stesso account.
4. **Checkout.** Se l'account è stato invitato, il Checkout Stripe applica automaticamente il coupon −20% (una tantum). Nota tecnica: Stripe non permette di usare insieme un coupon automatico e il campo "codice promozionale", quindi per gli invitati si usa il coupon e si nasconde il campo.
5. **Qualifica.** Quando arriva il primo pagamento non a zero dell'invitato (evento Stripe `invoice.paid`), il referral passa a *qualificato* e parte l'attesa di 30 giorni.
6. **Premio.** Un controllo giornaliero (cron) verifica che, dopo 30 giorni, l'invitato sia ancora attivo e senza rimborsi o contestazioni. Se sì, accredita all'invitante il credito sul **saldo cliente Stripe** (lo stesso meccanismo già mostrato dal badge "saldo" nell'app). Stripe lo scala dalla fattura successiva. Email di conferma.
7. **Se l'invitante non ha ancora un cliente Stripe** (caso raro), il credito resta in coda nel nostro registro e viene applicato appena esiste.

Stati di un referral: `pending` → `qualified` → `rewarded` (oppure `rejected` / `expired` / `clawback`).

---

## 3. Dati da aggiungere (Convex)

- `referralCodes`: `tenantId`, `code` (univoco, indice), `createdAt`, `disabledAt?`.
- `referrals`: `referrerTenantId`, `referredTenantId` (univoco: un account si può invitare una sola volta), `code`, `status`, `qualifiedAt?`, `holdUntil?`, `rewardCents?`, `discountCents?`, `stripeBalanceTxnId?`, `rejectionReason?`, `ipHash?`, `createdAt`.
- `tenants.referredBy?` (id del referral) e una funzione che restituisce statistiche per l'invitante.
- Ogni cambio di stato scrive su `auditLog` (già esiste).
- Idempotenza: il premio usa chiave `referral-<id>` verso Stripe, quindi un riavvio del cron non può accreditare due volte (stesso schema che usiamo per i webhook).

## 4. Anti-frode (la parte che decide se il sistema regge)

| Rischio | Difesa |
|---|---|
| Auto-invito con un secondo account | Stesso proprietario/email normalizzata, stesso dominio email aziendale, stessa **impronta carta** (già raccogliamo `trialFingerprints`), stesso Stripe customer → referral respinto. |
| Email usa-e-getta, account in serie | Blocco domini temporanei, limite di registrazioni con `ref` per indirizzo IP (hash) nelle 24 ore, tetto di 10 premi/anno. |
| Premio senza pagare davvero | Si qualifica solo con un pagamento non a zero e dopo 30 giorni. Le prove gratuite non contano. |
| Rimborso o contestazione dopo il premio | *Clawback*: il credito non ancora usato viene stornato; se già usato, il caso va in coda admin e blocca nuovi premi di quell'account. |
| Abuso della prova gratuita via referral | Resta la regola attuale: una prova per impronta carta. |
| Codici indovinati | Codice a 6 caratteri con alfabeto di 31 simboli, limite di tentativi per IP sul controllo codice. |

**Interruttore di emergenza:** variabile `REFERRALS_ENABLED` (Convex). Se spenta, non si creano premi e il campo sparisce; i premi già maturati si possono ancora accreditare.

## 5. Interfaccia

**Piattaforma**
- *Account → "Invita e risparmia"*: codice, link con "copia", condivisione WhatsApp/email, contatori (invitati, registrati, paganti, credito maturato, credito in attesa dei 30 giorni), regole in 5 righe, storico con nomi mascherati (es. "Se*** S.r.l.").
- Per l'invitato: nel Checkout e in Fatturazione la dicitura "Sconto invito applicato".
- Admin: pagina di revisione (referral sospetti, approva/respingi, esporta CSV).
- Tutti i testi nelle 6 lingue, come il resto.

**Sito (onespec.eu)**
- Lettura del parametro `?ref=` e passaggio ai link verso la piattaforma.
- Pagina "Programma invito" (spiegazione, regole, link al regolamento).

**Email (Resend, già configurato):** "Hai un nuovo invito registrato", "Il tuo credito di €X è stato accreditato", "Il tuo sconto invito è attivo".

## 6. Aspetti legali e di privacy

- **Regolamento referral** (nuovo testo legale): chi può partecipare, premio, tempi, limiti, rimborsi, divieto di spam e di invii non richiesti, diritto di OneSpec di annullare premi sospetti.
- **Solo B2B**, un solo livello: nessun rischio di sistema piramidale.
- **Dati dell'invitato** mostrati all'invitante solo in forma mascherata; aggiungere la finalità nell'informativa privacy.
- **Messaggi che i clienti inviano ai loro contatti:** devono essere inviati da loro stessi (il sistema non invia email a terzi per conto loro) per evitare problemi di marketing non richiesto.
- Il credito è **sconto sul prezzo**, non un compenso: da confermare con il commercialista (trattamento IVA).

## 7. Fasi di lavoro

| Fase | Contenuto | Esito verificabile |
|---|---|---|
| **R0** Decisioni | Importi, limiti, regolamento (sezione 1) | Documento approvato da Stefan |
| **R1** Fondamenta | Tabelle, generazione codice, collegamento alla registrazione, test | Codice generato e salvato; self-invito respinto (test) |
| **R2** Soldi | Coupon al Checkout, qualifica da `invoice.paid`, cron del premio, clawback | Test end-to-end con Stripe in modalità prova: invito → pagamento → +30 giorni simulati → credito |
| **R3** Interfaccia | Pagina Account, email, 6 lingue, pagina admin | Schermate verificate su desktop e telefono |
| **R4** Sito | Passaggio di `?ref=`, pagina Programma invito | Il codice arriva dal sito alla registrazione |
| **R5** Lancio protetto | Interruttore attivo solo per 10 clienti pilota, monitoraggio | Nessun premio anomalo in 30 giorni |

Tempi indicativi di sviluppo: R1 ½ giornata, R2 1 giornata, R3 1 giornata, R4 ½ giornata, R5 un mese di osservazione. Il passaggio R2 è il più delicato perché tocca i pagamenti: lo farei con test automatici prima e un controllo in Stripe modalità prova.

## 8. Test previsti (R1–R2)

Generazione e unicità del codice · codice inesistente/disattivato · auto-invito (stesso proprietario, stessa carta, stesso dominio) · un account invitato una sola volta · coupon applicato solo agli invitati · qualifica solo con fattura non a zero · nessuna qualifica durante la prova · attesa 30 giorni rispettata · idempotenza del premio (cron eseguito due volte) · tetto 10 premi/anno · clawback dopo rimborso · interruttore `REFERRALS_ENABLED` spento · invitante senza cliente Stripe.

## 9. Come misurare se funziona

Registrazioni da referral / paganti da referral, costo per cliente portato (premio + sconto), tasso di frode respinta, permanenza a 3 e 6 mesi dei clienti referral rispetto agli altri. Se il costo per cliente portato supera un mese di abbonamento, si rivedono gli importi.

## 10. Rischi e opinione sincera

- Il referral funziona se i clienti sono **soddisfatti e vedono il vantaggio**: prima del lancio massivo servono i primi clienti reali contenti. Con pochi clienti il sistema produce pochi inviti.
- Il rischio vero non è tecnico ma di **costo e frode**: per questo credito invece di denaro, attesa di 30 giorni e pagamento reale obbligatorio.
- Non lo costruirei prima del lancio e di qualche decina di clienti paganti: ora è meglio chiudere pagamenti live, testi legali e statistiche. Ha senso iniziare R0 (decisioni e regolamento) ora, perché richiede il parere dell'avvocato.
