# Audit full-stack · ottobre 2026 (AUD5)

Ambito: piattaforma OneSpec (Next.js 16 + Convex) e sito. Metodo: scansione automatica di accessibilità (axe-core) su 27 pagine × 3 varianti
(desktop scuro, desktop chiaro, telefono), E2E in browser reale con backend fedele, test unitari/backend, scansione dei permessi Convex,
`npm audit`, controllo i18n (chiavi grezze), immagini rotte, titoli, intestazioni, CLS e reduced-motion.

## Esito sintetico

| Area | Esito |
|---|---|
| Permessi backend (Convex) | Nessuna funzione pubblica senza guardia (scansione euristica di tutti gli handler) |
| Dipendenze (`npm audit --omit=dev`) | 0 vulnerabilità su piattaforma e sito |
| Test | 196 file / 1679 test verdi; tsc 0 errori; eslint 0 errori |
| E2E browser | tutti i controlli verdi; CLS ≈ 0,007; reduced-motion: 0 animazioni attive |
| i18n | nessuna chiave grezza visibile, nessuna immagine rotta, 1 solo `h1` per pagina, titoli presenti |
| Accessibilità | 11 classi di violazioni trovate; nuova scansione axe (3 varianti × 27 pagine) ha lasciato 2 residui, corretti subito dopo (selettore righe della paginazione, etichetta dei riquadri laterali) ma non rimisurati con una terza scansione |

## Trovato e corretto

**Alta priorità (impatto reale su tastiera / screen reader)**
1. Menu mobile chiuso ancora raggiungibile con Tab pur essendo `aria-hidden` → ora `inert` quando chiuso.
2. Interruttori (notifiche, cataloghi configuratore) senza nome accessibile → `aria-label` per ogni interruttore.
3. Campi con etichetta annidata (`label > label > input`) negli editor del configuratore → il campo senza etichetta propria è ora "nudo".
4. Menu a tendina e campi numerici senza nome (preventivo nuovo, clienti, richieste, account) → nomi accessibili aggiunti (nuova chiave i18n `requests.sortBy` in 6 lingue).
5. Aree con scorrimento non raggiungibili da tastiera (tabelle, DPA) → nuovo `ScrollFocus` che le rende focalizzabili solo se scorrono davvero.

**Media priorità (coerenza visiva / leggibilità)**
6. Contrasto sotto 4,5:1: testo secondario chiaro (`#6e6e73`→`#636368`), verde testo chiaro (`#0a7a5c`→`#086b50`), rosso pericolo chiaro (`#d9363e`→`#c62c34`); rimossa l'opacità dai sotto-testi del preventivo e dai giorni fuori mese in Logistica (rapporto 1,9:1).
7. Ordine dei titoli saltato (h1→h3/h4) in cantieri, sezioni del configuratore, account, pannello struttura → gerarchia corretta.
8. Maniglia di trascinamento dei cantieri: `aria-label` su elemento senza ruolo → `role="img"`.
9. Pulsante di chiusura del menu mobile 30×30 px → 44×44 px.

## Residui (onesti, non bloccanti)
- **Bersagli tocco su telefono (risolto in 1.25.2)**: componente `TouchTargets` (area di tocco invisibile fino a 44 px, senza spostare il layout; i filtri a scorrimento crescono a 40 px). Elementi sotto 32 px: da 45 a 13. Restano checkbox dentro etichette cliccabili, maniglie del disegno tecnico e link in mezzo a frasi (esenti per WCAG 2.5.8). Seconda scansione axe: 0 violazioni (telefono e desktop chiaro).
- **Causa radice dell'errore allegati supporto non confermata** senza i log di produzione di Convex: lo scanner è stato reso robusto (nessuna dipendenza da `TextDecoder("latin1")`, finestre da 256 KB) e ogni errore ora produce un codice chiaro e un log `[finalizeUpload] stage=…`. Se si ripresenta, leggere quel log.
- Morph "scheda → pagina" tra rotte non implementato di proposito (da misurare prima).
- 2FA opzionale, non obbligatoria. Azioni GitHub non fissate per SHA. CSP in modalità report-only. Testi legali da validare con un avvocato; DPA dei fornitori da verificare; soglia NIS2 da verificare sul numero di dipendenti.

## Da fare al rilascio
Impostare su Convex `SUPPORT_SIGNING_SECRET`, `MFA_ENCRYPTION_KEY` (≥32 caratteri, **non cambiarla dopo**), `DAILY_IP_SALT`; poi deploy Convex, piattaforma e sito.
