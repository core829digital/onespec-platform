# Piano d'implementazione — Abbonamenti "Widget first" (Essentials · Essentials+ · Max)

> CORE829 SRL · OneSpec · redatto 2026-09-29 · stato: **decisioni prese (§4) — implementazione in corso**

---

## 1. Parere sulle due analisi ricevute

### Dove concordano (e sono d'accordo anch'io)
- **Vendere prima lo strumento semplice (widget + showroom), la piattaforma completa dopo.** Nel settore la strategia si chiama "land & expand": prima si entra con poco (preventivi dal sito), poi si amplia (cantieri, logistica, firma, pipeline). Chiedere a un montatore di cambiare tutto il gestionale al primo contatto è la barriera più alta che esista.
- **Il cliente ideale è il piccolo serramentista artigiano**: poco tempo, niente reparto IT, comunicazione quasi tutta su WhatsApp.
- **Non costruire la vendita sui bonus fiscali**: si stanno riducendo anno dopo anno. Il messaggio forte è *tempo risparmiato + richieste che arrivano anche di notte* (lo stesso del reel).
- Canali sensati: gruppi Facebook di settore, video brevi, fiere (Klimahouse, MADE expo), partnership con i sistemisti (Aluplast, Rehau, Salamander…).

### Dove serve cautela (numeri da verificare)
- **La risposta 2 contiene cifre molto precise che non hanno una fonte controllabile** ("tasso di successo 84–91%", "LTV 2.081 €", "23–31% alla prima vendita", prezzi di Logikal e Gealan Planer, "400+ serramentisti su PagineGialle Prato", date delle fiere). Vanno trattate come ipotesi, non come dati: prima di metterle in un business plan vanno verificate.
- **La risposta 1 è più prudente e onesta** (dice esplicitamente di non conoscere i prezzi dei concorrenti). Ma anche i suoi numeri (20.700 aziende, 68% artigiane, aliquote bonus 2027) vanno confermati con UNICMI / fonti ufficiali.
- Nessuna delle due tiene conto che **OneSpec esiste già con 4 piani (Base 97 €, Pro 197 €, Agency 397 €, Enterprise 690 €)**. I nuovi piani devono convivere con quelli, non cannibalizzarli (vedi §2).

### Il mio parere sui prezzi che hai scelto
| Piano | Prezzo | Cosa sblocca | Nota |
|---|---|---|---|
| Essentials | 49,95 €/mese | widget pubblico (oggi disponibile solo da **Pro, 197 €**) | ottimo prezzo d'ingresso, in linea con i "20–50 €" della risposta 1 |
| Essentials+ | 62,44 €/mese | +showroom (oggi solo da **Agency, 397 €**), 3 configuratori, limiti ×2 | con solo +12,49 € rispetto a Essentials, spinge quasi tutti verso Essentials+: di fatto Essentials fa da "esca". Va bene se è voluto |
| Max | 79,90 €/mese | +logistica, 10 configuratori, limiti ×5 | **rischio cannibalizzazione**: chi oggi pagherebbe Agency (397 €) per widget + showroom potrebbe scegliere Max a 79,90 € |

**Come proteggere i piani completi (senza toccare i loro accessi):** i piani widget devono restare davvero "solo widget e showroom". Quindi restano bloccati: preventivi B2B con firma, trattative, clienti, cantieri, rilievi, posa, collaudi, fascicoli QR, statistiche, white-label (badge "Powered by OneSpec" visibile). Con questi confini, chi ha bisogno di gestire il lavoro passa naturalmente ai piani completi: è l'"expand".

Osservazioni minori:
- 62,44 € è un prezzo insolito: di solito si usano finali come ,90 o ,95 (es. 59,90 / 64,90). Resta una tua scelta di marketing: lo implemento esattamente come indicato.
- I prezzi vanno comunicati **IVA esclusa** (vendita B2B; per clienti UE con partita IVA vale il reverse charge). Stripe Tax è già attivo nel checkout.
- **"Senza sposarsi"**: mensile, disdetta in qualsiasi momento (già così: annullamento a fine periodo), ed esportazione CSV delle richieste inclusa in tutti i piani. Questo riduce la paura di restare "bloccati" ed è coerente con la strategia.

---

## 2. Cosa esiste oggi (verificato nel codice)

- **Permessi**: `convex/lib/entitlements.ts` è l'unica fonte di verità per quello che ogni piano può fare. I blocchi lato server sono in `convex/lib/enforcement.ts`.
- **Stripe**: checkout, cambio piano, portale, sincronizzazione e webhook in `convex/billing.ts`. Il webhook verifica la firma HMAC-SHA256 in tempo costante, ha una tolleranza di 5 minuti, è idempotente sugli eventi (`billingEvents`), controlla l'IP e non si fida del `tenantId` dichiarato se il customer non corrisponde. I prezzi sono in `convex/lib/billingPlans.ts`, con gli ID Stripe presi da variabili d'ambiente.
- **Accesso ai dati per azienda** (l'equivalente di RLS in Convex): `requireMembership` su ogni funzione, con i ruoli in `convex/lib/rbac.ts`.
- **Blocchi nell'interfaccia**: `src/lib/plan-gates.ts` + `PlanGate` + lucchetto nel menu. Oggi bloccano solo Statistiche e Showroom.

### Problemi trovati che questo aggiornamento deve risolvere
1. **Il widget supera i limiti.** In `convex/widget.ts`, oltre il tetto mensile la richiesta viene salvata con `overQuota: true` ma resta **completamente visibile** al montatore: il limite di fatto non esiste.
2. **I PDF non sono contati.** Vengono generati nel browser (`@react-pdf`) senza nessun contatore lato server.
3. **I link WhatsApp non sono contati.**
4. **Lo Showroom non registra nulla sul server** (calcolo tramite query): oggi non esiste il concetto di "preventivo showroom" da contare.
5. **Logistica e diversi moduli non hanno un permesso per piano**: sono aperti a qualunque piano attivo.

---

## 3. Specifica dei nuovi piani

Chiavi interne: `essentials`, `essentials_plus`, `max`. Moltiplicatori calcolati sul **primo piano** (regola "×2 / ×5"), salvo decisione diversa in §4.

| Limite mensile | Essentials | Essentials+ (×2) | Max (×5) |
|---|---|---|---|
| Richieste ricevute dal widget | 40 | 80 | 200 |
| …di cui scaricabili in PDF dal montatore | 15 | 30 | 75 |
| Invii WhatsApp (senza PDF) | 40 | 80 | 200 |
| Configuratori (widget o pagina link/social) | 1 | 3 | 10 |
| Showroom — preventivi | 🔒 | 40 | 200 |
| Showroom — PDF | 🔒 | 15 | 75 |
| Showroom — WhatsApp | 🔒 | 40 | 200 |
| Logistica | 🔒 | 🔒 | ✅ |
| Utenti del team | 1 | 2 | 3 |
| Badge "Powered by OneSpec" nel widget | visibile | visibile | visibile |
| Trial gratuito | no | no | no |

**Pagine aperte:** Panoramica, Notifiche, Configuratori, Richieste, Account/Squadra/Piano/Fatturazione. In più Showroom (E+ e Max) e Logistica (Max).
**Pagine con lucchetto** (come oggi per le funzioni non incluse): Statistiche, Preventivi B2B, Trattative, Clienti, Cantieri, Rilievi, Posa UNI 11673, Collaudi, Fascicoli QR, più Showroom per Essentials e Logistica per Essentials/E+.

**Invariato:** Base, Pro, Agency ed Enterprise mantengono esattamente gli accessi attuali ("non modificare accessi"). Ogni nuovo permesso aggiunto vale `true` per loro.

---

## 4. Decisioni prese (29/09/2026)
1. **Oltre il limite il widget accetta ma blocca.** Il cliente finale invia comunque e nessun lead va perso. Il montatore vede la richiesta con i dati personali nascosti **lato server** (nome, email, telefono, messaggio) finché non sale di piano o non inizia il mese nuovo.
2. **Moltiplicatori calcolati su Essentials**: Essentials+ vale ×2, Max vale ×5 di Essentials. I limiti showroom di Essentials+ sono quelli di Essentials (40/15/40); quelli di Max sono ×5 (200/75/200).
3. **WhatsApp = invii del montatore** dalla pagina Richieste (testo, senza PDF), contati sul server una volta per preventivo. Il pulsante "Invia riepilogo su WhatsApp" del cliente finale non è limitato.
4. **Utenti 1 / 2 / 3, badge "Powered by OneSpec" visibile** su tutti e 3 i piani (il white-label resta da Pro in su).

---

## 5. Fasi di lavoro

### Fase 0 — Preparazione e sicurezza
- T0.1 Branch dedicato, baseline: `typecheck`, `lint`, `test` verdi prima di toccare nulla.
- T0.2 Test di regressione sui permessi attuali (snapshot di Base/Pro/Agency/Enterprise), così "non modificare accessi" è verificato automaticamente.

### Fase 1 — Modello dati e permessi (server, fonte di verità)
- T1.1 `schema.ts`: nuove chiavi di piano nell'unione `plan`; contatori mensili nuovi in `usageCounters` (`pdfExportsCount`, `whatsappSendsCount`, `showroomQuotesCount`, `showroomPdfCount`, `showroomWhatsappCount`); tabella `meteredEvents` per l'idempotenza (lo stesso preventivo scaricato due volte conta una volta sola).
- T1.2 `entitlements.ts`: profili `ESSENTIALS`, `ESSENTIALS_PLUS`, `MAX` con i limiti di §3, derivati per moltiplicatore da una sola costante; nuovi permessi booleani per modulo (`moduleFieldQuotes`, `modulePipeline`, `moduleClients`, `moduleCantieri`, `moduleLogistics`, …), tutti `true` sui piani esistenti.
- T1.3 `enforcement.ts`: funzioni `enforceModule(...)` e `consumeMeteredAllowance(...)` con transazione atomica (lettura + incremento nella stessa mutation, niente race).
- T1.4 Applicazione dei blocchi lato server in **ogni** query/mutation dei moduli bloccati (clienti, cantieri, rilievi, posa, collaudi, fascicoli, pipeline, preventivi B2B, logistica, statistiche), non solo nell'interfaccia.

### Fase 2 — Widget che non supera i limiti
- T2.1 `widget.ts insertQuote`: rispetto del tetto secondo la decisione 1, notifica al montatore all'80% e al 100%.
- T2.2 `getPublicConfigurator` / pagina `/w` e `/c`: comportamento coerente con la decisione 1.
- T2.3 Richieste oltre il limite: dati del cliente nascosti lato server (non solo sfocati nel browser) fino all'upgrade o al mese successivo.
- T2.4 Tetto sui configuratori pubblicati (1 / 3 / 10) anche in fase di pubblicazione, non solo di creazione.

### Fase 3 — PDF, WhatsApp e Showroom misurati
- T3.1 Mutation `requestPdfExport(quoteId)`: il PDF si genera solo dopo il via libera del server; conteggio idempotente per preventivo.
- T3.2 Mutation `requestWhatsappSend(quoteId)` prima di aprire WhatsApp.
- T3.3 Showroom: "preventivo showroom" registrato sul server al primo invio (WhatsApp, PDF o sopralluogo) di un progetto, con una chiave di bozza; limiti separati da quelli del widget.

### Fase 4 — Stripe (checkout, cambio piano, webhook)
- T4.1 `billingPlans.ts`: 3 piani con prezzi in centesimi (4995 / 6244 / 7990) e variabili `STRIPE_PRICE_ESSENTIALS_MONTHLY`, ecc. Mappatura inversa price → piano (il webhook deve riconoscerli).
- T4.2 `billing.ts`: `createCheckoutSession`, `previewPlanChange` e `changePlan` accettano i nuovi piani; `subscriptionPatch` li riconosce anche dai metadati; nessun trial sui nuovi piani (il trial resta solo su Pro).
- T4.3 Verifica: la firma dei webhook e l'idempotenza restano invariate; test con eventi firmati di prova per ogni nuovo piano.
- T4.4 Downgrade/upgrade tra piani widget e piani completi: effetti sui limiti a metà mese (i contatori sono mensili: salire di piano sblocca subito; scendere non cancella dati).

### Fase 5 — Interfaccia
- T5.1 Pagina Piano: **prima i 3 piani widget**, sotto i piani della piattaforma completa; prezzi IVA esclusa; confronto chiaro di cosa è incluso.
- T5.2 Onboarding: stessa gerarchia nello step "Scegli il piano"; aggiornamento della raccomandazione del quiz.
- T5.3 Menu e pagine: lucchetto su tutte le voci non incluse (stesso componente di oggi), `PlanGate` esteso a tutti i moduli di §3.
- T5.4 Indicatori d'uso (richieste, PDF, WhatsApp, showroom) in Panoramica e Richieste, con avviso all'80%.
- T5.5 Traduzioni in 6 lingue (it, en, fr, de, nl, ro).

### Fase 6 — Verifica bug del preventivatore e dei limiti
- T6.1 Test automatici (convex-test): ogni limite, ogni piano, casi al confine (39/40/41), concorrenza (due richieste simultanee sull'ultimo posto), cambio di mese, downgrade.
- T6.2 Test negativi di sicurezza: utente di un'altra azienda, ruolo non autorizzato, chiamata diretta alle API dei moduli bloccati.
- T6.3 Prova end-to-end del widget reale (Playwright) su telefono e desktop: invio, limite raggiunto, PDF, WhatsApp.

### Fase 7 — Audit full-stack
- T7.1 Permessi e autorizzazioni su ogni funzione Convex pubblica.
- T7.2 Prestazioni: query non limitate (`.collect()`), conteggi con `.collect().length` (ne esistono in `enforcement.ts`), indici.
- T7.3 Build, typecheck, lint, test; report finale con elenco dei problemi trovati e risolti.

### Cosa serve da CORE829 fuori dal codice
- Creare in Stripe i 3 prodotti/prezzi (49,95 · 62,44 · 79,90 €/mese) e comunicarmi gli ID, oppure impostarli come variabili d'ambiente su Convex.
- Aggiornare termini di servizio e pagine legali con i nuovi piani.
