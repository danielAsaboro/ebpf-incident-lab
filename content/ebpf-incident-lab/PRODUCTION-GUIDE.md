# Season production and accessibility guide

This is the shared production contract for all seven episodes. It keeps the
series visually consistent without turning the articles into editing scripts.

## Runtime model

Narration is written for roughly 125–140 words per minute. The displayed runtime
also includes terminal execution, output inspection, pauses at diagrams, and the
viewer exercise. Do a timed table read before recording; adjust the timestamp
labels rather than accelerating technical explanations.

## Reusable visual package

1. **Five-second title:** episode number, incident question, and lab slug.
2. **Incident card:** symptom, known facts, and the single question being tested.
3. **Boundary diagram:** highlight only the hook and evidence path used here.
4. **Terminal layout:** observer on the left, fixture on the right, relevant event enlarged below.
5. **Evidence card:** “This proves” and “This does not prove” shown together.
6. **Recap card:** reusable technique, exercise, and next episode.

Keep diagrams to one active idea. Reveal nodes in narration order. Do not place
decorative packet streams or source code behind explanatory text.

## Terminal recording

- Record at 1920×1080 or higher with a terminal font equivalent to at least 28 px.
- Use a high-contrast theme; never communicate success and failure by color alone.
- Keep commands in repository form. Do not type shortened commands that viewers cannot copy.
- Wait for the observer’s `READY` message before triggering a fixture.
- Highlight only fields being discussed; preserve the complete output in the lab guide.
- Replace incidental usernames, hostnames, and home paths before publication.
- Never stage output. If a run differs, explain it or record a new verified run.

## Captions and spoken technical language

- Produce edited captions, not an unchecked automatic transcript.
- Caption `eBPF`, `Aya`, `execve`, `openat`, `errno`, `uprobe`, `uretprobe`, `BTF`, and `CO-RE` consistently.
- Introduce acronyms aloud on first use unless the immediately visible diagram expands them.
- Keep caption lines to readable phrase boundaries and avoid covering terminal output.
- Include important non-speech audio only when it carries meaning; the current format does not rely on sound effects.

## Visual accessibility

- Every diagram needs a one-sentence spoken description of the relationship it conveys.
- Use labels or shapes in addition to red/green state colors.
- Maintain WCAG-style contrast for text and essential graphics.
- Avoid rapid flashing, unnecessary camera motion, and terminal zooms that prevent reading.
- Thumbnail text should remain legible at mobile size and should not repeat the full title.

## Publication checklist

- [ ] Commands match the tagged repository state used in the recording.
- [ ] A fresh lab run produces the demonstrated semantic event.
- [ ] Captions were manually reviewed against technical terms.
- [ ] Description links to the lab, expected output, sources, and playlist.
- [ ] Chapters match the final edit rather than the draft timestamps.
- [ ] Thumbnail and title distinguish the incident, not merely the eBPF concept.
- [ ] “What this cannot prove” remains in the final cut.
- [ ] Exercise is present in the description and article.
- [ ] No private terminal data or fabricated output appears.
- [ ] `video.md` receives the final public URL only after publication.

Publication URLs and learner feedback intentionally remain absent until they
exist. Do not add placeholders that could be mistaken for completed evidence.
