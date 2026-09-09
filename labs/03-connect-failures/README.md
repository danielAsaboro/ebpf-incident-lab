# Lab 3 — Why Can’t This Service Connect?

Question: where did a blocking `connect(2)` go, how long did it take, and which errno came back?

## Prerequisites

Complete the root [getting-started guide](../../docs/GETTING-STARTED.md) and `./scripts/build.sh`. Compare your run with [expected output](expected-output.txt); PIDs, ports, and timestamps will differ.

## Run

Terminal 1:

```bash
sudo ./scripts/run-lab.sh 03-connect-failures --duration 10 --json
```

Terminal 2:

```bash
./target/release/connect-fixture
```

The fixture opens one available loopback port, completes a successful connection, closes the listener, and retries the now-closed destination. Entry/exit state is keyed by thread ID; IPv4 and IPv6 socket addresses are decoded in the kernel event.

## Exercise

Run with `--pid <host-pid>` and confirm unrelated connections disappear. Then remove the filter and identify background noise.

## Evidence boundary

This lab is intentionally limited to blocking connects. A non-blocking socket returning `EINPROGRESS` needs readiness or socket-state correlation before success or failure is known.

Cleanup: the fixture closes its ephemeral listener automatically.

## Architecture and research

```mermaid
flowchart LR
  A[connect entry] --> M[thread state map] --> X[connect exit] --> E[destination + errno + latency]
```

Motivation: recurring [Stack Overflow eBPF questions](https://stackoverflow.com/questions/tagged/ebpf?tab=Frequent) about socket decoding, hook choice, and entry/exit correlation.
