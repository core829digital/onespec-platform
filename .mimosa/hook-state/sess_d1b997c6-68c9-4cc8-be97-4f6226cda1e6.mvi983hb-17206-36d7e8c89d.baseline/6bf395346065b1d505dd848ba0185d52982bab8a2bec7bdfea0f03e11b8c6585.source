"""Original soundtrack for the reel, synthesised from scratch (no samples, no licences): 120 BPM electronic bed + sound design hits
placed on the visual timeline (slams, whooshes, bubble pops, notification, stamp, CTA)."""
import numpy as np
import wave

SR = 44100
import json as _j
_W = _j.load(open("warp.json")); _A = _W["anchors"]
DUR = _W["dur_new"]
N = int(SR * DUR)
t = np.arange(N) / SR
out = np.zeros((N, 2))
rng = np.random.default_rng(829)
BEAT = 0.5  # 120 BPM


def inv(t):  # old (animation) time -> new (voice) time
    for (a0, b0), (a1, b1) in zip(_A, _A[1:]):
        if t <= b1: return a0 + (t - b0) * (a1 - a0) / (b1 - b0)
    return _A[-1][0] + (t - _A[-1][1])


def add(sig, start, gain=1.0, pan=0.0):
    if out is sfx: start = inv(start)
    i = int(start * SR)
    if i >= N:
        return
    n = min(len(sig), N - i)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:i + n, 0] += sig[:n] * gain * l * 1.414
    out[i:i + n, 1] += sig[:n] * gain * r * 1.414


def env(n, a=0.005, d=0.2, curve=4.0):
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, x - a) / d)
    return e


def lowpass(x, k):
    # one-pole low-pass; k in (0,1], smaller = darker
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += k * (x[i] - acc)
        y[i] = acc
    return y


def kick():
    n = int(0.45 * SR)
    x = np.arange(n) / SR
    f = 45 + 110 * np.exp(-x * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.002, 0.28, 3.2) + 0.15 * rng.standard_normal(n) * env(n, 0.001, 0.01, 8)


def hat(open_=False):
    n = int((0.18 if open_ else 0.06) * SR)
    s = rng.standard_normal(n)
    s = s - lowpass(s, 0.35)  # high-pass
    return s * env(n, 0.001, 0.12 if open_ else 0.03, 5)


def clap():
    n = int(0.25 * SR)
    s = rng.standard_normal(n)
    s = lowpass(s, 0.5) - lowpass(s, 0.08)
    e = env(n, 0.001, 0.1, 4)
    for d in (0.01, 0.02):
        e += np.roll(env(n, 0.001, 0.02, 6), int(d * SR)) * 0.6
    return s * e


def tone(freq, dur, kind="sine", a=0.01, d=None, curve=3.0):
    n = int(dur * SR)
    x = np.arange(n) / SR
    if kind == "saw":
        w = sum(np.sin(2 * np.pi * freq * k * x) / k for k in range(1, 9))
    elif kind == "square":
        w = sum(np.sin(2 * np.pi * freq * k * x) / k for k in range(1, 10, 2))
    else:
        w = np.sin(2 * np.pi * freq * x)
    return w * env(n, a, d or dur, curve)


def whoosh(dur=0.6, up=True):
    n = int(dur * SR)
    s = rng.standard_normal(n)
    x = np.linspace(0, 1, n)
    k = 0.02 + 0.5 * (x if up else 1 - x) ** 2
    y = np.zeros(n)
    acc = 0.0
    for i in range(n):
        acc += k[i] * (s[i] - acc)
        y[i] = acc
    shape = np.sin(np.pi * x) ** 1.5
    return y * shape * 2.2


def impact():
    n = int(1.6 * SR)
    x = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (38 + 60 * np.exp(-x * 9)) * x) * env(n, 0.002, 0.9, 2.6)
    noise = lowpass(rng.standard_normal(n), 0.25) * env(n, 0.001, 0.25, 5)
    return sub * 1.0 + noise * 0.8


def riser(dur):
    n = int(dur * SR)
    x = np.linspace(0, 1, n)
    f = 200 + 1400 * x ** 2
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * 0.4 + whoosh(dur, True)[:n] * 0.6) * x ** 2


def pop(f0=880):
    n = int(0.12 * SR)
    x = np.arange(n) / SR
    f = f0 * (1 + 0.6 * np.exp(-x * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.07, 5)


def ding():
    return tone(1318.5, 0.9, a=0.002, d=0.5) * 0.6 + tone(1975.5, 0.9, a=0.002, d=0.35) * 0.35 + tone(2637, 0.9, a=0.002, d=0.2) * 0.15



import json
T = json.load(open("timing.json")); LN = T["lines"]
def at(li, w, nth=0):
    hits = [x for x in LN[li]["words"] if x[0].lower().startswith(w.lower())]
    return hits[nth][1]
music = np.zeros((N, 2)); sfx = out
def addm(sig, start, gain=1.0, pan=0.0):
    global out
    out = music; add(sig, start, gain, pan); out = sfx
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
prob = [(57, [57, 60, 64]), (53, [53, 57, 60]), (57, [57, 60, 64]), (52, [52, 56, 59])]
sol = [(48, [48, 52, 55]), (55, [55, 59, 62]), (57, [57, 60, 64]), (53, [53, 57, 60])]
END = DUR - 0.7
xx = np.arange(int(2.0 * SR)) / SR; pads = {}; bassn = {}
def pad_for(ch):
    k = tuple(ch)
    if k not in pads:
        p = sum(tone(mid(m), 2.0, "saw", 0.4, 2.0, 0.6) for m in ch)
        pads[k] = lowpass(p, 0.04) * (0.5 + 0.5 * np.sin(np.pi * xx / 2.0))
    return pads[k]
for bar in range(int(END / 2) + 1):
    st = bar * 2.0
    if st >= END: break
    root, ch = (prob if st < 6.0 or 28.0 <= st < 31.0 else sol)[bar % 4]
    for e8 in range(8):
        if root not in bassn: bassn[root] = lowpass(tone(mid(root - 24), 0.22, "saw", 0.003, 0.18, 3), 0.08)
        if 28.6 <= st + e8 * 0.25 < 31.3 and e8 % 2: continue
        addm(bassn[root], st + e8 * 0.25, 0.32)
    pd = pad_for(ch); addm(pd, st, 0.11, -0.3); addm(pd, st + 0.01, 0.11, 0.3)
    if 6.0 <= st < 28.0:
        for i in range(8):
            m = ch[i % 3] + 12 * (1 + (i // 3) % 2)
            addm(tone(mid(m), 0.22, "square", 0.002, 0.12, 4) * 0.5, st + i * 0.25, 0.04, pan=(-0.5 if i % 2 else 0.5))
k = kick(); h_ = hat(); ho = hat(True); c = clap()
bt = 0.0
while bt < END:
    addm(k, bt, 0.8 if bt >= 0.5 else 0.5)
    addm(h_, bt + 0.25, 0.15, pan=0.25)
    if int(bt / BEAT) % 2 == 1: addm(c, bt, 0.28)
    if 6.0 <= bt < 28.5 and int(bt / BEAT) % 4 == 3: addm(ho, bt + 0.25, 0.13, pan=-0.25)
    bt += BEAT

# ---------------- sound design on the picture ----------------
add(impact(), 0.06, 0.6)                                   # hook slam
for i in range(26):                                        # spreadsheet typing
    add(hat(), 0.4 + i * 0.16, 0.06, pan=0.3)
add(whoosh(0.45, True), 1.2, 0.3, pan=-0.4)                # quote card in
add(impact(), at(0, "a") + 0.06, 0.7); add(clap(), at(0, "a") + 0.06, 0.5)   # stamp A VUOTO
add(tone(880, 0.25, "sine", 0.002, 0.2) * 0.5, 3.0, 0.2)   # clock
add(pop(500), at(0, "cliente"), 0.25)
add(whoosh(0.8, False), at(0, "sparito"), 0.35, pan=0.5)   # disintegration
for cut in [5.95, 12.7, 20.25, 28.6, 31.35]:
    add(whoosh(0.5, False), cut - 0.25, 0.32)
add(pop(1100), at(1, "configuratore"), 0.2)
ca = at(1, "nel") - 0.25
for i in range(18): add(hat(), ca + 0.15 + i * (at(1, "copi") - 0.25 - ca) / 18, 0.07, pan=-0.2)   # typing code
add(pop(1500), at(1, "copi") + 0.08, 0.35)                 # click Copia
add(whoosh(0.5, True), at(1, "codice") + 0.05, 0.35)       # snippet flies
add(impact(), at(1, "codice") + 0.42, 0.35)                # paste
for i in range(5): add(pop(900 + i * 140), at(1, "codice") + 0.42 + i * 0.08, 0.16)
add(ding(), at(1, "online"), 0.35)                         # online
add(pop(800), at(2, "cliente"), 0.2)
add(whoosh(0.5, True), at(3, "misure"), 0.18)
add(pop(1300), at(3, "colori") + 0.1, 0.25); add(pop(1450), at(3, "vetri") + 0.1, 0.25)
add(riser(0.5), at(3, "prezzo") - 0.4, 0.25); add(ding(), at(3, "prezzo") + 0.3, 0.25)
add(pop(1200), at(3, "Chi") + 0.12, 0.3); add(whoosh(0.6, True), at(3, "Chi") + 0.15, 0.3, pan=0.4)
add(pop(1600), at(3, "conosce"), 0.22)
for i in range(5): add(pop(700 + i * 120), 20.42 + i * 0.09, 0.08)          # cards drop
for i in range(4): add(pop(1500 + i * 100), at(5, "tutti") - 0.1 + i * 0.07, 0.14)
add(tone(140, 0.4, "square", 0.002, 0.3) * 0.5, at(5, "false"), 0.3)    # buzz
add(whoosh(0.5, False), at(5, "filtrate") + 0.05, 0.3, pan=0.7)
add(whoosh(0.7, True), at(5, "ordini") + 0.05, 0.25, pan=-0.3)         # sort
add(pop(1000), at(5, "Decidi") + 0.32, 0.35); add(ding(), at(5, "Decidi") + 0.4, 0.2)
add(impact(), at(6, "Basta"), 1.0); add(clap(), at(6, "Basta"), 0.4)   # BASTA
add(impact(), at(6, "a") - 0.02, 0.6)
add(whoosh(0.5, True), at(6, "a") + 0.45, 0.3)                          # strike
add(riser(1.0), 30.4, 0.35); add(impact(), 31.35, 0.8)                  # cube
add(pop(1000), 37.2, 0.35); add(ding(), 37.25, 0.3)                     # CTA tap

# ---------------- voice + ducking ----------------
voice = np.zeros(N)
import wave as W
def load(p):
    w = W.open(p); sr = w.getframerate(); sw = w.getsampwidth()
    raw = w.readframes(w.getnframes())
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768 if sw == 2 else None
    n2 = int(len(x) * SR / sr)
    return np.interp(np.linspace(0, len(x) - 1, n2), np.arange(len(x)), x)
for i, l in enumerate(_j.load(open("timing_new.json"))["lines"]):
    v = load(f"vo/l{i:02d}.wav"); v = v / (np.max(np.abs(v)) + 1e-9)
    a = int(l["start"] * SR); n = min(len(v), N - a); voice[a:a + n] += v[:n]
envv = np.convolve(np.abs(voice), np.ones(int(0.12 * SR)) / int(0.12 * SR), mode="same")
envv = np.minimum(1, envv / 0.05)
env2 = np.convolve(envv, np.ones(int(0.32 * SR)) / int(0.32 * SR), mode="same")
music *= (1 - 0.78 * np.clip(env2, 0, 1))[:, None]
sfx *= (1 - 0.35 * np.clip(env2, 0, 1))[:, None]
hp = voice - lowpass(voice, 0.25); voice = voice + 0.35 * hp
voice = np.tanh(voice * 1.4) / np.tanh(1.4)
mix = music * 0.9 + sfx * 0.85
mix /= np.max(np.abs(mix)) / 0.55
mix += voice[:, None] * 0.72
fade = np.ones(N); fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR)); mix *= fade[:, None]
mix = np.tanh(mix * 1.15) / np.tanh(1.15); mix /= np.max(np.abs(mix)) / 0.9
pcm = (mix * 32767).astype(np.int16)
with wave.open("mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok")
