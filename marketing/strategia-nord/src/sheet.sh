#!/bin/bash
# usage: sheet.sh v1 name t1 t2 ... (contact sheet of frames)
d=$1; n=$2; shift 2; cd "$(dirname "$0")/$d"
CH=/opt/pw-browsers/chromium node ../shot.mjs prev/$n "$@" || exit 1
args=""; f=""; i=0
for t in "$@"; do args="$args -i prev/$n-$t.png"; f="$f[$i]scale=360:-1[v$i];"; i=$((i+1)); done
s=""; for j in $(seq 0 $((i-1))); do s="$s[v$j]"; done
ffmpeg -y -loglevel error $args -filter_complex "${f}${s}hstack=$i" prev/sheet-$n.png
