export type Lab = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  symptom: string;
  hook: string;
  hosted: boolean;
  duration: string;
  predictionPrompt: string;
  explanationPrompt: string;
  transferPrompt: string;
  transferOptions: { label: string; correct: boolean }[];
  limits: string[];
};

export const labs: Lab[] = [
  {
    id: "01", slug: "exec-watch", title: "What Just Ran on My Server?", shortTitle: "Process execution",
    symptom: "A short-lived process changes the system, then disappears before snapshot-based monitoring sees it.",
    hook: "syscalls/sys_enter_execve", hosted: true, duration: "3 seconds",
    predictionPrompt: "Before tracing, what event and identity fields would distinguish a new process execution from a process that was merely already running?",
    explanationPrompt: "Using the observed event, explain what happened and name one conclusion the event cannot support by itself.",
    transferPrompt: "The process changes its command name immediately after exec. Which evidence remains the safest correlation key?",
    transferOptions: [
      { label: "The original command string alone", correct: false },
      { label: "The host PID/TGID with the event timestamp", correct: true },
      { label: "A later top(1) snapshot", correct: false },
    ],
    limits: ["The event proves an exec attempt crossed the kernel hook.", "It does not prove the process stayed healthy or caused the wider incident."],
  },
  {
    id: "02", slug: "file-open", title: "Who Touched This File—and Did It Fail?", shortTitle: "File access",
    symptom: "A service repeatedly looks for configuration, but ordinary logs omit the pathname or return code.",
    hook: "sys_enter_openat + sys_exit_openat", hosted: true, duration: "3 seconds",
    predictionPrompt: "Which fields must be correlated to distinguish an attempted open from a successful file descriptor return?",
    explanationPrompt: "Identify the pathname and return evidence, then state why the event alone cannot establish application intent.",
    transferPrompt: "A relative path is opened with a non-default dirfd. What additional context is required to reconstruct the full path?",
    transferOptions: [
      { label: "Only the process command name", correct: false },
      { label: "The dirfd target and process filesystem context", correct: true },
      { label: "The kernel version alone", correct: false },
    ],
    limits: ["Entry and exit correlation can show a pathname and its syscall result.", "It does not prove why the application chose that path."],
  },
  {
    id: "03", slug: "connect-failures", title: "Why Can’t This Service Connect?", shortTitle: "Connect failures",
    symptom: "A client cannot connect, but the failure disappears inside generic application telemetry.", hook: "sys_enter_connect + sys_exit_connect", hosted: false, duration: "local lab",
    predictionPrompt: "Which destination, identity, return code and timing fields would distinguish a refused blocking connection from a successful one?", explanationPrompt: "Compare the successful and failed attempts. Explain why an EINPROGRESS return would require a different completion signal.", transferPrompt: "A non-blocking socket returns EINPROGRESS. What can you conclude?", transferOptions: [{ label: "The connection definitively failed", correct: false }, { label: "Completion is pending; correlate readiness or socket state", correct: true }, { label: "The destination is healthy", correct: false }], limits: ["A correlated blocking connect return establishes a result for that attempt.", "EINPROGRESS does not establish final success or failure."],
  },
  {
    id: "04", slug: "dns-latency", title: "Is DNS Actually the Slow Part?", shortTitle: "DNS latency",
    symptom: "A request is slow and DNS is suspected without a measured resolver boundary.", hook: "resolve_backend uprobe", hosted: false, duration: "local lab",
    predictionPrompt: "Which entry and return timestamps would bound time in resolve_backend, and what does the deliberate fixture delay change?", explanationPrompt: "Use the measured wrapper duration and explain which internal sources of delay remain unresolved.", transferPrompt: "The wrapper takes 500 ms. Does that prove the DNS server took 500 ms?", transferOptions: [{ label: "Yes, wrapper time equals DNS-server time", correct: false }, { label: "No; wrapper duration includes fixture delay and other resolver work", correct: true }, { label: "It proves all requests are slow", correct: false }], limits: ["The probes measure time spent inside this resolver wrapper.", "They do not isolate cache, NSS, network or DNS-server time."],
  },
  {
    id: "05", slug: "tcp-retransmits", title: "Why Does the Network Keep Retrying?", shortTitle: "TCP retransmits",
    symptom: "Latency coincides with packet loss, but averages hide the affected flows.", hook: "tcp/tcp_retransmit_skb", hosted: false, duration: "local lab",
    predictionPrompt: "Which flow identity and event counts would let you compare retransmissions during and outside the controlled loss window?", explanationPrompt: "Identify the affected flow and counts, then distinguish observed retransmissions from a claim about their cause.", transferPrompt: "The retransmit tracepoint fires. Which explanation is supported by that event alone?", transferOptions: [{ label: "The network dropped a packet", correct: false }, { label: "The kernel entered its retransmission path for this flow", correct: true }, { label: "The receiver is overloaded", correct: false }], limits: ["The tracepoint establishes a retransmission event for the recorded flow.", "It does not identify loss, reordering, receiver delay or congestion as the cause."],
  },
  {
    id: "06", slug: "namespace-pids", title: "Why Is PID 1 Not PID 1?", shortTitle: "Namespace identity",
    symptom: "Container and host process identifiers appear to contradict each other.", hook: "sys_enter_execve + /proc enrichment", hosted: false, duration: "local lab",
    predictionPrompt: "How will you correlate host PID, namespace-visible PID and cgroup ID without treating them as interchangeable?", explanationPrompt: "Describe the host and namespace identities you observed and what can be lost if the process exits before /proc enrichment.", transferPrompt: "The namespace reports PID 1. Which PID belongs in the observer filter?", transferOptions: [{ label: "Always 1", correct: false }, { label: "The process's host PID", correct: true }, { label: "The cgroup ID", correct: false }], limits: ["Host events and successful /proc enrichment can correlate PID views.", "Fast exit can prevent enrichment; a cgroup ID is not a container name."],
  },
  {
    id: "07", slug: "verifier-portability", title: "Reading Verifier Errors and Surviving Kernel Drift", shortTitle: "Verifier boundaries",
    symptom: "A program that looks correct fails before attachment at the kernel verifier boundary.",
    hook: "syscalls/sys_enter_write + CO-RE", hosted: true, duration: "3 seconds",
    predictionPrompt: "What evidence distinguishes a verifier rejection from a program that attached successfully but saw no events?",
    explanationPrompt: "Explain what the successful observation establishes and why CO-RE still cannot guarantee universal kernel compatibility.",
    transferPrompt: "The same object loads on one kernel and fails on another. What is the strongest next step?",
    transferOptions: [
      { label: "Claim the older kernel is unsupported without recording it", correct: false },
      { label: "Capture both verifier logs and add the pair to a compatibility matrix", correct: true },
      { label: "Assume BTF presence guarantees identical verifier behavior", correct: false },
    ],
    limits: ["A successful event proves this object loaded and attached on this kernel.", "It does not prove the object is portable to every BTF-enabled kernel."],
  },
];

export function getLab(id: string) { return labs.find((lab) => lab.id === id || lab.slug === id); }
