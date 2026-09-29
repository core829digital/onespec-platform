# INVENTORY — onespec configurator (widget `/w/[publicId]`, `/c/[publicId]`)

**Capture source.** `onespec.eu` / `cloud.onespec.eu` and `*.convex.cloud` are blocked by this
environment's network policy, so the real React component (`src/components/widget/widget.tsx`)
was rendered locally through a temporary route with the real IT region policy from
`convex/lib/regions.ts` and captured with Playwright at 1440 px (full-page, scrolled to the
bottom in steps first). Screenshots: `capture/`. Raw innerText + select options: `capture/raw-text.json`.
All copy: `copy.json`.

## Fonts (computed styles)
| Use | Family |
|---|---|
| Interface (headings, labels, buttons) | **Space Grotesk** (`--font-space-grotesk`, Inter fallback) |
| Technical drawing dims, "Anta N" label | **IBM Plex Mono** (declared in `spec-drawing.tsx`; the dev capture fell back to system mono) |

## Colours (sampled from screenshot pixels, dominant colour per region)
| Token | Hex | Where sampled |
|---|---|---|
| Page | `#ffffff` | page background |
| Panel | `#f5f5f7` | Configurazione / Disegno / Preventivo panels, unselected material tab |
| Border | `#d2d2d7` | panel, input, select, unselected tab borders |
| Ink | `#1d1d1f` | headings, labels |
| Muted | `#6e6e73` | summary row labels, field sub-labels |
| Accent | `#16d19d` | selected border, estimate card, CTA, slider fill, Ecobonus text |
| Accent dark | `#0fbf8f` | logo tile, outline button |
| Mint on page | `#ddf6ef` | selected material tab |
| Mint on panel | `#d4ede8` | selected segment, leaf editor, Ecobonus pill |
| CTA ink | `#0a0b0d` | text on the green card / CTA |
| Frame (finish *Bianco standard*) | stroke `#c9d3d8`, fill `#ffffff` | drawing frame |
| Selection | `#1e5f74` | dashed selected leaf, divider grip |
| Handle marker | `#2563eb` | dashed handle-height line + value |
| Warning | `#dc2626` | leaf below minimum width |
| Swatches | PVC `#dceaf0` · Legno `#f1e4d2` · Alluminio `#e6e9ea` | material tabs |
| Slider track (native, accentColor) | `#3b3b3b` | rest of the range track |

## Components
| # | Component | Specs (world px) | Real copy | When touched | How the one shape becomes it |
|---|---|---|---|---|---|
| 1 | Material tabs | 3 tabs, r12, 52–56 h, 1 px border; selected mint + accent border; 2+1 wrap on narrow widths | PVC · Legno · Alluminio | selects material, swaps option lists (Legno → "Pino" profile) | the shape **is** the selected-tab indicator; slides as a liquid indicator |
| 2 | Tipo di prodotto switch | 2 segments r8, 48 h; selected mint `#d4ede8`, text accent | Finestra · Porta balcone · "→ Soglia in alluminio da 18mm inclusa" | sets product + default size (Porta balcone → 1300 × 2100 mm) | tab indicator shrinks to r8 and becomes the segment indicator |
| 3 | Disegno tecnico (SpecDrawing) | frame r3·2, stroke 4.5·2; dims IBM Plex Mono 11·2; triangle = hinge side | DISEGNO TECNICO · Vista: interno → esterno · legend · click hint | click a leaf → selects (dashed outline + handle marker at height/2) | segment indicator grows into the window frame (door proportions) |
| 4 | Leaf divider drag | grip `#1e5f74`; ratio clamped 0.08–0.92 | — | drag resizes leaves; a leaf under its minimum (Fissa 300 mm, Anta-ribalta 415 mm) gets a red dashed outline and "!" | pure function of cursor x relative to the grab point |
| 5 | Leaf editor "Anta N" | r8, 1.5 px accent border, mint bg; 4 selects; range slider min 300 / max H−150 / step 10 | Anta 2 · Tipo di apertura · Lato apertura · Ferramenta (maniglie e cerniere) · Colore ferramenta · Altezza maniglia | edits the selected leaf; slider moves handle height | the window frame becomes the editor panel |
| 6 | VAT select + Ecobonus | select r8 white; pill r999 mint, italic 800 | ALIQUOTA IVA · IVA ordinaria 22% · Ristrutturazione 10% · ECOBONUS 50% | changes VAT on the estimate | panel shrinks into the select; opens into its option list |
| 7 | Summary rows | 13 px rows, 1 px dividers | Superficie 2,73 m² · Perimetro telaio 6,80 m (pure geometry of 1300 × 2100) | — | context rows around the select |
| 8 | Estimate card | r8, `#16d19d` | TOTALE STIMATO IVA INCLUSA · Stima orientativa · non è un preventivo contrattuale. · Posa in opera secondo norma UNI 11673-1:2017 | — | select grows into the green card |
| 9 | Outline + primary CTA | r8; outline `#0fbf8f`; primary `#16d19d` | + Aggiungi un'altra finestra / porta balcone · → Completa e richiedi preventivo | opens the site-visit form | green card shrinks into the green CTA (same colour) |
| 10 | Site-visit form submit | same button | Richiedi un sopralluogo | sends the request | CTA label swaps with blur; shape returns to the PVC tab for the loop |

## Flagged and left out
- **Every € amount** (507,80 €, 891,80 €, 1.420,80 €, all "Materiale e manodopera / Profilo / Opzioni" rows) — the capture has no installer catalogue, so the widget prices from its fallback demo table. Not real → not shown. The estimate card is shown with its label and disclaimer only.
- **Uw 1,16 W/m²K** — computed from the same fallback table → left out.
- **Login page "1.240 €" and "UW 1.1"** — decorative sample values on the blueprint → not used.
- **"onespec" as the header name** — in production this slot shows the installer's own company name; the capture passes "onespec", which is the brand the video is about.
