"""Original score + UI sounds for the 90 s vertical reel, synthesised with numpy (no third-party audio).
120 BPM, 45 bars: tense hook with a ticking clock → light groove (dialogue) → fuller (showroom) →
night ambience (no drums, notification pings) → dawn chime + uplifting groove → end impact.
Masters to -14 LUFS / <= -1.5 dBTP (limiter + linear two-pass loudnorm) and muxes as AAC.
Usage: python3 tools/reel_sound.py   (expects sounds.json and reel-silent.mp4 next to reel.html)"""
import json, subprocess, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = Path(__file__).resolve().parent.parent
SR, DUR, BEAT = 48000, 90.0, 0.5
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(829)
L = np.zeros(N); R = np.zeros(N)

def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)
def env(n, a, r):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR)); e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def add(sig, start, g=1.0, pan=0.0):
    i0 = int(start * SR); n = min(len(sig), N - i0)
    if n <= 0 or i0 < 0: return
    L[i0:i0 + n] += sig[:n] * g * np.sqrt(0.5 * (1 - pan)); R[i0:i0 + n] += sig[:n] * g * np.sqrt(0.5 * (1 + pan))
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def auto(pts): xs, ys = zip(*pts); return np.interp(t, xs, ys)

# chords (4 s each). Day: Am9 · Fmaj7 · C/E · G6sus. Night: darker Dm9 · Bbmaj7 · Fmaj7/A · Csus2
DAY = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [52, 55, 60, 62, 67], [55, 59, 62, 64, 69]]
NIGHT = [[50, 53, 57, 60, 64], [46, 50, 53, 57, 62], [45, 48, 53, 57, 60], [48, 50, 55, 60, 62]]
BASS_DAY, BASS_NIGHT = [45, 41, 40, 43], [38, 34, 33, 36]
is_night = lambda s: 53 <= s < 71.5
def chord(s): return (NIGHT if is_night(s) else DAY)[int(s // 4) % 4]
def root(s): return (BASS_NIGHT if is_night(s) else BASS_DAY)[int(s // 4) % 4]

# pad
pad = np.zeros(N)
for k in range(int(DUR // 4) + 1):
    s0 = k * 4.0; n = int(4.6 * SR); tt = np.arange(n) / SR; v = np.zeros(n)
    for m in chord(s0 + 0.1):
        for det in (-0.07, 0.0, 0.06):
            v += 2 * ((tt * hz(m) * 2 ** (det / 12) + rng.random()) % 1) - 1
    v = lp(v, 1100 if is_night(s0 + 0.1) else 1500, 4) * env(n, 1.2, 1.4)
    i0 = int(s0 * SR); m_ = min(n, N - i0)
    if m_ > 0: pad[i0:i0 + m_] += v[:m_]
pad /= np.abs(pad).max()
pg = auto([(0, 0), (1, 0.5), (4.5, 0.45), (39, 0.45), (53, 0.7), (71, 0.7), (72, 0.5), (84, 0.6), (84.3, 0.95), (88, 0.5), (90, 0)])
L += pad * pg * 0.2; R += pad * pg * 0.2

# ticking clock in the hook
for b in range(0, 9):
    n = int(0.03 * SR); v = hp(rng.standard_normal(n), 3000) * np.exp(-np.arange(n) / SR * 180)
    add(v, b * BEAT, 0.12, pan=0.2 if b % 2 else -0.2)

groove = lambda s: (4.5 <= s < 52.5) or (72.5 <= s < 84)
full = lambda s: (39 <= s < 52.5) or (76 <= s < 84)
# sub bass + kick
def kick():
    n = int(0.35 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-tt * 28)) / SR) * np.exp(-tt * 9)
for b in range(int(DUR / BEAT)):
    s0 = b * BEAT
    if groove(s0):
        n = int(0.46 * SR); tt = np.arange(n) / SR
        add(np.sin(2 * np.pi * hz(root(s0) - 12) * tt) * np.exp(-tt * 5) * env(n, 0.006, 0.05), s0, 0.28)
        if full(s0) or b % 2 == 0: add(kick(), s0, 0.42)
    if groove(s0 + BEAT / 2) and s0 >= 12:
        n = int(0.06 * SR); v = hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * 70)
        add(v, s0 + BEAT / 2, 0.04 if not full(s0) else 0.055, pan=0.25 if b % 2 else -0.25)
    if is_night(s0) and b % 4 == 0:   # slow heartbeat pulse at night
        n = int(0.6 * SR); tt = np.arange(n) / SR
        add(np.sin(2 * np.pi * hz(root(s0) - 12) * tt) * np.exp(-tt * 4), s0, 0.18)

# pluck arpeggio (8ths), day sections
arp = auto([(4.5, 0), (5.5, 0.7), (39, 0.8), (52.5, 1.0), (53, 0), (72.5, 0), (73.5, 0.9), (84, 1.0), (84.3, 0)])
for i in range(int(DUR / (BEAT / 2))):
    s0 = i * BEAT / 2; g = arp[min(N - 1, int(s0 * SR))]
    if g < 0.01: continue
    m = chord(s0)[[0, 2, 4, 3, 1, 2, 4, 3][i % 8]] + 12
    n = int(0.5 * SR); tt = np.arange(n) / SR
    v = (np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(4 * np.pi * hz(m) * tt)) * np.exp(-tt * 7) * env(n, 0.003, 0.05)
    add(v, s0, 0.07 * g, pan=np.sin(i * 0.7) * 0.5)

# swells into scene changes + end impact
for s_end in (4.5, 39.4, 53.0, 71.5, 84.3):
    n = int(1.4 * SR); tt = np.arange(n) / SR
    v = bp(rng.standard_normal(n), 800, 6000) * (tt / tt[-1]) ** 3
    add(v / np.abs(v).max(), s_end - 1.4, 0.045)
n = int(2.5 * SR); tt = np.arange(n) / SR
add(np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 1.6), 84.3, 0.5)

# reverb
irn = int(1.8 * SR); ir = rng.standard_normal(irn) * np.exp(-np.arange(irn) / SR * 3.6); ir = lp(ir, 5000); ir /= np.abs(ir).sum() / 8
L = L + 0.22 * fftconvolve(L, ir)[:N]; R = R + 0.22 * fftconvolve(R, ir)[:N]

# UI sounds from window.SOUNDS (placed by measured peak)
data = json.load(open(ROOT / "sounds.json"))
def voice(kind):
    if kind == "ping":   # soft two-tone notification (generic, not any app's trademark sound)
        n = int(0.42 * SR); tt = np.arange(n) / SR
        a = np.sin(2 * np.pi * hz(88) * tt) * np.exp(-tt * 14) * (tt < 0.12)
        b = np.sin(2 * np.pi * hz(93) * (tt - 0.1)) * np.exp(-np.maximum(tt - 0.1, 0) * 9) * (tt >= 0.1)
        return (a + b) * 0.9
    if kind == "pop":
        n = int(0.08 * SR); tt = np.arange(n) / SR
        return np.sin(2 * np.pi * (500 + 900 * np.exp(-tt * 60)) * tt) * np.exp(-tt * 45) * 0.6
    if kind == "sent":
        n = int(0.35 * SR); tt = np.arange(n) / SR
        return bp(rng.standard_normal(n), 1500, 7000) * (tt / tt[-1]) ** 2 * np.exp(-np.maximum(tt - 0.3, 0) * 60) * 0.5
    if kind == "alarm":
        out = np.zeros(int(1.8 * SR))
        for j, m in enumerate([84, 88, 91, 84, 88, 91]):
            n = int(0.5 * SR); tt = np.arange(n) / SR; st = int(j * 0.26 * SR) + (int(0.3 * SR) if j >= 3 else 0)
            seg = (np.sin(2 * np.pi * hz(m) * tt) + 0.25 * np.sin(4 * np.pi * hz(m) * tt)) * np.exp(-tt * 6)
            out[st:st + n] += seg[: len(out) - st]
        return out * 0.5
    n = int(0.06 * SR); tt = np.arange(n) / SR   # click
    noise = bp(rng.standard_normal(n + 512), 2200, 7000)[512:][:n] * np.exp(-tt / 0.0045)
    blip = np.sin(2 * np.pi * 1750 * tt) * np.exp(-tt / 0.012)
    x = 0.45 * noise / np.abs(noise).max() + 0.55 * blip
    return x / np.abs(x).max()
GAIN = {"click": 0.14, "pop": 0.1, "ping": 0.2, "sent": 0.18, "alarm": 0.22}
for ev in data["sounds"]:
    v = voice(ev["type"]); pk = int(np.argmax(np.abs(v)))
    add(v, ev["t"] - pk / SR, GAIN[ev["type"]])

fade = auto([(0, 0), (0.5, 1), (88.2, 1), (89.9, 0), (90, 0)])
mix = np.stack([L, R], 1) * fade[:, None]
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) * 0.5
raw = ROOT / "score-raw.wav"
with wave.open(str(raw), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())

def measure(src):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    return json.loads(r[r.rindex("{"):r.rindex("}") + 1])
m0 = measure(raw)
pre = -14.0 - float(m0["input_i"]) + 0.3
lim = ROOT / "score-limited.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", f"volume={pre:.2f}dB,alimiter=limit=0.708:attack=3:release=60:level=false", "-ar", str(SR), str(lim)], check=True)
m1 = measure(lim)
af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m1['input_i']}:measured_TP={m1['input_tp']}:measured_LRA={m1['input_lra']}:"
      f"measured_thresh={m1['input_thresh']}:offset={m1['target_offset']}:linear=true:print_format=json")
master = ROOT / "score-master.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(lim), "-af", af, "-ar", str(SR), str(master)], check=True)
m2 = measure(master)
rep = {"integrated_lufs": float(m2["input_i"]), "true_peak_dbtp": float(m2["input_tp"]), "lra": float(m2["input_lra"]), "bpm": 120, "ui_events": len(data["sounds"])}
print("master:", rep); json.dump(rep, open(ROOT / "loudness.json", "w"), indent=2)
silent = ROOT / "reel-silent.mp4"
if silent.exists():
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), "-i", str(master), "-map", "0:v", "-map", "1:a",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
                    "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(ROOT / "onespec-reel.mp4")], check=True)
    print("muxed:", ROOT / "onespec-reel.mp4")
