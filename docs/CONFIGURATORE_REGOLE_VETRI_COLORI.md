# Configuratore: regole delle ante, pacchetti vetro, libreria colori e disegni tecnici

Documento operativo CORE829. Vale per piattaforma (preventivatore, showroom), widget e demo del sito (che incorpora le stesse pagine `/demo/*`).

## 1. Regole tecniche delle ante (`src/shared/sash-rules.ts`)

| Combinazione | Regola |
|---|---|
| Scorrevole + battente / anta-ribalta / vasistas | Mai combinabili (l'editor porta le altre ante alla stessa famiglia) |
| Scorrevole + scorrevole, scorrevole + fisso | Ammesse. Scorrevole con fisso sulla serie Aluplast diventa alzante scorrevole o traslante scorrevole (nota mostrata) |
| Anta-ribalta + anta-ribalta | **Montante fisso sul telaio**; entrambe le ante hanno la maniglia |
| Battente o anta-ribalta + fisso, vasistas accanto a ogni anta mobile | **Montante fisso sul telaio** |
| Anta-ribalta + battente (in qualunque ordine) | La maniglia sta sull'**anta attiva** (l'anta-ribalta, in automatico); l'anta battente è **inattiva**, senza maniglia, con **montante mobile** |
| Due battenti | Resta la maniglia sull'anta principale; l'altra è inattiva con montante mobile |

Funzioni: `jointBetween`, `jointsFor`, `inactiveLeaves`, `leafRule`, `frameRules`. I dati salvati non cambiano (i montanti sono derivati dal tipo di anta). `electMain` fa seguire il flag "principale" all'anta-ribalta.

## 2. Pacchetti vetro (`src/shared/glazing-packages.ts`)

Si sceglie prima la **profondità** (doppio 24/26/28 mm, triplo 32/36/40/44/50/52 mm), poi la **composizione**. Ogni combinazione è una riga di catalogo (`catalogGlazingOptions`) con chiave `d24_floatBeArgon`, `t52_floatFloat331Be`, ecc.

Doppio: Float + BE + canalina calda + argon / senza argon, Float + 3.3.1 + BE (consigliato fino a 1700 mm), Stratificato 3.3.1 + 3.3.1 + BE (porte finestre, portoncini, 1700–2700 mm), Satinato + 3.3.1 + BE, pannello colore infisso/RAL, pannello ornamentale (portoncini).
Triplo: Float + Float + 3.3.1 BE, Float + Satinato + 3.3.1 BE (4 stagioni), 3.3.1 BE + Float + 3.3.1 BE, pannello colore, pannello ornamentale.

Le raccomandazioni non bloccano mai: compaiono come avviso sotto la scelta. **I prezzi dei pacchetti sono valori provvisori**: ogni cliente li modifica dal proprio catalogo (non vengono mai sovrascritti dal seed). I vecchi codici (`double`, `triple`, …) restano per i preventivi già salvati e per il wizard semplice.

## 3. Libreria colori e decori (`src/shared/finish-library.ts`)

198 voci: 79 decori pellicolati (texture), 117 colori RAL verniciati (con codice), 2 effetti pietra (texture). Dati in `src/shared/finish-library.data.json`, texture in `public/finishes/*.jpg`. Nomi neutri, nessun fornitore. Il riferimento di produzione (`ref`) è nel dato ma non è mostrato al cliente.

Note sui dati: il campione RAL 7035 nel documento di origine era stampato come 7034 (olivastro): è stato sostituito con un grigio chiaro; i neri puri (RAL 9004/9005/9011/9017/8019/8022) sono stati sostituiti con neri realistici, perché il nero CMYK del documento è piatto; "White Deceuninck" → "Bianco profilo". I colori sono indicativi, come dichiara lo stesso documento d'origine; garanzia colore 10 anni (5 anni per i colori contrassegnati).

Campo dati Convex: `catalogFinishOptions` con `range`, `group`, `texture`, `textureW/H`, `ref`, `warrantyYears` (tutti opzionali: le finiture base restano com'erano).

## 4. Da eseguire dopo il deploy su Convex (una volta)

```
npx convex run migrations:seedGlazingPackagesPage
npx convex run migrations:seedFinishLibraryPage
```
Ripetere ciascun comando con `'{"cursor":"<cursor restituito>"}'` finché `done` è `true`. Sono idempotenti: inseriscono solo le chiavi mancanti e non toccano prezzi o etichette modificati. I nuovi configuratori ricevono tutto alla creazione. Dopo, ripubblicare i configuratori che si vogliono aggiornare.

## 5. Disegni

Il disegno (editor, PDF, export) usa la texture sul telaio (nel PDF e negli SVG autonomi: colore medio), un vetro in sfumature di blu con riflessi, la maniglia nel colore scelto dall'utente. Schede: prospetto (vista interna/esterna), pianta, sezione, ferramenta; nodo di posa nel dossier di posa; tavola di rilievo nel modulo rilievi; il PDF del preventivo ha una pagina di dettaglio (pianta, sezione, ferramenta) fino a 8 pezzi.
