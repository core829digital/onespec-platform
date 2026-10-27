# Render 3D (v2)

Il render 3D mostra la finestra configurata a schermo intero, dentro una cucina realistica con un paesaggio fuori. Si apre da:

| Dove | Come |
| --- | --- |
| Pagina **Render 3D** (`/app/render-3d`) | si apre subito a schermo intero; "Indietro" torna alla pagina precedente |
| Widget pubblico (e widget incorporato nei siti dei clienti) | pulsante "Render 3D a casa tua" sotto il disegno tecnico |
| Configuratore guidato (wizard) | pulsante nel riepilogo (ultimo passo) |
| Preventivo B2B e Showroom | pulsante "Render 3D" sopra i disegni del pezzo (`PiecesEditor`) |

Il carico è pigro: la libreria three.js (~614 kB) si scarica solo quando si apre il 3D.

## Architettura

- `src/lib/render3d/model.ts` — tipi e regole pure (nessun three): profilo, vetro, accessori, ordine di posa (`FITTING_ORDER`).
- `src/lib/render3d/window-3d.ts` — costruisce finestra + ante con pose (chiusa / aperta / ribalta). Il vasistas passa sempre da "chiusa" prima di cambiare posa (`resolveLeaf`).
- `src/lib/render3d/accessories-3d.ts` — zanzariera (battente, a rullo, plissettata, scorrevole, fissa), cassonetto con ispezione, avvolgibile tra due guide con cinghia, raffstore, persiana a lamelle, griglia di ventilazione. Ogni accessorio ha uno stato animato (`AccessoryState`).
- `src/lib/render3d/room-3d.ts` — cucina e paesaggio (alberi istanziati, colline, cielo, sole con ombre statiche).
- `src/components/render3d/` — `Render3DViewer` (canvas, rendering a richiesta, qualità adattiva, recupero perdita contesto), `Render3DStudio` (livello a schermo intero, menu flottante, barra superiore), `studio-fields` (campi generici: campioni colore, select, chip, toggle, stepper, numero), `PhotoFlow` (misura da foto).
- Adattatori verso i configuratori:
  - `widget-render3d-studio.tsx` — widget e pagina Render 3D (stato `ConfigState`).
  - `item-render3d.tsx` — preventivo B2B / Showroom: il pezzo (`ProjectItem`) è mostrato come configurazione del widget e ogni modifica torna sul pezzo (`itemToState` / `applyStateToItem`). Barre, composizioni, posa e smaltimento non toccati dal 3D restano intatti.
  - `wizard-render3d.tsx` — anteprima del wizard (colore e vetro).

## Ordine di posa (dal muro verso l'esterno)

1. finestra nel muro (profilo, controtelaio non visibile a posa finita)
2. zanzariera (lato stanza)
3. avvolgibile: tra due guide laterali, dal cassonetto, con cinghia di manovra
4. persiana a lamelle: per ultima, sul filo esterno

Avvolgibile e persiana sono normalmente alternativi, ma il modello li disegna entrambi se il catalogo li offre.

## Schermo intero

- API Fullscreen nativa (con prefisso webkit), sempre accompagnata da un livello `position: fixed` (pseudo-schermo-intero) per i browser senza supporto (iPhone Safari non ha schermo intero per gli elementi).
- Nei widget incorporati `embed.js` imposta `allow="fullscreen"` e, alla richiesta `onespec:fullscreen` del widget, espande l'iframe sul viewport del sito ospitante e lo ripristina alla chiusura. Il messaggio è accettato solo dal frame creato dal loader, dall'origine della piattaforma e per il proprio `publicId`. `tests/embed-integrity.test.ts` fissa lo SHA-256 del file: ogni modifica a `public/embed.js` va rivista riga per riga e il pin aggiornato.

## Compatibilità e prestazioni

- Richiede WebGL2; senza, il livello mostra un messaggio chiaro (e il resto del configuratore continua a funzionare).
- Livelli di qualità (basso / medio / alto) scelti da GPU, core, memoria e tocco; pixel ratio massimo 1 / 1,5 / 2; ombre statiche; rendering solo quando serve; se i fotogrammi scendono sotto soglia la qualità scende da sola.
- Controlli a dito (orbita, pizzico, tocco su anta o accessorio) e tastiera (Esc chiude pannello, poi 3D; Tab resta nel livello).
- `prefers-reduced-motion` rispettato.

## Verifiche fatte

- Unit test: `tests/render3d-*.test.ts` (modello, accessori, ordine di posa, vasistas, mappature widget / pezzo / wizard).
- E2E: `e2e/app-flows.mjs` (menu, accessori, misura, foto, indietro) e `e2e/widget-iframe.mjs` (schermo intero attraverso `embed.js`, in un iframe di altra origine).
- Verifica visiva in Chromium (desktop e telefono, GPU software).

## Limiti noti

- Collaudato solo in Chromium. Safari (iOS/macOS) e Firefox: da provare su dispositivi reali prima di dichiarare la piena compatibilità.
- La misura da foto è una **pre-misura**: non sostituisce il rilievo in cantiere.
- Gli accessori compaiono solo dove il catalogo ha le righe corrispondenti (zanzariere, cassonetti, avvolgibili, persiane).
- Il wizard non ha catalogo: offre solo colore e vetro.
