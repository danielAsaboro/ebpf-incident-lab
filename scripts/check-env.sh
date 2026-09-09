#!/usr/bin/env bash
set -u

failures=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'ok    %s\n' "$label"
  else
    printf 'FAIL  %s\n' "$label"
    failures=$((failures + 1))
  fi
}

nightly_rust_src() {
  rustup component list --toolchain nightly --installed 2>/dev/null | grep -q '^rust-src'
}

tracefs_mounted() {
  grep -qE '[[:space:]]/sys/kernel/tracing[[:space:]]+tracefs[[:space:]]' /proc/mounts
}

kernel_supported() {
  local major minor
  IFS=. read -r major minor _ <<<"$(uname -r)"
  [ "$major" -gt 6 ] || { [ "$major" -eq 6 ] && [ "${minor:-0}" -ge 8 ]; }
}

load_privilege_available() {
  [ "$(id -u)" -eq 0 ] || sudo -n true
}

resolver_symbol_available() {
  local fixture="${INCIDENT_DNS_FIXTURE:-target/release/dns-fixture}"
  [ ! -e "$fixture" ] || readelf --wide --syms "$fixture" | grep -q ' resolve_backend$'
}

clang_has_bpf_target() {
  clang -print-targets 2>/dev/null | grep -qE '[[:space:]]bpf(el|eb)?[[:space:]]'
}

system_readable() {
  test -r "$1" || sudo -n test -r "$1"
}

tcp_format_matches() {
  local format=/sys/kernel/tracing/events/tcp/tcp_retransmit_skb/format
  if test -r "$format"; then
    grep -q 'field:__u16 sport;.*offset:28;' "$format" \
      && grep -q 'field:__u16 family;.*offset:32;' "$format" \
      && grep -q 'field:__u8 saddr\[4\];.*offset:34;' "$format"
  else
    sudo -n grep -q 'field:__u16 sport;.*offset:28;' "$format" \
      && sudo -n grep -q 'field:__u16 family;.*offset:32;' "$format" \
      && sudo -n grep -q 'field:__u8 saddr\[4\];.*offset:34;' "$format"
  fi
}

printf 'eBPF Incident Lab environment\n'
printf 'architecture: %s\n' "$(uname -m)"
printf 'kernel:       %s\n' "$(uname -r)"

check 'Linux host' test "$(uname -s)" = Linux
check 'x86_64 publication architecture' test "$(uname -m)" = x86_64
check 'kernel 6.8 or newer' kernel_supported
check 'kernel BTF at /sys/kernel/btf/vmlinux' system_readable /sys/kernel/btf/vmlinux
check 'tracefs mounted' tracefs_mounted
check 'execve tracepoint' system_readable /sys/kernel/tracing/events/syscalls/sys_enter_execve/format
check 'openat entry tracepoint' system_readable /sys/kernel/tracing/events/syscalls/sys_enter_openat/format
check 'openat exit tracepoint' system_readable /sys/kernel/tracing/events/syscalls/sys_exit_openat/format
check 'connect entry tracepoint' system_readable /sys/kernel/tracing/events/syscalls/sys_enter_connect/format
check 'connect exit tracepoint' system_readable /sys/kernel/tracing/events/syscalls/sys_exit_connect/format
check 'write entry tracepoint' system_readable /sys/kernel/tracing/events/syscalls/sys_enter_write/format
check 'TCP retransmit tracepoint' system_readable /sys/kernel/tracing/events/tcp/tcp_retransmit_skb/format
check 'TCP retransmit field layout' tcp_format_matches
check 'cgroup v2' test -r /sys/fs/cgroup/cgroup.controllers
check 'Cargo' command -v cargo
check 'rustup' command -v rustup
check 'nightly rust-src' nightly_rust_src
check 'bpf-linker' command -v bpf-linker
check 'clang' command -v clang
check 'clang BPF target for the CO-RE lesson' clang_has_bpf_target
check 'Python 3 for semantic smoke assertions' command -v python3
check 'tc for the retransmission fixture' command -v tc
check 'unshare for the namespace fixture' command -v unshare
check 'timeout for bounded fixtures' command -v timeout
check 'readelf for resolver-symbol checks' command -v readelf
check 'resolve_backend symbol when fixture is built' resolver_symbol_available
check 'root or cached non-interactive sudo for load tests' load_privilege_available

if [ "$(id -u)" -eq 0 ]; then
  printf 'ok    effective UID is root for load tests\n'
else
  printf 'note  observers use cached sudo; run sudo -v before this checker if needed\n'
fi

if [ "$failures" -ne 0 ]; then
  printf '\n%d required check(s) failed. See docs/TROUBLESHOOTING.md.\n' "$failures" >&2
  exit 1
fi

printf '\nAll required environment checks passed.\n'
