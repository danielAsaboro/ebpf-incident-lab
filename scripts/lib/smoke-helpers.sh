#!/usr/bin/env bash

cleanup_owned_qdisc() {
  local device="$1"
  if [ "${qdisc_owned:-0}" -eq 1 ]; then
    tc qdisc del dev "$device" root 2>/dev/null || true
    qdisc_owned=0
  fi
}

preserve_or_remove_artifacts() {
  local status="$1"
  local directory="$2"
  if [ "$status" -ne 0 ]; then
    printf 'failure artifacts preserved at %s\n' "$directory" >&2
    return
  fi
  case "$(basename "$directory")" in
    incident-lab-smoke-*) rm -rf -- "$directory" ;;
    *)
      printf 'refusing to remove unexpected artifact directory: %s\n' "$directory" >&2
      return 1
      ;;
  esac
}

wait_for_ready() {
  local stderr_file="$1"
  local timeout_seconds="$2"
  local deadline=$((SECONDS + timeout_seconds))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if grep -q '^READY ' "$stderr_file" 2>/dev/null; then
      return 0
    fi
    sleep 0.05
  done
  printf 'observer did not report readiness within %ss; stderr: %s\n' \
    "$timeout_seconds" "$stderr_file" >&2
  return 1
}

wait_for_pid() {
  local pid="$1"
  local timeout_seconds="$2"
  local deadline=$((SECONDS + timeout_seconds))
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      printf 'process %s exceeded %ss timeout\n' "$pid" "$timeout_seconds" >&2
      return 124
    fi
    sleep 0.05
  done
  wait "$pid"
}
