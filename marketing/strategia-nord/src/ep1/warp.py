"""Re-voice an existing animation: map the NEW voice timeline onto the OLD one (word anchors), so every hard-coded
animation time still lands on its word. Writes timing.js (TIMING in the old timeline, new words; WARP anchors)."""
import difflib, json, math, re
old = json.load(open("timing_old.json"))["lines"]; new = json.load(open("timing_new.json"))
nl = new["lines"]
key = lambda w: re.sub(r"[^\wà-ú]", "", w.lower())
A = []
for o, n in zip(old, nl):
    A += [(n["start"], o["start"]), (n["start"] + n["dur"], o["start"] + o["dur"])]
    ow, nw = [key(w[0]) for w in o["words"]], [key(w[0]) for w in n["words"]]
    for blk in difflib.SequenceMatcher(None, nw, ow).get_matching_blocks():
        for k in range(blk.size):
            A.append((n["words"][blk.a + k][1], o["words"][blk.b + k][1]))
A.sort()
mono = []
for a in A:   # keep a strictly increasing map
    if not mono or (a[0] > mono[-1][0] + 0.02 and a[1] > mono[-1][1] + 0.02): mono.append(a)
mono = [(0.0, 0.0)] + mono
def fwd(t):  # new -> old
    for (a0, b0), (a1, b1) in zip(mono, mono[1:]):
        if t <= a1: return b0 + (t - a0) * (b1 - b0) / (a1 - a0)
    return mono[-1][1] + (t - mono[-1][0])
def inv(t):  # old -> new
    for (a0, b0), (a1, b1) in zip(mono, mono[1:]):
        if t <= b1: return a0 + (t - b0) * (a1 - a0) / (b1 - b0)
    return mono[-1][0] + (t - mono[-1][1])
page = {"lines": []}
for n in nl:
    s, e = fwd(n["start"]), fwd(n["start"] + n["dur"]); d = e - s
    m = max(1, math.ceil(d * 60)); env = n["env"]
    env2 = [env[min(len(env) - 1, int(k / m * len(env)))] for k in range(m)]
    page["lines"].append({"who": n["who"], "start": round(s, 3), "dur": round(d, 3), "env": env2,
                          "words": [[w, round(fwd(a), 3), round(fwd(b), 3)] for w, a, b in n["words"]]})
DUR_NEW = round(inv(40.0), 3)
json.dump(page, open("timing.json", "w"), ensure_ascii=False)
json.dump({"anchors": mono, "dur_new": DUR_NEW}, open("warp.json", "w"))
open("timing.js", "w").write("const TIMING = " + json.dumps(page, ensure_ascii=False) + ";\nconst WARP = " + json.dumps(mono) + ";\n")
print("anchors", len(mono), "DUR_NEW", DUR_NEW)
