# Audit "firma-evento" (S2)

Principio: la piattaforma reagisce a **eventi verificati** (firma + timestamp + idempotenza), mai a ciò che il client dichiara o a proprie azioni.

| Ingresso | Verifica | Replay / idempotenza | Esito |
|---|---|---|---|
| Stripe webhook `/ev/<token>` | HMAC-SHA256 `Stripe-Signature`, tolleranza timestamp, allowlist IP Stripe | tabella eventi processati (id evento) | OK (già presente) |
| Resend webhook `/api/email/webhook` | firma Svix (`id.timestamp.body`, base64), skew 5 min, allowlist IP Svix, fail-closed senza segreto | **nuovo**: `svix-id` salvato in `emailDeliveryLog.svixId` (indice `by_svix`), ripetizioni = no-op | **CORRETTO** |
| Piano/abbonamento | cambia solo da webhook Stripe o da `syncSubscription` (owner-only, rilegge Stripe, controlla proprietà per id/metadata/customer) | upsert idempotente | OK |
| `updateTenant` | nessun campo piano/stato accettato dal client | n/a | OK |
| Turnstile (auth, widget) | siteverify server-side, token monouso Cloudflare, hostname allowlist opzionale | monouso lato Cloudflare | OK; permissivo finché `TURNSTILE_SECRET` non è impostato (da impostare in produzione) |
| Cron | tutti i 11 cron puntano a funzioni `internal.*` | sweep idempotenti | OK |

## Bug trovato e corretto
Il gestore Resend si aspettava `type === "email"` con `data.event` e `data.recipient`. Resend invia `type: "email.delivered"`, `data.email_id`, `data.to[]`: **consegne, bounce e reclami venivano ignorati**. Ora `convex/lib/resendEvent.ts` interpreta il formato reale (timestamp futuri scartati, `detail` appiattito e limitato) e bounce/complaint segnano l'email come `failed` una sola volta. Test: `tests/convex/resend-webhook.test.ts`.

## Da fare lato deploy
- Impostare `RESEND_WEBHOOK_SECRET` (`whsec_…`) e puntare il webhook Resend a `/api/email/webhook` con eventi delivered/bounced/complained/opened/clicked.
- Impostare `TURNSTILE_SECRET` e `TURNSTILE_HOSTNAMES`.

# Audit form / e-mail / controlli admin (S3)

- **Newsletter / e-mail marketing**: non esiste alcun invio marketing. Esiste solo il consenso `marketing` (account) salvato e rimovibile. Tutte le e-mail sono transazionali (verifica, reset, preventivi, abbonamento, inviti). Se in futuro si aggiunge un invio marketing: obbligatori consenso esplicito, link di disinfestazione + header `List-Unsubscribe`, soppressione dopo bounce/reclamo.
- **Template**: tutti i dati dinamici passano da `esc()`/`escUrl()`/`line()` (HTML e oggetto senza CR/LF).
- **Destinatario**: `email.send` ora rifiuta indirizzi con CR/LF, virgole, nome visualizzato o più destinatari (prima solo il provider li rifiutava) — test inclusi.
- **Admin `resendEmail`**: richiede admin piattaforma verificato; ora non rinvia template con credenziali/link (verify, reset, team_access, invitation), non rinvia a indirizzi con bounce/reclamo e scrive una riga di audit `admin.email_resend`.
- **Controlli admin**: tutte le query/mutation in `admin.ts`, `adminCleanup`, `adminPurge`, `registration`, `ops` usano `requirePlatformAdmin`; `seed` è interno.
- **Bounce/reclami**: ora registrati davvero (vedi S2).
