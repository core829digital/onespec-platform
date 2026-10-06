# Collegamenti tra le pagine (preventivi · clienti · cantieri · fornitura · fornitori · logistica)

Prima ogni pagina aveva i suoi dati e i collegamenti dipendevano da chi li compilava a mano. Ora ogni cosa si trova, si crea e si aggiorna
**nei due sensi**. Le regole stanno in `convex/lib/crmLink.ts`, `convex/lib/partnerLinks.ts` e `convex/lib/deliveryCore.ts`.

## Preventivo → cliente e cantiere (automatico)
- Salvando un preventivo B2B (anche multi-fornitore, o da rilievo) la piattaforma **trova o crea il cliente**: per e-mail, poi P.IVA, poi telefono
  (anche scritto in modo diverso), poi nome (solo se nulla lo contraddice: due e-mail diverse = due persone diverse).
- Poi **trova o crea il cantiere**: stesso cliente + stesso indirizzo (maiuscole, accenti e punteggiatura non contano). Senza indirizzo non si
  inventa nessun cantiere. Un cliente o un cantiere scelto a mano non viene mai sostituito, solo completato (solo i campi vuoti).
- Il cantiere ricorda il preventivo, e il suo **valore è la somma dei preventivi vivi** (i persi non contano).
- Stato del cliente: preventivo → *prospect*; vinto o firmato → *attivo*. Stato del cantiere: vinto → *confermato*; poi segue la fornitura
  (ordine, produzione, consegna) e **non torna mai indietro** (un cantiere già in posa/collaudo/chiuso resta dov'è).
- Dal widget: il cliente nasce solo quando il montatore prende in carico la richiesta (contattata / preventivo inviato / vinta), mai per una
  richiesta "nuova" e mai quando i contatti sono bloccati dal piano.
- Rilievi e collaudi con nome + indirizzo scritti a mano fanno lo stesso (l'indirizzo del cliente scelto è un valore predefinito, non un nuovo cantiere).
- Chi ha già preventivi: pagina Clienti → **Importa dai preventivi** (idempotente) crea clienti e cantieri mancanti e collega le forniture.
- `autoLink: false` sulla creazione del preventivo spegne tutto (per usi particolari).

## Modifiche che tornano indietro
- Modifichi il **cliente** (nome, e-mail, telefono, indirizzo): lo vedono i preventivi ancora aperti e le forniture non consegnate. I preventivi
  firmati o chiusi restano com'erano (sono documenti).
- Modifichi il **cantiere** (indirizzo) o lo passi a un altro cliente: preventivi aperti e forniture si adeguano.
- Indichi un preventivo su un cantiere (da cantiere o da preventivo): il collegamento è scritto da entrambe le parti.
- **Eliminare un cantiere** non lascia più riferimenti orfani: preventivi, forniture, rilievi, collaudi e dossier restano ma slegati;
  se ha consegne o merce in magazzino l'eliminazione è rifiutata con un messaggio chiaro.

## Fornitori ↔ Logistica ↔ Fornitura
- Un fornitore è **una sola azienda** con tre viste: Fornitura (produce / consegna), Logistica (chi spedisce la merce) e fonti prezzo dei preventivi
  multi-fornitore. Creato in una pagina, compare nelle altre; nome e contatti si aggiornano ovunque. Se la stessa azienda c'è già (P.IVA, e-mail o nome)
  viene collegata, non duplicata. Gli account esistenti si allineano da soli aprendo Fornitura/Logistica.
- Il tetto del piano sui fornitori Logistica vale per quelli creati a mano nella pagina Logistica; quelli che nascono da un fornitore della Fornitura non lo contano.
- **Fornitura "Consegna" ⇄ consegna in Logistica**: arrivando a *Consegna* si apre da sola la consegna del fornitore (il trasportatore indicato, altrimenti la
  fabbrica), con i pezzi del preventivo e il cantiere. "Merce ricevuta" in Logistica chiude la fornitura come consegnata; chiudere la fornitura riceve la
  consegna (magazzino compreso, mai due volte). Tornare indietro con la fornitura ritira la consegna, a meno che la merce sia già uscita dal magazzino.
- Dal calendario della Logistica si vede a quale fornitura, cliente e cantiere appartiene ogni consegna, e se ne può creare una legata a una fornitura.

## Navigazione
- Scheda Cliente e scheda Cantiere: nuove schede **Forniture** (e **Logistica** per il cantiere). La pagina del preventivo mostra cliente e cantiere con link;
  la carta della fornitura rimanda a preventivo, cliente, cantiere e consegna.

## Altro corretto durante la verifica
- La firma del preventivo ora chiude l'accordo come "vinto" (cliente attivo, cantiere confermato, notifica alla squadra): prima saltava questi passaggi.
- La pagina Clienti mostrava stati e tipi sempre in italiano anche nelle altre lingue.
