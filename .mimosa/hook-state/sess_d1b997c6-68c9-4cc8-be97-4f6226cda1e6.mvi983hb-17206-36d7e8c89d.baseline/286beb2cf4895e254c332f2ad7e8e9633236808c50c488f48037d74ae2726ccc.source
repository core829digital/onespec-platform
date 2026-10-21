#!/bin/bash
# usage: render.sh dir frames out.mp4 — 4 parallel segments, concat, mux mix.wav
d=$1; F=$2; OUT=$3; cd "$(dirname "$0")/$d"
q=$(( (F + 3) / 4 ))
for i in 0 1 2 3; do a=$((i*q)); b=$(((i+1)*q)); [ $b -gt $F ] && b=$F
  CH=/opt/pw-browsers/chromium node ../seg.mjs $a $b s$i.mp4 > s$i.log 2>&1 & done
wait
printf "file s0.mp4\nfile s1.mp4\nfile s2.mp4\nfile s3.mp4\n" > list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -i mix.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
ffmpeg -i "$OUT" 2>&1 | grep -E "Duration|Stream"
