# Revisione legale dell'assistenza clienti — 12/10/2026

Revisione tecnico-giuridica preparata da Claude per CORE829 SRL sui 9 punti di `docs/SUPPORTO_LEGALE.md` §9, con il quadro normativo vigente a ottobre 2026. **Non sostituisce il parere di un avvocato abilitato**: i punti marcati «a cura umana» richiedono firma o verifica di una persona.

| # | Punto | Conclusione | Azione |
|---|---|---|---|
| 1 | Conservazione 24 mesi dei ticket chiusi | Proporzionata: copre contestazioni e il termine di prescrizione ordinario di 3 anni del Codice civile rumeno solo in parte; principio di minimizzazione (art. 5.1.e GDPR) prevale sul «per sicurezza». Mantenuta, con dichiarazione nell'informativa | Nessuna; rivalutare se emergono contenziosi |
| 2 | Ruolo sui dati dei clienti finali nei ticket | Per i dati contenuti nelle richieste del cliente, CORE829 agisce come **responsabile** (art. 28) per il contenuto del servizio e come **titolare autonomo** per i dati di account/sicurezza. Il DPA già accettato copre l'assistenza come attività di servizio | A cura umana: confermare formulazione |
| 3 | DPA sub-responsabili (Convex, Resend, Cloudflare, Vercel) | Sono clic-accept: salvare copia datata di ciascuno nel registro | **A cura umana** (non verificabile dal codice) |
| 4 | Trasferimenti USA | Il quadro UE-USA (DPF) è valido (Tribunale UE, sentenza Latombe, set. 2025) ma l'impugnazione (C-703/25 P) è pendente: **mantenere le CCS** come base di riserva e documentare il TIA | A cura umana: archiviare TIA |
| 5 | Note interne e accesso | EDPB 01/2022: le note interne che riguardano la persona rientrano nel diritto di accesso. **Adeguato nel codice**: l'esportazione include ora le note interne di ogni ticket (`convex/account.ts`); testi legali aggiornati | Fatto |
| 6 | Consumatori | Servizio B2B; nessuna modifica. Se si aprisse ai consumatori: diritti di recesso, clausole vessatorie, informativa dedicata | Nessuna |
| 7 | Allegati e antivirus | Introdotti scansione interna, attestazione firmata e download firmato (art. 32 GDPR: misure adeguate al rischio). Dichiarato onestamente che non è un motore commerciale | Fatto |
| 8 | Lingue | Testi in italiano con traduzioni di cortesia nelle 6 lingue della piattaforma; per contratti con clienti esteri valutare versione vincolante nella loro lingua | A cura umana |
| 9 | Riservatezza del personale | Predisposto modello in `docs/MODELLO_IMPEGNO_RISERVATEZZA.md` | A cura umana: farlo firmare |

## Altre norme verificate
- **Pseudonimizzazione dell'IP (EDPB 01/2025):** l'IP in forma di hash resta dato personale pseudonimizzato; l'informativa lo dichiara così.
- **Data Act (UE 2023/2854), cambio fornitore di servizi cloud, applicabile dal 12/9/2025:** OneSpec è un servizio SaaS; i Termini garantiscono esportazione dei dati (pagina Account) e assistenza alla migrazione. Clausola aggiunta.
- **NIS2 (Romania: OUG 155/2024 e L. 124/2025):** probabile esclusione per dimensione (microimpresa); non si esclude per attività: **verificare numero di dipendenti e fatturato**. Procedura incidenti in `docs/PROCEDURA_INCIDENTI.md` allineata comunque (24 h preavviso, 72 h notifica).
- **Cyber Resilience Act (UE 2024/2847):** obblighi di segnalazione dall'11/9/2026 per i prodotti con elementi digitali; il SaaS puro è fuori ambito, lo script `embed.js` è un caso dubbio da valutare.
- **Digital Omnibus (proposta 2025):** solo proposta, non in vigore: nessuna modifica ai testi.
- **Violazioni (art. 33–34 GDPR):** notifica all'ANSPDCP entro 72 h; registro delle violazioni obbligatorio anche se non notificate.
