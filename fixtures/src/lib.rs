use std::{ffi::CStr, io, net::ToSocketAddrs, os::raw::c_char, thread, time::Duration};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OpenScenario {
    pub label: &'static str,
    pub path: String,
}

pub fn open_scenarios(root: &str) -> [OpenScenario; 3] {
    [
        OpenScenario {
            label: "success",
            path: format!("{root}/readable.conf"),
        },
        OpenScenario {
            label: "missing",
            path: format!("{root}/missing.conf"),
        },
        OpenScenario {
            label: "permission-denied",
            path: format!("{root}/private.conf"),
        },
    ]
}

pub fn resolve_backend_safe(hostname: &str, delay_ms: u64) -> io::Result<()> {
    thread::sleep(Duration::from_millis(delay_ms));
    (hostname, 80)
        .to_socket_addrs()?
        .next()
        .map(|_| ())
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "resolver returned no addresses"))
}

/// Stable userspace symbol used by lab 04's uprobe and uretprobe.
///
/// # Safety
/// `hostname` must point to a valid NUL-terminated C string for the duration of the call.
#[no_mangle]
pub unsafe extern "C" fn resolve_backend(hostname: *const c_char, delay_ms: u64) -> i32 {
    if hostname.is_null() {
        return libc_errno::EINVAL;
    }
    let hostname = unsafe { CStr::from_ptr(hostname) };
    let Ok(hostname) = hostname.to_str() else {
        return libc_errno::EINVAL;
    };
    match resolve_backend_safe(hostname, delay_ms) {
        Ok(()) => 0,
        Err(_) => libc_errno::EIO,
    }
}

mod libc_errno {
    pub const EIO: i32 = 5;
    pub const EINVAL: i32 = 22;
}
