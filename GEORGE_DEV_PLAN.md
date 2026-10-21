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
- [ ] 4. #45 — `generatePassportQrs`: idempotent (nu mai duplică pașapoarte)
- [ ] 5. #46 — client search: filtrare înainte de paginare
- [ ] 6. #33 — revoke pe photo-preview object URLs (surveys/installer)
- [ ] 7. #35 — retention cron pentru tabelele append-only (auditLog, billingEvents, viesChecks…)
- [ ] 8. #28 — offline queue: flush-uri concurente dublează înregistrările (o trecere cu #39)
- [ ] 9. #39 — offline queue: elimină itemele eșuate permanent (aceeași trecere cu #28)

### Etapa 2 — P4: refactor-uri HIGH (6), în ordinea tracker-ului
- [ ] 10. #64 — `normalizedRatios` structural, șterge 5 double-casts (warm-up)
- [ ] 11. #63 — un singur tip canonic `ProjectItem`
- [ ] 12. #65 — înlocuiește `v.any()` pe items/payload/labels (step A: types-only)
- [ ] 13. #53 — registru fiscal unic (4 copii → 1; necesită #37 ✓)
- [ ] 14. #55 — fabrică de pașapoarte (3 căi → 1)
- [ ] 15. #54 — helper comun quote→won (3 căi drift-uite)

### Etapa 3 — bug-uri deblocate de refactoruri (5)
- [ ] 16. #34 — Showroom VAT labels vs amounts (curat după #53)
- [ ] 17. #43 — praguri Uw IT 1.4 vs 1.3 (constante comune din #53)
- [ ] 18. #47 — `generatePassportQrs` + maintenance gate (one-line după #55)
- [ ] 19. #42 — supply-flow deal close cu events/audit (flag după #54)
- [ ] 20. #38 — widget plan-usage = quota enforcement (după #59 sau standalone fast win)

### Etapa 4 — P3: backlog bug-uri (8)
- [ ] 21. #48 — anulare livrare signed → items rămân în in_transit
- [ ] 22. #49 — undo import catalog corupe importurile intercalate
- [ ] 23. #51 — adminPurge TENANT_TABLES drift (7 tabele orphan) + test schema-walk
- [ ] 24. #50 — wizard salvează finish-ul ca hardwareColor
- [ ] 25. #40 — Laser BLE GATT connection + listener cleanup
- [ ] 26. #41 — email pipeline: duplicate sends / webhook-uri pierdute (queued row + idempotency)
- [ ] 27. #44 — /api/passport/intervention: 400 în loc de 500
- [ ] 28. #52 — branding accent reset la default (`cleanColor(v) || undefined`)

### Etapa 5 — P5: refactor-uri MEDIUM/LOW (17), fiecare împerecheat cu bug-ul lui
- [ ] 29. #66 — widget wire-contract derivat din QuoteSubmissionSchema (pereche #27)
- [ ] 30. #56 — `resolveVisitorVat` ca singur punct de decizie VAT (pereche #27/#53)
- [ ] 31. #67 — parse-don't-cast la toate rutele http.ts (pereche #44)
- [ ] 32. #68 — o singură declarație RegionCode (pereche #53)
- [ ] 33. #69 — `lib/enums.ts` sursă unică pentru status/kind
- [ ] 34. #73 — `convex/lib/dims.ts` validator de milimetri (pereche #31)
- [ ] 35. #57 — SyncCoordinator pentru flushQueue (pereche #28/#39)
- [ ] 36. #58 — hook `useOfflineSync` extras din cele 3 pagini de teren
- [ ] 37. #59 — contoarele plan-usage + enforcement co-locate (pereche #38)
- [ ] 38. #60 — `bumpUsageCounter` extras (5 situri)
- [ ] 39. #61 — dedupe createQuoteWithSuppliers vs buildFieldQuote + 6 preludii de catalog
- [ ] 40. #62 — registru declarativ pentru ~40 enforcement gates
- [ ] 41. #71 — un singur union AppLocale (9 re-declarații)
- [ ] 42. #72 — ID-uri form-state cantieri tipizate la sursă (6 casts)
- [ ] 43. #74 — `isEmailLocale` guard în loc de cast
- [ ] 44. #75 — `isBicolor` type predicate
- [ ] 45. #70 — split display-colour wizard de cheile de catalog (pereche #50)

## Finalizare
- [ ] Toate etapele ✓ → `npm test` + `typecheck` + `lint` + `npm run build` complete pe `george_dev`
- [ ] E2E complet (`e2e`, `e2e:app`, `e2e:demo`, `e2e:signature`, `e2e:phone`) dacă environment-ul Convex e disponibil
- [ ] `george_dev` pouss-at; PR spre `main` doar la decizia explicită a owner-ului

## Jurnal
- 2026-10-21: baseline verde (1802/1802, typecheck OK), branch `george_dev` creat și publicat. Următorul: #37.
- 2026-10-21: **#37 DONE** — `convex/lib/pricing.ts` șters, `api.d.ts` curățat (codegen offline indisponibil), harta demo regenerată (a prins și `authEmails.ts` rămas ne-regenerat); generatorul reparat pentru căi cu spații (`fileURLToPath`); test de pază `tests/pricing-dead-module.test.ts`. Suite: 1804/1804. Următorul: #77.
