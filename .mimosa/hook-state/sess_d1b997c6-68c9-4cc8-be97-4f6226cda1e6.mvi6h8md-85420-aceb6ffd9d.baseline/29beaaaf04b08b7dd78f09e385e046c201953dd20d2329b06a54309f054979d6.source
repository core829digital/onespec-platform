import re, glob

WORDS = ("il|la|della|dello|delle|dei|con|per|una|sono|Preventivo|Serramento|Rilievo|Cliente|"
         "Salva|Annulla|Chiudi|Crea|Nuovo|Modifica|Elimina|Genera|Stampa|Firma|Fascicolo|"
         "Collaudo|Posa|Preventivi|Richieste|Fattura|Contratto|Manutenzione|Dettagli|"
         "Indirizzo|Telefono|Nome|Totale|Prezzo|Data|Stato|Azioni|Cerca|Filtra|Tutti|"
         "Nessun|Nessuna|Caricamento|Errore|Obbligatorio|Opzionale|Avanti|Indietro|"
         "Continua|Conferma|Scarica|Copia|Invia|Aggiungi|Rimuovi|Seleziona|Mostra|"
         "Attivo|Anno|Mese|Programma|Documento|Dati|Tipo|Quantita|Note|Indirizzo")
pat = re.compile(r"\b(" + WORDS + r")\b")

files = glob.glob("../src/**/*.tsx", recursive=True)
hits = {}
for f in files:
    try:
        txt = open(f, encoding="utf-8").read()
    except Exception:
        continue
    lines = txt.split("\n")
    n = 0
    for ln in lines:
        s = ln.strip()
        if s.startswith("import ") or s.startswith("//") or s.startswith("*"):
            continue
        if pat.search(ln):
            n += 1
    if n:
        hits[f] = n
print("files with IT literals:", len(hits))
for f, n in sorted(hits.items(), key=lambda x: -x[1])[:35]:
    print(n, f)
print("total lines:", sum(hits.values()))
