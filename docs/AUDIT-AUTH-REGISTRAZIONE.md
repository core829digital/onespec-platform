# Registrazione e autenticazione (A1–A3)

## Età: cosa dice la legge (e cosa abbiamo scelto)
- **Nessuna norma UE obbliga ogni form di registrazione a chiedere l'età.** Il GDPR (art. 8) fissa l'età del consenso digitale solo quando il trattamento si basa sul *consenso* per servizi della società dell'informazione offerti direttamente a minori; ogni Stato sceglie tra 13 e 16 anni (IT 14, FR 15, DE/NL/RO/IE 16; altri 13–16). Fonti secondarie consultate: guide di conformità; **da confermare con il consulente legale** sulle leggi nazionali.
- OneSpec è uno strumento **professionale B2B** e il contratto + il DPA richiedono capacità d'agire: abbiamo fissato **18 anni** (soglia più severa, quindi soddisfa anche l'art. 8).
- Il form chiede la **data di nascita** (non solo "ho 18 anni") per poterne dimostrare il controllo; il server la ricalcola, non si fida del browser. Conservata in `users.birthDate`, inclusa nell'export GDPR dell'account.

## Validazione e sanitizzazione (client + server)
`src/shared/signup.ts` (stesse regole nel form e nel server) + `convex/lib/authGuard.ts::withInputGuards`:
- e-mail pulita e minuscola su **tutti** i flussi (signIn/signUp/reset/verifica) → "A@x.com " e "a@x.com" sono lo stesso account;
- password: 8–128 caratteri, almeno una lettera e un numero, non uguale all'e-mail, niente caratteri di controllo; mai ritagliata. Al **login** non si applica la forza (gli account esistenti entrano) ma si limita la lunghezza (anti-DoS dell'hash);
- nome persona: testo pulito, niente markup/caratteri invisibili;
- data di nascita reale (no 30 febbraio), 18–110 anni; Termini/Privacy obbligatori;
- dati azienda: paese supportato, P.IVA con checksum del paese, CAP del paese, via/città;
- ordine dei controlli: input → Turnstile → libreria Convex Auth.

## Mostra/nascondi password
Componente `PasswordInput` (occhio, 44 px, `aria-pressed`, etichette in 6 lingue) in registrazione, login e reset.

## Dati aziendali e DPA nel flusso di registrazione
- Il form ha il blocco "Dati dell'azienda" (facoltativo) e la casella DPA (attivabile solo con ragione sociale + P.IVA + indirizzo).
- Dati e accettazione sono salvati *dal server* in `users.signupIntake` (validati). Dopo la verifica e-mail la pagina di onboarding crea **da sola** l'azienda (`registerTenant` usa i dati validati, non quelli del browser) e registra `dpaAcceptances` con **data/ora e versione realmente accettate**, firmatario = chi si è registrato, + riga di audit `dpa.accept` (via: signup). L'intake viene poi cancellato (minimizzazione).
- Limite noto: nessun hash dell'IP nella firma (il flusso di Convex Auth non espone la richiesta HTTP). L'identità del firmatario è l'e-mail verificata + timestamp + versione.

## Test
`tests/signup.test.ts`, `tests/convex/signup-intake.test.ts`, E2E (`e2e/app-flows.mjs`: toggle password, minorenne bloccato, casella DPA, nessun overflow a 390 px).
