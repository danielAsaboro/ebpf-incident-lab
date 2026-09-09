# Diagnostic learning release

The application now uses a shared authored investigation flow across all seven labs, aimed at Linux practitioners new to eBPF investigation. It replaces text-length and multiple-choice completion gates in the active lab routes. Submission checks establish completeness only; conceptual correctness is never inferred from those checks.

## Execution and evidence

Hosted Labs 01, 02, 07 retain their fixed operations. Lab 02 adds optional fixed `scenarioId` values `fallback` and `relative` alongside the default `baseline`. Unknown fields, scenarios, and non-hosted labs are rejected. `GET /v1/capabilities` advertises the reviewed file scenarios. The UI checks capabilities before offering them, so the frontend remains compatible with an older runner.

The fixture variations exercise a missing override followed by a successful fallback, and the same relative pathname under two working directories. Neither proves the application parsed or applied configuration. The fixture's debug messages are not kernel observations. Server output remains bounded, execution serialized, and fixture nonzero exit is treated as failure. Updated scenarios need an updated runner and fixture binary on Linux. Local compilation/tests do not prove privileged Linux execution.

The browser waits for a terminal event and queries the exact session status. Malformed records, empty output, failed execution, and transport interruptions do not become successful observations. Local pasted output remains explicitly user-provided. Namespace 3D is an optional static spatial explanation of identity views, not a reconstructed topology.

## Private records

`incident-lab:learning:v2` stores curriculum attempts, citations, revisions, hints, and transfer/recall history on the learner's device. Legacy `incident-lab:notebooks:v1` entries are preserved as original records and are not promoted to mastery. Export includes private raw observations; use local private storage, never the public repository. No research analytics endpoint receives learner work automatically. Deletion removes the selected new record and its legacy copy.

## Optional tutor

Set server-only `INCIDENT_TUTOR_API_KEY` and `INCIDENT_TUTOR_MODEL` to enable OpenAI Responses API formative critique. Leave them empty for authored-only operation. The browser requires consent before transmitting reasoning; raw selected evidence is an additional opt-in. Provider calls request `store:false`, but this is not a promise that all provider retention is disabled. Consult applicable provider policies before enabling a participant study.

The tutor has no tools, runner token, command execution, or mastery authority. Client-selected observations are not independently authenticated by the tutor route. Origin validation, payload bounds, timeout, output cap, and a per-process hourly request limit protect the endpoint. The in-memory limit is per server instance; use deployment-level rate limiting and budget controls before a broad public AI rollout. Provider failure leaves authored hints and saved work usable.

## Verification and release

Run `npm --prefix web test`, `npm --prefix web run lint`, `npm --prefix web run build`, and `cargo test -p incident-web-runner -p incident-fixtures`. Visually inspect all primary routes at narrow and desktop widths. On a dedicated Linux runner validate both new file scenarios, rejection of unknown operations, cleanup, and the existing hosted operations. Do not use the disposable retransmission fixture on a shared production machine.

This implementation does not demonstrate improved learning. The protocol in EVALUATION.md defines the separate participant work. It is product development, not fellowship application content. Publication requires authorization and verified deployment receipts; retain a previous deployment for rollback.

## Validation recorded during implementation

- Both new file workloads ran under the existing Ubuntu learner VM's real `02-file-open` eBPF observer: fallback produced a missing override and nonnegative fallback result; relative produced nonnegative and ENOENT results for the same relative pathname. Fixture cleanup was checked. Raw records remain ignored under `private-research/learning-checks/`.
- The rebuilt browser flow reached completed status through the existing hosted Lab 02 runner and selected actual ENOENT/EACCES records for reasoning. This validates the baseline flow, not the new runner deployment or a learning outcome.
- Learner-written explanations used during interface acceptance were test inputs, not participant results.
- An isolated updated runner was built and started in the learner VM on loopback port 8788. The local frontend on port 3017 detected its capabilities and completed the changed fallback scenario through the actual session/SSE/status API. Production was not changed.
- The relative-path recall scenario also completed through the updated runner and browser flow. It returned a descriptor and ENOENT for the same relative pathname. This was an immediate engineering acceptance check, not a seven-day participant recall result.
