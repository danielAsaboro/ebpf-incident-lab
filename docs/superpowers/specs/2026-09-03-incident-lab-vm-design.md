# Incident Lab VM Design

**Date:** 2026-09-03
**Status:** Approved in conversation; awaiting written-spec review
**Product:** eBPF Incident Lab: Debugging Linux with Rust and Aya

## Purpose

The VM removes environment setup as the first lesson. A learner should be able
to create a disposable, known-good x86_64 Ubuntu machine, enter it, verify the
kernel boundary, and produce the Episode 1 `execve` event without manually
installing Rust or understanding Lima internals.

The VM is evidence for the fellowship pilot, not a hosted multi-tenant service.
Browser-accessible labs remain a six-month expansion milestone because safely
hosting privileged ephemeral Linux machines is a separate product and security
boundary.

## Supported host and guest

Version one supports macOS with Lima 2.0 or newer. It runs an x86_64 QEMU guest
on both Intel and Apple Silicon so the guest matches the repository's published
acceptance architecture. Apple Silicon emulation is slower, but the learner path
does not compile before its first event.

The guest is the pinned Ubuntu 24.04 image already validated by the project:

```text
https://cloud-images.ubuntu.com/releases/noble/release-20260705/ubuntu-24.04-server-cloudimg-amd64.img
sha256:ffe6203da54deeb6db5d2a98a83f9ec8e55f149d3f7ba622e1abe5fa966ee3d6
```

Linux, Windows, native ARM64, Multipass, and browser delivery are explicitly not
claimed by version one. The cloud-init payload is kept provider-neutral enough
to make those future adapters possible.

## Learner interface

From the repository root:

```text
./scripts/lab-vm.sh start
./scripts/lab-vm.sh status
./scripts/lab-vm.sh doctor
./scripts/lab-vm.sh shell
./scripts/lab-vm.sh test
./scripts/lab-vm.sh reset
./scripts/lab-vm.sh stop
./scripts/lab-vm.sh delete
```

Inside the guest:

```text
incident-lab help
incident-lab doctor
incident-lab list
incident-lab run 01
incident-lab test
incident-lab sync
```

`run` accepts a lab number or slug and invokes the repository's existing
launcher. It never invents a second observer interface. Lab-specific fixtures
remain documented in each lab guide.

`sync` recopies the read-only host source into a fresh native guest working tree
and rebuilds only in developer mode. It refuses to overwrite a dirty guest tree;
the learner can use `reset` for a clean replacement.

## Architecture

```text
macOS repository (read-only mount)
        |
        | copy during provisioning/reset
        v
native ext4 guest workspace (/opt/incident-lab)
        |
        +-- prebuilt x86_64 observer and fixture bundle
        +-- lab docs and expected output
        +-- incident-lab guest command
        +-- optional Rust/Aya developer toolchain
```

The source mount is never used as an executable or Cargo target. This avoids the
observed Docker Desktop/shared-filesystem uprobe failure and prevents Linux
artifacts from contaminating the macOS `target/` directory.

The VM has 2 vCPUs, 4 GiB RAM, and 20 GiB disk. It uses Lima's `vz` backend only
when host and guest architectures match; otherwise it uses QEMU. The checked-in
configuration chooses x86_64 explicitly.

## Files and responsibilities

```text
vm/
├── README.md                 learner and maintainer VM guide
├── lima.yaml                 pinned image, resources, read-only source mount
├── cloud-init.yaml           provider-neutral package and user provisioning
├── manifest.json             schema/version/toolchain/artifact metadata
├── MOTD.md                   concise in-guest welcome screen
└── guest/
    ├── incident-lab          stable in-guest command
    └── provision.sh          idempotent guest setup

scripts/
├── lab-vm.sh                 host lifecycle command
└── tests/
    └── lab-vm.sh             behavior tests with a fake limactl
```

`lab-vm.sh` owns host orchestration only. `provision.sh` owns guest state only.
`incident-lab` owns learner commands only. The manifest is data, not executable
shell, and is validated before either host or guest uses it.

## Artifact strategy

The learner path consumes a versioned x86_64 release bundle containing the seven
observer binaries and deterministic fixtures. The manifest records:

- product schema version;
- repository release identifier;
- Ubuntu image URL and SHA-256;
- expected guest architecture and minimum kernel;
- bundle URL and SHA-256 when published;
- Rust stable/nightly versions and `bpf-linker` version for developer mode;
- build provenance command.

Before a public release URL exists, maintainers may place the exact bundle at
`vm/artifacts/incident-lab-x86_64.tar.zst`; that directory is gitignored. The
host launcher verifies its checksum and makes it available to the guest. If
neither a verified local bundle nor a published URL exists, `start` fails with
an actionable message. It does not silently fall back to an 18-minute build and
misrepresent the learner experience.

Developer mode is a separate explicit command added after the learner path:

```text
./scripts/lab-vm.sh dev-setup
```

It installs pinned Rust stable and nightly toolchains plus `bpf-linker`, then
builds on the native guest filesystem. Normal `start`, `doctor`, and `run` never
need Cargo.

## Lifecycle and safety

The fixed instance name is `ebpf-incident-lab`. The launcher checks that an
existing instance was created from this repository's manifest before operating
on it. It refuses to adopt or delete an unrelated Lima instance with the same
name.

- `start` validates macOS, Lima version, manifest, source path, artifact checksum,
  and free disk before creating or starting the instance.
- `status` is read-only and succeeds with a clear `absent`, `stopped`, or
  `running` state.
- `doctor` runs host gates and then the in-guest environment checker.
- `test` runs the safe seven-lab smoke suite and adversarial cleanup checks.
- `reset` stops the owned instance, deletes it, and recreates it from the pinned
  image only after printing the exact target and requiring the literal word
  `reset` on an interactive terminal.
- `delete` stops and deletes only the owned instance after requiring the literal
  word `delete`.
- `stop` preserves the disk.

Signals during host orchestration do not delete the VM. Signals during Lab 5 are
handled by the existing owned-qdisc cleanup logic inside the guest.

## Provisioning

Provisioning is idempotent and records its completed manifest version in
`/var/lib/incident-lab/provisioned.json`. It:

1. verifies Ubuntu, x86_64, and the expected source mount;
2. installs runtime packages with apt;
3. mounts tracefs when necessary;
4. copies source and documentation to `/opt/incident-lab` on native storage;
5. verifies and extracts the prebuilt bundle;
6. installs `/usr/local/bin/incident-lab`;
7. installs the MOTD;
8. runs `incident-lab doctor` and one bounded Episode 1 readiness test;
9. writes the completed marker only after every gate passes.

The `lima` user owns the native workspace. Package installation is the only
provisioning activity performed as root. No Cargo command runs as root.

## Error behavior

Every failure includes the failed gate and a remedy. Important distinct errors
include:

- unsupported host operating system;
- Lima missing or below version 2.0;
- pinned image unavailable;
- insufficient host disk;
- artifact missing or checksum mismatch;
- instance name collision or ownership mismatch;
- provisioning incomplete;
- guest architecture or kernel mismatch;
- tracefs/BTF unavailable;
- safe smoke failure;
- qdisc cleanup failure.

Machine-readable status is available with `lab-vm.sh status --json`. Other
commands remain human-first for version one.

## Test strategy

Host behavior tests use a fake `limactl` executable and isolated temporary Lima
home. They prove command construction, state handling, ownership checks,
non-interactive refusal for destructive actions, exact confirmation words, and
propagated exit codes without creating a real VM.

Guest-script tests run functions against temporary directories where possible.
The final acceptance test creates a fresh VM from an empty Lima instance store
and records:

- image download duration and size;
- provisioning duration;
- time from completed image download to first Episode 1 event;
- disk usage after provisioning;
- environment-check output;
- all seven semantic smoke results;
- all adversarial and cleanup results;
- stop/start persistence;
- reset behavior;
- final network state.

The first-event target is under ten minutes after image download on the current
Apple Silicon test host. A miss is reported as measured evidence and blocks the
“under ten minutes” claim; it does not block shipping a clearly documented beta.

## Documentation and fellowship evidence

The root README presents the VM as the recommended quick start and keeps manual
Ubuntu setup as the contributor path. The tested-environments page records the
exact VM manifest version and observed timings. The build journal records wrong
assumptions and corrections.

The application may claim a reproducible local learning VM only after fresh
creation passes. It may not claim browser delivery, Windows/Linux host support,
ARM64 support, public release availability, or learner adoption until those
facts exist.

The six-month roadmap uses this local pilot to justify:

1. browser-hosted ephemeral versions of Labs 1, 2, and 7;
2. native ARM64 and additional distribution/kernel coverage;
3. learner telemetry collected with consent and without terminal contents;
4. workshops and contributor-authored incident fixtures;
5. translation-ready lab and caption assets.

## Acceptance criteria

- The host lifecycle interface behaves as specified under automated tests.
- A fresh pinned VM reaches a real Episode 1 event without compiling.
- The guest source and binaries live on native Linux storage.
- `incident-lab doctor` reports architecture, kernel, BTF, tracefs, tools, and
  artifact identity.
- `incident-lab test` passes all seven semantic scenarios and adversarial cleanup.
- Stop/start preserves the provisioned state.
- Reset recreates the pinned baseline and never deletes an unowned instance.
- Lab 5 leaves loopback unchanged after normal completion and interruption.
- Setup time and disk use are measured and documented rather than estimated.
- Root and season documentation link to the VM guide.
- No unsupported platform, public URL, adoption, or browser-access claim is made.
