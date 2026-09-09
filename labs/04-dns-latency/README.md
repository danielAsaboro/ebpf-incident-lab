# Lab 4 — Is DNS Actually the Slow Part?

Question: how much time does a known resolver wrapper spend between function entry and return?

## Prerequisites

Complete the root [getting-started guide](../../docs/GETTING-STARTED.md) and `./scripts/build.sh`. Compare your run with [expected output](expected-output.txt); PIDs and measured latency will differ.

## Run

Build the target first so its symbol path is stable:

```bash
./scripts/build.sh
export INCIDENT_DNS_FIXTURE="$PWD/target/release/dns-fixture"
```

Terminal 1:

```bash
sudo --preserve-env=INCIDENT_DNS_FIXTURE ./scripts/run-lab.sh 04-dns-latency --duration 10 --json
```

Terminal 2:

```bash
./target/release/dns-fixture localhost 0
./target/release/dns-fixture localhost 500
```

Aya attaches a uprobe and uretprobe to the exported `resolve_backend` symbol. The delay is a deterministic incident fixture; it is not presented as organic DNS behavior.

## Exercise

Run delays of 10, 100, and 500 ms and compare emitted `latency_us`. Explain which part is fixture delay versus actual resolver work.

## Evidence boundary

This proves time spent inside this wrapper. It does not split libc, cache, NSS, network, or DNS-server time without additional probes.

Cleanup: uprobes detach when the observer exits.

## Architecture and research

```mermaid
flowchart LR
  U[resolve_backend entry uprobe] --> M[thread state map] --> R[return uprobe] --> E[hostname + measured duration]
```

Motivation: [production Kubernetes incident stories involving DNS](https://www.reddit.com/r/kubernetes/comments/1jp0maf/whats_your_craziest_incident_with_kubernetes/). The delay here remains explicitly artificial.
