# Prezzi: un solo calcolo per widget, showroom e preventivo B2B

**Regola:** lo stesso pezzo, con lo stesso catalogo, costa lo stesso in tutti e tre i configuratori.

| Configuratore | Da dove arriva il prezzo |
|---|---|
| Widget (embed) | `calculatePrice` sul catalogo pubblicato (prima aveva una tabella parallela in euro con arrotondamenti diversi). IVA in centesimi interi come il server. |
| Showroom | `computeCalculationPreview` → `calculatePrice` |
| Preventivo B2B | `calculatePrice` + extra del preventivo (`src/shared/quote-totals.ts`), identico sul server |

**Extra del solo preventivo B2B** (posa a corpo, smaltimento, sconto, extra regionali NL/BE/DE/LU) partono da **zero**: prima erano preimpostati (posa 250 €, smaltimento 50 €, RAL/RC2, giunti HVL…), per cui lo stesso pezzo costava 300 € in più nel B2B che nello showroom. Ora l'installatore li aggiunge di proposito.

**Test di parità:** `tests/convex/price-parity.test.ts` (widget = showroom = B2B al centesimo; extra B2B = stessa funzione client e server).

**Differenze volute** (non sono incoerenze): IVA scelta dal visitatore nel widget, ripartizione IVA 10/22 % mostrata nello showroom italiano, sconto e bonus fiscali.
