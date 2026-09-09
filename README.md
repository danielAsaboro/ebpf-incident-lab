# eBPF Incident Lab

Seven incident-first Linux observability labs built with Rust and [Aya](https://aya-rs.dev/). Each lab starts from a reproducible production symptom and produces bounded human-readable or newline-delimited JSON output.

This repository is the product behind **eBPF Incident Lab: Debugging Linux with Rust and Aya**. The runnable labs were validated before writing the complete [article-first season scripts](content/ebpf-incident-lab/README.md).

The public learning application is available at [ebpf-lab.danielasaboro.com](https://ebpf-lab.danielasaboro.com). Its source lives in [`web/`](web/), while the fixed-operation service for hosted Labs 01, 02, and 07 lives in [`crates/incident-web-runner/`](crates/incident-web-runner/). Hosted Labs 01, 02, and 07 have returned real observations through the Vercel API; current deployment evidence is tracked in [`submission/evidence/manifest.md`](submission/evidence/manifest.md).

## What works today

- One shared, `#[repr(C)]` wire protocol for all kernel-to-userspace events
- Seven independent CLI observers with `--duration`, applicable `--pid`, and `--json`
- Deterministic fixtures for file access, TCP connect, resolver latency, retransmission, and PID namespaces
- An Aya build pipeline that compiles the eBPF object and embeds it in each userspace binary
- Host-side contract tests plus privileged Linux smoke tests
- A tested Lima/QEMU Ubuntu 24.04 x86_64 learner VM that runs verified prebuilt observers without compiling

The [tested environments](docs/TESTED-ENVIRONMENTS.md) page distinguishes verified combinations from intended targets. Do not infer production support from a successful lab run.

## Architecture

```mermaid
flowchart LR
    F[Deterministic fixture] --> K[Linux syscall / function / TCP path]
    K --> P[Aya eBPF program]
    P --> M[Ring buffer]
    M --> U[Rust userspace runner]
    U --> H[Human table]
    U --> J[NDJSON]
    R[/proc enrichment] --> U
```

The kernel program only collects evidence. It does not block operations, alter packets, or claim application-level causality.

## Recommended quick start on macOS

Version one uses Lima 2.0 or newer and a checksum-verified local learner bundle.
Download the checksum-pinned v0.1.1 learner bundle using the [local VM guide](vm/README.md), then run:

```bash
./scripts/lab-vm.sh start
./scripts/lab-vm.sh doctor
./scripts/lab-vm.sh shell
```

Inside the guest, `incident-lab run 01 --duration 10` reaches a real eBPF
observation without installing or compiling a Rust toolchain.

## Contributor setup on Ubuntu 24.04

```bash
./scripts/check-env.sh
./scripts/build.sh
sudo ./scripts/run-lab.sh 01-exec-watch --duration 10
```

Run a fixture in another terminal while the observer is active. For example:

```bash
/bin/sleep 2
```

Use JSON or a host-PID filter consistently across applicable labs:

```bash
sudo ./scripts/run-lab.sh 02-file-open --duration 10 --json
sudo ./scripts/run-lab.sh 03-connect-failures --duration 10 --pid 1234
```

See [Getting started](docs/GETTING-STARTED.md) for learner and contributor paths and [Troubleshooting](docs/TROUBLESHOOTING.md) for errors by visible message.

## Labs

1. [What Just Ran on My Server?](labs/01-exec-watch/README.md)
2. [Who Touched This File—and Did It Fail?](labs/02-file-open/README.md)
3. [Why Can’t This Service Connect?](labs/03-connect-failures/README.md)
4. [Is DNS Actually the Slow Part?](labs/04-dns-latency/README.md)
5. [Why Does the Network Keep Retrying?](labs/05-tcp-retransmits/README.md)
6. [Why Is PID 1 Not PID 1?](labs/06-namespace-pids/README.md)
7. [Reading Verifier Errors and Surviving Kernel Drift](labs/07-verifier-portability/README.md)

## Evidence and limitations

- Events can be dropped when the ring buffer is full.
- Entry/exit correlation is keyed by thread ID and bounded by map capacity.
- `--pid` refers to the host PID. Namespace-visible PID enrichment is best effort through `/proc`.
- The connect lab covers blocking `connect(2)` calls. An `EINPROGRESS` return requires a different completion signal.
- CO-RE and BTF do not make every program portable across verifier versions or kernel features.
- These labs complement logs, metrics, and application tracing; they do not replace them.

The implementation record, including invalid assumptions and corrections, is in [BUILD-JOURNAL.md](BUILD-JOURNAL.md).
Research provenance and source links are collected in [docs/RESEARCH.md](docs/RESEARCH.md).

To report a reproducible problem or propose a reviewed lab improvement, see [Contributing](CONTRIBUTING.md).

## License

Userspace code is available under MIT or Apache-2.0. The eBPF object declares `Dual MIT/GPL`, matching the kernel’s accepted eBPF license convention while retaining the repository’s dual-license terms.
