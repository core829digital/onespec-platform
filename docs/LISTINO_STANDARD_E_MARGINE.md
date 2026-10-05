# Listino prezzi standard e margine di profitto

Per ogni installatore italiano il catalogo parte da un listino reale e validato (12 profili PVC, tre zone). L'installatore sceglie la zona e decide solo il margine di profitto. Nessuna impostazione del catalogo viene eliminata.

## Dove sta il codice

| Cosa | File |
|---|---|
| Tabella dei 12 profili, zone, fasce di qualità, aritmetica del margine | `src/shared/standard-pricing.ts` |
| Motore prezzi (server, widget, showroom) | `src/shared/pricing.ts`, specchio in `src/components/widget/widget-pricing.ts` |
| Semina del catalogo e "Usa listino standard" | `convex/lib/standardCatalog.ts`, `convex/pricing.ts` |
| Snapshot pubblicato (prezzi della zona + margine) | `convex/lib/standardPricing.ts` |
| Domanda Nord/Centro/Sud nell'onboarding | `src/app/[locale]/onboarding/page.tsx`, `src/components/pricing/zone-picker.tsx` |
| Scheda "Prezzi e margine" (barra, campo decimale, esempio) | `src/components/configurator/pricing-tab.tsx` |
| Guida per l'installatore (6 lingue) | `src/components/pricing/price-guide.tsx`, messaggi `priceGuide`, `pricingTab`, `priceZone` |

## Come si calcola un prezzo

1. Prezzo "completo" €/m² del profilo nella zona = valore centrale della fascia (vetro doppio, ferramenta standard, posa base inclusi).
2. × moltiplicatore finitura (colorato/pellicolato ×1,2, bianco ×1) × moltiplicatori di telaio/anta × m² della finestra.
3. + vetro triplo (+60 €/m²) e opzioni extra.
4. **Margine**: `prezzo × (10000 + punti base) / 10000`, arrotondato al centesimo (mezzo verso l'alto). I punti base sono la percentuale × 100, quindi i decimali (es. 12,5%) non producono errori di virgola mobile. Massimo 300%, al più due decimali.

Il margine è un **ricarico** sul listino. La scheda mostra anche il **margine sul prezzo di vendita** (ricarico ÷ (100 + ricarico)): 20% di ricarico = 16,67% di margine sul prezzo.

## Regole di sicurezza dei dati

* I prezzi che l'installatore ha già modificato **non vengono mai sovrascritti**: "Usa listino standard" ritocca solo le righe ancora uguali ai valori iniziali del seme.
* I vecchi profili PVC vengono **disattivati**, non eliminati.
* Un nuovo configuratore di un installatore italiano con zona parte già in modalità standard; quelli esistenti restano come sono finché non si passa al listino (pulsante nella scheda oppure comando sotto).
* Il margine e la zona arrivano ai clienti finali solo dopo **Pubblica**.

## Comandi (una tantum, dopo il deploy)

```
npx convex deploy
npx convex run --prod pricing:applyStandardEverywhere
```

Il secondo comando passa al listino standard i configuratori italiani che non hanno ancora scelto una modalità e il cui titolare ha già indicato la zona. Gli altri restano invariati.

## Cose da sapere

* I prezzi del catalogo sono il **valore centrale** di ogni fascia del documento: è una scelta di progetto, modificabile in `standard-pricing.ts`.
* Il testo delle fonti del documento originale non è riprodotto parola per parola: la guida spiega il metodo in termini generali (prezzi di mercato italiano 2024–2026, tabella comparativa, validata da CORE829).
