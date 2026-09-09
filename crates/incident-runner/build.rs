use anyhow::{anyhow, Context as _};

fn main() -> anyhow::Result<()> {
    println!("cargo:rerun-if-changed=../incident-ebpf/src/main.rs");
    println!("cargo:rerun-if-changed=../incident-common/src/lib.rs");

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("linux") {
        let output = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
        std::fs::write(output.join("incident-ebpf"), [])?;
        std::fs::write(output.join("core-demo-ebpf"), [])?;
        return Ok(());
    }

    let cargo_metadata::Metadata { packages, .. } = cargo_metadata::MetadataCommand::new()
        .no_deps()
        .exec()
        .context("read workspace metadata")?;
    let package = packages
        .into_iter()
        .find(|package| package.name.as_str() == "incident-ebpf")
        .ok_or_else(|| anyhow!("incident-ebpf package not found"))?;
    let root_dir = package
        .manifest_path
        .parent()
        .ok_or_else(|| anyhow!("incident-ebpf manifest has no parent"))?;

    aya_build::build_ebpf(
        [aya_build::Package {
            name: package.name.as_str(),
            root_dir: root_dir.as_str(),
            ..Default::default()
        }],
        aya_build::Toolchain::default(),
    )?;

    let output = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
    let source = root_dir.join("src/core_demo.bpf.c");
    println!("cargo:rerun-if-changed={}", source);
    let status = std::process::Command::new("clang")
        .args(["-target", "bpfel", "-O2", "-g", "-c"])
        .arg(source.as_std_path())
        .arg("-o")
        .arg(output.join("core-demo-ebpf"))
        .status()
        .context("run clang for the Lab 7 CO-RE probe")?;
    if !status.success() {
        anyhow::bail!("clang failed to build the Lab 7 CO-RE probe");
    }
    Ok(())
}
