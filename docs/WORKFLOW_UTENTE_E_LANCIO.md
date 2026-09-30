# Percorso utente, paesi, lingue e prontezza al lancio

Stato al 29/09/2026, dopo l'audit completo di paesi (IT/FR/BE/NL/DE/LU), lingue (it/en/fr/de/nl/ro) e percorso utente.
Controlli automatici: 441 test verdi, build di produzione riuscita, tipi e lint puliti.
Un test blocca il build se nel codice viene usata una chiave di traduzione che manca anche in una sola lingua.

---

## 1. Il percorso dell'utente, passo per passo

| # | Passo | Cosa succede | Stato |
|---|-------|--------------|-------|
| 1 | Registrazione | Nome, email e password. La lingua della pagina viene salvata sull'account. | OK |
| 2 | Verifica email | Codice a 6 cifre, **nella lingua dell'utente** (prima era sempre in italiano). | Corretto |
| 3 | Azienda e paese | Nome azienda e paese (IT/FR/BE/NL/DE/LU). L'app passa alla lingua di quel mercato. Email di benvenuto nella lingua dell'utente. | Corretto |
| 4 | Scelta del piano | Quiz, poi 7 piani (Level 1/2/3, Base/Pro/Agency, Enterprise su richiesta). Con Stripe attivo si passa dal pagamento; senza Stripe il piano si attiva subito (modalità pre-billing). Il server non lascia entrare nessuno senza piano. | OK |
| 5 | Team | Il testo segue i posti reali del piano (niente "invita il team" se il piano ha 1 posto). | Corretto |
| 6 | Primo configuratore | Nasce con la **lingua e l'IVA del mercato** (prima: sempre italiano e 22%). Ecobonus attivo solo in Italia. | Corretto |
| 7 | Editor | Tutte le schede nelle 6 lingue. Etichette del catalogo nella lingua del widget. Testi personalizzati (titolo, sottotitolo, pulsante) ora davvero mostrati. | Corretto |
| 8 | Pubblicazione e incorpora | Link pagina singola `/c` su ogni piano, codice iframe solo se il piano lo include, link B2B solo se il piano ha quel modulo. | Corretto |
| 9 | Richiesta del cliente finale | Widget completo o semplice nella lingua del visitatore, con incentivi, norme ed esempi del mercato giusto. Messaggi d'errore comprensibili, mai codici tecnici. | Corretto |
| 10 | Notifica al rivenditore | Email nella lingua di ogni membro. Stato della richiesta tradotto. | Corretto |
| 11 | Preventivo PDF | Nella lingua del documento del mercato. Belgio FR/NL e Lussemburgo FR/DE selezionabili. | Corretto |
| 12 | Moduli di cantiere (piani piattaforma) | App posatore, fascicolo QR, vista cantiere condivisa e documenti PDF nella lingua del mercato. | Corretto |
| 13 | Inviti al team | Email e link nella lingua di chi invita. Chi si registra da un invito torna all'invito, non alla creazione di una nuova azienda. | Corretto |
| 14 | Cambio piano | Upgrade e downgrade verificati nell'audit pagamenti (vedi `AUDIT_ABBONAMENTI_PAGAMENTI.md`). | OK |
| 15 | Disdetta e cancellazione account | Portale Stripe. Cancellazione GDPR con job automatico. | OK |

---

## 2. Bug trovati e corretti in questo giro

**Gravi (bloccavano o davano risultati sbagliati)**

- La **vista cantiere condivisa `/k/PIN` non funzionava mai**: finiva su una pagina 404 e, anche raggiunta, andava in errore. In più inviava al browser dell'ospite dati interni (valore del cantiere, note). Ora funziona e mostra solo i dati previsti.
- **IVA sbagliata fuori dall'Italia**: ogni nuovo configuratore partiva al 22%, quindi i prezzi di un rivenditore francese avevano l'IVA italiana.
- **Widget in italiano per i mercati esteri**: il widget semplice (quello dei piani Level) era solo in italiano e con bonus e norme italiane.
- Il **catalogo predefinito** in tedesco e olandese mostrava i nomi in italiano. Le modifiche alle etichette non arrivavano mai ai widget FR/DE/NL.
- **Preventivo PDF del Belgio in italiano**; intestazioni miste italiano/francese per tutti i paesi.
- **Email**: la lingua dell'utente non veniva mai salvata, quindi tutte le email partivano in italiano (verifica, reset, notifiche, inviti).
- **Aggiramento del piano**: `/w/…?preview=1` mostrava il widget anche a chi non paga il widget incorporabile.
- **Widget semplice**: le finestre a 2 ante venivano tagliate a 120 cm.

**Coerenza (testi che promettevano cose non vere)**

- "Powered by OneSpec" mostrato anche a chi paga il white-label.
- La sezione "Testi del widget" non aveva alcun effetto.
- Nella pagina `/c` il wizard semplice mostrava i prezzi.
- "Ecobonus 50%" e opzione "Ecobonus 65%" (non più in vigore).
- "Finanziamento a tasso zero" presentato come certo.
- Istruzioni del PIN con l'indirizzo sbagliato.
- Titolo in rumeno ("Telemetru") nell'interfaccia italiana.
- Bollino "UNI 11673" su dossier francesi e tedeschi.

---

## 3. Cosa resta (decisioni o lavori futuri)

| Tema | Stato | Cosa serve |
|------|-------|-----------|
| Deploy Convex | **Da fare** | Aggiungere `CONVEX_DEPLOY_KEY` su Vercel e fare un Redeploy (oppure `git pull` + `npx convex deploy`). Senza questo passo le correzioni del backend non sono online. |
| Prezzi Stripe | Da fare | Configurare le variabili dei prezzi (Level 1/2/3 e piattaforma) e disattivare il cambio piano dal portale Stripe. |
| Enterprise | Decisione | Oggi ha un limite di 1000 richieste/mese. Deve essere illimitato? |
| Testi legali per paese | Da verificare | Note fiscali nel PDF (Bonus Casa 50/36%, MaPrimeRénov', Klimabonus 20%, ISDE, §35c) e percentuali nel preventivatore: da far controllare a un commercialista per ogni mercato, perché cambiano ogni anno. |
| DPA (contratto trattamento dati) | Da decidere | Esiste solo in italiano. Per clienti esteri serve una versione tradotta da un legale. |
| Pagine d'errore pubbliche | Accettabile | Bilingue italiano/inglese. |
| Codice non utilizzato | Fatto (30/09/2026) | Rimossi 17 file mai usati (6 PDF, 5 componenti widget, calcolatori e validatori orfani). Restano 15 pacchetti npm non usati: rimozione rimandata perché il lockfile ha un collegamento locale (`@swc/core`) da sistemare prima, con un ambiente Windows. |
| Dati già esistenti | Nessuna azione (pre-lancio) | I configuratori creati prima di oggi mantengono lingua e IVA vecchie; i cataloghi già creati non hanno le etichette DE/NL. Si correggono dall'editor. |

---

## 4. Verdetto

**Italia: pronta al lancio**, dopo il deploy di Convex e la configurazione di Stripe.

**Francia, Belgio, Paesi Bassi, Germania, Lussemburgo: pronte dal punto di vista del prodotto.** Widget, editor, email, PDF e pagine pubbliche sono nella lingua giusta, con IVA, norme e incentivi del mercato.
Prima di vendere in ciascun paese raccomando due cose non tecniche:
1. la verifica dei testi fiscali e legali da parte di un professionista locale;
2. un DPA tradotto.
