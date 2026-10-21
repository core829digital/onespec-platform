# Applying the framework to a B2B software product (OneSpec)

The framework was written for physical products (skin, hair, teeth, home care). Its logic holds for software, but three of the four
direction blocks need a software translation, and a few extra rules protect the brand. Use this file whenever the product is OneSpec
or another software product.

## 1. Block translation table

| Framework block | Physical product | Software translation (use this) |
|---|---|---|
| Skin Direction Block (lock the creator in the "after" condition) | Clear skin, healthy hair, clean home | **Workspace Condition Block**: the creator's shop, showroom or office is orderly and busy in a good way; the desk is not buried in paper price lists and sticky notes; the creator looks calm, not stressed, as someone whose quotes are already under control. No visible chaos "before" state on the present-tense creator. |
| Application Direction Block (how the product behaves when used) | Product leaves no residue | **Screen Direction Block**: only REAL OneSpec screens, taken from the live demo (`demo.onespec.eu`) or from supplied screenshots, shown on a phone or laptop in the creator's hands or on the desk. UI text stays legible and static enough to read; no invented features, no invented numbers, no gibberish interface text, no morphing buttons. Name the AI failure mode (garbled UI, fake charts, wrong language) and override it with "use the reference screenshot exactly". |
| B-Roll Sequencing Block (product only when named) | Do not show the product before the voiceover names it | **Same rule.** The OneSpec screen or logo must not appear during hook and reframe. In chunked production omit `@screen` / `@logo` references from those chunks. |
| UGC Realism Direction Block | Hands free, handheld jitter | **Same block**, with workplace behaviour: the creator checks the phone, leans on a counter, gestures toward a window frame or sample, shifts weight. Hands free, no frozen pose. |

## 2. Reference assets instead of a bottle
`@Image 1` / `@[product asset]` must be a real capture: a phone or laptop showing OneSpec (dashboard, a quote, the widget inside a
dealer's site, the configurator with a window and its price, the signed PDF). Never ask a video model to "imagine" the interface.
Capture sources: `demo.onespec.eu` (seeded with sample data), the widget demo, the showroom demo. Capture on a phone at 390 px for
vertical video. Light and dark themes both exist; choose the one that stays readable on the target device.

## 3. Truthfulness rules (non-negotiable for CORE829)
- **Claims must be true of the shipped product.** Before writing a mechanism or payoff line, check it against `onespec-brief.md`
  ("Verified capabilities"). If a capability is not listed, ask Stefan or leave it out. No invented statistics, savings, conversion
  rates, awards, or customer numbers.
- **No fake testimonials.** The creator is an AI-generated or hired persona delivering a script, not a real customer. Do not write
  lines such as "I have used it for 3 years in my company" unless a real, consenting customer will say it. Use the "tested it so you
  don't have to" and "accidental discovery" voices carefully: first-person framing is fine as dramatised UGC, but it must not claim
  fabricated results that could mislead a buyer.
- **Disclose AI-generated people/voices** where the platform or law requires it (TikTok, Meta and YouTube all have AI-content labels;
  the EU AI Act adds transparency duties for synthetic media). Add the platform's AI label when publishing. Do not impersonate a real
  person or a real installer company.
- **Prices:** quote a price only if Stefan confirms it for the campaign date. Plans and prices change; the website's Prezzi page is the
  source of truth.
- **Legal-ish wording:** avoid promising compliance outcomes (UNI 11673, tax rules, VIES) beyond what the product does. Say what the
  tool helps with, not that it guarantees compliance.

## 4. Language and market
- Default voiceover language: **Italian** for Italian installers. The platform and site exist in 6 languages (it, en, fr, de, nl, ro);
  write native-feeling versions per market, not literal translations; idioms and trade terms differ (e.g. "serramentista",
  "infissi", "preventivo" vs "devis", "Angebot").
- Pronunciation: "OneSpec" is a non-standard spelling; see the pronunciation lock in `onespec-brief.md`. If the voice model
  mispronounces it twice, drop it from the voiceover and show it only visually (end card).
- Words that AI voices mispronounce in this category: "serramenti" is usually fine; check "UNI 11673", "VIES", "iFrame", "PDF",
  "Showroom", "widget", "SaaS". Replace English tech words with plain Italian where possible ("un configuratore sul tuo sito").

## 5. Creators for a B2B trade audience
The audience is small window and door companies: owners and sales people at installers, dealers and showrooms (typically 28-60, more
male than female in the trade, with office staff of mixed gender). Rotate: owner of a small installer firm (40-55), showroom
salesperson (28-38), office/back-office coordinator (30-45), a younger second-generation owner (24-32). Settings: workshop with
window profiles and samples, showroom with display windows, a van, a site visit, a small office, a kitchen table at night with a
laptop. Keep wardrobe plausible (polo or fleece with a logo-free look, workwear, casual office). Avoid models in unrealistic glamour.

## 6. Mapping framework concepts to OneSpec
- Surface complaint: "i clienti mi chiedono solo il prezzo e spariscono".
- Structural/hidden problem: the quote process is manual and starts only after a conversation, so every price request costs time
  before the customer is even qualified.
- Mechanism in plain words: a configurator on your own website where the customer chooses the window, sees the price, and sends you
  a complete request.
- Analogy candidates (pick one with Stefan, then lock it): "Think of it less like a contact form and more like a salesperson who
  already did the first meeting for you."; "less like a price list and more like a counter that works at night". Keep the chosen one
  word-for-word across a campaign family so viewers can repeat it.
- Soft CTA: use the bank in `framework.md` §2.4, adapted to Italian ("Lascio il link qui sotto se vuoi dargli un'occhiata.").
