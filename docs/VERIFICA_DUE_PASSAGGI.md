# Verifica in due passaggi (2FA) — come funziona e come si attiva

## Cosa fa
Facoltativa per ogni utente (Account → «Verifica in due passaggi»). Dopo l'attivazione, oltre alla password serve il codice a 6 cifre dell'app di autenticazione (Google Authenticator, Microsoft Authenticator, 1Password, Authy…) o un **codice di recupero** monouso.

Si applica a: **accesso con password** e **reimpostazione della password** (il codice via email da solo non basta per prendere un account protetto). Non si applica all'accesso di squadra con codice d'invito (`team-access`), che non usa la password.

## Misure
- Standard TOTP (RFC 6238, SHA-1, 30 s, 6 cifre) — verificato con i vettori ufficiali della RFC (`tests/totp.test.ts`).
- Il segreto è cifrato (AES-256-GCM, legato all'utente) con `MFA_ENCRYPTION_KEY`; i codici di recupero (10, monouso) sono salvati solo come HMAC.
- Ogni codice vale una volta (anti-replay); finestra ±1 passo per l'orologio del telefono.
- 5 errori di fila bloccano la verifica per 15 minuti (contatore salvato anche se la richiesta fallisce).
- Disattivare o rigenerare i codici richiede un codice valido: una sessione aperta e rubata non può togliere la protezione.
- Fail-closed: se la chiave manca, la pagina lo dice e nessuno può attivare; chi ha già il secondo fattore non entra senza.
- Audit: `mfa.enabled`, `mfa.disabled`, `mfa.locked`, `mfa.recovery_used`, `mfa.recovery_regenerated`. La cancellazione dell'account elimina il secondo fattore.

## Da fare al deploy
1. Su Convex imposta `MFA_ENCRYPTION_KEY` (≥32 caratteri, ad es. `openssl rand -hex 32`). **Non cambiarla dopo**: i segreti già cifrati non si leggerebbero più (gli utenti dovrebbero reimpostare il 2FA con un intervento manuale). Conserva la chiave nel gestore di segreti.
2. Deploy Convex, poi piattaforma.
3. Prova: attiva il 2FA su un account di test, esci, rientra, prova un codice di recupero.

## Se un utente perde telefono e codici
Nessun recupero automatico (sarebbe una scorciatoia per gli attaccanti). Procedura manuale: verificare l'identità fuori banda (richiesta da email registrata + conferma telefonica/aziendale), poi un amministratore elimina la riga `userMfa` dell'utente dalla dashboard Convex e l'azione va annotata nel registro.

## Limiti noti
- Non obbligatoria (nemmeno per gli admin di piattaforma): rendere obbligatorio per gli admin è il passo successivo consigliato.
- Chi conosce già email e password può verificare se un account ha il 2FA (la risposta cambia): rischio basso, accettato.
- Bloccare 5 tentativi può essere usato per rallentare un utente per 15 minuti; il blocco però non permette di entrare.
