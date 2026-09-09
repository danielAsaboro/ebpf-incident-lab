#!/usr/bin/env python3
import json
import pathlib
import sys

def load(path: str) -> list[dict]:
    rows = []
    for number, line in enumerate(pathlib.Path(path).read_text().splitlines(), 1):
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise AssertionError(f"line {number} is not valid JSON: {error}") from error
        assert isinstance(value, dict), f"line {number} is not a JSON object"
        rows.append(value)
    assert rows, "observer emitted no events"
    return rows

lab = int(sys.argv[1])
events = load(sys.argv[2])
if lab == 1:
    assert any(e.get("event_type") == "process_exec" and e.get("filename") == "/bin/sleep" for e in events)
elif lab == 2:
    selected = [e for e in events if e.get("event_type") == "file_open" and "ebpf-incident-file" in e.get("path", "")]
    codes = {e.get("return_code") for e in selected}
    assert any(isinstance(code, int) and code >= 0 for code in codes), f"missing successful file descriptor: {codes}"
    assert {-2, -13} <= codes, f"missing file errors: {codes}"
elif lab == 3:
    selected = [e for e in events if e.get("event_type") == "connect" and e.get("destination_address") in {"127.0.0.1", "::1"}]
    codes = {e.get("return_code") for e in selected}
    assert {0, -111} <= codes, f"missing connect outcomes: {codes}"
elif lab == 4:
    assert any(e.get("event_type") == "dns_resolution" and e.get("hostname") == "localhost" and e.get("latency_us", 0) >= 90_000 for e in events)
elif lab == 5:
    assert any(e.get("event_type") == "tcp_retransmit_summary" and e.get("destination_port") == 18_080 and e.get("retransmissions", 0) >= 1 for e in events)
    assert any(e.get("event_type") == "tcp_retransmit_histogram" and sum(e.get(field, 0) for field in ("flows_with_1", "flows_with_2_to_3", "flows_with_4_to_7", "flows_with_8_or_more")) >= 1 for e in events)
elif lab == 6:
    assert any(e.get("event_type") == "namespace_exec" and e.get("namespace_pid") == 1 and e.get("host_pid") != 1 and e.get("cgroup_id", 0) > 0 for e in events)
elif lab == 7:
    assert any(e.get("event_type") == "verifier_demo" for e in events)
else:
    raise AssertionError(f"unsupported lab assertion: {lab}")
print(f"ok    lab {lab} semantic evidence")
