#!/bin/bash
# usage: build.sh v1   -> v1/ep.html (shared head + cube + timing + lib + scenes)
d=$1; cd "$(dirname "$0")"
cat head.part cube.part "$d/timing.js" lib.part "$d/scenes.part" > "$d/ep.html"
ln -sfn ../assets "$d/assets"
