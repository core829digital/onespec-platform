#!/usr/bin/env python3
"""Audit a UGC voiceover against the framework's mechanical rules (UGC Script Framework v2, sections 1, 2, 5, 9).

Usage:
  python3 check_voiceover.py --format mid  script.txt
  echo "text" | python3 check_voiceover.py --format full

Prints one line per finding and a summary; exit code 1 if any hard rule fails (warnings never fail).
It checks only what a machine can check. Judgement rules (hook specificity, 12-year-old test, analogy quality, visual/voiceover sync)
still need a human or model read.
"""
import argparse
import re
import sys

FORMATS = {
    # words as written in the framework; runtime window in seconds; natural speech is about 2.5 to 3.3 words per second
    "mid": {"words": (55, 70), "seconds": (18, 22), "beats": 3},
    "full": {"words": (150, 180), "seconds": (28, 32), "beats": 5},
}
NATURAL_WPS = (2.5, 3.3)
SOFT_CTA_HINTS = ("link", "below", "bio", "comment", "sotto", "commenti", "lien", "unten", "hieronder", "mai jos", "dai un'occhiata", "check it out")
STUTTER = re.compile(r"(?:\b\w{1,10}\.\s+){2,}\w{1,10}\.", re.UNICODE)  # three or more one-word sentences in a row


def words(text: str) -> list[str]:
    return re.findall(r"[\w'’]+", text, flags=re.UNICODE)


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--format", choices=FORMATS, required=True)
    ap.add_argument("file", nargs="?")
    args = ap.parse_args()
    text = open(args.file, encoding="utf-8").read() if args.file else sys.stdin.read()
    text = text.strip().strip('"“”')
    fmt = FORMATS[args.format]
    hard, warn = [], []

    n = len(words(text))
    lo, hi = fmt["words"]
    s_lo, s_hi = fmt["seconds"]
    t_fast, t_slow = n / NATURAL_WPS[1], n / NATURAL_WPS[0]
    # Runtime is the hard constraint: the chunk times in the framework add up to it, and a voice cannot read faster than ~3.3 words/s.
    if t_fast > s_hi * 1.2:
        hard.append(f"{n} words take at least {t_fast:.0f} s at the fastest natural pace; the {args.format} format targets {s_lo}-{s_hi} s. Cut the script")
    elif t_slow < s_lo * 0.8:
        hard.append(f"{n} words take at most {t_slow:.0f} s at a slow natural pace; the {args.format} format targets {s_lo}-{s_hi} s. The script is too short")
    if not lo <= n <= hi:
        warn.append(
            f"word count {n} is outside the framework's written range {lo}-{hi}. "
            + ("The framework's word range and runtime disagree for this format (150-180 words cannot be spoken in 28-32 s); the runtime was used. Tell Stefan." if args.format == "full" else "Check the word range as well as the runtime.")
        )

    if re.search(r"[—–]", text):
        hard.append("contains an em dash or en dash (breaks speech rhythm when read aloud, rule 2.5)")
    if re.search(r"\*\*|__|(?<!\w)\*\w|\w\*(?!\w)", text):
        hard.append("contains bold/italic markdown (no function in audio, rule 2.5)")
    if re.search(r"\n\s*[-*•#]", text):
        hard.append("contains list or heading formatting: the voiceover must be plain spoken prose")
    if STUTTER.search(text):
        hard.append("choppy stutter pattern: three or more one-word sentences in a row (rule 2.2); join them with connectors")
    short = [s for s in sentences(text) if len(words(s)) <= 2]
    if len(short) >= 3:
        warn.append(f"{len(short)} sentences of two words or fewer ({'; '.join(short[:3])}...): check for choppy rhythm (rule 2.2)")

    first = sentences(text)[0] if sentences(text) else ""
    first5 = " ".join(words(first)[:5]).lower()
    if re.match(r"^(i|io|ieri|this morning|stamattina|last (week|saturday)|sabato|yesterday)\b", first5):
        warn.append("the hook may narrate the creator's life instead of calling out the viewer (rule 2.1); the first five words must name the person and the frustration")
    if len(words(first)) > 28:
        warn.append("the first sentence is very long for a hook; split it or tighten it")

    last = " ".join(sentences(text)[-2:]).lower()
    if not any(h in last for h in SOFT_CTA_HINTS):
        warn.append("the close does not look like a soft suggestion-style CTA (link below / bio / comments), rule 2.4")
    if re.search(r"\b(buy now|compra ora|acquista ora|order now|don't miss|non perdere|limited time|offerta limitata)\b", text, re.I):
        hard.append("hard-sell phrasing found; use the soft CTA bank (rule 2.4)")

    print(f"format={args.format} words={n} (~{t_fast:.0f}-{t_slow:.0f} s at natural pace)")
    for m in hard:
        print(f"FAIL  {m}")
    for m in warn:
        print(f"WARN  {m}")
    print("OK: no mechanical rule broken" if not hard else f"{len(hard)} hard rule(s) broken")
    return 1 if hard else 0


if __name__ == "__main__":
    sys.exit(main())
