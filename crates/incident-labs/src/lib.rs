use bytemuck::Pod;
use incident_common::{
    decode_c_string, ConnectEvent, DnsEvent, EventHeader, EventType, FileEvent, NamespaceEvent,
    ProcessEvent, RetransmitEvent, VerifierEvent,
};
use serde::Serialize;
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Lab {
    pub number: u8,
    pub slug: &'static str,
    pub title: &'static str,
    pub programs: &'static [&'static str],
    pub trace_sources: &'static [&'static str],
}

impl Lab {
    pub fn find(value: &str) -> Option<&'static Self> {
        catalog()
            .iter()
            .find(|lab| lab.slug == value || lab.number.to_string() == value)
    }
}

const LABS: [Lab; 7] = [
    Lab {
        number: 1,
        slug: "01-exec-watch",
        title: "What Just Ran on My Server?",
        programs: &["exec_enter"],
        trace_sources: &["tracepoint/syscalls/sys_enter_execve"],
    },
    Lab {
        number: 2,
        slug: "02-file-open",
        title: "Who Touched This File—and Did It Fail?",
        programs: &["open_enter", "open_exit"],
        trace_sources: &[
            "tracepoint/syscalls/sys_enter_openat",
            "tracepoint/syscalls/sys_exit_openat",
        ],
    },
    Lab {
        number: 3,
        slug: "03-connect-failures",
        title: "Why Can’t This Service Connect?",
        programs: &["connect_enter", "connect_exit"],
        trace_sources: &[
            "tracepoint/syscalls/sys_enter_connect",
            "tracepoint/syscalls/sys_exit_connect",
        ],
    },
    Lab {
        number: 4,
        slug: "04-dns-latency",
        title: "Is DNS Actually the Slow Part?",
        programs: &["resolve_enter", "resolve_exit"],
        trace_sources: &["uprobe/resolve_backend", "uretprobe/resolve_backend"],
    },
    Lab {
        number: 5,
        slug: "05-tcp-retransmits",
        title: "Why Does the Network Keep Retrying?",
        programs: &["tcp_retransmit"],
        trace_sources: &["tracepoint/tcp/tcp_retransmit_skb"],
    },
    Lab {
        number: 6,
        slug: "06-namespace-pids",
        title: "Why Is PID 1 Not PID 1?",
        programs: &["namespace_exec"],
        trace_sources: &["tracepoint/syscalls/sys_enter_execve"],
    },
    Lab {
        number: 7,
        slug: "07-verifier-portability",
        title: "It Worked Yesterday",
        programs: &["verifier_safe", "verifier_broken"],
        trace_sources: &["tracepoint/syscalls/sys_enter_write"],
    },
];

pub const fn catalog() -> &'static [Lab; 7] {
    &LABS
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct EventRecord {
    pub timestamp_ns: u64,
    pub pid: u32,
    pub tgid: u32,
    pub uid: u32,
    pub comm: String,
    pub event_type: &'static str,
    #[serde(flatten)]
    pub payload: EventPayload,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(untagged)]
pub enum EventPayload {
    ProcessExec {
        parent_pid: Option<u32>,
        filename: String,
    },
    FileOpen {
        return_code: i32,
        latency_us: u64,
        flags: i32,
        path: String,
    },
    Connect {
        return_code: i32,
        latency_us: u64,
        destination_address: String,
        destination_port: u16,
    },
    DnsResolution {
        return_code: i32,
        latency_us: u64,
        hostname: String,
    },
    TcpRetransmit {
        count: u64,
        source_address: String,
        source_port: u16,
        destination_address: String,
        destination_port: u16,
    },
    TcpRetransmitSummary {
        retransmissions: u64,
        source_address: String,
        source_port: u16,
        destination_address: String,
        destination_port: u16,
    },
    TcpRetransmitHistogram {
        flows_with_1: u64,
        flows_with_2_to_3: u64,
        flows_with_4_to_7: u64,
        flows_with_8_or_more: u64,
    },
    NamespaceExec {
        host_pid: u32,
        namespace_pid: Option<u32>,
        cgroup_id: u64,
        parent_pid: Option<u32>,
        filename: String,
    },
    VerifierDemo {
        syscall_id: i64,
        message: String,
    },
}

impl EventRecord {
    pub fn example(event_type: EventType, pid: u32) -> Self {
        Self {
            timestamp_ns: 1_000_000,
            pid,
            tgid: pid,
            uid: 1000,
            comm: "fixture".to_owned(),
            event_type: event_type.as_str(),
            payload: match event_type {
                EventType::ProcessExec => EventPayload::ProcessExec {
                    parent_pid: None,
                    filename: String::new(),
                },
                EventType::FileOpen => EventPayload::FileOpen {
                    return_code: 0,
                    latency_us: 0,
                    flags: 0,
                    path: String::new(),
                },
                EventType::Connect => EventPayload::Connect {
                    return_code: 0,
                    latency_us: 0,
                    destination_address: String::new(),
                    destination_port: 0,
                },
                EventType::DnsResolution => EventPayload::DnsResolution {
                    return_code: 0,
                    latency_us: 0,
                    hostname: String::new(),
                },
                EventType::TcpRetransmit => EventPayload::TcpRetransmit {
                    count: 0,
                    source_address: String::new(),
                    source_port: 0,
                    destination_address: String::new(),
                    destination_port: 0,
                },
                EventType::NamespaceExec => EventPayload::NamespaceExec {
                    host_pid: pid,
                    namespace_pid: None,
                    cgroup_id: 0,
                    parent_pid: None,
                    filename: String::new(),
                },
                EventType::VerifierDemo => EventPayload::VerifierDemo {
                    syscall_id: 0,
                    message: String::new(),
                },
            },
        }
    }

    pub const fn matches_pid(&self, filter: Option<u32>) -> bool {
        match filter {
            Some(pid) => self.pid == pid,
            None => true,
        }
    }

    pub fn enrich_process_identity(&mut self, identity: ProcIdentity) {
        match &mut self.payload {
            EventPayload::ProcessExec { parent_pid, .. } => {
                *parent_pid = Some(identity.parent_pid);
            }
            EventPayload::NamespaceExec {
                parent_pid,
                namespace_pid,
                ..
            } => {
                *parent_pid = Some(identity.parent_pid);
                *namespace_pid = Some(identity.namespace_pid);
            }
            _ => {}
        }
    }
}

impl EventPayload {
    fn human_detail(&self) -> String {
        match self {
            Self::ProcessExec { parent_pid, filename } => format!(
                "parent_pid={} filename={filename}",
                optional_pid(*parent_pid)
            ),
            Self::FileOpen {
                return_code,
                latency_us,
                flags,
                path,
            } => format!(
                "return_code={return_code} latency_us={latency_us} flags=0x{flags:x} path={path}"
            ),
            Self::Connect {
                return_code,
                latency_us,
                destination_address,
                destination_port,
            } => format!(
                "return_code={return_code} latency_us={latency_us} destination={destination_address}:{destination_port}"
            ),
            Self::DnsResolution {
                return_code,
                latency_us,
                hostname,
            } => format!(
                "return_code={return_code} latency_us={latency_us} hostname={hostname}"
            ),
            Self::TcpRetransmit {
                count,
                source_address,
                source_port,
                destination_address,
                destination_port,
            } => format!(
                "count={count} flow={source_address}:{source_port} -> {destination_address}:{destination_port}"
            ),
            Self::TcpRetransmitSummary {
                retransmissions,
                source_address,
                source_port,
                destination_address,
                destination_port,
            } => format!(
                "retransmissions={retransmissions} flow={source_address}:{source_port} -> {destination_address}:{destination_port}"
            ),
            Self::TcpRetransmitHistogram {
                flows_with_1,
                flows_with_2_to_3,
                flows_with_4_to_7,
                flows_with_8_or_more,
            } => format!(
                "flow_count_buckets 1={flows_with_1} 2-3={flows_with_2_to_3} 4-7={flows_with_4_to_7} 8+={flows_with_8_or_more}"
            ),
            Self::NamespaceExec {
                host_pid,
                namespace_pid,
                cgroup_id,
                parent_pid,
                filename,
            } => format!(
                "host_pid={host_pid} namespace_pid={} cgroup_id={cgroup_id} parent_pid={} filename={filename}",
                optional_pid(*namespace_pid),
                optional_pid(*parent_pid)
            ),
            Self::VerifierDemo {
                syscall_id,
                message,
            } => format!("syscall_id={syscall_id} {message}"),
        }
    }
}

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
struct FlowKey {
    source_address: String,
    source_port: u16,
    destination_address: String,
    destination_port: u16,
}

#[derive(Clone, Debug)]
struct FlowAggregate {
    count: u64,
    timestamp_ns: u64,
    pid: u32,
    tgid: u32,
    uid: u32,
    comm: String,
}

#[derive(Default)]
pub struct RetransmitAggregator {
    flows: BTreeMap<FlowKey, FlowAggregate>,
}

impl RetransmitAggregator {
    pub fn observe(&mut self, event: &EventRecord) {
        let EventPayload::TcpRetransmit {
            count,
            source_address,
            source_port,
            destination_address,
            destination_port,
        } = &event.payload
        else {
            return;
        };
        let key = FlowKey {
            source_address: source_address.clone(),
            source_port: *source_port,
            destination_address: destination_address.clone(),
            destination_port: *destination_port,
        };
        let aggregate = self.flows.entry(key).or_insert_with(|| FlowAggregate {
            count: 0,
            timestamp_ns: event.timestamp_ns,
            pid: event.pid,
            tgid: event.tgid,
            uid: event.uid,
            comm: event.comm.clone(),
        });
        aggregate.count = aggregate.count.saturating_add(*count);
        aggregate.timestamp_ns = event.timestamp_ns;
    }

    pub fn summaries(&self) -> Vec<EventRecord> {
        self.flows
            .iter()
            .map(|(flow, aggregate)| EventRecord {
                timestamp_ns: aggregate.timestamp_ns,
                pid: aggregate.pid,
                tgid: aggregate.tgid,
                uid: aggregate.uid,
                comm: aggregate.comm.clone(),
                event_type: "tcp_retransmit_summary",
                payload: EventPayload::TcpRetransmitSummary {
                    retransmissions: aggregate.count,
                    source_address: flow.source_address.clone(),
                    source_port: flow.source_port,
                    destination_address: flow.destination_address.clone(),
                    destination_port: flow.destination_port,
                },
            })
            .collect()
    }

    pub fn histogram(&self) -> Option<EventRecord> {
        let (_, sample) = self.flows.iter().next()?;
        let mut flows_with_1 = 0;
        let mut flows_with_2_to_3 = 0;
        let mut flows_with_4_to_7 = 0;
        let mut flows_with_8_or_more = 0;
        for flow in self.flows.values() {
            match flow.count {
                1 => flows_with_1 += 1,
                2..=3 => flows_with_2_to_3 += 1,
                4..=7 => flows_with_4_to_7 += 1,
                _ => flows_with_8_or_more += 1,
            }
        }
        Some(EventRecord {
            timestamp_ns: sample.timestamp_ns,
            pid: sample.pid,
            tgid: sample.tgid,
            uid: sample.uid,
            comm: sample.comm.clone(),
            event_type: "tcp_retransmit_histogram",
            payload: EventPayload::TcpRetransmitHistogram {
                flows_with_1,
                flows_with_2_to_3,
                flows_with_4_to_7,
                flows_with_8_or_more,
            },
        })
    }
}

fn optional_pid(value: Option<u32>) -> String {
    value.map_or_else(|| "unknown".to_owned(), |pid| pid.to_string())
}

pub fn render_event(event: &EventRecord, json: bool) -> Result<String, serde_json::Error> {
    if json {
        serde_json::to_string(event)
    } else {
        Ok(format!(
            "{:<16} {:>7} {:>7} {:>7} {:<16} {}",
            event.event_type,
            event.pid,
            event.tgid,
            event.uid,
            event.comm,
            event.payload.human_detail()
        ))
    }
}

#[derive(Debug, Error)]
pub enum DecodeError {
    #[error("record is shorter than the {0}-byte event header")]
    MissingHeader(usize),
    #[error("unknown event type {0}")]
    UnknownEventType(u16),
    #[error("invalid {kind} record: expected {expected} bytes, received {actual}")]
    InvalidSize {
        kind: &'static str,
        expected: usize,
        actual: usize,
    },
}

pub fn decode_wire(bytes: &[u8]) -> Result<EventRecord, DecodeError> {
    let header = pod::<EventHeader>(bytes, "event header")?;
    match header.event_type {
        value if value == EventType::ProcessExec as u16 => {
            let event = pod::<ProcessEvent>(bytes, "process")?;
            Ok(record(
                &event.header,
                EventType::ProcessExec,
                EventPayload::ProcessExec {
                    parent_pid: (event.parent_pid != 0).then_some(event.parent_pid),
                    filename: event.filename.as_str().to_owned(),
                },
            ))
        }
        value if value == EventType::NamespaceExec as u16 => {
            let event = pod::<NamespaceEvent>(bytes, "namespace")?;
            Ok(record(
                &event.header,
                EventType::NamespaceExec,
                EventPayload::NamespaceExec {
                    host_pid: event.header.pid,
                    namespace_pid: (event.namespace_pid != 0).then_some(event.namespace_pid),
                    cgroup_id: event.cgroup_id,
                    parent_pid: (event.parent_pid != 0).then_some(event.parent_pid),
                    filename: event.filename.as_str().to_owned(),
                },
            ))
        }
        value if value == EventType::FileOpen as u16 => {
            let event = pod::<FileEvent>(bytes, "file")?;
            Ok(record(
                &event.header,
                EventType::FileOpen,
                EventPayload::FileOpen {
                    return_code: event.ret,
                    latency_us: event.header.timestamp_ns.saturating_sub(event.start_ns) / 1_000,
                    flags: event.flags,
                    path: event.path.as_str().to_owned(),
                },
            ))
        }
        value if value == EventType::Connect as u16 => {
            let event = pod::<ConnectEvent>(bytes, "connect")?;
            Ok(record(
                &event.header,
                EventType::Connect,
                EventPayload::Connect {
                    return_code: event.ret,
                    latency_us: event.duration_ns / 1_000,
                    destination_address: format_address(event.family, &event.address),
                    destination_port: u16::from_be(event.port_be),
                },
            ))
        }
        value if value == EventType::DnsResolution as u16 => {
            let event = pod::<DnsEvent>(bytes, "dns")?;
            Ok(record(
                &event.header,
                EventType::DnsResolution,
                EventPayload::DnsResolution {
                    return_code: event.ret,
                    latency_us: event.duration_ns / 1_000,
                    hostname: decode_c_string(&event.hostname).to_owned(),
                },
            ))
        }
        value if value == EventType::TcpRetransmit as u16 => {
            let event = pod::<RetransmitEvent>(bytes, "retransmit")?;
            Ok(record(
                &event.header,
                EventType::TcpRetransmit,
                EventPayload::TcpRetransmit {
                    count: event.count,
                    source_address: format_address(event.family, &event.source_address),
                    source_port: u16::from_be(event.source_port_be),
                    destination_address: format_address(event.family, &event.destination_address),
                    destination_port: u16::from_be(event.destination_port_be),
                },
            ))
        }
        value if value == EventType::VerifierDemo as u16 => {
            let event = pod::<VerifierEvent>(bytes, "verifier")?;
            Ok(record(
                &event.header,
                EventType::VerifierDemo,
                EventPayload::VerifierDemo {
                    syscall_id: event.syscall_id,
                    message: "safe bounds-checked write observed".to_owned(),
                },
            ))
        }
        value => Err(DecodeError::UnknownEventType(value)),
    }
}

fn pod<'a, T: Pod>(bytes: &'a [u8], kind: &'static str) -> Result<&'a T, DecodeError> {
    if bytes.len() < core::mem::size_of::<T>() {
        if kind == "event header" {
            return Err(DecodeError::MissingHeader(core::mem::size_of::<T>()));
        }
        return Err(DecodeError::InvalidSize {
            kind,
            expected: core::mem::size_of::<T>(),
            actual: bytes.len(),
        });
    }
    bytemuck::try_from_bytes(&bytes[..core::mem::size_of::<T>()]).map_err(|_| {
        DecodeError::InvalidSize {
            kind,
            expected: core::mem::size_of::<T>(),
            actual: bytes.len(),
        }
    })
}

fn record(header: &EventHeader, event_type: EventType, payload: EventPayload) -> EventRecord {
    EventRecord {
        timestamp_ns: header.timestamp_ns,
        pid: header.pid,
        tgid: header.tgid,
        uid: header.uid,
        comm: decode_c_string(&header.comm).to_owned(),
        event_type: event_type.as_str(),
        payload,
    }
}

fn format_address(family: u16, address: &[u8; 16]) -> String {
    match family as i32 {
        libc::AF_INET => {
            std::net::Ipv4Addr::new(address[0], address[1], address[2], address[3]).to_string()
        }
        libc::AF_INET6 => std::net::Ipv6Addr::from(*address).to_string(),
        _ => "unknown".to_owned(),
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProcIdentity {
    pub parent_pid: u32,
    pub namespace_pid: u32,
}

#[derive(Debug, Error)]
pub enum ProcStatusError {
    #[error("/proc status did not contain a valid {0} field")]
    Missing(&'static str),
}

pub fn parse_proc_status(status: &str) -> Result<ProcIdentity, ProcStatusError> {
    let mut host_pid = None;
    let mut parent_pid = None;
    let mut namespace_pid = None;

    for line in status.lines() {
        if let Some(value) = line.strip_prefix("Pid:") {
            host_pid = value.split_whitespace().next().and_then(|v| v.parse().ok());
        } else if let Some(value) = line.strip_prefix("PPid:") {
            parent_pid = value.split_whitespace().next().and_then(|v| v.parse().ok());
        } else if let Some(value) = line.strip_prefix("NSpid:") {
            namespace_pid = value.split_whitespace().last().and_then(|v| v.parse().ok());
        }
    }

    let host_pid = host_pid.ok_or(ProcStatusError::Missing("Pid"))?;
    Ok(ProcIdentity {
        parent_pid: parent_pid.ok_or(ProcStatusError::Missing("PPid"))?,
        namespace_pid: namespace_pid.unwrap_or(host_pid),
    })
}
