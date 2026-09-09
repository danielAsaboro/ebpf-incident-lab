# v0.1.1 release provenance

The learner bundle was built and smoke-tested in the project's Ubuntu 24.04 x86_64 Lima/QEMU environment on 2026-09-03. Its privileged acceptance record is in [`vm/acceptance/2026-09-03/README.md`](../vm/acceptance/2026-09-03/README.md).

The hosted HTTP runner was built from this repository on 2026-09-09 inside the same x86_64 VM with:

```bash
CARGO_TARGET_DIR=/tmp/incident-web-runner-target \
  cargo build --locked --release -p incident-web-runner
```

Before release, the repository passed the Rust runner unit tests and Clippy with warnings denied, the Next.js tests, lint, production build, and the delivery-contract validator. The exact artifacts are authenticated by [`SHA256SUMS`](SHA256SUMS).

## Clean-machine learner path

Install Lima 2.0 or newer on macOS, clone this repository, download `incident-lab-x86_64.tar.zst` from the v0.1.1 release into `vm/artifacts/`, then verify it:

```bash
cd vm/artifacts
sha256sum --check ../../release/SHA256SUMS --ignore-missing
cd ../..
./scripts/lab-vm.sh start
./scripts/lab-vm.sh doctor
./scripts/lab-vm.sh shell
```

Inside the guest, run `incident-lab run 01 --duration 10`. The bundle targets Ubuntu 24.04 x86_64 with kernel 6.8 or newer; it is not a universal Linux binary claim.
