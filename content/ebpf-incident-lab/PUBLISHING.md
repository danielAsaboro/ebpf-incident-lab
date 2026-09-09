# Publishing package

Use these as working titles and description leads. Replace draft chapter times
with timestamps from the final edit. Do not add a public URL until the upload is
actually live.

## Playlist

**Title:** eBPF Incident Lab: Debugging Linux with Rust and Aya

**Description:** Seven incident-first Linux labs for backend and DevOps
engineers. Each episode starts with a production symptom, reproduces it in an
Ubuntu VM, investigates one boundary with eBPF, Rust, and Aya, and states what
the evidence cannot prove. Complete code, deterministic fixtures, expected
output, and cleanup instructions accompany every episode.

## Episode 1 — What Just Ran on My Server?

**Description lead:** Application logs are not a complete record of process
activity. Trace `execve` at the kernel boundary, identify the host process and
requested filename, and learn why an entry event proves an attempt—not a
successful program start.

**Thumbnail:** `WHAT JUST RAN?` beside one unknown process event.
**Chapters:** Incident; Evidence boundaries; `execve`; Build and privilege model;
Live trace; What the event cannot prove; Exercise and technique.

## Episode 2 — Who Touched This File—and Did It Fail?

**Description lead:** A “configuration error” does not identify the file or the
failure. Correlate `openat` entry and exit per thread to recover path, flags,
latency, and the real syscall result for success, `ENOENT`, and `EACCES`.

**Thumbnail:** `WHICH FILE FAILED?` with path and `-13 EACCES`.
**Chapters:** Symptom; Entry versus exit; Hook choice; Three controlled outcomes;
Path ambiguity; Reading sequences; Evidence boundary.

## Episode 3 — Why Can’t This Service Connect?

**Description lead:** “Upstream unavailable” is not a network diagnosis. Observe
blocking `connect(2)`, decode the actual destination, distinguish success from
immediate refusal, and learn why non-blocking sockets require a different state
model.

**Thumbnail:** `WHERE DID IT CONNECT?` with one address and port.
**Chapters:** Symptom; Socket decoding; Controlled listener fixture; Blocking
versus non-blocking; PID filtering; Protocol layers; Decision tree.

## Episode 4 — Is DNS Actually the Slow Part?

**Description lead:** DNS is often blamed for any delay before a connection.
Attach Aya uprobes to a known resolver wrapper, measure controlled latency, and
separate proof about one function from assumptions about libc, NSS, caches, the
network, and the DNS server.

**Thumbnail:** `IS IT REALLY DNS?` over a measured 500 ms function bracket.
**Chapters:** The default suspect; Userspace probes; Deterministic delay;
Interpreting one duration; Incident research; Coverage; Evidence boundary.

## Episode 5 — Why Does the Network Keep Retrying?

**Description lead:** Retransmission is a recovery mechanism, not a root-cause
label. Force a controlled retry with owned `tc netem` state, trace
`tcp_retransmit_skb`, aggregate by flow, and verify interruption cannot leave the
VM impaired.

**Thumbnail:** `TCP RETRIED. WHY?` with one flow and retry counter.
**Chapters:** Tail-latency symptom; TCP retry boundary; Safe fault ownership;
Live retry; Raw events and aggregation; Denominators; Evidence chain.

## Episode 6 — Why Is PID 1 Not PID 1?

**Description lead:** A PID is meaningful inside a namespace, not across the
whole machine. Use `unshare` to correlate namespace PID 1 with its host PID and
cgroup identity, then see why host-level filters appear silent when given a
container-visible PID.

**Thumbnail:** `PID 1 = PID 24500?` with both labels attached to one process.
**Chapters:** Two correct PIDs; Shared kernel; `unshare` lab; Cgroup identity;
Wrong-filter silence; Interface design; Lifecycle and evidence boundary.

## Episode 7 — The Verifier Is Not a Compiler Error

**Description lead:** A compiled eBPF object can still be rejected by the target
kernel. Read a deliberate nullable-map verifier failure, inspect genuine CO-RE
relocation metadata, and test the same safe object on Ubuntu GA and HWE kernels.

**Thumbnail:** `COMPILED. REJECTED.` beside `map_value_or_null`.
**Chapters:** Misleading permission error; Verifier reasoning; Expected rejection;
False CO-RE assumption; What CO-RE does not solve; Two-kernel evidence;
Compatibility matrix; Season conclusion.

## Description footer

Add these links per upload:

- the episode’s lab directory;
- its expected-output file;
- the canonical article-first script;
- the tested-environments matrix;
- sources already listed in the script;
- the playlist URL after it exists.

State that the labs target a disposable x86_64 Ubuntu 24.04 VM and that Episode
5 intentionally changes loopback network behavior only inside that VM.
