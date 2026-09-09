# VM v1 acceptance evidence — 2026-09-03

Host: Apple Silicon macOS; Lima 2.2.0; x86_64 QEMU guest. The workspace was
not a Git repository. Times come from `/usr/bin/time` and Lima timestamps in
the interactive run output; they are measured, not estimates.

| Acceptance criterion | Evidence |
|---|---|
| Host lifecycle interface | `bash scripts/tests/lab-vm.sh`: absent text/JSON status, host gates, collision refusal, stopped/running ownership, developer delegation, noninteractive delete refusal, TUI suppression, guest dispatch all passed. |
| Fresh VM reaches Episode 1 without compiling | First `start` completed from an absent name; provisioner printed `ok lab 1 semantic evidence`. Bundle recovery and acceptance invoked `INCIDENT_SKIP_BUILD=1`; learner commands contain no Cargo path. |
| Guest source and binaries use native Linux storage | `findmnt`: source `lima-… 9p ro`; `/opt/incident-lab` `/dev/vda1 ext4 rw`. `file` reported the observer as x86-64 ELF. |
| Doctor reports required gates and identity | Fresh and post-reset `lab-vm.sh doctor`: x86_64, kernel 6.8.0-134-generic, BTF, tracefs, execve tracepoint, native workspace, Python, `tc`, `unshare`, release `vm-v1`, and bundle SHA all passed. |
| Seven semantic and adversarial scenarios | `lab-vm.sh test` passed Labs 1–7, wrong PID, missing symbol, missing tracepoint, insufficient privilege, hidden BTF, verifier rejection, and interrupted qdisc cleanup in 42.35 s. |
| Stop/start persistence | Owned `stop` reported `stopped`; `start` restored `running`, retained identity and bundle markers, and doctor passed. |
| Reset and ownership refusal | Automated tests refused an unowned collision and noninteractive destruction. Interactive exact `reset` deleted only `ebpf-incident-lab`, reused the pinned image cache, recreated it, and post-reset doctor passed. |
| Lab 5 network cleanup | Full smoke printed `interrupted netem fixture restored loopback`; final `tc qdisc show dev lo` was `qdisc noqueue 0: root refcnt 2`. |
| Setup and disk measurements | Image download ~51 s (20:56:16–20:57:07); total fresh start 265.17 s; first event no later than 213 s after download; `/opt/incident-lab` 22 MiB; root filesystem 2.0 GiB used of 19 GiB formatted. |
| Documentation | Root README, season README, Getting Started, tested environments, troubleshooting, VM guide, manifest, and build journal link or record the VM using observed support boundaries. |
| Unsupported claims excluded | Manifest bundle URL is `null`; docs explicitly exclude public artifacts, browser delivery, Windows/Linux hosts, ARM64 guests, and external learner validation. |
| Dirty sync refusal | Contract test mutates the recorded native source digest, requires the visible reset/preserve remedy, and proves the provisioner is not invoked. |

## Incorrect assumptions preserved

- Tracefs metadata may require noninteractive sudo even when correctly mounted.
- A function-local path is unsafe in a process-level Bash `EXIT` trap.
- The observer readiness protocol is uppercase `READY`.
- Guest sync does not inherit the host-only repository identity.
- A stopped guest cannot be queried over SSH; persisted config must prove ownership.
- Lima 9p may show stale live edits until stop/start remounts it.
- Interactive reset caused Lima's own configuration chooser until `--yes` was added.

The initial readiness failures occurred before failure preservation was added and
were recorded in the build journal and command transcript. The corrected command
stores future readiness failures under `/var/lib/incident-lab/failures/`.
