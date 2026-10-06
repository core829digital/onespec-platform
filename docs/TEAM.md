# Accesso del team: sale, password, link + codice, gradi

## Come funziona
1. L'admin/owner dell'azienda crea una **sala** (gruppo) in *Account → Team*. L'app genera una **password alfanumerica** (es. `ABCDE-FGHJK`), **mostrata una sola volta**: nel database resta solo l'hash (PBKDF2). Va consegnata di persona/canale separato, mai via e-mail.
2. L'admin invita un membro (e-mail + **grado**). Il membro riceve **una sola e-mail** con il link e un **codice numerico a 6 cifre** monouso.
3. Dalla pagina di accesso, pulsante **"Unisciti a un'azienda"** → link + codice + password della sala (+ nome e consenso al primo ingresso). Nessuna registrazione.
4. Rientro: stesso percorso (e-mail + password della sala → nuovo link + codice, validi 15 minuti).

## Sicurezza
- Ticket monouso, scadenza invito 7 giorni / rientro 15 minuti; blocco dopo 5 tentativi errati (codice o password).
- Richiesta del link: risposta sempre neutra (non rivela se l'e-mail esiste), rate limit per e-mail e globale.
- Solo l'owner può assegnare gradi di livello admin. Posti del piano verificati all'invito e all'ingresso.
- Pulizia automatica dei ticket vecchi (cron giornaliero).

## Gradi (24) e aree
Il grado restringe ciò che il membro vede/usa, sopra al livello di accesso (owner/admin/member). Aree: commerciale, cantiere, logistica, forniture. Definizione in `src/shared/grades.ts`, etichette in 6 lingue in `src/shared/grade-labels.ts`. Un membro senza grado (esistente) mantiene accesso completo; l'owner non è mai ristretto.

## Passi manuali
- Verificare `SITE_URL` su Convex produzione (altrimenti i link puntano a localhost).
- Vecchi inviti pendenti non sono migrabili: la pagina `/invite/[token]` invita a chiedere un nuovo invito.
- Ruotare la `CONVEX_DEPLOY_KEY` (era stata incollata in chat).
