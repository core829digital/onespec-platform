# Incidente · riattivazione piano (billing:createCheckoutSession) · 17/10/2026 · v1.26.3

**Sintomo:** un cliente con piano terminato che prova a riabbonarsi vede «Server Error» (Request ID 43d30bf5ca4df899, 4c5d89c0be7180fb).

**Causa:** senza i log di produzione di Convex la causa esatta non è confermabile; il codice falliva su tutti questi casi (tutti del solo cliente che ritorna):
1. il cliente Stripe salvato non esiste più (cancellato dalla Dashboard, oppure id creato in modalità test e rimasto dopo il passaggio a live) → Stripe rifiuta la sessione;
2. un'opzione della pagina di pagamento (nome azienda, partita IVA, telefono, termini) rifiutata per un cliente esistente → nessun secondo tentativo;
3. stato locale ancora «attivo» per un webhook perso → blocco «già abbonato» anche se su Stripe l'abbonamento è chiuso;
4. dopo il pagamento: un evento tardivo del VECCHIO abbonamento («deleted») poteva sospendere il NUOVO piano; un pagamento con cliente nuovo non veniva collegato al tenant; la sincronizzazione rileggeva il vecchio abbonamento chiuso.

**Correzione (convex/billing.ts):** verifica del cliente prima del pagamento (se non esiste più si riparte con un cliente nuovo e il vecchio id viene scollegato); secondo tentativo automatico senza le opzioni facoltative (prezzo, cliente, indirizzo e IVA automatica restano sempre); verifica su Stripe prima del blocco «già abbonato» (nel dubbio il blocco resta: nessun doppio addebito); eventi del vecchio abbonamento ignorati quando non è più quello corrente; ricollegamento sicuro al nuovo cliente solo dal proprio checkout e solo se il tenant non ha un piano attivo; sincronizzazione che cerca l'abbonamento vivo più recente; portale e verifica notturna robusti agli id rimasti della modalità test; PostHog non può più far fallire un pagamento; errori sempre codificati (`BILLING_CHECKOUT_FAILED`, `BILLING_PROVIDER_UNAVAILABLE`) con messaggio chiaro in 6 lingue e log `[checkout] …` / `[stripe] … refused: status code param message` + avviso a OPS_ALERT_EMAIL.

**Test:** `tests/convex/billing-resubscribe.test.ts` (15 casi, Stripe simulato). Suite completa verde.

**Se si ripresenta:** Convex → Logs → cercare `[checkout]` o `[stripe]`: la riga riporta il codice e il parametro esatti rifiutati da Stripe.
