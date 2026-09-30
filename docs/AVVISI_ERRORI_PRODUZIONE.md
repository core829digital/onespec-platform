# Avvisi automatici sugli errori in produzione

Obiettivo: sapere **prima dei clienti** quando qualcosa si rompe. Gli avvisi sono su più livelli, perché ogni strumento vede una parte diversa.

## Cosa copre ogni livello

| Livello | Cosa vede | Come ti avvisa | Stato |
|---|---|---|---|
| **Avvisi OneSpec (nuovi)** | Webhook Stripe non applicato (un cliente può aver pagato senza accesso), preventivo del widget perso, verifica abbonamenti con Stripe fallita, controllo "una prova per carta" fallito, disdetta non riflessa | Email a `OPS_ALERT_EMAIL`, al massimo una ogni 30 minuti per causa | **Da attivare: 1 variabile** |
| **Sentry** | Errori nelle pagine (browser) e nel server Next.js | Email/Slack secondo le regole che imposti | Raccolta già attiva; **regole da creare** |
| **Convex** | Errori delle funzioni backend, tempi, limiti | Dashboard; avvisi via integrazione Sentry (piano Convex Pro) o Log Stream | Da configurare (facoltativo) |
| **Stripe** | Consegne del webhook fallite | Email automatiche di Stripe all'amministratore | Verifica nelle notifiche Stripe |
| **Vercel** | Deploy falliti | Notifiche del progetto | Verifica nelle impostazioni |
| **Monitor esterno** | Sito non raggiungibile | Email/SMS | Da creare (gratuito) |

## 1. Avvisi OneSpec (2 minuti)

Su Convex → Environment Variables (produzione) aggiungi:

- `OPS_ALERT_EMAIL` = gli indirizzi che devono ricevere gli avvisi, separati da virgola (per esempio `contact.core829@gmail.com`).

Serve che l'invio email sia attivo (`RESEND_MODE=live` e `AUTH_RESEND_KEY` già impostati). Senza `OPS_ALERT_EMAIL` l'errore viene comunque scritto nei log di Convex con l'etichetta `[OPS-ALERT]`, ma non arriva nessuna email.

Come provarlo: in Convex → Functions → `ops:alert`, esegui con `{"source":"prova","message":"test avviso"}`. Deve arrivare un'email con oggetto "[OneSpec] Errore in produzione: prova".

## 2. Sentry: le regole di avviso (5 minuti)

La raccolta degli errori è già attiva nel codice. In Sentry (progetto OneSpec) → **Alerts** → **Create Alert**:

1. **Nuovo errore**: "Issue alert", condizione "A new issue is created", azione "Send a notification to… Members/Email". Ti avvisa alla prima comparsa di un errore mai visto.
2. **Errore che esplode**: condizione "Number of events in an issue is more than 20 in 1 hour", stessa azione. Ti avvisa quando un errore colpisce molti utenti.
3. (Facoltativo) **Regressione**: "The issue changes state from resolved to unresolved".

Controlla in Sentry → Settings → Projects → Alerts che le email siano attive per il tuo utente.

## 3. Convex (facoltativo, consigliato)

- Dashboard Convex → Settings → **Integrations** → *Exception reporting* (Sentry): incolla il DSN del progetto Sentry. Gli errori non previsti delle funzioni backend arrivano in Sentry e ricadono nelle regole del punto 2. Richiede il piano Convex Pro.
- Dashboard Convex → Settings → **Log Streams**: inoltra i log a un servizio esterno; si può creare un avviso sul testo `[OPS-ALERT]`.

## 4. Stripe e Vercel

- Stripe → Sviluppatori → Webhook → il tuo endpoint: controlla che gli avvisi email per consegne fallite siano attivi (Stripe li manda all'amministratore dell'account dopo consegne ripetutamente fallite).
- Vercel → Project → Settings → Notifications: attiva le email per "Deployment Failed".

## 5. Monitor esterno (gratuito)

Crea un controllo a 1–5 minuti (per esempio UptimeRobot o BetterStack) su:

- `https://onespec.eu/it` (il sito risponde)
- la pagina di login `https://onespec.eu/it/auth/login`

Avviso via email/telefono se non risponde.

## Come leggere un avviso

| Oggetto email | Significato | Cosa fare |
|---|---|---|
| `stripe-webhook` | Un evento Stripe non è stato applicato: un cliente potrebbe aver pagato senza accesso | Stripe → Webhook → rinvia l'evento; oppure premi "Ricontrolla" sull'account del cliente |
| `widget-quote-submit` | Un visitatore ha inviato un preventivo e non è stato salvato | Controlla i log Convex per l'ID del widget indicato; contatta il rivenditore |
| `stripe-reconcile` | Il controllo automatico degli abbonamenti non riesce a parlare con Stripe o trova incoerenze | Verifica la chiave Stripe su Convex e lo stato di Stripe |
| `trial-card-check` | Non è stato possibile verificare se la carta aveva già fatto una prova | Verifica manualmente l'abbonamento indicato |
| `cancel-sync` | Una disdetta in prova è stata eseguita su Stripe ma l'account non si è aggiornato subito | Di solito si corregge da solo entro 15 minuti; altrimenti controlla il webhook |

Nota: se usi la modalità test di Stripe con chiavi di test mentre esistono account con ID live, il controllo `stripe-reconcile` segnala errori. È normale in quel periodo; torna silenzioso con le chiavi live.
