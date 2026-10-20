# Strategia Nord · serie "Il metodo Milano"

Decisioni, verifica dei claim e raccomandazioni: `.claude/skills/ugc-script-writer/reference/campaign-memory.md`, sezione "Strategia Nord".
Testo originale di Meta AI: `.claude/skills/ugc-script-writer/reference/strategia-nord-meta-ai.md`.

## Video pronti (`video/`, 1080×1920, 60 fps, H.264 + AAC)
| File | Durata | Quando | Copertina |
|---|---|---|---|
| `onespec-nord-v1-errore-2300.mp4` | 29 s | pubblicato lun 19 ott 21:30 (voce registrata da Stefan) | `onespec-nord-v1-copertina.jpg` |
| `onespec-ep1-preventivi-a-vuoto.mp4` | 43 s | mar 20 ott 20:30 (Serie 1, voci Microsoft Diego + Isabella) | — |
| `onespec-pillola-preventivo-a-vuoto.mp4` | 20 s | mar 20 ott ~14:00 (voce Microsoft Diego) | — |
| `onespec-nord-v2-silenzio.mp4` | 28 s | mer 21 ott 19:30 (voce Diego) | `onespec-nord-v2-copertina.jpg` |
| `onespec-ep2-una-riga-di-codice.mp4` | 31 s | gio 22 ott 12:45 (Serie 1, voce Diego) | — |
| `onespec-nord-v3-chiuso-in-cucina.mp4` | 40 s | ven 23 ott 20:00 (Isabella = cliente, Diego = serramentista) | `onespec-nord-v3-copertina.jpg` |
| `onespec-nord-v1-corto-15s.mp4` | 15 s | **voce vecchia (Kokoro): non usare** | quella del V1 |

Sottotitoli già impressi nel video: non attivare i sottotitoli automatici della piattaforma (si sovrapporrebbero).

## Pubblicazione
- Link: in BIO (pagina link del configuratore), mai nella descrizione.
- Primo commento fissato: `👇 Configura la tua finestra in 60 secondi: link in bio`
- Ogni cifra e scenario porta l'etichetta "Esempio" / "Scena di esempio": non toglierla.

### Didascalie
**V1** · L'errore da 2.300 € 😬 Bicolore RAL 7016 fuori / bianco dentro, ordinato tutto bianco perché il preventivo era in Excel. Con un configuratore il bicolore finisce da solo in disegno, prezzo e PDF. Voi fate ancora i preventivi in Excel? Ditemelo nei commenti 👇 (cifre di esempio)
#serramenti #infissi #bicolore #ral7016 #preventivoinfissi #serramentista #infissimilano #serramentibergamo #verona #torino

**V2** · Quanto costa il silenzio in città? Non te lo dico io: misure, vetro e colore li scegli tu e il prezzo stimato con IVA appare subito. Link in bio 👇
#finestre #triplovetro #infissi #serramenti #milano #casa #ristrutturazione #isolamentoacustico

**V3** · «Le mando il preventivo domani»? No: prezzo chiavi in mano, costo dopo Bonus Casa e rata indicativa, sul tablet, davanti al cliente. Scena di esempio. Link in bio 👇
#serramentista #bonuscasa #detrazione #preventivo #showroom #infissi #serramenti #bologna #milano

## Voce (regola fissa, approvata da Stefan il 2026-10-20)
Voci neurali Microsoft gratuite via `edge-tts` (`src/tts_edge.py`): **it-IT-DiegoNeural** per l'uomo (serramentista, narratore),
**it-IT-IsabellaNeural** per la donna. Non usare Kokoro, Piper o Coqui (rifiutate: accento, stuttering, poca chiarezza).
Regia: una frase alla volta (le domande salgono, le affermazioni scendono), pause dirette (dopo "?" più lunga che dopo "."),
velocità per battuta in `lines.json` (`rate`), tono da consulente, mai da televendita. La voce non pronuncia "OneSpec" (lo legge male):
il marchio sta a schermo. Serve il dominio `speech.platform.bing.com` tra gli Allowed domains dell'ambiente.
```
cd src/pillola && python3 ../tts_edge.py   # vo/lNN.wav + timing.json esatti (word boundary del motore)
cd .. && ./build.sh pillola && cd pillola && python3 audio.py <durata> && ../render.sh pillola <frame> out.mp4
python3 ../asr.py vo                        # controllo Whisper, frase per frase
```
Ridoppiare un video già animato con tempi fissi (EP1): `src/ep1/warp.py` mappa la nuova voce sui tempi vecchi parola per parola
(`timing_old.json` → `timing_new.json`), poi `cat head.part cube.part timing.js scenes.part tail.part > ep.html`.

## Rigenerare (sorgenti in `src/`, pipeline storica)
Requisiti: Chromium (`/opt/pw-browsers/chromium`), ffmpeg, Python con `kokoro-onnx` (voci `im_nicola`, `if_sara`) e `sherpa-onnx` (controllo Whisper).
```
cd src/v1 && python3 ../tts.py        # voce + tempi parola per parola (timing.json)
cd .. && ./build.sh v1                # pagina animata v1/ep.html
cd v1 && python3 audio.py 30.23       # musica + effetti + voce (mix.wav)
../render.sh v1 1814 out.mp4          # 4 segmenti in parallelo, mux
python3 ../asr.py vo                  # controllo pronuncia
```
