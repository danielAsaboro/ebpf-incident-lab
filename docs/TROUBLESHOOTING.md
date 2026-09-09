# Troubleshooting by visible error

## `Lima is missing` or `Lima 2.0 or newer is required`

Version one supports macOS with Lima 2.0 or newer. Confirm `limactl --version`.
Other host operating systems are not claimed.

## `learner bundle missing` or `learner bundle checksum mismatch`

Place the exact x86_64 archive at
`vm/artifacts/incident-lab-x86_64.tar.zst`. There is no public bundle URL yet,
and the launcher will neither download nor silently rebuild it.

## `instance ... is not owned by this repository`

The fixed Lima name is occupied by an instance whose persisted configuration or
running marker does not match this checkout. The launcher deliberately refuses
to start, stop, reset, or delete it. Inspect `limactl list --json`; change it
yourself only after independently proving what it contains.

## `provisioning incomplete`

The completion marker is written only after doctor and a real Episode 1 event.
Preserve `/var/lib/incident-lab/failures/` and Lima's provision log, fix the
reported gate, then reset the owned VM. Do not fabricate the marker.

## `source mount must be read-only`

Recreate the VM through `scripts/lab-vm.sh`. Running from a writable macOS mount
reintroduces known uprobe and artifact-contamination risks.

## `sync` sees stale source

Lima 9p caching can retain an older view after host edits. Stop and start the
owned VM to remount source, then retry `incident-lab sync`. Execution remains on
native ext4 at `/opt/incident-lab`.

## `the eBPF labs run on Linux`

The userspace runner was launched on macOS or Windows. Use the Ubuntu VM or the privileged development container.

## `sudo: cargo: command not found`

Rustup installs Cargo in your user profile, while Ubuntu's default `sudo` path may omit it. Build as your normal user, then execute the built observer as root:

```bash
./scripts/build.sh
sudo ./scripts/run-lab.sh 01-exec-watch --duration 10
```

## `tracefs not found`

Confirm `/sys/kernel/tracing` exists and contains `events`:

```bash
mount | grep tracefs
ls /sys/kernel/tracing/events
```

In a disposable privileged development container, mount it with:

```bash
mount -t tracefs tracefs /sys/kernel/tracing
```

On a normal Ubuntu host it is usually mounted by the system. Do not blindly mount or change a production host.

## `Permission denied (os error 13)` while loading or attaching

Run the observer with `sudo`. eBPF loading normally requires root or a carefully configured set of capabilities. Container root is not automatically host root; the container also needs the relevant capabilities and access to tracefs.

## `No such file or directory` for a tracepoint

The kernel does not expose the hook expected by that lab. Check the exact source listed in the lab README under `/sys/kernel/tracing/events`. Kernel configuration and versions differ.

## Missing `/sys/kernel/btf/vmlinux`

The running kernel does not expose BTF. Boot the supported Ubuntu kernel or install the matching debug/kernel metadata package. Do not copy an unrelated kernel’s BTF file.

## `failed to run bpf-linker`

Verify both the binary and the nightly Rust source component:

```bash
command -v bpf-linker
rustup component list --toolchain nightly | grep rust-src
```

Building `bpf-linker` from source is not recommended for ordinary users because it depends on a compatible LLVM toolchain. Prefer `cargo binstall bpf-linker` or the matching binary from the [official releases](https://github.com/aya-rs/bpf-linker/releases).

## `symbol resolve_backend not found`

Build the fixture in release mode and point the observer at the exact binary:

```bash
./scripts/build.sh
export INCIDENT_DNS_FIXTURE="$PWD/target/release/dns-fixture"
```

Do not attach the uprobe to a wrapper script.

If Docker Desktop returns `perf_event_open: EIO` for a symbol that `nm` can see, copy the target binary to the container's native filesystem and point `INCIDENT_DNS_FIXTURE` there. Uprobes may not attach to an executable on a macOS-shared mount.

## Observer prints nothing

Verify that the fixture runs after the observer attaches, that `--pid` is a host PID, and that the observer duration has not elapsed. An empty result means “no matching event reached this observer,” not “the incident did not happen.”

## Verifier rejects the program

Read the entire verifier log from the first invalid instruction, not only the final `permission denied` wrapper. Lab 7 deliberately exposes a rejected program when `INCIDENT_VERIFIER_BROKEN=1` is set.

## `Lab 7 CO-RE requires readable target-kernel BTF`

The runner intentionally refuses to demonstrate CO-RE without parsing `/sys/kernel/btf/vmlinux`. Boot the supported kernel with `CONFIG_DEBUG_INFO_BTF`; do not substitute BTF from another kernel.

## Docker Desktop says it is unable to start

This is a Docker VM failure, not an eBPF verifier failure. Restart Docker Desktop and confirm `docker info` succeeds before retrying. Preserve the observer’s stderr so the two failure classes remain distinguishable.
