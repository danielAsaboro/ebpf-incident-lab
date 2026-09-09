use anyhow::{Context, Result};
use incident_cli::CommonArgs;
use incident_labs::Lab;

pub fn run(lab_number: u8, args: CommonArgs) -> Result<()> {
    let lab = Lab::find(&lab_number.to_string()).context("unknown lab number")?;
    #[cfg(target_os = "linux")]
    {
        linux::run(lab, args)
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (lab, args);
        anyhow::bail!("the eBPF labs run on Linux; use the documented Ubuntu 24.04 VM")
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use std::{
        num::NonZeroU32,
        path::PathBuf,
        thread,
        time::{Duration, Instant},
    };

    use anyhow::{anyhow, Context, Result};
    use aya::{
        include_bytes_aligned,
        maps::RingBuf,
        programs::{uprobe::UProbeScope, TracePoint, UProbe},
        Btf, Ebpf,
    };
    use incident_cli::CommonArgs;
    use incident_labs::{
        decode_wire, parse_proc_status, render_event, EventRecord, Lab, RetransmitAggregator,
    };

    pub fn run(lab: &Lab, args: CommonArgs) -> Result<()> {
        raise_memlock_limit();
        let use_core_demo =
            lab.number == 7 && std::env::var_os("INCIDENT_VERIFIER_BROKEN").is_none();
        if use_core_demo {
            Btf::from_sys_fs().context("Lab 7 CO-RE requires readable target-kernel BTF")?;
        }
        let object: &[u8] = if use_core_demo {
            include_bytes_aligned!(concat!(env!("OUT_DIR"), "/core-demo-ebpf"))
        } else {
            include_bytes_aligned!(concat!(env!("OUT_DIR"), "/incident-ebpf"))
        };
        let mut ebpf = Ebpf::load(object)
            .context("load embedded eBPF object; enable verifier logging for more detail")?;
        attach(lab, &args, &mut ebpf)?;
        let map = ebpf
            .take_map("EVENTS")
            .context("EVENTS ring buffer missing")?;
        let mut events = RingBuf::try_from(map)?;
        let mut retransmits = RetransmitAggregator::default();

        if !args.json {
            println!("EVENT                PID    TGID     UID COMMAND          DETAILS");
        }
        eprintln!("READY lab={} duration={}s", lab.slug, args.duration);
        let deadline = Instant::now() + Duration::from_secs(args.duration);
        while Instant::now() < deadline {
            let mut received = false;
            // A hot tracepoint can refill the ring buffer faster than userspace drains it.
            // Check the deadline for every record so --duration remains bounded under load.
            for _ in 0..1_024 {
                if Instant::now() >= deadline {
                    break;
                }
                let Some(item) = events.next() else {
                    break;
                };
                received = true;
                match decode_wire(&item) {
                    Ok(mut event) if event.matches_pid(args.pid) => {
                        enrich_from_proc(&mut event);
                        if lab.number == 5 {
                            retransmits.observe(&event);
                        }
                        println!("{}", render_event(&event, args.json)?);
                    }
                    Ok(_) => {}
                    Err(error) => eprintln!("discarded malformed ring-buffer record: {error}"),
                }
            }
            if !received {
                thread::sleep(Duration::from_millis(10));
            }
        }
        if lab.number == 5 {
            for summary in retransmits.summaries() {
                println!("{}", render_event(&summary, args.json)?);
            }
            if let Some(histogram) = retransmits.histogram() {
                println!("{}", render_event(&histogram, args.json)?);
            }
        }
        Ok(())
    }

    fn attach(lab: &Lab, args: &CommonArgs, ebpf: &mut Ebpf) -> Result<()> {
        match lab.number {
            1 => attach_tracepoint(ebpf, "exec_enter", "syscalls", "sys_enter_execve"),
            2 => {
                attach_tracepoint(ebpf, "open_enter", "syscalls", "sys_enter_openat")?;
                attach_tracepoint(ebpf, "open_exit", "syscalls", "sys_exit_openat")
            }
            3 => {
                attach_tracepoint(ebpf, "connect_enter", "syscalls", "sys_enter_connect")?;
                attach_tracepoint(ebpf, "connect_exit", "syscalls", "sys_exit_connect")
            }
            4 => attach_dns(ebpf, args),
            5 => attach_tracepoint(ebpf, "tcp_retransmit", "tcp", "tcp_retransmit_skb"),
            6 => attach_tracepoint(ebpf, "namespace_exec", "syscalls", "sys_enter_execve"),
            7 => {
                let program = if std::env::var_os("INCIDENT_VERIFIER_BROKEN").is_some() {
                    "verifier_broken"
                } else {
                    "core_verifier_safe"
                };
                attach_tracepoint(ebpf, program, "syscalls", "sys_enter_write")
            }
            _ => Err(anyhow!("unsupported lab {}", lab.number)),
        }
    }

    fn attach_tracepoint(ebpf: &mut Ebpf, name: &str, category: &str, event: &str) -> Result<()> {
        let overridden_event = std::env::var("INCIDENT_TRACEPOINT_OVERRIDE").ok();
        let event = overridden_event.as_deref().unwrap_or(event);
        let program: &mut TracePoint = ebpf
            .program_mut(name)
            .with_context(|| format!("program {name} missing"))?
            .try_into()?;
        program.load().with_context(|| format!("load {name}"))?;
        program
            .attach(category, event)
            .with_context(|| format!("attach {category}/{event}"))?;
        Ok(())
    }

    fn attach_dns(ebpf: &mut Ebpf, args: &CommonArgs) -> Result<()> {
        let target = std::env::var_os("INCIDENT_DNS_FIXTURE")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("target/release/dns-fixture"));
        let scope = args
            .pid
            .and_then(NonZeroU32::new)
            .map(UProbeScope::OneProcess)
            .unwrap_or(UProbeScope::AllProcesses);
        for name in ["resolve_enter", "resolve_exit"] {
            let program: &mut UProbe = ebpf
                .program_mut(name)
                .with_context(|| format!("program {name} missing"))?
                .try_into()?;
            program.load()?;
            program
                .attach("resolve_backend", &target, scope)
                .with_context(|| format!("attach {name} to {}", target.display()))?;
        }
        Ok(())
    }

    fn enrich_from_proc(event: &mut EventRecord) {
        let path = format!("/proc/{}/status", event.pid);
        if let Ok(status) = std::fs::read_to_string(path) {
            if let Ok(identity) = parse_proc_status(&status) {
                event.enrich_process_identity(identity);
            }
        }
    }

    fn raise_memlock_limit() {
        let limit = libc::rlimit {
            rlim_cur: libc::RLIM_INFINITY,
            rlim_max: libc::RLIM_INFINITY,
        };
        let result = unsafe { libc::setrlimit(libc::RLIMIT_MEMLOCK, &limit) };
        if result != 0 {
            eprintln!("warning: could not raise RLIMIT_MEMLOCK; modern kernels may not need it");
        }
    }
}
