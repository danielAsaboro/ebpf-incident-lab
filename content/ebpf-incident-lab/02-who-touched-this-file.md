# Who Touched This File—and Did It Fail?

**Episode:** 2 of 7
**Estimated runtime:** 12–15 minutes
**Audience:** Backend and DevOps engineers new to syscall tracing
**Core argument:** “The service could not read its config” is an interpretation; the syscall boundary can show the requested path and result, but only by correlating entry with exit.
**Lab:** [`../../labs/02-file-open`](../../labs/02-file-open)
**Tone:** Methodical, practical, skeptical of easy conclusions

---

## [00:00–01:30] A configuration error without a file

**VISUAL:** Service log: “failed to load configuration.” Show three plausible paths and three plausible errors branching beneath it.

**NARRATION**

```text
A service says it cannot load configuration.

That sounds precise until you try to fix it. Which file did it open? Was the path absolute or relative? Did the file not exist? Did permissions block it? Did the program open the right file and reject its contents later?

Application errors often compress several layers into one sentence. That is useful for users and dangerous for investigators. The phrase “configuration failure” can describe a missing file, a denied syscall, malformed YAML, or a perfectly readable file selected from the wrong directory.

This episode asks a narrower question: what pathname did a thread pass to openat, what flags did it use, and what did the kernel return?

Notice the last part. An entry event alone cannot answer it.
```

## [01:30–03:20] Entry tells us intent; exit tells us outcome

**VISUAL:** Timeline: thread 123 enters `openat`; thread 456 enters; thread 456 exits; thread 123 exits. Show why a single global “last path” corrupts the join.

**NARRATION**

```text
At syscall entry, the kernel can expose the pathname pointer and flags. The return code does not exist yet. At syscall exit, the return code exists, but the pathname is no longer part of that tracepoint.

We need to join two events.

That sounds easy until two threads call openat at the same time. A single global slot would allow one thread to overwrite another thread’s path. The result would look valid and be wrong—the worst kind of observability failure.

Our Aya program stores entry state in a hash map keyed by thread ID. On exit, the same thread looks up its pending state, calculates latency, emits one typed event, and removes the map entry.

Maps are not just storage for counters. Here the map is temporal memory. It lets a small eBPF program remember enough of the past to interpret a later kernel event.
```

## [03:20–05:10] Hook choice is part of the evidence contract

**VISUAL:** Compare `sys_enter_openat` tracepoint with a kprobe/fentry attached to an internal implementation. Highlight event schema versus kernel function signature.

**NARRATION**

```text
There are several places we could attach. A kprobe can target a kernel function. Fentry can provide efficient function-entry tracing where supported. A syscall tracepoint exposes the syscall event through tracefs.

These are not interchangeable spellings for the same observation. Hook choice determines which arguments exist, what their layout means, and how likely the attachment is to survive kernel changes.

For this lab, syscall tracepoints are the honest choice. We want the userspace request and the syscall return. We also inspect the tracepoint format on the machine rather than assuming offsets copied from somebody’s laptop.

The broader lesson is that eBPF does not rescue a poorly framed question. First choose the semantic boundary. Then choose the program type that observes it.
```

## [05:10–07:40] Reproduce three outcomes, not one happy path

**VISUAL:** Run the observer with JSON, wait for READY, execute `file-fixture`. Present three cards: fd ≥ 0, `ENOENT`, `EACCES`.

**ON SCREEN — TERMINAL:**

```bash
sudo ./scripts/run-lab.sh 02-file-open --duration 10 --json
./target/release/file-fixture
```

**NARRATION**

```text
The fixture performs three controlled opens: one that succeeds, one for a missing path, and one that must fail with permission denied.

That third case exposed one of our own bad assumptions while building the product. We originally created a file with mode zero and ran the fixture under the elevated workflow. Root opened it successfully. The fixture was not proving EACCES; it was proving that root can bypass ordinary permission checks.

The corrected fixture temporarily drops only its effective user ID for the denied call, restores it immediately, and cleans up its files. That is why deterministic fixtures matter. A demo that merely looks plausible can teach a false lesson.

In the events, a nonnegative return code is a file descriptor. Minus two is ENOENT: no such file or directory. Minus thirteen is EACCES: permission denied. Latency tells us how long the syscall took, not how long the application spent parsing or using the file afterward.
```

## [07:40–10:10] A captured pathname is not yet a file identity

**VISUAL:** Show `openat(dirfd, "service.conf", flags)` resolving differently under two working directories. Add a 127-byte truncation marker.

**NARRATION**

```text
It is tempting to print the path and declare the mystery solved. Slow down.

The string passed to openat may be relative. Resolving it depends on the directory file descriptor or, in a common case, the process working directory. Our event captures the string and flags, but it does not reconstruct the full mount-namespace path.

The path buffer is also deliberately bounded. Paths longer than 127 bytes are truncated. We chose that limit because eBPF’s stack is small and oversized event values create verifier and performance pressure. Truncation is a product behavior, not a footnote.

Finally, successful open does not prove successful configuration. The application may read the file and reject its contents. Conversely, a failed open might be an expected fallback: try a local override, receive ENOENT, then load the default.

The event establishes syscall behavior. Meaning still comes from context.
```

## [10:10–12:00] Read the event as a sequence, not a screenshot

**VISUAL:** Build a short incident timeline from five `file_open` events. Color expected fallback misses gray, the denied target red, and the eventual success green.

**NARRATION**

```text
One failed open is rarely a complete story. Programs probe for locale files, optional configuration, shared libraries, certificates, and fallback paths. A machine-wide capture can contain many harmless ENOENT results.

The useful unit is often a sequence scoped to one process and one action.

Imagine a service reload. First it checks an environment-specific override and receives ENOENT. Then it opens the packaged default successfully. Finally, it tries to open a private key and receives EACCES. If we sort those events only by “errors,” the first miss and the final denial look equally important. In the execution sequence, they have different roles.

This is where timestamps, thread identity, and application context meet. The eBPF event supplies kernel-level operations. A deploy marker or request trace supplies intent. The investigator reconstructs a timeline without forcing either source to explain the other layer.

Latency needs the same restraint. A slow open can reflect storage behavior, contention, automounts, or path resolution. It can also include scheduler delay around the syscall. The duration tells us where to place the next measurement; it does not identify a disk as guilty.

If this observer moved into production, I would add explicit counters for entry-map insertion failures, unmatched exits, truncated paths, and ring-buffer drops. Otherwise the tool can lose exactly the difficult events and still print a clean-looking stream.

The test of an observability product is not only whether every emitted record is valid. It is whether the product can tell you when valid records were not emitted.
```

## [12:00–14:40] Use absence and failure carefully

**VISUAL:** Checklist: observer ready, correct PID filter, entry map capacity, event present/absent. Then exercise with relative path.

**NARRATION**

```text
For the exercise, add a relative-path open to the fixture. Compare the captured string with the file you know was opened. Then explain what extra context you would need to convert that string into an absolute identity.

Also test a PID filter. A filter can reduce noise dramatically, but the filter expects the host PID. If you supply the wrong PID and see nothing, you have proved only that no matching event reached this observer during the window.

This is the reusable technique: correlate operation entry and exit using the identity of the executing thread. Remove state after use. Preserve raw return codes. Treat paths as supplied arguments, not magically canonical files.

The kernel can tell us that openat returned EACCES for this path string and these flags. It cannot tell us why the application chose that path—or whether a later fallback made the incident disappear.

Now imagine applying this to a real service. Start with the incident timestamp and the host PID—not the container-visible PID, which we will deal with later in the season. Run a short bounded capture rather than leaving a machine-wide observer open indefinitely. Reproduce one configuration reload. Then group the events by path and return code.

A sequence matters more than an isolated red line. You might see ENOENT for a local override, then a successful descriptor for the packaged default. In that case, the missing file was part of normal fallback behavior. You might see success for a path nobody expected, which moves the investigation from filesystem permissions to configuration precedence. Or you might see EACCES only after the service changed UID, which points toward ownership, mode bits, an ACL, or a security policy.

The observer does not evaluate all of those mechanisms. It gives you the exact syscall outcome that tells you which mechanism deserves inspection next.

Also watch the map lifecycle. If an entry event occurs and the thread disappears before exit, temporary state can remain until overwritten or cleaned by product logic. A production-grade observer needs capacity planning, drop accounting, and a policy for incomplete operations. This lab keeps the window and fixture bounded, but the design pressure is real.

That is a useful way to judge observability code: not by whether the happy-path screenshot looks impressive, but by what happens under concurrency, truncation, missing exits, and full maps.

Next, we apply the same entry/exit pattern to network connections, where one careless simplification—ignoring non-blocking sockets—can turn a useful observer into a confident liar.
```

## Sources and further reading

- [Linux `open(2)` and `openat(2)` manual](https://man7.org/linux/man-pages/man2/open.2.html)
- [Stack Overflow: syscall `openat` tracepoint versus a kernel-function probe](https://stackoverflow.com/questions/71668868/what-is-the-difference-between-syscalls-openat-and-sys-enter-openat)
- [Stack Overflow: attaching fentry to an open implementation](https://stackoverflow.com/questions/79621451/issue-with-fentry-bpf-program-attaching-to-open-system-call)
- [Aya: Tracepoints](https://aya-rs.dev/book/programs/tracepoints.html)
