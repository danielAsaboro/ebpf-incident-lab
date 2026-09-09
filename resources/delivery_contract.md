# Hosted Incident Lab delivery contract

## Vertical Slice

A working operator opens `ebpf-lab.danielasaboro.com`, selects hosted Lab 01, predicts the useful signal, starts a real bounded eBPF observation on the dedicated Ubuntu runner, reads streamed NDJSON evidence, explains the evidence boundary, completes a changed-scenario question, and may submit consented feedback. Labs 02 and 07 use the same path. Labs 03–06 remain clearly labeled local-only.

## Definition of Done

- The public repository exposes the seven verified Rust/Aya labs, documentation, licenses, and a checksum-pinned x86_64 release.
- The Vercel application is reachable at the custom domain with valid TLS.
- Hosted Labs 01, 02, and 07 execute fixed fixtures on Ubuntu 24.04 x86_64 and stream real observer output.
- Arbitrary commands, uploaded code, user arguments, and cross-session output are impossible through the public API.
- New sessions are bounded, serialized, rate-limited, and clean up on completion, error, timeout, disconnect, and restart.
- Public pages distinguish hosted, local-only, planned, and unsupported capabilities.
- At least three consented operator sessions are observed before any external learner-outcome claim is made.

## Judging Traceability

| Selection signal | Product behavior | Proof required |
|---|---|---|
| Existing contribution | Seven public labs, articles, VM, tests, and correction history | Public repository and tagged release |
| Hands-on education | Predict, observe, explain, limit, and transfer flow | Signed-out browser recording and real session trace |
| Accessibility | Keyboard navigation, semantic controls, contrast, reduced motion, readable output | Automated accessibility check and manual keyboard pass |
| Technical reliability | Fixed eBPF programs, deterministic fixtures, bounded runtime, explicit limitations | Linux smoke tests, API failure tests, checksum |
| Community impact | Consented operator sessions and contributor path | Aggregate pilot record and public issue/contribution links |
| Sustainability | Reproducible release, compatibility ledger, public roadmap | Release provenance and six-month milestone page |

## Build Sequence

1. Implement and test the fixed-operation runner.
2. Implement the web learning flow and runner proxy.
3. Verify local integration against a Linux runner.
4. Publish source and release.
5. Deploy Vercel and attach the custom domain.
6. Provision the approved Hetzner host and Cloudflare tunnel.
7. Run signed-out production acceptance and operator pilots.

## Demo Route

Open the landing page, choose Lab 01, make a prediction, start the observation, identify the `execve` event, state what it cannot prove, answer the changed-scenario checkpoint, and view the explicit current platform boundary.

## Failure Conditions

- Any hosted-success screen without a real runner receipt.
- Any browser path that accepts arbitrary shell input or executable uploads.
- Output from another learner or host process appearing in a session.
- Public exposure of the runner token, private research, learner identity, or terminal contents.
- Claiming external learning outcomes before consented sessions exist.
- Claiming Labs 03–06, ARM64, broad kernels, or translations are hosted before direct proof exists.
