# How to contribute an Incident Lab improvement

Start with the [hosted investigations](https://ebpf-lab.danielasaboro.com) or the [local VM](vm/README.md). The repository welcomes reproducible corrections to the labs, learning material, and setup instructions.

## Report a problem

Open a GitHub issue with the lab number, public page or command, expected behavior, actual behavior, and minimal steps to reproduce. For local execution, include architecture, distribution, kernel version, and the release tag. For the hosted interface, include browser and whether the run reached a terminal result.

Remove credentials, private paths, host identifiers, and unrelated terminal output before sharing. Do not upload production data or whole session transcripts. A failure report is useful even when you cannot identify its cause.

## Propose a change

1. Fork the repository and create a branch. Describe the specific learner or operator problem in your pull request.
2. Keep fixtures deterministic and observations bounded. State what an event establishes and what it cannot prove. The hosted API accepts fixed lab IDs; do not add user-supplied shell commands, programs, PIDs, paths, or runtime arguments.
3. For Rust or shell changes, run `./scripts/test-all.sh`. macOS checks do not prove Linux attachment; changes to kernel hooks or fixtures also need the documented privileged Linux smoke run on the claimed environment.
4. For web changes, run `npm ci`, `npm test`, `npm run lint`, and `npm run build` inside `web/`. Verify changed flows with keyboard input and a narrow viewport. State which checks you actually ran.
5. Include source links for technical claims and link the observed test evidence. Keep compatibility and hosted/local badges aligned with verified behavior.

Do not submit private research, participant records, application drafts, or secrets. The project publishes code under the repository licenses; see [LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
