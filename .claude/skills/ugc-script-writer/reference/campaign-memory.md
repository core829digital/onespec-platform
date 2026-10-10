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
