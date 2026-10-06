# Performance — cosa è stato fatto e cosa resta

## Fatto (con la misura dove c'è)
- **Motore PDF fuori dalle pagine normali**: era 1,2 MB di JavaScript caricato anche su preventivo, showroom e lista installazioni; ora solo dove si fa un PDF e al clic (verificato nei manifest della build). Test di guardia: `tests/bundle-guard.test.ts`.
- **Liste preventivi/richieste**: niente più immagine della firma né elenco pezzi in ogni riga (le liste erano rimandate a ogni schermata ad ogni modifica).
- **Query più leggere**: guida iniziale (gira su ogni pagina), riepilogo logistica (leggeva tutte le consegne di sempre).
- **Font**: solo il testo base è precaricato su ogni pagina.
- **Scheletri di caricamento** al posto dello spinner nella lista preventivi (le altre liste avevano già lo scheletro di rotta).
- **Layout /app**: una sola lettura lato server (tenant) a ogni caricamento a freddo; le sottoscrizioni dei componenti uguali sono unite da Convex. Nessun duplicato da eliminare.

## Resta (consigliato)
- Spostare la firma del preventivo in file separato (pesa ancora nelle statistiche della dashboard).
- Messaggi di traduzione: ~145 KB di JSON per lingua inviati in ogni pagina; si possono dividere per sezione.
- Misura reale con Lighthouse su produzione (qui non misurabile: serve il sito pubblicato).
