# OneSpec — Piano d'implementazione esteso (dal prompt utente 2026-09-11)

Piano scritto, per fasi e task, di tutto ciò che l'utente ha chiesto nel
prompt del 2026-09-11. Fonde: task per pagina, nuove pagine `/clients` e
`/cantieri`, porting del nuovo configuratore B2B, task Stripe, aggiornamento
sito onespec.eu (✅ già fatto), e la roadmap pre-esistente di
`PROJECT_MEMORY.md`. Ordine = ordine di esecuzione consigliato, sequenziale
fase per fase (risposta utente: "Sequential execution").

Riferimenti doc correlati (non duplicare contenuto, solo linkare):
`PROJECT_MEMORY.md` (architettura + entitlement 4 piani + bug list reale),
`docs/AGENT_HANDOFF_TASKLIST.md` (stesso materiale in forma "handoff", più
sintetico, pensato per essere copiato a un agente terzo).

Gate obbligatorio ad ogni fase prima di commit: `npx tsc --noEmit`,
`npx eslint src convex`, `npx vitest run`, `npm run build`. Niente
`Co-Authored-By`. Un writer per worktree.

---

## FASE 0 — Già fatta in questa sessione ✅

- Fix build produzione (`messages/it.json` JSON malformato) — commit `cbecc6a`.
- `PROJECT_MEMORY.md` creato + finalizzato con decisioni utente (D1-D3
  chiuse) — commit `f44d4dc`, `b29ac08`.
- Sito onespec.eu: email `hello@onespec.eu`, domini
  `onespec.eu`/`platform.onespec.eu` — repo `onespec-website`, commit
  `4b833cf`, pushato.
- `docs/AGENT_HANDOFF_TASKLIST.md` — commit `80ed531`.
- Questo documento.

---

## FASE 1 — Piani abbonamento 4-tier (Starter/Pro/Enterprise/Showroom)

Priorità massima: blocca il billing reale. Design già chiuso in
`PROJECT_MEMORY.md` §2 (entitlement matrix, trial Pro 14gg, grandfather
Starter 50/mese, Enterprise=Showroom feature-parity con cap numerici).

1.1. `convex/lib/enums.ts` — allargare `PLAN_TIERS` a
     `["starter","pro","business","enterprise","showroom","alpha"]`
     (`business` resta temporaneamente per non rompere dati esistenti).
1.2. `convex/lib/entitlements.ts` — riscrivere matrice 4 piani (+`alpha`)
     secondo `PROJECT_MEMORY.md` §2. Aggiungere `quotaOverrideQuotesPerMonth`
     alla lettura (`tenant.quotaOverrideQuotesPerMonth ?? entitlement.maxQuotesPerMonth`).
1.3. `convex/schema.ts` — campo `tenants.quotaOverrideQuotesPerMonth?: number`,
     `tenants.trialEndsAt?: number`, widening union `plan`.
1.4. `convex/lib/billingPlans.ts` — 4 piani × 6 regioni × 2 cicli, prezzi
     provvisori da `PROJECT_MEMORY.md` §2 (marcati `PROVVISORIO` in commento).
1.5. Migrazione dati one-off: `business` → `pro`; tenant già Starter →
     settare `quotaOverrideQuotesPerMonth = 50`. Nessun framework
     migrazioni nel repo: scrivere `internalMutation` dedicata in
     `convex/migrations/` (nuova cartella) + eseguirla manualmente una volta.
1.6. `convex/billing.ts` — checkout session con `trial_period_days: 14`
     solo per piano Pro; portal session; webhook handler
     (`applyWebhookEvent`) per `customer.subscription.trial_will_end`,
     `invoice.payment_failed` (→ `planStatus: "past_due"`),
     `customer.subscription.deleted` (→ `"suspended"`).
1.7. `convex/crons.ts` — cron `trial-sweep` (giornaliero): individua trial
     Pro scaduti senza pagamento riuscito → gestito nativamente da Stripe
     (auto-charge), il cron serve solo a sincronizzare stato locale se il
     webhook fallisce/arriva in ritardo (safety net, non fonte di verità).
1.8. `convex/lib/auth.ts` — `requireMembership`: aggiungere gate
     `planStatus === "suspended"` → throw, con whitelist funzioni
     billing/account-read (altrimenti un tenant suspended non può
     riattivarsi pagando).
1.9. Enforcement quote/cap nei call-site: `convex/configurators.ts`,
     `convex/quotes.ts`, `convex/widget.ts`, `convex/calculations.ts`,
     `convex/surveys.ts`, `convex/installations.ts`, `convex/inspections.ts`,
     `convex/passports.ts` — usare `checkQuota`/`assertQuota` già esistenti,
     solo aggiornare ai nuovi limiti.
1.10. UI billing: 4 card piano (`account/billing`), banner trial attivo con
      giorni rimanenti, badge upgrade quando quota vicina al limite.
1.11. Onboarding: step scelta piano dopo signup → redirect a setup wizard
      dopo pagamento/attivazione trial riuscito (vedi FASE 8 Stripe per
      cosa manca lato config esterna).
1.12. Admin tool: override manuale piano/quota per un tenant (supporto).

**Nota bloccante**: Stripe API keys e webhook secret non sono ancora stati
forniti dall'utente (risposta utente, punto 3: "No, ancora le devo
sistemare"). Scrivere 1.6/1.7 in modo che compili e sia testabile a vuoto
(mock/interfaccia), ma il flusso end-to-end reale resta non verificabile
finché l'utente non fornisce le chiavi — task separato, vedi FASE 8.

---

## FASE 2 — Calcolatore installatore (sopralluogo) — upgrade

Dettaglio già in `PROJECT_MEMORY.md` §5 (9 gap numerati). Ordine consigliato:

2.1. De-duplicare `serverCalculate`/`getCalculationPreview` (prerequisito
     tecnico, va fatto prima di estendere la logica altrimenti si duplica
     il lavoro due volte).
2.2. Handoff Rilievo → Preventivo: bottone "Genera preventivo da rilievo"
     su survey completato, precompila `quotes/new` (fori L×H, diagnosi,
     foto), settare `siteSurveys.quoteId` da UI (oggi mai settato).
2.3. Editor per-anta completo: riattivare `sash-editor.tsx`/`sash-panel.tsx`
     (tipo, direzione, ferramenta+colore, altezza maniglia slider,
     validazione min-size, regole combinazione scorrevole).
2.4. Aggregatore multi-fornitore: nuova tabella `catalogSuppliers`, campo
     `quoteRequests.supplierLines[]`, wire `MultiSupplierTable.tsx`,
     ri-somma sempre server-side.
2.5. Simulatore rata mensile interattivo (slider UI su
     `calculateMonthlyRate` già esistente, nessun cambio server).
2.6. Uw per pezzo + osservazioni testo libero per riga (già calcolabile
     via `computeUw`).
2.7. Bottoni Maps/Waze: verificare/estendere da `/i/[token]` alle altre
     pagine campo (survey, inspection).
2.8. Offline: stessa coda `offline-sync.ts` del Rilievo.
2.9. Gate piano: calcolatore da Starter (cap 20/mese); multi-fornitore e
     modalità-showroom solo Enterprise/Showroom.

---

## FASE 3 — Porting funzionalità dal nuovo configuratore B2B

**Nuovo materiale caricato dall'utente** in questa sessione (path):
`CONFIGURATORE NUOVO AGGIORNATO PER MONTATORI, RIVENDITORI E SHOWROOM/`
— confermato via ispezione diretta della cartella: bundle Vite/React
compilato (non sorgente): `assets/index-L_BNtqYG.js` (~280KB minificato),
`assets/index.es-*.js`, dipendenze bundlate `jspdf` (export PDF),
`html2canvas` (export immagine/screenshot), `purify` = DOMPurify
(sanitizzazione HTML), CSS Tailwind compilato. PWA completo: `manifest.json`,
`sw.js`, icone `icon-192.png`/`icon-512.png`, `apple-touch-icon.png`,
cartella `deploy/` con build pronta per hosting standalone. Materiale di
contesto/vendita nella stessa cartella: `Codul tau nu e un simplu widget.pdf`,
`TEXT PENTRU KIMI 2.6 - DIRIJOR.txt` (analisi tecnica in romeno, già letta
e riportata in `PROJECT_MEMORY.md`), `OFERTA.jpg`, `Offerta_2026-09-09.txt`,
`PAGINA DE START.jpg` (materiale commerciale, non codice).

Confermato per grep diretto sul bundle: stringhe `RC2`, `zanzariera`,
`sopralluogo`, `WhatsApp`/`whatsapp` presenti nel JS minificato →
corrispondono esattamente alle funzionalità già descritte in
`PROJECT_MEMORY.md` §1.4/§5 e in `docs/AGENT_HANDOFF_TASKLIST.md` §3.
Nessuna sorpresa rispetto all'analisi precedente: è la stessa app PWA
standalone, non un widget imbeddabile — trattare come **fonte di
funzionalità da portare**, non come componente da montare direttamente
(bundle monolitico, non code-split, CSS non isolato dall'host).

3.1. Estrarre/confermare mapping funzionalità → componenti piattaforma
     esistenti (nessuna reimplementazione da zero dove già esiste):
     - Multi-pezzo/multi-anta + tipologie anta → FASE 2.3 (`sash-editor.tsx`).
     - Ferramenta RC2/hidden + colori + slider maniglia → FASE 2.3.
     - Accessori (zanzariere, cassonetti, avvolgibili, persiane alluminio)
       → verificare presenza in `src/shared/pricing.ts`/catalogo prodotti;
       aggiungere le voci mancanti con relativo sovrapprezzo.
     - Anteprima SVG interattiva con resize live → riusare `SpecDrawing`
       esistente (drag-resize, warning min-size) invece di portare quella
       del bundle.
     - Export PDF → valutare se serve `jspdf` (client-side) o se si resta
       su `@react-pdf/renderer` server-side già in uso nel resto della
       piattaforma (preferibile per consistenza: **non aggiungere una
       seconda libreria PDF client-side**, riusare lo stack esistente).
     - Export screenshot/immagine (`html2canvas`) → verificare se serve
       davvero o se l'export PDF/HTML già copre il caso d'uso; evitare
       dipendenza in più se ridondante.
     - Flow WhatsApp/comune/foto/CTA "sopralluogo gratuito 2h" → già
       pattern esistente nel widget B2C (`wsB2`, WhatsApp summary share),
       replicare stesso pattern lato B2B invece di portare codice nuovo.
3.2. **Non installare/servire il bundle as-is** in produzione: è
     un'app standalone non code-split, CSS non isolato — rischio di
     conflitto con lo stack Tailwind/Next esistente. Se serve una demo
     live rapida, ospitarla isolata (subdominio proprio o pagina statica
     separata), mai dentro l'app Next principale.
3.3. Se in futuro si vuole la versione embeddabile via iframe/Web
     Component (`postMessage`, `?embed=1`, code-splitting): riusare il
     pattern già esistente `/w/[publicId]` come base — non ripartire dal
     bundle da 1MB.
3.4. Gap da verificare/chiudere durante il porting (dall'analisi PDF,
     vedi anche `docs/AGENT_HANDOFF_TASKLIST.md` §3): consenso GDPR
     esplicito (verificare se già gestito altrove in piattaforma),
     calcolo detrazioni fiscali 50%/Ecobonus per IT (verificare
     `FiscalEngine`/regione IT, prima domanda che fa un cliente italiano).

---

## FASE 4 — Task per pagina (dal prompt utente)

Dettaglio completo per ciascuna pagina in `docs/AGENT_HANDOFF_TASKLIST.md`
§1 (non ripetuto qui per evitare doppia fonte di verità). Ordine consigliato
di esecuzione all'interno della fase, dal più isolato/basso-rischio al più
strutturale:

4.1. `/requests` — colonna telefono (task isolato, un file, basso rischio).
4.2. `/configurators` — pulsanti evidenziati + apri/analytics in card.
4.3. `/quotes` — modal B2B full width (dipende da FASE 3 per il contenuto
     del preventivatore aggiornato).
4.4. `/showroom` — bug "nessun configuratore pubblicato" (riprodurre prima
     di fixare: verificare se è invalidazione query mancante o `null`
     trattato come "non pubblicato"); verificare collegamento
     configuratore↔catalogo.
4.5. `/surveys` — telemetria laser + Bluetooth (file già presente non
     tracciato: `src/lib/bluetooth-laser.ts`, `src/lib/offline-sync.ts`,
     `src/components/surveys/`, `public/sw.js` — committare se stabile,
     completare pairing/letture live).
4.6. `/installations` — pagina per paese + redirect automatico anti-cross-market.
4.7. `/inspections` — collegamento automatico cliente+cantiere (dipende da FASE 5).
4.8. `/dashboard` — pie chart clienti + utilizzo piano + grafici modulari
     (dipende da FASE 5 per il pie chart clienti, il resto è indipendente).
4.9. `/analytics` — pie chart + animazioni GSAP/Framer Motion + dati reali.
4.10. `/notifications` — verificare persistenza/effetto reale preferenze.
4.11. `/account` — verificare funzionalità reale di toggle/dropdown.

---

## FASE 5 — Nuove pagine `/clients` e `/cantieri`

Dettaglio funzionale completo in `docs/AGENT_HANDOFF_TASKLIST.md` §2.
Ordine: `/clients` prima (è il hub da cui `/cantieri`, `/inspections`,
`/dashboard` dipendono per il collegamento multi-direzionale).

5.1. Schema: tabella `clients` (+ verificare/estendere entità `sites`/
     cantiere se già esiste sotto altro nome prima di duplicare).
5.2. Pagina `/clients`: cartella cliente con sotto-sezioni automatiche
     (categoria/tipo, dati, PDF generati, storico).
5.3. Dropdown cliente→cantiere riusabile, montato in `/quotes`, `/surveys`,
     `/inspections`, `/installations`, `/analytics` (selezione in un punto
     popola i campi collegati altrove).
5.4. Pagina `/cantieri`: Kanban, gestione team custom, chat gruppo,
     upload documenti/foto, task giornaliere.
5.5. Accesso guest cantiere: link email + PIN 6 cifre → sessione persistente
     per dispositivo. **Aggiungere rate-limit/lockout sul tentativo PIN e
     scadenza del link di invito** — rischio sicurezza reale non
     esplicitamente richiesto dall'utente ma necessario (PIN 6 cifre senza
     lockout = bruteforcabile in tempi brevi).

---

## FASE 6 — Bug fix rapidi + full-width refactor

Basso rischio, alto impatto percepito — dettaglio in `PROJECT_MEMORY.md`
§3-4. Da fare dopo le fasi strutturali sopra (o in parallelo su worktree
separata da un secondo agente, essendo task isolati senza dipendenze):

6.1. Favicon: `src/app/icon.png` reale + `metadata.icons` + `metadataBase`
     su `[locale]/layout.tsx`.
6.2. Font preload: rimuovere `IBM_Plex_Mono`/`Inter` mai usati in
     `src/app/c/[publicId]/layout.tsx`.
6.3. Lint: pulire 57 warning `no-unused-vars` (`surveys/*`, `widget/*`,
     `lib/pdfs/*`).
6.4. Skeleton loader: allineare `app/[locale]/app/loading.tsx` al layout
     full-width attuale (non più 4 KPI+chart vecchio schema).
6.5. Full-width: `account/team`, `account/badge`, `account/billing`,
     `quotes/new`, `quotes/[id]/sign`, `app/loading.tsx` (mantenere `max-w`
     solo sulle pagine di stampa A4/lettera).

---

## FASE 7 — i18n completo (Wiring i18n)

Risposta utente punto 4: dopo il wiring i18n si procede al task successivo
del piano concordato con l'agente precedente — quel riferimento esatto
non è recuperabile in questa sessione (vedi nota in
`docs/AGENT_HANDOFF_TASKLIST.md` §0); se il prossimo step dopo questa fase
risulta ambiguo in esecuzione, chiedere conferma invece di indovinare.

7.1. Portare le ~195 chiavi mancanti a coprire davvero tutta la UI (oggi
     molto hardcoded IT).
7.2. Widget B2C: completare traduzioni `de/nl/ro` (oggi alias EN).
7.3. Attivare i 3 template PDF già scritti come dead code
     (Warranty/Funding/DoP via `@react-pdf/renderer`) + scrivere i 4
     mancanti.
7.4. Migrare le 4 pagine ancora su `window.print()` ai template PDF.
7.5. QA linguistica su tutte le 6 lingue dopo il wiring.

---

## FASE 8 — Billing SaaS: Stripe reale (bloccato in attesa utente)

Risposta utente punto 3: le chiavi Stripe non sono ancora pronte
("ancora le devo sistemare"). Task da eseguire solo quando l'utente le
fornisce:

8.1. Creare in dashboard Stripe i 24 Price ID (4 piani × 6 regioni ×
     2 cicli) secondo la tabella prezzi provvisoria in `PROJECT_MEMORY.md` §2.
8.2. Impostare env var `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
     i 24 `stripePriceEnv` in `convex/lib/billingPlans.ts`.
8.3. Configurare l'endpoint webhook Stripe → puntare a
     `convex/billing.ts` (`verifyStripeSignature`/`applyWebhookEvent`).
8.4. Test end-to-end: checkout Pro con trial 14gg (carta richiesta
     subito), auto-conversione a fine trial, `past_due`→`suspended` su
     pagamento falso/carta rifiutata (usare le carte di test Stripe),
     verificare che `requireMembership` blocchi correttamente un tenant
     suspended e lo riammetta dopo riattivazione pagamento.
8.5. Setup fee 150-300€ Enterprise/Showroom: v1 solo nota display, non
     fattura automatica (decisione già presa, D4 in `PROJECT_MEMORY.md`).

---

## FASE 9 — Business rule accesso piattaforma (design, indipendente da Stripe)

Requisito esplicito dell'utente, da implementare subito lato logica anche
senza chiavi Stripe reali (testabile con mock/webhook simulati):

9.1. Utente paga → accesso piattaforma. Non paga → nessun accesso.
9.2. Eccezione: piano **Pro** ha Freemium/trial 14gg con accesso pieno
     durante il trial, carta richiesta subito, auto-conversione a fine
     trial senza azione utente. **Enterprise non ha trial** — solo Pro.
9.3. Dopo pagamento riuscito o attivazione trial Pro → redirect a setup
     wizard piattaforma (verificare se la route onboarding esiste già;
     se manca, crearla).

---

## FASE 10 — Backlog compliance paese + conversione vendite (non urgente)

Dal PDF strategia, dettaglio completo in `PROJECT_MEMORY.md` §7. Da
programmare dopo le fasi 1-9, nessuna dipendenza bloccante:

- FR: RGE, MaPrimeRénov', assicurazione decennale.
- BE: Renson/Invisivent, volet roulant monobloc, Primes (Uw≤1.5).
- NL: giunzione HVL, blokprofiel 115-120mm, inmeetservice, IsoStone.
- DE: RC2/RC3, Rollladen/Raffstoren, 3-fach default, export GAEB/DATANORM.
- LU: TVA 3% + Enregistrement, preventivo bilingue DE/FR.
- Cron follow-up preventivo (giorno 3+7), tracking tempo-risposta lead,
  widget "ore di punta" analytics, pagina pubblica preventivo `/q/[token]`.
- Import listino XML/DATANORM, ordine produzione 1-click, tracking
  commissioni sales rep remoti.

---

## Riepilogo dipendenze tra fasi

```
FASE 1 (piani abbonamento) ─┬─> FASE 8/9 (Stripe reale + business rule accesso)
                             └─> FASE 4.8 dashboard (utilizzo piano)

FASE 2 (calcolatore) ───────────> FASE 3 (porting configuratore) ──> FASE 4.3 (/quotes modal)

FASE 5 (/clients, /cantieri) ──> FASE 4.4/4.7/4.8 (showroom catalogo, inspections, dashboard pie chart)

FASE 6 (bug fix + full-width) — indipendente, eseguibile in parallelo
  su worktree separata in qualsiasi momento dopo FASE 0.

FASE 7 (i18n) — indipendente ma da fare prima di considerare "pronta al
  lancio" qualsiasi pagina toccata nelle fasi precedenti (ogni testo nuovo
  va con chiave i18n da subito, non hardcoded, per non ricreare debito).

FASE 10 — nessuna dipendenza, a discrezione quando le fasi 1-9 sono stabili.
```
