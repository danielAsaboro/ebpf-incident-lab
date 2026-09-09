# Tested environments

| Environment | Architecture / kernel | Status | Evidence |
|---|---|---|---|
| macOS host | Apple Silicon / Darwin | Contract tests pass; eBPF loading intentionally refused | `cargo test` for common, CLI, lab decoder, and fixtures |
| Docker Desktop Linux VM | arm64 / LinuxKit 6.12.76 | Release eBPF build passes; process-exec observer loaded, attached, and emitted NDJSON after mounting tracefs | Local validation on 2026-08-27 |
| Ubuntu 24.04.4 LTS VM | x86_64 / 6.8.0-134-generic | Expanded environment checker passes; the same CO-RE object emits syscall ID 1; unsafe nullable map dereference is rejected at load | Lima/QEMU v0.2 acceptance on 2026-08-27 |
| Ubuntu 24.04.4 HWE | x86_64 / 7.0.0-30-generic | Clean release build; all seven strict semantic scenarios; six adversarial failure/cleanup scenarios; nonzero CO-RE relocation metadata | Lima/QEMU v0.2 acceptance on 2026-08-27 |
| macOS / Lima 2.2.0 / pinned Ubuntu 24.04 image | Apple Silicon host; QEMU x86_64 guest / 6.8.0-134-generic | Fresh `vm-v1` native-ext4 prebuilt path, doctor, seven semantic scenarios, adversarial cleanup, and stop/start persistence passed | 2026-09-03: image download ~51 s; total start 265.17 s; first event no later than 213 s after download; smoke 42.35 s; workspace 22 MiB; root filesystem 2.0 GiB used |

Only observed results belong in this matrix. A container test is not relabeled as an Ubuntu test.
The VM bundle is local and checksum-pinned; this does not imply a public release asset or external learner validation.
