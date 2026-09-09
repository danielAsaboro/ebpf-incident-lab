use std::{
    fs, io,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

use incident_fixtures::open_scenarios;

fn main() -> io::Result<()> {
    let scenario = std::env::var("INCIDENT_FILE_SCENARIO").unwrap_or_else(|_| "baseline".into());
    if !matches!(scenario.as_str(), "baseline" | "fallback" | "relative") {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "unknown fixed file scenario"));
    }
    if scenario != "baseline" { return varied_scenario(&scenario); }
    let root = PathBuf::from(format!("/tmp/ebpf-incident-file-{}", std::process::id()));
    fs::create_dir_all(&root)?;
    let scenarios = open_scenarios(root.to_str().unwrap());
    fs::write(&scenarios[0].path, b"mode=demo\n")?;
    fs::write(&scenarios[2].path, b"secret=demo\n")?;
    fs::set_permissions(&scenarios[2].path, fs::Permissions::from_mode(0o000))?;

    for scenario in &scenarios {
        let result = if scenario.label == "permission-denied" {
            open_without_root_override(Path::new(&scenario.path))
        } else {
            fs::File::open(&scenario.path)
        };
        println!(
            "{} path={} result={:?}",
            scenario.label,
            scenario.path,
            result.as_ref().map(|_| "opened")
        );
    }

    fs::set_permissions(&scenarios[2].path, fs::Permissions::from_mode(0o600))?;
    fs::remove_dir_all(&root)?;
    Ok(())
}

fn open_without_root_override(path: &Path) -> io::Result<fs::File> {
    let original_euid = unsafe { libc::geteuid() };
    if original_euid != 0 {
        return fs::File::open(path);
    }

    // The observers need root, but root bypasses ordinary Unix mode checks. Drop only the
    // effective UID for this one syscall so the fixture deterministically produces EACCES.
    if unsafe { libc::seteuid(65_534) } != 0 {
        return Err(io::Error::last_os_error());
    }
    let result = fs::File::open(path);
    let restore_result = unsafe { libc::seteuid(original_euid) };
    if restore_result != 0 {
        return Err(io::Error::last_os_error());
    }
    result
}

// Reviewed, fixed workloads. No learner path or command is accepted.
fn varied_scenario(scenario: &str) -> io::Result<()> {
    let root = PathBuf::from(format!("/tmp/ebpf-incident-transfer-{}", std::process::id()));
    fs::create_dir(&root)?;
    let result = (|| -> io::Result<()> {
        if scenario == "fallback" {
            fs::write(root.join("default.conf"), b"mode=fallback\n")?;
            let primary = fs::File::open(root.join("override.conf"));
            println!("primary result={:?}", primary.as_ref().map(|_| "opened"));
            if primary.is_err() {
                let fallback = fs::File::open(root.join("default.conf"))?;
                println!("fallback opened={:?}", fallback.metadata()?.len());
            }
        } else {
            fs::create_dir(root.join("service-a"))?;
            fs::create_dir(root.join("service-b"))?;
            fs::write(root.join("service-a/settings.conf"), b"mode=a\n")?;
            let original = std::env::current_dir()?;
            let relative_result = (|| -> io::Result<()> {
                std::env::set_current_dir(root.join("service-a"))?;
                let a = fs::File::open("settings.conf");
                println!("first relative attempt={:?}", a.as_ref().map(|_| "opened"));
                std::env::set_current_dir(root.join("service-b"))?;
                let b = fs::File::open("settings.conf");
                println!("second relative attempt={:?}", b.as_ref().map(|_| "opened"));
                Ok(())
            })();
            std::env::set_current_dir(original)?;
            relative_result?;
        }
        Ok(())
    })();
    let cleanup = fs::remove_dir_all(&root);
    result.and(cleanup)
}
