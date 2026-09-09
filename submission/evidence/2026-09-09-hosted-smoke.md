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

## Isolation and failure handling

- Concurrent sessions `b5fcd28c-3a86-4a58-96f6-efc64ea1eee2` and `214f34b9-475a-434e-b818-4ed28edb745c` proved one-active-job queueing. The first emitted only `process_exec`; the second emitted only `verifier_demo`; both completed and left no observer or fixture process.
- Disconnect session `fc8a9580-293d-4aa9-9a16-06dd6b11d567` completed after its SSE client disconnected and left no child process.
- Restart session `8a2f2f14-3672-4010-b66a-4f66eb9bff81` was interrupted by a service restart. Systemd killed the process group, and startup recovery persisted `failed|service_restart` rather than leaving a false running result.
- The emergency switch returned HTTP 503 for a new session while disabled. Re-enabling it restored an explicit healthy response for runner version 0.1.1.
