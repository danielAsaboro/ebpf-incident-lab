use std::{env, ffi::CString};

fn main() {
    let hostname = env::args().nth(1).unwrap_or_else(|| "localhost".to_owned());
    let delay_ms = env::args().nth(2).and_then(|v| v.parse().ok()).unwrap_or(0);
    let hostname = CString::new(hostname).expect("hostname contains a NUL byte");
    let result = unsafe { incident_fixtures::resolve_backend(hostname.as_ptr(), delay_ms) };
    println!("resolve_backend result={result} delay_ms={delay_ms}");
}
