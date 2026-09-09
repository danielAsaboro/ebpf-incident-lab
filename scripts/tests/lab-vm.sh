#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

failures=0
pass() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1" >&2; failures=$((failures + 1)); }
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then pass "$label"; else
    fail "$label (expected <$expected>, got <$actual>)"
  fi
}
assert_contains() {
  local label="$1" needle="$2" file="$3"
  if grep -Fq "$needle" "$file"; then pass "$label"; else fail "$label (missing <$needle>)"; fi
}
assert_not_contains() {
  local label="$1" needle="$2" file="$3"
  if grep -Fq "$needle" "$file"; then fail "$label (unexpected <$needle>)"; else pass "$label"; fi
}

mkdir -p "$test_root/bin" "$test_root/lima" "$test_root/artifacts"
cp "$repo_dir/vm/artifacts/incident-lab-x86_64.tar.zst" "$test_root/artifacts/"
call_log="$test_root/calls.log"
: >"$call_log"

cat >"$test_root/bin/uname" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  -s) printf '%s\n' "${FAKE_UNAME_S:-Darwin}" ;;
  -m) printf '%s\n' "${FAKE_UNAME_M:-arm64}" ;;
  -r) printf '%s\n' "${FAKE_UNAME_R:-23.0.0}" ;;
  *) printf '%s\n' "${FAKE_UNAME_S:-Darwin}" ;;
esac
EOF

cat >"$test_root/bin/limactl" <<'EOF'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >>"$FAKE_CALL_LOG"
case "${1:-}" in
  --version) printf 'limactl version %s\n' "${FAKE_LIMA_VERSION:-2.2.0}" ;;
  list)
    current_state="${FAKE_STATE:-absent}"
    [ ! -f "${FAKE_STATE_FILE:-}" ] || current_state="$(cat "$FAKE_STATE_FILE")"
    if [ "$current_state" = absent ]; then exit 0; fi
    state=Stopped
    [ "$current_state" = running ] && state=Running
    config_id="$INCIDENT_LAB_REPOSITORY_ID"
    [ "${FAKE_OWNED:-yes}" = other ] && config_id=unrelated
    [ "${FAKE_OWNED:-yes}" = no ] && config_id=missing
    printf '{"name":"ebpf-incident-lab","status":"%s","config":{"provision":[{"script":"export INCIDENT_LAB_REPOSITORY_ID=\\"%s\\"\\nexport INCIDENT_LAB_MANIFEST_VERSION=\\"vm-v1\\""}]}}\n' "$state" "$config_id"
    ;;
  shell)
    shift
    [ "${1:-}" = ebpf-incident-lab ] && shift
    if [ "${1:-}" = -- ]; then shift; fi
    if [ "${1:-}" = sudo ] && [ "${2:-}" = cat ]; then
      current_state="${FAKE_STATE:-absent}"
      [ ! -f "${FAKE_STATE_FILE:-}" ] || current_state="$(cat "$FAKE_STATE_FILE")"
      [ "$current_state" = running ] || exit 1
      case "${FAKE_OWNED:-yes}" in
        yes) printf '{"repository_id":"%s","manifest_version":"vm-v1"}\n' "$INCIDENT_LAB_REPOSITORY_ID" ;;
        other) printf '{"repository_id":"unrelated","manifest_version":"vm-v1"}\n' ;;
        no) exit 1 ;;
      esac
      exit 0
    fi
    exit "${FAKE_SHELL_EXIT:-0}"
    ;;
  start) [ -z "${FAKE_STATE_FILE:-}" ] || printf running >"$FAKE_STATE_FILE"; exit "${FAKE_LIMA_EXIT:-0}" ;;
  stop|delete) exit "${FAKE_LIMA_EXIT:-0}" ;;
  *) exit 0 ;;
esac
EOF
cat >"$test_root/bin/sudo" <<'EOF'
#!/usr/bin/env bash
[ "${1:-}" = -n ] && shift
if [ "${1:-}" = test ] && [ "${2:-}" = -r ]; then exit 0; fi
exec "$@"
EOF
cat >"$test_root/bin/sha256sum" <<'EOF'
#!/usr/bin/env bash
[ "$#" -ne 0 ] || cat >/dev/null
printf 'clean-digest  -\n'
EOF
chmod +x "$test_root/bin/uname" "$test_root/bin/limactl" "$test_root/bin/sudo" "$test_root/bin/sha256sum"

run_vm() {
    PATH="$test_root/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
    FAKE_CALL_LOG="$call_log" FAKE_STATE_FILE="${FAKE_STATE_FILE:-}" INCIDENT_LAB_LIMA_HOME="$test_root/lima" \
    INCIDENT_LAB_ARTIFACT_DIR="$test_root/artifacts" \
    INCIDENT_LAB_FREE_BYTES="${INCIDENT_LAB_FREE_BYTES:-99999999999}" \
    FAKE_STATE="${FAKE_STATE:-absent}" FAKE_OWNED="${FAKE_OWNED:-yes}" \
    FAKE_UNAME_S="${FAKE_UNAME_S:-Darwin}" FAKE_LIMA_VERSION="${FAKE_LIMA_VERSION:-2.2.0}" \
    "$repo_dir/scripts/lab-vm.sh" "$@"
}

out="$test_root/out" err="$test_root/err"
if run_vm status >"$out" 2>"$err"; then
  assert_eq 'absent status succeeds' absent "$(cat "$out")"
else
  fail 'absent status succeeds'
fi

if run_vm status --json >"$out" 2>"$err"; then
  python3 - "$out" <<'PY' || fail 'absent JSON status has stable fields'
import json, sys
value = json.load(open(sys.argv[1]))
assert value == {"manifest_version": "vm-v1", "name": "ebpf-incident-lab", "owned": False, "provisioned": False, "state": "absent"}
PY
  pass 'absent JSON status has stable fields'
else
  fail 'absent JSON status succeeds'
fi

FAKE_UNAME_S=Linux
if run_vm start >"$out" 2>"$err"; then fail 'unsupported host is rejected'; else
  assert_contains 'unsupported host has remedy' 'requires macOS' "$err"
fi
unset FAKE_UNAME_S

FAKE_STATE=stopped FAKE_OWNED=other
if run_vm stop >"$out" 2>"$err"; then fail 'unowned collision is rejected'; else
  assert_contains 'unowned collision identifies ownership' 'not owned by this repository' "$err"
fi
unset FAKE_STATE FAKE_OWNED

FAKE_STATE=running FAKE_OWNED=yes
: >"$call_log"
if run_vm dev-setup >"$out" 2>"$err"; then
  assert_contains 'developer setup delegates the exact guest command' 'incident-lab dev-setup' "$call_log"
else
  fail 'developer setup delegates the exact guest command'
fi
unset FAKE_STATE FAKE_OWNED

FAKE_STATE=stopped FAKE_OWNED=yes
: >"$call_log"
if run_vm start >"$out" 2>"$err"; then
  assert_contains 'owned stopped instance starts from persisted config identity' 'start ebpf-incident-lab' "$call_log"
else
  fail 'owned stopped instance starts from persisted config identity'
fi
unset FAKE_STATE FAKE_OWNED

FAKE_STATE=running FAKE_OWNED=yes
: >"$call_log"
if run_vm stop >"$out" 2>"$err"; then
  assert_contains 'owned stop delegates to Lima' 'stop ebpf-incident-lab' "$call_log"
else
  fail 'owned stop succeeds'
fi
unset FAKE_STATE FAKE_OWNED

FAKE_STATE=stopped FAKE_OWNED=yes
: >"$call_log"
if run_vm delete </dev/null >"$out" 2>"$err"; then fail 'noninteractive delete is rejected'; else
  assert_contains 'noninteractive delete explains confirmation' 'interactive terminal' "$err"
  assert_not_contains 'noninteractive delete never calls Lima delete' 'delete ebpf-incident-lab' "$call_log"
fi
unset FAKE_STATE FAKE_OWNED

if run_vm nonsense >"$out" 2>"$err"; then fail 'unknown command is rejected'; else
  assert_contains 'unknown command prints usage' 'usage:' "$err"
fi

FAKE_STATE=absent
FAKE_STATE_FILE="$test_root/fresh-state"
: >"$call_log"
if run_vm start >"$out" 2>"$err"; then
  assert_contains 'fresh start disables Lima TUI and invokes generated config' 'start --yes --name=ebpf-incident-lab' "$call_log"
else
  fail 'fresh start renders and invokes Lima configuration'
fi
unset FAKE_STATE FAKE_STATE_FILE

guest_root="$test_root/guest-root"
mkdir -p "$guest_root/target/release" "$guest_root/scripts" "$guest_root/state"
cat >"$guest_root/scripts/run-lab.sh" <<'EOF'
#!/usr/bin/env bash
printf 'run-lab:%s\n' "$*"
EOF
cat >"$guest_root/scripts/smoke-linux.sh" <<'EOF'
#!/usr/bin/env bash
printf 'smoke-linux\n'
EOF
chmod +x "$guest_root/scripts/run-lab.sh" "$guest_root/scripts/smoke-linux.sh"
printf '{"release_id":"vm-v1","bundle_sha256":"f96cdf3f47175f7d2cd024bb6f9269c02d169d536730b5740727a1600c8e91b2"}\n' >"$guest_root/state/provisioned.json"

if INCIDENT_LAB_ROOT="$guest_root" INCIDENT_LAB_STATE_DIR="$guest_root/state" \
    "$repo_dir/vm/guest/incident-lab" list >"$out" 2>"$err"; then
  assert_contains 'guest list includes first lab' '01  01-exec-watch' "$out"
  assert_contains 'guest list includes seventh lab' '07  07-verifier-portability' "$out"
else
  fail 'guest list succeeds'
fi

printf '{"repository_id":"owned-repository","manifest_version":"vm-v1"}\n' >"$guest_root/state/owner.json"
printf 'clean-digest\n' >"$guest_root/state/source.sha256"
mkdir -p "$guest_root/source/vm/guest"
cat >"$guest_root/source/vm/guest/provision.sh" <<'EOF'
#!/usr/bin/env bash
printf 'sync-owner:%s:%s:%s\n' "${INCIDENT_LAB_REPOSITORY_ID:-unset}" "${INCIDENT_LAB_MANIFEST_VERSION:-unset}" "$1"
EOF
chmod +x "$guest_root/source/vm/guest/provision.sh"
if PATH="$test_root/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
    INCIDENT_LAB_ROOT="$guest_root" INCIDENT_LAB_STATE_DIR="$guest_root/state" \
    INCIDENT_LAB_SOURCE_DIR="$guest_root/source" \
    "$repo_dir/vm/guest/incident-lab" sync >"$out" 2>"$err"; then
  assert_eq 'sync preserves the established ownership identity' \
    'sync-owner:owned-repository:vm-v1:--sync' "$(cat "$out")"
else
  fail 'sync preserves the established ownership identity'
fi

: >"$test_root/sync-dirty-calls"
printf 'different-digest\n' >"$guest_root/state/source.sha256"
if PATH="$test_root/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
    INCIDENT_LAB_ROOT="$guest_root" INCIDENT_LAB_STATE_DIR="$guest_root/state" \
    INCIDENT_LAB_SOURCE_DIR="$guest_root/source" \
    "$repo_dir/vm/guest/incident-lab" sync >"$out" 2>"$err"; then
  fail 'sync refuses a dirty native workspace'
else
  if grep -Fq 'workspace has local changes' "$err"; then pass 'dirty sync explains reset remedy'; else fail "dirty sync explains reset remedy ($(tr '\n' ' ' <"$err"))"; fi
  assert_not_contains 'dirty sync never invokes provisioner' 'sync-owner:' "$out"
fi

if INCIDENT_LAB_ROOT="$guest_root" INCIDENT_LAB_STATE_DIR="$guest_root/state" \
    INCIDENT_LAB_SUDO='' "$repo_dir/vm/guest/incident-lab" run 01 --duration 3 --json >"$out" 2>"$err"; then
  assert_eq 'guest run maps number and forwards arguments' \
    'run-lab:01-exec-watch --duration 3 --json' "$(cat "$out")"
else
  fail 'guest run succeeds'
fi

mkdir -p "$guest_root/tracefs/events/syscalls/sys_enter_execve" "$guest_root/btf"
: >"$guest_root/tracefs/events/syscalls/sys_enter_execve/format"
: >"$guest_root/btf/vmlinux"
printf 'tracefs %s/tracefs tracefs rw 0 0\n' "$guest_root" >"$guest_root/mounts"
FAKE_UNAME_M=x86_64 FAKE_UNAME_R=6.8.0 \
  PATH="$test_root/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  INCIDENT_LAB_ROOT="$guest_root" INCIDENT_LAB_STATE_DIR="$guest_root/state" \
  INCIDENT_LAB_TRACEFS_ROOT="$guest_root/tracefs" INCIDENT_LAB_BTF_PATH="$guest_root/btf/vmlinux" \
  INCIDENT_LAB_MOUNTS_FILE="$guest_root/mounts" \
  "$repo_dir/vm/guest/incident-lab" doctor >"$out" 2>"$err" || true
assert_contains 'doctor accepts a tracepoint readable through noninteractive sudo' 'ok    execve tracepoint' "$out"

cat >"$guest_root/target/release/01-exec-watch" <<'EOF'
#!/usr/bin/env bash
printf 'READY test-observer\n' >&2
printf '{"lab":1}\n'
sleep 0.2
EOF
cat >"$guest_root/scripts/verify-smoke.py" <<'EOF'
import sys
raise SystemExit(0 if sys.argv[1] == '1' else 1)
EOF
chmod +x "$guest_root/target/release/01-exec-watch"
if INCIDENT_LAB_ROOT="$guest_root" INCIDENT_LAB_STATE_DIR="$guest_root/state" \
    "$repo_dir/vm/guest/incident-lab" _readiness >"$out" 2>"$err"; then
  pass 'readiness cleans temporary files without an EXIT-scope error'
else
  fail 'readiness cleans temporary files without an EXIT-scope error'
  assert_not_contains 'readiness has no unbound cleanup variable' 'unbound variable' "$err"
fi

if [ "$failures" -ne 0 ]; then
  printf '%d lab VM contract test(s) failed\n' "$failures" >&2
  exit 1
fi
printf 'lab VM contract tests passed\n'
