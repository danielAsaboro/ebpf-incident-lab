use std::time::{Duration, Instant};

use incident_fixtures::{open_scenarios, resolve_backend_safe};

#[test]
fn file_fixture_includes_success_missing_and_permission_cases() {
    let scenarios = open_scenarios("/tmp/incident-fixture");
    assert_eq!(scenarios.len(), 3);
    assert_eq!(scenarios[0].label, "success");
    assert_eq!(scenarios[1].label, "missing");
    assert_eq!(scenarios[2].label, "permission-denied");
}

#[test]
fn resolver_fixture_applies_the_requested_delay() {
    let started = Instant::now();
    let result = resolve_backend_safe("localhost", 5);

    assert!(result.is_ok());
    assert!(started.elapsed() >= Duration::from_millis(5));
}
