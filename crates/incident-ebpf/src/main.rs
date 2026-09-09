#![no_std]
#![no_main]

use aya_ebpf::{
    helpers::{
        bpf_get_current_cgroup_id, bpf_get_current_comm, bpf_get_current_pid_tgid,
        bpf_get_current_uid_gid, bpf_ktime_get_ns, bpf_probe_read_user,
        bpf_probe_read_user_str_bytes,
    },
    macros::{map, tracepoint, uprobe, uretprobe},
    maps::{HashMap, RingBuf},
    programs::{ProbeContext, RetProbeContext, TracePointContext},
};
use incident_common::{
    ConnectEvent, DnsEvent, EventHeader, EventType, FileEvent, NamespaceEvent, PathBytes,
    ProcessEvent, RetransmitEvent, VerifierEvent, HOST_LEN,
};

#[repr(C)]
#[derive(Clone, Copy)]
struct OpenState {
    start_ns: u64,
    flags: i32,
    reserved: u32,
    path: PathBytes,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct ConnectState {
    start_ns: u64,
    family: u16,
    port_be: u16,
    address: [u8; 16],
}

#[repr(C)]
#[derive(Clone, Copy)]
struct DnsState {
    start_ns: u64,
    hostname: [u8; HOST_LEN],
}

#[repr(C)]
#[derive(Clone, Copy)]
struct SockAddr4 {
    family: u16,
    port_be: u16,
    address: [u8; 4],
    zero: [u8; 8],
}

#[repr(C)]
#[derive(Clone, Copy)]
struct SockAddr6 {
    family: u16,
    port_be: u16,
    flowinfo: u32,
    address: [u8; 16],
    scope_id: u32,
}

#[map]
static EVENTS: RingBuf = RingBuf::with_byte_size(256 * 1024, 0);

#[map]
static OPEN_STATE: HashMap<u64, OpenState> = HashMap::with_max_entries(16_384, 0);

#[map]
static CONNECT_STATE: HashMap<u64, ConnectState> = HashMap::with_max_entries(16_384, 0);

#[map]
static DNS_STATE: HashMap<u64, DnsState> = HashMap::with_max_entries(16_384, 0);

#[map]
static VERIFIER_VALUES: HashMap<u32, u64> = HashMap::with_max_entries(1, 0);

fn header(event_type: EventType) -> EventHeader {
    let id = bpf_get_current_pid_tgid();
    EventHeader {
        timestamp_ns: unsafe { bpf_ktime_get_ns() },
        pid: id as u32,
        tgid: (id >> 32) as u32,
        uid: bpf_get_current_uid_gid() as u32,
        event_type: event_type as u16,
        reserved: 0,
        comm: bpf_get_current_comm().unwrap_or([0; 16]),
    }
}

#[tracepoint]
pub fn exec_enter(ctx: TracePointContext) -> u32 {
    try_exec_enter(&ctx, EventType::ProcessExec).unwrap_or(0)
}

fn try_exec_enter(ctx: &TracePointContext, kind: EventType) -> Result<u32, i32> {
    let filename_ptr: usize = unsafe { ctx.read_at(16)? };
    let mut event = ProcessEvent {
        header: header(kind),
        parent_pid: 0,
        reserved: 0,
        filename: PathBytes::default(),
    };
    unsafe {
        let _ = bpf_probe_read_user_str_bytes(filename_ptr as *const u8, &mut event.filename.0);
    }
    let _ = EVENTS.output::<ProcessEvent>(&event, 0);
    Ok(0)
}

#[tracepoint]
pub fn namespace_exec(ctx: TracePointContext) -> u32 {
    try_namespace_exec(&ctx).unwrap_or(0)
}

fn try_namespace_exec(ctx: &TracePointContext) -> Result<u32, i32> {
    let filename_ptr: usize = unsafe { ctx.read_at(16)? };
    let mut event = NamespaceEvent {
        header: header(EventType::NamespaceExec),
        cgroup_id: unsafe { bpf_get_current_cgroup_id() },
        namespace_pid: 0,
        parent_pid: 0,
        filename: PathBytes::default(),
    };
    unsafe {
        let _ = bpf_probe_read_user_str_bytes(filename_ptr as *const u8, &mut event.filename.0);
    }
    let _ = EVENTS.output::<NamespaceEvent>(&event, 0);
    Ok(0)
}

#[tracepoint]
pub fn open_enter(ctx: TracePointContext) -> u32 {
    try_open_enter(&ctx).unwrap_or(0)
}

fn try_open_enter(ctx: &TracePointContext) -> Result<u32, i32> {
    let key = bpf_get_current_pid_tgid();
    let filename_ptr: usize = unsafe { ctx.read_at(24)? };
    let flags: i32 = unsafe { ctx.read_at(32)? };
    let mut state = OpenState {
        start_ns: unsafe { bpf_ktime_get_ns() },
        flags,
        reserved: 0,
        path: PathBytes::default(),
    };
    unsafe {
        let _ = bpf_probe_read_user_str_bytes(filename_ptr as *const u8, &mut state.path.0);
    }
    OPEN_STATE.insert(key, state, 0)?;
    Ok(0)
}

#[tracepoint]
pub fn open_exit(ctx: TracePointContext) -> u32 {
    try_open_exit(&ctx).unwrap_or(0)
}

fn try_open_exit(ctx: &TracePointContext) -> Result<u32, i32> {
    let key = bpf_get_current_pid_tgid();
    let state = unsafe { OPEN_STATE.get(key).ok_or(1)? };
    let ret: i64 = unsafe { ctx.read_at(16)? };
    let event = FileEvent {
        header: header(EventType::FileOpen),
        start_ns: state.start_ns,
        flags: state.flags,
        ret: ret as i32,
        path: state.path,
    };
    let _ = EVENTS.output::<FileEvent>(&event, 0);
    let _ = OPEN_STATE.remove(key);
    Ok(0)
}

#[tracepoint]
pub fn connect_enter(ctx: TracePointContext) -> u32 {
    try_connect_enter(&ctx).unwrap_or(0)
}

fn try_connect_enter(ctx: &TracePointContext) -> Result<u32, i32> {
    let key = bpf_get_current_pid_tgid();
    let address_ptr: usize = unsafe { ctx.read_at(24)? };
    let family = unsafe { bpf_probe_read_user(address_ptr as *const u16)? };
    let mut state = ConnectState {
        start_ns: unsafe { bpf_ktime_get_ns() },
        family,
        port_be: 0,
        address: [0; 16],
    };
    if family == 2 {
        let address = unsafe { bpf_probe_read_user(address_ptr as *const SockAddr4)? };
        state.port_be = address.port_be;
        state.address[..4].copy_from_slice(&address.address);
    } else if family == 10 {
        let address = unsafe { bpf_probe_read_user(address_ptr as *const SockAddr6)? };
        state.port_be = address.port_be;
        state.address = address.address;
    }
    CONNECT_STATE.insert(key, state, 0)?;
    Ok(0)
}

#[tracepoint]
pub fn connect_exit(ctx: TracePointContext) -> u32 {
    try_connect_exit(&ctx).unwrap_or(0)
}

fn try_connect_exit(ctx: &TracePointContext) -> Result<u32, i32> {
    let key = bpf_get_current_pid_tgid();
    let state = unsafe { CONNECT_STATE.get(key).ok_or(1)? };
    let ret: i64 = unsafe { ctx.read_at(16)? };
    let now = unsafe { bpf_ktime_get_ns() };
    let event = ConnectEvent {
        header: header(EventType::Connect),
        start_ns: state.start_ns,
        duration_ns: now.saturating_sub(state.start_ns),
        ret: ret as i32,
        family: state.family,
        port_be: state.port_be,
        address: state.address,
    };
    let _ = EVENTS.output::<ConnectEvent>(&event, 0);
    let _ = CONNECT_STATE.remove(key);
    Ok(0)
}

#[uprobe]
pub fn resolve_enter(ctx: ProbeContext) -> u32 {
    try_resolve_enter(&ctx).unwrap_or(0)
}

fn try_resolve_enter(ctx: &ProbeContext) -> Result<u32, i32> {
    let hostname_ptr = ctx.arg::<usize>(0).ok_or(1)?;
    let mut state = DnsState {
        start_ns: unsafe { bpf_ktime_get_ns() },
        hostname: [0; HOST_LEN],
    };
    unsafe {
        let _ = bpf_probe_read_user_str_bytes(hostname_ptr as *const u8, &mut state.hostname);
    }
    DNS_STATE.insert(bpf_get_current_pid_tgid(), state, 0)?;
    Ok(0)
}

#[uretprobe]
pub fn resolve_exit(ctx: RetProbeContext) -> u32 {
    try_resolve_exit(&ctx).unwrap_or(0)
}

fn try_resolve_exit(ctx: &RetProbeContext) -> Result<u32, i32> {
    let key = bpf_get_current_pid_tgid();
    let state = unsafe { DNS_STATE.get(key).ok_or(1)? };
    let now = unsafe { bpf_ktime_get_ns() };
    let event = DnsEvent {
        header: header(EventType::DnsResolution),
        duration_ns: now.saturating_sub(state.start_ns),
        ret: ctx.ret::<i32>(),
        reserved: 0,
        hostname: state.hostname,
    };
    let _ = EVENTS.output::<DnsEvent>(&event, 0);
    let _ = DNS_STATE.remove(key);
    Ok(0)
}

#[tracepoint]
pub fn tcp_retransmit(ctx: TracePointContext) -> u32 {
    try_tcp_retransmit(&ctx).unwrap_or(0)
}

fn try_tcp_retransmit(ctx: &TracePointContext) -> Result<u32, i32> {
    // Offsets correspond to trace_event_raw_tcp_retransmit_skb and are checked against
    // /sys/kernel/tracing/events/tcp/tcp_retransmit_skb/format in each accepted kernel.
    let source_port: u16 = unsafe { ctx.read_at(28)? };
    let destination_port: u16 = unsafe { ctx.read_at(30)? };
    let family: u16 = unsafe { ctx.read_at(32)? };
    let mut source_address = [0_u8; 16];
    let mut destination_address = [0_u8; 16];

    if family == 2 {
        let source: [u8; 4] = unsafe { ctx.read_at(34)? };
        let destination: [u8; 4] = unsafe { ctx.read_at(38)? };
        source_address[0] = source[0];
        source_address[1] = source[1];
        source_address[2] = source[2];
        source_address[3] = source[3];
        destination_address[0] = destination[0];
        destination_address[1] = destination[1];
        destination_address[2] = destination[2];
        destination_address[3] = destination[3];
    } else if family == 10 {
        source_address = unsafe { ctx.read_at(42)? };
        destination_address = unsafe { ctx.read_at(58)? };
    }

    let event = RetransmitEvent {
        header: header(EventType::TcpRetransmit),
        count: 1,
        source_port_be: source_port.to_be(),
        destination_port_be: destination_port.to_be(),
        family,
        reserved: 0,
        source_address,
        destination_address,
    };
    let _ = EVENTS.output::<RetransmitEvent>(&event, 0);
    Ok(0)
}

#[tracepoint]
pub fn verifier_safe(_ctx: TracePointContext) -> u32 {
    let event = VerifierEvent {
        header: header(EventType::VerifierDemo),
        syscall_id: 0,
    };
    let _ = EVENTS.output::<VerifierEvent>(&event, 0);
    0
}

#[tracepoint]
pub fn verifier_broken(_ctx: TracePointContext) -> u32 {
    // Deliberately wrong: a map lookup can return NULL. Removing the Option check makes the
    // verifier reject the dereference even though Rust's type checker permits this unsafe code.
    let pointer = unsafe { VERIFIER_VALUES.get_ptr(&0).unwrap_unchecked() };
    unsafe { core::ptr::read_volatile(pointer) as u32 }
}

#[cfg(not(test))]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[link_section = "license"]
#[no_mangle]
static LICENSE: [u8; 13] = *b"Dual MIT/GPL\0";
