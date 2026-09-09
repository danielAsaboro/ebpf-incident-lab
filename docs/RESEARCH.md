# Research provenance

Community discussions are used to identify recurring symptoms and misconceptions. All fixtures, code, wording, diagrams, and expected output in this repository are original.

| Lab | Motivating material | Problem carried into the lab |
|---|---|---|
| 1 | [Stack Overflow's frequent eBPF questions](https://stackoverflow.com/questions/tagged/ebpf?tab=Frequent), [DevOps observability discussion](https://www.reddit.com/r/devops/comments/1lf9wge/how_are_you_actually_handling_observability_in/) | Operators often lack kernel-level process context when application logs are absent. |
| 2 | [Tracepoint versus kprobe for `openat`](https://stackoverflow.com/questions/71668868/what-is-the-difference-between-syscalls-openat-and-sys-enter-openat) | Hook choice and entry/exit correlation determine whether pathname and errno can appear together. |
| 3 | [Stack Overflow's frequent eBPF questions](https://stackoverflow.com/questions/tagged/ebpf?tab=Frequent) | Socket address decoding and blocking versus non-blocking completion are easy to conflate. |
| 4 | [Kubernetes DNS incident discussion](https://www.reddit.com/r/kubernetes/comments/1jp0maf/whats_your_craziest_incident_with_kubernetes/) | “DNS is slow” needs a measured boundary; the lab uses an explicitly artificial delay. |
| 5 | [Linux TCP trace event definition](https://github.com/torvalds/linux/blob/master/include/trace/events/tcp.h) | A retry counter is more useful when it is tied to the kernel-provided flow tuple. |
| 6 | [Determining a PID's namespaces from kernel space](https://stackoverflow.com/questions/48401989/how-can-i-determine-which-namespaces-a-pid-is-in-from-kernel-space/48404561) | A host PID and namespace-visible PID can identify the same task without being numerically equal. |
| 7 | [Verifier map-value example](https://stackoverflow.com/questions/79095876/bpf-probe-read-user-permission-denied-invalid-access-to-map-value-in-an-ebp), [kernel verifier drift discussion](https://www.reddit.com/r/eBPF/comments/1ucpldb/verifier_behavior_drift_across_kernels_how_are/) | The final permission error is less useful than the verifier state transition that precedes it. |

Primary implementation references:

- [Aya Book](https://aya-rs.dev/book/)
- [Aya template](https://github.com/aya-rs/aya-template)
- [Linux trace-event format documentation](https://github.com/torvalds/linux/blob/master/Documentation/trace/events.rst)
- [eBPF Foundation fellowship requirements](https://ebpf.foundation/funding-opportunities/community-advocacy-fellowship-program/)
