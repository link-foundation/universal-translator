#!/usr/bin/env bash
# Execute an unchanged JavaScript specimen under the console Windows Script Host.
set -euo pipefail

wine=$1
source_file=$2
export WINEARCH=win64 WINEDEBUG=-all WINEPREFIX="$PWD/wine"
export WINEDLLOVERRIDES='mscoree,mshtml=;zlib1=n'

zlib=${ROSETTA_WINE_ZLIB:-/usr/x86_64-w64-mingw32/lib/zlib1.dll}
if [[ -r "$zlib" ]]; then
  mkdir -p "$WINEPREFIX/drive_c/windows/system32"
  cp "$zlib" "$WINEPREFIX/drive_c/windows/system32/zlib1.dll"
fi

boot_log="$PWD/wineboot.log"
if ! "$wine" 'C:\windows\system32\wineboot.exe' --init > "$boot_log" 2>&1; then
  cat "$boot_log" >&2
  exit 1
fi
"$wine" 'C:\windows\system32\cscript.exe' //nologo "$source_file"
