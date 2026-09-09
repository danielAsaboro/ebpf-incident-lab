# The Verifier Is Not a Compiler Error

**Episode:** 7 of 7
**Estimated runtime:** 14–16 minutes
**Audience:** eBPF learners facing verifier and portability failures
**Core argument:** Compilation proves that an eBPF object is well-formed for a toolchain; only the target kernel verifier decides whether that program is safe there, and CO-RE does not erase this distinction.
**Lab:** [`../../labs/07-verifier-portability`](../../labs/07-verifier-portability)
**Tone:** Candid, technically rigorous, reflective

---

## [00:00–01:50] “Permission denied” can mean your pointer proof is wrong

**VISUAL:** Build succeeds. Load fails with `Permission denied`. Zoom past errno to full verifier log and highlight `map_value_or_null`.

**NARRATION**

```text
Your eBPF program compiles. The object exists. The loader runs as root.

Then the kernel says permission denied.

The obvious response is to check sudo, capabilities, lockdown mode, or sysctl settings. Sometimes that is correct. But the same errno can wrap a completely different problem: the verifier rejected the program because it could not prove a memory access safe.

Stack Overflow is full of examples where “permission denied” eventually becomes an invalid map-value access, an uninitialized stack region, unsafe pointer arithmetic, or a variable offset the verifier cannot bound.

The top-level error is not the diagnosis. The verifier log is the argument the kernel used to refuse your program.
```

## [01:50–04:20] The verifier proves paths, not intentions

**VISUAL:** Control-flow branches with register states. Map lookup returns `value-or-null`; one branch checks null, another dereferences directly and turns red.

**NARRATION**

```text
Before an eBPF program runs, the kernel verifier explores its possible execution paths. It tracks register types, pointer bounds, initialized memory, helper constraints, and the validity of accesses.

Suppose a map lookup returns a pointer that may be null. You and I might know the key was inserted one line earlier. The verifier reasons from the program and its model. Unless the control flow proves the pointer is non-null on the dereference path, the load fails.

That is not the compiler being picky. The compiler already produced bytecode. The target kernel is deciding whether this particular program can execute safely inside the kernel.

Read the log from the first state transition the verifier cannot justify. Instruction numbers vary with compiler output. The essential complaint—such as invalid access through map_value_or_null—is more portable than the line number.
```

## [04:20–06:40] Start with a program designed to fail

**VISUAL:** Run safe command, then broken variant. Place “safe event expected” and “nonzero load exit expected” cards.

**ON SCREEN — TERMINAL:**

```bash
sudo ./scripts/run-lab.sh 07-verifier-portability --duration 5 --json
sudo INCIDENT_VERIFIER_BROKEN=1 \
  ./scripts/run-lab.sh 07-verifier-portability --duration 5
```

**NARRATION**

```text
The safe variant attaches to a syscall tracepoint and emits a verifier_demo event when write activity occurs.

The broken variant deliberately performs an access the verifier cannot approve. Its failure to load is the successful test outcome. We preserve the complete error chain and identify the first unsafe state.

This inversion is useful. Most tutorials treat verifier rejection as an interruption. Here rejection is a fixture. It gives learners a stable log to read before they face a 200-line failure in their own program.

It also tests the product’s honesty. If the broken program suddenly loads after a refactor, the lab should fail. A verifier lesson without a verified rejection is theatre.
```

## [06:40–09:20] We discovered our first CO-RE claim was false

**VISUAL:** ELF object shows `.BTF.ext`, then header field `core_relo_len=0`. Cross out “therefore CO-RE.” Show corrected object with nonzero relocation metadata.

**NARRATION**

```text
This lab forced the most important correction in the whole product.

We initially built a Rust eBPF object that contained BTF and a .BTF.ext section. It looked like a CO-RE object. Then we inspected the metadata instead of trusting the section name.

The CO-RE relocation length was zero.

We had BTF information, but no field relocation for the access we claimed was portable. Saying “this demonstrates CO-RE” would have been false.

The corrected safe probe is a tiny C eBPF object with preserve-access-index metadata. It reads the syscall tracepoint’s id field through a CO-RE-annotated type. The Rust and Aya userspace runner loads the object and applies target-kernel BTF. Inspection confirms nonzero CO-RE relocation records.

Rust still powers the product interface, loading, output, and most probes. For this precise demonstration, the evidence required us to use the path that emitted a relocation we could prove existed.

Tool loyalty is not a substitute for artifact inspection.
```

## [09:20–11:20] CO-RE relocates layouts; it does not standardize verifiers

**VISUAL:** CO-RE bridge maps compile-time field to target BTF. Outside the bridge show helpers, attach points, limits, and verifier reasoning unaffected.

**NARRATION**

```text
Compile Once, Run Everywhere is an excellent name and an easy slogan to overread.

CO-RE lets a loader relocate type and field references against BTF from the target kernel. That solves a real portability problem: kernel structure layouts can differ.

It does not guarantee the target has the same helper, attach point, program limits, or verifier behavior. A community report from 2026 described pointer arithmetic accepted on newer Ubuntu kernels and rejected on 6.8—not because a helper was missing, but because verifier reasoning differed.

The right response is not to declare one kernel broken. It is to define a supported kernel matrix, test the same object across that matrix, and write programs within the oldest verifier model you intend to support—or ship feature-gated variants deliberately.

Portability is a test result, not an adjective in the README.
```

## [11:20–13:00] Test the claim on two real kernels

**VISUAL:** Matrix: Ubuntu 24.04 GA `6.8.0-134` and HWE `7.0.0-30`; safe event emits syscall ID 1 on both; unsafe variant rejected on both.

**NARRATION**

```text
We booted the clean Ubuntu VM into two kernels.

On the 6.8 GA kernel, the safe CO-RE object loaded and emitted syscall ID 1. The unsafe nullable map dereference was rejected.

On the 7.0 HWE kernel, the same safe object loaded and emitted the same field value. The unsafe program was again rejected with the same essential verifier state.

That does not prove compatibility with every 6.8 or 7.0 distribution kernel, every architecture, or future verifier. It proves these observed results on two recorded environments. The tested-environments matrix says exactly that and nothing more.

This level of specificity makes a compatibility claim smaller. It also makes it credible.
```

## [13:00–14:20] Design the compatibility matrix before release day

**VISUAL:** Matrix axes: kernel family, architecture, BTF, program feature. Cells contain load, attach, semantic fixture, and cleanup results—not simple green checkmarks.

**NARRATION**

```text
A serious compatibility matrix begins with users, not with whatever kernels happen to be installed on a developer laptop.

Choose the oldest supported kernel families, current distribution kernels, and architectures you intend to claim. For each environment, separate four results: did the object load, did the program attach, did a controlled fixture produce the expected semantic event, and did cleanup restore the machine?

A green load test is not enough. The program can attach to the wrong hook, decode an outdated layout, or emit plausible nonsense. Our TCP lab checks the target tracepoint format. Our CO-RE lab asserts the relocated syscall ID. The fixtures test meaning, not just syscalls returning success.

Keep failures as artifacts. Preserve verifier logs, environment-check output, object metadata, and fixture output with the kernel release. Compatibility bugs are difficult to investigate when CI retains only a red icon and the final line of stderr.

Also decide how new features enter the matrix. If a new helper improves performance on modern kernels, you can keep a legacy implementation and select at runtime. If a new attach type changes semantics, it may deserve a separate observer rather than a silent fallback. Backward compatibility is not always the right product decision—but accidental compatibility is never a strategy.

The tested matrix in this repository is intentionally small. It is evidence for a fellowship pilot, not a universal support promise. Expanding it to ARM64 and more distribution kernels is future work that should be reported only after those machines produce real results.
```

## [14:20–15:50] The season’s final debugging technique

**VISUAL:** Seven episode cards collapse into a single method: boundary → controlled fixture → typed evidence → limitation → next probe.

**NARRATION**

```text
For the exercise, save the complete verifier log from both kernels. Find the earliest point where the unsafe path loses a proven non-null pointer. Compare the meaning of the failure, not merely instruction numbers.

The reusable technique is to separate four layers: compiler success, object metadata, loader relocation, and target-kernel verification. Test each layer with evidence appropriate to that layer.

For compiler success, keep the build reproducible and record the toolchain. For object metadata, inspect the ELF rather than inferring features from a crate name or build flag. For relocation, load against real target BTF and verify the relocated field produces the expected value. For verifier behavior, retain the full log and test every supported kernel family.

Feature detection belongs in that pipeline too. Missing BTF, an unavailable tracepoint, an unsupported helper, and insufficient privilege should not collapse into one troubleshooting paragraph. They are different failures with different remedies. Our environment checker and adversarial suite exercise those paths before a learner encounters them during a recording.

This is not overengineering around a seven-line probe. The loader and its error behavior are part of every eBPF product. A beautiful kernel program that fails opaquely on the learner’s machine is a broken educational product.

That same discipline connects all seven incident labs.

We did not ask eBPF to explain an entire outage. We chose one boundary. We created a controlled symptom. We emitted typed evidence. We tested failure paths. And we stated what the event could not prove.

That is the real promise of eBPF for incident response. Not omniscience. Not a replacement for logs or traces. A new set of independent witnesses at boundaries that used to be difficult to observe—and a responsibility to question those witnesses as carefully as any other evidence.
```

## Sources and further reading

- [Linux kernel BTF and `.BTF.ext` documentation](https://docs.kernel.org/bpf/btf.html)
- [Aya: kernel-type bindings and CO-RE](https://aya-rs.dev/book/aya/aya-tool)
- [Stack Overflow: invalid access to a nullable map value](https://stackoverflow.com/questions/77713434/bpf-probe-read-user-is-throwing-permission-denied-invalid-access-to-map-valu)
- [Stack Overflow: uninitialized buffers and verifier rejection](https://stackoverflow.com/questions/69767533/how-do-i-copy-variable-length-data-using-bpf-probe-read-in-ebpf-programs)
- [Reddit: verifier behavior drift across kernels](https://www.reddit.com/r/eBPF/comments/1ucpldb/verifier_behavior_drift_across_kernels_how_are/)
