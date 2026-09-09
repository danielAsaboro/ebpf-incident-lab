#!/usr/bin/env python3
"""Validate the article-first production scripts and repository integration."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEASON = ROOT / "content" / "ebpf-incident-lab"
PLACEHOLDERS = re.compile(r"\b(?:TODO|TBD|FIXME)\b|https?://example\.com", re.I)
LINK = re.compile(r"\[([^]]+)]\(([^)]+)\)")
TEXT_FENCE = re.compile(r"```text\n(.*?)\n```", re.S)
TIMED_HEADING = re.compile(r"^## \[(\d{2}):(\d{2})–(\d{2}):(\d{2})]", re.M)
RUNTIME = re.compile(r"\*\*Estimated runtime:\*\* (\d+)–(\d+) minutes")


def seconds(minutes: str, remainder: str) -> int:
    return int(minutes) * 60 + int(remainder)


def local_link_errors(path: Path, text: str) -> list[str]:
    errors: list[str] = []
    for _label, target in LINK.findall(text):
        if target.startswith(("https://", "http://", "#")):
            continue
        clean_target = target.split("#", 1)[0]
        if clean_target and not (path.parent / clean_target).resolve().exists():
            errors.append(f"{path.relative_to(ROOT)}: missing local link {target}")
    return errors


def validate_episode(path: Path) -> list[str]:
    text = path.read_text()
    errors = local_link_errors(path, text)
    required = (
        "**Estimated runtime:**",
        "**Audience:**",
        "**Core argument:**",
        "**Lab:**",
        "**Tone:**",
        "**VISUAL:**",
        "**NARRATION**",
        "## Sources and further reading",
    )
    for marker in required:
        if marker not in text:
            errors.append(f"{path.relative_to(ROOT)}: missing {marker}")

    timed_sections = sum(line.startswith("## [") for line in text.splitlines())
    visuals = text.count("**VISUAL:**")
    if timed_sections < 6:
        errors.append(f"{path.relative_to(ROOT)}: only {timed_sections} timed sections")
    if visuals != timed_sections:
        errors.append(
            f"{path.relative_to(ROOT)}: {timed_sections} sections but {visuals} visuals"
        )

    ranges = [
        (seconds(start_m, start_s), seconds(end_m, end_s))
        for start_m, start_s, end_m, end_s in TIMED_HEADING.findall(text)
    ]
    if ranges and ranges[0][0] != 0:
        errors.append(f"{path.relative_to(ROOT)}: timeline does not start at 00:00")
    for previous, current in zip(ranges, ranges[1:]):
        if previous[1] != current[0]:
            errors.append(
                f"{path.relative_to(ROOT)}: timeline gap/overlap at {previous[1]} seconds"
            )
    runtime = RUNTIME.search(text)
    if ranges and runtime:
        minimum, maximum = (int(value) * 60 for value in runtime.groups())
        if not minimum <= ranges[-1][1] <= maximum:
            errors.append(
                f"{path.relative_to(ROOT)}: final timestamp is outside estimated runtime"
            )

    spoken_words = sum(len(block.split()) for block in TEXT_FENCE.findall(text))
    if spoken_words < 1_200:
        errors.append(
            f"{path.relative_to(ROOT)}: {spoken_words} spoken words; minimum is 1200"
        )
    if text.count("```") % 2:
        errors.append(f"{path.relative_to(ROOT)}: unbalanced code fences")
    if PLACEHOLDERS.search(text):
        errors.append(f"{path.relative_to(ROOT)}: contains a placeholder")

    sources = text.split("## Sources and further reading", 1)[-1]
    external_sources = [target for _, target in LINK.findall(sources) if target.startswith("https://")]
    if len(external_sources) < 2:
        errors.append(f"{path.relative_to(ROOT)}: fewer than two external sources")
    if not any(
        host in target for target in external_sources for host in ("aya-rs.dev", "docs.kernel.org")
    ):
        errors.append(f"{path.relative_to(ROOT)}: no primary technical source")

    return errors


def main() -> int:
    episodes = sorted(SEASON.glob("[0-9][0-9]-*.md"))
    errors: list[str] = []
    if len(episodes) != 7:
        errors.append(f"expected 7 episode scripts, found {len(episodes)}")

    expected_commands = {
        1: ("scripts/run-lab.sh 01-exec-watch", "/bin/sleep 2"),
        2: ("scripts/run-lab.sh 02-file-open", "target/release/file-fixture"),
        3: ("scripts/run-lab.sh 03-connect-failures", "target/release/connect-fixture"),
        4: ("scripts/run-lab.sh 04-dns-latency", "target/release/dns-fixture"),
        5: ("scripts/run-lab.sh 05-tcp-retransmits", "scripts/run-retransmit-fixture.sh"),
        6: ("scripts/run-lab.sh 06-namespace-pids", "unshare --fork --pid --mount-proc"),
        7: ("scripts/run-lab.sh 07-verifier-portability", "INCIDENT_VERIFIER_BROKEN=1"),
    }
    for number, path in enumerate(episodes, start=1):
        errors.extend(validate_episode(path))
        text = path.read_text()
        for command_fragment in expected_commands[number]:
            if command_fragment not in text:
                errors.append(
                    f"{path.relative_to(ROOT)}: missing command fragment {command_fragment}"
                )

    for supporting in (
        SEASON / "README.md",
        SEASON / "RESEARCH.md",
        SEASON / "PRODUCTION-GUIDE.md",
        SEASON / "PUBLISHING.md",
    ):
        if not supporting.exists():
            errors.append(f"missing {supporting.relative_to(ROOT)}")
        else:
            errors.extend(local_link_errors(supporting, supporting.read_text()))

    for number, episode in enumerate(episodes, start=1):
        candidates = list((ROOT / "labs").glob(f"{number:02d}-*/video.md"))
        if len(candidates) != 1:
            errors.append(f"episode {number}: expected one lab video.md, found {len(candidates)}")
            continue
        video = candidates[0]
        errors.extend(local_link_errors(video, video.read_text()))
        if episode.name not in video.read_text():
            errors.append(f"{video.relative_to(ROOT)}: does not link to {episode.name}")

    if errors:
        print("Content verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    counts = [sum(len(block.split()) for block in TEXT_FENCE.findall(path.read_text())) for path in episodes]
    print(
        f"Content verification passed: 7 episodes, {sum(counts)} spoken words, "
        "local links, sources, production metadata, and lab integration valid."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
