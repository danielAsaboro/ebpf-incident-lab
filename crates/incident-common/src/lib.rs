#![no_std]

use bytemuck::{Pod, Zeroable};
#[cfg(feature = "user")]
use serde::Serialize;

pub const TASK_COMM_LEN: usize = 16;
pub const PATH_LEN: usize = 128;
pub const HOST_LEN: usize = 128;

#[repr(u16)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "user", derive(Serialize))]
pub enum EventType {
    ProcessExec = 1,
    FileOpen = 2,
    Connect = 3,
    DnsResolution = 4,
    TcpRetransmit = 5,
    NamespaceExec = 6,
    VerifierDemo = 7,
}

impl EventType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ProcessExec => "process_exec",
            Self::FileOpen => "file_open",
            Self::Connect => "connect",
            Self::DnsResolution => "dns_resolution",
            Self::TcpRetransmit => "tcp_retransmit",
            Self::NamespaceExec => "namespace_exec",
            Self::VerifierDemo => "verifier_demo",
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
#[cfg_attr(feature = "user", derive(Serialize))]
pub struct EventHeader {
    pub timestamp_ns: u64,
    pub pid: u32,
    pub tgid: u32,
    pub uid: u32,
    pub event_type: u16,
    pub reserved: u16,
    pub comm: [u8; TASK_COMM_LEN],
}

impl EventHeader {
    pub fn new(
        timestamp_ns: u64,
        pid: u32,
        tgid: u32,
        uid: u32,
        event_type: EventType,
        comm: &[u8],
    ) -> Self {
        let mut command = [0; TASK_COMM_LEN];
        let count = comm.len().min(TASK_COMM_LEN - 1);
        command[..count].copy_from_slice(&comm[..count]);
        Self {
            timestamp_ns,
            pid,
            tgid,
            uid,
            event_type: event_type as u16,
            reserved: 0,
            comm: command,
        }
    }
}

pub fn decode_c_string(bytes: &[u8]) -> &str {
    let end = bytes
        .iter()
        .position(|byte| *byte == 0)
        .unwrap_or(bytes.len());
    core::str::from_utf8(&bytes[..end]).unwrap_or("<invalid-utf8>")
}

#[repr(transparent)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct PathBytes(pub [u8; PATH_LEN]);

impl Default for PathBytes {
    fn default() -> Self {
        Self([0; PATH_LEN])
    }
}

impl PathBytes {
    pub fn as_str(&self) -> &str {
        decode_c_string(&self.0)
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct ProcessEvent {
    pub header: EventHeader,
    pub parent_pid: u32,
    pub reserved: u32,
    pub filename: PathBytes,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct FileEvent {
    pub header: EventHeader,
    pub start_ns: u64,
    pub flags: i32,
    pub ret: i32,
    pub path: PathBytes,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct ConnectEvent {
    pub header: EventHeader,
    pub start_ns: u64,
    pub duration_ns: u64,
    pub ret: i32,
    pub family: u16,
    pub port_be: u16,
    pub address: [u8; 16],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct DnsEvent {
    pub header: EventHeader,
    pub duration_ns: u64,
    pub ret: i32,
    pub reserved: u32,
    pub hostname: [u8; HOST_LEN],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct RetransmitEvent {
    pub header: EventHeader,
    pub count: u64,
    pub source_port_be: u16,
    pub destination_port_be: u16,
    pub family: u16,
    pub reserved: u16,
    pub source_address: [u8; 16],
    pub destination_address: [u8; 16],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct NamespaceEvent {
    pub header: EventHeader,
    pub cgroup_id: u64,
    pub namespace_pid: u32,
    pub parent_pid: u32,
    pub filename: PathBytes,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct VerifierEvent {
    pub header: EventHeader,
    pub syscall_id: i64,
}
