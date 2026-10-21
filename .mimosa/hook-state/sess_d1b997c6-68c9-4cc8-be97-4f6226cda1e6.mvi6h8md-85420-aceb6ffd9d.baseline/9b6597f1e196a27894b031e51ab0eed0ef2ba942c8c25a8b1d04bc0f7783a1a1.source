"""Short soundtrack: tense hook, open solution, CTA hit."""
import sys; sys.path.insert(0, "..")
from synth import *
C1, C2 = LN[1]["start"] - 0.12, LN[2]["start"] - 0.1
END = DUR - 0.5
music_bed(END, tense_fn=lambda s: s < C1 - 0.5, arp_fn=lambda s: C1 - 0.5 <= s < C2 - 0.5)
s = at(0, "2.300"); adds(impact(), s, 0.9); adds(clap(), s, 0.4)
for i in range(8): adds(pop(600 + i * 90), 0.15 + i * 0.04, 0.06)
adds(pop(900), at(0, "bicolore") - 0.15, 0.22); adds(pop(1100), at(0, "bicolore") + 0.15, 0.22)
adds(impact(), at(0, "tutto") - 0.05, 0.7); adds(clap(), at(0, "tutto") - 0.05, 0.4)
for c in (C1, C2): adds(whoosh(0.5, False), c - 0.25, 0.32)
adds(ding(), C1 + 0.1, 0.25)
adds(pop(1500), at(1, "RAL"), 0.3); adds(pop(1200), at(1, "dentro") - 0.28, 0.3); adds(pop(1500), at(1, "bianco"), 0.3)
adds(ding(), at(1, "prezzo") + 0.05, 0.22)
adds(whoosh(0.5, True), at(1, "PDF") - 0.15, 0.3)
adds(ding(), at(1, "automatico") + 0.05, 0.35); adds(impact(), at(1, "automatico") + 0.05, 0.35)
adds(impact(), at(2, "Basta") - 0.05, 0.95); adds(clap(), at(2, "Basta") - 0.05, 0.4)
adds(pop(1000), at(2, "Link") - 0.1, 0.35); adds(ding(), at(2, "Link"), 0.3)
mixdown()
