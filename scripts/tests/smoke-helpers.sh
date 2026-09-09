#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
mkdir -p "$test_root/bin"

cat >"$test_root/bin/tc" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$TC_CALLS"
EOF
chmod +x "$test_root/bin/tc"
export PATH="$test_root/bin:$PATH"
export TC_CALLS="$test_root/tc.calls"

# shellcheck source=../lib/smoke-helpers.sh
source "$repo_dir/scripts/lib/smoke-helpers.sh"

qdisc_owned=0
cleanup_owned_qdisc lo
test ! -e "$TC_CALLS"

qdisc_owned=1
cleanup_owned_qdisc lo
grep -qx 'qdisc del dev lo root' "$TC_CALLS"

artifact_dir="$test_root/incident-lab-smoke-artifacts"
mkdir -p "$artifact_dir"
printf 'evidence\n' >"$artifact_dir/observer.out"
preserve_or_remove_artifacts 1 "$artifact_dir"
test -f "$artifact_dir/observer.out"
preserve_or_remove_artifacts 0 "$artifact_dir"
test ! -e "$artifact_dir"

ready_file="$test_root/ready.err"
(sleep 0.2; printf 'READY lab=fixture\n' >"$ready_file") &
wait_for_ready "$ready_file" 2

not_ready="$test_root/not-ready.err"
: >"$not_ready"
if wait_for_ready "$not_ready" 1; then
  printf 'readiness wait unexpectedly succeeded\n' >&2
  exit 1
fi

printf 'smoke helper tests passed\n'
