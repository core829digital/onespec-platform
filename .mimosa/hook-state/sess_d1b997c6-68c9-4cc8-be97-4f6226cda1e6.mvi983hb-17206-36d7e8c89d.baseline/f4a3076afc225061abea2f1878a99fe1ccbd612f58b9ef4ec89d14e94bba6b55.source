"""Microsoft neural Italian voices (free, edge-tts). Each line is synthesised one sentence at a time so the director
controls the pauses (longer after a question, shorter after a statement) and the pace per line; the neural voice
gives questions their rising intonation and statements their falling one. Word timings come straight from the
engine's word-boundary events (exact, no guessing). Writes vo/lNN.wav, timing.json, timing.js.
lines.json: {"voices": {"M": "it-IT-DiegoNeural", "S": "it-IT-IsabellaNeural"}, "lines": [{"who", "say", "show",
"rate": "-4%", "pitch": "+0Hz", "gap": 0.5}]}. Usage: python3 ../tts_edge.py (inside a video dir)."""
import asyncio, json, os, re, subprocess
import certifi
certifi.where = lambda: os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt"  # trust the session proxy CA
import numpy as np, soundfile as sf, edge_tts
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")

SR = 24000
LEAD = 0.35
PAUSE_AFTER = {"?": 0.3, ".": 0.2, "!": 0.2, ":": 0.14}  # plus ~0.15 s natural tail kept by trim()
SPOKEN = {"OneSpec": "Uàn Spèk", "onespec.eu": "uàn spèk punto eu", "2.300": "duemilatrecento", "7016": "settanta sedici",
          "PDF": "pi di effe", "9.200": "novemiladuecento", "4.600": "quattromilaseicento", "24": "ventiquattro", "240": "duecentoquaranta",
          "210": "duecentodieci", "×": "per", "383": "trecentottantatré", "10": "dieci", "14": "quattordici", "30": "trenta", "4": "quattro"}
norm = lambda s: re.sub(r"[^a-z0-9àèéìòùáíóú]", "", s.lower())


async def synth(text, voice, rate, pitch):
    c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary", proxy=PROXY)
    mp3, marks = b"", []
    async for ch in c.stream():
        if ch["type"] == "audio": mp3 += ch["data"]
        elif ch["type"] == "WordBoundary": marks.append((ch["text"], ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7))
    pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", "-", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], input=mp3, capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).astype(np.float64), marks


def trim(x, marks):
    env = np.convolve(np.abs(x), np.ones(240) / 240, mode="same"); idx = np.where(env > 0.004 * env.max())[0]
    a, b = max(0, idx[0] - 240), min(len(x), idx[-1] + int(0.15 * SR))  # keep soft word endings
    return x[a:b], [(w, s - a / SR, e - a / SR) for w, s, e in marks]


async def main():
    CFG = json.load(open("lines.json")); L = CFG["lines"]; V = CFG["voices"]
    out = {"lines": []}; t0 = LEAD
    for i, l in enumerate(L):
        sents = [s.strip() for s in re.findall(r"[^.?!:]+[.?!:]*", l["say"]) if s.strip()]
        chunks, marks, cur = [], [], 0.0
        for k, s in enumerate(sents):
            x, m = await synth(s, V[l["who"]], l.get("rate", "-2%"), l.get("pitch", "+0Hz"))
            x, m = trim(x, m)
            chunks.append(x); marks += [(w, max(0.0, a) + cur, b + cur) for w, a, b in m]; cur += len(x) / SR
            if k < len(sents) - 1:
                p = PAUSE_AFTER.get(s[-1], 0.2); chunks.append(np.zeros(int(p * SR))); cur += p
        a = np.concatenate(chunks); a = a / (np.max(np.abs(a)) + 1e-9) * 0.95
        sf.write(f"vo/l{i:02d}.wav", a, SR)
        # map engine words onto the spoken words of "say"
        spoken = [w for w in l["say"].split() if norm(w)]
        wt, j = [], 0
        for w in spoken:
            target, acc, s0, e0 = norm(w), "", None, None
            while j < len(marks) and len(acc) < len(target):
                acc += norm(marks[j][0]); s0 = marks[j][1] if s0 is None else s0; e0 = marks[j][2]; j += 1
            assert s0 is not None, (i, w, marks)
            wt.append([w, s0, e0])
        disp, j = [], 0
        for tk in l["show"].split():
            core = re.sub(r"^[«]+|[.,:;?!…«»]+$", "", tk)
            n = len(SPOKEN.get(core, core).split()); seg = wt[j:j + n]; j += n
            disp.append([tk, round(t0 + seg[0][1], 3), round(t0 + seg[-1][2], 3)])
        assert j == len(wt), (i, j, len(wt), l["show"])
        dur = len(a) / SR
        env = [float(np.sqrt(np.mean(a[s:s + 960] ** 2))) for s in range(0, len(a), SR // 60)]; mx = max(env)
        out["lines"].append({"who": l["who"], "start": round(t0, 3), "dur": round(dur, 3), "words": disp, "env": [round(v / mx, 3) for v in env]})
        print(i, l["who"], f"{t0:.2f}+{dur:.2f}", " ".join(f"{w}[{s:.2f}]" for w, s, _ in disp))
        t0 += dur + l.get("gap", 0.5)
    out["end"] = round(t0, 3)
    json.dump(out, open("timing.json", "w"), ensure_ascii=False)
    open("timing.js", "w").write("const TIMING = " + json.dumps(out, ensure_ascii=False) + ";\n")
    print("voice ends", out["end"])

asyncio.run(main())
