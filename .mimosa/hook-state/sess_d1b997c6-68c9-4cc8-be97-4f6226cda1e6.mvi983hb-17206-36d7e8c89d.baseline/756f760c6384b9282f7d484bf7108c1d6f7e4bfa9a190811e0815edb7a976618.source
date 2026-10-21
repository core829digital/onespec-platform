"""Original score + UI clicks for the 60 s film, synthesised with numpy (no third-party music).
120 BPM, 30 bars.  Masters to -14 LUFS / <= -1.5 dBTP (two-pass loudnorm) and muxes as AAC.
Usage: python3 tools/film_sound.py   (expects sounds.json and film-silent.mp4 next to film.html)"""
import json, subprocess, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = Path(__file__).resolve().parent.parent
SR, DUR, BPM = 48000, 60.0, 120
BEAT = 60 / BPM
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(829)
L = np.zeros(N); R = np.zeros(N)

def lp(x, hz, order=2): return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)
def hp(x, hz, order=2): return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)
def env_ar(n, a, r):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def add(sig, start, gain=1.0, pan=0.0):
    i0 = int(start * SR); n = min(len(sig), N - i0)
    if n <= 0: return
    L[i0:i0 + n] += sig[:n] * gain * np.sqrt(0.5 * (1 - pan)); R[i0:i0 + n] += sig[:n] * gain * np.sqrt(0.5 * (1 + pan))
def hz(m): return 440 * 2 ** ((m - 69) / 12)

# section intensity automation (0..1)
def auto(points):
    xs, ys = zip(*points); return np.interp(t, xs, ys)

# chord progression, 2 bars (4 s) each: Am9 · Fmaj7 · C(add9)/E · G6sus
CHORDS = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [52, 55, 60, 62, 67], [55, 59, 62, 64, 69]]
BASS = [45, 41, 40, 43]
chord_at = lambda s: int(s // 4) % 4

# --- pad: detuned saws, low-passed, slow swell
pad = np.zeros(N)
for k in range(int(DUR // 4) + 1):
    s0 = k * 4.0; n = int(4.6 * SR)
    tt = np.arange(n) / SR
    v = np.zeros(n)
    for m in CHORDS[k % 4]:
        for det in (-0.07, 0.0, 0.06):
            f = hz(m) * 2 ** (det / 12)
            v += 2 * ((tt * f + rng.random()) % 1) - 1
    v = lp(v, 1400, 4) * env_ar(n, 1.2, 1.4)
    i0 = int(s0 * SR); m_ = min(n, N - i0)
    if m_ > 0: pad[i0:i0 + m_] += v[:m_]
pad /= np.abs(pad).max()
pad_gain = auto([(0, 0), (1.5, 0.55), (6, 0.6), (12, 0.45), (47, 0.45), (53.5, 0.7), (54.3, 0.9), (58, 0.5), (60, 0)])
L += pad * pad_gain * 0.22 * 1.05; R += pad * pad_gain * 0.22 * 0.95

# --- sub bass on every beat (12 s → 54 s)
for b in range(int(12 / BEAT), int(54 / BEAT)):
    s0 = b * BEAT; n = int(0.46 * SR); tt = np.arange(n) / SR
    f = hz(BASS[chord_at(s0)] - 12)
    v = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 5.0) * env_ar(n, 0.006, 0.05)
    add(v, s0, 0.30)

# --- soft kick: half-time 12–47 s, four-on-the-floor 47–54 s, impact at 54.3
def kick(gain):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 48 + 70 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 9) * gain
for b in range(int(12 / BEAT), int(54 / BEAT)):
    s0 = b * BEAT
    if s0 < 47 and b % 2: continue
    add(kick(1.0), s0, 0.42 if s0 < 47 else 0.5)
n = int(2.5 * SR); tt = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 1.6)
add(boom, 54.3, 0.55)

# --- hats on the off-beats (23–54 s)
for b in range(int(23 / BEAT), int(54 / BEAT)):
    s0 = b * BEAT + BEAT / 2; n = int(0.06 * SR)
    v = hp(rng.standard_normal(n), 7000, 2) * np.exp(-np.arange(n) / SR * 70)
    add(v, s0, 0.045, pan=0.25 if b % 2 else -0.25)

# --- pluck arpeggio in 8ths (6–54 s), chord tones, gentle
arp_gain = auto([(6, 0), (7, 0.7), (12, 0.8), (47, 0.8), (53.5, 1.0), (54.2, 0)])
for i in range(int(6 / (BEAT / 2)), int(54.2 / (BEAT / 2))):
    s0 = i * BEAT / 2; ch = CHORDS[chord_at(s0)]
    m = ch[[0, 2, 4, 3, 1, 2, 4, 3][i % 8]] + 12
    n = int(0.5 * SR); tt = np.arange(n) / SR
    v = (np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(4 * np.pi * hz(m) * tt)) * np.exp(-tt * 7) * env_ar(n, 0.003, 0.05)
    g = arp_gain[min(N - 1, int(s0 * SR))]
    add(v, s0, 0.075 * g, pan=np.sin(i * 0.7) * 0.5)

# --- airy swells into the big transitions
for s_end in (12.5, 23.5, 47.0, 54.3):
    n = int(1.6 * SR); tt = np.arange(n) / SR
    v = bp(rng.standard_normal(n), 800, 6000) * (tt / tt[-1]) ** 3
    add(v / np.abs(v).max(), s_end - 1.6, 0.05)

# --- reverb (exponential noise IR, 1.8 s) on the music bus
ir_n = int(1.8 * SR)
ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR * 3.6); ir = lp(ir, 5000); ir /= np.abs(ir).sum() / 8
L = L + 0.22 * fftconvolve(L, ir)[:N]; R = R + 0.22 * fftconvolve(R, ir[::-1] * 0 + ir)[:N]

# --- UI clicks from window.SOUNDS (placed by measured peak, dry, under the music)
data = json.load(open(ROOT / "sounds.json"))
def voice(kind):
    P = {"click": (0.06, (2200, 7000), 0.0045, 1750, 0.012, 0.55, 1.0),
         "press": (0.05, (1200, 4200), 0.004, 1050, 0.010, 0.45, 0.55),
         "release": (0.05, (1800, 6000), 0.0035, 1400, 0.009, 0.45, 0.6)}[kind]
    dur, band, nd, f, bd, mix, g = P; n = int(dur * SR); tt = np.arange(n) / SR
    noise = bp(rng.standard_normal(n + 512), *band)[512:][:n] * np.exp(-tt / nd)
    blip = np.sin(2 * np.pi * f * tt) * np.exp(-tt / bd)
    x = (1 - mix) * noise / np.abs(noise).max() + mix * blip
    return g * x / np.abs(x).max()
for ev in data["sounds"]:
    v = voice(ev["type"]); pk = int(np.argmax(np.abs(v)))
    add(v, ev["t"] - pk / SR, 0.16)

# fade in/out + soft clip
fade = auto([(0, 0), (0.6, 1), (58.2, 1), (59.9, 0), (60, 0)])
mix = np.stack([L, R], 1) * fade[:, None]
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) * 0.5
raw = ROOT / "score-raw.wav"
with wave.open(str(raw), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())

def measure(extra):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(raw), "-af", extra, "-f", "null", "-"], capture_output=True, text=True).stderr
    return json.loads(r[r.rindex("{"):r.rindex("}") + 1])
# Brick-wall limiter first (peaks only), so the final loudnorm pass can stay linear.
m0 = measure("loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json")
pre = -14.0 - float(m0["input_i"]) + 0.3
limited = ROOT / "score-limited.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af",
                f"volume={pre:.2f}dB,alimiter=limit=0.708:attack=3:release=60:level=false", "-ar", str(SR), str(limited)], check=True)
raw = limited
m1 = measure("loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json")
print("pass 1:", {k: m1[k] for k in ("input_i", "input_tp", "input_lra")})
af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m1['input_i']}:measured_TP={m1['input_tp']}:"
      f"measured_LRA={m1['input_lra']}:measured_thresh={m1['input_thresh']}:offset={m1['target_offset']}:linear=true:print_format=json")
master = ROOT / "score-master.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", af, "-ar", str(SR), str(master)], check=True)
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(master), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m2 = json.loads(r[r.rindex("{"):r.rindex("}") + 1])
rep = {"integrated_lufs": float(m2["input_i"]), "true_peak_dbtp": float(m2["input_tp"]), "lra": float(m2["input_lra"]), "bpm": BPM, "ui_events": len(data["sounds"])}
print("master:", rep); json.dump(rep, open(ROOT / "loudness.json", "w"), indent=2)
silent = ROOT / "film-silent.mp4"
if silent.exists():
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), "-i", str(master), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(ROOT / "onespec-film.mp4")], check=True)
    print("muxed:", ROOT / "onespec-film.mp4")
