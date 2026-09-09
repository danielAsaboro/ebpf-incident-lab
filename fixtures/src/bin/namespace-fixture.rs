use std::{thread, time::Duration};

fn main() {
    println!("namespace-visible pid={} sleeping=5s", std::process::id());
    thread::sleep(Duration::from_secs(5));
}
