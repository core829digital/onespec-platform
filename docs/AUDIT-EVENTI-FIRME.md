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
