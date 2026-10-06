# Firme digitali

## Cosa non funzionava
- **Preventivo (pagina "Firma")**: il riquadro veniva preparato una volta sola all'apertura della pagina, ma compare solo dopo il caricamento
  dei dati. Così non veniva mai preparato: il tratto finiva fuori posizione (e spesso fuori dal disegno), invisibile, mentre la pagina segnava
  comunque "firma presente" e il server accettava qualsiasi immagine, anche vuota.
- Quattro riquadri diversi (preventivo, collaudo, consegna in cantiere, pagina del posatore) con colori fissi e controlli diversi.
- Il server controllava solo che il testo iniziasse con `data:image/`.

## Come funziona ora
- **Un solo riquadro** (`src/components/signature-pad.tsx`, motore in `src/lib/signature-canvas.ts`) usato ovunque:
  - il tratto è **bianco sul tema scuro e nero sul tema chiaro**, e cambia subito se cambi tema con il riquadro aperto;
  - si prepara da solo quando il riquadro compare (anche dentro schede, finestre o dopo il caricamento) e si adatta se ruoti il telefono o ridimensioni;
  - mouse, dito e penna passano dallo stesso percorso; un secondo dito (il palmo) non crea una seconda riga; schermi retina nitidi;
  - il pulsante "Conferma" resta spento finché non c'è una **firma vera**: un tocco o un puntino non bastano.
- **L'immagine salvata è sempre nera su bianco**, 720 px, qualunque tema: si legge uguale nel PDF, in stampa e in entrambi i temi.
- La pagina del posatore (`/i/...`) è una scheda di carta: riquadro sempre bianco con inchiostro nero.
- **Il server guarda l'immagine** (`convex/lib/png.ts`): decodifica il PNG e conta i pixel di inchiostro. Una pagina bianca, un'immagine trasparente, un tratto
  bianco su bianco o un solo puntino vengono rifiutati con "La firma è vuota o non si vede" (`SIGNATURE_EMPTY`, 6 lingue); un file che non è un PNG leggibile è `INVALID_SIGNATURE`.
  Vale per preventivo, collaudo (anche dal telefono del posatore) e consegna in cantiere.
- La firma del preventivo ora chiude l'accordo come "vinto" (cliente attivo, cantiere confermato, notifica).

## Verifiche
- `tests/signature.test.ts`, `tests/convex/signature-server.test.ts` (tutti i filtri PNG), `tests/signature-pad-render.test.ts`.
- `npm run e2e:signature`: motore reale in Chromium — colore per tema, immagine salvata, riquadro dimensionato in ritardo (il bug originale),
  retina, tocco, e la stessa immagine riletta dall'analisi del server. Gira anche in CI.
- Le firme salvate prima (inchiostro verde scuro su fondo trasparente) restano valide e leggibili nei PDF.
