#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { printf 'provision.sh must run as root\n' >&2; exit 1; }
source_dir="${INCIDENT_LAB_SOURCE_DIR:-/mnt/incident-source}"
artifact_dir="${INCIDENT_LAB_GUEST_ARTIFACT_DIR:-/mnt/incident-artifact}"
install_root="${INCIDENT_LAB_INSTALL_ROOT:-/opt/incident-lab}"
state_dir="${INCIDENT_LAB_STATE_DIR:-/var/lib/incident-lab}"
bin_dir="${INCIDENT_LAB_BIN_DIR:-/usr/local/bin}"
motd_dir="${INCIDENT_LAB_MOTD_DIR:-/etc/update-motd.d}"
manifest="$source_dir/vm/manifest.json"
mode="${1:-provision}"

json_value() {
  python3 - "$manifest" "$1" <<'PY'
import json, sys
v=json.load(open(sys.argv[1]))
for key in sys.argv[2].split('.'): v=v[key]
print(v if v is not None else '')
PY
}

if [ "$mode" = --dev-setup ]; then
  user=lima
  home_dir="$(getent passwd "$user" | cut -d: -f6)"
  sudo -u "$user" env HOME="$home_dir" bash -lc '
    set -e
    command -v rustup >/dev/null || curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    . "$HOME/.cargo/env"
    rustup toolchain install 1.89.0
    rustup toolchain install nightly-2025-08-01 --component rust-src
    cargo install bpf-linker --version 0.9.15 --locked
    cd /opt/incident-lab && ./scripts/build.sh
  '
  exit
fi

grep -q '^ID=ubuntu$' /etc/os-release || { printf 'unsupported guest: Ubuntu is required\n' >&2; exit 1; }
[ "$(uname -m)" = x86_64 ] || { printf 'unsupported guest architecture: x86_64 is required\n' >&2; exit 1; }
mount_opts="$(findmnt -no OPTIONS "$source_dir")"
case ",$mount_opts," in *,ro,*) ;; *) printf 'source mount must be read-only: %s\n' "$source_dir" >&2; exit 1;; esac

if [ "$mode" = provision ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends binutils ca-certificates iproute2 jq python3 rsync util-linux zstd
  mountpoint -q /sys/kernel/tracing || mount -t tracefs tracefs /sys/kernel/tracing
fi

bundle="$artifact_dir/$(json_value bundle.filename)"
expected="$(json_value bundle.sha256)"
[ -f "$bundle" ] || { printf 'learner bundle missing in guest: %s\n' "$bundle" >&2; exit 1; }
actual="$(sha256sum "$bundle" | awk '{print $1}')"
[ "$actual" = "$expected" ] || { printf 'learner bundle checksum mismatch in guest\n' >&2; exit 1; }

stage="${install_root}.new.$$"
rm -rf "$stage"
mkdir -p "$stage"
rsync -a --delete --exclude .git --exclude target --exclude target-linux --exclude vm/artifacts "$source_dir/" "$stage/"
source_digest="$(find "$stage" -type f ! -path "$stage/target/*" ! -path "$stage/.git/*" -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')"
tar --zstd -xf "$bundle" -C "$stage"
for name in 01-exec-watch 02-file-open 03-connect-failures 04-dns-latency 05-tcp-retransmits 06-namespace-pids 07-verifier-portability connect-fixture dns-fixture file-fixture namespace-fixture tcp-fixture; do
  [ -x "$stage/target/release/$name" ] || { printf 'bundle layout missing executable: %s\n' "$name" >&2; exit 1; }
done
chown -R lima:lima "$stage"
rm -rf "${install_root}.previous"
[ ! -e "$install_root" ] || mv "$install_root" "${install_root}.previous"
mv "$stage" "$install_root"
install -m 0755 "$source_dir/vm/guest/incident-lab" "$bin_dir/incident-lab"
mkdir -p "$motd_dir" "$state_dir"
install -m 0644 "$source_dir/vm/MOTD.md" "$motd_dir/60-incident-lab"

repository_id="${INCIDENT_LAB_REPOSITORY_ID:-missing}"
manifest_version="${INCIDENT_LAB_MANIFEST_VERSION:-$(json_value release_id)}"
python3 - "$state_dir/owner.json.new" "$repository_id" "$manifest_version" <<'PY'
import json, sys
with open(sys.argv[1], 'w') as f: json.dump({'repository_id':sys.argv[2], 'manifest_version':sys.argv[3]}, f, sort_keys=True)
PY
mv "$state_dir/owner.json.new" "$state_dir/owner.json"

"$bin_dir/incident-lab" doctor
"$bin_dir/incident-lab" _readiness
python3 - "$state_dir/provisioned.json.new" "$(json_value release_id)" "$actual" <<'PY'
import json, sys
with open(sys.argv[1], 'w') as f: json.dump({'release_id':sys.argv[2], 'bundle_sha256':sys.argv[3]}, f, sort_keys=True)
PY
mv "$state_dir/provisioned.json.new" "$state_dir/provisioned.json"
printf '%s\n' "$source_digest" >"$state_dir/source.sha256.new"
mv "$state_dir/source.sha256.new" "$state_dir/source.sha256"
rm -rf "${install_root}.previous"
