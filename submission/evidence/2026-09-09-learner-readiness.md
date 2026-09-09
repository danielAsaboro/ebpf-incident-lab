# Learner-readiness checks — 2026-09-09

This record covers automated and maintainer checks. It is not evidence of independent learner adoption or improved learning outcomes.

## Public access and discovery

- The custom domain passed HTTPS and browser Lab 01 acceptance in [hosted smoke](2026-09-09-hosted-smoke.md).
- `ebpf-incident-lab` was saved under Pinned on `github.com/danielAsaboro`. There were no selected pins before this change.
- Current setup documentation links the public v0.1.1 bundle and uses `shasum -a 256 --check`, available on macOS. The command verified the existing bundle as OK.
- `CONTRIBUTING.md` explains reproducible issue reports and checks for contributions.

## Browser and accessibility checks

On the custom domain, Lab 02 produced ten real file-open observations at 14:28:04 UTC for PID/TGID 1029235, including missing-file result -2 and permission-denied result -13. Cleanup completed at 14:28:07 UTC. The full explanation and transfer flow reached completion using Finish without feedback.

The skip link was reached with Tab. Enter activated its main-content target; subsequent Tab presses reached the labeled prediction field. Typing a prediction, Tab, and Enter started the real observation without pointer input. Subsequent steps were exercised with browser automation, not claimed as an end-to-end keyboard-only run.

A read-only DOM audit of Lab 02 checked document language, title, main landmark, single h1, field labels, page overflow, and rendered text color against opaque ancestor backgrounds. It found inactive progress text at 2.8:1 contrast. The CSS change to the existing muted color computes to 5.145:1. This bounded audit is not an axe report or comprehensive WCAG conformance assessment.

The Lab 02 observation and interpretation flow was also inspected at a 390 × 844 viewport without page-width overflow. The temporary viewport override was reset afterward.

## Feedback reliability

Previously, a failed HTTP response could advance the UI to completion. The correction requires a successful response, preserves fields and shows an error for retry, keeps the explicit skip action, and prevents repeated clicks while a request is pending.

Five added regression cases cover HTTP 400, 429, 500, a pending request, and a network failure. These tests replace only external transport and do not count as real runner or learner evidence.

## Local checks

- `./scripts/test-all.sh` passed Rust tests, Clippy, shell/VM contracts, and content verification. Linux attachment tests were explicitly skipped on Darwin.
- `npm test`: seven web tests passed.
- `npm run lint` and `npm run build` passed after the web changes.
- `python3 scripts/verify-content.py` and `git diff --check` passed.
- A separate read-only review found no concrete regressions in the scoped code and documentation diff.

## Open boundaries

- Cloudflare Access is deferred at the user's request; it is not configured or claimed. The current runner-token authentication remains in place.
- The private operator-pilot protocol and blank session template are prepared under ignored `private-research/operator-pilot/`. No invitations, consented participant sessions, or feedback were fabricated or submitted.
- Publication of the readiness fixes is pending explicit approval; the production site still runs the earlier build.

## Local production-build verification

The optimized Next.js build was served at `http://localhost:3018`. A repeated
DOM audit on Lab 07 at desktop and 390 × 844 reported no failures among
the scoped contrast, field-label, title, language, main-landmark, and h1
checks, and no page-width overflow. This confirms the contrast correction
in the built UI, not the deployed UI. The viewport was restored.

With no local runner credentials configured, Start real observation showed
FAILED and the explicit unconfigured-runner message; Interpret remained
disabled with zero observations. No successful run was claimed.

Commit `67e4d1b` contains the reviewed readiness fixes. Automatic approval
review rejected the attempted push to public main because explicit branch
and publication authorization was missing. No push or deployment was
performed after that rejection.

## Deployed Lab 07 browser acceptance

The existing production build at `https://ebpf-lab.danielasaboro.com/labs/07`
emitted `verifier_demo`, syscall ID 1, PID/TGID 1029285, timestamp
3119157534373143 at 14:32:43 UTC. Cleanup completed at 14:32:46 UTC.
Prediction, observation, explanation, transfer, and Finish without feedback
reached INCIDENT COMPLETE. Together with the earlier Lab 01 and Lab 02
records, all three current hosted browser flows have been exercised.
This does not verify the unpublished feedback and contrast fixes in production.
