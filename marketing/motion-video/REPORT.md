# Report — onespec UI motion video

**Output:** `motion-video.mp4` — 14 s seamless loop, 1440 × 1440, H.264 High 60 fps, crf 12,
yuv420p, AAC 48 kHz stereo (2.9 MB). Contact sheet: `contact-sheet.png`.

## States used (10 components, one shape, no cuts)
1. Material tabs (PVC → **Legno**, liquid indicator)
2. Tipo di prodotto (Finestra → **Porta balcone**, liquid indicator + "Soglia in alluminio da 18mm inclusa")
3. Disegno tecnico — door 1300 × 2100 mm, real SpecDrawing rules
4. Leaf 2 selection — dashed outline + handle marker at 1050 (height / 2)
5. Divider drag → **red "!" minimum-width warning** (fixed leaf 247 mm < 300 mm), drag back to 546 mm
6. Leaf editor "Anta 2" — handle-height slider dragged 1050 → 1200 mm (range 300–1950, step 10)
7. VAT select (IT policy): IVA ordinaria 22% → **Ristrutturazione 10%**, with Superficie 2,73 m², Perimetro telaio 6,80 m, ECOBONUS 50%
8. Estimate card — "TOTALE STIMATO IVA INCLUSA", disclaimer, UNI 11673-1:2017
9. CTA "→ Completa e richiedi preventivo" (+ outline "Aggiungi un'altra finestra / porta balcone")
10. "Richiedi un sopralluogo" → shape returns to the PVC tab (frame 839 = frame 0)

Beat-by-beat plan: `states.md`. Component specs: `INVENTORY.md`. Copy: `copy.json`.

## Song
**None supplied** → step 4 skipped, no BPM measured. The video is still cut to a 120 BPM grid
(beat = 0.5 s, 28 beats), so any 120 BPM track will lock to it.

## Probe numbers (`probe-report.json`, 240 Hz subframes)
| Check | Result |
|---|---|
| Console errors | **0** (fonts self-hosted; all fonts loaded) |
| Loop seam (last → first frame) | **3.99** vs normal frame step **5.28** → smaller than a normal step ✔ |
| Cursor ↔ divider gap while dragging | max **0.47 world px** (≈1.2 screen px) ✔ |
| Cursor ↔ slider thumb gap | max **0.00003 px** ✔ |
| Text height in frame | every readable layer ≥ **30 px** at every beat ✔ |
| Clipping (24 px safe margin) | none ✔ |
| Shape outside the frame | worst **19 px** for ~30 ms during the column change at 9.56 s |
| Acceleration jumps | cursor & camera: none (4th-order steps). Shape: only at the exact start of each spring step (inherent to a closed-form step response), none mid-motion ✔ |

## Loudness (`loudness.json`)
27 sound events (6 clicks, 3 press/release pairs, 15 slider ticks), placed by measured peak, wrapped
across the loop point. **Integrated −23.5 LUFS, true peak −1.5 dBTP.**
The −14 LUFS target was **not** applied on purpose: without music, a click-only track at −14 LUFS
would break the −1.5 dBTP ceiling (loudnorm would fall back to compression and make every click
harsh). The script applies the largest clean linear gain (+10.3 dB, limited by true peak). With a
song, the same script masters the mix to −14 LUFS / −1.5 dBTP as specified.

## Left out, and why
- **All € amounts and the Uw 1,16 W/m²K** — the capture has no installer catalogue, so these come
  from the widget's fallback demo price table. Not real data → not shown. The estimate card shows
  only its real label and disclaimer.
- **Live website capture** — `onespec.eu`, `cloud.onespec.eu` and Convex are blocked by this
  environment's network policy. The real React widget was rendered locally from this repository
  (temporary route, removed afterwards) with the real IT region policy.
- **Wood-colour frame** — with *Bianco standard* finish the real drawing is white (`#c9d3d8` stroke)
  even for Legno, so the video keeps it white rather than inventing a wood frame.
- **Native select popup** — the OS draws it; the open list uses the select's own styling.

## Rebuild
```
cd marketing/motion-video && npm i
node tools/check.mjs          # contact sheet + probes
node tools/render.mjs         # video-silent.mp4
node tools/dump_sounds.mjs && python3 tools/sound.py   # clicks + master + mux → motion-video.mp4
```
Requires ffmpeg (with libx264, tmix, loudnorm) and Python 3 with numpy, scipy.
