#!/usr/bin/env bash
# Installs Dart, Julia, Scala, Groovy and Zig for the native translation job.
#
# Pinned official archives, checked against their SHA-256 sums.
# Noble's scala (2.11) and groovy (2.4) predate the runner's JDK,
# and Noble has no Zig package.
# Archives are cached between runs, every attempt is capped at
# three minutes so a stalled transfer moves on, and downloads fall
# back to a mirror, because hosts such as Maven Central answer HTTP 429
# to GitHub runners from time to time.
#
# Usage: bash scripts/install-native-archives.sh
# Needs RUNNER_TEMP, GITHUB_ENV and GITHUB_PATH, as set by GitHub Actions.
set -euo pipefail

tools="$RUNNER_TEMP/tools"
archives="$RUNNER_TEMP/tools-archives"
mkdir -p "$tools" "$archives"

# fetch "<url> [mirror]" <file name> <sha256>
fetch() {
  local urls=$1 name=$2 sum=$3
  if [ -f "$archives/$name" ] && echo "$sum  $archives/$name" | sha256sum --check --status; then
    echo "Using cached $name"
  else
    local ok=
    for url in $urls; do
      if curl --fail --location --silent --show-error --retry 3 --retry-all-errors \
        --retry-delay 5 --connect-timeout 20 --max-time 180 "$url" --output "$archives/$name" &&
        echo "$sum  $archives/$name" | sha256sum --check --quiet; then
        ok=1
        break
      fi
      echo "Download of $name from $url failed, trying the next source"
    done
    [ -n "$ok" ] || { echo "::error::Could not download $name"; exit 1; }
  fi
  cp "$archives/$name" "$tools/$name"
}
fetch https://storage.googleapis.com/dart-archive/channels/stable/release/3.6.0/sdk/dartsdk-linux-x64-release.zip \
  dart.zip 8e14ff436e1eec72618dabc94f421a97251f2068c9cc9ad2d3bb9d232d6155a3
fetch https://julialang-s3.julialang.org/bin/linux/x64/1.11/julia-1.11.2-linux-x86_64.tar.gz \
  julia.tar.gz 8a372ad262d4d4d55a1044f4fe3bce7c9a4a3ce8c513d2470e58e8071eecd476
fetch https://github.com/scala/scala3/releases/download/3.3.4/scala3-3.3.4.tar.gz \
  scala.tar.gz fd0eca29ef1f6c41874b6711e7b6514f1dc7c387c087742fb873f6e720963770
fetch "https://repo1.maven.org/maven2/org/apache/groovy/groovy-binary/4.0.24/groovy-binary-4.0.24.zip
  https://maven-central.storage-download.googleapis.com/maven2/org/apache/groovy/groovy-binary/4.0.24/groovy-binary-4.0.24.zip" \
  groovy.zip dbff36835568bec2271876f70bfcca6deb80e1b179453cca934a502ea301bb80
fetch "https://ziglang.org/download/0.17.1/zig-x86_64-linux-0.17.1.tar.xz
  https://zig.linus.dev/zig/zig-x86_64-linux-0.17.1.tar.xz" \
  zig.tar.xz 3581863e3cbcfd0fce0efc682ce7e9e93da96668a977791d356a26d2a7e9b17a
unzip -q "$tools/dart.zip" -d "$tools"
unzip -q "$tools/groovy.zip" -d "$tools"
tar -xzf "$tools/julia.tar.gz" -C "$tools"
tar -xzf "$tools/scala.tar.gz" -C "$tools"
tar -xJf "$tools/zig.tar.xz" -C "$tools"
echo "GROOVY_HOME=$tools/groovy-4.0.24" >> "$GITHUB_ENV"
{
  echo "$tools/dart-sdk/bin"
  echo "$tools/julia-1.11.2/bin"
  echo "$tools/scala3-3.3.4/bin"
  echo "$tools/groovy-4.0.24/bin"
  echo "$tools/zig-x86_64-linux-0.17.1"
} >> "$GITHUB_PATH"
