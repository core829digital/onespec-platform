"""V3 soundtrack: warm, calm bed (no tension: it's a conversation in a kitchen), UI dings on the showroom."""
import sys; sys.path.insert(0, "..")
from synth import *
C1, C6 = LN[1]["start"] - 0.15, LN[6]["start"] - 0.12
END = DUR - 0.6
music_bed(END, tense_fn=lambda s: False, arp_fn=lambda s: s >= C6 - 0.5, sparse_fn=lambda s: s < C6)
adds(impact(), 0.1, 0.45); adds(pop(700), at(0, "Ma") - 0.15, 0.3)
adds(whoosh(0.6, True), C1 + 0.15, 0.35); adds(impact(), C1 + 0.7, 0.3)
for w in ("Scorrevole", "240", "antracite"): adds(pop(1300), at(1, w), 0.25)
adds(riser(0.5), at(2, "9.200") - 0.5, 0.2); adds(ding(), at(2, "9.200") + 0.1, 0.35)
adds(pop(1100), at(2, "prima"), 0.25)
adds(ding(), at(2, "4.600") + 0.1, 0.4)
adds(pop(700), at(3, "E") - 0.1, 0.25)
adds(pop(1500), at(4, "24") - 0.2, 0.3)
adds(whoosh(0.6, True), at(4, "PDF") - 0.15, 0.35); adds(pop(900), at(4, "PDF") + 0.35, 0.2)
adds(ding(), at(5, "Perfetto"), 0.4)
adds(whoosh(0.5, False), C6 - 0.25, 0.3)
adds(whoosh(0.4, True), at(6, "domani") + 0.3, 0.35)
adds(impact(), at(6, "Si") - 0.05, 0.85); adds(clap(), at(6, "Si") - 0.05, 0.35)
adds(pop(1000), at(6, "Link") - 0.1, 0.35); adds(ding(), at(6, "Link"), 0.3)
mixdown()
