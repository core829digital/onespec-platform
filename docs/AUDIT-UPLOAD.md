# Audit dei caricamenti di file (S1)

Cosa è stato controllato: **ogni punto in cui un file entra nella piattaforma**. Per ognuno: chi può caricare, quanto spesso, cosa si verifica
sul file (tipo *vero*, dimensione), cosa succede se è sbagliato, come viene riaperto.

| # | Punto | Chi | Tetto di frequenza | Controllo sul file | Se è sbagliato |
|---|---|---|---|---|---|
| 1 | Foto rilievi (`surveys`) | membro con `surveys.use` | 40 slot/ora/persona | tipo e peso (metadati) **+ lettura dei byte** (PNG/JPEG/WebP/HEIC veri, ≤ 120 Mpx) | file cancellato |
| 2 | Foto collaudi (`inspections`, interno) | `inspections.use` | 40/ora/persona | come sopra | cancellato |
| 3 | Foto collaudo dal posatore (link pubblico con token) | chiunque abbia il token | limite per token+IP e globale (già presente, `http.ts`) | come sopra + collaudo non firmato | cancellato |
| 4 | Documenti passaporto (`passports`) | `passports.use` | 40/ora/persona | PDF **completo e senza script** oppure immagine vera | cancellato |
| 5 | Foto imballaggio consegna (`siteDeliveries`) | `logistics.use`, consegna in preparazione | 40/ora/persona + max file per consegna | immagine vera | cancellato |
| 6 | Logo azienda (`tenants`) | `tenant.settings` | 40/ora/persona | solo PNG/JPEG, ≤ 2 MB, byte verificati | cancellato |
| 7 | Logo configuratore (`branding`) | `branding.manage` | 40/ora/persona | PNG/JPEG/WebP o **SVG semplice**: niente script, handler `on…=`, `javascript:`, DOCTYPE/entità, `foreignObject`, riferimenti esterni | cancellato |
| 8 | **Preventivi finali PDF** (`clientDocuments`, nuovo) | `clients.use` | 40/ora/persona | azione che **legge i byte**: PDF vero, completo, senza JavaScript/Launch/EmbeddedFile/RichMedia/SubmitForm; ≤ 15 MB | cancellato subito, non registrato |
| 9 | **Import lead** (xlsx/csv/docx) | `clients.use` | 20 import/24 h/workspace | letto **sul dispositivo**: tipo dai primi byte (non dal nome), macro e vecchi formati Office rifiutati, zip-bomb fermata a 80 MB, XML con DTD/entità rifiutato, ≤ 10 MB / 20.000 righe; al server arrivano solo righe ricontrollate | nessun file raggiunge il server |
| 10 | Listino CSV (`catalogImport`) | `catalog.manage` | – | testo, ≤ 2 MB (nuovo), righe validate dal server | rifiutato |
| 11 | Ripristino bozza showroom (JSON) | locale | – | ≤ 2 MB (nuovo), `parseBackup` valida la struttura | ignorato |

## Cosa è cambiato in questo audit
* **Tetto di frequenza** sugli slot di caricamento (prima non c'era): `consumeUploadSlot`.
* **Seconda lettura dei byte** dopo ogni allegato (`uploadsGuard.sniff`): il tipo dichiarato dal browser è solo una dichiarazione. Un file che
  non è ciò che dice viene **cancellato** e registrato nel log (`upload.quarantined`).
* **SVG**: i loghi SVG erano accettati senza controllo del contenuto (un SVG può eseguire script se aperto direttamente). Ora passano solo
  disegni semplici.
* **Immagini "bomba"** (miliardi di pixel) rifiutate.
* **Bug trovato dai test**: sostituire un logo già messo in quarantena falliva (cancellazione di un file inesistente): ora tollerato.
* **Bug trovato scrivendo i test dei documenti**: un secondo invio dello stesso file avrebbe cancellato il file del documento reale; ora la
  cancellazione è condizionata a "nessun documento lo usa".

## Rischi residui (onesti)
1. **File orfani**: un file caricato ma mai allegato resta in archivio. Un "spazzino" automatico è stato **volutamente non attivato**: per
   essere sicuro dovrebbe conoscere ogni riferimento a file della piattaforma; un riferimento dimenticato = file di un cliente cancellato.
   Mitigazione attuale: tetto di 40 slot/ora/persona. Da fare quando si introduce un registro unico dei file allegati.
2. **PDF**: i nomi attivi (`/JavaScript` …) dentro *object stream* compressi non sono visibili a una scansione semplice. I PDF si aprono solo nel
   visualizzatore del browser o si scaricano, mai incorporati nella piattaforma.
3. **HEIC/WebP**: verificata l'intestazione, non decodificato il file.
