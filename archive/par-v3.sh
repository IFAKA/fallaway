#!/bin/zsh
# usage: archive/par-v3.sh policy games_per_proc procs  (env passes through)
for i in $(seq 0 $(( $3 - 1 ))); do node "$(dirname "$0")/sim-v3.mjs" $1 $2 $(( i * $2 + 1 )) | head -1 & done | awk '{w+=$3; n++; print} END{}' ; wait
