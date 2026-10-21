# Campaign memory (OneSpec UGC): decisions and scripts so far

Single place to look up what Stefan has already decided, so nobody asks twice. Update it whenever Stefan answers something or a script
is approved. Newest entries at the bottom of each section.

## Locked decisions (answered by Stefan)
| Date | Decision | Value |
|---|---|---|
| 2026-10-10 | Product of the first script | **Configurator widget** (the one the dealer pastes on their website) |
| 2026-10-10 | Format | **Mid-Funnel Punchy** (18-22 s, three beats, three chunks, `@asset` pattern NO, YES, NO) |
| 2026-10-10 | Tactile analogy (lock word for word) | "Pensalo meno come un **listino di carta** e più come un **banco che lavora anche di notte**." (Stefan's choice B, "Meno listino di carta, più un banco che lavora anche di notte.") |
| 2026-10-10 | Brand name in the voiceover | **No.** OneSpec appears only on the end card (text/logo). No pronunciation lock needed while this holds |
| 2026-10-10 | Audience | Owner of a small window/door company, 40-55 (Italian trade). Surface pain: customers who only ask the price. Warm audience (has seen the site or the demo) |
| 2026-10-10 | Creator and setting | **Woman 30-40, in a showroom**; synthetic person, must carry the platform's AI-generated-content label |

## Defaults I applied (not asked; Stefan may change them)
- Variation type: **Myth Buster** (opens with the corrective reframe "problema di processo, non di traffico"). Hook framework: "Your ___ is ___, and ___ won't fix it" family.
- Pain angle: **surface** (price-only requests), as the framework says to start with the surface complaint.
- CTA: soft, "Lascio il link qui sotto se vuoi dargli un'occhiata." The creator does **not** claim to be a user of the product (no fake testimonial).
- Voice language: Italian. No prices quoted. No statistics or results claimed.

## Still open (ASK Stefan)
1. The real **screen capture of the widget** (`@widget_screen`): a configurator with a window and its price visible, ideally inside a dealer-style website page, vertical 9:16. Source: the live widget demo (`/demo/widget`, shown on onespec.eu/demo) or a fresh screenshot. Without it chunk 2 cannot be generated truthfully.
2. Logo files (dark and light) for the end card, and whether the end card says "onespec" or "OneSpec" (the site uses lowercase).
3. Preferred AI voice and its speed (the script is 69 words: about 21 s at 3.3 words/s, 28 s at 2.5 words/s; the target is 18-22 s, so use a brisk voice or accept ~23 s).
4. Where the link goes (website landing page, the demo, or sign-up) and the first-comment wording.
5. Platform(s) and the AI-label choice for each (TikTok, Instagram Reels, YouTube Shorts).
6. Budget approval for any Higgsfield generation (quote first, no spend without his OK).

## Script W1: widget, Mid-Funnel Punchy, Myth Buster, Italian
Words 69. Checker: `check_voiceover.py --format mid` passes (no dashes, no bold, no hard sell, soft CTA found).

> Se vendi infissi e i clienti chiedono solo il prezzo, è un problema di processo, non di traffico. Pensalo meno come un listino di carta e più come un banco che lavora anche di notte: il cliente configura la finestra, vede il prezzo e ti manda la sua richiesta. La sera la trovi già completa, non una domanda a vuoto. Lascio il link qui sotto se vuoi dargli un'occhiata.

Claims used, all under "Verified capabilities": configurator on the dealer's own site (1), customer sees the price (1), the request reaches the
platform complete (2). Nothing else is claimed.

### Production prompt (chunked; paste CHARACTER LOCK and the four blocks into every chunk)
**CHARACTER LOCK.** Vertical 9:16 UGC video. The creator is a woman in her mid thirties, calm and practical, shoulder-length chestnut hair
loosely tied back, warm olive skin, brown eyes, small silver stud earrings, wearing a plain charcoal fleece vest over a white shirt with
no logos. Natural look, minimal makeup. She is in a bright window showroom: display windows with white and anthracite PVC frames
behind her, a long counter, soft daylight from a large glass front on her left. Same outfit, hair, light and place in every chunk.

**WORKSPACE CONDITION BLOCK.** Important workspace direction: the showroom is orderly and lived in. The counter is tidy, with a pen, a
small sample corner and no piles of paper price lists or sticky notes. The creator looks relaxed and in control, like someone whose quotes
are already handled. This applies to every shot.

**SCREEN DIRECTION BLOCK.** Important screen direction: whenever a screen appears it must be the supplied reference image, used exactly:
the real configurator showing a window and its price. No invented interface text, no garbled letters, no invented charts or numbers, no
morphing buttons. Keep the screen steady enough to read. If a screen is not referenced in this chunk, no screen is visible at all.

**B-ROLL SEQUENCING BLOCK.** Important b-roll sequencing: the configurator screen must not appear until the voiceover says the customer
configures the window. During the hook and reframe the camera stays on the creator. No cutaways to windows, furniture or the
showroom for decoration.

**UGC REALISM DIRECTION BLOCK.** Important UGC realism direction: this is a casually filmed video. The phone is propped off camera, so both
hands are free. Natural handheld jitter and small micro-movements give a self-filmed feel. She gestures with both hands, touches
her hair once, uses open-palm gestures, shifts her weight. She is never frozen with hands in pockets or behind her back. The energy is
"I just want to tell you something", not "I am posing for a commercial."

**CHUNK 1 — HOOK + REFRAME (5-7 s). `@widget_screen`: NO.**
Voiceover: "Se vendi infissi e i clienti chiedono solo il prezzo, è un problema di processo, non di traffico."
Visual: talking to camera at the counter, both hands free, a small open-palm gesture on "prezzo" and a side-to-side dismissive wave
on "traffico". Camera stays on her, gentle handheld. No product, no screen, no cutaways.
Continuity: establishes baseline for outfit, hair, light and position.

**CHUNK 2 — MECHANISM + REVEAL (9-11 s). `@widget_screen`: YES, only from "il cliente configura la finestra".**
Voiceover: "Pensalo meno come un listino di carta e più come un banco che lavora anche di notte: il cliente configura la finestra, vede il
prezzo e ti manda la sua richiesta."
Visual: she walks to the end of the counter (motivated move). On "listino di carta" she lifts a single paper price list and lets it
drop to the counter with a small shrug. On "banco che lavora anche di notte" she taps the counter twice with an open hand. On "il
cliente configura la finestra" the phone on a small stand beside her shows the reference screen (a window being configured, price
visible); on "vede il prezzo" a push-in on the price; on "ti manda la sua richiesta" a finger taps the send button. Phone steadier
here, subtle drift.
Continuity: same outfit, hair, light as chunk 1; the screen matches the reference image exactly.

**CHUNK 3 — PAYOFF + SOFT CTA (5-6 s). `@widget_screen`: NO.**
Voiceover: "La sera la trovi già completa, non una domanda a vuoto. Lascio il link qui sotto se vuoi dargli un'occhiata."
Visual: back to talking to camera, framing as close as possible to chunk 1 (bookend). A soft, genuine smile on "già completa", a subtle
downward gesture toward the lower part of the frame on "link qui sotto". End card, added in post: the logo and "onespec" as text for
the last 1.5 s; the brand is not spoken.
Continuity: match chunk 1 framing, same outfit, hair and light.

Fallback cut: if chunk 3 fails, end on chunk 2's tap and put the CTA line over the end card as text. Chunk 2 is the hardest to regenerate:
plan extra generations for it.

### Caption and first comment
- Caption (Myth Buster template, Italian, lowercase): `se pensavi che i clienti che chiedono solo il prezzo fossero un problema di traffico, leggi questo`
- First comment: `lascio qui il link al configuratore, se vuoi dargli un'occhiata.`
- Publish with the platform's AI-generated content label (synthetic creator and voice).

### Test plan hooks (framework §14)
Watch time in the first 3 seconds (hook), completion, comments that repeat "banco che lavora anche di notte" (scale signal). Next variations to
write if W1 works: same script with the creator man 40-50 in a workshop; the "Tested it" and "Accidental discovery" voices; a deep pain angle (the
evening mental tax of rebuilding quotes).

## Update 2026-10-10 (video W1 v2 consegnato, poi richiesta W2)
- W1 consegnato: clip Seedance 2.5 1080p 9:16 (23 s) + voce TTS italiana femminile "Elena" riallineata + sottotitoli + schermata widget reale (dalla demo pubblica) + end card logo e onespec.eu. Stefan NON vuole la scritta "Contenuto generato con IA" nel video (si segnala con l'opzione AI della piattaforma alla pubblicazione).
- Lezione: la voce interna di Seedance sbaglia parole ("sotto" -> "bosso"): usare sempre TTS pulita come traccia finale e controllare con Whisper.
- Costo: Seedance 2.5, 25 s, 1080p, audio = 300 crediti (saldo 427,71 dopo il W1). Una sola generazione completa possibile per volta.

### Decisioni Stefan per W2
- Formato: 9:16 verticale (scritto "16:9" per errore, confermato 9:16). Look cinematico, camera shake leggero, piu angolazioni.
- Problema centrale: curiosi che chiedono solo il prezzo, il montatore perde tempo, nessuna risposta. Il video di "Marco" non e disponibile: usare solo la descrizione di Stefan.
- Deve presentare: il montatore mette il configuratore sul suo sito con UNA riga di codice (copia e incolla). Claim verificato (embed.js).
- La creator mostra il telefono con il prodotto alla camera, schermo ben leggibile.
- Vestito con logo OneSpec: logo vero applicato in montaggio (non generato dall'IA).

### Script W2 (75 parole, checker mid OK; sopra il range 55-70, runtime ~24-25 s)
> Clienti che chiedono solo il prezzo, ti fanno perdere tempo e poi spariscono? Non è un problema di traffico, è un problema di processo. Pensalo meno come un listino di carta e più come un banco che lavora anche di notte: il cliente configura la finestra, vede il prezzo e ti manda una richiesta completa. Lo metti sul tuo sito con una sola riga di codice. Lascio il link qui sotto se vuoi dargli un'occhiata.

## Update 2026-10-11 (W2 delivered, Scenario 1 delivered, voice choice)
- **W2** (Seedance 2.5, 1080p, 26 s, six angles, phone with real widget/embed screens composited, logo composited on the vest) delivered in the Higgsfield library; cost 78 (480p draft) + 312 (1080p).
- **Scenario 1 "Lo showroom che non dorme mai"** (from Stefan's 5-scenario package) delivered with **Kling 3.0 Turbo** (Kling 2.0 does not exist in the catalogue; 2.6 costs 10 credits/5 s, Turbo 7.5 credits/5 s at 720p): 3 silent B-roll clips + TTS + real screens + captions + end card "PROVALO TU · LINK IN BIO". Total 23.55 credits, 29 s.
- **Voice locked by Stefan: "Soraya"** (text2speech_v2, variant elevenlabs, voice_id `5c1d2f7f-cdb4-5b1d-bca9-156439e3275e`). "Elena" was judged too cold and aggressive; "Livia" was too slow (30 s).
- Claims removed from the package scripts because they are not verifiable (never reuse without Stefan's proof): "-60% sopralluoghi", "EUR 8.400 in 3 minuti", "rata EUR 89/mese con detrazione", price "forchetta" with the final price visible only to the dealer, "30 widget brandizzati / un solo listino CSV", "configuratore da EUR 2000", dashboard numbers, "signora Maria".
- Stefan does not want the "Contenuto generato con IA" text burned into the video (the platform's own AI label is applied at publishing).
- Technique that works: chroma-key placeholders (flat magenta phone screen and chest patch) in the generated clip, then a per-frame OpenCV tracker warps the real screen/logo onto them (HSV mask, minAreaRect, EMA smoothing). Seedance's own voice mispronounces Italian ("sotto" -> "bosso"): always replace it with clean TTS and re-check with Whisper.
- Open: remaining 10 credits; scenarios 2-5 need more credits and (for 2 and 4) the real product facts first.

## Strategia Nord (Meta AI, 2026-10-19): strategia da implementare
Testo originale integrale (rumeno + italiano): `strategia-nord-meta-ai.md`. Qui le decisioni; in caso di conflitto vale questa sezione.

### Sintesi dell'analisi
- OneSpec vende TEMPO e precisione, non "un configuratore bello". Il Nord (Lombardia, Veneto, Piemonte, Friuli) compra precisione: parlare di "zero errori", "RAL 7016", "triplo vetro", "detrazione", mai di "piu economico".
- Due prodotti da mostrare: widget sul sito del serramentista (cliente finale) e Configuratore Showroom su tablet (sopralluogo: prezzo, Bonus Casa, rateizzazione indicativa, PDF con il logo del serramentista).
- CTA sempre verso il configuratore (link in bio), non verso una telefonata: il cliente del Nord vuole provare da solo.
- Debolezze segnalate: prodotto giovane (changelog da settembre 2026), nessuna prova sociale reale ancora, 7 piani confusi, l'import del listino CSV e l'ostacolo principale per i piccoli.

### Serie TikTok/Reels "Il metodo Milano" (3 video collegati + 1 corto)
| # | Titolo | Pubblicazione | Messaggio | Voce |
|---|---|---|---|---|
| V1 | L'errore da 2.300 € | lunedi 20:30 | bicolore 7016 fuori / bianco dentro sbagliato in Excel; OneSpec lo porta in disegno, prezzo e PDF | narratore maschile |
| V2 | Quanto costa il silenzio? | mercoledi 19:30 | rumore della citta, triplo vetro, "il prezzo lo configuri tu" | narratore maschile |
| V3 | Chiuso in cucina | venerdi 20:00 | Showroom su tablet: prezzo, costo dopo Bonus Casa, rata indicativa, PDF subito | cliente (femminile) + serramentista (maschile) |
| V1-15 | L'errore da 2.300 € (15 s) | Reels/Stories | versione corta del V1 | narratore maschile |

- Link: mai nella descrizione; in BIO (pagina link del configuratore) e nel primo commento fissato: "👇 Configura la tua finestra in 60 secondi: link in bio".
- Tra i video: duetti/stitch su contenuti infissi del Nord.
- Copertine: V1 "ERRORE 2.300 €", V2 "IL SILENZIO HA UN PREZZO", V3 "9.200 € IN CUCINA". Testo leggibile in 0,5 s.
- Didascalie V1: come da testo Meta, ma senza "un posatore di Verona" (vedi tabella) e con "Esempio".
- Hashtag V1: #infissimilano #serramentibergamo #bicolore #ral7016 #preventivoinfissi #infissialuminio #serramentista #milano #torino #verona

### Verifica dei claim (fatta sul codice il 2026-10-19)
| Claim Meta | Stato | Uso nei video |
|---|---|---|
| Bicolore fuori/dentro con sovrapprezzo, nel disegno e nel PDF | VERIFICATO (pricing `bicolorPerM2Cents`, disegno, export/PDF, widget, showroom, editor B2B) | si |
| Finitura Antracite RAL 7016 | VERIFICATO (catalogo `anthracite`, preset `ral7016`) | si |
| Triplo vetro nel configuratore | VERIFICATO | si |
| Una riga di codice / iframe, funziona su WordPress, Wix, ecc. | VERIFICATO (embed.js) | si |
| Showroom: prezzo chiavi in mano, "Costo effettivo dopo Bonus Casa" 50 %, "Esempio di rateizzazione ... in 24 rate (indicativo)", PDF con logo | VERIFICATO | si, con l'etichetta "Esempio" |
| "Rata 96 €/mese" su 9.200 € | ERRATO: la piattaforma mostra 9.200 / 24 = 383,33 €/mese (indicativo) | corretto in 383,33 € |
| Bonus Casa 2026: 50 % prima casa / 36 % altre, niente sconto in fattura ne cessione | coerente con il PDF della piattaforma ("50 % prima casa / 36 % seconda casa in 10 quote") | si, con "prima casa" |
| "Il collega di Verona", "appartamento in viale Monza", "cliente di Bologna" | FINTO (testimonianza/evento inventato) | rimosso: scenario dichiarato come esempio |
| 75 dB -> 32 dB, PVC Salamander BluEvolution, CasaClima, "posa certificata" | NON VERIFICABILE / marchi terzi | rimosso |
| "Il cliente non vede mai OneSpec" | vero solo da Level 2 in su (Level 1 ha il badge) | non usato nei video |
| "Filtra i non clienti" / "chi ti scrive ha gia deciso" | promessa di marketing, non misurata | non usato |
| Stime "20k-50k views, 15-20 richieste, successo 90 %" | stime Meta, non dati | non usate, solo obiettivi interni |

### Raccomandazioni di business (stato)
- Pagina "Chi siamo" con entita legale e persona reale: FATTO sul sito.
- Semplificare i 7 piani (Level 3 a 79,90 € offre piu di Base a 97 €; "Piu scelto" su due piani): APERTO, decisione di Stefan.
- Servizio "ti importo io il listino" (gratis nel pilota o una tantum): APERTO.
- Referral 10 % (5 € a Level 1) giudicato troppo basso: APERTO (proposta: un mese gratis a entrambi).
- Pilota in Toscana/Emilia (5-10 clienti, 3-5 casi studio), poi digitale nel Nord (Bergamo, Brescia, Veneto, Friuli), Sud dopo: APERTO.
- Canali: associazioni (ANFIT, PVC Forum, UNICMI, FederlegnoArredo, CNA), distributori di profili/ferramenta, fiere (Made Expo, Klimahouse, SAIE, Key Energy), SEO su Bonus Casa 2026. Prospezione via e-mail/telefono solo nel rispetto di GDPR/ePrivacy e Registro delle Opposizioni.
- Consiglio mio (da decidere): lo Showroom usa sempre il 50 %; aggiungere la scelta prima casa 50 % / altre 36 %.

### Decisioni di produzione (motion design, 2026-10-19)
- Formato 9:16 1080x1920 60 fps (Reels/TikTok). Stefan ha scritto "16:9" ma i Reels sono verticali (stesso errore gia confermato il 2026-10-10); versione 16:9 su richiesta.
- Motion design 100 % grafico (nessun attore generato, nessun credito speso): pipeline HTML + Playwright + ffmpeg dell'EP1.
- Voce gratuita Kokoro (locale): `im_nicola` narratore/serramentista, `if_sara` cliente; velocita 1,1; pronuncia "OneSpec" -> "Uàn Spèk". Controllo con Whisper su ogni video.
- Sottotitoli karaoke bruciati, testi a schermo con i tempi di Meta, chip "Esempio" su ogni cifra o scenario.
- Schermate: repliche fedeli del widget e dello Showroom (solo funzioni verificate sopra).
- Nessuna scritta "generato con IA" nel video (Stefan usa l'etichetta della piattaforma se serve); mai dire che i video sono fatti dall'IA.

### Produzione consegnata (2026-10-19)
- File e sorgenti: `marketing/strategia-nord/` (README con didascalie, hashtag, orari, primo commento e comandi per rigenerare).
- V1 30 s, V2 24 s, V3 39 s, V1 corto 15 s; copertine JPG per V1-V3. Tutti 1080×1920 60 fps, sottotitoli karaoke impressi, voce controllata con Whisper sul mix finale.
- Scelte di onestà applicate: V1 senza "collega di Verona" (cifre "Esempio"); V2 senza dB, viale Monza, Salamander, CasaClima; V3 "Scena di esempio", rata 383,33 € (non 96 €), Bonus Casa "prima casa", scorrevole antracite RAL 7016 (il nero non è un preset del catalogo).
- Pronuncia: "RAL 7016" detto "settemilasedici" ("settanta sedici" veniva capito "76"); "IVA" mal pronunciata da Kokoro, quindi solo a schermo; "PDF" detto "pi di effe".
- Prossimi passi proposti: versione 16:9 su richiesta; dopo 7 giorni leggere completamento e click su link in bio per video (framework §14).

## Voce dei video: regola fissa (Stefan, 2026-10-20)
- **Usare sempre le voci neurali Microsoft gratuite** (edge-tts, `marketing/strategia-nord/src/tts_edge.py`):
  **it-IT-DiegoNeural** (uomo: serramentista, narratore) e **it-IT-IsabellaNeural** (donna). Stefan: "mantieni questa voce perché ci sta".
- Rifiutate e da non riproporre: Kokoro (accento inglese, intonazione "tradotta"), Piper paola/riccardo (stuttering, poca chiarezza,
  anche con sintesi a frase intera), Coqui M-AILABS (incomprensibile). Higgsfield/ElevenLabs resta l'unica alternativa a pagamento
  (circa 0,75 crediti ogni 240 caratteri; solo con approvazione esplicita e con i domini cloudfront/higgsfield sbloccati).
- Regia che Stefan considera "il vero layer": domande con intonazione che sale, affermazioni che scendono; pause curate
  (più lunghe dopo una domanda che dopo un punto, stacco tra battute); ritmo per battuta (più calmo sul problema, più deciso sulla
  soluzione); tono da venditore che consiglia senza che si noti.
- Tecnica: una frase per chiamata, pause inserite da noi, coda di 0,15 s mantenuta (altrimenti si taglia la vocale finale, es.
  "complete" → "complit"); tempi parola esatti dagli eventi WordBoundary; controllo Whisper (`asr.py`) prima di consegnare.
- Pronuncia: la voce non dice "OneSpec" (lo storpia): marchio solo a schermo. Evitare parole che la voce legge male:
  "spam" (letto all'inglese) → "richieste false"; "complete" a fine frase → riformulare.
- Ambiente: serve `speech.platform.bing.com` negli Allowed domains (sbloccato da Stefan il 2026-10-20).

## Produzione 2026-10-20 (martedì)
- **Pillola** "Quanto ti costa un preventivo a vuoto?" (20 s, Diego): pubblicata verso le 14:00 (ordine invertito su richiesta di
  Stefan: pillola di giorno, episodio la sera). Testo: 2 h sopralluogo + 1 h preventivo = 3 h; × 10 clienti spariti = 30 h, quasi
  4 giornate (cifre marcate "Esempio"); CTA "Scrivilo nei commenti".
- **Serie 1 · EP1 "Preventivi a vuoto"** (43 s, Diego = Marco serramentista, Isabella = Sara del team): da pubblicare alle 20:30.
  Testo cambiato rispetto alla versione Kokoro: "nel tuo sito", "E ti arrivano con tutti i dati. Le richieste false vengono
  filtrate", "Decidi tu chi richiamare", CTA "Provalo gratis per 14 giorni. Il link è nella bio." (niente marchio parlato).
- Lunedì mancati: storia con sondaggio, commento fissato, DM (recuperati martedì).
- Piano social con checklist: https://claude.ai/artifact/3h644HWVJnPJ9uBXAiYif4 (Serie 2 lun/mer/ven, Serie 1 mar/gio; DM 18:30).
- Da rifare con la voce Microsoft: V2 (mercoledì 19:30), V3 (venerdì 20:00); il corto 15 s Kokoro non va usato.
