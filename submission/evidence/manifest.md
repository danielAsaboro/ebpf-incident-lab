| Claim | Status | Evidence |
|---|---|---|
| Seven Rust/Aya incident labs exist | verified | `README.md`, lab sources, and `./scripts/test-all.sh` |
| The local x86_64 Ubuntu learner VM passed all seven scenarios | verified | `vm/acceptance/2026-09-03/README.md` |
| The public learning interface is implemented | verified | Web tests, lint, production build, and `https://ebpf-incident-lab.vercel.app` |
| Labs 01, 02, and 07 run through the hosted interface | verified | `submission/evidence/2026-09-09-hosted-smoke.md` |
| The source repository is public | verified | `https://github.com/danielAsaboro/ebpf-incident-lab` |
| A checksum-pinned public release exists | verified | `https://github.com/danielAsaboro/ebpf-incident-lab/releases/tag/v0.1.1` and `release/SHA256SUMS` |
| The custom domain is live | incomplete | Requires DNS, TLS, and signed-out browser acceptance |
| Runner requests accept only fixed operations and one active job | verified | Runner API tests and `submission/evidence/2026-09-09-hosted-smoke.md` |
| External operators completed the learning flow | unknown | Requires consented sessions; do not infer |
| Incident Lab improves diagnostic transfer | unknown | Requires baseline and changed-scenario results |
| Labs 03–06 are browser hosted | incomplete | Six-month milestone; currently local-only |
