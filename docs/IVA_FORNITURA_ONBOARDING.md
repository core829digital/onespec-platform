# IVA, VIES, consegna, onboarding a 10 passi e Fornitura

Documento di riferimento per le funzioni introdotte nelle fasi V1–V10.

## 1. Prezzi: IVA esclusa e calibrazione

- I listini del catalogo sono **senza IVA**. L'IVA si somma sopra (aliquota 0% inclusa).
  `calculatePrice` restituisce `priceExVatCents` (somma netta arrotondata) e `priceCents` (netto + IVA).
- Il listino standard è calibrato su un preventivo reale: Aluplast Ideal 4000, zona Centro, 1432 × 1548 mm,
  fornitura + trasporto dalla fabbrica, IVA esclusa = **420,00 €**.
  Fattore unico `SUPPLY_FACTOR = 18947 / 26500` (−28,5%), applicato a tutti i profili e a tutte le zone
  (`src/shared/standard-pricing.ts`). La tabella di mercato grezza resta invariata.
- **Attenzione migrazione:** i cataloghi personalizzati esistenti ora sono letti come prezzi netti.

## 2. IVA 0% e VIES

Regole in `src/shared/tax.ts`, applicate anche dal server (`convex/lib/vat.ts`, alla creazione del preventivo):

| Cliente | IVA |
|---|---|
| Stesso paese del montatore | aliquota nazionale |
| Azienda di altro paese UE con P.IVA **attiva in VIES** | 0% (art. 138 Dir. 2006/112/CE, inversione contabile) |
| Azienda UE senza verifica VIES valida | aliquota nazionale (lo 0% è bloccato) |
| Privato di altro paese UE | aliquota nazionale |
| Fuori UE (inclusi San Marino e Vaticano) | 0% esportazione (art. 146) |
| Altro 0% | solo esenzione manuale con motivazione scritta (≥ 5 caratteri) |

- Monaco rientra nel territorio IVA francese.
- La verifica usa l'API REST della Commissione (`convex/vies.ts`, action `vies.verify`):
  limite 20 richieste / 10 minuti, timeout 10 s, validità della verifica 14 giorni.
  Se il servizio non risponde, **lo 0% non è mai consentito**.
- La frase legale (6 lingue) compare su PDF, export e pagina richiesta.
- Sono informazioni generali, non consulenza fiscale: da confermare con il commercialista.

## 3. Consegna e posa a cura del montatore

Per configuratore: `deliveryMode` = `factory` (prezzo con trasporto della fabbrica) oppure `own`
(trasportatore/montatore proprio) con `ownServicePerM2Cents` (0–1000 €/m², max 2 decimali).
Il costo è aggiunto per pezzo come `round(tariffa · m²)` prima del margine. La tariffa resta memorizzata se si torna a `factory`.

## 4. Onboarding a 10 passi

`welcome, planQuiz, billing, company, address, contact, tax, team, pricing, configurator`
(planQuiz e billing si saltano se un piano è già attivo).

- Ogni campo è validato in tempo reale (`src/shared/validation.ts`) **e di nuovo sul server**
  (`convex/onboarding.ts`, `convex/tenants.ts`): un client manomesso non aggira le regole.
- Partita IVA per paese, con checksum reale: IT (11 cifre, Luhn), SM (5 cifre), VA (facoltativa),
  FR/MC (chiave + SIREN), BE (10 cifre, mod 97), NL (9 cifre + B01–B99), DE (9 cifre, ISO 7064),
  AT (U + 8 cifre), LU (8 cifre, mod 89).
- Passo *Fiscalità*: spiegazione del VIES, aliquota abituale, conferma di lettura obbligatoria.
- `onboarding.complete` rifiuta (`ONBOARDING_INCOMPLETE`) se mancano dati.

## 5. Fornitura

Un processo per ogni preventivo: **Preventivo → Ordine → Produzione → Consegna → Consegnata**.

- *Ordine*: il cliente ha pagato / firmato (il preventivo diventa `won`; avviene in automatico alla firma o al cambio stato).
- *Produzione*: il montatore inserisce il costo che paga alla fabbrica (obbligatorio) e può segnare la fabbrica come pagata.
- *Consegna*: costo del trasporto (obbligatorio, anche 0).
- *Consegnata*: da qui la fornitura conta nel profitto.
- Fornitori (`supplyPartners`) con ruoli **produce** e/o **consegna**.
- Tutti gli importi sono senza IVA, interi in centesimi, 0 – 10.000.000 €.
- Tornare indietro e cancellare: solo admin/owner; cancellazione solo prima della produzione.
- Pagina `/app/supply` e voce **Fornitura** nel menu laterale (tutti i piani).

### Profitto netto

`ricavo senza IVA − costo fabbrica − trasporto − altri costi`, **senza imposte sul reddito**.
Finestre: mese, trimestre, semestre, anno, 2, 3, 5 e 10 anni (mesi di calendario UTC, intervallo (da, a]),
solo forniture consegnate nella finestra. Le forniture aperte compaiono come "profitto previsto".
