# Categorizzazione profili, qualità, vetri e guarnizioni — audit e correzioni

Regola applicata ovunque: **ogni scelta mostra solo ciò che è compatibile con le scelte fatte sopra**.

```
Materiale → Qualità (camere) → Profilo di quella qualità → Vetro che quel profilo può ospitare
```

Se l'utente seleziona "5 camere" compaiono solo profili a 5 camere; "6 camere" solo profili a 6 camere; ecc. Cambiando una scelta, quelle sotto si riallineano da sole e l'utente viene avvisato.

Codice delle regole (puro, condiviso da editor, showroom, widget, PDF e server): `src/shared/catalog-rules.ts`.

## I 34 difetti trovati e come sono stati risolti

| # | Difetto | Dove | Correzione |
|---|---|---|---|
| 1 | Il profilo non era collegato a nessuna qualità | `convex/schema.ts` | nuovo campo `qualityKey` sul profilo |
| 2 | La qualità PVC esisteva solo a 5 e 7 camere, non a 6 | `convex/catalog.ts` | semi 5-6-7 camere |
| 3 | I cataloghi già esistenti non avevano il livello a 6 camere | produzione | normalizzazione in lettura + scrittura alla pubblicazione + pulsante "Aggiorna catalogo" + `migrations:classifyProfiles` |
| 4 | Il menu Profilo mostrava tutti i profili, qualunque qualità | `piece-form.tsx` | filtro `profilesForQuality` |
| 5 | Cambiando qualità il profilo restava quello vecchio | `pieces-editor.tsx` | `reconcileItem` |
| 6 | Cambiando materiale il vetro non veniva ricontrollato | `pieces-editor.tsx` | `reconcileItem` |
| 7 | Cambiando profilo il vetro non si adattava | `pieces-editor.tsx` | il vetro passa al più spesso compatibile |
| 8 | Il vetro non era limitato dalla profondità del profilo | editor + widget | `glazingFitsProfile` (vetro max = profondità − 30 mm, regola indicativa) |
| 9 | Il tipo di guarnizione non era modellato | `standard-pricing.ts` | `gasket: standard/triple` |
| 10 | Nessun dettaglio tecnico del profilo (camere, profondità, guarnizione, vetro max) | editor, widget, admin | riga di dettagli sotto il menu |
| 11 | I gruppi del menu mostravano chiavi grezze (`economica`…) | `piece-form.tsx` | nomi tradotti nelle 6 lingue |
| 12 | Showroom → preventivo B2B inventava il profilo `"standard"` | `quotes/new/page.tsx` | nessun profilo inventato, scelto dall'editor |
| 13 | Un pezzo nuovo poteva avere un profilo di un'altra qualità | `item-defaults.ts` | profilo della prima qualità, vetro compatibile |
| 14 | `pieceIssues` non segnalava mai un profilo inesistente | `piece-ops.ts` | segnalazione attiva |
| 15 | Nessun blocco per combinazioni incoerenti | `piece-ops.ts` | `profileQuality` e `glazingDepth` bloccanti |
| 16 | La qualità a 6 camere di un catalogo vecchio sarebbe stata "sconosciuta" | `piece-ops.ts` | tier virtuale |
| 17 | Il server accettava qualunque combinazione | `convex/widget.ts`, `convex/quotes.ts` | `INVALID_COMBINATION` |
| 18 | Il widget elencava tutte le marche, qualunque qualità | `widget.tsx` | `brandChoices` |
| 19 | Le qualità di riserva del widget erano solo 5 e 7 | `widget-i18n.ts` | aggiunta 6 camere (5 lingue) |
| 20 | Il riepilogo del widget usava testi fissi, non il catalogo | `widget.tsx` | etichette dal catalogo |
| 21 | "Aggiungi un altro" ripartiva da valori non coerenti | `widget.tsx` | `freshState` |
| 22 | Lo stato iniziale del widget poteva avere profilo/vetro inesistenti | `widget.tsx` | `reconcileState` |
| 23 | Qualità senza profili: il widget inviava un profilo vecchio | `widget.tsx` | messaggio + pulsanti bloccati + nessun profilo inviato |
| 24 | Export (testo/HTML) senza qualità, camere, guarnizione, vetro | `quote-export` | `pieceSpecs` |
| 25 | PDF senza gli stessi dati | `QuotePrintPDF.tsx` | stesse righe |
| 26 | Il disegno in sezione disegnava 6 camere come 5 | `build-section.ts` | numero reale di camere |
| 27 | Uw e prezzo erano zero per la qualità a 6 camere mancante | `pricing.ts` | tier virtuale interpolato |
| 28 | Nel catalogo non si poteva classificare un profilo | `materials.tsx` | colonna Qualità + dettagli |
| 29 | Si poteva eliminare una qualità usata da profili | `convex/catalog.ts` | `QUALITY_IN_USE` |
| 30 | Nessun controllo di coerenza del catalogo | `catalog-check.tsx` | pannello "Controllo catalogo" |
| 31 | Le qualità comparivano nell'ordine di creazione (7 prima di 6) | editor + widget | ordine 5-6-7 |
| 32 | Le note dei profili (fibra di carbonio, tripla guarnizione) erano solo in italiano | `standard-pricing.ts` | traduzioni nelle 6 lingue |
| 33 | `upsertProfileSystem` non validava la qualità | `convex/catalog.ts` | `PROFILE_QUALITY_UNKNOWN` |
| 34 | I nuovi codici d'errore non avevano testo | `errors.ts`, messaggi | testi nelle 6 lingue |

## Cosa NON è cambiato (di proposito)

* I prezzi: nessun prezzo viene toccato. In modalità listino standard il prezzo dipende dal profilo, non dalla qualità; il moltiplicatore della qualità vale solo nei cataloghi con prezzi personalizzati (6 camere: 1,075, interpolato tra 5 e 7).
* I profili scritti a mano da un installatore e mai classificati: restano visibili sotto ogni qualità finché non li classifica (il Controllo catalogo li segnala).
* Il wizard semplice del widget invia una richiesta indicativa senza profilo né qualità: non ha scelte da filtrare.

## Limiti da conoscere

* **Profondità e vetro massimo**: la profondità viene dalla tabella dei 12 profili; il vetro massimo è una regola indicativa (profondità − 30 mm), non una scheda tecnica. Vale come guida e va confermata con il produttore.
* **Guarnizione**: solo dove il documento di riferimento la indica ("tripla guarnizione") è segnata come tripla; per gli altri profili risulta "standard".
* I cataloghi esistenti funzionano subito grazie alla normalizzazione in lettura; i dati si scrivono davvero alla prima pubblicazione, con il pulsante "Aggiorna catalogo" o con il comando sotto.

## Comando facoltativo (dopo il deploy)

```
npx convex run --prod migrations:classifyProfiles
```

Classifica i profili e aggiunge il livello 6 camere a tutti i configuratori. È sicuro ripeterlo: non riattiva qualità disattivate e non sovrascrive classificazioni scelte dall'installatore.
