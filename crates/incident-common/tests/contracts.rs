use incident_common::{
    decode_c_string, ConnectEvent, DnsEvent, EventHeader, EventType, FileEvent, NamespaceEvent,
    PathBytes, ProcessEvent, RetransmitEvent, VerifierEvent, TASK_COMM_LEN,
};

#[test]
fn event_header_exposes_stable_identity_fields() {
    let header = EventHeader::new(123, 45, 44, 1000, EventType::ProcessExec, b"worker");

    assert_eq!(header.timestamp_ns, 123);
    assert_eq!(header.pid, 45);
    assert_eq!(header.tgid, 44);
    assert_eq!(header.uid, 1000);
    assert_eq!(header.event_type, EventType::ProcessExec as u16);
    assert_eq!(decode_c_string(&header.comm), "worker");
}

#[test]
fn command_name_is_truncated_and_nul_terminated() {
    let header = EventHeader::new(
        0,
        1,
        1,
        0,
        EventType::FileOpen,
        b"a-command-name-that-is-too-long",
    );

    assert_eq!(header.comm.len(), TASK_COMM_LEN);
    assert_eq!(header.comm[TASK_COMM_LEN - 1], 0);
    assert_eq!(decode_c_string(&header.comm), "a-command-name-");
}

#[test]
fn event_type_has_a_human_readable_name() {
    assert_eq!(EventType::TcpRetransmit.as_str(), "tcp_retransmit");
    assert_eq!(EventType::VerifierDemo.as_str(), "verifier_demo");
}

#[test]
fn wire_events_are_plain_old_data_with_stable_sizes() {
    fn assert_pod<T: bytemuck::Pod>() {}

    assert_pod::<EventHeader>();
    assert_pod::<ProcessEvent>();
    assert_pod::<FileEvent>();
    assert_pod::<ConnectEvent>();
    assert_pod::<DnsEvent>();
    assert_pod::<RetransmitEvent>();
    assert_pod::<NamespaceEvent>();
    assert_pod::<VerifierEvent>();
    assert_eq!(core::mem::size_of::<EventHeader>(), 40);
    assert_eq!(PathBytes::default().as_str(), "");
}
