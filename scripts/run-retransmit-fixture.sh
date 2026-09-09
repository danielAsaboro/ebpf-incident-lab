#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  printf 'run-retransmit-fixture.sh requires root in the disposable lab VM.\n' >&2
  exit 1
fi
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$repo_dir/scripts/lib/smoke-helpers.sh"
qdisc_owned=0
server_pid=""
client_pid=""
cleanup() {
  cleanup_owned_qdisc lo
  [ -z "$client_pid" ] || kill "$client_pid" 2>/dev/null || true
  [ -z "$server_pid" ] || kill "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

current="$(tc qdisc show dev lo)"
if [[ "$current" != *"noqueue"* ]]; then
  printf 'refusing to replace unexpected loopback qdisc: %s\n' "$current" >&2
  exit 1
fi
"$repo_dir/target/release/tcp-fixture" server &
server_pid=$!
sleep 0.2
tc qdisc replace dev lo root netem loss 100%
qdisc_owned=1
"$repo_dir/target/release/tcp-fixture" client &
client_pid=$!
sleep 2
cleanup_owned_qdisc lo
wait_for_pid "$client_pid" 10
client_pid=""
wait_for_pid "$server_pid" 10
server_pid=""
