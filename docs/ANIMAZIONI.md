# Animazioni e caricamento — specifica e regole (13/10/2026)

Riferimento: reel indicato da Stefan (descrizione fornita da lui, 13/10/2026). Il reel non è accessibile dal nostro ambiente: la specifica sotto è la sua descrizione, tradotta in regole misurabili.

## Cosa chiede il riferimento → come lo realizziamo
| Elemento del video | Realizzazione nella piattaforma |
|---|---|
| Schede fluttuanti a strati (3D leggero) | `.os-float`: ombre a più livelli, sollevamento al passaggio, nessuna oscillazione continua (le schede KPI `.os-float-idle` stanno ferme: muoverle di frazioni di pixel faceva tremolare il testo) |
| Grafici che si disegnano, numeri che crescono | `.os-draw` (stroke-dashoffset, CSS) e `useCountUp` (valore finale già nel markup, nessun salto) |
| Cursore elegante che clicca e trascina | **Nell'app**: trascinamento con molla (sollevamento, rilascio elastico, riordino fluido). **Cursore guidato**: solo nella demo del sito (ANI11), non nell'app reale |
| Skeleton con onda di luce, poi dissolvenza/scale-in | `.os-skel` (shimmer sul compositore) + `.os-reveal` quando arriva il contenuto |
| Toggle/pulsanti con rimbalzo elastico | `--os-spring` su toggle, pulsanti, menu, notifiche |
| Morphing scheda → pannello a tutto schermo | View Transitions API dove disponibile, dissolvenza/scala come ripiego |
| Ingresso a cascata dal basso | `.os-rise` con `--i` (ritardo 40 ms a passo, massimo 8 passi = 320 ms) |
| Livelli che si separano e si ricompongono | `.os-assemble`: la dashboard si compone da livelli sfalsati al primo caricamento |

## Regole non negoziabili (prestazioni)
1. **Il contenuto non aspetta mai l'animazione.** Solo `transform` e `opacity` (compositore, niente layout). Nessuna animazione allunga LCP: ritardo massimo di cascata 320 ms, durata massima 480 ms.
2. **Zero spostamenti di layout (CLS = 0)**: lo skeleton ha le stesse dimensioni del contenuto; i contatori usano cifre a larghezza fissa (`tabular-nums`).
3. **`prefers-reduced-motion`**: tutto si azzera (già globale) e i contatori mostrano subito il valore finale.
4. **Nessuna libreria nuova.** CSS per tutto ciò che si può; `framer-motion` resta dove già c'è (grafici); `@dnd-kit` per il trascinamento.
5. **Limite di elementi animati**: oltre 24 elementi in una lista, i successivi compaiono senza ritardo.
6. **Niente animazioni infinite** tranne lo shimmer degli skeleton (si ferma al caricamento) e la lieve oscillazione delle sole 4 schede KPI.

## Stato (13/10/2026)
| Voce | Stato | Dove |
|---|---|---|
| Fondazione movimento (molla, cascata, livelli, fluttuanti, entrata/uscita) | Fatto | `src/app/globals.css` (blocco «OneSpec motion foundation») |
| Skeleton con onda di luce (compositore) in tutte le pagine di caricamento | Fatto | `.os-skel`, 21 `loading.tsx`, `ui/skeleton.tsx`; dashboard con skeleton identico al layout reale |
| Contatori che crescono | Fatto | `ui/count-up.tsx`, `StatCard` |
| Grafici che si disegnano | Già presenti (linea, barre, ciambella) | `analytics/charts.tsx`, `PieChart.tsx` |
| Dashboard a strati fluttuanti, cascata, assemblaggio | Fatto | `dashboard/page.tsx` (`os-float`, `os-float-idle`, `os-layer`) |
| Interruttori elastici, pulsanti con rimbalzo, badge che «scoppia» | Fatto | `editor-primitives.tsx`, regola globale dei pulsanti, `notification-bell.tsx` |
| Cascata su **tutte** le pagine (primi 9 blocchi) | Fatto | `.os-page > …` in `globals.css` |
| Dialog che nascono dal punto premuto | Fatto | `motion/pointer-origin.tsx` + `os-morph-in` (esclusi i fogli dal basso e i popover: `data-no-morph`) |
| Trascinamento rivisto | Fatto | `components/dnd/kit.tsx`; pipeline passa da drag HTML5 a dnd-kit (tocco, copia sollevata, molla); cantieri: colonne vuote ora accettano le schede (prima no), spostamento immediato, niente riordino fantasma |
| Cursore guidato nella demo del sito | Da fare (ANI11) | demo |
| Morph di navigazione scheda → pagina (View Transitions di Next/React) | Non fatto di proposito | richiede nome condiviso su coppie lista/dettaglio e Chromium recente; va misurato prima di estenderlo |

## Come si verifica
- `tests/motion-guard.test.ts`: solo `transform`/`opacity` nei keyframe, reduced-motion presente, cascata limitata, shimmer sul compositore.
- E2E in browser reale (`e2e/app-flows.mjs`): CLS della dashboard < 0,1, il contatore arriva al valore vero, con reduced-motion nessuna animazione cronometrata in corso, trascinamento di un cantiere tra colonne.
