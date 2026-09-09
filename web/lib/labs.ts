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
    predictionPrompt: "", explanationPrompt: "", transferPrompt: "", transferOptions: [], limits: [],
  },
  {
    id: "04", slug: "dns-latency", title: "Is DNS Actually the Slow Part?", shortTitle: "DNS latency",
    symptom: "A request is slow and DNS is suspected without a measured resolver boundary.", hook: "resolve_backend uprobe", hosted: false, duration: "local lab",
    predictionPrompt: "", explanationPrompt: "", transferPrompt: "", transferOptions: [], limits: [],
  },
  {
    id: "05", slug: "tcp-retransmits", title: "Why Does the Network Keep Retrying?", shortTitle: "TCP retransmits",
    symptom: "Latency coincides with packet loss, but averages hide the affected flows.", hook: "tcp/tcp_retransmit_skb", hosted: false, duration: "local lab",
    predictionPrompt: "", explanationPrompt: "", transferPrompt: "", transferOptions: [], limits: [],
  },
  {
    id: "06", slug: "namespace-pids", title: "Why Is PID 1 Not PID 1?", shortTitle: "Namespace identity",
    symptom: "Container and host process identifiers appear to contradict each other.", hook: "sys_enter_execve + /proc enrichment", hosted: false, duration: "local lab",
    predictionPrompt: "", explanationPrompt: "", transferPrompt: "", transferOptions: [], limits: [],
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
