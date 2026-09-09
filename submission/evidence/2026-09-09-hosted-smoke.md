# Hosted runner smoke — 2026-09-09

This record separates observed deployment behavior from planned claims.

## Environment

- Existing shared Hetzner host reused; no server purchase.
- Ubuntu 24.04.2 LTS, x86_64, kernel 6.8.0-136-generic.
- Kernel BTF, bpffs, tracefs, and debugfs present.
- Runner bound only to `127.0.0.1:8787`.
- Dedicated systemd services: `incident-web-runner.service` and `cloudflared-ebpf-incident-lab.service`.
- Cloudflare Tunnel connector version 2026.8.3, downloaded from the official release and checked against its published SHA-256.

## Direct host run

Each run used the public API contract with the server-side token and a fixed lab ID. No command, path, PID, program, duration, or environment value came from the request.

| Lab | Session | Observations | Terminal result |
|---|---|---:|---|
| 01 | `f47e6660-a64c-402b-8c36-a3a45c5ea71a` | 1 | completed; cleanup finished |
| 02 | `97de4e62-f465-4a88-bd8f-b2e3e064099e` | 10 | completed; cleanup finished |
| 07 | `5bd4eca2-fff2-40f0-b864-fe091b3a7171` | 1 | completed; cleanup finished |

Lab 02 initially filled the event buffer with unrelated host activity. The release was corrected to start its fixed fixture paused, scope the observer to that fixture PID, reserve capacity for the terminal event, and cover the terminal reservation with a regression test. The table above records the successful rerun after that correction.

## Vercel-to-kernel run

Vercel production alias `https://ebpf-incident-lab.vercel.app` created Lab 01 session `441d6ecb-548b-4d88-b731-2ecef98817f1`. Its SSE response contained one real `process_exec` observation for `/bin/sleep`, followed by `Observation completed and cleanup finished.`

This proves one deployed end-to-end path. It does not prove external learner adoption, pedagogical effectiveness, universal kernel support, or production-scale capacity.
