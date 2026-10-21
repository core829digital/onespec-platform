"""V2 soundtrack: city noise bed until the new windows, then calm open bed."""
import sys; sys.path.insert(0, "..")
from synth import *
C1, C2, C3, C4 = LN[1]["start"] - 0.15, LN[2]["start"] - 0.12, LN[3]["start"] - 0.12, LN[4]["start"] - 0.12
END = DUR - 0.6
tq = at(2, "nuove")
music_bed(END, tense_fn=lambda s: s < tq, arp_fn=lambda s: C3 - 0.5 <= s < C4 - 0.5, sparse_fn=lambda s: s < tq)
# city noise: filtered rumble + horn + tram bell, fading out on the new windows
n = int(tq * SR) + int(1.2 * SR)
rum = lowpass(rng.standard_normal(n), 0.03) * 3.0
rum *= np.minimum(1, np.arange(n) / (0.6 * SR)); rum[-int(1.2 * SR):] *= np.linspace(1, 0, int(1.2 * SR))
adds(rum, 0.0, 0.5)
def horn(t0):
    adds(tone(392, 0.45, "square", 0.01, 0.4, 1.5) * 0.4 + tone(494, 0.45, "square", 0.01, 0.4, 1.5) * 0.3, t0, 0.22, pan=0.4)
for t0 in (0.9, at(1, "clacson") - 0.1, 6.6): horn(t0)
for i in range(3): adds(ding(), at(1, "tram") + i * 0.18, 0.18, pan=-0.4)
adds(impact(), at(0, "silenzio") - 0.05, 0.7)
for c in (C1, C2, C3, C4): adds(whoosh(0.5, False), c - 0.25, 0.3)
for w in ("Traffico", "clacson", "tram"): adds(pop(900), at(1, w) - 0.1, 0.25)
adds(impact(), at(1, "rumore") - 0.05, 0.5)
adds(whoosh(0.7, True), tq - 0.35, 0.35); adds(impact(), tq + 0.3, 0.45); adds(ding(), at(2, "differenza"), 0.25)
adds(impact(), at(3, "Quanto") - 0.05, 0.5)
for w in ("Misure", "vetro", "colore"): adds(pop(1500), at(3, w), 0.3)
adds(riser(0.4), at(3, "prezzo") - 0.4, 0.2); adds(ding(), at(3, "prezzo") + 0.05, 0.3)
adds(impact(), at(4, "In") - 0.05, 0.7)
adds(pop(1000), at(4, "Link") - 0.1, 0.35); adds(ding(), at(4, "Link"), 0.3)
mixdown()
