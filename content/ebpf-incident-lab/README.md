# eBPF Incident Lab — Season One

Learners on macOS should begin with the repository's [tested local Ubuntu VM](../../vm/README.md). Browser-hosted labs remain a future milestone.

Seven article-first production scripts for **Debugging Linux with Rust and Aya**.

Each episode is designed to work in three forms without rewriting the argument:

1. a readable technical article;
2. a narrated 12–15 minute video;
3. a companion to the runnable lab in `../../labs/`.

| Episode | Article | Bad assumption challenged |
|---|---|---|
| 1 | [What Just Ran on My Server?](01-what-just-ran.md) | Application logs are a complete record of process activity. |
| 2 | [Who Touched This File—and Did It Fail?](02-who-touched-this-file.md) | A “config error” tells you which file operation failed. |
| 3 | [Why Can’t This Service Connect?](03-why-cant-this-service-connect.md) | “Connection failed” identifies the destination and failure stage. |
| 4 | [Is DNS Actually the Slow Part?](04-is-dns-actually-slow.md) | DNS is guilty whenever a request stalls before connecting. |
| 5 | [Why Does the Network Keep Retrying?](05-why-network-retries.md) | Retransmissions prove packet loss—or prove the network is broken. |
| 6 | [Why Is PID 1 Not PID 1?](06-why-pid-one-isnt-pid-one.md) | A PID is a globally meaningful process identity. |
| 7 | [The Verifier Is Not a Compiler Error](07-verifier-and-kernel-drift.md) | CO-RE makes an eBPF object universally portable. |

## Editorial contract

- The symptom arrives before the eBPF concept.
- The lab answers one sharply bounded question.
- Community reports motivate the problem but never substitute for proof.
- The tested repository is the primary case study.
- Every episode says what its evidence cannot establish.
- Commands shown here must match the tagged lab release used during recording.

Production notes sit outside narration fences. Every word intended to be spoken
is inside a `text` fence, so the same file remains readable as an article and
usable during recording.

Research claims and caveats are tracked in the [research ledger](RESEARCH.md).
Recording, captions, terminal legibility, and visual consistency follow the
[season production and accessibility guide](PRODUCTION-GUIDE.md).
Working descriptions, thumbnail hooks, and chapter labels are in the
[publishing package](PUBLISHING.md).
