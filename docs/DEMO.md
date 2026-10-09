# Demo pubblica della piattaforma (demo.onespec.eu)

**Cos'è.** Tutta la piattaforma (dashboard, preventivi, clienti, cantieri, leads, richieste, fornitura, rilievi, configuratori, showroom, statistiche…)
che gira **nel browser del visitatore**, con dati di esempio abbondanti. Nessun account, nessun server dati, nessun invio reale.
Le funzioni sono **quelle vere** di `convex/` (motore prezzi, permessi, validazioni): vengono eseguite da `convex-test` su un database in memoria.

## Come funziona
- **Host**: attivo solo su `demo.<dominio>` (`src/demo/is-demo.ts`); su ogni altro host la piattaforma è identica a prima.
- **Motore**: `src/demo/demo-backend.ts` (database in memoria) + `src/demo/demo-client.ts` (client Convex "finto" reattivo: query in abbonamento,
  aggiornate dopo ogni scrittura; paginazione inclusa). `scripts/gen-demo-modules.mjs` genera la mappa dei moduli (`convex-modules.generated.ts`).
- **Dati**: `src/demo/demo-seed.ts` li costruisce **attraverso le mutation vere**, con l'orologio portato indietro, così i grafici hanno storia.
  `tests/demo-seed.test.ts` controlla i volumi minimi.
- **Auth**: finta (titolare dell'azienda demo); i layout server sono bypassati (`proxy.ts`, `DemoAppRoot`).
- **Azioni esterne** (pagamenti Stripe, VIES, Stripe Connect): bloccate con un messaggio gentile (`DEMO_DISABLED`, 6 lingue).
- **Banner** in alto con «Ricomincia» che azzera i dati.
- **Incorporamento**: `Content-Security-Policy: frame-ancestors https://onespec.eu https://www.onespec.eu` sull'host demo (`next.config.mjs`).

## Deploy
1. Aggiungere il dominio `demo.onespec.eu` allo stesso progetto/deployment della piattaforma (alias).
2. Nessuna variabile d'ambiente in più.

## Test
`npm run e2e:demo` (build + `next start -p 3100`): 12 pagine × desktop/tablet/telefono, niente errori in console, niente overflow, banner visibile.

## Limiti noti
- Il primo caricamento prepara i dati (alcuni secondi); i dati si perdono alla chiusura della scheda (voluto).
- Il caricamento di file funziona solo in locale nel browser; Stripe/VIES/email sono volutamente spenti.

---

# Versione del prodotto nel menu laterale
Il numero (es. `v1.15.0`) compare accanto al piano nel menu laterale (desktop) e nel foglio «Altro» (telefono), con link alla pagina **Versioni** del sito.
- **Fonte unica**: il changelog del sito (`CHANGELOG_META` in `onespec-website/src/lib/site-config.ts`). La versione corrente è la più alta; il sito la espone su `https://onespec.eu/api/version`.
- **Aggiornamento automatico**: la piattaforma la legge lato server da `/api/version` (cache 5 minuti), e le schede aperte la rileggono ogni 10 minuti e al ritorno sulla scheda. Pubblicare una nuova voce del changelog sul sito aggiorna quindi la piattaforma **senza rideploy** della piattaforma.
- **Se il sito non risponde**: si usa `BUNDLED_VERSION` in `src/shared/app-version.ts` (aggiornarla ogni tanto; non è necessario per il funzionamento).
- Variabili: `MARKETING_SITE_URL` (server) e `NEXT_PUBLIC_MARKETING_SITE_URL` (link), default `https://onespec.eu`.

# Accessi illimitati (non admin)
`convex/lib/founding.ts`: `FOUNDER_EMAILS` (illimitato + admin) e `PARTNER_FULL_ACCESS_EMAILS` (illimitato, **mai admin**). Alla registrazione l'azienda nasce Enterprise attiva con `unlimitedAccess`, senza piano né pagamento. Per account già esistenti: `npx convex run migrations:grantFullAccessToPartners --prod`.
