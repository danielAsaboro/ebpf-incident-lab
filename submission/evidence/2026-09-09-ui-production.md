# Application-wide UI production deployment

The application-wide Three.js interface was deployed to https://ebpf-lab.danielasaboro.com on 2026-09-09.

- Application commit: `873cb6677fbafc4b04f210630e145637db6cb51d`
- Vercel deployment: `dpl_9eXstrQwFZp648FDWuocbWXbCrTa`
- Production deployment URL: https://ebpf-incident-kc32ntvkc-harmonia-b4a76411.vercel.app
- Deployment status: READY; existing custom domain alias verified with Vercel inspect.
- Validation: 23 web tests, lint, TypeScript and production build passed before release.

The collection, guide, notebooks and all seven numbered lab pages returned HTTP 200. The homepage served the new collection content. Unknown Lab 99 returned HTTP 404.

## Hosted execution through the custom domain

Requests used the public application proxy without client-supplied runner credentials. Each SSE reader stopped at the terminal event. No learner feedback was submitted.

| Lab | Observations | Result |
|---|---:|---|
| 01 | 1 | process_exec; completed and cleanup finished |
| 02 | 10 | file_open; both missing-file and permission-denied outcomes observed; completed and cleanup finished |
| 07 | 1 | verifier_demo; completed and cleanup finished |

Raw telemetry is retained locally outside version control. No session identifiers, process IDs, event timestamps or observed filesystem paths are published in this receipt.

The existing production runner URL and token were reused. Cloudflare Access remains deferred as previously requested. The local environment is ignored by Git, has owner-only file permissions, and contains the existing dedicated runner credential rather than the redacted values returned by the production environment export. No credentials are included in this evidence or the deployment source upload.

Labs 03–06 now have complete in-app notebook workflows, but their observers still execute in the local learner VM. Pasted output is user-provided, not independently verified. These automated production checks are not browser usability acceptance, independent learner outcomes or proof of all supported kernel environments.
