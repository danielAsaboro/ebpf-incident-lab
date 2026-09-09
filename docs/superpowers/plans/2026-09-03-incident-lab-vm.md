# Incident Lab VM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and fresh-instance-test a safe Lima-based Ubuntu 24.04 x86_64 learner VM that reaches a real Episode 1 eBPF event from verified prebuilt binaries without compiling.

**Architecture:** The macOS launcher validates a versioned JSON manifest, a checksum-verified local or published bundle, host prerequisites, and Lima instance ownership before delegating lifecycle operations. Lima mounts this repository read-only; an idempotent root provisioner copies learning material and the verified bundle to native ext4 storage owned by the `lima` user, while a separate guest command provides stable learner operations. Executable behavior is covered by shell integration tests using real scripts with fake host dependencies, followed by acceptance on a fresh x86_64 QEMU guest.

**Tech Stack:** Bash 3.2-compatible host orchestration, Bash guest scripts, Lima 2.0+, QEMU, Ubuntu 24.04 x86_64 cloud image, cloud-init, JSON/Python 3 validation, tar + zstd artifact bundle, existing Rust/Aya release binaries and smoke harness.

**Spec:** `docs/superpowers/specs/2026-09-03-incident-lab-vm-design.md`

## Global Constraints

- Version one supports macOS hosts with Lima 2.0 or newer and an x86_64 Ubuntu 24.04 guest only.
- Use instance name `ebpf-incident-lab`, 2 CPUs, 4 GiB RAM, 20 GiB disk, and the pinned image SHA-256 `ffe6203da54deeb6db5d2a98a83f9ec8e55f149d3f7ba622e1abe5fa966ee3d6`.
- Mount host source read-only and execute/build only from native guest storage under `/opt/incident-lab`.
- Normal `start`, `doctor`, `run`, and `test` never invoke Cargo; `dev-setup` is the only toolchain/build path and runs Cargo as the non-root `lima` user.
- A learner bundle must be checksum-verified before use; absent or invalid artifacts fail instead of triggering a source build.
- Never adopt, reset, or delete an instance without a matching repository ownership record.
- `reset` and `delete` require an interactive terminal and the exact literal confirmation word.
- Preserve `ebpf-incident-x86`; it may be started and inspected for evidence but not deleted or modified as part of the new product lifecycle.
- The repository is not currently a Git work tree, so worktree isolation and commit steps are unavailable; all edits must preserve unrelated files.
- Browser delivery, Linux/Windows hosts, ARM64 guests, public release URLs, public repository availability, and external learner completion remain unclaimed.

---

### Task 1: Manifest and host lifecycle contract

**Files:**
- Create: `vm/manifest.json`
- Create: `scripts/tests/lab-vm.sh`
- Create: `scripts/lab-vm.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: repository root path, `vm/manifest.json`, `vm/artifacts/incident-lab-x86_64.tar.zst`, `limactl`, `uname`, `df`, `shasum` or `sha256sum`, and optional `INCIDENT_LAB_*` test overrides.
- Produces: `scripts/lab-vm.sh {start,status,doctor,shell,test,reset,stop,delete,dev-setup}`, `status --json`, and ownership metadata passed into Lima as manifest version plus repository identity.

- [ ] **Step 1: Write failing lifecycle tests**

  Build an isolated test root containing a copied manifest, empty artifact directory, fake `uname`, fake `limactl`, and a call log. Assert literal outputs and exit statuses for: absent text/JSON status; unsupported host; missing Lima; Lima below 2.0; missing artifact; mismatched artifact checksum; insufficient disk; owned stopped/running states; unowned name collision; command exit-code propagation; signal handling without deletion; and usage/unknown commands. Each fake must implement the complete `limactl list --json`, `start`, `shell`, `stop`, and `delete` response shape used by the launcher.

- [ ] **Step 2: Run the lifecycle tests and observe the expected failure**

  Run `bash scripts/tests/lab-vm.sh`. Expected: nonzero because `scripts/lab-vm.sh` and the manifest contract do not exist.

- [ ] **Step 3: Add the versioned manifest and ignored artifact directory**

  Define schema `1`, release identifier `vm-v1`, pinned image URL/digest, `x86_64`, minimum kernel `6.8`, Lima minimum `2.0.0`, bundle filename/nullable unpublished URL/checksum, stable/nightly Rust and `bpf-linker` developer versions, and the exact provenance command. Ignore `vm/artifacts/*` while retaining an optional `.gitkeep` rule.

- [ ] **Step 4: Implement minimal host validation and read-only status behavior**

  Resolve the real repository root, reject symlink/manifest ambiguity, parse JSON through Python 3, compare semantic Lima versions, require at least 25 GiB free before new creation, verify the bundle checksum, obtain instance state through `limactl list --json`, and print exactly `absent`, `stopped`, or `running`; JSON output must contain `name`, `state`, `owned`, `manifest_version`, and `provisioned` fields.

- [ ] **Step 5: Run tests and confirm the host validation cases pass**

  Run `bash scripts/tests/lab-vm.sh`. Expected: all host validation and status cases implemented so far pass.

- [ ] **Step 6: Add failing ownership and destructive-confirmation tests**

  Assert that all mutating/guest commands refuse an existing instance whose ownership file is absent or mismatched; `status` remains read-only and reports `owned:false`. Assert reset/delete reject redirected stdin, reject wrong/case-varied words, print the exact instance and repository identity, and invoke stop/delete only after exact lowercase confirmation. Assert EOF refuses safely.

- [ ] **Step 7: Run the destructive tests and observe the expected failures**

  Run `bash scripts/tests/lab-vm.sh`. Expected: new reset/delete cases fail because orchestration is not implemented.

- [ ] **Step 8: Implement safe lifecycle delegation**

  Implement create/start using `vm/lima.yaml`, explicit stop, shell, guest doctor/test/dev-setup delegation, reset recreation, and safe delete. Query ownership from a root-owned guest file through `limactl shell`; never infer ownership from name alone. Trap `INT`, `TERM`, and `HUP` only to exit and preserve the VM.

- [ ] **Step 9: Run the complete host lifecycle suite**

  Run `bash scripts/tests/lab-vm.sh`. Expected: zero failures and no fake call log containing delete for refusal/signal cases.

### Task 2: Lima and cloud-init configuration

**Files:**
- Create: `vm/lima.yaml`
- Create: `vm/cloud-init.yaml`
- Extend test: `scripts/tests/lab-vm.sh`

**Interfaces:**
- Consumes: pinned manifest values, repository path injected by launcher, verified bundle path, and `vm/guest/provision.sh`.
- Produces: an x86_64 QEMU-capable Lima configuration with `/mnt/incident-source` and `/mnt/incident-artifact` read-only mounts, plus cloud-init package and tracefs setup consumed by provisioning.

- [ ] **Step 1: Add failing rendered-config tests**

  Have the fake `limactl start` capture the generated YAML. Assert x86_64 architecture, pinned digest, 2 CPUs, 4 GiB memory, 20 GiB disk, source/artifact mounts with `writable: false`, no writable home mount, and a provision action that calls the checked-in guest provisioner. Assert host paths containing spaces are encoded safely.

- [ ] **Step 2: Run tests and observe configuration failures**

  Run `bash scripts/tests/lab-vm.sh`. Expected: rendered configuration assertions fail because template rendering is absent.

- [ ] **Step 3: Implement deterministic config templates and rendering**

  Add the pinned Lima template and provider-neutral cloud-init package/user directives. Render path placeholders through a quoted data substitution that cannot execute shell content; keep runtime package installation separate from developer packages and disable implicit writable mounts.

- [ ] **Step 4: Re-run lifecycle/config tests**

  Run `bash scripts/tests/lab-vm.sh`. Expected: captured config has only the intended read-only mounts and pinned resources.

### Task 3: Idempotent guest provisioning

**Files:**
- Create: `vm/guest/provision.sh`
- Extend test: `scripts/tests/lab-vm.sh`

**Interfaces:**
- Consumes: `/mnt/incident-source`, `/mnt/incident-artifact/incident-lab-x86_64.tar.zst`, manifest JSON, `vm/MOTD.md`, and environment-overridable filesystem roots for tests.
- Produces: `/opt/incident-lab`, `/usr/local/bin/incident-lab`, `/etc/update-motd.d/60-incident-lab`, `/var/lib/incident-lab/owner.json`, and `/var/lib/incident-lab/provisioned.json` written only after readiness passes.

- [ ] **Step 1: Add failing guest-provision tests**

  Execute the real provisioner against temporary source, artifact, opt, state, bin, and MOTD paths with fake package/mount commands. Assert rejection of non-Ubuntu, non-x86_64, writable source mount, missing/mismatched bundle, wrong archive layout, and root-owned final workspace. Assert a successful run copies without `target/`, extracts expected executables, creates identity markers atomically, is repeatable, and never invokes Cargo.

- [ ] **Step 2: Run tests and observe the expected provisioner failure**

  Run `bash scripts/tests/lab-vm.sh`. Expected: provisioner behavior cases fail because the script is missing.

- [ ] **Step 3: Implement validation, native copy, and atomic installation**

  Validate `/etc/os-release`, `uname -m`, mount read-only flags, manifest schema, and archive checksum/layout. Copy through a staging directory on the native destination filesystem, exclude `.git`, `target`, `target-linux`, and `vm/artifacts`, extract the bundle under the copied tree, chown to `lima`, install guest command/MOTD, run doctor and bounded Episode 1 readiness, then atomically rename the provisioning marker.

- [ ] **Step 4: Add and pass interruption/idempotence tests**

  Inject a failing readiness command and verify no completion marker is written and the prior complete workspace survives. Re-run after success and assert package setup is skipped only when the marker matches both manifest and artifact identities.

- [ ] **Step 5: Run all guest-provision tests**

  Run `bash scripts/tests/lab-vm.sh`. Expected: all provisioning, interruption, ownership, and no-Cargo assertions pass.

### Task 4: Stable in-guest learner command

**Files:**
- Create: `vm/guest/incident-lab`
- Extend test: `scripts/tests/lab-vm.sh`

**Interfaces:**
- Consumes: `/opt/incident-lab`, provisioning/ownership markers, existing `scripts/run-lab.sh`, `scripts/smoke-linux.sh`, and `scripts/check-env.sh` or a learner-specific runtime checker.
- Produces: `help`, `doctor`, `list`, `run <number-or-slug>`, `test`, `sync`, and internal bounded readiness behavior.

- [ ] **Step 1: Add failing guest-command tests**

  With a temporary native workspace and executable fixture stubs, assert help/usage, canonical ordered lab list, number/slug mapping, argument forwarding, unknown lab rejection, incomplete provisioning rejection, and propagated observer/smoke exits. Assert normal commands do not invoke Cargo and `doctor` reports architecture, kernel, BTF, tracefs, tools, native filesystem identity, artifact release, and checksum.

- [ ] **Step 2: Run tests and observe the expected command failures**

  Run `bash scripts/tests/lab-vm.sh`. Expected: guest command cases fail because the command is missing.

- [ ] **Step 3: Implement help, doctor, list, run, and test**

  Map `01` through `07` and canonical slugs to the existing launcher, execute observers with controlled `sudo` only after validating prebuilt binaries, run the existing privileged semantic smoke suite for `test`, and emit one clear remedy for every failed doctor gate.

- [ ] **Step 4: Add failing sync safety tests**

  Initialize temporary clean/dirty guest trees and assert sync refuses modified or untracked files, refuses a writable source mount, stages a new native copy atomically, preserves the verified artifact bundle, and never rebuilds in learner mode.

- [ ] **Step 5: Run sync tests and observe expected failures**

  Run `bash scripts/tests/lab-vm.sh`. Expected: sync cases fail because sync is not implemented.

- [ ] **Step 6: Implement safe sync and explicit developer setup**

  Track the copied source identity with a content manifest rather than requiring Git, compare current workspace files before replacement, and refuse dirty state. Implement developer setup as a separate provisioner entry that installs pinned toolchains and runs `./scripts/build.sh` as `lima`, never root.

- [ ] **Step 7: Run the complete guest command suite**

  Run `bash scripts/tests/lab-vm.sh`. Expected: all guest behavior cases pass with no Cargo call in learner commands.

### Task 5: Recover or build and verify the learner bundle

**Files:**
- Create locally (ignored): `vm/artifacts/incident-lab-x86_64.tar.zst`
- Modify: `vm/manifest.json`
- Preserve evidence under: `vm/acceptance/2026-09-03/` when failures occur

**Interfaces:**
- Consumes: x86_64 Linux release outputs for seven observer binaries, five fixture binaries, embedded eBPF objects, smoke scripts, and verifier metadata checks.
- Produces: a deterministic tar.zst rooted at `target/release/` plus manifest checksum and provenance.

- [ ] **Step 1: Inspect the stopped evidence VM without modifying its disk contents**

  Start `ebpf-incident-x86`, locate native x86_64 release artifacts and the exact source revision/content they came from, record checksums/ELF architecture, and stop it again. Do not use artifacts if their embedded/current source identity cannot be reconciled.

- [ ] **Step 2: Build on native guest storage if recovery is not provably correct**

  Copy the current repository to a native guest directory, run the existing full contract suite as `lima`, run `./scripts/build.sh` as `lima`, and inspect all outputs with `file`, `readelf`, and the Lab 7 CO-RE relocation validator. Never run Cargo under sudo.

- [ ] **Step 3: Run live semantic smoke before packaging**

  Run `sudo INCIDENT_SKIP_BUILD=1 scripts/smoke-linux.sh` from native storage. Expected: all seven semantic scenarios and all adversarial cleanup scenarios pass; preserve the emitted artifact directory on any failure.

- [ ] **Step 4: Create a deterministic bundle and verify it independently**

  Package only required release binaries with stable ordering, numeric ownership, and fixed timestamps. Copy to `vm/artifacts`, compute SHA-256 twice (source and host), extract to a fresh temporary directory, confirm every ELF is x86-64, confirm all expected executables exist, and run a no-build smoke from the extracted copy in Linux.

- [ ] **Step 5: Pin the observed checksum and provenance**

  Replace the manifest bundle checksum with the measured digest while keeping the bundle URL null until a public asset genuinely exists.

### Task 6: Documentation and aggregate validation

**Files:**
- Create: `vm/README.md`
- Create: `vm/MOTD.md`
- Modify: `README.md`
- Modify: `docs/GETTING-STARTED.md`
- Modify: `docs/TESTED-ENVIRONMENTS.md`
- Modify: `docs/TROUBLESHOOTING.md`
- Modify: `BUILD-JOURNAL.md`
- Modify: `scripts/test-all.sh`

**Interfaces:**
- Consumes: implemented commands and observed host/guest evidence only.
- Produces: recommended VM quick start, maintainer artifact instructions, explicit support boundaries, visible-error remedies, recorded incorrect assumptions, and default host contract validation.

- [ ] **Step 1: Add the VM contract suite to aggregate tests and observe failure if integration is absent**

  Add an assertion in the VM suite that `scripts/test-all.sh` executes it exactly once, then run the VM suite. Expected before modification: failure naming missing aggregate integration.

- [ ] **Step 2: Integrate the suite and run aggregate host checks**

  Modify `scripts/test-all.sh` to run `scripts/tests/lab-vm.sh` before the host/Linux split. Run `./scripts/test-all.sh`; expected: Rust format/tests/clippy, shell syntax, workflow/smoke helper/content checks, and VM contract tests all pass on macOS while live eBPF load remains explicitly skipped.

- [ ] **Step 3: Write learner and maintainer documentation from implemented behavior**

  Document prerequisites, exact commands, destructive confirmations, source/artifact storage boundaries, unpublished local-bundle requirement, developer setup separation, support exclusions, and bundle provenance in `vm/README.md`. Keep manual Ubuntu steps as contributor guidance and link the VM guide from root and season documentation.

- [ ] **Step 4: Add troubleshooting keyed to actual errors**

  Cover Lima absence/version, disk gate, missing/checksum bundle, pinned image download, ownership collision, provisioning marker, architecture/kernel/BTF/tracefs, native storage, sync dirty state, and safe Lab 5 cleanup. Do not claim remedies that were not exercised or documented by upstream tools.

- [ ] **Step 5: Record observed discoveries and provisional evidence**

  Append dated build-journal entries for every false assumption encountered. Keep the tested-environments VM row explicitly incomplete until fresh-instance acceptance passes.

### Task 7: Fresh-instance acceptance and lifecycle audit

**Files:**
- Create local evidence: `vm/acceptance/2026-09-03/README.md`
- Create local evidence: `vm/acceptance/2026-09-03/*.log`
- Modify: `docs/TESTED-ENVIRONMENTS.md`
- Modify: `BUILD-JOURNAL.md`

**Interfaces:**
- Consumes: final launcher/config/provisioner/guest command, verified bundle, empty `ebpf-incident-lab` instance state, and Lima/QEMU network access.
- Produces: command logs, timings, disk use, lifecycle/adversarial evidence, and a criterion-by-criterion acceptance matrix.

- [ ] **Step 1: Capture absent and preflight evidence**

  Record `status`, `status --json`, host architecture, Lima version, free space, manifest digest, bundle digest, and confirmation that `ebpf-incident-lab` is absent. If the name exists, prove ownership before any reset/delete request.

- [ ] **Step 2: Measure fresh image and provisioning phases**

  Start from an empty instance store/name, timestamp image-download completion separately from provision completion, preserve Lima logs, and record image bytes. If Lima does not expose a phase timestamp, use its log timestamps and state the derivation rather than inventing precision.

- [ ] **Step 3: Measure first Episode 1 event**

  Immediately after image download/provision readiness, run a bounded Episode 1 observer and deterministic `/bin/sleep` fixture, validate the typed NDJSON with the existing semantic verifier, and calculate elapsed time from image-download completion. A duration above ten minutes blocks only the under-ten-minute claim and is documented verbatim.

- [ ] **Step 4: Run doctor and all semantic/adversarial tests**

  Capture `./scripts/lab-vm.sh doctor` and `test`. Verify all seven scenarios, wrong PID, missing symbol, missing tracepoint, unprivileged load, missing BTF, unsafe verifier rejection, normal/interrupted loopback qdisc restoration, and final qdisc equality.

- [ ] **Step 5: Verify native storage and persistence**

  Record `findmnt` for source and `/opt/incident-lab`, ELF paths, mount options, absence of Cargo in learner command logs, marker contents, and `du`/`df` disk usage. Stop/start and prove the marker, workspace checksum, and successful Episode 1 run persist.

- [ ] **Step 6: Verify reset and ownership refusal**

  Exercise wrong/noninteractive reset confirmations, perform one exact confirmed reset, and prove a new baseline marker/workspace. Use an isolated Lima home with a deliberately unowned same-name fake/instance for refusal tests; never modify `ebpf-incident-x86` or replace the real accepted VM with an unowned instance.

- [ ] **Step 7: Verify safe delete last**

  Capture wrong/noninteractive delete refusals, then exact confirmed deletion of the proven-owned fresh instance. Confirm status returns `absent` and no command targeted `ebpf-incident-x86`.

- [ ] **Step 8: Audit every design acceptance criterion**

  In the evidence README, make one row per criterion with the exact test, command/log, file, and measured runtime proving it. Mark any missing item blocked with its exact cause; do not convert partial evidence into completion.

- [ ] **Step 9: Update evidence-bearing docs and run final verification**

  Add only measured VM/kernel/timing/disk results to tested environments and the build journal. Run `bash -n vm/guest/*.sh vm/guest/incident-lab scripts/lab-vm.sh scripts/tests/lab-vm.sh`, `python3 -m json.tool vm/manifest.json`, `bash scripts/tests/lab-vm.sh`, and `./scripts/test-all.sh`; inspect complete output and report all unresolved criteria.
