# Why Is PID 1 Not PID 1?

**Episode:** 6 of 7
**Estimated runtime:** 13–15 minutes
**Audience:** Engineers tracing containers from the Linux host
**Core argument:** A PID is meaningful only inside a PID namespace; host-kernel observation and container-visible identity must be correlated, not treated as contradictory.
**Lab:** [`../../labs/06-namespace-pids`](../../labs/06-namespace-pids)
**Tone:** Explanatory, visual, precise about identity

---

## [00:00–01:40] Two correct PIDs for one process

**VISUAL:** Inside namespace: `echo $$` returns 1. Host `ps` shows 24500. Place “both correct” between them.

**NARRATION**

```text
Inside a container, a process says it is PID 1. In an eBPF event on the host, what appears to be the same process has PID 24,500.

Which number is wrong?

Neither.

A PID is not a universal serial number. It is a process identifier interpreted inside a PID namespace. Nested namespaces allow the same task to have one identifier visible to the host and another visible to processes inside the container.

This becomes an incident problem when an engineer copies PID 1 from a container shell into a host-level observer, sees no matching events, and concludes the tool cannot see the container.

The tool can see the shared kernel. The filter and the engineer are speaking different coordinate systems.
```

## [01:40–04:00] Containers share the kernel boundary

**VISUAL:** Host kernel under two PID namespace boxes. One task has arrows labeled host PID and namespace PID. Add cgroup ID as a separate handle.

**NARRATION**

```text
A Linux container is not a tiny virtual machine with its own kernel. Namespaces change what processes can see. Cgroups organize and constrain resources. The tasks still cross the host kernel’s execution boundaries.

At our exec tracepoint, the eBPF program records the PID and TGID in the host context plus a cgroup ID. While the task is alive, the Rust userspace process reads the NSpid line from /proc for that host PID and extracts the innermost namespace-visible identifier.

This is another example of synchronous fact plus best-effort enrichment. The host identity and cgroup ID arrive in the kernel event. Namespace PID and parent information are joined through procfs afterward.

If the process exits too quickly, that enrichment may be null. The event should reveal the missing join, not invent a zero that looks like a real identity.
```

## [04:00–06:30] Use `unshare` before adding Docker

**VISUAL:** `unshare` creates PID namespace directly. Docker logo remains an optional branch, grayed out.

**NARRATION**

```text
We use unshare for the core lab because the lesson is about the Linux namespace model, not a container runtime.

Docker would add image pulling, runtime metadata, cgroup naming, and daemon behavior. Those are valuable later. They are distractions when the first question is simply how one task receives two PID views.

In terminal one, start the observer. In terminal two, create a new PID namespace, mount an appropriate proc view, and run the fixture as its first process.
```

**ON SCREEN — TERMINAL:**

```bash
sudo ./scripts/run-lab.sh 06-namespace-pids --duration 12 --json
sudo unshare --fork --pid --mount-proc ./target/release/namespace-fixture
```

**NARRATION**

```text
The fixture stays alive for five seconds so userspace has time to enrich the event. Inside the namespace it is PID 1. The JSON event preserves the different host PID and reports namespace_pid as 1.

That five-second lifetime is part of the experiment. Without it, a fast process could vanish from procfs before the join and make a correct observer look broken.
```

## [06:30–09:20] Cgroup identity is a handle, not a container name

**VISUAL:** Numeric cgroup ID points to an enrichment service, which then points to runtime metadata and a container name. Do not draw direct ID → name equivalence.

**NARRATION**

```text
The event also includes a cgroup ID. It is tempting to label that field “container.” Do not.

A cgroup ID is a kernel identity handle. Turning it into a Kubernetes pod, Docker container, systemd unit, or workload name requires external metadata and a lifecycle-aware lookup. Cgroups can be nested. Names can be reused. Runtime state can disappear before an investigator asks.

The observer keeps the primitive identity because it is stable enough for correlation at the event boundary. A production enrichment layer could join it with container-runtime or orchestration metadata, but that join should remain distinguishable from the kernel event.

This is the same epistemic discipline we used with parent PID: preserve which layer supplied each fact.
```

## [09:20–11:50] Why the wrong filter produces convincing silence

**VISUAL:** `--pid 1` applied on host shows no event; `--pid 24500` matches. Label filter semantics “host PID.”

**NARRATION**

```text
Now add a PID filter.

The observer’s filter is evaluated against the host PID seen at the kernel boundary. Passing the namespace-visible PID 1 does not select the task whose host PID is 24,500.

This is a dangerous failure mode because the output is clean. No crash. No warning. Just silence.

That silence may lead someone to conclude eBPF cannot see containers, when the real problem is that the command-line interface did not state its namespace semantics loudly enough.

Interfaces that accept identifiers should say which coordinate system they use. Host PID is not merely an implementation detail here. It is part of the contract.
```

## [11:50–13:20] Namespace translation belongs in the interface

**VISUAL:** Mock a future CLI accepting `--host-pid`, `--container`, and `--cgroup-id`, with each resolving explicitly to a host-side filter.

**NARRATION**

```text
A production tool should not make every operator perform namespace translation by hand.

It might accept a container ID, pod identity, cgroup path, or host PID and show the resolved host-side target before attaching. What it should not do is accept a generic flag named PID and leave the namespace implicit.

Resolution also needs a time model. Container names can be reused. Pods restart. PIDs recycle. If an investigator asks about an event from twenty minutes ago, current runtime metadata may describe a different task. Durable event records should preserve the primitive IDs and the enrichment snapshot used at capture time.

This leads to a useful product split. The kernel collector should remain small and stable. A userspace identity service can watch process lifecycle and runtime metadata, maintain joins, and expose uncertainty. Trying to derive every human label inside eBPF would increase kernel-side complexity while depending on information the kernel program does not naturally own.

Privacy and tenancy appear here too. A host-wide observer can cross container boundaries. Filtering output after collection is not always equivalent to limiting collection at the source. Production design must decide who can request which scope, which metadata they may see, and how the action is audited.

The beginner lab does not implement that control plane. It makes the need visible by showing the first identity mismatch clearly.
```

## [13:20–15:00] Correlate views instead of choosing a winner

**VISUAL:** Recap table: host PID, namespace PID, cgroup ID, runtime name; source and lifetime for each.

**NARRATION**

```text
For the exercise, inspect the process from inside the namespace and with host ps. Then filter using the host PID and explain why the namespace PID does not match.

As an optional extension, repeat with Docker and correlate the event with runtime metadata. Keep Docker out of the core explanation until the namespace model makes sense.

The reusable technique is not to choose the “real” PID. It is to record the host identity at the kernel boundary, capture namespace relationships while they still exist, and enrich cgroup handles through an explicit external source.

There is a lifecycle trap hidden here. PIDs are reused. If you store only a PID and enrich it much later, you may join an event to a different process that inherited the number. Production correlation usually needs time plus a stronger lifecycle identity—such as process start time—or a map populated at fork and removed at exit.

Namespace relationships can also nest more than once. The NSpid line may contain a sequence rather than a simple host/container pair. Our event reports the innermost visible PID because that is the useful contrast for this lab. A general tool should preserve the hierarchy or state clearly which level it selects.

Security boundaries matter as well. Reading procfs can be restricted. A containerized observer may see a proc mount that does not represent the host. Capabilities and mount namespaces determine what enrichment is even possible. The eBPF hook may fire successfully while the userspace join lacks visibility.

Those are not reasons to abandon enrichment. They are reasons to make its provenance and failure mode explicit. Host PID came from the kernel event. Namespace PID came from this procfs view at this later time. Workload name, if added, came from this runtime API. Once those statements are preserved, an investigator can decide which fact remains valid after a container exits or metadata changes.

The same thinking applies outside containers. Systemd units, batch schedulers, CI runners, and serverless platforms all layer human names over kernel identities. The name is convenient. The primitive handle is correlatable. Neither should silently replace the other.

Containers do not make eBPF blind. They make identity contextual.

In the final episode, the context that changes is the kernel itself. A program can compile perfectly, carry BTF, and still fail because the verifier on the target kernel cannot prove what a newer verifier accepts.
```

## Sources and further reading

- [Linux PID namespaces manual](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html)
- [Linux `/proc/<pid>/status` manual](https://www.man7.org/linux/man-pages/man5/proc_pid_status.5.html)
- [Stack Overflow: determining a process’s namespaces from kernel space](https://stackoverflow.com/questions/48401989/how-can-i-determine-which-namespaces-a-pid-is-in-from-kernel-space/48404561)
- [Aya: cgroup programs and cgroup v2](https://aya-rs.dev/book/programs/cgroup-skb)
- [Aya: generating kernel-type bindings](https://aya-rs.dev/book/aya/aya-tool)
