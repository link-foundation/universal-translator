#!/usr/bin/env bash
# Checks that a built image translates through its CLI and answers over HTTP.
#
# Usage: bash scripts/smoke-test-docker-image.sh <image>
set -euo pipefail

image="${1:?usage: smoke-test-docker-image.sh <image>}"
container="smoke-test-$$"
languages="$(mktemp)"
# The server container is removed even when a check fails.
trap 'docker rm -f "$container" > /dev/null 2>&1 || true; rm -f "$languages"' EXIT

echo 'console.log("Hi");' |
  docker run --rm -i "$image" translate javascript python - |
  grep -F 'print("Hi")'
docker run -d --name "$container" -p 8080:8080 "$image"
for _ in $(seq 1 30); do
  curl -fsS http://localhost:8080/languages > "$languages" && break
  sleep 1
done
grep -F '"python"' "$languages"
curl -fsS -H 'content-type: application/json' \
  -d '{"source":"console.log(\"Hi\");","from":"javascript","to":"rust"}' \
  http://localhost:8080/translate | grep -F 'println!'
