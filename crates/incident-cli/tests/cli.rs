use clap::Parser;
use incident_cli::{CommonArgs, OutputFormat};

#[test]
fn defaults_to_a_bounded_human_readable_run() {
    let args = CommonArgs::try_parse_from(["lab"]).unwrap();

    assert_eq!(args.duration, 30);
    assert_eq!(args.pid, None);
    assert_eq!(args.output_format(), OutputFormat::Human);
}

#[test]
fn json_and_pid_flags_are_supported() {
    let args =
        CommonArgs::try_parse_from(["lab", "--duration", "5", "--pid", "42", "--json"]).unwrap();

    assert_eq!(args.duration, 5);
    assert_eq!(args.pid, Some(42));
    assert_eq!(args.output_format(), OutputFormat::Json);
}

#[test]
fn zero_duration_is_rejected() {
    let error = CommonArgs::try_parse_from(["lab", "--duration", "0"]).unwrap_err();
    assert!(error
        .to_string()
        .contains("duration must be at least 1 second"));
}
