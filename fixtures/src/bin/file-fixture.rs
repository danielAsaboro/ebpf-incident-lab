use std::{
    fs, io,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

use incident_fixtures::open_scenarios;

fn main() -> io::Result<()> {
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
