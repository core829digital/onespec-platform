# OneSpec Platform — Memoria di Progetto

> Documento di riferimento persistente. Aggiornato 2026-09-11. Scritto per essere
> letto da qualunque agente (umano o AI) che riprenda il lavoro su questo repo.

Stack: Next.js 16 (App Router, Turbopack) + Convex + next-intl. SaaS multi-tenant
per rivenditori/installatori di serramenti (finestre/porte) in 6 mercati:
IT, FR, BE, NL, DE, LU. Deploy: Vercel (nessun `vercel.json`/CI committato,
config da dashboard) + Convex Cloud.

---

## 0. Incidente risolto in questa sessione

**Build produzione rotto** (`messages/it.json` non era JSON valido — mancava
la `}` di chiusura di `quotes` prima della chiave `billing`, causando
`EOF while parsing an object`). Fix: `messages/it.json` — aggiunta la
parentesi mancante, verificato che tutti i 6 locali (`en/fr/ro/de/nl/it`)
abbiano lo stesso set di chiavi top-level. `npm run build` verde. Commit
`cbecc6a` pushato su `main` → Vercel re-deploy automatico.

---

## 1. Cosa esiste già (mappa completa)

### 1.1 Regioni / fiscalità (fully built, backend-only)
`convex/lib/regions.ts` — `RegionCode = IT|FR|BE|NL|DE|LU`. `RegionPolicy`:
`currency` (sempre EUR), `primaryLocale`, `widgetMode` (`lead_gen` | solo NL
`transparent`), `vatRates[]`, `defaultVatKey`, `complianceFlags[]`.
`regionForCountry(country)`, `calculateVAT(input)`, `countryFromAcceptLanguage`.
`convex/lib/compliance.ts` — programmi di funding per mercato (ENEA IT,
MaPrimeRénov' FR, Primes BE, ISDE NL, BEG DE, Klimabonus LU).
`convex/lib/enea.ts` — Allegato F IT + XML export.

**Gap noto**: il layer fiscale/VAT/compliance è region-aware, ma la **UI
dell'app è quasi tutta italiana hardcoded** (stringhe letterali, date
`it-IT`, `€…it-IT`). `messages/*.json` sono completi (195 chiavi × 6 lingue,
`nav` namespace incluso) ma pochissimo wired nell'app reale — solo auth,
sidebar, e pochi componenti condivisi usano `useTranslations`.

### 1.2 Country detection
Cookie edge `onespec-country` (30gg, da `x-vercel-ip-country`/`cf-ipcountry`,
`src/proxy.ts`) — **separato dalla locale**, non influenza `next-intl`.
Country del tenant si imposta a `src/app/[locale]/auth/onboarding/page.tsx`
(select obbligatoria 6 paesi, pre-fill via `/api/geo`) → `tenants.registerTenant`.
Editabile dopo via `tenants.updateTenant`.

### 1.3 Motore prezzi — 3 superfici, 1 core condiviso
`src/shared/pricing.ts` → `calculatePrice(payload, items)` è la fonte unica.
`REGION_FLAT_OPTION_KINDS` (12 chiavi: poseType, ventilationGrille,
voletRoulant, warmEdge, profileDepth, cornerJoint, ugTier, colorPreset,
inmeetservice, sunProtection, securityClass, montageSystem) — aggiungere qui
un'opzione la propaga automaticamente a widget + preventivo B2B.

1. **Widget B2C embeddabile** `/w/[publicId]` (iframe) + full-page `/c/[publicId]`.
   `src/components/widget/` — `widget.tsx` (~1150 righe), `widget-pricing.ts`
   (client mirror), `widget-catalog.ts`, `widget-i18n.ts` (it/en/fr completi,
   ro/de/nl alias a EN — **gap**), `widget-theme.ts`, `host-bridge.ts`
   (postMessage sicuro), `spec-drawing.tsx` (SVG condiviso, drag-resize,
   warning min-size, handle marker). Server-authoritative su submit:
   `POST /api/widget/quote` → `convex/widget.ts insertQuote` (ri-valida con
   `ProjectItemSchema`, ricalcola su `catalogVersion` pinnata, flag
   `price_mismatch` se client/server >1% diversi).
2. **Preventivo B2B da campo** `/app/quotes/new` (~1300 righe) — tab regione
   IT/FR/BE/NL/DE/LU, editor multi-item, `SpecDrawing`, e-firma, stampa.
   `convex/quotes.ts createFieldQuote` (server ricalcola tutto),
   `signQuote`, `getQuoteForPrint`.
3. **Showroom calculator** `/app/showroom` (costruito in questa sessione) —
   3 zone: dimensioni+tipo, materiale/vetro/finitura, `FiscalEngine`
   (prezzo chiavi-in-mano, VAT breakdown, Beni Significativi IT, Uw+idoneità,
   rata mensile 24 mesi @0%, costo netto dopo Bonus Casa). Dati da
   `api.calculations.getShowroomCatalog` + `getCalculationPreview`.

`convex/calculations.ts` — `serverCalculate` (mutation) e
`getCalculationPreview` (query) sono **quasi duplicati** (~100 righe
identiche — refactoring da fare prima di estenderli). VAT engine:
Beni Significativi IT (Art.7 DPR 633/72), FR 5.5%/10%, BE 6%/21% (età
edificio), LU 3%/17%. `checkUwEligibility` per limiti Uw regione.
`getFundingDocParams` (ENEA/DoP).

### 1.4 Moduli campo — GIÀ COSTRUITI (Phase C, sessioni precedenti)
- **Rilievo Cantiere** `/app/surveys` — laser Bluetooth (Leica DISTO/Bosch
  GLM via Web Bluetooth, `src/lib/bluetooth-laser.ts`), foto-cote annotate
  (`PhotoCoteCanvas.tsx`, react-konva), checklist diagnostica con
  raccomandazione auto (`DiagnosticChecklist.tsx`), **offline-first**
  (`src/lib/offline-sync.ts`, coda IndexedDB, badge sync).
- **Posa UNI 11673** `convex/installations.ts` + `/app/installations` —
  wizard nodo/tipo lavoro, distinta materiali auto da perimetro, stampa
  (`window.print()` — da migrare a `@react-pdf/renderer`).
- **Verbale di Collaudo** `convex/inspections.ts` + `/app/inspections` —
  checklist foto obbligatoria (4 slot), firma installatore,
  **vista mobile senza login** `/i/[token]` (token-gated, Maps/Waze inclusi).
- **Fascicolo del Serramento QR** `convex/passports.ts` + `/app/passports` +
  `/app/passports/[id]/labels` — token pubblico, slot documenti (DoP/CE/
  ENEA), **ENEA Allegato F auto + XML** (`generateFundingDoc`), scan
  tracking, contratto manutenzione (upsell ricorrente), richiesta
  intervento da QR pubblico.

### 1.5 Componenti ORFANI (scritti, non montati in nessuna pagina)
- `src/components/quotes/MultiSupplierTable.tsx` — tabella aggregatore
  multi-fornitore (nessun modello dati dietro).
- `src/components/quotes/sash-editor.tsx`, `sash-panel.tsx` — editor per-anta.
- `src/components/widget/ShowroomWidget.tsx`, `VisualSimulator.tsx`,
  `MaterialConfig.tsx`, `FiscalEngine.tsx` (nella cartella widget, diverso
  da quello attivo in `src/components/showroom/`) — primo tentativo
  showroom, con tipologie più ricche (finestra1/2, porta1/2, scorrevole,
  alzante-scorrevole) del calcolatore live.
- `src/lib/pdfs/{WarrantyCertPDF,FundingDocPDF,DoPPDF}.tsx` — usano
  `@react-pdf/renderer` (installato, `^4.9.0`) ma **mai renderizzati** da
  nessuna route. `window.print()` è ancora usato in produzione in 4 pagine
  (`quotes/[id]/print`, `inspections/[id]/print`, `installations/[id]/print`,
  `passports/[id]/labels`).

### 1.6 Billing / abbonamenti — stato ATTUALE (prima della rifattura)
Sistema Stripe **"dormiente"**: checkout/portal/webhook/firma-verificata/
cron già scritti end-to-end, ma **inattivo finché `STRIPE_SECRET_KEY` /
`STRIPE_WEBHOOK_SECRET` non sono settate**. Nessun SDK `stripe` — REST
grezzo via `fetch` (deliberato, vedi `convex/billing.ts`).

- **Piani oggi**: `tenants.plan = "alpha"|"starter"|"business"|"enterprise"`.
  **Nessun piano "pro", nessun "Showroom"** (Showroom oggi è solo una
  feature UI, non un piano).
- Entitlements centralizzati: `convex/lib/entitlements.ts` (`maxConfigurators,
  maxQuotesPerMonth, maxTeamMembers, whiteLabel, advancedPricingRules,
  multiCatalog, analytics, csvImport, bulkImportMultiSite, customDomain,
  apiAccess, prioritySupport, transparentWidget, lifetimeDiscountPct`),
  `assertQuota`/`checkQuota`. Enforcement reale solo su
  `maxConfigurators` (hard, `configurators.ts`) e `maxTeamMembers` (hard,
  `tenants.ts`); quota preventivi è **soft** (`widget.ts` — il lead è
  comunque salvato, flag `overQuota`, una notifica). Il resto degli
  entitlement booleani (`apiAccess`, `customDomain`, ecc.) è **definito ma
  non applicato da nessuna parte**.
- Prezzi: `convex/lib/billingPlans.ts` — `BILLING_PLANS` (Starter €24,
  Business €47, Enterprise custom — base) + `REGIONAL_PRICES` (solo
  IT/FR/BE oggi, **PROVVISORIO, serve firma founder**).
- **Nessun meccanismo di trial**: `planStatus:"trialing"` viene settato alla
  registrazione ma non scade mai (nessun campo `trialEndsAt`, nessun cron
  di scadenza).
- `planStatus === "suspended"|"past_due"` **non blocca** l'accesso
  all'app da nessuna parte (`convex/lib/auth.ts requireMembership` non lo
  controlla) — solo `suspendTenant` lo imposta.
- Nessuna UI admin per gestire piano/abbonamento di un tenant manualmente.
- `crons.ts`: **un solo cron** (`billing-reconcile`, no-op stub). Nessun
  cron scadenza-trial, nessun cron reset-quota (implicito via chiave
  `"YYYY-MM"`).

---

## 2. Piano dei 4 abbonamenti — decisione presa in questa sessione

Nomi utente: **Starter / Pro / Enterprise / Showroom**. Solo **Pro** ha il
free-trial 14gg con auto-abbonamento a fine trial (carta richiesta subito,
Stripe `trial_period_days:14`, si converte automaticamente).

### Matrice entitlement — FINALIZZATA (risposte utente 2026-09-11)

Differenza chiave Enterprise/Showroom (decisione utente): **stesse feature**,
la differenza è **solo nei limiti d'uso**. Enterprise = tutto sbloccato ma
con tetto su preventivi/configuratori/seats. Showroom = tutto sbloccato e
**senza limiti** (piano top di gamma).

| Entitlement | Starter | Pro | Enterprise | Showroom | alpha→ |
|---|---|---|---|---|---|
| maxConfigurators | 1 | 3 | 10 | ∞ | Pro |
| maxQuotesPerMonth | **20** (nuovi) / **50** (grandfather Starter esistenti) | ∞ | **1000** (provvisorio) | ∞ | ∞ |
| maxTeamMembers | 2 | 5 | 15 | ∞ | 5 |
| whiteLabel | ✗ | ✓ | ✓ | ✓ | ✓ (forzato) |
| analytics | none | basic | advanced | advanced | advanced |
| fieldModules (Rilievo/Posa/Collaudo/Fascicolo/`/i/[token]`) | Rilievo only | full | full | full | full |
| fiscalEngine (Beni Significativi + ENEA auto) | basic | full | full | full | full |
| eSignature | ✗ | ✓ | ✓ | ✓ | ✓ |
| advanceInvoices (acconto) | ✗ | ✓ | ✓ | ✓ | ✓ |
| maintenanceContracts | ✗ | ✓ | ✓ | ✓ | ✓ |
| multiSupplierAggregator | ✗ | ✗ | ✓ | ✓ | ✓ |
| showroomCalculator (in-app 3-zone) | ✗ | ✗ | **✓** | ✓ | ✗ |
| publicWidget (`/w/[publicId]` embeddabile) | ✗ | ✗ | **✓*** | ✓* | ✗ |
| apiAccess / crmIntegration / gaebExport | ✗ | ✗ | ✓ | ✓ | ✗ |
| trialEligible / selfServeCheckout | ✗ / ✓ | ✓ / ✓ | ✗ / ✗ (sales) | ✗ / ✗ (sales) | — |

\* NL è **sempre** `widgetMode:"transparent"` indipendentemente dal piano
(regola region, non toccare) — il gate `publicWidget` deve fare
`OR` con `region.widgetMode === "transparent"`.

**Grandfathering Starter**: nuovo campo tenant `quotaOverrideQuotesPerMonth?:
number` — settato a `50` in una migrazione una-tantum per ogni tenant già
`plan:"starter"` al momento del deploy; `resolveTenantEntitlements` usa
`tenant.quotaOverrideQuotesPerMonth ?? entitlement.maxQuotesPerMonth`. Nuovi
Starter dopo il deploy non ricevono l'override → 20/mese.

**maxQuotesPerMonth Enterprise = 1000** è un numero di partenza arbitrario
(provvisorio come i prezzi) — da confermare o cambiare, non blocca l'avvio
dell'implementazione (facile da editare dopo, è solo un numero in
`entitlements.ts`).

### Prezzo mensile proposto (centesimi, PROVVISORIO — punto medio range PDF)

| regione | Starter | Pro | Enterprise | Showroom |
|---|---|---|---|---|
| IT | 44€ | 89€ | 169€ | 249€ |
| FR/BE | 54€ | 99€ | 199€ | 279€ |
| NL | 64€ | 129€ | 279€ | 349€ |
| DE/LU | 79€ | 169€ | 349€ | 449€ |

Annuale = mensile × 10 (2 mesi gratis) salvo Price Stripe annuale dedicato.

### Decisioni — CHIUSE (2026-09-11)
- **D1** — Trial: **carta richiesta subito**, Stripe `trial_period_days:14`,
  auto-conversione ad abbonato attivo senza altra azione dell'utente.
- **D2** — Starter: **grandfather** — chi è già `plan:"starter"` al deploy
  mantiene 50/mese (`quotaOverrideQuotesPerMonth`); nuovi Starter = 20/mese.
- **D3** — Enterprise **e** Showroom hanno le stesse feature (showroom
  calculator, widget pubblico, multi-fornitore, API/CRM/GAEB); la
  differenza è **solo nei tetti numerici** — Enterprise limitato
  (preventivi/configuratori/seats), Showroom illimitato su tutto.
- Prezzi mensili (tabella sopra) **confermati come provvisori** — via libera
  a scriverli nel codice marcati `PROVVISORIO`, modificabili in seguito
  senza toccare la logica.

### Decisioni ancora aperte (non bloccanti, default ragionevole già scelto)
- **D4** — fee di setup 150-300€ Enterprise/Showroom: default = solo nota
  display in v1 (nessuna fattura Stripe one-time automatica).
- **D5** — 24 Price ID Stripe (2 piani self-serve × 2 cicli × 6 regioni) da
  creare in Stripe dashboard e incollare negli env — operativo, non di design.
- **Enterprise `maxQuotesPerMonth = 1000`** — numero di partenza arbitrario,
  cambiabile in un secondo momento.

### Riepilogo implementazione (dettaglio completo nel report dell'agente
Plan di questa sessione — fasi 0-8: enum widening → migrazione dati
`business→pro` → meccanica trial+cron sweep → wiring enforcement
(planStatus gate, field modules, widget pubblico, VAT, quota, showroom,
multi-supplier) → UI billing 4 card + trial banner → step piano in
onboarding → admin plan override → verifica (tsc/eslint/vitest/build +
test convex + flussi manuali Stripe test-mode)).

---

## 3. Bug list (task originale) — stato reale verificato

| Bug | Stato reale |
|---|---|
| favicon.ico 404 | `public/favicon.ico` è un PNG rinominato (non ICO vero), nessun `metadata.icons` in `src/app/layout.tsx`, nessun `metadataBase`. **Da fixare**: `src/app/icon.png` reale + `metadata.icons` + `metadataBase` su `[locale]/layout.tsx`. |
| configurator 404 | La route **esiste ed è corretta** (`/app/configurators/[id]/page.tsx`, link plurale corretto ovunque). Probabile causa reale: query Convex che ritorna `null` (tenant/editor non trovato) renderizzata come "non trovato" in-page, non un vero HTTP 404 — o link generato prima della pubblicazione. Da riprodurre. |
| `TypeError...startTime` | Documentato: script "web-vitals" auto-iniettato da Vercel, obsoleto. Mitigazione già in `src/app/layout.tsx` (`<SpeedInsights/>`). Se persiste, disattivare "Speed Insights" auto-injection nel dashboard Vercel. |
| Font preload warnings | `src/app/c/[publicId]/layout.tsx` carica `IBM_Plex_Mono` + `Inter` **mai usati** in CSS — da rimuovere. `Geist_Mono` root è usato pochissimo. |
| Lint (richiesto: 2 errori/64 warning) | Stato reale ORA: **0 errori, 57 warning**, tutti `no-unused-vars` (concentrati in `surveys/*`, `widget/*`, `lib/pdfs/*`) — già meglio del previsto, da pulire comunque. |
| Skeleton loaders | Solo 1 `loading.tsx` (`app/[locale]/app/loading.tsx`), assume vecchio layout dashboard (4 KPI+chart) — non combacia con le pagine full-width attuali. Il resto usa `"Caricamento..."` testuale. |

---

## 4. Full-width refactor — pagine ancora ristrette

`account/team`, `account/badge`, `account/billing` (max-w-2xl/3xl),
`quotes/new` (max-w-6xl), `quotes/[id]/sign` (max-w-2xl), più lo skeleton
condiviso `app/loading.tsx` (max-w-5xl). Le pagine di stampa (`print`,
`labels`) mantengono giustamente `max-w` (sono carta A4/lettera).

---

## 5. Calcolatore installatore (sopralluogo) — piano upgrade

Riusa: `SpecDrawing` (drag-resize, warning min-size, handle marker),
`FiscalEngine`, `getCalculationPreview`/`getShowroomCatalog`, tutto lo
stack Rilievo (`surveys/*` + `offline-sync.ts`), la logica regione di
`quotes/new`. Gap da chiudere (rispetto al prototipo `ONESPEC-V2-15.html`):

1. **Handoff Rilievo → Preventivo** (mai collegato oggi): bottone "Genera
   preventivo da rilievo" su un survey completato → pre-compila
   `quotes/new` con i fori (L×H), raccomandazione diagnostica, foto.
   `siteSurveys.quoteId` esiste in schema ma non viene mai settato da UI.
2. **Editor per-anta completo** — riattivare/ricostruire `sash-editor.tsx`:
   tipo (fix/battente/anta-ribalta/vasistas/scorrevole/alzante-scorrevole),
   direzione, ferramenta+colore, altezza maniglia (slider), validazione
   min-size (riusa costanti di `SpecDrawing`), regole combinazione
   (scorrevole solo con scorrevole).
3. **Aggregatore multi-fornitore** — wire `MultiSupplierTable.tsx` + nuova
   tabella `catalogSuppliers` + campo `quoteRequests.supplierLines[]`
   (ri-somma server-side, mai fidarsi del client).
4. **Simulatore rata mensile interattivo** — `calculateMonthlyRate` già
   supporta mesi/tasso, solo da collegare a slider UI (nessun cambio server).
5. **Uw per pezzo + osservazioni** — già calcolabile (`computeUw`), da
   mostrare + salvare come testo libero per riga.
6. **Bottoni Maps/Waze** su survey + inspection (già presenti su `/i/[token]`,
   verificare/estendere alle altre pagine campo).
7. De-duplicare `serverCalculate`/`getCalculationPreview` prima di estenderli.
8. Offline: il calcolatore installatore deve restare usabile offline come
   il Rilievo (stessa coda `offline-sync.ts`).
9. Gate piano: calcolatore disponibile da Starter (con cap 20/mese);
   multi-fornitore e modalità-showroom solo Enterprise/Showroom.

---

## 6. Roadmap completa (fasi rimanenti, ordine consigliato)

1. **FASE 0** — questo doc + fix build (✅ fatto oggi).
2. **Piani abbonamento 4-tier** (sezione 2) — priorità alta, blocca billing reale.
3. **Calcolatore installatore upgrade** (sezione 5) — richiesto esplicitamente ora.
4. **Bug fix rapidi** (sezione 3): favicon, font preload, lint cleanup,
   skeleton — basso rischio, alto impatto percepito.
5. **Full-width refactor** (sezione 4).
6. **FASE 6** — Fascicolo QR + Manutenzione: già gran parte costruita
   (passports.ts), manca solo Stripe subscription reale per il contratto
   manutenzione €89/anno.
7. **FASE 7** — Widget B2C pubblico: già esiste (`/w/[publicId]`), da
   completare traduzioni `de/nl/ro` (oggi alias EN) + gate `publicWidget`
   per tier Showroom + versione "semplice" per cliente finale (prossimo
   widget che manderai).
8. **FASE 8** — Billing SaaS: coincide con la sezione 2.
9. **FASE 9** — i18n completo (portare le ~195 chiavi a coprire davvero
   tutta la UI, oggi hardcoded IT) + 7 PDF template `@react-pdf/renderer`
   (3 già scritti come dead code: Warranty/Funding/DoP — da attivare +
   scrivere i 4 mancanti, e migrare le 4 pagine `window.print()`).
10. **FASE 10** — Analytics (già costruito, hardcoded IT — solo i18n),
    full-width (fuso con punto 5), QA linguistica.
11. **ADD 1-3** — country detection (già esiste, da verificare edge case),
    traduzioni complete (fuso con FASE 9), push GitHub→Vercel (flusso già
    attivo, solo manca CI/health-check pre-deploy — vedi backlog).

---

## 7. Backlog "cosa altro può fare l'agente" (dai PDF di strategia)

**Compliance paese-specifica non ancora nel calcolatore:**
- FR: campo certificazione RGE, calcolo MaPrimeRénov', riferimento
  assicurazione decennale (parzialmente in `quotes/new`).
- BE: calcolo griglia ventilazione Renson/Invisivent (€/ml), volet roulant
  monobloc che allunga l'altezza foro, eligibilità Primes (Uw≤1.5).
- NL: giunzione HVL 90° a costo, profondità blokprofiel 115-120mm, fee
  inmeetservice detraibile, soglia IsoStone.
- DE: RC2/RC3, Rollladen/Raffstoren (30-40% valore preventivo), 3-fach
  default, nastri RAL-Montage, **export GAEB/DATANORM**.
- LU: TVA 3% con flag approvazione Enregistrement, preventivo bilingue DE/FR.

**Conversione vendite (dalle statistiche PDF):**
- Cron follow-up automatico preventivo (giorno 3 + giorno 7 — 40% delle
  perdite è per assenza di follow-up).
- Tracking tempo-di-risposta lead con alert se >5min in orario lavorativo
  (+390% tasso sopralluogo).
- Widget "ore di punta" in analytics (9:30-11:30 / 16:30-19:00 showroom;
  20:30-23:00 online).
- Pagina pubblica preventivo interattivo `/q/[token]` (accetta/firma via
  link WhatsApp, non solo tramite app).

**Operativo:**
- Import listino fornitore via XML/DATANORM (non solo CSV).
- Ordine di produzione 1-click al fornitore da preventivo approvato (API).
- Tracking commissioni per sales rep remoti.

---

## 8. File critici (riferimento rapido)

Billing: `convex/lib/entitlements.ts`, `convex/lib/billingPlans.ts`,
`convex/billing.ts`, `convex/schema.ts` (tabella `tenants`), `convex/lib/auth.ts`.
Calcolo: `src/shared/pricing.ts`, `convex/calculations.ts`,
`src/components/widget/spec-drawing.tsx`, `src/components/showroom/FiscalEngine.tsx`.
Campo: `convex/surveys.ts`, `convex/installations.ts`, `convex/inspections.ts`,
`convex/passports.ts`, `src/lib/offline-sync.ts`, `src/lib/bluetooth-laser.ts`.
Widget pubblico: `src/components/widget/*`, `convex/widget.ts`,
`src/app/w/[publicId]/**`, `src/components/configurator/embed-tab.tsx`.
i18n: `messages/{it,en,fr,ro,de,nl}.json`, `src/i18n/*`, `src/proxy.ts`.

---

## 9. REGISTRO CONTINUO — aggiornare dopo OGNI fase completata

Regola (richiesta esplicita dell'utente, 2026-09-19): tutto ciò che si fa da
ora in poi va registrato qui man mano, non a fine lavoro. Formato per ogni
voce: data · commit · cosa · perché · cosa resta.

### 9.1 Già fatto e in produzione (sessione 2026-09-10 → 2026-09-19)

Deploy: Vercel (frontend, automatico su git push) e Convex (backend,
**SEPARATO** — `npx convex deploy`, NON parte da solo col push; incidente
reale: fix `getPlanUsage` committato ma non live finché non è stato
lanciato il deploy Convex a mano). Prod Convex = `spotted-basilisk-866`
(team core-829, progetto onespec-platform); dev locale = `canny-marten-905`.

- **Build/i18n**: `messages/it.json` era invalido due volte (graffa in
  eccesso + caratteri corrotti U+FFFD) — fixato in `cbecc6a`, `4c33e07`.
  Chiave `cantieri.priority` era duplicata in tutti e 6 i locale (JSON
  tiene solo l'ultima) — separata in `priorityLabel` + `priority.*`.
- **Piani abbonamento 4-tier** (Starter/Pro/Enterprise/Showroom + alpha
  interno): schema, entitlements, migrazione business→pro, trial Pro 14gg
  via Stripe, enforcement, UI billing — tutto codice pronto, **dormiente
  finché non arrivano STRIPE_SECRET_KEY/webhook/24 Price ID** (utente li
  sta configurando). Fix Enterprise (showroomCalculator/publicWidget true,
  maxQuotesPerMonth 1000) in `e3d1dc3`.
- **Analytics** (`0f986f8`, `d08e5c7`, `94aa0d6`): funnel bianco-su-bianco
  in light mode, pie donut invisibile al 100% (arco SVG degenere),
  NaN%/Infinity%, heatmap senza griglia, delta assurdi, hover pie
  ridisegnato (pannello centrale + lift wedge + dim altri + legenda
  bidirezionale).
- **Sentry** (`2c8f4aa`): wizard files mai committati (Sentry non era
  attivo), `tunnelRoute /monitoring` finiva nel middleware i18n (errori
  client persi) — esclusione aggiunta in `src/proxy.ts`; sampling prod
  20%; `ignoreErrors` per il rumore noto `startTime` (script legacy
  Vercel web-vitals, si fixa solo da dashboard Vercel → Analytics).
- **getPlanUsage / usageCounters** (`96567bc`): `.unique()`→`.first()` su 6
  siti (crash permanente se due righe per tenant+periodo).
- **Account** (`e7ede59`, `971cfb0`): link rotto `/app/account/settings`
  (404) → `/app/account`; aggiunta sezione "Azienda" con selettore paese
  (owner/admin); try/catch su revokeSession/revokeOthers.
- **PDF** (`8154eee`, `7096408`): `<PDFViewer>` di @react-pdf/renderer è un
  `<iframe>` nudo senza altezza → collassava a ~150px; fix con altezza
  esplicita + cast tipo. 5 template PDF avevano `Date.now()` in render
  (errore lint purity) → prop `generatedAt` da `useState(() => Date.now())`.
- **Bug UI** (`971cfb0`): bottone "Pubblica" configuratori senza onClick
  (morto) → collegato a `publishConfigurator`; redirect survey→quote
  puntava a `/app/quotes/{id}` (404, esistono solo `/print` e `/sign`).
- Sito onespec-website (`4b833cf`): email `hello@onespec.eu`, URL embed
  `platform.onespec.eu`.
- Cartella "CONFIGURATORE NUOVO AGGIORNATO PER MONTATORI, RIVENDITORI E
  SHOWROOM": bundle Vite compilato, NON portato as-is (non code-split, CSS
  non isolato); solo design system OKLCH/Fraunces applicato (`40b2fe2`),
  `MultiSupplierTable` cablato in quotes/new (`8c32cc4`).
- ⚠️ Lezione operativa: due sessioni sullo stesso working tree → commit
  altrui hanno inglobato modifiche mie non committate (`8154eee`).
  File spazzatura a 0 byte (`,` `{const` `Phase` `per` `quote`…) da
  comandi shell malformati — cancellarli, mai committarli. MAI stampare
  `npx convex env list` (mostra JWT_PRIVATE_KEY): è successo una volta.

### 9.2 Piano approvato 2026-09-19 — NON ANCORA ESEGUITO

Piano completo in `C:\Users\user\.claude\plans\sleepy-beaming-goblet.md`
(include prompt copiabile per un altro agente). Sintesi fasi:

- **FASE 1 — Hub clienti/cantieri ("cartelle")**: richiesto dall'utente dal
  primo prompt, MAI realizzato — `/clients` e `/cantieri` sono liste
  piatte. 1A schema `clientId/cantiereId` su `installationDossiers` + campo
  nei form di creazione (quotes/new, surveys, inspections, cantieri
  `quoteId`); 1B fix `getClient`/`getCantiere` (join per email invece che
  FK; mancano surveys/inspections/installations); 1C pagine
  `/clients/[id]` e `/cantieri/[id]`; 1D selettore condiviso
  `client-cantiere-picker`; 1E backfill dati storici (chiedere).
- **FASE 2 — ~30 funzioni Convex orfane**: per ognuna wire-o-elimina (lista
  nel piano). `markAllSeen` da eliminare (badge conta su `readAt`).
- **FASE 3 — UI/UX**: loading/empty/error state mancanti, i18n su 18 pagine
  100% hardcoded + 5 miste.
- **FASE 4 — Bug per pagina** (da utente 2026-09-19): 4.1 hover pie
  dashboard bugga fuori dal pixel; 4.2 configuratori tab Generale
  (lingua/tema predefiniti non applicati al widget); 4.3 PDF richieste
  senza firma + SVG tecnico non fedele (ante/vetro/telaio Z/maniglia/arco/
  porta/pannello modulare/delineatore con quote); 4.4 Showroom "Richiedi
  Sopralluogo" non passa dati a /quotes + form Posa vuoto; 4.5 Rilievi
  senza colonna Azioni (apri/stampa); 4.6 Installazioni solo stampa
  (mancano modifica/elimina); 4.7 Collaudi PDF senza firma/foto; 4.8
  Passports "Genera da Preventivo" → `passports:generateFundingDoc`
  Server Error grezzo; 4.9 heatmap Ore di Punta + Andamento Richieste da
  rifare animati e chiari.
- **FASE 5 — Sistemici**: 5.1 i PDF "sembrano screenshot con scrollbar"
  perché il bottone chiama `window.print()` sulla pagina con l'iframe —
  causa confermata; fix = `pdf().toBlob()` via `usePDFDownload` (hook
  esistente ma mai usato) + upload logo aziendale nei template; 5.2 firma
  e foto in ogni PDF, foto MAI ridimensionate; 5.3 utility errori
  condivisa (mai più stringhe `[CONVEX M(...)] Server Error` in UI); 5.4
  apri/modifica/elimina su ogni documento; 5.5 = FASE 1.
- **FASE 6 — Struttura**: 6.1 Team/Piano/Fatturazione nel menu laterale +
  **rimozione sistema Alpha** (⚠️ distruttivo su dati reali: serve
  conferma utente su dove migrare i tenant Alpha esistenti PRIMA di
  toccare schema/entitlements/signup/`alpha.ts`/`account/badge`); 6.2
  pagine legali nell'header + sito, senza placeholder; 6.3 admin con più
  controlli tenant (`suspendTenant` esiste ma nessun bottone); 6.4 sidebar
  floating/sticky/traslucida/categorie collassabili (solo desktop,
  mobile/tablet diverso).
- **FASE 7 — i18n + chiusura workflow circolare** (cliente una volta →
  ovunque → PDF → ritorno al cliente).

**Decisioni utente 2026-09-19 (CHIUSE):**
- Alpha: SOLO l'admin con email contact.core829@gmail.com avrà il piano
  maggiore esistente (Showroom). Gli altri tenant migrano al piano che
  l'agente ritiene migliore — regola: l'app NON va regalata. Scelta
  raccomandata: tutti gli altri → Starter (piano pagante più basso, cap
  20 preventivi/mese), niente sconto Alpha; rimuovere isAlpha/
  alphaDiscountLocked/alphaSeatNumber, alphaSeats, appSettings.alpha*,
  convex/alpha.ts, pagina account/badge, piano `alpha` in entitlements.
  Va fatta con migration esplicita (FASE 6.1), non solo togliendo codice.
- Backfill storico clientId: NON serve. I dati esistenti sono solo test;
  l'utente vuole dati FRESCHI e non toccati per i prossimi test.
- admin.resendEmail/listEmails/recentSignups: ERANO pianificati → da
  collegare in UI admin (non eliminare), FASE 6.3.

### 9.3 Log esecuzione (aggiungere righe qui, più recente in basso)

| Data | Fase | Commit | Note |
|---|---|---|---|
| 2026-09-19 | — | — | Piano approvato, nessuna fase ancora avviata. |
| 2026-09-19 | 1A+1D | 808d3ab | `convex/lib/links.ts` (resolveLinks anti cross-tenant + cantiere→cliente + logClientActivity); `installationDossiers` +clientId/cantiereId +indici; createFieldQuoteFromSurvey non perde più il link; createQuoteWithSuppliers accetta i link; componente unico `client-cantiere-picker` in quotes/new, surveys, inspections, installations (prefill nome/indirizzo dal cliente, legge ?clientId=); select preventivo nel modal cantiere (write path morto); fix mojibake in depositTerms. Test client-links. Deploy Convex prod fatto (consenso utente). |
| 2026-09-19 | 1B+1C | 8ba2c5d | getClient/getCantiere via FK (listRelated, summary leggeri); **fix sicurezza: getCantiere non aveva alcun controllo accessi**; pagine `/app/clients/[id]` e `/app/cantieri/[id]` (tab Cantieri/Preventivi/Rilievi/Collaudi/Posa/Attività, note timeline = addClientActivity cablata, task cantiere CRUD + revoca PIN cablati); liste linkano alle cartelle. **5.3 parte**: `src/lib/errors.ts` + `use-friendly-error.ts` + namespace i18n `errors` (mai più `[CONVEX M(...)] Server Error` a schermo) — DA ESTENDERE a tutte le pagine (oggi usato solo dalle nuove). Deploy Convex prod fatto. |
| 2026-09-19 | 1E | — | Chiusa: nessun backfill (dati test, vedi decisioni). |
| 2026-09-19 | 2 + 4.5 + 4.6 | 9d4ec45 | **Rilievi**: la colonna Azioni esisteva ma il suo unico bottone richiedeva status=completed e nessuna UI chiamava completeSurvey → mai visibile. Ora Apri/Completa/Genera preventivo/Elimina, pagina `/app/surveys/[id]`, `SurveyPDF` (i18n 6 lingue, foto `objectFit: contain` senza crop, via usePDFDownload), completeSurvey validato, remove cancella anche le foto a livello survey. **Posa**: Modifica (`EditDossierPanel`, re-link cliente/cantiere) + Elimina; bug Maps/Waze cercavano `Cantiere posa <id dossier>` invece dell'indirizzo → ora indirizzo reale da cantiere→rilievo→cliente. **Collaudi**: Elimina. Deploy Convex prod fatto. |
| 2026-09-20 | 4.1 + 4.2 + 4.4 + 4.8 | 604aa64 | **Widget pubblico (grave)**: `/w/[publicId]` decideva l'accesso con `getMyTenant` (tenant del VISITATORE, null per ogni cliente anonimo) + `plan==='showroom'` → ogni cliente reale vedeva un muro olandese hardcoded; solo il proprietario in preview vedeva il widget. Ora `getPublicConfigurator` restituisce `publicWidgetAllowed` dal piano del PROPRIETARIO. **Tema/lingua (4.2)**: le pagine `/w` (dark) e `/c` (light) e `lang=it` erano hardcoded e ignoravano defaultTheme/defaultLocale della tab Generale → `lib/widget-params` (URL > default configuratore > default piattaforma), Widget supporta `theme=auto`, preview editor si rimonta al salvataggio. **Showroom (4.4)**: 'Richiedi sopralluogo' ora passa TUTTE le finestre a `/app/quotes/new?from=showroom` via `lib/showroom-handoff` (sessionStorage, 6h, read-and-clear); select Posa vuoto per FR/DE/LU (kind `poseType`/`montageSystem`) → fallback + hint. **Passports (4.8)**: da log prod la richiesta f1332cd2477dbbc3 era `ConvexError('FUNDING_NEEDS_QUOTE')`, non un crash: per un ConvexError `e.message` è il generico 'Server Error'; i fascicoli creati dalla pagina non avevano mai un preventivo e la UI non permetteva di collegarlo → `passports.linkQuote` + select in creazione e nel pannello. **Pie (4.1)**: l'hover era sul wedge che si sposta → loop mouseleave/enter; ora hit layer statico invisibile. Deploy Convex prod fatto. |
| 2026-09-20 | 4.3 (parziale) + 4.7 + 5.2 | 92e78e1 | **Firma e foto nei PDF**: `InspectionCertPDF` stampava letteralmente `[Immagine: label]` / `[Firma digitale]`; idem firma in Quote/Handover/Maintenance PDF → ora `<Image>` reali. Foto MAI ridimensionate: `lib/pdf-images` (`usePdfImages`) lascia intatti PNG/JPEG normali, ridisegna a dimensione NATURALE solo WebP/AVIF o JPEG con EXIF ruotato (react-pdf ignora EXIF), undecodable → segnaposto (non rompe il documento). Upload confermato senza compressione lato client. **Disegno tecnico**: `WindowDrawingPDF` (port react-pdf statico di SpecDrawing: ante con ratio, simboli apertura, colore finitura, altezza maniglia su OGNI anta, quote) in sezione 'Disegni tecnici' del PDF preventivo. NB: arco / porta d'ingresso / pannello modulare / delineatore orizzontale / telaio con-senza Z NON esistono nel modello dati (`ProjectItem`) né in SpecDrawing live → gap di prodotto, non solo PDF. **Scoperto**: `tenant.address`/`tenant.vatId` non esistono (i PDF li leggono con `as any`, sempre undefined); i dati azienda vivono in `branding.companyInfo` per-configuratore e non arrivano ai PDF → serve profilo azienda a livello tenant (logo+P.IVA+indirizzo) = prossimo passo 5.1. Test `pdf-render` (render reale react-pdf in node), `pdf-images`. Nessun cambio Convex. |
| 2026-09-20 | 5.1 (logo azienda) | 9de21b4 | **Profilo azienda per tenant**: `tenants` +vatId/address/phone/companyEmail/logoStorageId (tutti opzionali); `tenants.updateTenant` esteso (trim, '' = cancella, max 200), `generateLogoUploadUrl` + `setCompanyLogo` (solo PNG/JPEG perche' react-pdf non embedda altro, max 2 MB, valida su `_storage` e cancella il file sostituito), `getCompanyProfile` (logoUrl risolto). UI: `components/account/company-profile.tsx` in /app/account (i18n 6 lingue, namespace `company`). PDF: `CompanyLogo` + riga contatti nelle testate di Preventivo, Posa, Collaudo, Rilievo; hook `useCompanyPdf` (la pagina attende profilo+logo prima di generare). Codici errore `IMAGE_TOO_LARGE`. Test `company-profile` (convex-test non salva il contentType: nel test lo si patcha su `_storage`). Deploy Convex prod fatto. NB: Compliance/DoP/Funding/Handover/Maintenance/Warranty PDF non sono renderizzati da nessuna pagina (orfani) — da collegare o eliminare (FASE 2/5.4). |
| 2026-09-20 | 5.3 + 3.3 | (vedi git log) | **Errori friendly ovunque**: `useFriendlyError` applicato a ~30 punti (configuratori, ispezioni, rilievi, richieste, account, onboarding, pipeline, billing, ecc.) al posto di `e instanceof Error ? e.message`. **Bug scoperto**: i controlli tipo `/RATE_LIMITED/.test(e.message)` (richieste, feedback, invito, team, elimina account) NON funzionavano mai: per un ConvexError `e.message` e' il generico 'Server Error' → l'utente non vedeva mai il messaggio specifico; ora passano da `e.data`. Nuovi codici mappati: ALREADY_MEMBER/INVITED/HAS_TENANT, INVITATION_EMAIL_MISMATCH/EXPIRED/USED, INVALID_EMAIL, CANNOT_REMOVE_OWNER (6 lingue). Pagine auth: `authErrorMessage` nasconde `[CONVEX A(...)] Server Error`. **Catch silenziosi** clients/cantieri (solo console.error) → toast. **Mutation fire-and-forget** (select/toggle/checkbox: updateIv, updateChecks, assignInstaller, removeMember, cancelInvitation, toggleRegistration, setFeedbackStatus, notifiche) → `useRunAction` + `<ActionToaster/>` nel layout app. Non toccati: widget pubblico (usa il proprio dizionario), bluetooth-laser. Nessun cambio Convex. |
| 2026-09-21 | 4.9 | 443ac88 | **Analytics**: 'Ore di punta' non e' piu' la heatmap 24x7 (illeggibile) ma un grafico a barre animato Per ora / Per giorno con ora+giorno di picco evidenziati; 'Andamento richieste' e' un line/area chart SVG con asse Y, gridline, etichette X senza sovrapposizioni (`visibleLabelIndexes`), hover con guida+tooltip, statistiche Totale/Picco, stato vuoto. Componenti in `components/analytics/charts.tsx`, helper testati in `lib/chart-utils.ts`; rimossi i vecchi da PieChart.tsx. **Bug reale**: `getOverview`/`getPeakHours` bucketizzavano per ora UTC del server → ore, giorni ed etichette 24h sfasati del fuso dell'utente; ora accettano `tzOffsetMinutes` (Date.getTimezoneOffset, offset costante sulla finestra → possibile errore di 1h a cavallo del DST). Nomi giorni via Intl (6 lingue), chiavi i18n `analytics.*`. `vitest.config.ts` ora risolve gli alias `@/`. Deploy Convex prod fatto. |

### 9.4 Note operative apprese (2026-09-19)

- Un'ALTRA sessione lavora nello stesso working tree e committa in parallelo
  (numerazione sua: `1.1 PDF download fix` d47fcf6, `1.2 Guest PIN /k/[pin]`
  c580626, `1.3 MultiSupplierTable` cf54c76). Prima di toccare un file
  condiviso: `git pull`, rileggerlo, edit chirurgici, mai `git stash`
  (un mio stash ha fatto perdere temporaneamente il lavoro: recuperato).
  Committare SOLO i propri file con `git add <path>` espliciti.
- `node -e` con `=>`/`>` dentro virgolette doppie in bash crea file
  spazzatura (`JSON.stringify(a)`, `{const`…). Usare file .js in scratchpad.
- `git push` NON deploya Convex: `npx convex deploy` a parte, con consenso
  esplicito per prod ogni volta.
- Bug latente noto: `getCantiereByGuestPin` usa `.unique()` su un PIN a 6
  cifre non unico tra tenant e non ha rate limit (brute-force) — da
  sistemare insieme alla pagina guest `/k/[pin]` (FASE 2/cantieri).
- Warning build: `themeColor` nel `metadata export` va spostato in
  `viewport export` (Next 16) — su tutte le rotte.
- Sentry: le issue JAVASCRIPT-NEXTJS-2 e -3 (onespec.sentry.io) NON sono leggibili dall'agente (login richiesto, WebFetch riceve solo la landing). Serve incollare titolo+stack, oppure un token API Sentry con scope event:read. Candidati probabili (le due più vecchie del progetto): TypeError `startTime` (già in ignoreErrors) e `[CONVEX Q(analytics:getPlanUsage)] Server Error` (fix in prod). Da confermare.
- Ancora da fare della FASE 2: surveys.update/saveLaser*/savePhotoCote/saveDiagnostic (editing rilievo), alpha.*, admin.recentSignups/listEmails/resendEmail (UI admin, FASE 6.3), suspendTenant, eliminazione funzioni duplicate (markAllSeen, serverCalculate?, quotes.getShowroomCatalog?, getTenant, getConfigurator) dopo grep fresco.
- Prod logs leggibili dall'agente: `npx convex logs --prod --history N --jsonl` (read-only, va fermato: segue in tail) e cercare `requestId`. Così si è trovata la causa di f1332cd2477dbbc3 in un minuto.
- Verificato: `priceRoundingStep` È applicato da `calculatePrice` (non è inerte). Ancora da auditare: le ALTRE tab dell'editor configuratore (4.2b), gating `publicWidget` solo Enterprise/Showroom (Starter/Pro non hanno widget pubblico: verificare che sia voluto — è il prodotto core 'configuratore per il tuo sito').
- Rimasti in FASE 4: 4.2b audit tab configuratore, 4.3 PDF richieste (firma + SVG tecnico fedele), 4.7 PDF collaudo (firma+foto, InspectionCertPDF non importa `Image`), 4.9 redesign Ore di Punta/Andamento; FASE 5.3 estendere `useFriendlyError` a tutte le pagine; FASE 5.1 logo aziendale.
