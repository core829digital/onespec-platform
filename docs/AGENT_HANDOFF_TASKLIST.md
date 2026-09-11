# OneSpec — Task list per agente IA parallelo (estratto dal prompt utente, 2026-09-11)

Documento copiabile: passa questo file intero come contesto a un altro agente
IA che deve lavorare in parallelo su questo repo. Riferimento di base:
`PROJECT_MEMORY.md` (root repo) — architettura, entitlement, roadmap FASE 0-10.
Questo doc NON lo sostituisce, lo specializza sui task nuovi del prompt utente
del 2026-09-11 (pagine + configuratore nuovo + info sito).

**Regole ferree per chi esegue** (dal CLAUDE.md di progetto):
- Gate obbligatorio prima di ogni commit: `npx tsc --noEmit`, `npx eslint src convex`,
  `npx vitest run`, `npm run build` — tutti verdi.
- Niente `Co-Authored-By` nei commit.
- Non toccare file fuori scopo del task assegnato; 1 writer per worktree.
- Leggi sempre un file prima di editarlo.

---

## 0. Risposte dell'utente alle 6 domande di chiusura piano

L'utente ha approvato il piano generale e risposto così (testo originale IT):

1. "Inizia con la fase A" → **si parte da FASE 0/1 della roadmap** in
   `PROJECT_MEMORY.md` §6: prima i 4 piani abbonamento (blocca il billing
   reale), poi calcolatore installatore. Interpretazione: "fase A" = prima
   fase eseguibile del piano concordato, non una lettera con mappatura
   propria salvata altrove — se l'agente precedente aveva definito Fase
   A/B/C/D con contenuto diverso da FASE 0-10 di `PROJECT_MEMORY.md`,
   quella definizione non è recuperabile in questa sessione: usare la
   roadmap di `PROJECT_MEMORY.md` §6 come fonte di verità.
2. "Sequential execution" → **niente parallelismo tra fasi grosse**: una
   fase alla volta, gate verde prima di passare alla successiva. Dentro
   una fase, sotto-task indipendenti su file diversi possono girare in
   parallelo (worktree separate), ma senza sovrapporsi.
3. "No, ancora le devo sistemare" (riferito a Stripe API keys/webhook) →
   **le chiavi Stripe non ci sono ancora**. Costruire tutta la logica
   billing (checkout, trial, webhook handler) in modo che funzioni non
   appena le env var vengono impostate, ma **non bloccare il resto del
   lavoro aspettandole**. Task esplicito in coda: *"Stripe API keys +
   webhook setup — in attesa che l'utente le fornisca"* (vedi §6 sotto).
4. "Dopo il Wiring i18n" → ordine di sequenza: prima si completa il wiring
   i18n (FASE 9 in `PROJECT_MEMORY.md`: coprire le ~195 chiavi mancanti,
   smettere di hardcodare IT), **poi** si procede con [il task immediatamente
   successivo nel piano concordato — non specificato altrove in questa
   sessione, verificare con l'utente il riferimento esatto se ambiguo in
   fase di esecuzione].
5. "Tutte e due, vedi un po cosa e meglio" → entrambe le opzioni proposte
   da fare, a discrezione tecnica dell'agente esecutore su quale ordine/
   implementazione è meglio.
6. "Non ti so rispondere, vedi cosa e meglio" → decisione lasciata alla
   discrezione tecnica dell'agente esecutore.

**Nota per l'agente che riceve questo file**: i punti 4-6 fanno riferimento
a domande specifiche di un piano intermedio (Plan Mode) che non è stato
salvato per intero in questa sessione — solo le risposte sono arrivate.
Se il contenuto esatto delle domande 4/5/6 è necessario per procedere,
chiedere conferma all'utente prima di agire, invece di indovinare.

---

## 1. Task per pagina (nuovi, dal prompt utente)

### `/dashboard`
- Pie chart clienti (distribuzione per categoria/tipo cliente — dipende
  dalla nuova pagina `/clients`, vedi §2).
- Widget "utilizzo piano": preventivi/configuratori/team usati vs quota
  (`entitlementsFor`/`resolveTenantEntitlements` già espone i numeri,
  serve solo la UI).
- Grafici modulari per metrica (analytics), riusabili — no chart hardcoded
  monolitico.

### `/configurators`
- Più pulsanti in evidenza per card configuratore, non solo "Modifica"
  (che resta, ma meno evidenziato):
  - "Apri configuratore" (anteprima live, link `/w/[publicId]` o `/c/[publicId]`).
  - Analytics richieste per quel configuratore, visibile dentro il container
    della card (non pagina separata).

### `/requests`
- Aggiungere colonna/tabella con numero di telefono del lead.

### `/quotes`
- Modal preventivo B2B (cantiere/tablet) → **full width** (oggi probabilmente
  ristretto, verificare contro §4 di `PROJECT_MEMORY.md`).
- Aggiornare il preventivatore con l'ultima versione del configuratore nuovo
  (vedi §3 sotto — non è un semplice restyle, è porting di funzionalità).

### `/showroom`
- **Bug da riprodurre e fixare**: "Nessun configuratore pubblicato. Pubblica
  un catalogo per utilizzare un preventivatore da showroom" appare anche
  quando un configuratore è effettivamente pubblicato. Sospetto (utente):
  manca un fetch/data-flow che rilegga lo stato dopo la pubblicazione (query
  Convex non invalidata/refetchata, o campo di stato non aggiornato).
  Root-cause reale ipotizzata in `PROJECT_MEMORY.md` §3 per il bug 404
  gemello: query che torna `null` per tenant/editor non trovato, trattata
  come "non pubblicato" invece di errore vero — verificare la stessa causa
  qui.
- **Domanda aperta dall'utente, verificare come task**: un configuratore
  pubblicato dovrebbe portare con sé anche il catalogo (prodotti/prezzi)
  incluso? Controllare schema/relazione `configurators` ↔ `catalog*` e,
  se manca il collegamento, ripararlo.

### `/surveys`
- Sistemare la telemetria laser + connessione Bluetooth con i dispositivi
  elencati (`src/lib/bluetooth-laser.ts` già esiste, non ancora committato
  — vedi `git status`: file nuovo non tracciato). Oggi il rilevamento
  manuale funziona ma è lento; l'obiettivo è rendere il flusso Bluetooth
  realmente utilizzabile end-to-end (pairing, letture live, fallback
  manuale sempre disponibile).

### `/installations`
- Garantire che ogni paese abbia una pagina/vista dedicata coerente con la
  sua compliance (FR/BE/NL/DE/LU — vedi backlog paese in `PROJECT_MEMORY.md`
  §7).
- Rilevamento automatico del paese dell'utente; se un utente tenta di
  accedere ai contenuti di un altro paese, **redirect automatico** al
  proprio paese (mitigazione anti-abuso/anti-scraping cross-market, non
  solo UX — trattarlo come controllo di sicurezza a livello di route/middleware,
  non solo redirect client-side).

### `/inspections`
- Collegare automaticamente cliente + cantiere per precompilare i dati
  (dipende dalla nuova infrastruttura clienti/cantieri, §2).

### `/analytics`
- Migliorare con pie chart, grafici animati e **dati reali** (non mock).
- Usare GSAP e/o Framer Motion per le animazioni.

### `/notifications`
- Verificare che le preferenze di notifica funzionino davvero (persistenza,
  effetto reale sull'invio, non solo UI toggle).

### `/account`
- Verificare che tutti i toggle on/off e dropdown siano funzionalmente
  collegati (non solo visivi).

---

## 2. Nuove pagine/infrastruttura richieste

### `/clients` (nuova)
- Ogni cliente ha una "cartella" dedicata con sotto-cartelle automatiche:
  categoria/tipo cliente, dati cliente, PDF generati per quel cliente,
  e ogni altro dato rilevante già presente altrove in piattaforma
  collegato a lui.
- **Collegamento multi-direzionale**: da qualunque pagina rilevante
  (requests, quotes, surveys, inspections, installations, analytics) deve
  essere possibile selezionare un cliente esistente via dropdown, e un
  cliente può avere **più cantieri** (dropdown annidato/cascata cliente→
  cantiere). Selezionare in un punto deve popolare automaticamente i campi
  collegati altrove (client come "hub" di business logic, non solo
  anagrafica passiva).
- Implicazione dati: serve una tabella `clients` (+ relazione a cantieri/
  `sites` se non esiste già) con riferimenti da `quotes`, `surveys`,
  `inspections`, `installations`, PDF generati. Verificare schema attuale
  prima di aggiungere — non duplicare entità già esistenti sotto altro nome.

### `/cantieri` (nuova) — gestione cantieri
- Vista Kanban cantieri.
- Gestione team per cantiere: creazione membro custom (nome, cognome,
  email, telefono).
- **Accesso guest via link + PIN**: invito per email con link dedicato al
  cantiere; l'accesso richiede un PIN numerico a 6 cifre; una volta
  verificato, crea una sessione "infinita" su quel dispositivo (guest
  account persistente); da un altro dispositivo si rientra con lo stesso
  link+PIN. Ogni membro team ha un codice univoco che lo identifica.
  **Nota sicurezza per chi implementa**: sessione "infinita" legata a un
  PIN a 6 cifre è debole contro brute-force se non rate-limitata — va
  quantomeno aggiunto un rate-limit/lockout sul tentativo PIN e scadenza
  del link di invito, anche se l'utente non l'ha chiesto esplicitamente
  (rischio di sicurezza reale, da segnalare/implementare comunque).
- Contenuti pagina cantiere: chat di gruppo, profilo guest (badge "membro
  team"), upload documenti, upload foto, kanban cantiere, task giornaliere.

---

## 3. Il nuovo configuratore (porting da HTML standalone)

Riferimento file: cartella
`"CONFIGURATORE NUOVO AGGIORNATO PER MONTATORI, RIVENDITORI E SHOWROOM"`
(root repo) — contiene `index.html` (bundle React ~1MB, Tailwind, PWA:
`manifest.json`, `sw.js`, icone), più note di analisi (`Codul tau nu e un
simplu widget.pdf`, `TEXT PENTRU KIMI 2.6 - DIRIJOR.txt`) e materiale
commerciale (`OFERTA.jpg`, `Offerta_2026-09-09.txt`, `PAGINA DE START.jpg`).
**Non è un widget**: è un'app PWA standalone full-page. Va trattato come
sorgente di funzionalità da portare nel preventivatore esistente
(`/quotes`, `src/shared/pricing.ts`, `spec-drawing.tsx`), non incollato as-is.

Funzionalità da estrarre e portare:
- Configurazione multi-pezzo con ante multiple (`sashes`, flag `isMain`,
  stato `active`/`fisso`).
- Tipologie anta: fissa, battente (`casement`), anta-ribalta (`tilt-turn`),
  vasistas (`tilt`), scorrevole (`sliding`), alzante-scorrevole (`lift-slide`)
  — mappare su ciò che già esiste in `sash-editor.tsx`/`sash-panel.tsx`
  (orfani, da riattivare per FASE 5/§5 di `PROJECT_MEMORY.md`).
- Ferramenta: standard / RC2 (+55€) / hidden, colori ferramenta, slider
  altezza maniglia con calcolo percentuale.
- Accessori Italia: zanzariere, cassonetti, tapparelle/avvolgibili,
  persiane in alluminio, ciascuno con sovrapprezzo.
- Anteprima SVG interattiva con resize live (riusa `SpecDrawing` esistente
  se possibile invece di reimplementare).
- Calcolo preventivo: totale, Uw medio, dettaglio righe.
- Flow vendita italiano: nome, WhatsApp (prefisso 39), comune, link foto,
  CTA "Richiedi sopralluogo gratuito", promessa "Preventivo definitivo in 2h".
- Export: HTML, TXT, PDF, condivisione WhatsApp, email precompilata, sync,
  storico, pannello admin.

Gap noti da chiudere quando si porta questa roba nella piattaforma reale
(dall'analisi del PDF romeno allegato, valutazione realistica):
- **GDPR consent esplicito assente** nel prototipo — nella piattaforma
  reale è già gestito altrove? verificare, non riportare il gap.
- **Nessun aggancio a listino gestionale** — nella piattaforma reale il
  prezzo passa da `src/shared/pricing.ts`/Convex, quindi questo gap non
  si riporta (già risolto architetturalmente).
- **Nessun calcolo detrazioni fiscali 50%/Ecobonus** — verificare se
  `FiscalEngine`/`computeUw`/regione IT già lo copre; se non lo fa, è un
  gap reale da chiudere perché "prima domanda del cliente italiano".
- Se in futuro si vuole anche una versione **widget embeddabile** (iframe/
  Web Component + `postMessage`, code-splitting, CSS isolato, modalità
  `?embed=1`): la piattaforma **ha già** questo pattern in `/w/[publicId]`
  — usare quello come base, non ripartire dal bundle 1MB dell'HTML.

---

## 4. Info da aggiornare sul sito onespec (marketing) — ✅ FATTO

Repo separato: `onespec-website` (sibling di `onespec-platform`, stesso
livello cartella). Modifiche applicate in questa sessione, commit
`4b833cf` (non pushato — push da fare solo su richiesta esplicita):

- `src/lib/site-config.ts`: email `hello@onespec.it` → **`hello@onespec.eu`**.
- `src/components/showcase/iframe-explainer.tsx` e
  `src/components/showcase/embed-code-card.tsx`: URL esempio embed
  `https://app.onespec.it/...` → **`https://platform.onespec.eu/...`**
  (Website Domain: `onespec.eu`, Platform Domain: `platform.onespec.eu`,
  come indicato dall'utente).

Non toccata la piattaforma stessa (`onespec-platform`) per questo punto,
come richiesto esplicitamente ("non modificare niente dalla piattaforma,
fai solo quello che ti ho detto").

**Nota**: `metadataBase` in `onespec-platform/src/app/layout.tsx` è già
`https://onespec.eu` — coerente, nessuna modifica necessaria lì.

---

## 5. Task Stripe (bloccato in attesa dell'utente)

- L'utente non ha ancora fornito le API key Stripe né configurato i
  webhook. Task da tenere in coda, **non bloccante per il resto**:
  1. Costruire/completare `convex/billing.ts` (checkout session, portal
     session, webhook handler, `applyWebhookEvent`) assumendo env var
     `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price ID per piano×
     regione×ciclo (24 Price ID per la matrice 4 piani×6 regioni×2 cicli,
     vedi `PROJECT_MEMORY.md` §2 decisione D5).
  2. **Requisito di business esplicito**: l'utente paga → accesso alla
     piattaforma; non paga → niente accesso. Eccezione: piano **Pro**
     con Freemium/free-trial (14gg, carta richiesta subito via Stripe
     `trial_period_days:14`, auto-conversione a fine trial senza azione
     utente — decisione D1 già chiusa in `PROJECT_MEMORY.md` §2).
     **Enterprise NON ha trial gratuito** — leggere bene: solo Pro.
  3. Dopo pagamento riuscito (o attivazione trial Pro), redirect a
     **setup wizard** della piattaforma (verificare se esiste già una
     route onboarding; se no, va creata).
  4. Il gate "suspended → niente accesso" va implementato in
     `convex/lib/auth.ts` (`requireMembership`), con whitelist di funzioni
     billing/account-read che restano accessibili a un tenant suspended
     così può pagare per riattivarsi (altrimenti si blocca da solo).

---

## 6. Riferimento rapido — cosa NON reinventare

Prima di ogni nuovo task sopra, controllare in `PROJECT_MEMORY.md`:
- §1.5 componenti orfani già scritti (`MultiSupplierTable.tsx`,
  `sash-editor.tsx`/`sash-panel.tsx`, `ShowroomWidget`/`VisualSimulator`/
  `MaterialConfig`/`FiscalEngine`, 3 PDF `@react-pdf/renderer` morti).
- §3 bug list con stato reale verificato (non tutti i bug segnalati sono
  bug veri — es. la route `/configurators/[id]` esiste ed è corretta).
- §5 piano calcolatore installatore già detto in dettaglio (9 gap numerati).
- §7 backlog compliance paese-specifica e conversione vendite dai PDF
  strategia (FR/BE/NL/DE/LU + follow-up cron + SLA lead + peak-hours +
  pagina pubblica preventivo `/q/[token]`).
