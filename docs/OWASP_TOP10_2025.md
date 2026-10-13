# OWASP Top 10:2025 — stato della piattaforma OneSpec (12/10/2026)

Mappa onesta: per ogni voce, cosa c'è (con il file/test che lo dimostra) e cosa resta. Nessuna voce è dichiarata «chiusa» senza prova.

| # | Voce 2025 | Misure presenti | Rischio residuo |
|---|---|---|---|
| A01 | Broken Access Control | `requirePermission`/`requireMembership` su ogni funzione Convex, controllo di proprietà per documento (IDOR), test negativi `tests/convex/*`; allegati ticket: cliente solo i propri, staff via `authorizeStaff`; download con **grant firmato** legato ad allegato+utente+scadenza (`convex/lib/signing.ts`, `convex/http/support_file.ts`) | — |
| A02 | Security Misconfiguration | CSP con nonce su widget/demo, HSTS, nosniff, frame-ancestors, Referrer/Permissions-Policy; download allegati con `CSP: sandbox`, `Content-Disposition: attachment`; fail-closed se `SUPPORT_SIGNING_SECRET` manca; avviso rumoroso se `DAILY_IP_SALT` manca | CSP pagine app ancora in *report-only* (da rendere bloccante dopo osservazione) |
| A03 | Software Supply Chain Failures | Dependabot (npm + Actions), `npm audit` in CI, nuovo passo `npm audit signatures` (firme/provenienza del registro), CodeQL, lockfile con `npm ci` | Le GitHub Actions sono su tag maggiori (`@v4`), **non fissate a SHA**: da fare in un passaggio con accesso a GitHub (Dependabot le aggiorna già) |
| A04 | Cryptographic Failures | HMAC-SHA-256 con confronto a tempo costante (`safeEqual`), SHA-256 dei file, segreto ≥32 caratteri obbligatorio, TLS ovunque, password con hash del fornitore auth, IP solo come hash salato | Salt IP di ripiego pubblico se `DAILY_IP_SALT` manca (ora logga un avviso) → impostarlo |
| A05 | Injection | Validatori Convex su ogni argomento, nessun SQL, niente `eval`, sanitizzazione HTML (DOMPurify), email senza testo dei messaggi, nomi file normalizzati; parser documenti con anti zip-bomb/macro | — |
| A06 | Insecure Design | Modello di minaccia widget/ticket documentato; limiti di frequenza (`consumeToken`), limiti dimensione/numero allegati, quarantena allegati fino a scansione, note interne in tabella separata | — |
| A07 | Authentication Failures | Rate limit su login/registrazione/reset, Turnstile sui form pubblici, sessioni del fornitore auth, età minima verificata, **verifica in due passaggi TOTP con codici di recupero** (`docs/VERIFICA_DUE_PASSAGGI.md`), applicata anche al reset password | 2FA facoltativa (non obbligatoria, nemmeno per gli admin); nessun controllo password violate; lunghezza minima 8 → portare a 12 |
| A08 | Software or Data Integrity Failures | Webhook con firma+timestamp+anti-replay (Stripe, Resend/Svix); allegati con **attestazione firmata** (hash, esito, versione scanner, caricante) verificata a ogni download e su richiesta («Verifica integrità»); header di risposta firmato `X-OneSpec-Signature` | — |
| A09 | Security Logging & Alerting Failures | `auditLog` per ogni apertura allegato, blocco malware, invio ticket; avvisi errori in produzione; `reportBlocked` registra i file respinti | Nessun SIEM esterno (non necessario alla scala attuale) |
| A10 | Mishandling of Exceptional Conditions | Scanner e firma **falliscono chiusi** (errore ⇒ file respinto, `SCAN_ERROR`); codici errore mappati in 6 lingue con test anti-regressione (`MALWARE_DETECTED`, `SIGNING_NOT_CONFIGURED`); nessuno stack trace al client | — |

## Allegati: cosa significa «antivirus» qui
Scanner **interno** (`convex/lib/malwareScan.ts`): firma EICAR, eseguibili/script incorporati, polyglot (ZIP/RAR/7z/ELF dentro immagini), struttura e CRC di PNG/JPEG/WebP, PDF senza JavaScript/azioni di lancio/file incorporati. **Non è un motore antivirus commerciale** e non riconosce malware sconosciuto: riduce nettamente il rischio per i soli formati ammessi (immagini e PDF). Un motore esterno (es. ClamAV gestito) resta una scelta opzionale futura.

## Da fare all'attivazione
1. Impostare su Convex: `SUPPORT_SIGNING_SECRET`, `MFA_ENCRYPTION_KEY` (entrambi `openssl rand -hex 32`, non cambiarli dopo) e `DAILY_IP_SALT`.
2. Dopo un periodo senza falsi positivi, rendere bloccante la CSP.
3. File caricati prima di questa versione: l'azione `attestLegacy` li rianalizza e firma.
