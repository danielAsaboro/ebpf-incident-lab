#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ] || [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  printf 'install.sh requires root on x86_64 Linux.\n' >&2
  exit 1
fi

bundle="${1:-}"
runner="${2:-}"
expected_sha="${INCIDENT_BUNDLE_SHA256:-}"
if [ ! -f "$bundle" ] || [ ! -x "$runner" ] || [ -z "$expected_sha" ]; then
  printf 'usage: INCIDENT_BUNDLE_SHA256=<sha256> sudo ./install.sh <bundle.tar.zst> <incident-web-runner>\n' >&2
  exit 1
fi

actual_sha="$(sha256sum "$bundle" | awk '{print $1}')"
if [ "$actual_sha" != "$expected_sha" ]; then
  printf 'bundle checksum mismatch: expected %s, got %s\n' "$expected_sha" "$actual_sha" >&2
  exit 1
fi

install -d -m 0700 /etc/ebpf-incident-lab /var/lib/ebpf-incident-lab
install -d -m 0755 /opt/ebpf-incident-lab/bin
tar --zstd -xf "$bundle" -C /opt/ebpf-incident-lab/bin --strip-components=2
install -m 0755 "$runner" /opt/ebpf-incident-lab/bin/incident-web-runner
install -m 0644 "$(dirname "$0")/incident-web-runner.service" /etc/systemd/system/incident-web-runner.service

if [ ! -f /etc/ebpf-incident-lab/runner.env ]; then
  token="$(openssl rand -hex 32)"
  salt="$(openssl rand -hex 32)"
  sed -e "s/replace-with-at-least-32-random-characters/$token/" -e "s/replace-with-independent-random-salt/$salt/" "$(dirname "$0")/runner.env.example" > /etc/ebpf-incident-lab/runner.env
  chmod 0600 /etc/ebpf-incident-lab/runner.env
fi

systemctl daemon-reload
systemctl enable --now incident-web-runner.service
curl --fail --silent http://127.0.0.1:8787/health
printf '\nRunner installed. Copy the generated token into Vercel through a secure channel; never commit it.\n'
