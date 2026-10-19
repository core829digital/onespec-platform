# Strategia Nord · serie "Il metodo Milano"

Decisioni, verifica dei claim e raccomandazioni: `.claude/skills/ugc-script-writer/reference/campaign-memory.md`, sezione "Strategia Nord".
Testo originale di Meta AI: `.claude/skills/ugc-script-writer/reference/strategia-nord-meta-ai.md`.

## Video pronti (`video/`, 1080×1920, 60 fps, H.264 + AAC)
| File | Durata | Quando | Copertina |
|---|---|---|---|
| `onespec-nord-v1-errore-2300.mp4` | 30 s | lunedì 20:30 | `onespec-nord-v1-copertina.jpg` |
| `onespec-nord-v2-silenzio.mp4` | 24 s | mercoledì 19:30 | `onespec-nord-v2-copertina.jpg` |
| `onespec-nord-v3-chiuso-in-cucina.mp4` | 39 s | venerdì 20:00 | `onespec-nord-v3-copertina.jpg` |
| `onespec-nord-v1-corto-15s.mp4` | 15 s | Reels / Stories (anche come annuncio) | quella del V1 |

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

## Rigenerare (sorgenti in `src/`)
Requisiti: Chromium (`/opt/pw-browsers/chromium`), ffmpeg, Python con `kokoro-onnx` (voci `im_nicola`, `if_sara`) e `sherpa-onnx` (controllo Whisper).
```
cd src/v1 && python3 ../tts.py        # voce + tempi parola per parola (timing.json)
cd .. && ./build.sh v1                # pagina animata v1/ep.html
cd v1 && python3 audio.py 30.23       # musica + effetti + voce (mix.wav)
../render.sh v1 1814 out.mp4          # 4 segmenti in parallelo, mux
python3 ../asr.py vo                  # controllo pronuncia
```
