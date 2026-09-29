# Report finale — Piani Level 1 · 2 · 3, audit upgrade/downgrade, audit pagamenti

**CORE829 SRL · OneSpec · 29/09/2026** · branch `claude/gallant-fermi-j3du6u`
Piano d'implementazione di riferimento: `docs/PIANO_ABBONAMENTI_WIDGET.md`.

---

## 1. In breve

- **Aggiunti** 3 piani della famiglia **Widget**: Level 1 (€49,95), Level 2 (€62,44), Level 3 (€79,90). Solo mensili, niente prova gratuita, prezzi IVA esclusa.
- **Restano attivi e vendibili**, senza modifiche ad accessi e prezzi, i 4 piani della famiglia **Piattaforma intera**: Base, Pro, Agency, Enterprise. Un test automatico fa da allarme se un permesso di questi piani cambia per errore.
- Tutti i limiti sono applicati **lato server**: richieste, PDF, WhatsApp, Showroom, configuratori, utenti e moduli bloccati. Nascondere i pulsanti nell'interfaccia non basta a sbloccare nulla.
- **Test: da 302 a 370, tutti verdi.** Typecheck e lint puliti.
- Durante l'audit ho trovato e corretto **9 bug reali**, 5 dei quali riguardano il sistema pagamenti (sezione 4).

## 2. Matrice dei piani

Nomi commerciali Level 1/2/3; chiavi tecniche invariate: `essentials` / `essentials_plus` / `max`.

| | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| Richieste dal widget / mese | 40 | 80 (×2) | 200 (×5) |
| PDF scaricati dal montatore / mese | 15 | 30 | 75 |
| Invii WhatsApp dal montatore / mese | 40 | 80 | 200 |
| Configuratori | 1 | 3 | 10 |
| Showroom (preventivi / documenti / WhatsApp al mese) | 🔒 | 80 / 30 / 80 | 200 / 75 / 200 |
| Logistica | 🔒 | 🔒 | ✅ (3 fornitori, 3 corrieri) |
| White-label | ❌ badge visibile | ✅ | ✅ |
| Utenti | 1 | 2 | 3 |

**Pagine bloccate** (lucchetto nel menu e pagina di upgrade, rifiuto lato server `PLAN_UPGRADE_REQUIRED`): Statistiche, Preventivi B2B, Trattative, Clienti, Cantieri, Rilievi, Posa, Collaudi, Fascicoli QR, più Showroom su Level 1 e Logistica su Level 1 e 2.

## 3. Come funziona "accetta ma blocca"

1. Oltre il limite mensile la richiesta del cliente **viene salvata**: nessun lead perso.
2. Il montatore vede valore e prodotti, ma **non i contatti**. Il server li oscura in: elenco, dettaglio, PDF, CSV, notifiche in-app ed e-mail, fascicoli collegati.
3. Lo sblocco avviene **subito all'upgrade**, oppure **il primo del mese** tramite il cron giornaliero `unlock-previous-period-requests`. Un downgrade non ri-blocca mai una richiesta già visibile.
4. PDF e WhatsApp contano **una volta per richiesta**: riscaricare o reinviare la stessa richiesta non consuma altri crediti. I conteggi sono transazionali: due clic contemporanei non possono prendersi entrambi l'ultimo credito.

**Limite onesto:** PDF e messaggi WhatsApp si generano nel browser. Il server consegna il documento stampabile solo se c'è credito, ma il **numero di telefono resta visibile** al montatore nelle richieste non bloccate. Chi vuole può scrivergli su WhatsApp a mano: il limite misura la funzione dell'app, non può impedirlo fisicamente.

## 4. Bug trovati e corretti

| # | Area | Problema | Effetto prima della correzione |
|---|---|---|---|
| 1 | Configuratori | Il tetto era contato su un contatore **mensile** mai decrementato | Ogni mese si potevano creare N configuratori in più |
| 2 | Widget | Oltre il limite il lead era solo "segnato" | I limiti del piano venivano superati senza conseguenze |
| 3 | White-label | Il badge seguiva l'impostazione salvata, non il piano attuale | Dopo un downgrade il badge restava nascosto |
| 4 | Pagamenti | Un tenant già abbonato poteva aprire un **secondo Checkout** | **Doppio addebito** |
| 5 | Pagamenti | `checkout.session.completed` attivava il tenant **senza impostare il piano pagato** | Per qualche istante il tenant restava sul piano precedente (es. Base) |
| 6 | Pagamenti | Il ramo "prova Pro" del webhook leggeva metadati che la sessione non aveva | Codice mai eseguito |
| 7 | Pagamenti | **Eventi Stripe fuori ordine** applicati senza controllo | Un evento vecchio in ritardo poteva annullare un upgrade |
| 8 | Pagamenti | Tenant Level **disdetto** con widget ancora attivo | Richieste raccolte senza pagamento |
| 9 | Guida iniziale | Chiedeva di creare cliente e cantiere e di invitare un collega anche dove impossibile | Guida mai completabile sui piani Level |

In più:
- **Panoramica:** senza correzione sarebbe andata in errore sui piani Level, perché interrogava moduli bloccati.
- **Dettaglio richiesta e Showroom:** nascondono le azioni che portano a moduli bloccati (moduli di campo, firma, "Richiedi sopralluogo").
- **Downgrade verso un piano Level:** rifiutato se il team ha più membri dei posti inclusi.

## 5. Audit upgrade / downgrade (task #10)

Transizioni verificate con test automatici:

| Transizione | Esito |
|---|---|
| Level → Level superiore | limiti più alti subito, richieste bloccate sbloccate ✅ |
| Level → Piattaforma (es. Pro) | moduli sbloccati, richieste sbloccate ✅ |
| Piattaforma → Level | moduli bloccati, **dati conservati** (non cancellati) ✅ |
| Level → Level inferiore | nessun ri-blocco; configuratori oltre il tetto mostrano il lucchetto al pubblico (restano i più vecchi entro il tetto) ✅ |
| Downgrade con più utenti dei posti | rifiutato con messaggio chiaro ✅ |
| Prova Pro → Level | la prova termina subito (regola esistente) ✅ |
| Disdetta Level | a fine periodo il widget si blocca; nuovo Checkout consentito ✅ |
| Replay di un evento / evento falsificato per un altro tenant / evento vecchio in ritardo | ignorati ✅ |

**Decisione da confermare:** le richieste arrivate durante una sospensione si sbloccano comunque il mese successivo, come da regola "nuovo mese". Se preferisce, possiamo tenerle bloccate fino alla riattivazione.

## 6. Audit infrastruttura pagamenti (task #11)

Già solido e verificato:
- Firma HMAC-SHA256 senza SDK, con confronto a tempo costante, tolleranza di 300 s e supporto alla rotazione del segreto.
- URL segreto del webhook, allowlist IP di Stripe, limite dimensione payload.
- Idempotenza tramite `billingEvents`. Il tenant viene risolto dal customer Stripe, non dall'id dichiarato nell'evento.
- Azioni di fatturazione riservate al proprietario e con rate limit.
- Redirect protetti da allowlist (nessun open redirect).

Raccomandazioni (non fatte, richiedono una sua decisione o un'azione in Stripe):
1. **Customer Portal Stripe:** disattivare il cambio piano dal portale, oppure limitarlo ai prodotti corretti. I cambi fatti lì saltano le guardie dell'app: posti utente, solo mensile.
2. **Cron `billing.reconcile`:** oggi è vuoto. Se un webhook va perso, il piano si ri-sincronizza solo quando il proprietario apre la pagina Piano. Consiglio una sincronizzazione notturna.
3. **Piani Piattaforma disdetti:** oggi un Pro sospeso mantiene il widget pubblico attivo. Non l'ho cambiato per la regola "non modificare accessi", ma è una perdita di ricavi. Consiglio di applicare la stessa regola dei piani Level.
4. **Prezzi Stripe da creare** (IVA esclusa: `tax_behavior = exclusive`, perché `automatic_tax` è attivo):
   - `STRIPE_PRICE_ESSENTIALS_MONTHLY` → Level 1, €49,95
   - `STRIPE_PRICE_ESSENTIALS_PLUS_MONTHLY` → Level 2, €62,44
   - `STRIPE_PRICE_MAX_MONTHLY` → Level 3, €79,90
   - Facoltativo: varianti regionali `_IT`, `_FR`, … con lo stesso schema.
5. **Termini di servizio:** aggiungere i piani Level e la regola "accetta ma blocca".

## 7. Audit full-stack (Fase 7)

- **Controllo accessi:** scansione automatica di tutte le funzioni pubbliche del backend. Ognuna verifica l'utente o il ruolo, oppure è pubblica di proposito e protetta da token o PIN (fascicolo QR, PIN ospite, link installatore, invito, widget pubblico).
- **Query senza limite:** nel codice esistente ci sono circa 100 `.collect()`. Quasi tutti operano su insiemi piccoli per natura (voci di catalogo per configuratore, membri per tenant). Il codice nuovo usa solo letture limitate. Consiglio una pulizia graduale; non è urgente.
- **Build e test:** esito finale riportato nel messaggio di consegna.

## 8. Cosa non ho potuto verificare qui (onestà)

- **Test E2E nel browser con backend reale:** in questo ambiente non c'è un deployment Convex, quindi le pagine non sono state provate cliccando dal vivo. Logica e sicurezza sono coperte da 370 test sul backend reale in memoria (`convex-test`).
- **Concorrenza reale:** i test girano in sequenza. La garanzia viene dalle transazioni serializzabili di Convex, non da un test di carico.
- **Stripe live:** i flussi di Checkout, portale e fatture vanno provati in modalità test di Stripe dopo aver creato i prezzi del punto 6.4.
