# Lab 1 — What Just Ran on My Server?

Question: which executable did the kernel start, under which host PID, UID, and command name?

## Prerequisites

Complete the root [getting-started guide](../../docs/GETTING-STARTED.md) and `./scripts/build.sh`. Compare your run with [expected output](expected-output.txt); PIDs and timestamps will differ.

## Run

Terminal 1:

```bash
sudo ./scripts/run-lab.sh 01-exec-watch --duration 10
```

Terminal 2:

```bash
/bin/sleep 2
```

The `sys_enter_execve` tracepoint copies the userspace filename into a bounded event and sends it through a ring buffer. The runner attempts to enrich `parent_pid` from `/proc/<pid>/status`; a very short-lived process may exit before that read, in which case JSON contains `null` and human output says `unknown`.

## Exercise

Run a shell script that starts two child commands. Compare the `pid`, `tgid`, `comm`, filename, and best-effort parent PID.

## Evidence boundary

This proves that `execve` was attempted. It does not prove that the new image successfully completed startup or explain why a parent launched it.

Cleanup: none; the observer detaches when its bounded duration expires.

## Architecture and research

```mermaid
flowchart LR
  C[Command] --> E[sys_enter_execve] --> B[eBPF filename event] --> R[Rust observer] --> P[/proc parent enrichment]
```

Motivation: [frequent Stack Overflow eBPF questions](https://stackoverflow.com/questions/tagged/ebpf?tab=Frequent) and [operators discussing missing incident context](https://www.reddit.com/r/devops/comments/1lf9wge/how_are_you_actually_handling_observability_in/).
