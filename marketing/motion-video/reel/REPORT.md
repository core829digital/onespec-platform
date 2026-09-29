# onespec — reel verticale 9:16 (90 s)

**Output:** `onespec-reel.mp4` — 1080 × 1920, 90 s, H.264 High 60 fps, AAC 48 kHz stereo 256 kb/s.
Motion blur da 4 sottofotogrammi per frame (`tmix`), grana cinematografica, dark mode, colori e logo
ufficiali onespec. Contact sheet: `contact-sheet.png` (un fotogramma al secondo, dal file finale).

Parole vietate sullo schermo (verificate): nessun "SaaS", "software", "piattaforma", "app",
"abbonamento", "configuratore", "widget", nessuna offerta commerciale. Il messaggio è il risultato per
il montatore: *i preventivi si fanno da soli sul suo sito, anche di notte*.

## Storyboard (120 BPM)
| t (s) | Scena | Contenuto |
|---|---|---|
| 0 – 4.5 | Hook | "Il cliente vuole un prezzo. **Adesso.** 23:47 — anche a quest'ora" |
| 4.5 – 39 | Dialogo + sito del montatore (telefono) | 5 obiezioni di Laura (cliente) e risposte di Marco (montatore), ognuna dimostrata dal preventivatore reale sul telefono: Legno → Porta balcone · avviso anta troppo stretta · "Stima orientativa · non è un preventivo contrattuale" · Ecobonus 50% + IVA Ristrutturazione 10% · modulo → "Richiesta inviata" → **"Invia riepilogo su WhatsApp"** |
| 39 – 53 | Showroom sul tablet | "Preventivo in 60 secondi": + Portafinestra 2 ante, finitura effetto legno, prezzo chiavi in mano e costo dopo bonus casa, "Invia su WhatsApp"; contatore 0 → 60 s |
| 53 – 71 | Notte | Illustrazione: Marco dorme, orologio 23:30 → 03:12, il telefono si illumina; "Mentre dormi, il tuo sito fa i preventivi."; schermata di blocco con 12 richieste (WhatsApp + email) |
| 71 – 84 | Mattina | Sveglia 07:00, Marco si siede, apre WhatsApp: riepilogo di Laura, risposta con il messaggio reale del prodotto, "Giovedì alle 10 va benissimo."; 4 trattative passano a **Vinte** |
| 84 – 90 | Chiusura | Logo, "I tuoi preventivi lavorano anche mentre dormi.", ONESPEC.EU |

## Fedeltà al prodotto (verificata nel codice)
- **WhatsApp di notte è reale:** dopo l'invio, il cliente vede il pulsante "Invia riepilogo su WhatsApp"
  (`widget.tsx`), che gli fa inviare il riepilogo generato dal prodotto. Il testo nei messaggi è quello
  esatto (`reel/shots/wa-summary.txt`).
- **Email reale:** a ogni richiesta parte l'email "Nuova richiesta preventivo: {nome}" con cliente e valore
  (`convex/emails/auth.ts`, `convex/widget.ts`).
- **Risposta del mattino reale:** è il messaggio WhatsApp precompilato della pagina richiesta
  (`app/requests/[id]`): "Buongiorno {nome}, la contatto da parte di {azienda}…".
- **Nota onesta:** oggi i messaggi WhatsApp arrivano perché li manda il cliente con un tocco; non esiste
  (ancora) un invio automatico da onespec al numero del montatore. Il video lo rappresenta così.

## Dati dimostrativi
Azienda "Serramenti Demo", nomi dei clienti, importi e conteggi sono demo. Lo Showroom usa il **listino di
partenza reale** (`convex/catalog.ts` + `catalogExtras`) e le **funzioni di calcolo reali** del server
copiate testualmente nell'harness; le altre cifre vengono dal listino dimostrativo del preventivatore.
Il dialogo è sceneggiatura; ogni risposta di Marco corrisponde a una funzione presente nel prodotto.

## Audio
Colonna sonora originale sintetizzata (`tools/reel_sound.py`): orologio che ticchetta nell'hook, groove
leggero nel dialogo, più pieno in showroom, atmosfera notturna senza batteria con i "ping" delle notifiche
(suono generico, non quello di WhatsApp), sveglia al mattino, impatto sul logo finale.

## Ricostruzione
```
cd marketing/motion-video && npm i && python3 -m http.server 8766 --bind 127.0.0.1 &
cd reel && node tools/render_reel.mjs && python3 tools/reel_sound.py
```
Le catture si rigenerano con `harness/capture_reel.mjs.txt` dopo aver ricreato le route temporanee
(`../film/harness/*.txt`, più `calc-bridge` e `payload.json` descritti in `harness/README.txt`).
