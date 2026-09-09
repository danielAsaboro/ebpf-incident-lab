# What Just Ran on My Server?

**Episode:** 1 of 7
**Estimated runtime:** 13–15 minutes
**Audience:** Backend and DevOps engineers comfortable with basic Linux
**Core argument:** When application logs cannot tell you what started, the kernel execution boundary supplies independent evidence—but it records an attempt, not the whole story.
**Lab:** [`../../labs/01-exec-watch`](../../labs/01-exec-watch)
**Tone:** Investigative, skeptical, beginner-friendly

---

## [00:00–01:20] The process nobody remembers starting

**VISUAL:** Begin on an incident card: “CPU spike. Unknown process. No deploy in progress.” Cut to `ps`, then an application log search returning nothing. Do not show eBPF yet.

**NARRATION**

```text
Imagine you are on call and a process appears on a server.

It is short-lived. It burns CPU, touches a few files, and disappears before the dashboard finishes refreshing. The application logs do not mention it. The deployment system says nothing changed. Nobody on the team remembers running it.

The natural question is: what just ran?

But that question hides three different questions. Which executable did the operating system attempt to start? Which process asked for it? And did the new program actually make it far enough to do useful—or harmful—work?

Most teams begin inside the application. They search logs, inspect service managers, and ask whether a deploy happened. Those are sensible moves. They are also dependent on the very software whose story we are trying to verify.

This lab starts somewhere else: at the boundary every ordinary Linux process must cross when it asks the kernel to replace itself with a new executable image.
```

## [01:20–03:10] Logs are testimony; kernel events are another witness

**VISUAL:** Diagram two evidence paths. Left: application → logger → collector. Right: process → `execve` → kernel tracepoint. Highlight that neither path is “the truth,” but they fail differently.

**NARRATION**

```text
Application logs are not useless. Far from it. They contain intent and business context the kernel will never understand.

But logs are testimony produced by application code. They can be missing because the logger was misconfigured, because the process failed before initialization, because output went to the wrong place, or because the code simply never recorded the event.

Operators describe production debugging as detective work with missing pages. The painful part is often not applying a fix. It is reconstructing enough context to know which fix belongs to the incident.

eBPF gives us a second witness. We can observe selected kernel events without modifying the application. That does not make the kernel omniscient. It gives us evidence produced at a different layer, with different blind spots.

That distinction is the thesis of this entire series: observability gets stronger when independent layers can corroborate or contradict one another.
```

## [03:10–05:00] Why `execve` is the useful boundary

**VISUAL:** Animate a shell process crossing `sys_enter_execve`, with filename pointer, PID/TGID, UID, and command name becoming a compact event.

**NARRATION**

```text
On Linux, a program commonly starts when a process calls execve. Despite the familiar phrase “start a process,” execve does not create a new process. It replaces the calling process image. A shell may fork first, then the child calls execve.

Linux exposes a tracepoint named sys_enter_execve. A tracepoint is a deliberately placed kernel observation point with a described event format. Compared with attaching to an arbitrary internal kernel function, a syscall tracepoint gives this beginner lab a clearer and more stable contract.

Our eBPF program attaches there. When the tracepoint fires, it collects a bounded filename plus the identity fields available at that moment: timestamp, PID, thread-group ID, user ID, and command name. It copies the event into a ring buffer. A Rust program built with Aya reads that buffer and renders either human-readable output or newline-delimited JSON.

The important design decision is what we do not collect. We do not dump an unlimited argument list or environment. eBPF has a small stack, no ordinary heap, and a verifier that must prove memory accesses safe before the program can load. “Collect everything” is not a serious first design. A small event that loads reliably beats an ambitious observer the kernel rejects.
```

## [05:00–06:30] Build without giving Cargo root

**VISUAL:** Split terminal. First run the environment checker and build script as the normal user. Then show the narrowly elevated launcher. Put a red strike through `sudo cargo run`.

**NARRATION**

```text
Before we run the observer, notice the privilege boundary.

Building Rust code does not require root. Loading and attaching this eBPF program does. Those are different jobs, so the repository treats them differently.

First we run the environment checker. It verifies the kernel version, BTF, tracefs, required tracepoints, Rust toolchains, bpf-linker, and the other tools used across the season. Then we build every observer and fixture as the normal user.
```

**ON SCREEN — TERMINAL:**

```bash
./scripts/check-env.sh
./scripts/build.sh
```

**NARRATION**

```text
Only the already-built observer is elevated. This avoids a surprisingly common tutorial mistake: putting Cargo, build scripts, and dependency behavior behind sudo simply because the final kernel operation needs privilege.
```

**ON SCREEN — TERMINAL:**

```bash
sudo ./scripts/run-lab.sh 01-exec-watch --duration 10
```

## [06:30–09:30] Make one known event and read it carefully

**VISUAL:** Wait until stderr prints `READY`. In a second terminal execute `/bin/sleep 2`. Freeze the emitted event and label each field.

**NARRATION**

```text
The observer prints READY only after the program has loaded, attached, and opened the ring buffer. That is not cosmetic. If a fixture starts before the observer is attached, a missing event could mean either “nothing happened” or “we were not listening yet.” Readiness removes that ambiguity from the lab.

Now, in a second terminal, we create one event whose explanation we already know.
```

**ON SCREEN — TERMINAL:**

```bash
/bin/sleep 2
```

**NARRATION**

```text
The output says a process attempted execve with the filename /bin/sleep. PID and TGID are equal because this event came from the process’s main thread. UID tells us which user identity made the call. The comm field is the calling task’s short command name at the tracepoint. It may still look like the shell or launcher, because the replacement image has not completed yet.

Parent PID is different. Our eBPF event does not pretend to contain data it did not reliably capture. The userspace runner tries to enrich the event from /proc. If the process exits before userspace reads its status, parent_pid becomes null. That null is not an embarrassing hole to hide. It is an honest representation of a race.

This separation—kernel fact first, best-effort enrichment second—is reusable. It lets downstream consumers distinguish what was observed synchronously from what was joined later.
```

## [09:30–11:30] The event proves less than its title suggests

**VISUAL:** Replace the event card with two branches: `execve attempted` → success or failure. Overlay “No exit hook in this lab.”

**NARRATION**

```text
Now for the part most demos skip.

We attached to syscall entry. The event proves that execve was attempted with this filename pointer and identity. It does not prove the kernel successfully replaced the process image. The file might not exist. Permission checks might fail. The loader might reject the binary.

It also does not explain motive. If a shell launches curl, the kernel can show us that execution boundary. It cannot tell us whether an administrator was testing connectivity, a deployment hook was downloading an artifact, or an attacker was fetching a payload.

And a filename is not automatically a trustworthy identity. Paths can be relative. Files can change. A process can use execveat. Interpreters add another layer between a script and the executable image.

So the correct conclusion is narrower than “we know what happened.” We know a specific process attempted a specific execution operation at a specific time. That is enough to move an investigation forward, but not enough to close it.
```

## [11:30–13:20] Turn one event into an investigation

**VISUAL:** Run a small shell script that starts two commands. Then switch to `--json` and pipe two sample lines into `jq`. Show parent-child grouping.

**NARRATION**

```text
For the exercise, create a shell script that starts two child commands. Run the observer again and compare filename, comm, PID, TGID, and parent PID.

Do not rush to memorize the fields. Ask what relationship each field can support. Filename helps identify the requested executable. PID locates the host task at that instant. Parent PID may connect the event to a launcher, service manager, or shell. UID narrows the security identity. Timestamp lets us correlate with logs and metrics from other systems.

Then repeat with JSON output. Each line is a complete typed object, while diagnostics remain on stderr. That means you can store the evidence, filter it, or join it with another incident timeline without scraping a decorative table.

The product here is not merely an eBPF program. It is a small, testable evidence pipeline: known stimulus, explicit readiness, bounded observation, typed output, and an evidence boundary.
```

## [13:20–14:30] The reusable technique

**VISUAL:** Recap card: “Choose a boundary. Capture the minimum. Separate fact from enrichment. State what remains unknown.” Preview the next episode’s `openat` entry/exit join.

**NARRATION**

```text
The reusable technique from this first lab is simple.

Choose a kernel boundary that answers one question. Capture the minimum event that can survive the verifier and production noise. Separate synchronous facts from racy enrichment. Then state what remains unknown before somebody turns an observation into a verdict.

If this were moving from a lab to a fleet, several new requirements would appear. The observer would need to report ring-buffer drops. It would need a policy for sensitive filenames and possibly arguments. It would need allow-lists, cgroup filters, or sampling so a busy build host did not produce an uncontrolled stream. It would need a durable way to identify its own version and the schema of every event.

Most importantly, it would need an answer for success versus attempted execution. One option is to correlate syscall entry and exit. Another is to observe a later process lifecycle hook whose semantics match the operational question. That is not “finishing” this beginner program. It is choosing a new evidence contract.

This distinction prevents a common product failure: a prototype proves one useful fact, and its interface quietly expands the wording until users believe it proves five. The code may remain correct while the product claim becomes wrong.

Application logs tell us what software chose to say. The execve tracepoint tells us what a process asked the kernel to do. During an incident, the disagreement between those stories may be the most useful clue you have.

In the next episode, we need more than an entry event. A service cannot read its configuration, and knowing that it called openat is not enough. We have to follow the operation all the way to its return value—and correlate both halves without confusing concurrent threads.
```

## Sources and further reading

- [Aya: Tracepoints](https://aya-rs.dev/book/programs/tracepoints.html)
- [Aya: Getting started and eBPF constraints](https://aya-rs.dev/book/)
- [Linux kernel tracepoint documentation](https://docs.kernel.org/trace/tracepoints.html)
- [Stack Overflow: reading `argv` and `envp` at `sys_enter_execve`](https://stackoverflow.com/questions/67188440/ebpf-cannot-read-argv-and-envp-from-tracepoint-sys-enter-execve)
- [DevOps discussion: observability and missing incident context](https://www.reddit.com/r/devops/comments/1lf9wge/how_are_you_actually_handling_observability_in/)

Community posts are used as evidence of practitioner experience, not as universal incident statistics.
