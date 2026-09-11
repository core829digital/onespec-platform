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
