#!/usr/bin/env bash
set -euo pipefail

if [ "$(uname -s)" != Linux ] || [ "$(id -u)" -ne 0 ]; then
  printf 'smoke-linux.sh requires root on Linux.\n' >&2
  exit 1
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
source "$repo_dir/scripts/lib/smoke-helpers.sh"

artifact_dir="$(mktemp -d /tmp/incident-lab-smoke-XXXXXX)"
qdisc_owned=0
child_pids=()
track_child() { child_pids+=("$1"); }
untrack_child() {
  local completed="$1"
  local remaining=()
  local pid
  for pid in "${child_pids[@]}"; do
    [ "$pid" = "$completed" ] || remaining+=("$pid")
  done
  child_pids=("${remaining[@]}")
}
wait_child() {
  local pid="$1"
  local timeout_seconds="$2"
  local status=0
  wait_for_pid "$pid" "$timeout_seconds" || status=$?
  untrack_child "$pid"
  return "$status"
}
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  cleanup_owned_qdisc lo
  for pid in "${child_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${child_pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  preserve_or_remove_artifacts "$status" "$artifact_dir" || true
  exit "$status"
}
trap cleanup EXIT INT TERM

if [ "${INCIDENT_SKIP_BUILD:-0}" != 1 ]; then
  if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then
    sudo -u "$SUDO_USER" -- cargo build -p incident-runner -p incident-fixtures --release
  else
    printf 'build first as a normal user with ./scripts/build.sh, then run with INCIDENT_SKIP_BUILD=1\n' >&2
    exit 1
  fi
fi

assert_events() { python3 "$repo_dir/scripts/verify-smoke.py" "$1" "$2"; }
start_observer() {
  local lab="$1"; shift
  observer_out="$artifact_dir/$lab.ndjson"
  observer_err="$artifact_dir/$lab.stderr"
  "target/release/$lab" --json "$@" >"$observer_out" 2>"$observer_err" &
  observer_pid=$!
  track_child "$observer_pid"
  wait_for_ready "$observer_err" 10
}
finish_observer() { wait_child "$observer_pid" 15; }

bash -c 'kill -STOP $$; exec /bin/sleep 0.2' &
fixture_pid=$!; track_child "$fixture_pid"
start_observer 01-exec-watch --duration 3 --pid "$fixture_pid"
kill -CONT "$fixture_pid"
wait_child "$fixture_pid" 5
finish_observer
assert_events 1 "$observer_out"

start_observer 02-file-open --duration 3
timeout 5 target/release/file-fixture
finish_observer
assert_events 2 "$observer_out"

start_observer 03-connect-failures --duration 3
timeout 5 target/release/connect-fixture
finish_observer
assert_events 3 "$observer_out"

export INCIDENT_DNS_FIXTURE="$repo_dir/target/release/dns-fixture"
start_observer 04-dns-latency --duration 3
timeout 5 target/release/dns-fixture localhost 100
finish_observer
assert_events 4 "$observer_out"

qdisc_before="$(tc qdisc show dev lo)"
if [[ "$qdisc_before" != *"noqueue"* ]]; then
  printf 'refusing to replace unexpected loopback qdisc: %s\n' "$qdisc_before" >&2
  exit 1
fi
target/release/tcp-fixture server >"$artifact_dir/tcp-server.out" &
server_pid=$!; track_child "$server_pid"
start_observer 05-tcp-retransmits --duration 6
tc qdisc replace dev lo root netem loss 100%
qdisc_owned=1
target/release/tcp-fixture client >"$artifact_dir/tcp-client.out" &
client_pid=$!; track_child "$client_pid"
sleep 2
cleanup_owned_qdisc lo
wait_child "$client_pid" 10
wait_child "$server_pid" 10
finish_observer
assert_events 5 "$observer_out"
grep -q 'request=1 ok' "$artifact_dir/tcp-client.out"

start_observer 06-namespace-pids --duration 7
timeout 7 unshare --fork --pid --mount-proc target/release/namespace-fixture
finish_observer
assert_events 6 "$observer_out"

bash -c 'kill -STOP $$; exec /bin/sh -c "echo verifier-smoke; sleep 0.2"' &
fixture_pid=$!; track_child "$fixture_pid"
start_observer 07-verifier-portability --duration 3 --pid "$fixture_pid"
kill -CONT "$fixture_pid"
wait_child "$fixture_pid" 5
finish_observer
assert_events 7 "$observer_out"

if INCIDENT_VERIFIER_BROKEN=1 target/release/07-verifier-portability --duration 1 \
    >"$artifact_dir/verifier-broken.out" 2>"$artifact_dir/verifier-broken.err"; then
  printf 'broken verifier program unexpectedly loaded\n' >&2
  exit 1
fi
grep -q "invalid mem access 'map_value_or_null'" "$artifact_dir/verifier-broken.err"

# Wrong PID filters must produce no false attribution.
start_observer 01-exec-watch --duration 2 --pid 4294967294
/bin/true
finish_observer
test ! -s "$observer_out"
printf 'ok    wrong PID filter emitted no false attribution\n'

# Missing userspace symbols must fail before readiness with an actionable attach error.
if INCIDENT_DNS_FIXTURE=/bin/true target/release/04-dns-latency --duration 1 \
    >"$artifact_dir/missing-symbol.out" 2>"$artifact_dir/missing-symbol.err"; then
  printf 'missing resolver symbol unexpectedly attached\n' >&2
  exit 1
fi
grep -Eq 'symbol|resolve_backend|attach' "$artifact_dir/missing-symbol.err"
printf 'ok    missing userspace symbol failed before readiness\n'

# A requested tracepoint that does not exist must not be reported as ready.
if INCIDENT_TRACEPOINT_OVERRIDE=incident_lab_missing target/release/01-exec-watch --duration 1 \
    >"$artifact_dir/missing-tracepoint.out" 2>"$artifact_dir/missing-tracepoint.err"; then
  printf 'missing tracepoint unexpectedly attached\n' >&2
  exit 1
fi
grep -Eq 'incident_lab_missing|attach|trace' "$artifact_dir/missing-tracepoint.err"
printf 'ok    unavailable tracepoint failed before readiness\n'

# The observer should fail cleanly without load privilege.
unprivileged_user="${SUDO_USER:-nobody}"
if runuser -u "$unprivileged_user" -- target/release/01-exec-watch --duration 1 \
    >"$artifact_dir/unprivileged.out" 2>"$artifact_dir/unprivileged.err"; then
  printf 'unprivileged eBPF load unexpectedly succeeded\n' >&2
  exit 1
fi
grep -Eq 'Operation not permitted|permission|load embedded' "$artifact_dir/unprivileged.err"
printf 'ok    insufficient privilege failed cleanly\n'

# Hide BTF inside a private mount namespace; the CO-RE program must fail explicitly.
if unshare --mount sh -c '
    mount --bind /dev/null /sys/kernel/btf/vmlinux
    exec target/release/07-verifier-portability --duration 1
  ' >"$artifact_dir/missing-btf.out" 2>"$artifact_dir/missing-btf.err"; then
  printf 'CO-RE observer unexpectedly loaded without readable kernel BTF\n' >&2
  exit 1
fi
grep -Eq 'BTF|btf|Invalid argument|load embedded' "$artifact_dir/missing-btf.err"
printf 'ok    missing target BTF failed explicitly\n'

# Interrupt the destructive fixture while netem is active and prove owned cleanup runs.
scripts/run-retransmit-fixture.sh >"$artifact_dir/interrupted-fixture.out" \
    2>"$artifact_dir/interrupted-fixture.err" &
interrupted_pid=$!
track_child "$interrupted_pid"
deadline=$((SECONDS + 5))
while [[ "$(tc qdisc show dev lo)" != *"netem"* ]]; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    printf 'interruption test never observed the owned netem qdisc\n' >&2
    exit 1
  fi
  sleep 0.05
done
kill -TERM "$interrupted_pid"
if wait "$interrupted_pid"; then
  printf 'interrupted fixture unexpectedly exited successfully\n' >&2
  exit 1
fi
untrack_child "$interrupted_pid"
[[ "$(tc qdisc show dev lo)" != *"netem"* ]]
printf 'ok    interrupted netem fixture restored loopback\n'

printf 'All adversarial Linux failure and cleanup scenarios passed.\n'
printf 'All seven Linux incident scenarios passed strict semantic assertions.\n'
