# Research ledger

This ledger records how external material supports the season. Community posts
motivate questions and describe practitioner experience; they are not treated as
representative statistics or proof that a fixture reproduces the same root cause.

| Source | Used for | Caveat |
|---|---|---|
| [Aya getting started](https://aya-rs.dev/book/) | Audience assumptions, Rust/Aya positioning, constrained eBPF runtime | Official framework documentation; implementation details can change |
| [Aya tracepoints](https://aya-rs.dev/book/programs/tracepoints.html) | Tracepoint semantics, `execve`, bounded userspace reads | Example offsets must still be checked against the target tracepoint format |
| [Linux tracepoint documentation](https://docs.kernel.org/trace/tracepoints.html) | Kernel tracepoint behavior | Describes the mechanism, not this repository’s event contract |
| [Linux BTF documentation](https://docs.kernel.org/bpf/btf.html) | `.BTF.ext` and CO-RE relocation metadata | BTF presence alone does not prove a nonzero CO-RE relocation |
| [Linux `open(2)` and `openat(2)` manual](https://man7.org/linux/man-pages/man2/open.2.html) | Relative-path, `dirfd`, return-value, and errno semantics | Syscall reference; it does not explain application configuration policy |
| [Linux `connect(2)` manual](https://man7.org/linux/man-pages/man2/connect.2.html) | Blocking return values, `ECONNREFUSED`, and non-blocking `EINPROGRESS` | Socket completion still requires application and protocol context |
| [Linux PID namespaces manual](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html) | Namespace-local PID numbering and namespace PID 1 | Runtime workload names require a separate metadata source |
| [Stack Overflow: `execve` argv/envp](https://stackoverflow.com/questions/67188440/ebpf-cannot-read-argv-and-envp-from-tracepoint-sys-enter-execve) | Real verifier and variable-memory difficulty | One implementation question, not a universal constraint recipe |
| [Stack Overflow: `openat` hooks](https://stackoverflow.com/questions/71668868/what-is-the-difference-between-syscalls-openat-and-sys-enter-openat) | Recurring confusion about hook semantics | The season makes its own hook choice for its own evidence contract |
| [Stack Overflow: nullable map value](https://stackoverflow.com/questions/77713434/bpf-probe-read-user-is-throwing-permission-denied-invalid-access-to-map-valu) | Verifier rejection language and nullable-pointer reasoning | The repository uses an original deliberately rejected program |
| [Stack Overflow: variable-length reads](https://stackoverflow.com/questions/69767533/how-do-i-copy-variable-length-data-using-bpf-probe-read-in-ebpf-programs) | Initialized-memory and bounds-checking difficulties | Used as motivation, not copied code |
| [DevOps observability discussion](https://www.reddit.com/r/devops/comments/1lf9wge/how_are_you_actually_handling_observability_in/) | Practitioner language about missing context during incidents | Anecdotal discussion; no prevalence claim |
| [Incident-debugging speed discussion](https://www.reddit.com/r/devops/comments/1szysrm/what_improved_your_incident_debugging_speed_the/) | Correlation and first-minutes context | Anecdotal and potentially self-promotional comments are not treated as data |
| [Kubernetes incident stories](https://www.reddit.com/r/kubernetes/comments/1jp0maf/whats_your_craziest_incident_with_kubernetes/) | Plausible DNS and packet-loss symptom patterns | The lab delay and network fault remain explicitly artificial fixtures |
| [Kubernetes network/DNS discussion](https://www.reddit.com/r/kubernetes/comments/1tam7qm/how_common_are_network_problems_in_a_real/) | Resolver, policy, and environment-difference hypotheses | Individual troubleshooting account, not a controlled postmortem |
| [Verifier drift discussion](https://www.reddit.com/r/eBPF/comments/1ucpldb/verifier_behavior_drift_across_kernels_how_are/) | Motivation for a kernel compatibility matrix | Community report; this repository separately tested its own GA/HWE pair |

## Firsthand evidence used in the scripts

- A clean x86_64 Ubuntu 24.04 VM built and ran all seven labs.
- The HWE suite asserted the seven positive scenarios and adversarial failure and cleanup cases.
- The safe CO-RE probe emitted syscall ID 1 on Ubuntu’s tested GA and HWE kernels.
- The deliberately unsafe nullable map dereference was rejected on both.
- Inspecting the original Rust object found BTF but a zero CO-RE relocation length; the corrected object contains nonzero relocation metadata.
- Root invalidated the first permission fixture; the corrected fixture temporarily changes effective UID.
- Interrupted `netem` testing exposed cleanup risk; the final fixture removes only a qdisc it owns.

The detailed chronology and exact environment versions are in
[`../../BUILD-JOURNAL.md`](../../BUILD-JOURNAL.md) and
[`../../docs/TESTED-ENVIRONMENTS.md`](../../docs/TESTED-ENVIRONMENTS.md).
