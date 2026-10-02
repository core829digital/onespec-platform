# Piano del sistema referral di OneSpec

Stato: **R1, R2 e R3 implementate** (codici, collegamento, sconto, qualifica, premio, storno, pagina utente, email, pagina admin; spente di default); R4–R5 da fare. Piano da approvare nelle parti economiche. Data: 2026-10-02.

### Stato di implementazione

- **Decisione economica (2026-10-02, Stefan):** l'invitante riceve il **10%** del prezzo di listino dell'abbonamento dell'invitato, **IVA esclusa**, una volta per ogni azienda invitata; l'invitato ha il **10% di sconto** sul primo pagamento. Il costo totale è il 20% di un periodo di fatturazione e il primo periodo dell'invitato porta comunque l'80% del prezzo. Il calcolo è sul listino del piano e del ciclo acquistati (annuale = mensile × 10). Il premio può essere **credito sul saldo Stripe** (predefinito) oppure **denaro trasferito sul conto Stripe dell'invitante** (Stripe Connect, vedi sotto): la scelta è del titolare dell'account invitante. Il pagamento in denaro è un compenso a terzi (fattura/ricevuta, ritenute): da validare con il commercialista prima di attivarlo.
- **R1 (fatta):** tabelle `referralCodes` e `referrals`, campo `tenants.referredBy`, codice `OS-XXXXXX`, collegamento in `registerTenant`, regole anti auto-invito, cattura di `?ref=` nel browser (30 giorni).
- **R2 (fatta):** coupon Stripe del 10% (valido un mese di abbonamento, così copre anche la prima fattura dopo la prova gratuita del Pro e l'unica fattura annuale), qualifica dal primo pagamento reale con controllo stessa carta/stesso cliente, attesa di 30 giorni, credito sul saldo Stripe idempotente, tetto 10 premi in 12 mesi, storno su rimborso/contestazione, scadenze. Tutto via API Stripe, nessun nuovo webhook.
- **R3 (fatta):**
  - Pagina **Account → "Invita e risparmia"** (`/app/account/referral`): codice, link con copia, WhatsApp/email, contatori, credito ricevuto e in arrivo, tabella importi per piano, storico con nomi mascherati. Compare nel menu solo a proprietari/amministratori di un account con abbonamento attivo e solo se il programma è acceso.
  - **Tre email** nelle 6 lingue: all'invitato ("hai il 10% di sconto"), all'invitante ("un'azienda si è registrata", senza dati personali dell'invitato), all'invitante ("credito accreditato").
  - **Pagina admin** `/app/admin/referrals`: elenco con i motivi di rifiuto, filtro per stato, Riapri / Respingi / Disattiva-riattiva codice, esportazione CSV. Ogni azione è registrata nell'audit.
- **Importi:** nessuna tabella fissa; solo le due percentuali in `convex/lib/referralRewards.ts`.
- **Interruttore:** tutto è **spento** finché non imposti `REFERRALS_ENABLED=1` nelle variabili Convex. Spento: nessun codice nuovo, nessuno sconto, nessuna nuova qualifica, nessun menu; i premi già maturati vengono comunque accreditati.
- **Non ancora fatto:** passaggio del `?ref=` dal sito e pagina "Programma invito" sul sito (R4), regolamento legale del programma, limite di registrazioni per IP, pilota con 10 clienti (R5).

---

## 1. Decisioni da prendere prima di scrivere codice (servono a Stefan)

| # | Decisione | Mia raccomandazione |
|---|-----------|---------------------|
| 1 | Cosa riceve **chi invita** | **10% del prezzo (IVA esclusa) come credito sul proprio abbonamento** (non denaro). |
| 2 | Cosa riceve **chi viene invitato** | **−10% sul primo pagamento** (coupon Stripe). Sul Pro resta anche la prova gratuita già esistente. |
| 3 | Quando scatta il premio | Dopo il **primo pagamento reale** dell'invitato (non alla registrazione, non durante la prova) **e** dopo **30 giorni** senza rimborsi né contestazioni. |
| 4 | Limiti | Max **10 premi per cliente ogni 12 mesi**; credito mai convertibile in denaro. |
| 5 | Chi può invitare | Solo account con **abbonamento attivo** (non in prova, non sospesi, non "accesso completo" fondatore). |
| 6 | Regolamento | Un breve **regolamento referral** (pagina legale nuova) da far rivedere all'avvocato insieme agli altri testi. |

**Perché credito e non denaro.** Il pagamento in denaro apre obblighi fiscali e contabili (compenso a terzi, ritenute, fatture dell'invitante) e attira chi cerca solo il premio. Il credito è uno sconto sul prezzo: più semplice, già supportato da Stripe, e i clienti che lo ricevono restano.

**Importi (decisi il 2026-10-02): 10% e 10%.** L'invitante riceve il 10% del prezzo di listino dell'abbonamento dell'invitato, IVA esclusa, una volta per azienda; l'invitato ha il 10% di sconto sul primo pagamento. Esempi con pagamento mensile: Base 97 € → credito 9,70 €; Pro 197 € → 19,70 €; Agency 397 € → 39,70 €. Con pagamento annuale (mensile × 10): Base 970 € → 97 €; Pro 1.970 € → 197 €. Costo totale per OneSpec: il 20% di un periodo di fatturazione; il primo periodo porta comunque l'80% del prezzo. Enterprise (690 €) è fuori dal referral automatico.

**Cosa non farei all'inizio:** provvigioni ricorrenti (% a vita), più livelli (chi invita chi invita), pagamenti in denaro. Per agenzie e posatori che portano molti clienti, conviene un **programma partner** separato, più avanti.

---

## 2. Come funziona, passo per passo

1. **Codice personale.** Ogni cliente con abbonamento attivo ha un codice (es. `OS-7K4M2Q`, senza caratteri ambigui) e un link `https://onespec.eu/?ref=OS-7K4M2Q`.
2. **Arrivo dal sito.** Il sito legge `?ref=` e lo conserva 30 giorni nel browser (solo memoria locale, nessun cookie di tracciamento). Tutti i pulsanti verso la piattaforma ("Inizia ora", "Registrati") aggiungono `?ref=…` al link.
3. **Registrazione.** La piattaforma salva il codice sul nuovo account (`referredBy`). Controlli: il codice esiste, è attivo, non è dello stesso account.
4. **Checkout.** Se l'account è stato invitato, il Checkout Stripe applica automaticamente il coupon −10% (una tantum). Nota tecnica: Stripe non permette di usare insieme un coupon automatico e il campo "codice promozionale", quindi per gli invitati si usa il coupon e si nasconde il campo.
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
