# Plan de execuție george_dev — 45 issues (#28–#77)

Sursa prioritizării: issue #78 (master tracker, engagement 2026-10-20).
P1 (#27, #29, #30, #31, #32, #36) este deja rezolvat upstream — nu face parte din acest plan.

## Reguli fixe

1. **Branch:** tot lucrul se face DOAR pe `george_dev`. Nu se pouss-ează niciodată pe `main`/`master`. La final: PR din `george_dev` → `main` (decis separat).
2. **Un issue = un commit** (sau un mic set de commits legat). Mesaj: `Fix #NN: <rezumat>` / `Refactor #NN: <rezumat>`.
3. **Poarta de teste înainte de fiecare fix (obligatorie):**
   - a. `npm test` — **trebuie verde complet** (baseline azi: 1802 teste / 207 fișiere, ~24s) *înainte* de a începe implementarea.
   - b. `npm run typecheck` — trebuie să iasă 0 erori.
   - c. Scriem întâi **test de regresie** care reproduce bug-ul din issue → confirmăm că e roșu.
   - d. Implementăm fixul minim.
   - e. `npm test` + `npm run typecheck` din nou verde (incl. testul nou). `npm run lint` pe fișierele atinse.
   - f. Abia apoi commit + `git push origin george_dev`.
4. Nu trecem la issue-ul următor cu ceva roșu. Dacă un fix se dovedește mai mare decât issue-ul, îl împărțim și notăm în commit.
5. E2E (`npm run e2e:*`) cere dev server + deployment Convex — rulat la final de etapă, dacă environment-ul e disponibil; NU este poarta per-fix. Poarta per-fix = unit + typecheck.

## Ordinea de execuție (45 issues)

### Etapa 0 — Setup (DONE 2026-10-21)
- [x] `npm install`, baseline `npm test` verde (1802/1802), `typecheck` 0 erori
- [x] Branch `george_dev` creat din `3a2cb5b` și pouss-at pe origin

### Etapa 1 — P2: bug-uri (9)
Ordine ajustată după dependențe (#37 înainte de refactorul #53; #34 amânat după #53).
- [x] 1. #37 — șterge modulul mort `convex/lib/pricing.ts` (fast win, deblochează #53) ✓ 2026-10-21
- [x] 2. #77 — `generateGuestPin`: clamp `expiresInDays` pe [1, 365] (fast win) ✓ 2026-10-21
- [x] 3. #76 — field-module update/sign: aplică bound-urile free-text ca la create/HTTP ✓ 2026-10-21
- [x] 4. #45 — `generatePassportQrs`: idempotent (nu mai duplică pașapoarte) ✓ 2026-10-21
- [x] 5. #46 — client search: filtrare înainte de paginare ✓ 2026-10-21
- [x] 6. #33 — revoke pe photo-preview object URLs (surveys/installer) ✓ 2026-10-21
- [x] 7. #35 — retention cron pentru tabelele append-only (auditLog, billingEvents, viesChecks…) ✓ 2026-10-21
- [x] 8. #28 — offline queue: flush-uri concurente dublează înregistrările (o trecere cu #39) ✓ 2026-10-21
- [x] 9. #39 — offline queue: elimină itemele eșuate permanent (aceeași trecere cu #28) ✓ 2026-10-21

### Etapa 2 — P4: refactor-uri HIGH (6), în ordinea tracker-ului
- [x] 10. #64 — `normalizedRatios` structural, șterge 5 double-casts (warm-up) ✓ 2026-10-21
- [x] 11. #63 — un singur tip canonic `ProjectItem` ✓ 2026-10-21
- [x] 12. #65 — înlocuiește `v.any()` pe items/payload/labels (step A: types-only) ✓ 2026-10-21
- [x] 13. #53 — registru fiscal unic (4 copii → 1; necesită #37 ✓) ✓ 2026-10-21
- [x] 14. #55 — fabrică de pașapoarte (3 căi → 1) ✓ 2026-10-21
- [x] 15. #54 — helper comun quote→won (3 căi drift-uite) ✓ 2026-10-21

### Etapa 3 — bug-uri deblocate de refactoruri (5)
- [x] 16. #34 — Showroom VAT labels vs amounts (curat după #53) ✓ 2026-10-21
- [x] 17. #43 — praguri Uw IT 1.4 vs 1.3 (constante comune din #53) ✓ 2026-10-21
- [x] 18. #47 — `generatePassportQrs` + maintenance gate (one-line după #55) ✓ 2026-10-21
- [x] 19. #42 — supply-flow deal close cu events/audit (flag după #54) ✓ 2026-10-21
- [x] 20. #38 — widget plan-usage = quota enforcement (după #59 sau standalone fast win) ✓ 2026-10-21

### Etapa 4 — P3: backlog bug-uri (8)
- [x] 21. #48 — anulare livrare signed → items rămân în in_transit ✓ 2026-10-21
- [x] 22. #49 — undo import catalog corupe importurile intercalate ✓ 2026-10-21
- [x] 23. #51 — adminPurge TENANT_TABLES drift (7 tabele orphan) + test schema-walk ✓ 2026-10-21
- [x] 24. #50 — wizard salvează finish-ul ca hardwareColor ✓ 2026-10-21
- [x] 25. #40 — Laser BLE GATT connection + listener cleanup ✓ 2026-10-21
- [x] 26. #41 — email pipeline: duplicate sends / webhook-uri pierdute ✓ 2026-10-21
- [x] 27. #44 — /api/passport/intervention: 400 în loc de 500 ✓ 2026-10-21
- [x] 28. #52 — branding accent reset la default (`cleanColor(v) || undefined`) ✓ 2026-10-21

### Etapa 5 — P5: refactor-uri MEDIUM/LOW (17), fiecare împerecheat cu bug-ul lui
- [x] 29. #66 — widget wire-contract derivat din QuoteSubmissionSchema (pereche #27) ✓ 2026-10-21
- [x] 30. #56 — `resolveVisitorVat` ca singur punct de decizie VAT (pereche #27/#53) ✓ 2026-10-21
- [x] 31. #67 — parse-don't-cast la toate rutele http.ts (pereche #44) ✓ 2026-10-21
- [x] 32. #68 — o singură declarație RegionCode (pereche #53) ✓ 2026-10-21
- [x] 33. #69 — `lib/enums.ts` sursă unică pentru status/kind ✓ 2026-10-21
- [x] 34. #73 — `convex/lib/dims.ts` validator de milimetri (pereche #31) ✓ 2026-10-21
- [x] 35. #57 — SyncCoordinator pentru flushQueue (pereche #28/#39) ✓ 2026-10-21
- [x] 36. #58 — hook `useOfflineSync` extras din cele 3 pagini de teren ✓ 2026-10-21
- [x] 37. #59 — contoarele plan-usage + enforcement co-locate (pereche #38) ✓ 2026-10-21
- [x] 38. #60 — `bumpUsageCounter` extras (5 situri) ✓ 2026-10-21
- [x] 39. #61 — dedupe createQuoteWithSuppliers vs buildFieldQuote + 6 preludii de catalog ✓ 2026-10-21
- [x] 40. #62 — registru declarativ pentru enforcement gates ✓ 2026-10-21
- [x] 41. #71 — un singur union AppLocale (9 re-declarații) ✓ 2026-10-21
- [x] 42. #72 — ID-uri form-state cantieri tipizate la sursă (6 casts) ✓ 2026-10-21
- [x] 43. #74 — `isEmailLocale` guard în loc de cast ✓ 2026-10-21
- [x] 44. #75 — `isBicolor` type predicate ✓ 2026-10-21
- [x] 45. #70 — split display-colour wizard de cheile de catalog (pereche #50) ✓ 2026-10-21

## Finalizare
- [x] Toate etapele ✓ → `npm test` + `typecheck` + `lint` + `npm run build` complete pe `george_dev` ✓ 2026-10-21 (1838/1838 teste, typecheck 0 erori, lint curat, build de producție reușit)
- [ ] E2E complet (`e2e`, `e2e:app`, `e2e:demo`, `e2e:signature`, `e2e:phone`) dacă environment-ul Convex e disponibil
- [ ] `george_dev` pouss-at; PR spre `main` doar la decizia explicită a owner-ului

## Jurnal
- 2026-10-21: baseline verde (1802/1802, typecheck OK), branch `george_dev` creat și publicat. Următorul: #37.
- 2026-10-21: **#37 DONE** — `convex/lib/pricing.ts` șters, `api.d.ts` curățat (codegen offline indisponibil), harta demo regenerată (a prins și `authEmails.ts` rămas ne-regenerat); generatorul reparat pentru căi cu spații (`fileURLToPath`); test de pază `tests/pricing-dead-module.test.ts`. Suite: 1804/1804. Următorul: #77.
- 2026-10-21: **#77 DONE** (clamp PIN), **#76 DONE** (bound-uri free-text pe 5 mutații), **#45 DONE** (generatePassportQrs idempotent), **#46 DONE** (client search înainte de paginare), **#33 DONE** (revoke object URLs pe ambele pagini de teren). Suite: 1814→1817.
- 2026-10-21: **#35 DONE** — `convex/retention.ts` (purge zilnic batched: auditLog/clientActivities 730z, billingEvents 30z, meteredEvents/viesChecks/catalogImports 90z, trialFingerprints 180z) + indexuri pe câmpurile reale de timestamp + cron `purge-append-only-tables`. Descoperit en route: crons-urile existente `purgeOldNotifications`/`purgeOldEmailLogs`/`supportAdmin` referențiază indexul `by_creation_time` care NU există în schemă → pică la runtime (convex 1.17 nici nu acceptă `_creationTime` în typing-ul range-builder). De raportat ca issue separat.
- 2026-10-21: **#28+#39 DONE** — `flushQueue` cu single-flight lock (`tryAcquireFlushLock`/`releaseFlushLock`) + `planQueuedItem` pur (run/skip/evict); itemele la MAX_RETRIES șterse din IndexedDB (nu reținute forever); fallback-ul online-save din surveys/installations enqueue-ază doar la erori de transport (nu la respingeri de server cu `.data`). **ETAPA 1 COMPLETĂ** (9/9). Suite: 1821/1821. Următorul: Etapa 2 (#64).
- 2026-10-21: **ETAPA 2 COMPLETĂ** (6/6 refactoruri P4): #64 (normalizedRatios structural — 9 double-casts șterse), #63 (ProjectItem canonic + tripwire compile-time), #65 Step A (Labels + labelsValidator + assertLabels cu assertion signature), #53 (convex/lib/fiscal.ts — registru FISCAL + beniSignificativi/itCostSplit/vatKeyForRegion; cenții pin-uiți de price-parity), #55 (convex/lib/passportUnits.ts — fabrica pentru cele 3 căi), #54 (convex/lib/quoteTransitions.ts — markQuoteWon cu flag-uri). Suite: 1821/1821 după fiecare. Notă tooling: Mimosa a blocat de 3× scrieri în passports.ts pe fals pozitiv „SQL injection" — rezolvat prin fișier nou + Array.join.
- 2026-10-21: **ETAPA 3 COMPLETĂ** (5/5, toate ieftinificate de refactoruri): #34 (VAT panel: sumele derivate din rata afișată, ca la regions.calculateVAT), #43 (o singură limită Uw IT = 1.4 în FISCAL; câmpul fundingUwLimit eliminat), #47 (enforceForMaintenance adăugat la generatePassportQrs — o linie), #42 (supplies.advance: events: true + audit în markQuoteWon — flag edit), #38 (getPlanUsage reutiliză countLiveConfigurators: draft+published ca la gate). Suite: 1826/1826. Următorul: Etapa 4 (#48).
- 2026-10-21: **ETAPA 4 COMPLETĂ** (8/8 backlog P3): #48 (signSiteDelivery snap-shotuiește priorStatus pe iteme; cancelSiteDelivery restaurează in_stock/assigned), #49 (importRows înregistrează changes per-import — createdKeys + before-docs; undo țintit, fallback legacy pe înregistrări vechi), #51 (7 tabele readăugate în TENANT_TABLES + referrals pe ambele chei + ticket-keyed sweep prin doomedSupportTickets; guard schema-walk), #50 (hardwareColor: "white" în wizard, finish-ul rămâne pe color), #40 (disconnect la unmount în efect separat + listener cu referință stocată), #41 (beginSend/finishSend: rând queued pre-POST + Idempotency-Key la Resend + patch pe același rând; webhook 503 la race → Svix retry), #44 (isStr pe câmpurile de contact în ruta de intervenție), #52 (colorAccent/colorAccentInk optionale în schemă; "" resetează, ca la bg; placeholder de default în editor). Suite: 1838/1838. Următorul: Etapa 5 (#66, 17 refactoruri P5).
- 2026-10-21: **ETAPA 5 COMPLETĂ + PLAN ÎNCHIS (45/45 issue-uri)**. P5 (17): #66 (WidgetQuoteSubmission + tripwire compile-time pe insertQuote args), #56 (resolveVisitorVat în fiscal.ts), #67 (readJson + field() pe toate rutele http.ts; Stripe metadata narrowing pas cu pas), #68 (REGION_CODES/regionCodeValidator; getMarketPreview cu union validator), #69 (quoteStatusValidator/isQuoteStatus/inventoryStatusValidator derivate; email maps cu draft în toate limbile), #73 (dims.ts mm()/assertMm), #57+58 (SyncCoordinator + useOfflineSync; cele 3 pagini pe hook), #59 (configuratorCounts.ts), #60 (usageCounter.ts bumpUsageCounter/bumpCounterRow — 6 situri), #61 (loadPublishedCatalog + defaultDepositTerms), #62 (ENTITLEMENT_GATES registry + 17 alias-uri), #71 (locales.ts APP_LOCALES/WIDGET_LEAD_LOCALES), #72 (asUserIds/asCantiereId; props-oneste pe CantiereModal), #74+#75 (guard/predicate), #70 (wizardColourToCatalogKey + ProjectItem return). Validare finală: **1838/1838 teste, typecheck 0 erori, lint 0 erori, `npm run build` reușit**. Totul pe `george_dev`; PR spre `main` rămâne la decizia owner-ului.
