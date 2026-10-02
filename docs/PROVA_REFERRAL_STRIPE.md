# Prova del sistema inviti in modalità test Stripe

Obiettivo: verificare l'intero giro (invito → sconto → pagamento → 30 giorni → premio) **senza toccare soldi veri**, prima di impostare `REFERRALS_ENABLED=1` in produzione. Tempo: circa 1 ora.

## 0. Cosa serve
- Un ambiente Convex **di sviluppo** collegato alla piattaforma (non quello di produzione).
- Account Stripe in **modalità test** (interruttore "Test mode" in alto a destra nella dashboard).

## 1. Chiavi e variabili (ambiente di sviluppo)
1. Stripe → Developers → API keys: copia la chiave segreta di test (`sk_test_…`).
2. Variabili Convex di sviluppo: `STRIPE_SECRET_KEY=sk_test_…`, `REFERRALS_ENABLED=1` (più le altre già usate per l'abbonamento: prezzi e webhook di test, vedi `.env.example`).
3. Se usi una chiave limitata (restricted), servono permessi di scrittura su: Customers, Checkout Sessions, Coupons, Transfers, Accounts, Account Links, Customer balance transactions, e lettura su Invoices, Charges, Payment methods.

## 2. Abilitare Stripe Connect (solo per il pagamento in denaro)
1. Stripe → Connect → "Get started" (anche in modalità test). Scegli "Platform or marketplace".
2. Verifica che in Connect sia consentito creare conti **Express** collegati.
3. Gli account collegati in test si completano con i dati finti di Stripe (es. IBAN di prova `DE89370400440532013000`, codici di verifica indicati nella pagina di onboarding).
4. Per avere fondi da trasferire in test: Stripe → Balance → "Add to balance" (carta di prova `4000 0000 0000 0077`), così il saldo piattaforma è positivo.

## 3. Giro completo
1. Crea l'account A (invitante): apri **Account → Invita e risparmia**, copia il link.
2. In una finestra anonima apri il link, registra l'account B con un'email di **dominio diverso** (non lo stesso dominio aziendale) e una carta di prova diversa.
3. Da B scegli un piano a pagamento: nel Checkout deve comparire lo sconto del 10%. Paga con `4242 4242 4242 4242`.
4. In **/app/admin/referrals** l'invito passa a "Qualificato" dopo il primo pagamento reale.
5. Per non aspettare 30 giorni, in Convex dashboard sposta indietro la data di qualifica (campo `qualifiedAt` del referral) di 31 giorni; il cron `referral-reward` (ogni 6 ore) può essere lanciato a mano dalla dashboard.
6. Premio in **credito**: sul cliente Stripe di A compare un saldo negativo pari al 10% del listino (IVA esclusa).
7. Premio in **denaro**: in A scegli "Denaro", premi "Collega conto Stripe", completa l'onboarding di prova, torna alla pagina (stato "Pronto"). Rilancia il cron: in Stripe → Connect → Transfers compare il trasferimento.
8. Storno: rimborsa il pagamento di B entro 60 giorni dal qualificante e rilancia `referral-clawback`: credito riaddebitato o trasferimento stornato.

## 4. Cosa controllare
- Nessun doppio premio rilanciando i cron più volte.
- Email ricevute in lingua corretta (invitato, invito registrato, premio).
- Con `REFERRALS_ENABLED` rimosso: nessun codice nuovo, nessuno sconto, menu comunque visibile ma pagina informativa.

## 5. Prima di andare in produzione
- Ripeti i punti 1–2 con le chiavi live; verifica che i fondi sul saldo piattaforma coprano i premi in denaro.
- Commercialista: trattamento fiscale del premio in denaro (fattura/ricevuta, ritenute, IVA, imposta).
- Legale: revisione del Regolamento (`/legal/regolamento-inviti`) e compilazione del campo fiscale.
- Parti con 10 clienti pilota e osserva 30 giorni.
