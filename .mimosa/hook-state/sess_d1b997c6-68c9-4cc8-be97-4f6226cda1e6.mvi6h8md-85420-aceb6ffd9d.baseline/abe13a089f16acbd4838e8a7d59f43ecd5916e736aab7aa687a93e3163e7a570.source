# UGC Script Writing System, Version 2 (full framework)

Source: "UGC Script Framework v2" (PDF supplied by Stefan Serban, CORE829 SRL). Universal, niche-agnostic, brand-agnostic,
production-ready framework for AI-generated UGC scripts and chunked production workflows. This file reproduces the whole document;
`software-adaptation.md` explains how it applies to a B2B software product, and `onespec-brief.md` holds the OneSpec variables.

Contents: 1 Two formats · 2 Non-negotiable principles · 3 Universal script structure · 4 Universal direction blocks · 5 Voiceover
architecture · 6 Variation types · 7 Pain point selection · 8 Camera and b-roll standards · 9 Common failure modes · 10 Brand input
variables · 11 Chunked production workflow · 12 Chunk breakdown templates · 13 Captions · 14 Testing and scaling · 15 How to use.

---

## 1. Two Script Formats
Pick the one that matches the funnel stage.

| Attribute | Full Stack Format | Mid-Funnel Punchy |
|---|---|---|
| Runtime | 28–32 seconds | 18–22 seconds |
| Word count | 150–180 words | 55–70 words |
| Beat structure | Five-beat: hook, reframe, mechanism, payoff, CTA | Three-beat: sharp hook with reframe folded in, mechanism with analogy, soft payoff with close |
| Default scene count | 3 scenes | 2 scenes (3 only if voiceover requires it) |
| Default chunk count (chunked workflow) | 5 chunks | 3 chunks |
| Use for | Cold audiences who need the full education arc to convert | Warmer audiences who already know they have the problem and need a fast credibility signal |

## 2. Non-Negotiable Principles
These rules apply to every script, every format, every niche. They are not preferences. They are the core ruleset that separates a
winning UGC script from a losing one.

**2.1 The Hook Owns the First Five Words.** The opening line identifies the exact person being spoken to and confirms the specific
frustration they are carrying. Never narrates the creator's morning, weekend, or life. Calls out the right person and repels everyone else.

**2.2 Sentence Flow Over Choppy Phrasing.** No two-word stutter patterns. Sentences connect, breathe, and lead into each other. Use
connectors and complete thoughts.
- WRONG RHYTHM: "No chemicals. No scents. No replacing."
- RIGHT RHYTHM: "There are no chemicals, no scents, and nothing to replace ever again."

**2.3 Keep the Mechanism Simple.** Name the proprietary mechanism the way the brand names it, but only if a 12-year-old would
understand. Always pair the mechanism with a one-second tactile analogy the viewer can picture. The analogy is the most important
sentence in the entire script: it is what the viewer repeats to a friend later.

**2.4 Soft CTAs Outperform Direct Sales Pitches.** The locked competitor formula works for cold traffic but reads as ad-coded for
warmer audiences. Default to suggestion-style closes.
Soft CTA bank:
- "I'll leave a link to the one I'm using below."
- "I'll drop a link below if you want to look into it."
- "Linking it below so you don't have to go searching for it."
- "Leaving a link in the comments / bio so you can check it out yourself."

**2.5 No Em Dashes in Voiceover. No Bolding in Voiceover.** Em dashes break natural speech rhythm when read aloud. Bolding has no
function in audio. Use commas, periods, and short connectors.

**2.6 Avoid Words AI Voiceover Tools Mispronounce.** Common offenders: collagen, hyaluronic, niacinamide, keratosis, brand names with
non-standard spelling. Either replace with plain-language alternatives or include a phonetic pronunciation note above the voiceover.
When in doubt, swap the word.

**2.7 Brand Pronunciation Lock (when the brand is spoken).** If the brand name appears in voiceover, include a pronunciation block:
exact spelling, dictionary phonetics, and the instruction that no shortcuts or variations are permitted. If the brand is consistently
mispronounced even with phonetics, remove brand mentions from voiceover.

## 3. The Universal Script Structure
Every script output follows the same skeleton. Variables fill in. Sections never reorder. No meta-commentary about process.

### 3.1 Standard Production Skeleton (single continuous prompt)
```
Create a [STYLE] ad for [PRODUCT CATEGORY]. The creator is a [GENDER] in their [AGE RANGE], [VIBE — 2 to 3 words],
[HAIR DESCRIPTION], wearing [OUTFIT]. Natural look, [MAKEUP LEVEL]. They're in [SETTING WITH LIGHTING].

[SKIN DIRECTION BLOCK]

[APPLICATION DIRECTION BLOCK]

@Image 1 is the product, [PRODUCT NAME — what it is]. Use it as a reference for what the [PACKAGE TYPE] looks like when held or
interacted with, not as a static image.

[B-ROLL SEQUENCING BLOCK]

[UGC REALISM DIRECTION BLOCK]

Camera style: [CAMERA DIRECTION].

[B-ROLL DIRECTION WITH EXPLICIT NO-PRODUCT OPENING CUTS]

[SCENE COUNT AND PACING NOTE]

Here's the full script:

"[VOICEOVER SCRIPT]"
```

### 3.2 Chunked Production Skeleton
Use when generating clips in chunks for post-production stitching, with the same model and character across generations (Section 12).
```
[CHARACTER LOCK — paste into every chunk]

[UNIVERSAL DIRECTION BLOCKS — paste into every chunk]
  • Skin Direction Block
  • Application Direction Block
  • B-Roll Sequencing Block
  • UGC Realism Direction Block

[CHUNK-BY-CHUNK BREAKDOWN]
For each line of voiceover:
  • Line number and exact voiceover text
  • Estimated runtime in seconds
  • Scene-specific visual direction
  • Continuity notes
  • Whether @[product asset] is included or not
```

## 4. Universal Direction Blocks
These four blocks lock in production quality and prevent the most common AI generation failures. Paste them into every script. Adapt
the variables to the specific product.

### 4.1 Skin Direction Block
Prevents the AI from generating the "before" condition on the present-tense creator who is supposed to be showing the result.

> **SKIN DIRECTION BLOCK — paste verbatim.** Important skin direction: The creator has naturally beautiful, smooth, clear skin with an
> even tone and a soft healthy glow. Her complexion is clean and radiant throughout the entire video, no visible [CONDITION THE PRODUCT
> TREATS] at any point. She has the kind of skin that looks like she has already been using the product for months, because she has.
> This applies to every talking-to-camera scene, every product application scene, and every close-up.

Adaptation for other categories:
- Hair: "The creator has naturally beautiful, healthy, full hair with no visible [thinning/breakage/frizz] at any point."
- Teeth: "The creator has naturally bright, white, healthy teeth with no visible [staining/yellowing] at any point."
- Home/cleaning: "The creator's home is clean, lived-in, and beautiful, no visible [stains/clutter/damage] at any point."

Principle: lock the creator visually into the after condition the viewer is being shown the path to.

### 4.2 Application Direction Block
Prevents the AI from generating the product as a visible matte or pigmented mark when it should be invisible, transparent, or behave
differently.

> **APPLICATION DIRECTION BLOCK — paste verbatim.** Important application direction: When the creator [USES THE PRODUCT], it should
> [DESIRED VISUAL BEHAVIOR]. No visible [SPECIFIC FAILURE MODES THE AI DEFAULTS TO]. [WHAT IT SHOULD LOOK LIKE INSTEAD]. Her [TARGET
> AREA] should look exactly the same after [APPLICATION/USE] as it did before, [DESCRIPTION], with only [REALISTIC RESIDUAL EFFECT]
> where the product touched.

Principle: name the failure mode the AI defaults to and override it with positive description plus a clear visual rule.

### 4.3 B-Roll Sequencing Block
Prevents the AI from showing the product before the voiceover earns it, which kills the hook by flipping the viewer into "this is an
ad" mode too early.

> **B-ROLL SEQUENCING BLOCK — paste verbatim.** Important b-roll sequencing: The product must not appear on screen until the voiceover
> specifically introduces it. During the hook and reframe beats, the camera stays on the creator. No environmental cutaways, no
> decorative shots of the apartment, no shots of furniture or art. The product is only revealed visually at the exact moment the
> voiceover names it.

Principle: tie product visibility to a specific lyric in the voiceover, not vague timing. In chunked production, simply omit the
@[product asset] reference from prompts where the product should not appear: a hard lock the AI cannot override.

### 4.4 UGC Realism Direction Block
Prevents posed, frozen, commercial-feeling shots. Forces the natural body language of someone casually filming themselves.

> **UGC REALISM DIRECTION BLOCK — paste verbatim.** Important UGC realism direction: This is a casually filmed video. The phone is
> propped somewhere off-camera, so both her hands are free throughout. Natural handheld jitter and small micro-movements give it a
> self-filmed feel. She gestures naturally with both hands as she talks, adjusting her hair, touching her face when relevant, doing
> small open-palm gestures, shifting weight between her feet. She is never frozen in a still pose with her hands in her pockets or
> behind her back. The energy is "I just want to tell you something" not "I am posing for a commercial."

Principle: name the failure mode (frozen pose, hands in pockets) and replace it with specific natural behaviors.

## 5. Voiceover Architecture

### 5.1 Full Stack Five-Beat Structure
| Beat | Timing | Function |
|---|---|---|
| 1. Hook | 0:00–0:03 | Calls out exact person, confirms specific frustration. Two sentences. |
| 2. Problem Reframe | 0:03–0:10 | Reveals the hidden mechanism behind why the viewer's previous attempts failed. Reorients from "I am doing it wrong" to "I was given the wrong tools." |
| 3. Mechanism + Analogy | 0:10–0:20 | Introduces the product, explains the mechanism in plain language with a one-second tactile analogy. |
| 4. Payoff | 0:20–0:25 | Sensory and specific lived experience after the product. Visual and immediate, not abstract benefits. |
| 5. CTA | 0:25–0:30 | Soft suggestion-style close. |

### 5.2 Mid-Funnel Three-Beat Structure
| Beat | Timing | Function |
|---|---|---|
| 1. Sharp Hook with Reframe Folded In | 0:00–0:06 | One sentence that calls out the audience and dismisses the wrong assumption in the same breath. |
| 2. Mechanism with Analogy | 0:06–0:16 | Compressed mechanism plus the tactile analogy. The analogy stays intact at all costs. |
| 3. Soft Payoff and Close | 0:16–0:21 | One sensory beat plus the suggestion-style CTA. |

### 5.3 Hook Frameworks (rotate across scripts to prevent fatigue)
- If you are trying to ___ this is how you finally do it without ___.
- Your ___ is ___, and ___ won't fix it.
- The biggest myth about ___ is...
- I tested ___ so you don't have to.
- I wish someone had told me this before I started ___.
- I found this out by accident while ___.
- What nobody warns you about with ___ is...
- Why ___ works when nothing else does.
- Why your ___ isn't working and how to fix it.
- Don't make this mistake with ___.
- One thing I'll never do again in ___.
- Three mistakes keeping you stuck in ___.
- This one thing changed everything for me in ___.
- What nobody admits about ___ is...
- How I stopped ___.
- The truth behind my ___.
- If I could go back and tell myself one thing about ___.

### 5.4 The Universal Reframe Pattern
> "Most people think ___ is a [SURFACE] problem so they keep [SURFACE BEHAVIOR]. But it is actually a [STRUCTURAL/HIDDEN] problem,
> which is why [SURFACE SOLUTION] physically cannot reach it."

Works because it absolves the viewer of guilt for past failures and sets up the mechanism reveal. Adapt the structural-vs-surface
framing to whatever the product addresses.

## 6. Variation Types
The same structure supports multiple emotional registers. Rotate across the campaign.

| Type | Voice | Best for |
|---|---|---|
| The Confessional | First-person, present tense, includes a personal admission | Emotional categories like beauty, wellness, parenting |
| The Tested It So You Don't Have To | Audience surrogate who tried every wrong solution first | Crowded categories where the audience has tried multiple competing products |
| The Myth Buster | Opens with a corrective reframe | Educational categories where the audience has absorbed wrong information |
| The Accidental Discovery | Creator stumbled onto the insight | Lowest sales-pressure framing, positions creator as fellow explorer |
| The Animated Infomercial | No creator, pure product b-roll with voiceover | Scaling output without booking talent, or when the product is the hero |

## 7. Pain Point Selection
First scripts in any campaign target the surface complaint (visible symptom). Once those run, expand into deeper pain points.
Mass-desire pain points outperform niche ones.

- **7.1 Surface complaints:** the literal, visible symptom. Easy entry point but saturated.
- **7.2 Deep pain points** (high-leverage angles beyond the surface symptom):
  - Public visibility pain: being seen in unforgiving lighting (photos, video calls, daylight)
  - The mental tax: the daily labor of working around the problem
  - The aging or time pain: carrying the problem for years or decades, the strange grief of unresolved issues
  - The "I have fixed everything else" pain: the frustration of someone who solves problems and this is the one that has not budged
  - Intimacy and close-up pain: how the problem feels in private moments, with people who look closely
  - The recognition pain: not recognizing yourself, the gap between how you feel and how you appear
- **7.3 Mass-desire filter:** the best pain points cut across age, gender, profession and lifestyle. If the pain point only applies to
  one specific demographic it narrows reach. If almost anyone with the problem has felt it, it is mass-desire.

## 8. Camera and B-Roll Direction Standards
- **8.1 Constant motion rule.** Every shot has movement. No locked-off product photography. No still talking-head shots. Talking-to-camera
  footage uses natural handheld jitter. Hands-free shots use subtle drift or micro-push-ins. B-roll uses tracking, dolly pushes, orbits,
  reveals, or hand motion.
- **8.2 Visual-to-voiceover sync.** Every visual matches what the narrator is saying at that exact moment. When the narrator says
  "fridge" show a fridge. When they describe the mechanism show the mechanism. Visuals follow the voiceover word for word.
- **8.3 Cuts are motivated, not decorative.** Cuts happen when the creator physically moves to a new location to do something, when
  the voiceover names the product (cut to product reveal), or when a specific action happens that the script calls for. Cuts do NOT
  happen for decorative environmental shots of furniture, art or interior design; "visual breaths" unrelated to what is said; or
  aesthetic moments that exist for cinematography reasons.
- **8.4 Pacing within scenes.** Scenes play at normal speed. No slow motion. No sped-up footage. Micro-cuts can be rapid for
  high-energy beats and slightly slower for emotional or explanatory beats.
- **8.5 Scene count discipline.** Mid-funnel: 2 scenes default, 3 only if the voiceover requires it. Full stack: 3 scenes default.
  Animated infomercial: AI determines breaks from the voiceover beats.
- **8.6 Setting variation across campaign.** Rotate environments and lighting so the audience does not see the same backdrop on
  repeat: warm dim kitchen evening, bright sun-drenched morning, soft afternoon side window, cool clinical product studio, lived-in
  family kitchen, sunlit bedroom vanity, back patio outdoor light, evening warm bathroom. Tie each variation to the emotional register
  of the script.
- **8.7 Demographic variation across campaign.** Rotate creator demographics so the algorithm has signal on which segments respond.
  Standard spread: ages 19–23, 24–32, 32–38, 35–45, plus a male equivalent for at least one variation.

## 9. Common Failure Modes
Recurring AI generation failures. Self-correct against them on every output.
- ✕ **Rambling hooks.** "I scrubbed my fridge on Saturday on my hands and knees" is a failed hook. The first words call out the audience, not narrate the creator's life.
- ✕ **Choppy phrasing.** Two-word fragments stacked together kill conversational flow.
- ✕ **Jargon mechanisms.** If a 12-year-old does not understand the mechanism word, replace it.
- ✕ **Veering CTAs.** Use the locked formulas. Do not invent new structures unless testing has earned it.
- ✕ **Static b-roll.** Every shot moves.
- ✕ **Mismatched visuals.** If the narrator says one thing and the b-roll shows another, the script fails.
- ✕ **Decorative b-roll.** Cuts to furniture, art or interior design with no relationship to the voiceover. UGC has no cinematic establishing shots. Keep the camera on the creator unless there is a specific reason to cut away.
- ✕ **Over-formatting the output.** The deliverable is a clean prose prompt block. No headers, tables or production notes attached unless using chunked production format.
- ✕ **Phone in hand when not needed.** Selfie-style direction justifies the phone in hand. Otherwise leave the phone off-camera so both hands are free.
- ✕ **Frozen poses.** Hands in pockets, hands behind back, no movement. Real UGC creators gesture, shift weight, touch their face when relevant.
- ✕ **Product visibility before the voiceover earns it.** Showing the product in the hook beat tells the viewer this is an ad before they decided to keep watching.
- ✕ **Wrong condition on the present-tense creator.** Visible scars/blemishes/damage on the creator who is supposed to show the after.
- ✕ **Visible product residue when it should be invisible.** A matte stripe or pigmented mark when application should be transparent.

## 10. Brand Input Variables
Before producing any script, collect these or ask for them. **Do not invent values.**

| Variable | Status | Notes |
|---|---|---|
| Brand name and exact spelling | Required | |
| Brand pronunciation (dictionary phonetics) | Required if spoken | |
| Whether the brand name is spoken in voiceover | Required | |
| Product name and exact spelling | Required | |
| Product pronunciation | Required if spoken | |
| Product category | Required | |
| Core mechanism in plain language | Required | Must be 12-year-old understandable |
| Tactile analogy for the mechanism | Required | Format: "Think of it less like ___ and more like ___" |
| Failed alternatives the audience has tried | Required | |
| Target avatar demographics | Required | |
| Specific pain points beyond the surface complaint | Required for deep angles | |
| Setting and lighting preferences | Optional | Defaults to lived-in home environment |
| Reference image of the product | Required | Use as @Image 1 or @[product asset] |
| Words AI mispronounces in this category | Optional | Flag in advance to swap out |

## 11. Chunked Production Workflow
For projects where the same creator and setting are used across multiple generated clips stitched together in post.
- **11.1 Lock the character once.** Write a detailed character description pasted verbatim into every chunk: age range, energy, hair color and style, skin tone, eyes, accessories, specific outfit, and the apartment or setting.
- **11.2 Lock the universal direction blocks.** Skin, Application, B-Roll Sequencing and UGC Realism blocks are pasted verbatim into every chunk.
- **11.3 Break the voiceover into lines.** Each line becomes one chunk. Defaults: mid-funnel (18–22 s) 3 chunks; full stack (28–32 s) 5 chunks.
- **11.4 Asset tagging locks product visibility.** Use @[product asset name] (e.g. @stick, @bottle, @canister) in prompts where the product should appear. Do NOT include the reference in chunks where it should not appear: the AI cannot generate the product if the asset is not referenced. A hard lock that enforces the b-roll sequencing rule.
- **11.5 Bookend structure.** First and last chunk visually similar (same setting, same framing) so the stitched video feels intentional and small inconsistencies between middle chunks read as natural cuts.
- **11.6 Identify cut points and fallback cuts.** Note which chunks can be dropped if a chunk fails to generate cleanly. Usually environmental or transitional chunks.

## 12. Chunk Breakdown Templates by Script Length
Each chunk is one separate AI generation stitched in post.

### 12.1 Per-chunk specification template (every chunk)
| Field | Purpose |
|---|---|
| Chunk number and beat label | Which voiceover beat this chunk covers (Hook, Reframe, Mechanism, Payoff, CTA) |
| Voiceover text | The exact line spoken in this chunk, copied verbatim from the full script |
| Estimated runtime (seconds) | How long the generation needs to be |
| @[product asset] inclusion | Whether the product asset reference appears in this chunk's prompt: controls product visibility |
| Visual direction | Camera angle, gesture timing, what the creator is doing during the line |
| Continuity notes | What must match the previous chunk (outfit, hair, setting, lighting, position) |

### 12.2 Mid-Funnel Format, 3 chunks (18–22 s, 55–70 words)
Compresses the five-beat structure into three chunks.

**CHUNK 1 — HOOK + REFRAME (folded together).** Voiceover: the opening line that calls out the audience and dismisses the wrong
assumption in the same breath. Runtime 5–7 s. @product: **NO**. Visual: talking-to-camera in the primary setting, both hands free,
natural gestures on key words, camera stays on the creator the entire time, no environmental cutaways, no product visible.
Continuity: establishes baseline (outfit, hair, lighting, position); all later chunks reference it.

**CHUNK 2 — MECHANISM + PRODUCT REVEAL.** Voiceover: compressed mechanism plus the tactile analogy; the product is named here for the
first time. Runtime 8–10 s. @product: **YES**, at the exact moment the voiceover names it. Visual: cut to a new angle motivated by
physical movement (creator walks to a counter or surface); phone propped, framing steadier; quick application sequence: pick up
product, twist open, glide across target area, close-up of result; application leaves no visible residue per the application block.
Continuity: same outfit, hair, lighting as Chunk 1; location can shift if motivated by movement; product matches the reference image exactly.

**CHUNK 3 — PAYOFF + SOFT CTA.** Voiceover: one sensory beat of the lived experience after the product plus the suggestion-style close.
Runtime 5–6 s. @product: **NO**, closing on the creator's face. Visual: back to talking-to-camera, ideally bookending Chunk 1's
framing; soft genuine smile on the payoff line; subtle downward gesture on the CTA; both hands free. Continuity: match Chunk 1 framing
as closely as possible (bookend); same outfit, hair, lighting.

Stitching notes: natural seam between Chunk 1 and 2 (no-product hook → product reveal). If a chunk fails, Chunk 2 is hardest to drop
(carries the reveal); Chunks 1 and 3 are easier to regenerate because they are bookend talking-to-camera shots.

### 12.3 Full Stack Format, 5 chunks (28–32 s, 150–180 words)
**CHUNK 1 — HOOK.** Two sentences calling out the exact person and confirming the specific frustration. 5–6 s. @product **NO**.
Talking-to-camera, both hands free, steady eye contact, no cuts, no environmental shots; background is just the lived-in setting.
Continuity: establishes the baseline for the whole video; lock outfit, hair, lighting, position.

**CHUNK 2 — REFRAME PART 1.** Names the wrong things the audience has tried; sets up structural-vs-surface. 5–6 s. @product **NO**.
Same shot as Chunk 1 with a slight angle shift or subtle camera drift; dismissive hand gesture on the list of failed alternatives;
brief unconscious self-reference if relevant to the category. Continuity: same setting/outfit/hair/lighting; the camera move should
feel like a natural reframe within one take, not a hard cut to a new location.

**CHUNK 3 — REFRAME PART 2 (the structural truth).** The mechanism reveal: why surface attempts physically cannot work, setting up
the product as the only viable option. 5–6 s. @product **NO** (still not appeared). Continuous talking-to-camera; optional brief
gesture indicating the affected area; dismissive flick on failed alternatives; no cutaways, no product. Continuity: same setting,
outfit, lighting; the final beat before the product is introduced, hook tension peaks here.

**CHUNK 4 — MECHANISM + PRODUCT REVEAL + APPLICATION.** The product is named, the mechanism explained in plain language, the tactile
analogy lands here: the most important sentence of the script. 8–10 s. @product **YES**, first appearance at the exact moment the
voiceover names it. Cut to a new angle motivated by physical movement; phone propped on the counter, steadier framing with subtle
drift; tight shot of product in hand, twist open on the word the product is named, macro shot of application, push-in close-up of the
immediate result; no visible residue per the application block. Continuity: location shift is motivated; same outfit/hair/lighting;
product matches the reference image exactly.

**CHUNK 5 — PAYOFF + SOFT CTA.** Sensory, specific life after the product, then the suggestion-style close. 5–6 s. @product **NO**,
closing on the face. Back to talking-to-camera, bookending Chunk 1; soft genuine smile on the payoff line; subtle downward gesture
on the CTA; both hands free, no posing. Continuity: match Chunk 1 framing; the smile should feel earned, not staged.

Stitching notes: natural seam between Chunk 3 and 4. Chunks 1, 2, 3, 5 are all talking-to-camera in the primary setting; the bookend
(1 and 5 matching) masks small inconsistencies. **Chunk 3 is the easiest to drop or compress** (fold its line onto the end of Chunk 2
with continued talking-to-camera). **Chunk 4 is the hardest to regenerate** (reveal + application): plan extra generation time.

### 12.4 Animated Infomercial Format, variable chunks
No creator; pure product cinematography with voiceover. Chunk count flexes: mid-funnel runtime 3–4 chunks, full stack runtime 5–6
chunks, aligned to voiceover beats. Each chunk is a distinct visual concept (orbit shot, animated cross-section of the mechanism,
macro application footage, hero shot at the close). Adjustments: replace "Visual direction" with **Cinematography direction** (orbit,
dolly, macro, animated cutaway, hero shot); replace "Continuity notes" with **Aesthetic continuity** (lighting temperature, color
grading, surface materials); @product is **YES on every chunk**.

### 12.5 Quick reference
| Format | Runtime | Chunks | Product asset pattern |
|---|---|---|---|
| Mid-Funnel Punchy | 18–22 s | 3 | NO, YES, NO |
| Full Stack | 28–32 s | 5 | NO, NO, NO, YES, NO |
| Animated Infomercial (mid) | 18–22 s | 3–4 | YES on all |
| Animated Infomercial (full) | 28–32 s | 5–6 | YES on all |

### 12.6 Workflow summary
1. Decide format (mid-funnel or full stack) from the funnel stage.
2. Write the full voiceover with the Section 5 beat structure.
3. Lock the character description and the four universal direction blocks.
4. Break the voiceover into the chunk count for that format (3 or 5).
5. Fill the per-chunk specification template for each chunk.
6. Generate each chunk separately, regenerating any that fail to land cleanly.
7. Stitch in post, prioritising the bookend match between Chunk 1 and the final chunk.

## 13. Captions for Organic Reach
Native-feeling captions outperform branded copy.
- **13.1 Principles:** lowercase, no over-punctuation, conversational; one soft emoji maximum, optional; no hashtags unless testing shows they help on the platform; 1–2 short sentences; does not directly sell, alludes to the topic and lets the video do the work.
- **13.2 Templates by variation:**
  - Confessional / Accidental Discovery: "nobody told me ___. wish I had figured this out years ago"
  - Tested It: "spent way too much money on ___ before I figured out why none of it worked"
  - Myth Buster: "if you've been ___ thinking it would ___, read this"
  - Universal: "genuinely did not know this until recently. if you ___ this might explain why nothing's been working for you"
- **13.3 First comment:** drop the actual link in the first comment; keep the main caption clean. The first comment can be slightly more direct: "linking what I'm using in my bio if anyone wants to check it out."

## 14. Testing and Scaling Logic
- **14.1 Initial test set:** 6–10 scripts before scaling spend, covering at minimum all five variation types, 2–3 demographic profiles, 2–3 hook frameworks, both formats, and at least one mass-desire deep-pain-point angle.
- **14.2 What to watch:** watch time and completion rate (not just CTR); cost per click per creative angle; comment sentiment, specifically whether viewers say the analogy back to each other (the signal the script works); demographic breakdown of who the algorithm serves each script to.
- **14.3 Cut and scale:** KILL when watch time drops in the first 3 seconds (hook not working) or viewers watch but do not click (payoff or CTA weak). SCALE when comments quote the analogy or the payoff line back (product-language fit); once a winner emerges, write hook variations on it before fatigue sets in.
- **14.4 Fatigue defence:** rotate demographics and settings; same script, different creator and setting, can extend a winning angle by weeks.

## 15. How to Use This Document
- As a system prompt: sections 1–13 plus brand variables (section 10), desired hook framework, format, variation type and pain point; the model produces structured output.
- As a training reference / style guide for human copywriters and contractors.
- As an audit checklist: grade any script against the failure modes (section 9) and principles (section 2) before approving it for production.
