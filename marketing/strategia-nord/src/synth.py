"""Original soundtrack for the reel, synthesised from scratch (no samples, no licences): 120 BPM electronic bed + sound design hits
placed on the visual timeline (slams, whooshes, bubble pops, notification, stamp, CTA)."""
import numpy as np
import wave

SR = 44100
import json, sys
T = json.load(open('timing.json')); LN = T['lines']
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else T['end'] + 1.6
N = int(SR * DUR)
t = np.arange(N) / SR
out = np.zeros((N, 2))
rng = np.random.default_rng(829)
BEAT = 0.5  # 120 BPM


def add(sig, start, gain=1.0, pan=0.0):
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




def at(li, w, nth=0):
    hits = [x for x in LN[li]["words"] if x[0].lower().startswith(w.lower())]
    return hits[nth][1]
music = np.zeros((N, 2)); sfx = out
def addm(sig, start, gain=1.0, pan=0.0):
    global out
    out = music; add(sig, start, gain, pan); out = sfx
def adds(sig, start, gain=1.0, pan=0.0):
    global out
    out = sfx; add(sig, start, gain, pan)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
xx = np.arange(int(2.0 * SR)) / SR; _pads = {}; _bass = {}
def pad_for(ch):
    k = tuple(ch)
    if k not in _pads:
        p = sum(tone(mid(m), 2.0, "saw", 0.4, 2.0, 0.6) for m in ch)
        _pads[k] = lowpass(p, 0.04) * (0.5 + 0.5 * np.sin(np.pi * xx / 2.0))
    return _pads[k]
TENSE = [(57, [57, 60, 64]), (53, [53, 57, 60]), (57, [57, 60, 64]), (52, [52, 56, 59])]
OPEN = [(48, [48, 52, 55]), (55, [55, 59, 62]), (57, [57, 60, 64]), (53, [53, 57, 60])]
def music_bed(end, tense_fn, arp_fn, sparse_fn=lambda s: False):
    for bar in range(int(end / 2) + 1):
        st = bar * 2.0
        if st >= end: break
        root, ch = (TENSE if tense_fn(st) else OPEN)[bar % 4]
        for e8 in range(8):
            if root not in _bass: _bass[root] = lowpass(tone(mid(root - 24), 0.22, "saw", 0.003, 0.18, 3), 0.08)
            if sparse_fn(st + e8 * 0.25) and e8 % 2: continue
            addm(_bass[root], st + e8 * 0.25, 0.32)
        pd = pad_for(ch); addm(pd, st, 0.11, -0.3); addm(pd, st + 0.01, 0.11, 0.3)
        if arp_fn(st):
            for i in range(8):
                m = ch[i % 3] + 12 * (1 + (i // 3) % 2)
                addm(tone(mid(m), 0.22, "square", 0.002, 0.12, 4) * 0.5, st + i * 0.25, 0.04, pan=(-0.5 if i % 2 else 0.5))
    k = kick(); h_ = hat(); ho = hat(True); c = clap(); bt = 0.0
    while bt < end:
        addm(k, bt, 0.8 if bt >= 0.5 else 0.5)
        addm(h_, bt + 0.25, 0.15, pan=0.25)
        if int(bt / BEAT) % 2 == 1: addm(c, bt, 0.28)
        if arp_fn(bt) and int(bt / BEAT) % 4 == 3: addm(ho, bt + 0.25, 0.13, pan=-0.25)
        bt += BEAT
import wave as W
def load(p):
    w = W.open(p); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    n2 = int(len(x) * SR / sr)
    return np.interp(np.linspace(0, len(x) - 1, n2), np.arange(len(x)), x)
def mixdown(path="mix.wav"):
    global music, sfx
    voice = np.zeros(N)
    for i, l in enumerate(LN):
        v = load(f"vo/l{i:02d}.wav"); v = v / (np.max(np.abs(v)) + 1e-9)
        a = int(l["start"] * SR); n = min(len(v), N - a); voice[a:a + n] += v[:n]
    envv = np.convolve(np.abs(voice), np.ones(int(0.12 * SR)) / int(0.12 * SR), mode="same")
    envv = np.minimum(1, envv / 0.05)
    env2 = np.convolve(envv, np.ones(int(0.32 * SR)) / int(0.32 * SR), mode="same")
    music = music * (1 - 0.78 * np.clip(env2, 0, 1))[:, None]
    sfx = sfx * (1 - 0.35 * np.clip(env2, 0, 1))[:, None]
    hp = voice - lowpass(voice, 0.25); voice = voice + 0.35 * hp
    voice = np.tanh(voice * 1.4) / np.tanh(1.4)
    mix = music * 0.9 + sfx * 0.85
    mix /= np.max(np.abs(mix)) / 0.55
    mix += voice[:, None] * 0.72
    fade = np.ones(N); fade[-int(1.0 * SR):] = np.linspace(1, 0, int(1.0 * SR)); mix *= fade[:, None]
    mix = np.tanh(mix * 1.15) / np.tanh(1.15); mix /= np.max(np.abs(mix)) / 0.9
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print("mix ok", DUR)
