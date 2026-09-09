use incident_common::{
    EventHeader, EventType, NamespaceEvent, PathBytes, ProcessEvent, RetransmitEvent, VerifierEvent,
};
use incident_labs::{
    catalog, decode_wire, parse_proc_status, render_event, EventPayload, EventRecord, Lab,
    RetransmitAggregator,
};

#[test]
fn catalog_contains_the_seven_numbered_labs() {
    let labs = catalog();
    assert_eq!(labs.len(), 7);
    assert_eq!(labs[0].slug, "01-exec-watch");
    assert_eq!(labs[6].slug, "07-verifier-portability");
    assert!(labs
        .windows(2)
        .all(|pair| pair[0].number + 1 == pair[1].number));
}

#[test]
fn every_lab_has_a_distinct_program_and_trace_source() {
    let labs = catalog();
    for lab in labs {
        assert!(!lab.programs.is_empty(), "{} has no programs", lab.slug);
        assert!(
            !lab.trace_sources.is_empty(),
            "{} has no trace source",
            lab.slug
        );
    }
}

#[test]
fn pid_filter_matches_host_pid_only() {
    let event = EventRecord::example(EventType::Connect, 4242);
    assert!(event.matches_pid(None));
    assert!(event.matches_pid(Some(4242)));
    assert!(!event.matches_pid(Some(1)));
}

#[test]
fn json_output_is_one_valid_object() {
    let event = EventRecord::example(EventType::ProcessExec, 123);
    let rendered = render_event(&event, true).unwrap();
    let value: serde_json::Value = serde_json::from_str(&rendered).unwrap();

    assert_eq!(value["pid"], 123);
    assert_eq!(value["event_type"], "process_exec");
    assert!(value.get("detail").is_none());
    assert_eq!(value["parent_pid"], serde_json::Value::Null);
    assert_eq!(value["filename"], "");
}

#[test]
fn lab_lookup_accepts_number_or_slug() {
    assert_eq!(Lab::find("1").unwrap().slug, "01-exec-watch");
    assert_eq!(Lab::find("04-dns-latency").unwrap().number, 4);
    assert!(Lab::find("8").is_none());
}

#[test]
fn process_wire_event_decodes_into_a_display_record() {
    let event = ProcessEvent {
        header: EventHeader::new(99, 7, 7, 1000, EventType::ProcessExec, b"bash"),
        parent_pid: 6,
        reserved: 0,
        filename: {
            let mut path = PathBytes::default();
            path.0[..9].copy_from_slice(b"/bin/date");
            path
        },
    };

    let decoded = decode_wire(bytemuck::bytes_of(&event)).unwrap();
    assert_eq!(decoded.pid, 7);
    assert_eq!(decoded.event_type, "process_exec");
    assert_eq!(
        decoded.payload,
        EventPayload::ProcessExec {
            parent_pid: Some(6),
            filename: "/bin/date".into(),
        }
    );

    let json: serde_json::Value =
        serde_json::from_str(&render_event(&decoded, true).unwrap()).unwrap();
    assert_eq!(json["parent_pid"], 6);
    assert_eq!(json["filename"], "/bin/date");
}

#[test]
fn truncated_wire_event_is_rejected() {
    let error = decode_wire(&[0_u8; 4]).unwrap_err();
    assert!(error.to_string().contains("event header"));
}

#[test]
fn namespace_event_keeps_host_and_namespace_identity_separate() {
    let event = NamespaceEvent {
        header: EventHeader::new(1, 9001, 9001, 0, EventType::NamespaceExec, b"sleep"),
        cgroup_id: 77,
        namespace_pid: 1,
        parent_pid: 9000,
        filename: PathBytes::default(),
    };

    let decoded = decode_wire(bytemuck::bytes_of(&event)).unwrap();
    assert_eq!(decoded.pid, 9001);
    assert_eq!(
        decoded.payload,
        EventPayload::NamespaceExec {
            host_pid: 9001,
            namespace_pid: Some(1),
            cgroup_id: 77,
            parent_pid: Some(9000),
            filename: "".into(),
        }
    );
}

#[test]
fn proc_status_parser_extracts_parent_and_innermost_namespace_pid() {
    let status = "Name:\tsleep\nPid:\t9001\nPPid:\t9000\nNSpid:\t9001\t1\n";
    let identity = parse_proc_status(status).unwrap();

    assert_eq!(identity.parent_pid, 9000);
    assert_eq!(identity.namespace_pid, 1);
}

#[test]
fn proc_status_without_nspid_falls_back_to_host_pid() {
    let status = "Name:\tbash\nPid:\t42\nPPid:\t7\n";
    let identity = parse_proc_status(status).unwrap();

    assert_eq!(identity.parent_pid, 7);
    assert_eq!(identity.namespace_pid, 42);
}

#[test]
fn process_identity_enrichment_replaces_kernel_placeholders() {
    let mut event = EventRecord::example(EventType::NamespaceExec, 9001);
    event.payload = EventPayload::NamespaceExec {
        host_pid: 9001,
        namespace_pid: None,
        cgroup_id: 77,
        parent_pid: None,
        filename: "/bin/sleep".into(),
    };
    event.enrich_process_identity(incident_labs::ProcIdentity {
        parent_pid: 9000,
        namespace_pid: 1,
    });

    assert_eq!(
        event.payload,
        EventPayload::NamespaceExec {
            host_pid: 9001,
            namespace_pid: Some(1),
            cgroup_id: 77,
            parent_pid: Some(9000),
            filename: "/bin/sleep".into(),
        }
    );
}

#[test]
fn retransmit_event_decodes_the_flow() {
    let event = RetransmitEvent {
        header: EventHeader::new(1, 42, 42, 0, EventType::TcpRetransmit, b"fixture"),
        count: 1,
        source_port_be: 40_000_u16.to_be(),
        destination_port_be: 18_080_u16.to_be(),
        family: libc::AF_INET as u16,
        reserved: 0,
        source_address: [127, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        destination_address: [127, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };

    let decoded = decode_wire(bytemuck::bytes_of(&event)).unwrap();
    assert_eq!(
        decoded.payload,
        EventPayload::TcpRetransmit {
            count: 1,
            source_address: "127.0.0.1".into(),
            source_port: 40_000,
            destination_address: "127.0.0.1".into(),
            destination_port: 18_080,
        }
    );
}

#[test]
fn human_output_is_derived_from_typed_fields() {
    let event = EventRecord {
        timestamp_ns: 9,
        pid: 42,
        tgid: 42,
        uid: 1000,
        comm: "fixture".into(),
        event_type: "file_open",
        payload: EventPayload::FileOpen {
            return_code: -2,
            latency_us: 17,
            flags: 0,
            path: "/missing.conf".into(),
        },
    };

    let rendered = render_event(&event, false).unwrap();
    assert!(rendered.contains("return_code=-2"));
    assert!(rendered.contains("latency_us=17"));
    assert!(rendered.contains("path=/missing.conf"));
}

fn retransmit_record(source_port: u16, destination_port: u16, count: u64) -> EventRecord {
    EventRecord {
        timestamp_ns: 100,
        pid: 42,
        tgid: 42,
        uid: 0,
        comm: "fixture".into(),
        event_type: "tcp_retransmit",
        payload: EventPayload::TcpRetransmit {
            count,
            source_address: "127.0.0.1".into(),
            source_port,
            destination_address: "127.0.0.1".into(),
            destination_port,
        },
    }
}

#[test]
fn retransmit_aggregator_counts_each_flow_independently() {
    let mut aggregator = RetransmitAggregator::default();
    aggregator.observe(&retransmit_record(40_000, 18_080, 1));
    aggregator.observe(&retransmit_record(40_000, 18_080, 2));
    aggregator.observe(&retransmit_record(40_001, 18_080, 1));

    let summaries = aggregator.summaries();
    assert_eq!(summaries.len(), 2);
    assert_eq!(summaries[0].event_type, "tcp_retransmit_summary");
    assert_eq!(
        summaries[0].payload,
        EventPayload::TcpRetransmitSummary {
            retransmissions: 3,
            source_address: "127.0.0.1".into(),
            source_port: 40_000,
            destination_address: "127.0.0.1".into(),
            destination_port: 18_080,
        }
    );
    assert_eq!(
        summaries[1].payload,
        EventPayload::TcpRetransmitSummary {
            retransmissions: 1,
            source_address: "127.0.0.1".into(),
            source_port: 40_001,
            destination_address: "127.0.0.1".into(),
            destination_port: 18_080,
        }
    );
}

#[test]
fn retransmit_aggregator_ignores_non_retransmit_events() {
    let mut aggregator = RetransmitAggregator::default();
    aggregator.observe(&EventRecord::example(EventType::Connect, 42));
    assert!(aggregator.summaries().is_empty());
    assert!(aggregator.histogram().is_none());
}

#[test]
fn retransmit_aggregator_builds_a_flow_count_histogram() {
    let mut aggregator = RetransmitAggregator::default();
    for count in [1, 2, 4, 8] {
        aggregator.observe(&retransmit_record(40_000 + count as u16, 18_080, count));
    }
    let histogram = aggregator.histogram().unwrap();
    assert_eq!(histogram.event_type, "tcp_retransmit_histogram");
    assert_eq!(
        histogram.payload,
        EventPayload::TcpRetransmitHistogram {
            flows_with_1: 1,
            flows_with_2_to_3: 1,
            flows_with_4_to_7: 1,
            flows_with_8_or_more: 1,
        }
    );
}

#[test]
fn verifier_event_exposes_the_core_relocated_syscall_id() {
    let event = VerifierEvent {
        header: EventHeader::new(1, 42, 42, 0, EventType::VerifierDemo, b"fixture"),
        syscall_id: 1,
    };
    let decoded = decode_wire(bytemuck::bytes_of(&event)).unwrap();
    assert_eq!(
        decoded.payload,
        EventPayload::VerifierDemo {
            syscall_id: 1,
            message: "safe bounds-checked write observed".into(),
        }
    );
    let json: serde_json::Value =
        serde_json::from_str(&render_event(&decoded, true).unwrap()).unwrap();
    assert_eq!(json["syscall_id"], 1);
}
