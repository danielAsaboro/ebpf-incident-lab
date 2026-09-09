# Incident Cutaway UI Implementation Plan

**Goal:** Deliver the approved interactive 3D incident workbench in the existing Next.js application.
**Architecture:** The shared shell provides application navigation; each routed IncidentWorkbench owns layer/view state for its selected lab. KernelScene owns Three.js lifecycle and semantic model geometry. LabExperience retains runner state and feeds received observation counts into the scene, with new inspection and case export controls.
**Tech Stack:** Existing Next.js, React, TypeScript, Vitest; Three.js.
**Spec:** docs/superpowers/specs/2026-09-09-incident-cutaway-ui-design.md

## Constraints
- Preserve existing real session, SSE and consented feedback endpoints.
- Label conceptual geometry; do not manufacture observations.
- Keep local VM labs clearly distinct from hosted execution.
- Support responsive screens, keyboard controls, reduced motion, and failed WebGL.
- Deliver local preview; no production publication in this design iteration.

## Execution
- [x] Add tests for runner failures and selectable raw evidence so UI changes preserve evidence boundaries. Run the existing suite before changes.
- [x] Create components/KernelScene.tsx with orthographic camera, three selectable layers, raycasting, adjustable separation, bounded camera controls, ResizeObserver and complete resource cleanup. Render geometry only on state or camera changes.
- [x] Create components/IncidentWorkbench.tsx and shared icons. Replace home and hosted lab wrappers with the working surface. Incident rail selects among existing lab metadata; local labs link to the existing repository guide.
- [x] Extend components/LabExperience.tsx with selected evidence, observation callbacks and case-note export while keeping existing learner phases and labels tested by the suite.
- [x] Replace app/globals.css with the approved identity, desktop workspace and stacked mobile layout. Preserve focus, semantic form controls and reduced motion.
- [x] Run Vitest, ESLint and production build. Check HTTP responses for home and hosted routes and unconfigured runner failure. Open the compiled local application in Codex.

## Validation receipt

2026-09-09: 11 Vitest tests pass; ESLint passes; production build passes. Home and hosted lab routes 01/02/07 return HTTP 200; local-only hosted route 03 returns 404. Session creation returns the expected 503 runner_unconfigured because this checkout has no configured credentials. No successful live run is claimed. Preview runs on http://127.0.0.1:3016 using next start, avoiding the host file-watcher limit encountered with next dev. Browser opening was queued in Codex; no browser interaction QA was performed.

## Application-wide continuation
- [x] Shared shell and real links: home index, all seven lab routes, field guide, notebooks, previous/next, missing-route recovery.
- [x] Subject-specific data and 3D models: process lineage, file entry/exit, socket crossing, resolver interval, retransmit attempts, nested namespaces, verifier path.
- [x] In-app local investigation flow with source-grounded commands, user-provided evidence and reasoning checkpoints.
- [x] Persistent notebooks, resumed drafts, interrupted-stream boundary, completed-note download and per-notebook deletion.
- [x] Integration tests for navigation contracts, local evidence labeling, persistence and existing hosted runner flow; production build and HTTP route verification.


## Application-wide validation receipt

2026-09-09: 23 Vitest tests pass across hosted learning/feedback, local learning, notebook persistence, navigation contracts and finite selectable geometry. ESLint and the optimized Next.js build pass. HTTP 200 verified for the collection, field guide, notebooks, all seven numbered lab routes and selected legacy slug aliases. Unknown /labs/99 returns HTTP 404 using dynamicParams=false with the known IDs and aliases generated. Unconfigured hosted session creation returns the expected HTTP 503. Current local preview remains http://127.0.0.1:3016. No live runner execution, browser interaction QA or publication is claimed.

The previous receipt describes the first iteration only. Labs 03–06 now have full web notebook routes, while their actual observers still execute in the documented local VM. Local pasted output is explicitly user-provided and never changes hosted observation counts. Browser notebooks can be resumed, downloaded or deleted; interrupted live sessions do not restart automatically.

Final review caught a stale feedback completion race introduced by phase navigation. A failing regression reproduced old feedback completing a new failed run. Run generation guards now discard stale feedback success/errors/finalization, and new runs clear prior session and interpretation state. The 23-test suite passes with the regression included.
