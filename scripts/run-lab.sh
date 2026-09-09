#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  printf 'usage: %s <lab> [--duration SECONDS] [--pid HOST_PID] [--json]\n' "$0" >&2
  exit 2
fi

lab="$1"
shift
case "$lab" in
  01-exec-watch|02-file-open|03-connect-failures|04-dns-latency|05-tcp-retransmits|06-namespace-pids|07-verifier-portability) ;;
  *)
    printf 'unknown lab: %s\n' "$lab" >&2
    exit 2
    ;;
esac

repo_dir="${INCIDENT_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
binary="$repo_dir/target/release/$lab"
if [ ! -x "$binary" ]; then
  printf 'observer is not built: %s\nRun ./scripts/build.sh as your normal user first.\n' "$binary" >&2
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  exec "$binary" "$@"
fi
exec sudo "$binary" "$@"
