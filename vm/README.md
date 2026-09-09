# Local learning VM

Version one supports a macOS host with Lima 2.0 or newer and the pinned
Ubuntu 24.04 x86_64 guest. Apple Silicon uses QEMU emulation. Linux and Windows
hosts, ARM64 guests, and browser-hosted labs are not supported by this release.

## Learner setup

No public bundle URL exists yet. Obtain the matching bundle from a maintainer
and place it at `vm/artifacts/incident-lab-x86_64.tar.zst`. The launcher
verifies it against `vm/manifest.json` and never falls back to compiling.

```bash
./scripts/lab-vm.sh start
./scripts/lab-vm.sh doctor
./scripts/lab-vm.sh shell
```

Inside the guest:

```bash
incident-lab list
incident-lab run 01 --duration 10
incident-lab test
```

The host repository is read-only at `/mnt/incident-source`. Provisioning copies
it and the verified bundle to native ext4 storage at `/opt/incident-lab`.
Observers and uprobes never execute from the shared mount.

## Lifecycle and safety

The host commands are `start`, `status`, `doctor`, `shell`, `test`, `stop`,
`reset`, `delete`, and `dev-setup`; `status --json` is also available. The fixed
instance name is `ebpf-incident-lab`. Every operation checks the repository and
manifest identity embedded in Lima's configuration; a running guest must also
have the matching root-owned marker. `reset` and `delete` require an interactive
terminal and their exact lowercase confirmation word. Signals never delete the
VM, and `stop` preserves its disk.

`incident-lab sync` refreshes native storage from the read-only mount. After
editing host files while the VM is running, stop/start first if Lima's 9p cache
presents stale contents.

## Bundle provenance

The ignored local bundle contains seven release observers and five fixtures.
It was recovered from the prior x86_64 acceptance VM, reconciled against current
runtime sources, passed the current no-build semantic/adversarial suite on
native storage, and was packed deterministically. SHA-256:

```text
f96cdf3f47175f7d2cd024bb6f9269c02d169d536730b5740727a1600c8e91b2
```

The public URL remains `null` in the manifest. Publishing a replacement requires
source reconciliation, x86-64 ELF inspection, Lab 7 relocation verification,
privileged semantic smoke, deterministic packing, fresh extraction, and digest
verification.

## Optional developer setup

`./scripts/lab-vm.sh dev-setup` installs pinned Rust toolchains and `bpf-linker`,
then builds as the unprivileged `lima` user on ext4. Learner commands never run
Cargo.
