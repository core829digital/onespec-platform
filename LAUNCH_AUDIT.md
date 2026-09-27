# OneSpec — Full-Stack Launch Audit

**Data:** 2026-09-27
**Commit di riferimento:** `b7d1579` (CI verde, run #53)
**Metodo:** verifica automatica (tsc, eslint, vitest, next build), scansione statica del codice, lettura diretta dei log/dati di produzione Convex, una sessione di navigazione reale sul widget pubblico. Nessun tool di scansione dinamica (axe-core dal vivo, penetration test) è stato eseguito in questa sessione.

Questo documento dice cosa è **verificato e verde**, cosa è **plausibile ma non provato**, e cosa **resta da fare**, senza arrotondare per eccesso. "Zero bug garantiti" non è un'affermazione che un audit di questo tipo può fare onestamente — nessuno può, senza test end-to-end su ogni percorso utente in produzione con carte reali.

---

## 1. Stato dei controlli automatici — ✅ VERDE

| Controllo | Comando | Esito |
|---|---|---|
| Type check | `npx tsc --noEmit` | ✅ 0 errori |
| Lint | `npm run lint` | ✅ 0 errori (261 errori esistono solo se si lancia `eslint .` sull'intero disco, inclusa `apps/status-page/`, una cartella locale **non tracciata da git** e quindi mai vista dalla CI — non è un problema del progetto) |
| Test | `npx vitest run` | ✅ 287/287, 58 file |
| Build | `npm run build` (Next.js) | ✅ completa senza errori |
| CI GitHub Actions | run #53, commit `b7d1579` | ✅ tutti i passi verdi (Typecheck, Lint, Test, Build) |

Le 12 run precedenti (n. 41–52) erano rosse per un test (`triggers.test.ts`) che lasciava una funzione schedulata attiva dopo la fine del test, causando un errore non gestito solo su Linux/CI. Corretto con timer finti + drenaggio esplicito; verificato con 3 esecuzioni ripetute del file isolato e 2 dell'intera suite in modalità CI, nessun errore.

Ho anche trovato e rimosso 2 file spuri da 0 byte (`0`, `vi.useRealTimers())`) creati per errore da un mio comando precedente — non arrivati in nessun commit.

---

## 2. Traduzioni (6 lingue: IT/EN/FR/DE/NL/RO)

**Completezza strutturale: 100%.** Confronto chiave-per-chiave tra i 6 file `messages/*.json` (1146 chiavi in IT): 0 chiavi mancanti, 0 chiavi in eccesso in ciascuna lingua.

**Controllo valori identici alla versione italiana** (indizio di traduzione mancata): ~15–41 valori per lingua segnalati, tutti verificati a mano. Sono quasi tutti prestiti legittimi o parole uguali in più lingue (Email, Menu, WhatsApp, Lead, Prospect, Account, "Data" in rumeno, nomi propri come MaPrimeRénov'), non traduzioni dimenticate.

**Un punto da rivedere (non corretto, perché potrebbe essere voluto):** `clients.subtitle` nel file **italiano** è in inglese — `"Client Intelligence Hub — CRM"`. Se è uno slogan di prodotto voluto, va bene così; se è una svista, va scritto in italiano e poi tradotto nelle altre 5 lingue. Non l'ho toccato perché non è un bug tecnico, è una scelta editoriale che spetta a te.

**Non verificato:** la qualità della traduzione (fluidità, tono) e se ogni stringa tradotta è effettivamente quella mostrata a schermo nel contesto giusto — questo richiede una revisione umana madrelingua o una navigazione manuale in ogni lingua.

---

## 3. Sicurezza

### 3.1 Autorizzazione sulle funzioni Convex — ✅ verificato
Scansione automatica di tutte le 219 definizioni di funzione in `convex/*.ts` (query/mutation/action pubbliche e interne). Prima passata: 21 segnalazioni di funzioni senza un controllo di autenticazione riconoscibile. Ho letto ognuna delle 21 a mano: **tutte** risultano protette da un helper che il mio primo pattern non riconosceva (`requireUser`, `requireVerifiedUser`, `ownedConfigurator` → `requirePermission`). Nessun gap reale trovato in questa passata.

Non verificato in questo giro: che ogni funzione applichi il controllo sul **tenantId giusto** (isolamento multi-tenant) in ogni singolo caso — `billing.ts` è stato rivisto a fondo nelle sessioni precedenti; gli altri moduli (`quotes.ts`, `configurators.ts`, ecc.) non sono stati riletti riga per riga in questa sessione.

### 3.2 Webhook Stripe — ✅ verificato, in produzione
- Firma HMAC verificata, con supporto a più `v1` durante la rotazione del segreto (test dedicati).
- Percorso non indovinabile (`/ev/<token-casuale>`), non registrato affatto se il token manca.
- Limite di dimensione (512 KB) prima di leggere il corpo.
- Allowlist IP dalla lista ufficiale Stripe (`stripe.com/files/ips/ips_webhooks.json`), aggiornata ogni 6h, con interruttore `WEBHOOK_IP_ENFORCE=0`.
- Verificato in produzione: percorso nuovo attivo, vecchio percorso 404, una richiesta di test da un IP non-Stripe bloccata con 403.
- Idempotente (`billingEvents.stripeEventId` unico) e con log di controllo (`auditLog`).

### 3.3 Webhook Resend/Svix — ✅ verificato
Firma Svix verificata (HMAC su `id.timestamp.body`, non un semplice HMAC del payload). Fallisce chiuso (503) senza `RESEND_WEBHOOK_SECRET`. Allowlist IP dalla lista ufficiale Svix. **Il segreto non risulta impostato in produzione** — il webhook è di fatto spento finché non lo imposti.

### 3.4 Endpoint HTTP pubblici (`convex/http.ts`)
- `/api/widget/quote`: validato con schema Zod (`QuoteSubmissionSchema`), honeypot anti-spam, rate limit per IP/configuratore.
- `/api/inspection/*`: rafforzati in questa sessione con controlli di tipo e lunghezza a runtime (i cast TypeScript da soli non validano nulla su una richiesta HTTP).
- `/api/widget/view`: valida solo la presenza di `publicId`, non tipo/lunghezza — rischio basso (letto poi da una funzione Convex con il proprio validatore).

### 3.5 Autenticazione (login/registrazione/reset)
Turnstile lato server aggiunto (`convex/lib/authGuard.ts`), attivabile con `TURNSTILE_ENFORCE_AUTH=1`. **Non ancora attivato** — verifica prima che il riquadro compaia su `/it/auth/login` con la chiave pubblica giusta in produzione, poi accendi il flag. Finché è spento, login e registrazione non hanno protezione anti-bot lato server (Convex Auth applica comunque un limite ai tentativi falliti, quello è indipendente).

### 3.6 Rate limiting
Presente e verificato per: preventivi widget (per IP/10min, per IP/giorno, globale/configuratore), export dati, PIN ospite, scansioni/interventi fascicolo, collaudi, e — aggiunto in questa sessione — tutte le azioni di billing (checkout, portale, anteprima, cambio piano, disdetta, sincronizzazione).
**Non coperto:** un limite generale per-IP su tutte le funzioni chiamate direttamente dal browser (Convex non ha un firewall applicativo integrato; le funzioni non passano da Vercel). Il login ha il proprio limite in Convex Auth, indipendente da questo sistema.

### 3.7 Validazione input
Convex valida già tipo e forma di ogni argomento su ogni funzione (obbligatorio nel framework). In aggiunta, in questa sessione:
- Limiti di lunghezza aggiunti su `cantieri.ts` (nome, indirizzo, note, ecc.) e sugli endpoint HTTP dei collaudi.
- **Non ancora fatto ovunque:** ci sono ~449 usi di `v.string()` nel backend senza un limite di lunghezza esplicito. Convex li accetta come stringa valida di qualsiasi lunghezza fino al limite di sistema (1 MB). Non è una falla di sicurezza in sé (nessuna query SQL, nessun buffer fisso), ma una richiesta enorme e legittima in un campo testo potrebbe gonfiare le righe del database. Priorità bassa, da fare a campione sui form pubblici.

### 3.8 Segreti esposti in questa conversazione
Nel corso della sessione mi hai incollato in chat: `rk_live_...` (chiave Stripe ristretta) e il segreto del webhook `whsec_...`. **Vanno rigenerati** ora che il flusso funziona — sono finiti nella cronologia della chat, che non è un posto sicuro per tenerli a lungo termine.

---

## 4. Logica di business (billing/abbonamenti)

- **Corretto in questa sessione:** il piano non si aggiornava dopo un upgrade/downgrade/checkout per un bug nella mappatura prezzo→piano (enumerazione di `process.env` inaffidabile nel runtime Convex) e per l'uso di un endpoint Stripe (`/invoices/upcoming`) che Stripe ha rimosso.
- Aggiunta un'azione `syncSubscription` che rilegge l'abbonamento da Stripe al ritorno dal checkout e dopo ogni cambio piano, così l'utente non aspetta il webhook. Chiamata anche a ogni apertura della pagina abbonamenti se esiste già un abbonamento, come rete di sicurezza.
- Popup di conferma per attivazione, upgrade e downgrade, in 6 lingue.
- 14 test unitari coprono la mappatura prezzo→piano con dati reali presi dall'abbonamento di prova che hai creato tu.
- **Verificato sui tuoi dati reali di produzione**, non solo in teoria: ho letto il tenant e l'abbonamento di prova dal database Convex e da Stripe per confermare la diagnosi.
- **Non verificato da me:** un upgrade/downgrade/annullamento reale dopo il deploy di queste correzioni — il tuo prossimo test in produzione è la prova vera.

---

## 5. Prodotto (configuratori, PDF)

- **Widget pubblico:** aperto dal vivo un configuratore pubblicato (Winex Infissi) — si carica, la configurazione, il disegno tecnico e il calcolo prezzo funzionano. Non ho provato l'invio di un preventivo reale né gli altri configuratori pubblicati.
- Un configuratore di test risultava "non disponibile": coerente con il tenant fermo sul piano Base (il widget pubblico richiede Pro) — dovrebbe risolversi da solo con il fix del punto 4.
- **PDF preventivo:** trovate e corrette sovrapposizioni di testo reali (fino a 38 in un caso limite con 9 posizioni e nomi lunghi), un titolo che usciva dalla pagina, e simboli/bandierine emoji che stampavano caratteri illeggibili con il font Helvetica incorporato. Verificato con un'analisi automatica delle posizioni del testo (via pdf.js), non con lettura visiva del PDF (nessun visualizzatore disponibile in questo ambiente).
- Aggiunto un test che impedisce di reintrodurre caratteri fuori dal set Windows-1252 in qualunque PDF futuro.
- **Gli altri 12 modelli PDF** (collaudo, DoP, garanzia, manutenzione, ecc.) hanno ricevuto solo le correzioni generiche (niente sillabazione, niente simboli illeggibili) — non sono stati analizzati singolarmente per sovrapposizioni come il preventivo.

---

## 6. Accessibilità

Esiste un rapporto precedente non tracciato da git (`A11Y_AUDIT_REPORT.md`, 22 settembre 2026) che segnala 396 problemi "seri", per lo più "manca l'elemento `<main>`" su ~150 pagine. **Ho verificato che questo è quasi certamente un falso positivo**: `AppShell` (usato da ogni pagina sotto `/app`) contiene già `<main id="main-content">` — lo scanner probabilmente ha controllato ogni file di pagina isolatamente, senza sapere che il layout condiviso lo avvolge. Non ho rilanciato uno scanner dal vivo per confermarlo con certezza.

**Non verificato:** navigazione da tastiera, screen reader, contrasto colori — nessuno di questi è testabile senza un browser reale con strumenti di accessibilità.

---

## 7. Cose che restano da fare, in ordine di urgenza

1. **Rigenerare `rk_live` e il segreto webhook** passati in chat.
2. **Attivare `TURNSTILE_ENFORCE_AUTH=1`** dopo aver verificato a video che il riquadro compaia sul login.
3. **Impostare `RESEND_WEBHOOK_SECRET`** (o accettare che il webhook Resend resti spento).
4. **Provare un vero upgrade/downgrade/disdetta** in produzione ora che i fix del billing sono live.
5. Decidere su `clients.subtitle` (slogan in inglese nel file italiano — voluto o svista?).
6. Rivedere gli altri 12 modelli PDF per sovrapposizioni, uno per uno.
7. Passata di limiti di lunghezza sui restanti campi `v.string()` esposti a form pubblici.
8. Rimuovere `ignoreBuildErrors: true` da `next.config.mjs` (nasconde errori di tipo in build) — segnalato da sessioni precedenti, non ancora fatto.
9. Sostituire le finestre `window.confirm()` native (7 pagine, incluso il flusso di pagamento) con un dialogo del design system.
10. Una vera scansione di accessibilità dal vivo (axe-core in un browser reale) per confermare o smentire il rapporto del 22/9.
11. Test manuale della UI in almeno EN e una lingua non latina d'uso (NL) per la resa visiva delle traduzioni più lunghe.

## 8. Cosa NON posso verificare da qui
Nessun accesso a Sentry, PostHog, alla Dashboard Stripe/Cloudflare, o a un browser con account di test reale per una prova pagamento end-to-end con conferma visiva. Questi controlli restano tuoi.
