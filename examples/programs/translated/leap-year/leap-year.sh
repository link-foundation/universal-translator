#!/usr/bin/env bash
# Leap year in Bash

is_leap_year() {
    local year=$1
    REPLY=$(( (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 )); return
}

for (( year = 1896; year < 1913; year++ )); do
    is_leap_year "$year"
    if (( REPLY )); then
        echo "$year is a leap year"
    else
        echo "$year is not a leap year"
    fi
done
