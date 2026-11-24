#!/usr/bin/env bash
# Mutual recursion in Bash: the Hofstadter Female and Male sequences

female() {
    local index=$1
    if (( index == 0 )); then
        REPLY=1; return
    fi
    female $((index - 1))
    male "$REPLY"
    REPLY=$((index - REPLY)); return
}

male() {
    local index=$1
    if (( index == 0 )); then
        REPLY=0; return
    fi
    male $((index - 1))
    female "$REPLY"
    REPLY=$((index - REPLY)); return
}

for (( index = 0; index < 20; index++ )); do
    female "$index"
    REPLY_1=$REPLY
    male "$index"
    echo "$index: $REPLY_1 $REPLY"
done
