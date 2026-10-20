"""Pillola soundtrack (no voice): tense bed, hits on the slams, open bed on the call to comment."""
import sys; sys.path.insert(0, "..")
from synth import *
C1, C2, C3 = LN[1]["start"] - 0.15, LN[2]["start"] - 0.15, LN[3]["start"] - 0.15
END = DUR - 0.4
music_bed(END, tense_fn=lambda s: s < C3 - 0.5, arp_fn=lambda s: s >= C3 - 0.5)
s0 = at(0, "a"); adds(impact(), s0, 0.9); adds(clap(), s0, 0.4)
for c in (C1, C2, C3): adds(whoosh(0.5, False), c - 0.25, 0.32)
adds(pop(1100), at(1, "Due") - 0.1, 0.28); adds(pop(1300), at(1, "Un'ora") - 0.1, 0.28)
adds(impact(), at(1, "tre"), 0.7); adds(clap(), at(1, "tre"), 0.35)
for i in range(10): adds(pop(600 + i * 70), at(2, "mese") + i * (at(2, "trenta") - at(2, "mese")) / 10, 0.06)
adds(impact(), at(2, "trenta"), 0.9); adds(clap(), at(2, "trenta"), 0.4)
for i in range(4): adds(pop(900 + i * 120), at(2, "giornate") + i * 0.12, 0.18)
adds(impact(), at(3, "quanti") - 0.1, 0.7); adds(ding(), at(3, "Scrivilo"), 0.3)
adds(riser(0.6), at(3, "commenti") - 0.4, 0.2); adds(ding(), at(3, "commenti") + 0.25, 0.25)
mixdown()
