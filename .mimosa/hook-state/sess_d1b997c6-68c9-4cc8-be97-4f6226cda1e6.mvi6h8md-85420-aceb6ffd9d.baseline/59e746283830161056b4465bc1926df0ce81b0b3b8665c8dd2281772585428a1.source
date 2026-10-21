"""V1 soundtrack: tense bed until the solution, open bed after; hits on the picture."""
import sys; sys.path.insert(0, "..")
from synth import *
C1, C2, C3, C4 = LN[1]["start"] - 0.15, LN[2]["start"] - 0.1, LN[4]["start"] - 0.12, LN[5]["start"] - 0.12
END = DUR - 0.6
music_bed(END, tense_fn=lambda s: s < C3 - 0.5, arp_fn=lambda s: C3 - 0.5 <= s < C4 - 0.5, sparse_fn=lambda s: C2 <= s < C3)
s = at(0, "2.300")
adds(impact(), s, 0.9); adds(clap(), s, 0.4)
for i in range(10): adds(pop(600 + i * 90), 0.3 + i * 0.05, 0.06)            # counter ticks
adds(whoosh(0.7, True), at(0, "buttati") - 0.1, 0.4, pan=0.3)                  # bills thrown
adds(pop(900), at(0, "colore"), 0.22); adds(whoosh(0.4, True), at(0, "colore") + 0.2, 0.2)
adds(impact(), at(0, "sbagliato") + 0.05, 0.45); adds(tone(140, 0.35, "square", 0.002, 0.3) * 0.5, at(0, "sbagliato") + 0.05, 0.25)
for c in (C1, C2, C3, C4): adds(whoosh(0.5, False), c - 0.25, 0.32)
adds(pop(1100), at(1, "RAL") - 0.2, 0.25); adds(pop(1300), at(1, "bianco") - 0.15, 0.25)
oa = at(1, "Ma") - 0.15
for i in range(22): adds(hat(), oa + 0.25 + i * (at(1, "tutti") - oa - 0.15) / 22, 0.07, pan=-0.2)   # typing
adds(impact(), at(1, "bianchi") - 0.05, 0.75); adds(clap(), at(1, "bianchi") - 0.05, 0.45)          # stamp
adds(riser(0.6), at(2, "Risultato") - 0.6, 0.25); adds(impact(), at(2, "Risultato") - 0.05, 0.5)
adds(impact(), at(3, "2.300") - 0.05, 0.85)
adds(whoosh(0.6, True), at(3, "euro") - 0.2, 0.3)
for i in range(3): adds(pop(800 + i * 150), at(3, "euro") + 0.2 + i * 0.12, 0.14)
adds(impact(), at(3, "paghi") - 0.05, 0.7); adds(clap(), at(3, "paghi") - 0.05, 0.4)
adds(riser(0.9), C3 - 0.9, 0.3); adds(ding(), C3 + 0.1, 0.25)
adds(whoosh(0.6, True), C3 + 0.1, 0.3)
for w in ("RAL", "bianco"): adds(pop(1500), at(4, w) + 0.0, 0.3)
adds(pop(1200), at(4, "e", 0) + 0.02, 0.3); adds(pop(1700), at(4, "e", 0) + 0.12, 0.2)               # toggle
adds(whoosh(0.4, True), at(4, "disegno") - 0.35, 0.18)
adds(ding(), at(4, "prezzo") + 0.05, 0.22)
adds(whoosh(0.6, True), at(4, "PDF") - 0.15, 0.35); adds(pop(900), at(4, "PDF") + 0.4, 0.2)
adds(ding(), at(4, "automatico") + 0.05, 0.35); adds(impact(), at(4, "automatico") + 0.05, 0.35)
adds(impact(), at(5, "Basta") - 0.05, 0.95); adds(clap(), at(5, "Basta") - 0.05, 0.4)
adds(whoosh(0.4, True), at(5, "Excel") + 0.25, 0.3)
adds(riser(0.5), at(5, "Provalo") - 0.8, 0.25); adds(impact(), at(5, "Provalo") - 0.35, 0.6)
adds(pop(1000), at(5, "link") - 0.1, 0.35); adds(ding(), at(5, "link"), 0.3)
mixdown()
