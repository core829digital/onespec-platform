"""Synthesise dry UI clicks for every event in window.SOUNDS, wrap across the loop,
master (two-pass loudnorm) and mux as AAC.  Usage: python3 tools/sound.py [--lufs -14]"""
import json, subprocess, sys, wave, re
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
data = json.load(open(ROOT / "sounds.json"))
T = data["T"]
N = int(round(T * SR))
rng = np.random.default_rng(829)

def bandnoise(dur, lo, hi):
    n = int(dur * SR)
    sos = butter(4, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, rng.standard_normal(n + 512))[512:]

def env(n, attack, decay):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / decay)

def voice(kind):
    """Band-passed noise transient + a quick sine blip. Dry, no reverb."""
    P = {  # dur, noise band, noise decay, blip Hz, blip decay, blip mix, gain
        "click":   (0.060, (2200, 7000), 0.0045, 1750, 0.012, 0.55, 1.00),
        "press":   (0.050, (1200, 4200), 0.0040, 1050, 0.010, 0.45, 0.55),
        "release": (0.050, (1800, 6000), 0.0035, 1400, 0.009, 0.45, 0.60),
        "tick":    (0.020, (3500, 9000), 0.0012, 3200, 0.003, 0.30, 0.18),
    }[kind]
    dur, band, nd, hz, bd, mix, g = P
    n = int(dur * SR)
    noise = bandnoise(dur, *band)[:n] * env(n, 0.0004, nd)
    t = np.arange(n) / SR
    blip = np.sin(2 * np.pi * hz * t) * env(n, 0.0008, bd)
    x = (1 - mix) * noise / (np.abs(noise).max() + 1e-9) + mix * blip
    return g * x / (np.abs(x).max() + 1e-9)

bus = np.zeros(N)
for ev in data["sounds"]:
    v = voice(ev["type"])
    peak = int(np.argmax(np.abs(v)))          # place by the measured peak
    start = int(round(ev["t"] * SR)) - peak
    idx = (start + np.arange(len(v))) % N     # wrap across the loop point
    np.add.at(bus, idx, v)

bus *= 10 ** (-12 / 20) / (np.abs(bus).max() + 1e-9)   # pre-gain; mastering sets the final level
raw = ROOT / "clicks-raw.wav"
with wave.open(str(raw), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    pcm = (np.clip(bus, -1, 1) * 32767).astype("<i2")
    w.writeframes(np.column_stack([pcm, pcm]).tobytes())

def loud(path, extra=""):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
                        f"{extra}loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    return json.loads(r[r.rindex("{"):r.rindex("}") + 1])

m1 = loud(raw)
print("pass 1:", {k: m1[k] for k in ("input_i", "input_tp", "input_lra", "input_thresh")})

# Without music, forcing a click-only track to -14 LUFS would make every click
# painfully loud (and loudnorm would fall back to dynamic compression to respect
# the -1.5 dBTP ceiling). So: attempt -14 LUFS linearly; if the ceiling does not
# allow it, apply the largest linear gain that keeps true peak at -1.5 dBTP.
target = -14.0
gain_needed = target - float(m1["input_i"])
gain_ceiling = -1.5 - float(m1["input_tp"])
gain = min(gain_needed, gain_ceiling)
mastered = ROOT / "clicks-master.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", f"volume={gain:.3f}dB",
                "-ar", str(SR), str(mastered)], check=True)
m2 = loud(mastered)
report = {"gain_db": round(gain, 2), "limited_by": "true-peak ceiling" if gain_ceiling < gain_needed else "loudness target",
          "integrated_lufs": float(m2["input_i"]), "true_peak_dbtp": float(m2["input_tp"]), "events": len(data["sounds"])}
print("master:", report)
json.dump(report, open(ROOT / "loudness.json", "w"), indent=2)

silent = ROOT / "video-silent.mp4"
if silent.exists():
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), "-i", str(mastered),
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                    "-shortest", "-movflags", "+faststart", str(ROOT / "motion-video.mp4")], check=True)
    print("muxed:", ROOT / "motion-video.mp4")
