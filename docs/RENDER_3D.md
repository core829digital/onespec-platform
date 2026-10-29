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

Dalla v1.31 la zanzariera sta **fuori** dalla finestra (subito dopo il filo esterno, `netSpaceMm` 44/66 mm), poi le guide dell'avvolgibile e infine la persiana: l'ordine è lo stesso in tutte le stanze e nella foto. Box, zanzariera e persiana nella stessa finitura usano gli **stessi materiali** (stessa texture e venatura) del telaio.

Avvolgibile e persiana sono normalmente alternativi, ma il modello li disegna entrambi se il catalogo li offre.

## Angoli saldati a 45°

Telaio e ante sono costruiti con montanti **tagliati a 45°** (trapezi estrusi, `mitreMember` / `frameCorners` in `geo.ts`), con UV coerenti con i montanti dritti: la venatura cambia direzione sulla saldatura come nei profili veri. Anche il disegno SVG (telaio e ante) traccia le diagonali (`mitreLines`).

## Maniglie

Nell'abbinamento anta-ribalta + battente la maniglia è solo sull'anta principale (`inactiveLeaves` / `jointsFor`); il battente si apre ma non ha maniglia.

## Scenari

Cucina, **soggiorno** (porte balcone), **camera matrimoniale** (porte balcone) e **bagno** (finestra piccola): scheda "Ambiente" nel menu, scelta automatica per tipo di serramento (`defaultSceneFor`). Arredi in `room-scenes.ts`, fusi per materiale (poche draw call).

## Foto: angoli automatici

Dopo lo scatto i quattro punti partono dal contorno trovato nella foto (`detect-quad.ts`: Sobel, voti di Hough su linee quasi verticali/orizzontali, scelta della combinazione sinistra/destra/alto/basso più forte e più coerente con le misure inserite). Se non trova nulla di convincente usa la cornice standard. I punti restano sempre trascinabili: è un aiuto, non una misura.

## Prestazioni

Risoluzione dinamica (scende in movimento, risale a riposo), niente antialiasing nativo sui dispositivi touch, ombra statica aggiornata a riposo, compilazione asincrona degli shader, nessuno sfocato (`backdrop-filter`) sopra il canvas, recupero della perdita di contesto (ricrea il canvas al livello più basso) e precaricamento del blocco 3D al passaggio sul pulsante.

## Fasce di qualità e modalità leggera

Quattro fasce: **lite → low → mid → high**. La fascia di partenza dipende da GPU (nome letto dal contesto reale: Mali-4xx/T-series, Adreno 2xx/3xx, PowerVR, Vivante, rendering software), memoria, core e limite texture. Durante l'uso, se i fotogrammi restano lenti, il 3D scende di un gradino alla volta (risoluzione in movimento → niente ombre → fascia più bassa) fino a **lite**, ricostruendo la scena una sola volta.

**Lite** = nessuna mappa di riflessi (risparmia avvio e memoria; luci più forti e metalli opachi per non scurire), nessuna texture sulla stanza, nessuna ombra, giardino ridotto (10 alberi, niente cespugli né nuvole), risoluzione a riposo 0,85. Finestra, ante, accessori e scenari restano identici.

Il cliente può attivarla da solo con il pulsante ⚡ in alto ("Modalità leggera"); la scelta è ricordata sul dispositivo (localStorage).

## Navigazione con le frecce

Oltre al trascinamento, in basso a destra c'è un pad: quattro frecce per **ruotare** la vista (o **spostarla** di lato/su-giù con il tasto centrale), più **+ / −** per avvicinare e allontanare. Tenendo premuto il movimento è continuo e fluido; funzionano anche le frecce della tastiera e i tasti + / −. Il movimento è limitato alla stanza (non si attraversa il muro). Codice: `NavPad.tsx` e `navigate()` del viewer. Su telefono il pad si nasconde mentre è aperto un pannello.

## Schermo intero

- API Fullscreen nativa (con prefisso webkit), sempre accompagnata da un livello `position: fixed` (pseudo-schermo-intero) per i browser senza supporto (iPhone Safari non ha schermo intero per gli elementi).
- Nei widget incorporati `embed.js` imposta `allow="fullscreen"` e, alla richiesta `onespec:fullscreen` del widget, espande l'iframe sul viewport del sito ospitante e lo ripristina alla chiusura. Il messaggio è accettato solo dal frame creato dal loader, dall'origine della piattaforma e per il proprio `publicId`. `tests/embed-integrity.test.ts` fissa lo SHA-256 del file: ogni modifica a `public/embed.js` va rivista riga per riga e il pin aggiornato.

## Compatibilità e prestazioni

- Richiede WebGL2. Il dispositivo **non viene più "sondato"** con contesti WebGL di prova (su molti Android, tablet compresi, quei contesti usa-e-getta facevano rifiutare quello vero e comparivano falsi errori "serve WebGL 2"). Il 3D chiede il contesto da sé, con tre richieste dalla migliore alla più semplice (senza antialiasing, senza preferenza di potenza, mai "failIfMajorPerformanceCaveat"), e se la GPU rifiuta riprova due volte su un canvas nuovo (700 ms, 1400 ms). GPU e limite texture si leggono dal contesto reale (`refineCaps`). Solo se tutto fallisce compare il messaggio, ora con consigli concreti (accelerazione hardware, Chrome e Android System WebView aggiornati, risparmio energetico) e il pulsante "Riprova". Il resto del configuratore continua a funzionare.
- Livelli di qualità (basso / medio / alto) scelti da GPU, core, memoria e tocco; pixel ratio massimo 1 / 1,5 / 2; ombre statiche; rendering solo quando serve; se i fotogrammi scendono sotto soglia la qualità scende da sola.
- Controlli a dito (orbita, pizzico, tocco su anta o accessorio) e tastiera (Esc chiude pannello, poi 3D; Tab resta nel livello).
- `prefers-reduced-motion` rispettato.

## Verifiche fatte

- Unit test: `tests/render3d-*.test.ts` (modello, accessori, ordine di posa, vasistas, mappature widget / pezzo / wizard).
- E2E: `e2e/app-flows.mjs` (menu, accessori, misura, foto, indietro) e `e2e/widget-iframe.mjs` (schermo intero attraverso `embed.js`, in un iframe di altra origine).
- Verifica visiva in Chromium (desktop e telefono, GPU software).
- Le prestazioni su tablet reali (60 fps) **non** sono misurabili in questo ambiente (solo GPU software): vanno confermate su dispositivo.

## Limiti noti

- Collaudato solo in Chromium. Safari (iOS/macOS) e Firefox: da provare su dispositivi reali prima di dichiarare la piena compatibilità.
- Il rilevamento degli angoli funziona bene con contorni netti e luce uniforme; con riflessi, tende o contorni sfumati ripiega sulla cornice standard.
- La misura da foto è una **pre-misura**: non sostituisce il rilievo in cantiere.
- Gli accessori compaiono solo dove il catalogo ha le righe corrispondenti (zanzariere, cassonetti, avvolgibili, persiane).
- Il wizard non ha catalogo: offre solo colore e vetro.
