#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
manifest="$repo_dir/vm/manifest.json"
instance=ebpf-incident-lab
lima_home="${INCIDENT_LAB_LIMA_HOME:-}"
artifact_dir="${INCIDENT_LAB_ARTIFACT_DIR:-$repo_dir/vm/artifacts}"

usage() {
  printf 'usage: %s {start|status [--json]|doctor|shell|test|reset|stop|delete|dev-setup}\n' "$0" >&2
}
die() { printf 'lab-vm: %s\n' "$*" >&2; exit 1; }

manifest_value() {
  python3 - "$manifest" "$1" <<'PY'
import json, sys
value = json.load(open(sys.argv[1]))
for part in sys.argv[2].split('.'):
    value = value[part]
print(value if value is not None else '')
PY
}

[ -f "$manifest" ] || die "manifest missing: $manifest"
release_id="$(manifest_value release_id)"
repository_namespace="$(manifest_value repository_id_namespace)"
repository_id="$(printf '%s\n%s\n' "$repository_namespace" "$repo_dir" | shasum -a 256 | awk '{print $1}')"
export INCIDENT_LAB_REPOSITORY_ID="$repository_id"

lima() {
  if [ -n "$lima_home" ]; then LIMA_HOME="$lima_home" limactl "$@"; else limactl "$@"; fi
}

instance_state() {
  local json status
  json="$(lima list --json 2>/dev/null || true)"
  status="$(LIMA_LIST_JSON="$json" python3 - "$instance" <<'PY'
import json, os, sys
name = sys.argv[1]
for line in os.environ.get('LIMA_LIST_JSON', '').splitlines():
    try: item = json.loads(line)
    except json.JSONDecodeError: continue
    if item.get('name') == name:
        print(str(item.get('status', '')).lower())
        break
PY
)"
  case "$status" in running) printf running;; stopped) printf stopped;; *) printf absent;; esac
}

owner_json() {
  lima shell "$instance" -- sudo cat /var/lib/incident-lab/owner.json 2>/dev/null
}

config_owned() {
  local listing
  listing="$(lima list --json 2>/dev/null || true)"
  LIMA_LIST_JSON="$listing" python3 - "$instance" "$repository_id" "$release_id" <<'PY'
import json, os, sys
name, repository_id, release_id = sys.argv[1:]
for line in os.environ.get('LIMA_LIST_JSON', '').splitlines():
    try: item=json.loads(line)
    except json.JSONDecodeError: continue
    if item.get('name') != name: continue
    scripts='\n'.join(p.get('script','') for p in item.get('config',{}).get('provision',[]))
    ok=(('INCIDENT_LAB_REPOSITORY_ID="%s"' % repository_id) in scripts and
        ('INCIDENT_LAB_MANIFEST_VERSION="%s"' % release_id) in scripts)
    raise SystemExit(0 if ok else 1)
raise SystemExit(1)
PY
}

is_owned() {
  local owner
  config_owned || return 1
  [ "$(instance_state)" = running ] || return 0
  owner="$(owner_json 2>/dev/null || true)"
  OWNER_JSON="$owner" python3 - "$repository_id" "$release_id" <<'PY'
import json, os, sys
try: value = json.loads(os.environ.get('OWNER_JSON', ''))
except json.JSONDecodeError: raise SystemExit(1)
raise SystemExit(0 if value.get('repository_id') == sys.argv[1] and value.get('manifest_version') == sys.argv[2] else 1)
PY
}

require_owned() {
  [ "$(instance_state)" != absent ] || die "instance $instance is absent"
  is_owned || die "instance $instance is not owned by this repository; refusing to operate"
}

status_command() {
  local format="${1:-}" state owned=false provisioned=false
  [ -z "$format" ] || [ "$format" = --json ] || { usage; exit 2; }
  state="$(instance_state)"
  if [ "$state" != absent ] && is_owned; then owned=true; provisioned=true; fi
  if [ "$format" = --json ]; then
    python3 - "$instance" "$state" "$owned" "$provisioned" "$release_id" <<'PY'
import json, sys
print(json.dumps({"manifest_version":sys.argv[5],"name":sys.argv[1],"owned":sys.argv[3]=='true',"provisioned":sys.argv[4]=='true',"state":sys.argv[2]}, sort_keys=True))
PY
  else
    printf '%s\n' "$state"
  fi
}

version_at_least() {
  python3 - "$1" "$2" <<'PY'
import re, sys
def parts(v): return tuple(int(x) for x in re.findall(r'\d+', v)[:3])
raise SystemExit(0 if parts(sys.argv[1]) >= parts(sys.argv[2]) else 1)
PY
}

preflight() {
  [ "$(uname -s)" = Darwin ] || die "version one requires macOS; use the documented native Ubuntu contributor path on Linux"
  command -v limactl >/dev/null 2>&1 || die "Lima is missing; install Lima 2.0 or newer"
  local installed minimum bundle expected actual free
  installed="$(limactl --version 2>/dev/null || true)"
  minimum="$(manifest_value lima.minimum_version)"
  version_at_least "$installed" "$minimum" || die "Lima $minimum or newer is required (found: $installed)"
  bundle="$artifact_dir/$(manifest_value bundle.filename)"
  [ -f "$bundle" ] || die "learner bundle missing: $bundle; build or recover the verified x86_64 bundle first"
  expected="$(manifest_value bundle.sha256)"
  actual="$(shasum -a 256 "$bundle" | awk '{print $1}')"
  [ "$actual" = "$expected" ] || die "learner bundle checksum mismatch: expected $expected, got $actual"
  free="${INCIDENT_LAB_FREE_BYTES:-$(df -Pk "$repo_dir" | awk 'NR==2 {print $4 * 1024}')}"
  [ "$free" -ge 26843545600 ] || die "insufficient host disk: at least 25 GiB free is required"
}

confirm_exact() {
  local word="$1"
  [ -t 0 ] || die "$word requires an interactive terminal and the exact word '$word'"
  printf '%s will permanently remove owned instance %s for repository %s. Type %s: ' "$word" "$instance" "$repository_id" "$word" >&2
  local answer=''
  IFS= read -r answer || die "$word cancelled at end of input"
  [ "$answer" = "$word" ] || die "$word cancelled; confirmation did not match exactly"
}

start_command() {
  local state
  state="$(instance_state)"
  if [ "$state" = absent ]; then
    preflight
    local rendered
    rendered="$(mktemp "${TMPDIR:-/tmp}/incident-lab-lima.XXXXXX.yaml")"
    trap 'rm -f "$rendered"' EXIT INT TERM HUP
    python3 - "$repo_dir/vm/lima.yaml" "$rendered" "$repo_dir" "$artifact_dir" "$repository_id" "$release_id" <<'PY'
import json, sys
source, output, repo, artifacts, repository_id, release_id = sys.argv[1:]
text=open(source).read()
for key, value in {
  '{{SOURCE_PATH}}': json.dumps(repo),
  '{{ARTIFACT_PATH}}': json.dumps(artifacts),
  '{{REPOSITORY_ID}}': json.dumps(repository_id),
  '{{MANIFEST_VERSION}}': json.dumps(release_id),
}.items(): text=text.replace(key, value)
open(output, 'w').write(text)
PY
    lima start --yes "--name=$instance" "$rendered"
    rm -f "$rendered"
    trap - EXIT INT TERM HUP
    require_owned
    return
  fi
  require_owned
  [ "$state" = running ] || lima start "$instance"
}

command="${1:-}"
[ "$#" -gt 0 ] && shift || true
case "$command" in
  status) status_command "${1:-}" ;;
  start) [ "$#" -eq 0 ] || { usage; exit 2; }; start_command ;;
  stop) [ "$#" -eq 0 ] || { usage; exit 2; }; require_owned; lima stop "$instance" ;;
  doctor|test|dev-setup) [ "$#" -eq 0 ] || { usage; exit 2; }; require_owned; lima shell "$instance" -- incident-lab "$command" ;;
  shell) [ "$#" -eq 0 ] || { usage; exit 2; }; require_owned; lima shell "$instance" ;;
  reset) [ "$#" -eq 0 ] || { usage; exit 2; }; require_owned; confirm_exact reset; lima stop "$instance" || true; lima delete "$instance"; start_command ;;
  delete) [ "$#" -eq 0 ] || { usage; exit 2; }; require_owned; confirm_exact delete; lima stop "$instance" || true; lima delete "$instance" ;;
  *) usage; exit 2 ;;
esac
