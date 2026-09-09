# Build journal

This is an engineering record, not a polished success story. It captures assumptions that changed while building the labs.

## 2026-08-27 — contracts before probes

The first implementation boundary is a shared `#[repr(C)]` event protocol. Tests lock down plain-old-data event layouts, stable identity fields, decoding, JSON lines, PID filters, and `/proc` namespace parsing before kernel programs depend on them.

Decision: paths are capped at 128 bytes. The initial instinct was a much larger “safe” path buffer, but eBPF’s small stack makes oversized per-event values a verifier risk. Truncation is explicit and preferable to an unloadable teaching program.

## 2026-08-27 — the build environment was not ordinary Cargo

Wrong assumption: a stable Rust container plus Cargo would be sufficient. Aya’s eBPF build requires a nightly toolchain with `rust-src`, while the userspace project remains on stable Rust.

Wrong assumption: installing helper tooling from source would be the most portable container setup. On ARM64, compiling `cargo-binstall` pulled more than 500 packages and hit an already-low Docker Desktop storage ceiling. The development image now bootstraps the prebuilt `cargo-binstall` binary, which then installs the prebuilt `bpf-linker` artifact.

Wrong assumption: sharing Cargo's default `target/` directory between macOS and a Linux container was harmless. It can mix incompatible host artifacts. The documented container command now builds into an isolated temporary target directory.

Result: the full release object and all seven userspace binaries compile inside the Linux development VM.

## 2026-08-27 — type inference stopped at the ring-buffer boundary

The eBPF compiler could not infer the event type for `RingBuf::output` from a raw event reference. Each emission now specifies its wire type explicitly. Rebuilding the identical target confirmed that this—not the kernel, linker, or Aya version—was the cause.

## 2026-08-27 — privileged container did not mean ready tracing environment

Wrong assumption: `--privileged` implied tracefs would already be mounted. Docker Desktop exposed BTF but not `/sys/kernel/tracing/events`, and Aya returned `tracefs not found`. Mounting tracefs inside the disposable container made the exec observer attach and emit real NDJSON.

Product change: `check-env.sh` treats BTF and tracefs as separate gates, and troubleshooting preserves their distinct remedies.

## 2026-08-27 — root invalidated the permission fixture

Wrong assumption: a `000` file would demonstrate `EACCES`. The observer is run as root, and root opened it successfully. The fixture now drops only its effective UID for the permission-denied syscall, restores it immediately, and cleans up afterward.

## 2026-08-27 — a duration flag is not bounded unless hot paths check it

Wrong assumption: checking the deadline around the ring-buffer drain loop guaranteed a bounded observer. A busy `openat` tracepoint kept the buffer continuously nonempty, so the inner loop never returned to the deadline. The runner now checks the deadline per record and caps each drain batch. This was found only by running the fixture against the loaded program; compilation and unit tests could not reveal it.

## 2026-08-27 — “looks unsafe” did not guarantee verifier rejection

Wrong assumption: a far out-of-bounds direct tracepoint-context read would be a deterministic verifier failure. On the LinuxKit test kernel the program loaded and failed only at link attachment, which teaches the wrong lesson. The rejected variant now dereferences a nullable map lookup without checking it. Acceptance requires failure during program load and a verifier explanation about the unchecked map-value-or-null state.

## 2026-08-27 — uprobes and shared host filesystems

The DNS uprobe returned `perf_event_open: EIO` when its target lived on Docker Desktop's macOS-shared mount. The same binary copied to the Linux VM's native `/tmp` filesystem attached and measured a 200 ms fixture at roughly 205 ms. This limitation is specific to the development topology; native Ubuntu remains the supported learner path.

## 2026-08-27 — probabilistic packet loss made the fixture unbounded

Wrong assumption: 25% loss across 20 sequential requests would be a friendly demo. It produced useful retransmission events but could leave a request in TCP backoff beyond the fixture timeout. The scenario now applies 100% loss for a short controlled window to a single request, removes the qdisc, and lets the retry complete. The cleanup trap remains mandatory.

## 2026-08-27 — clean Ubuntu x86_64 acceptance

An official Ubuntu 24.04.4 x86_64 cloud image booted under Lima/QEMU with kernel `6.8.0-134-generic`. From a clean copy on the VM's native disk, the host contract suite passed, the release eBPF/userspace build completed, the environment checker passed, and all seven live scenarios passed. The release build took roughly 18 minutes under cross-architecture emulation; that is validation evidence, not a recommended learner workflow.

The VM was then upgraded to Ubuntu's current `linux-generic-hwe-24.04`, kernel `7.0.0-30-generic`. Lab 7's safe program loaded and emitted an event. The deliberately unsafe program was rejected on both kernels with the same essential verifier state: `R0 invalid mem access 'map_value_or_null'`.

Wrong assumption: a newly edited file on Lima's macOS shared mount would be immediately coherent. One checker copy was truncated at line 58 and produced a misleading Bash quote error. Transferring through `limactl copy` produced the intact 73-line file. Runtime acceptance sources were likewise copied to the VM's native disk.

## Known gaps that are not being hidden

- The fast-process parent PID and namespace PID enrichment can race with process exit because it reads `/proc` in userspace. Long-lived fixtures are deterministic; instant commands report `null`/`unknown`, never a plausible PID zero.
- The TCP retransmission event carries the tracepoint's flow tuple and its offsets are checked against the running kernel's `format` file. The runner now emits deterministic per-flow totals; latency histograms are intentionally omitted because retransmission events do not contain a request-latency measurement.
- Video scripts, thumbnails, and editing assets are deliberately deferred until the product passes those gates.

## 2026-08-27 — adversarial v0.2 hardening

Wrong assumption: valid JSON was automatically reusable JSON. The first interface placed every incident-specific value in a prose `detail` string. The v0.2 contract flattens typed payload fields into NDJSON and derives human output from the same values.

Wrong assumption: a cleanup trap was safe merely because it ran on exit. The original trap deleted the loopback root qdisc even when the harness had refused to replace an unexpected pre-existing qdisc. Cleanup now tracks mutation ownership and deletes only a qdisc created by that invocation. An interruption test waits until netem is active, terminates the fixture, and verifies restoration.

Wrong assumption: `sudo cargo run` was a usable learner command. Rustup's Cargo is normally absent from sudo's secure path. Builds now run unprivileged through `scripts/build.sh`; `scripts/run-lab.sh` elevates only an explicit prebuilt observer.

Wrong assumption: `.BTF.ext` proved a Rust eBPF object contained CO-RE field relocations. Its `core_relo_len` was zero. Lab 7 now uses a minimal Clang-built CO-RE object with a nonzero 28-byte relocation block, while Aya remains the loader and Rust remains the event consumer. The runner also parses target-kernel BTF before calling this a CO-RE demonstration.

Wrong assumption: a successful file open returned zero. `openat` returns a nonnegative file descriptor; the strict semantic assertion caught a real value of 3 and was corrected to accept any nonnegative descriptor while still requiring `ENOENT` and `EACCES`.

The HWE acceptance run now checks exact evidence for all seven labs plus wrong PID filtering, missing uprobe symbol, missing tracepoint, insufficient privilege, hidden BTF, verifier rejection, and interrupted network cleanup. The same CO-RE object emitted syscall ID 1 and the unsafe Rust variant was rejected on both 7.0 HWE and 6.8 GA.

## 2026-08-27 — article-first season audit

Wrong assumption: timestamp labels alone made a script a 15-minute production
document. The first editorial pass left several episodes near 1,000 spoken words,
which would force either a short edit or unexplained dead air. The final scripts
contain 1,200–1,400 spoken words plus timed terminal demonstrations and diagram
inspection. A repository validator now enforces the minimum rather than trusting
the heading.

The article review also caught a contradiction in Lab 7's guide. It described
the rejected program as an out-of-bounds tracepoint read, while the implemented
fixture dereferences a nullable map lookup. The guide and episode now match the
tested `map_value_or_null` verifier failure.

Publication readiness is separated from fabricated publication evidence. The
repository includes descriptions, chapter labels, accessibility rules, and a
caption checklist, but no video URL or learner feedback is recorded until it
actually exists.

## 2026-09-03 — reproducible local learner VM

The workspace is still not a Git repository, so worktree isolation and commit
checkpoints were unavailable. The stopped `ebpf-incident-x86` evidence VM was
preserved. Its twelve x86_64 release executables matched current runtime Rust
sources and passed the current no-build seven-lab/adversarial suite on native
storage. The deterministic 1.1 MB bundle matched SHA-256
`f96cdf3f47175f7d2cd024bb6f9269c02d169d536730b5740727a1600c8e91b2`
before and after transfer. No public artifact URL exists.

Wrong assumption: doctor could read tracepoint metadata as `lima`. Tracefs was
correctly root-only; `sudo -n test -r` succeeded. Doctor now handles root-readable
kernel metadata without running builds as root.

Wrong assumption: a Bash function's local temp paths survived until its `EXIT`
trap. A later run also showed the real readiness protocol is uppercase `READY`.
The bounded readiness path now accepts the protocol, cleans up both children,
and preserves failure output under `/var/lib/incident-lab/failures/`.

Wrong assumption: ownership could always be verified over SSH. A stopped guest
cannot answer SSH, so the launcher verifies identity embedded in persisted Lima
configuration and additionally checks the root-owned marker while running.

Wrong assumption: guest sync inherited the host-only repository identity. An
early version overwrote the marker with `missing`; regression coverage now
requires carrying both existing identity fields forward. The affected instance
was proven from persisted config and its marker repaired atomically.

Fresh `ebpf-incident-lab` evidence: pinned image download approximately 51 s;
total create/boot/provision 265.17 s; the first provisioning Episode 1 event no
later than 213 s after download; Ubuntu kernel 6.8.0-134-generic; doctor passed;
all seven semantic and adversarial cases passed in 42.35 s; loopback returned to
`noqueue`; source was read-only 9p; `/opt/incident-lab` was native ext4 and 22
MiB; root filesystem use was 2.0 GiB.

Lima 9p again exposed stale content after live host edits. Stop/start remounted
current files. This does not alter the native learner execution boundary. A
final acceptance audit also caught that sync needed an explicit dirty-tree gate;
it now compares the native source digest written at provisioning and refuses to
overwrite local changes.
