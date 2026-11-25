#!/usr/bin/env bash
# Towers of Hanoi in Bash, solved recursively

move_disks() {
    local count=$1 source=$2 target=$3 spare=$4
    if (( count == 0 )); then
        return
    fi
    move_disks $((count - 1)) "$source" "$spare" "$target"
    echo "Move disk $count from $source to $target"
    move_disks $((count - 1)) "$spare" "$target" "$source"
}

move_disks 4 1 3 2
