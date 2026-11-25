#!/usr/bin/env bash
square() {
    local value=$1
    REPLY=$((value * value)); return
}

square 4
echo "$REPLY"
