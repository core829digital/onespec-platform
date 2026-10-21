"""EP2 soundtrack: tense bed on the problem, open bed from the snippet on; hits on the picture."""
import sys; sys.path.insert(0, "..")
from synth import *
C1, C3, C4 = LN[1]["start"] - 0.15, LN[3]["start"] - 0.12, LN[4]["start"] - 0.12
END = DUR - 0.6
music_bed(END, tense_fn=lambda s: s < LN[2]["start"] - 0.5, arp_fn=lambda s: s >= LN[2]["start"] - 0.5)
adds(impact(), at(0, "Hai") - 0.05, 0.8); adds(clap(), at(0, "Hai") - 0.05, 0.35)
r = at(0, "chiamano") - 0.2
for i in range(4): adds(pop(700 + i * 120), r + i * 0.28, 0.3)
for i in range(6): adds(tone(880 if i % 2 else 660, 0.12, "square", 0.002, 0.1) * 0.4, r + 0.05 + i * 0.16, 0.08)   # ringing
for c in (C1, C3, C4): adds(whoosh(0.5, False), c - 0.25, 0.32)
adds(impact(), at(1, "prezzo"), 0.7); adds(clap(), at(1, "prezzo"), 0.35)
ca = at(2, "basta") - 0.05
for i in range(20): adds(hat(), ca + i * (at(2, "copi") - 0.15 - ca) / 20, 0.07, pan=-0.2)   # typing
adds(pop(1500), at(2, "copi"), 0.35)
adds(whoosh(0.5, True), at(2, "incolli") - 0.15, 0.35); adds(impact(), at(2, "incolli") + 0.25, 0.4)
for i in range(5): adds(pop(900 + i * 140), at(2, "incolli") + 0.25 + i * 0.08, 0.16)
adds(ding(), at(2, "online"), 0.35)
adds(pop(1300), at(3, "colore"), 0.28); adds(pop(1450), at(3, "vetro"), 0.28)
adds(riser(0.5), at(3, "prezzo") - 0.4, 0.22); adds(ding(), at(3, "prezzo") + 0.2, 0.25)
adds(whoosh(0.5, True), at(3, "richiesta"), 0.3)
for i in range(4): adds(pop(1500 + i * 100), at(3, "dati") - 0.3 + i * 0.12, 0.16)
for i in range(4): adds(pop(1000 + i * 150), at(4, "colori") + i * 0.22, 0.18)
adds(pop(1600), at(4, "logo"), 0.3)
adds(riser(0.7), at(4, "Provalo") - 0.7, 0.3); adds(impact(), at(4, "Provalo") - 0.05, 0.7)
adds(pop(1000), at(4, "link") - 0.1, 0.35); adds(ding(), at(4, "link"), 0.3)
mixdown()
