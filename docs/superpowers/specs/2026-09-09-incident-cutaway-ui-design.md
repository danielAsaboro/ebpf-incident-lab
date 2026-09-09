# Incident cutaway UI

Approved in conversation: build the incident-first, tactile 3D investigation experience.

The existing Next.js application becomes a working surface with a narrow incident rail, an interactive Three.js cutaway, and a contextual investigation notebook. Chalk, graphite, vermilion, etched rules, oversized editorial incident titles and precise monospace metadata define the identity. No continuous decorative movement. Three selectable conceptual layers explain process, kernel hook and event transport; separation and camera controls expose their relationships. All controls have semantic HTML alternatives. Reduced motion and WebGL failure preserve usable content.

The homepage is the investigation collection, with a selectable 3D preview and links to all seven lab routes. Hosted labs 01, 02 and 07 retain the actual session/SSE/feedback flow. Local investigations include in-app VM commands, user-provided evidence notes, interpretation and transfer exercises; they never start a hosted run. Explanatory geometry is labeled as a model; observation counts and traces depend on received events. Live failures stay visible. The notebook supports prediction, real observation, selected raw evidence, explanation, transfer and downloadable case notes.

Keep the current deployment architecture and credentials untouched; deliver a local preview for design review before any publication. No backend changes or simulated successful runs.

## Application-wide extension (user correction)

The design applies across the application, not only the first workbench. Add a shared shell and route-aware navigation for the lab index, all seven lab routes, field guide, and saved notebooks. Give all seven scenes distinct subject-specific geometry and layer explanations. Local labs get in-app commands, evidence notes, interpretation and transfer exercises, with manual output identified as user-provided. Persist drafts and completed case notes in this browser with explicit storage copy and per-notebook deletion. Interrupted hosted sessions never restart automatically or claim completion. Include previous/next navigation, contextual layer progression, notebook backtracking, branded not-found and loading states, and mobile navigation. Existing server endpoints and deployment architecture remain unchanged.
