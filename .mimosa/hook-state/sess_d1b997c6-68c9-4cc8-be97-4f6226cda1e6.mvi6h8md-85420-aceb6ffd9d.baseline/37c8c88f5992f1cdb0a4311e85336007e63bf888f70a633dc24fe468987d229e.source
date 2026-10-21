"""Kokoro voice lines -> vo/lNN.wav + per-word timings (timing.json). Usage: python3 ../tts.py (run inside a video dir with lines.json)."""
import json, re, sys, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro("/tmp/kok/kokoro-timed.onnx", "/tmp/kok/voices-v1.0.bin")
CFG = json.load(open("lines.json")); L = CFG["lines"]; SPEED = CFG.get("speed", 1.1)
V = {"M": "im_nicola", "S": "if_sara"}
SPOKEN = {"OneSpec": "Uàn Spèk", "onespec.eu": "uàn spèk punto eu", "2.300": "duemilatrecento", "7016": "settemilasedici",
          "PDF": "pi di effe", "9.200": "novemiladuecento", "4.600": "quattromilaseicento", "383,33": "trecentottantatré euro e trentatré",
          "24": "ventiquattro", "50%": "cinquanta per cento", "240": "duecentoquaranta", "210": "duecentodieci", "×": "per", "383": "trecentottantatré", "10": "dieci"}
out = {"lines": []}; t0 = CFG.get("lead", 0.35)
for i, l in enumerate(L):
    a, sr, sp = k.create_timed(l["say"], voice=V[l["who"]], speed=l.get("speed", SPEED), lang="it", sentence_pause=0.2, clause_pause=0.07)
    sf.write(f"vo/l{i:02d}.wav", a, sr)
    pw, cur = [], []
    for tm in sp:
        if tm.phoneme == " ":
            if cur: pw.append(cur); cur = []
        else: cur.append(tm)
    if cur: pw.append(cur)
    pw = [w for w in pw if re.sub(r"[.,:;?!…—\"“” ]", "", "".join(x.phoneme for x in w))]
    spoken = [w for w in l["say"].replace("...", " ").split() if re.sub(r"[^\wÀ-ú]", "", w)]
    SPLIT = l.get("split", {})
    merged, j = [], 0
    for w in spoken:
        n = SPLIT.get(re.sub(r"[^\wÀ-ú]", "", w).lower(), 1)
        merged.append([x for p in pw[j:j + n] for x in p]); j += n
    assert j == len(pw), (i, j, len(pw), ["".join(x.phoneme for x in w) for w in pw], spoken)
    wt = []
    for w, ph in zip(spoken, merged):
        voiced = [x for x in ph if re.sub(r"[ˈˌ.,:;?!…]", "", x.phoneme)]
        wt.append([w, voiced[0].start, voiced[-1].end])
    disp, j = [], 0
    for tk in l["show"].split():
        core = re.sub(r"[.,:;?!…]+$", "", tk)
        n = len(SPOKEN.get(core, core).split())
        seg = wt[j:j + n]; j += n
        disp.append([tk, round(t0 + seg[0][1], 3), round(t0 + seg[-1][2], 3)])
    assert j == len(wt), (i, j, len(wt), l["show"])
    dur = len(a) / sr
    env = [float(np.sqrt(np.mean(a[s:s + 960] ** 2))) for s in range(0, len(a), sr // 60)]  # 60 per second
    mx = max(env); env = [round(e / mx, 3) for e in env]
    out["lines"].append({"who": l["who"], "start": round(t0, 3), "dur": round(dur, 3), "words": disp, "env": env})
    print(i, l["who"], f"{t0:.2f}+{dur:.2f}", " ".join(f"{w}[{a_:.2f}]" for w, a_, b in disp))
    t0 += dur + l.get("gap", 0.25)
out["end"] = round(t0, 3)
json.dump(out, open("timing.json", "w"), ensure_ascii=False)
open("timing.js", "w").write("const TIMING = " + json.dumps(out, ensure_ascii=False) + ";\n")
print("voice ends", round(t0, 2))
