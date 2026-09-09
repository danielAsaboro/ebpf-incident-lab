# Dedicated hosted runner

The hosted runner exposes three fixed operations for Labs 01, 02, and 07. It does not accept commands, code, binary uploads, paths, PIDs, durations, or environment variables from the browser.

## Reused server shape

The runner reuses Daniel's existing `hetzner` SSH host. The host was inspected on 2026-09-09 and reported Ubuntu 24.04.2 LTS on x86_64, kernel 6.8.0-136-generic, 8 GB RAM, a 75 GB root volume with 35 GB free, kernel BTF, tracefs, debugfs, and bpffs. No new server purchase is required.

Incident Lab remains isolated from the existing Floatless workloads:

- binaries: `/opt/ebpf-incident-lab/bin`
- configuration: `/etc/ebpf-incident-lab/runner.env`
- metrics: `/var/lib/ebpf-incident-lab/incident-lab.sqlite3`
- service: `incident-web-runner.service`
- loopback listener: `127.0.0.1:8787`
- tunnel hostname: `ebpf-runner.danielasaboro.com`

Port 8080 is already used on the shared host, so the runner must retain its dedicated port 8787. Do not alter the existing nginx configuration, public listeners, databases, or application services.

## Network boundary

The API binds only to `127.0.0.1:8787`. Cloudflare Tunnel is the sole ingress. Protect `ebpf-runner.danielasaboro.com` with a Cloudflare Access service-token policy and store the client ID and secret only in Vercel environment variables.

No new inbound firewall rule or public port is needed. Cloudflare Tunnel uses outbound HTTPS.

## Installation

Build `incident-web-runner` for Linux x86_64 and obtain the matching release bundle. On the host:

```bash
INCIDENT_BUNDLE_SHA256=<release-sha256> sudo ./install.sh \
  ./incident-lab-x86_64.tar.zst ./incident-web-runner
```

Install `cloudflared`, create a tunnel dedicated to Incident Lab, place the credential JSON and edited configuration under `/etc/cloudflared-ebpf-incident-lab`, and run it as `cloudflared-ebpf-incident-lab.service`. Create a Cloudflare Access service token and an application covering only the runner hostname. Do not reuse a Floatless tunnel credential or Access token.

## Operations

```bash
systemctl status incident-web-runner cloudflared-ebpf-incident-lab
journalctl -u incident-web-runner -n 100 --no-pager
curl http://127.0.0.1:8787/health
```

Set `INCIDENT_DISABLE_SESSIONS=true` in `/etc/ebpf-incident-lab/runner.env` and restart the service to stop new sessions while keeping health and the public learning site available.

Back up only the SQLite metrics database. It contains hashed requester identifiers and consented feedback, not observer output or terminal contents.
