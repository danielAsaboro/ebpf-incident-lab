# Getting started

## Recommended macOS learner path

Use the tested [Lima VM](../vm/README.md): macOS, Lima 2.0 or newer, and the
pinned x86_64 Ubuntu 24.04 image. Download the checksum-pinned v0.1.1 learner
bundle using the VM guide before starting.

```bash
./scripts/lab-vm.sh start
./scripts/lab-vm.sh doctor
./scripts/lab-vm.sh shell
```

Then use `incident-lab list` or `incident-lab run 01 --duration 10`. This path
uses prebuilt binaries on native guest storage and does not install Rust.

## Manual Ubuntu contributor environment

Use an x86_64 Ubuntu 24.04 VM with kernel 6.8 or newer. Allocate at least 2 CPUs, 4 GiB RAM, and 20 GiB disk. Run these labs only on a machine you control.

Install system packages:

```bash
sudo apt update
sudo apt install -y build-essential clang llvm libelf-dev zlib1g-dev pkg-config curl ca-certificates linux-tools-common iproute2 util-linux binutils python3
```

Install Rust, the nightly source component used for the eBPF target, and `bpf-linker`:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup toolchain install nightly --component rust-src
cargo install cargo-binstall
cargo binstall -y bpf-linker
```

Then validate rather than guessing:

```bash
sudo -v
./scripts/check-env.sh
cargo test --workspace --exclude incident-ebpf --exclude incident-runner
./scripts/build.sh
```

If your Ubuntu sudo session is not already authenticated, run `sudo -v` first. The checker uses non-interactive sudo only to read root-protected tracepoint format files; Rust toolchain checks still run as your normal user.

The first eBPF build downloads Rust crates and can take several minutes.

## Standard observer interface

Every observer stops by itself:

```bash
sudo ./scripts/run-lab.sh 01-exec-watch --duration 30
```

All observers accept `--json`; applicable observers accept a host PID through `--pid`:

```bash
sudo ./scripts/run-lab.sh 03-connect-failures --duration 30 --pid 1234 --json
```

JSON output is one object per line. Diagnostics go to stderr, so stdout can be piped safely.

## macOS development container

macOS cannot load Linux eBPF programs. The included container builds against Docker Desktop’s Linux VM:

```bash
docker build -t ebpf-incident-dev -f tooling/Dockerfile.dev .
docker run --rm --privileged -e CARGO_TARGET_DIR=/tmp/incident-target \
  -v "$PWD:/workspace" -w /workspace ebpf-incident-dev \
  bash -lc 'mount -t tracefs tracefs /sys/kernel/tracing 2>/dev/null || true; cargo build --release -p incident-runner --bins -p incident-fixtures --bins'
```

The temporary target directory keeps Linux/ARM64 artifacts out of a macOS
checkout. This is useful for development, but it is not equivalent to the
documented Ubuntu x86_64 acceptance environment.
