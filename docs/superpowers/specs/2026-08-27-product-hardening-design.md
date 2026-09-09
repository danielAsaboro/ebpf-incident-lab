# eBPF Incident Lab Product Hardening Design

## Goal

Turn the current working prototype into a safe, reproducible teaching product whose documented commands work from a clean Ubuntu 24.04 VM and whose automated tests prove the incident-specific evidence each lab promises.

## Constraints

- Backward compatibility is explicitly not required.
- Ubuntu 24.04 x86_64 with the 6.8 GA and current HWE kernels is the publication target.
- Learners build Rust code without privilege and elevate only the compiled observer or the narrowly scoped fixture operation.
- All observers remain bounded by `--duration`; `--json` remains NDJSON.
- Fixtures must be deterministic and must leave the VM unchanged after success, failure, or interruption.
- Video scripts remain out of scope until the product passes the complete acceptance suite.

## Public interface

Every event has a stable envelope (`timestamp_ns`, `pid`, `tgid`, `uid`, `comm`, `event_type`) plus a typed, flattened payload. No machine-readable field is hidden in a prose string. Human output is derived from the same typed representation.

The learner workflow is:

1. `./scripts/check-env.sh`
2. `./scripts/build.sh`
3. `sudo ./scripts/run-lab.sh <lab> --duration <seconds> [--pid <host-pid>] [--json]`

The launcher never builds as root. It validates the requested lab and the existence of its already-built binary, then executes that explicit binary.

## Runtime and safety

Observers emit a readiness line on stderr only after all programs have loaded, attached, and the ring buffer is available. Tests wait for readiness rather than sleeping blindly.

Lab 5 records ownership of the qdisc mutation. Cleanup runs only if this invocation successfully installed the netem qdisc. The harness refuses to touch an unexpected existing qdisc, preserves artifacts on failure, and uses bounded waits for every child.

Unknown `/proc` enrichment is represented as `null`, never a plausible PID zero. Lab 1 describes parent identity as best-effort unless it is captured reliably in the kernel.

## Lab completeness

- Lab 5 aggregates raw retransmission events in userspace by flow and emits a summary with count and latency-independent count buckets at shutdown. Raw events remain available for incident timing.
- Lab 7 contains both the verifier null-check lesson and a genuine BTF/CO-RE field relocation demonstration. Documentation distinguishes relocation portability from verifier and hook compatibility.

## Verification

Host tests validate typed decoding, flattened JSON, human rendering, aggregation, CLI bounds, launcher behavior, environment-check semantics, and cleanup ownership. Linux integration tests validate exact fixture outcomes, readiness, PID filtering, insufficient privilege, missing symbols/tracepoints, interruption cleanup, all NDJSON lines, and both verifier variants. GA and HWE runs are recorded separately.

Each lab guide contains prerequisites, exact reproduction, expected output, evidence interpretation, limitations, cleanup, exercise, a small architecture diagram, and research provenance.
