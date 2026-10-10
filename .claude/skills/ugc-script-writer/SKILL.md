---
name: ugc-script-writer
description: Write UGC video scripts and chunked AI-video production prompts for OneSpec (CORE829) and other products, following Stefan's "UGC Script Writing System v2" (full-stack 28-32 s and mid-funnel 18-22 s formats, five/three-beat voiceover, four direction blocks, chunk breakdowns, captions, test plan). Use whenever the task is marketing videos, UGC ads, TikTok/Reels/Shorts scripts, hooks, voiceover, creator prompts for Higgsfield or other video models, captions for a video post, or auditing/grading an existing UGC script.
---

# UGC Script Writer (CORE829 / OneSpec)

Turns Stefan Serban's **UGC Script Writing System v2** into a repeatable workflow: intake → script → audit → production prompts →
captions → test plan. The PDF's full text lives in `reference/framework.md`; read it, do not work from memory.

Talk to Stefan in **Italian**, professional, honest, minimal jargon, suggest next steps. The voiceover language is the target market's
(default Italian). Everything is for CORE829 SRL: quality over speed, nothing invented.

## Files
- `reference/framework.md`: the whole framework (15 sections). **Always read first.**
- `reference/software-adaptation.md`: how the physical-product blocks become software blocks, truthfulness and AI-disclosure rules,
  language/market notes, creator types for the window-trade audience. **Read for any OneSpec / software job.**
- `reference/onespec-brief.md`: Section 10 variables pre-filled, verified capabilities, DRAFT items awaiting Stefan, asset checklist.
- `reference/campaign-memory.md`: **decisions Stefan already made** (format, analogy, audience, creator, brand-spoken), open questions, and every
  approved script with its production prompt. Read it at intake so nothing is asked twice; update it after every answer or approved script.
- `scripts/check_voiceover.py`: mechanical audit (dashes, bold, runtime, choppy rhythm, hard-sell words, soft CTA).
  `python3 .claude/skills/ugc-script-writer/scripts/check_voiceover.py --format mid|full script.txt`

## Workflow

### 1. Intake (never invent, section 10)
First read `reference/campaign-memory.md`: anything already decided there is not asked again.
Collect or confirm: brand and product spelling, whether the brand is spoken and its pronunciation, category, mechanism in 12-year-old
language, **the tactile analogy**, failed alternatives, avatar, pain point, setting, reference image/screen capture, words the voice
mispronounces. For OneSpec start from `onespec-brief.md`; items marked DRAFT or ASK must be confirmed by Stefan before they appear in
a script (ask in ONE batched question, offering the drafts as options). Never write a claim that is not under "Verified capabilities".

### 2. Choose the recipe
Pick, and state in one line each: **format** (Full Stack for cold, Mid-Funnel Punchy for warm, Animated Infomercial for no-talent
scale), **variation type** (Confessional, Tested It, Myth Buster, Accidental Discovery, Animated Infomercial), **hook framework**
(rotate through framework §5.3), **pain point** (start surface, then deep, mass-desire filter §7), **creator demographic and setting**
(rotate, §8.6-8.7). If Stefan asks for "a campaign", build the 6-10 script test matrix of §14.1 instead of one script.

### 3. Write the voiceover
Beat structure from §5.1 or §5.2. Hard rules: the first five words call out the exact person and frustration; flowing sentences with
connectors (no stacked fragments); a mechanism a 12-year-old understands plus **one tactile analogy** ("Think of it less like ___ and
more like ___"); soft suggestion-style CTA; no em dashes, no bold, no markdown in the spoken text; swap words voices mispronounce;
if the brand is spoken, add the pronunciation lock (spelling, phonetics, no variations).
**Known inconsistency in the PDF:** the Full Stack word range (150-180 words) cannot be spoken in 28-32 s (that needs ~85-100 words at a
natural pace, and the five chunk times add up to ~30 s). Default to the **runtime**, tell Stefan once, and use the word range only if he
asks for it. Mid-funnel numbers are consistent. Italian runs about 15-20 % longer than English: check the runtime, not just the count.

### 4. Audit before showing anything
Run `check_voiceover.py`, then grade by hand against framework §2 (principles) and §9 (failure modes): rambling hook, jargon, veering
CTA, static or decorative b-roll, visual/voiceover mismatch, product visible too early, wrong condition on the creator, product residue
(for software: garbled or invented UI). Fix and re-run until clean. Do not show a script that fails.

### 5. Build the production prompt
Default deliverable is **chunked** (§3.2, §12) because it gives control: character lock pasted into every chunk; the four direction
blocks pasted verbatim, translated for software (`software-adaptation.md` §1); per chunk: number and beat, exact voiceover line,
runtime, `@asset` YES/NO (product pattern: mid NO,YES,NO; full NO,NO,NO,YES,NO; infomercial YES on all), visual direction, continuity
notes; bookend chunks 1 and last; name the fallback cut. Use the single-prompt skeleton (§3.1) only when asked for one continuous
generation. The prompt text is clean prose; keep production notes outside it. The deliverable has no meta-commentary about process.

### 6. Captions and posting
One caption from the §13.2 template matching the variation (lowercase, one soft emoji at most, no hashtags unless testing says so, no
selling) and the §13.3 first-comment link line. Add the platform's **AI-generated content label** when the creator or voice is synthetic.

### 7. Hand-off to video generation (only on request)
If Higgsfield tools are available (they are deferred: load schemas with ToolSearch first), do not guess the workflow: call
`get_workflow_instructions` (and `models_explore` with action `recommend` when unsure of the model), upload the real reference capture,
generate **one chunk at a time**, wait with `jobs_wait`, and review each result against the continuity notes. **Always check the balance
and the quote, tell Stefan the expected credit cost, and wait for his explicit approval before any paid generation; never exceed the
approved budget; never publish to TikTok or any account without a separate explicit approval.** Regenerate only the failed chunk.

### 8. After publishing
Apply §14: watch time and completion (not just CTR), cost per click per angle, comments that repeat the analogy (scale signal), kill
when the first three seconds lose the viewer. Write hook variations on a winner before fatigue; rotate creator and setting.

## Output shape
1. A two-line recipe summary (format, variation, hook, pain, creator, setting) in Italian.
2. The voiceover (plain text) with word count and estimated runtime; pronunciation block only if the brand is spoken.
3. The chunked (or single) production prompt.
4. Caption and first comment.
5. A short "Da confermare" list: open DRAFT/ASK items, the analogy choice, any claim that needs Stefan's check.

## Never
Invent features, numbers, prices, awards, testimonials or customers; use a real person's likeness or a real company as the creator;
show the product or logo during hook and reframe; use stock decorative b-roll; paste a script that fails the audit; spend credits or
publish without Stefan's explicit approval.
