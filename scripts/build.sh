#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  printf 'build.sh must run as your normal user, not root.\n' >&2
  exit 1
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
printf 'Building observers and deterministic fixtures in release mode. This can take several minutes on a small VM.\n'
exec cargo build -p incident-runner -p incident-fixtures --release
