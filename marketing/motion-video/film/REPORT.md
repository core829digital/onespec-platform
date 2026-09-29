# onespec — presentazione cinematica (60 s, 16:9, dark)

**Output:** `onespec-film.mp4` — 60 s (3.600 fotogrammi), 1920 × 1080, H.264 High 60 fps, yuv420p,
AAC 48 kHz stereo 256 kb/s, **39 MB (≈5,4 Mb/s)**. Contact sheet: `contact-sheet.png`
(un fotogramma ogni 0,5 s, estratto dal file finale).

Pipeline: 4 sottofotogrammi per frame centrati sul tempo del frame → `tmix=frames=4` (motion blur),
grana cinematografica aggiunta da ffmpeg dopo il blur, master a crf 12. Con la grana il master a crf 12
pesava 832 MB (110 Mb/s), inutilizzabile per condivisione: la consegna è ricodificata a **crf 18**
(visivamente indistinguibile). Render: 0 errori di console, ~22 minuti su 3 processi paralleli.

## Storyboard (120 BPM, 30 battute)
| t (s) | Scena | Cosa si vede | Fonte |
|---|---|---|---|
| 0 – 6 | Logo | Logo ufficiale (`public/onespec-logo.png`) rivelato con wipe + tagline | `meta.title` |
| 6 – 12.5 | Manifesto | "Preventivi automatici, prezzi sempre aggiornati, brandizzabile per la tua azienda." + intro | `meta.description`, `onboarding.welcome.intro` |
| 12.5 – 23 | Configuratore | Widget reale in tema scuro in una finestra browser: Legno → Porta balcone → selezione anta → trascinamento divisore con avviso rosso anta sotto misura minima → ritorno → scroll al preventivo → "Completa e richiedi preventivo" → modulo sopralluogo | `src/components/widget/*` |
| 23.5 – 28.5 | Panoramica | Dashboard reale: KPI e richieste recenti | `app/dashboard` |
| 29 – 33 | Statistiche | Clic reale sul menu "Statistiche": imbuto, andamento, per configuratore | `app/analytics` |
| 33.5 – 38 | Trattative | Clic su "Trattative", la card "Luca Colombo" viene trascinata da "Preventivo inviato" a "Vinte" | `app/pipeline` |
| 38.5 – 47 | Preventivatore B2B | Clic su "Preventivi (B2B)", poi le 6 schede mercato IT → FR → BE → NL → DE → LU; per ogni mercato una scheda con IVA, norma di posa e incentivi | `app/quotes/new`, `convex/lib/regions.ts`, `convex/lib/compliance.ts` |
| 47 – 54 | Moduli | Showroom, Rilievo Cantiere, Posa Qualificata, Verbale di Collaudo, Fascicolo QR, Logistica + 6 mercati / 6 lingue | titoli e sottotitoli delle pagine, icone lucide del menu |
| 54 – 60 | Chiusura | Logo, tagline, ONESPEC.EU, dissolvenza al nero | `metadataBase` |

## Cosa è reale e cosa è dimostrativo (onestà)
- **Reale:** tutte le interfacce (componenti React del repository renderizzati davvero, tema scuro di
  default), logo, colori (`globals.css`), font (Fraunces, Inter, Space Grotesk, IBM Plex Mono), tutti i
  testi (da `messages/it.json` e dalle pagine), IVA/norme/incentivi dei 6 mercati, lingue disponibili.
- **Dimostrativo:** il backend Convex e il sito live non sono raggiungibili da questo ambiente, quindi le
  pagine interne sono state montate con un client Convex simulato (`harness/`, file di riferimento, non
  compilati). Nomi dei clienti, conteggi e importi della dashboard / trattative sono **dati demo**;
  gli importi sono calcolati dal motore prezzi reale del widget sul listino dimostrativo. Il dominio
  "www.serramentidemo.it" e l'azienda "Serramenti Demo" sono fittizi.
- **Nascosto di proposito:** voci "Piano" e "Fatturazione", badge del piano in alto e riepilogo del piano
  nella dashboard → nessun riferimento agli abbonamenti. La pagina di login non è usata perché contiene
  un prezzo decorativo ("1.240 €").

## Audio
Colonna sonora **originale**, sintetizzata in numpy (`tools/film_sound.py`): pad, basso, cassa morbida,
hi-hat, arpeggi a 120 BPM, crescendo nei cambi di scena, impatto sul logo finale; click UI sincronizzati
con `window.SOUNDS`. Master: **−14,0 LUFS integrati, true peak −2,4 dBTP, LRA 7,6** (limiter + loudnorm
lineare a due passaggi). Sostituibile con un brano a 120 BPM: il montaggio è già sulla griglia.

## Ricostruzione
```
cd marketing/motion-video && npm i
cd film && python3 -m http.server 8765 --bind 127.0.0.1 &
node tools/render_film.mjs          # film-silent.mp4 (3 processi in parallelo)
python3 tools/film_sound.py         # score + click + master + mux → onespec-film.mp4
```
Le catture in `shots/` si rigenerano con `harness/capture_film.mjs.txt` dopo aver ricreato le route
temporanee descritte nei file `harness/*.txt` (non vanno committate in `src/app`).
