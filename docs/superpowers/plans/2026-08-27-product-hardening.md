# eBPF Incident Lab Product Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a safe, strict, clean-VM-tested v0.2 of all seven incident labs before any video scripting.

**Architecture:** Decode kernel wire records into a stable envelope plus typed Rust payload variants, serialize payload fields flat into NDJSON, and render human output from those same variants. Separate unprivileged build actions from privileged observation, and drive Linux integration tests through readiness-aware helpers with owned cleanup.

**Tech Stack:** Rust, Aya, Bash, serde/serde_json, Ubuntu tracefs, tc/netem, Lima/QEMU.

**Spec:** `docs/superpowers/specs/2026-08-27-product-hardening-design.md`

## Global Constraints

- Backward compatibility is not required.
- Publication target is Ubuntu 24.04 x86_64 on 6.8 GA and current HWE kernels.
- Build without privilege; elevate only explicit compiled binaries or narrow fixture operations.
- All observer and fixture waits are bounded.
- Cleanup may remove only state created by the same invocation.
- No video scripts are created.

---

### Task 1: Typed event contract

**Files:**
- Modify: `crates/incident-labs/src/lib.rs`
- Modify: `crates/incident-labs/tests/catalog.rs`
- Modify: `labs/*/expected-output.txt`

**Interfaces:**
- Produces: `EventRecord { envelope fields, payload: EventPayload }`, flattened JSON, `Option<u32>` enrichment fields.

- [ ] Write failing tests for explicit fields on every event variant, flattened JSON, null enrichment, and human rendering.
- [ ] Run the focused tests and confirm failures are caused by the current `detail` string.
- [ ] Implement typed payload variants and rendering.
- [ ] Run all host tests and update expected-output fixtures.

### Task 2: Retransmission aggregation

**Files:**
- Modify: `crates/incident-labs/src/lib.rs`
- Modify: `crates/incident-runner/src/lib.rs`
- Modify: `crates/incident-labs/tests/catalog.rs`

**Interfaces:**
- Produces: `RetransmitAggregator::observe` and deterministic per-flow `TcpRetransmitSummary` records.

- [ ] Write failing tests for same-flow accumulation, flow isolation, and deterministic summary ordering.
- [ ] Implement the minimal aggregator.
- [ ] Emit summaries when Lab 5 reaches its deadline or receives termination.
- [ ] Verify focused and workspace tests.

### Task 3: Safe build and run workflow

**Files:**
- Create: `scripts/build.sh`
- Create: `scripts/run-lab.sh`
- Create: `scripts/tests/workflow.sh`
- Modify: `README.md`
- Modify: `docs/GETTING-STARTED.md`
- Modify: `labs/*/README.md`

**Interfaces:**
- Produces: `run-lab.sh <01-exec-watch|...|07-verifier-portability> [observer arguments]`.

- [ ] Write shell tests proving the launcher never invokes Cargo, rejects unknown labs, and reports missing binaries.
- [ ] Implement the build and launcher scripts.
- [ ] Replace every `sudo cargo` instruction and correct the root quick-start fixture pairing.
- [ ] Run workflow tests and shell syntax checks.

### Task 4: Environment diagnostics

**Files:**
- Modify: `scripts/check-env.sh`
- Create: `scripts/tests/check-env.sh`
- Modify: `docs/TROUBLESHOOTING.md`

**Interfaces:**
- Produces: actionable checks for required commands, tracepoint pairs, BTF/CO-RE prerequisites, resolver symbol, privilege, kernel version, and cgroup/tracefs state.

- [ ] Write failing tests around factored check functions and dependency reporting.
- [ ] Add checks for `tc`, `unshare`, `timeout`, `readelf`, required tracepoints, fixture symbol, and effective load privilege.
- [ ] Distinguish publication requirements from optional capabilities.
- [ ] Verify mocked shell tests and a real Ubuntu run.

### Task 5: Strict and ownership-safe Linux smoke harness

**Files:**
- Modify: `scripts/smoke-linux.sh`
- Create: `scripts/lib/smoke-helpers.sh`
- Create: `scripts/tests/smoke-helpers.sh`

**Interfaces:**
- Produces: readiness wait, bounded child wait, NDJSON assertion helpers, artifact retention, and qdisc ownership cleanup.

- [ ] Write failing shell tests proving unowned qdiscs are never deleted and failure artifacts survive.
- [ ] Implement helpers and replace fixed readiness sleeps.
- [ ] Assert every promised fixture outcome for Labs 1–7 using parsed JSON.
- [ ] Add wrong-PID, unprivileged, missing-symbol, unavailable-tracepoint, and interruption cases.
- [ ] Run helper tests and privileged Linux smoke tests.

### Task 6: Genuine CO-RE lesson

**Files:**
- Modify: `crates/incident-ebpf/build.rs` or add it if absent
- Modify: `crates/incident-ebpf/src/main.rs`
- Modify: `crates/incident-common/src/lib.rs`
- Modify: `crates/incident-runner/src/lib.rs`
- Modify: `labs/07-verifier-portability/README.md`

**Interfaces:**
- Produces: a Lab 7 event containing a task field read through generated BTF bindings and Aya CO-RE relocation metadata.

- [ ] Write contract tests for the new wire field and output payload.
- [ ] Generate the minimal kernel type binding from target BTF and add a CO-RE field read.
- [ ] Load and assert the relocated value on GA and HWE kernels.
- [ ] Retain and revalidate the deliberately rejected null-map dereference.

### Task 7: Documentation and acceptance closure

**Files:**
- Modify: `README.md`
- Modify: `BUILD-JOURNAL.md`
- Modify: `docs/GETTING-STARTED.md`
- Modify: `docs/TESTED-ENVIRONMENTS.md`
- Modify: `docs/TROUBLESHOOTING.md`
- Modify: `labs/*/README.md`
- Modify: `scripts/test-all.sh`

**Interfaces:**
- Produces: one authoritative learner journey and an executable acceptance command.

- [ ] Add one architecture diagram and motivating source links to every lab.
- [ ] Record corrected assumptions, build-time expectations, truncation/drop behavior, and remaining evidence boundaries.
- [ ] Make `test-all.sh` run host, shell, formatting, lint, and Linux gates where available.
- [ ] Copy a clean tree into the Ubuntu VM and follow the documentation verbatim.
- [ ] Run all seven labs and negative tests on HWE, then repeat Lab 7 and compatibility gates on GA.
- [ ] Preserve evidence and update the tested-environments matrix only from observed results.
