# Audit telefono: «le cose vanno a destra» / zoom (10 ottobre 2026)

**Ambito:** solo questo. Nessun'altra funzione è stata toccata.

## Cosa è stato misurato
Chromium emulato come iPhone (touch, 3× DPR, user-agent Safari iOS) a **320, 360, 390 e 430 px**:
- piattaforma (host demo): 24 pagine `/app`, 10 tipi di pagina di dettaglio (richieste, rilievi, preventivi stampa/firma/modifica, configuratori, clienti, cantieri, posa, collaudi), stati aperti (foglio «Altro», menu laterale, finestre, menu a tendina, banner cookie, tooltip dei grafici al bordo destro);
- pubbliche: accesso, registrazione, password dimenticata, unisciti, legale, widget demo, showroom demo;
- sito onespec.eu: home, prodotto, prezzi, versioni, inviti, demo, legale.
Per ogni pagina: larghezza del documento > schermo, trascinamento laterale possibile, elementi oltre il bordo destro, scala di zoom, meta viewport, **dimensione del testo dei campi**.

## Cause trovate
1. **Causa principale (zoom + scivolamento a destra su iPhone).** Quasi tutti i campi di testo, le tendine e le aree di testo avevano 14 px (13,5 px nel widget). Safari su iPhone **ingrandisce l'intera pagina** quando si tocca un campo con testo < 16 px e poi lascia la pagina ingrandita e spostata a destra. Presenti su **47 pagine** della piattaforma, su accesso/registrazione, widget e showroom. Chromium non riproduce lo zoom di iOS: il difetto è stato individuato con il criterio esatto che Safari applica (16 px).
2. **Widget a 320 px** (telefoni piccoli): la colonna unica aveva `1fr` (= «almeno quanto il contenuto») e si allargava a 343 px su uno schermo da 320, con contenuto spostato di 24 px a destra. 72 elementi oltre il bordo.
3. **Tooltip dei grafici (Statistiche/Panoramica):** centrati sul punto, uscivano dallo schermo sugli ultimi punti/barre.
4. **Nessuna rete di sicurezza globale:** qualunque elemento troppo largo permetteva di trascinare la pagina di lato.

## Correzioni
- `src/app/globals.css`: testo dei campi **16 px** su schermi touch/≤1023 px; `html, body { overflow-x: clip; max-width: 100% }` (non crea contenitori di scroll, sticky/fixed funzionano); `text-size-adjust: 100%`.
- `src/components/widget/widget.css` + `widget.tsx`: stessa regola 16 px dentro widget e wizard (gli stili inline richiedono `!important`); colonne `minmax(0, 1fr)` e `min-width: 0` sui figli.
- `src/components/analytics/charts.tsx`: tooltip ancorati al bordo vicino agli estremi.
- **Il pinch-zoom resta consentito** (nessun `maximum-scale`): bloccarlo violerebbe l'accessibilità (WCAG 1.4.4); lo zoom automatico si evita con il 16 px, non vietando lo zoom.

## Verifica dopo le correzioni
`npm run e2e:phone` (in CI): 320 e 390 px × pagine pubbliche + piattaforma + dettagli + stati aperti: **0 problemi**. Misure di dettaglio prima/dopo: 47 pagine con campi < 16 px → 0; widget a 320 px: 72 elementi oltre il bordo → 0. Test statico `tests/phone-zoom-guard.test.ts` impedisce di togliere le regole.

## Limiti (onestà)
- Nessun iPhone reale in questo ambiente: lo zoom di Safari non è riproducibile in Chromium. La correzione segue la regola documentata di Safari (16 px), ma va **confermata su un iPhone vero** (accesso → tocca un campo → la pagina non deve ingrandirsi).
- Il widget incorporato in siti di terzi eredita il loro viewport: se il sito ospitante ha un meta viewport sbagliato, il widget non può rimediare.
