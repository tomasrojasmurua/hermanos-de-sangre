#!/bin/sh
# Plays the whole chapter unattended (bot runs, cards auto-clicked) and saves a shot every 20 s.
cd "$(dirname "$0")/../.."
steps='[["eval","window.__botSlow=${SLOW:-3};__autocards(0);__autobot(\"good\")"]'
for i in $(seq -w 1 ${N:-24}); do steps="$steps,[\"wait\",${W:-20000}],[\"shot\",\"$i\"],[\"eval\",\"JSON.stringify({m:(JSON.parse(localStorage.hds_save||'{}')).moment, run:window.__run&&{s:Math.round(__run.col.s),rel:+(__run.col.p.rel||0).toFixed(2),st:+__run.col.p.stam.toFixed(2),lost:__run.col.lostCount}})\"]"; done
steps="$steps]"
python3 tools/currahee/run.py ${NAME:-full} "$steps" "${Q:-}"
