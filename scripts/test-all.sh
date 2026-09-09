#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

cargo fmt --all -- --check
cargo test --workspace --exclude incident-ebpf
cargo clippy --workspace --exclude incident-ebpf -- -D warnings
bash -n scripts/*.sh scripts/lib/*.sh scripts/tests/*.sh
scripts/tests/workflow.sh
scripts/tests/smoke-helpers.sh
scripts/tests/lab-vm.sh
python3 -m py_compile scripts/verify-smoke.py
python3 scripts/verify-content.py

if [ "$(uname -s)" != Linux ]; then
  printf 'Host contract tests passed. Linux eBPF load tests were skipped on %s.\n' "$(uname -s)"
  exit 0
fi

./scripts/build.sh
printf 'Linux release build passed. Run sudo INCIDENT_SKIP_BUILD=1 scripts/smoke-linux.sh for kernel attach tests.\n'
