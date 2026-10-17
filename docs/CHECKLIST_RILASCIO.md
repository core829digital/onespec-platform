# Checklist di rilascio · OneSpec (versione 1.25.2)

Per CORE829 SRL · da stampare o spuntare in ordine. Ogni passo ha un controllo ("✔ Verifica") per essere sicuri che sia andato a buon fine.
Non saltare l'ordine: il backend (Convex) va online **prima** di piattaforma e sito.

Dove si fa ogni cosa:
- **Convex** = dashboard.convex.dev → progetto OneSpec → deployment **Production**
- **Vercel** = vercel.com → progetto della piattaforma e progetto del sito
- **GitHub** = repository `onespec-platform` e `onespec-website`, ramo `main`

---

## 0 · Prima di iniziare (5 minuti)
- [ ] Apri GitHub e controlla che l'ultimo commit su `main` sia quello atteso (piattaforma: «Telefono: area di tocco 44 px…», sito: «Changelog 1.25.2…»).
- [ ] Controlla che i controlli automatici (CI) dell'ultimo commit siano verdi.
- [ ] Avvisa il team che c'è un rilascio. Scegli un orario a basso traffico.
- [ ] Tieni aperto un password manager: servono per salvare le chiavi nuove.

## 1 · Chiavi segrete su Convex (Production)
Convex → Settings → Environment Variables → Add. Per generare un valore: nel terminale `openssl rand -hex 32`.

| ☐ | Nome | Valore | Note |
|---|---|---|---|
| ☐ | `SUPPORT_SIGNING_SECRET` | `openssl rand -hex 32` (almeno 32 caratteri) | Senza, gli allegati del supporto non funzionano |
| ☐ | `MFA_ENCRYPTION_KEY` | `openssl rand -hex 32` (almeno 32 caratteri) | **Non cambiarla mai più.** Salvala nel password manager |
| ☐ | `DAILY_IP_SALT` | `openssl rand -hex 16` | Rende anonimi gli indirizzi IP |

- [ ] Salvate nel password manager, con la dicitura «OneSpec · Convex · Production».
- ✔ Verifica: nella lista variabili compaiono tutte e tre.

## 2 · Altre variabili da controllare su Convex (Production)
Devono già esserci. Controlla solo che non manchi nulla:
- [ ] Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASE`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_PATH_TOKEN`
- [ ] Email (Resend): `AUTH_RESEND_KEY`, `RESEND_FROM`, `RESEND_FROM_NOREPLY`, `RESEND_FROM_PURCHASES`, `RESEND_WEBHOOK_SECRET`
- [ ] Anti-bot (Turnstile): `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES`
- [ ] Indirizzi: `SITE_URL`, `CONVEX_SITE_URL`, `ALLOWED_APP_ORIGINS`
- [ ] Supporto e avvisi: `OPS_ALERT_EMAIL`, `SUPPORT_REPLY_TO`
- [ ] Le chiavi Stripe sono quelle **live** (non di prova) e intestate a CORE829 SRL.
- [ ] **Scorciatoia:** dopo aver pubblicato il backend, apri nella piattaforma *Amministrazione → Controllo pagamenti*. Controlla in un clic chiavi, conto Stripe, prezzo di ogni piano, webhook, Stripe Tax, portale clienti e le altre chiavi: ogni voce rossa o gialla dice cosa fare. Non mostra mai il valore delle chiavi.

## 3 · Pubblicare il backend (Convex)
Scegli **una** strada:
- [ ] **A (consigliata):** GitHub → repository `onespec-platform` → Actions → «Deploy backend (Convex)» → Run workflow. Esegue prima controllo dei tipi e test, poi pubblica.
- [ ] **B:** nel terminale, nella cartella del progetto: `npx convex deploy`
- ✔ Verifica: nella dashboard Convex, sezione Functions/Logs, compare il nuovo deploy e nessun errore rosso.

## 4 · Pubblicare la piattaforma (Vercel)
- [ ] Vercel → progetto piattaforma → Deployments: attendi il deploy dell'ultimo commit di `main` (o fai «Redeploy»).
- ✔ Verifica: stato «Ready». Apri la piattaforma e controlla che in basso nel menu laterale si legga la versione **1.25.2**.

## 5 · Pubblicare il sito (Vercel)
- [ ] Vercel → progetto sito → Deployments: attendi il deploy dell'ultimo commit di `main`.
- ✔ Verifica: la pagina «Versioni» (changelog) mostra in cima **1.25.2**.

## 6 · Prove dopo la pubblicazione (10 minuti, su produzione)
Fai queste prove con un account di prova, **non** con clienti reali.
- [ ] **Accesso:** registrazione e login funzionano; il login con password errata dà un messaggio chiaro.
- [ ] **Allegati supporto (il problema segnalato):** Supporto → nuovo ticket → allega una foto. Deve caricarsi senza «Server Error».
  Se fallisce: Convex → Logs → cerca `[finalizeUpload] stage=` e mandami la riga.
- [ ] **Doppio controllo (2FA):** Account → Sicurezza → attiva, scansiona il QR, inserisci il codice, salva i codici di recupero. Esci e rientra con il codice.
- [ ] **Pagamento:** un acquisto di prova con Stripe (modalità prova se disponibile, altrimenti rimborso immediato). Controlla che la fattura sia intestata a CORE829 SRL.
- [ ] **Email:** arriva l'email di benvenuto/ticket e il mittente è OneSpec.
- [ ] **Telefono vero:** apri la piattaforma da un telefono: pulsanti e filtri si toccano senza difficoltà, nessuno scorrimento laterale, tema chiaro e scuro ok.
- [ ] **Legale:** nelle pagine legali compare «OneSpec è un prodotto digitale di CORE829 SRL».
- [ ] **Trascinamento:** pagina Pipeline e Cantieri: sposta una scheda con il dito; si muove fluida e si assesta.

## 7 · Nelle 24 ore dopo
- [ ] Convex → Logs: nessun errore ripetuto.
- [ ] Controlla la casella `OPS_ALERT_EMAIL`: nessun avviso di errore.
- [ ] Controlla Stripe → Webhook: consegne riuscite (nessun rosso).
- [ ] Controlla Resend: nessun rimbalzo anomalo.

## 8 · Se qualcosa va storto (piano di ritorno)
- **Piattaforma o sito:** Vercel → Deployments → scegli il deploy precedente → «Promote to Production». Torna indietro in un minuto.
- **Backend (Convex):** non c'è un pulsante di ritorno: si riporta il codice a un commit precedente e si ripubblica (Passo 3). Per questo conviene pubblicare in un orario tranquillo.
- **Chiavi:** non cambiare `MFA_ENCRYPTION_KEY` per «provare», rovinerebbe il 2FA degli utenti che lo hanno attivato.
- Per un incidente con dati personali segui `docs/PROCEDURA_INCIDENTI.md` (obbligo di avviso entro 72 ore).

---

## Cose da fare ma non bloccanti per il rilascio
- [ ] **Avvocato:** far rivedere i testi legali (privacy, termini, DPA, regolamento inviti).
- [ ] **Fornitori:** controllare i contratti di trattamento dati (DPA) con Convex, Vercel, Stripe, Resend, PostHog, Sentry.
- [ ] **NIS2:** verificare se CORE829 supera la soglia di dipendenti/fatturato prevista.
- [ ] **GitHub Actions:** fissare le versioni (SHA) delle azioni usate nella CI.
- [ ] **Sicurezza contenuti (CSP):** passare dalla modalità «solo segnalazione» a quella che blocca, dopo qualche settimana senza segnalazioni.
- [ ] **2FA obbligatorio** per amministratori e team (oggi è facoltativo).
- [ ] **Backup:** fare una prova di ripristino dei dati Convex.

---
Firma di chi ha rilasciato: ____________________  Data e ora: ____________________  Versione: 1.25.2
