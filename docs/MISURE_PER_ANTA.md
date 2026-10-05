# Misure per anta (leaf widths)

In tutti e tre i configuratori — preventivo B2B, Showroom (stesso editor dei pezzi) e widget pubblico — la larghezza di **ogni singola anta**
si vede sotto il disegno SVG e si modifica cliccando (o toccando, o con Invio da tastiera) sulla sua misura.

## Come funziona
- Regole in un solo file: `src/shared/leaf-widths.ts`.
  - `leafWidthsMm`: millimetri interi che sommano **esattamente** alla larghezza del telaio (1000 mm in 3 ante = 334 + 333 + 333).
  - `setLeafWidth`: l'anta digitata prende il valore esatto; le altre si dividono il resto **in proporzione** alla loro larghezza attuale,
    nessuna sotto il proprio minimo (un'anta che scenderebbe sotto resta al minimo e il resto si ridistribuisce).
  - Un valore che nessuna disposizione può contenere viene **rifiutato** con l'intervallo ammesso (mai corretto di nascosto).
  - Se il telaio è troppo stretto per i minimi strutturali di tutte le ante (il disegno le segna già in rosso) si usa un pavimento sensato
    (mezza quota uguale) così le proporzioni si possono comunque correggere.
- Minimi per anta: quelli strutturali della piattaforma (`SASH_MIN`) nei due editor; quelli del widget (`MIN_SASH_WIDTH`) nel widget.
- Una sola anta = il telaio: la sua misura si cambia sulla quota generale (nessuna quota per anta, nessun intervallo "da 1200 a 1200").
- Anta sotto il minimo: la quota diventa rossa.
- Vale in vista interna ed esterna (le quote seguono lo specchio); Esc annulla, Invio o clic fuori confermano un valore valido.

## Dove vive il dato
Ogni anta salva la propria quota come `widthRatio` (parte del telaio). Il server normalizza sempre le quote perché sommino 1
(una scheda vecchia o una richiesta fatta a mano non può inventare un telaio più largo o stretto di sé stesso; il preventivo non viene mai rifiutato).
Il PDF e gli export usano gli stessi millimetri interi del disegno.
Nel widget, cambiando il numero di ante le quote vengono ricalcolate in modo che sommino di nuovo 1.
