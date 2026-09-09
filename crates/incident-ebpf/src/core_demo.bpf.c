#define SEC(name) __attribute__((section(name), used))
#define BPF_MAP_TYPE_RINGBUF 27
#define BPF_FUNC_ktime_get_ns 5
#define BPF_FUNC_get_current_pid_tgid 14
#define BPF_FUNC_get_current_uid_gid 15
#define BPF_FUNC_get_current_comm 16
#define BPF_FUNC_probe_read_kernel 113
#define BPF_FUNC_ringbuf_reserve 131
#define BPF_FUNC_ringbuf_submit 132

typedef unsigned char __u8;
typedef unsigned short __u16;
typedef unsigned int __u32;
typedef unsigned long long __u64;
typedef long long __s64;

struct trace_entry {
    __u16 type;
    __u8 flags;
    __u8 preempt_count;
    int pid;
} __attribute__((preserve_access_index));

struct trace_event_raw_sys_enter {
    struct trace_entry ent;
    __s64 id;
    __u64 args[6];
    char data[0];
} __attribute__((preserve_access_index));

struct event_header {
    __u64 timestamp_ns;
    __u32 pid;
    __u32 tgid;
    __u32 uid;
    __u16 event_type;
    __u16 reserved;
    char comm[16];
};

struct verifier_event {
    struct event_header header;
    __s64 syscall_id;
};

struct {
    int (*type)[BPF_MAP_TYPE_RINGBUF];
    int (*max_entries)[256 * 1024];
} EVENTS SEC(".maps");

static __u64 (*bpf_ktime_get_ns)(void) = (void *)BPF_FUNC_ktime_get_ns;
static __u64 (*bpf_get_current_pid_tgid)(void) = (void *)BPF_FUNC_get_current_pid_tgid;
static __u64 (*bpf_get_current_uid_gid)(void) = (void *)BPF_FUNC_get_current_uid_gid;
static long (*bpf_get_current_comm)(void *, __u32) = (void *)BPF_FUNC_get_current_comm;
static long (*bpf_probe_read_kernel)(void *, __u32, const void *) = (void *)BPF_FUNC_probe_read_kernel;
static void *(*bpf_ringbuf_reserve)(void *, __u64, __u64) = (void *)BPF_FUNC_ringbuf_reserve;
static void (*bpf_ringbuf_submit)(void *, __u64) = (void *)BPF_FUNC_ringbuf_submit;

SEC("tracepoint/syscalls/sys_enter_write")
int core_verifier_safe(struct trace_event_raw_sys_enter *ctx) {
    struct verifier_event *event = bpf_ringbuf_reserve(&EVENTS, sizeof(*event), 0);
    if (!event)
        return 0;

    __u64 pid_tgid = bpf_get_current_pid_tgid();
    event->header.timestamp_ns = bpf_ktime_get_ns();
    event->header.pid = (__u32)pid_tgid;
    event->header.tgid = (__u32)(pid_tgid >> 32);
    event->header.uid = (__u32)bpf_get_current_uid_gid();
    event->header.event_type = 7;
    event->header.reserved = 0;
    bpf_get_current_comm(event->header.comm, sizeof(event->header.comm));
    bpf_probe_read_kernel(
        &event->syscall_id,
        sizeof(event->syscall_id),
        __builtin_preserve_access_index(&ctx->id)
    );
    bpf_ringbuf_submit(event, 0);
    return 0;
}

char LICENSE[] SEC("license") = "Dual MIT/GPL";
