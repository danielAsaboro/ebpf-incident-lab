#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
mkdir -p "$test_root/target/release" "$test_root/bin"

cat >"$test_root/target/release/01-exec-watch" <<'EOF'
#!/usr/bin/env bash
printf 'observer:%s\n' "$*"
EOF
chmod +x "$test_root/target/release/01-exec-watch"

cat >"$test_root/bin/sudo" <<'EOF'
#!/usr/bin/env bash
printf 'sudo:%s\n' "$*" >&2
exec "$@"
EOF
cat >"$test_root/bin/cargo" <<'EOF'
#!/usr/bin/env bash
printf 'cargo must never be invoked by run-lab.sh\n' >&2
exit 97
EOF
chmod +x "$test_root/bin/sudo" "$test_root/bin/cargo"

output="$(PATH="$test_root/bin:$PATH" INCIDENT_REPO_DIR="$test_root" \
    "$repo_dir/scripts/run-lab.sh" 01-exec-watch --duration 3 --json 2>"$test_root/stderr")"
grep -qx 'observer:--duration 3 --json' <<<"$output"
grep -q 'sudo:.*/target/release/01-exec-watch --duration 3 --json' "$test_root/stderr"

if PATH="$test_root/bin:$PATH" INCIDENT_REPO_DIR="$test_root" \
    "$repo_dir/scripts/run-lab.sh" unknown --duration 1 >"$test_root/unknown.out" 2>"$test_root/unknown.err"; then
  printf 'unknown lab unexpectedly succeeded\n' >&2
  exit 1
fi
grep -q 'unknown lab' "$test_root/unknown.err"

if PATH="$test_root/bin:$PATH" INCIDENT_REPO_DIR="$test_root" \
    "$repo_dir/scripts/run-lab.sh" 02-file-open --duration 1 >"$test_root/missing.out" 2>"$test_root/missing.err"; then
  printf 'missing binary unexpectedly succeeded\n' >&2
  exit 1
fi
grep -q './scripts/build.sh' "$test_root/missing.err"

printf 'workflow tests passed\n'
