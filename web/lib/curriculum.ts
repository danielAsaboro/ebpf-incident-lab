export type Curriculum = {
  readiness: { question: string; options: string[]; answer: number; remediation: string };
  hypotheses: string[]; hints: string[]; concepts: { title: string; description: string }[];
  transfer: string; recall: string;
};
export const rubric = [
  { dimension: "Claim", criterion: "States a bounded conclusion supported by the selected evidence; separates observation from inference." },
  { dimension: "Evidence", criterion: "Cites specific sequence numbers and explains which hypothesis each supports or weakens." },
  { dimension: "Mechanism", criterion: "Explains the relevant hook, identity or correlation and why it produces this observation." },
  { dimension: "Uncertainty", criterion: "Names a plausible alternative and an important fact the evidence cannot establish." },
  { dimension: "Next experiment", criterion: "Proposes a discriminating measurement, its expected outcomes and how each would change the conclusion." },
] as const;
export const curricula: Record<string, Curriculum> = {
  "01": {
    readiness: { question: "An exec entry event appears, but a later process snapshot is empty. What is established?", options: ["An exec attempt reached the hook", "The new executable completed successfully", "The event must be wrong"], answer: 0, remediation: "Entry occurs before the syscall result. A short-lived process may disappear before a snapshot; neither source proves completion." },
    hypotheses: ["A short-lived exec attempt occurred between snapshots", "The exec attempt failed before replacing the image", "The relevant process existed before collection and made no exec attempt"],
    hints: ["Compare the hook boundary with the time of the snapshot. Which hypotheses can entry alone separate?", "Use event timestamp and host PID/TGID; comm can change. An entry does not contain the syscall outcome.", "An exec entry weakens 'no attempt in the window', but does not separate successful replacement from failed exec. Propose exit/result or lifecycle evidence."],
    concepts: [{ title: "Entry boundary", description: "sys_enter_execve records an attempt before a result exists; observation is narrower than successful execution." }, { title: "Temporal identity", description: "Correlate host PID/TGID with timestamp. Names change and PIDs can be reused across time." }, { title: "Sampling versus events", description: "A snapshot reports what exists at sampling time; an event can capture work between snapshots." }],
    transfer: "A job launches a helper, renames it, and exits before the dashboard refresh. Design an observation that distinguishes failed exec from successful launch followed by fast exit. Specify correlation keys, predicted evidence and remaining uncertainty.",
    recall: "Without opening your notes, explain why an exec entry plus a missing later process is not proof of a successful short-lived executable. Name the missing measurement.",
  },
  "02": {
    readiness: { question: "A correlated openat return is -2. Did this attempt return a usable file descriptor?", options: ["Yes, every entry opens a file", "No, the negative return is an error", "Only the pathname can tell"], answer: 1, remediation: "Entry records arguments; exit establishes this syscall's result. Nonnegative values are descriptors; negative values encode an error." },
    hypotheses: ["The requested path opened successfully", "The open attempt failed because the path was absent", "The path exists but this attempt was denied access"],
    hints: ["Look for both the requested path and the return. Are they from the same attempt?", "Correlate by thread, not just process name. A nonnegative return differs from a negative errno.", "Pair this thread's entry and exit, read the return, and keep path-resolution context separate from the application's intent."],
    concepts: [{ title: "Thread correlation", description: "Concurrent threads can call openat independently. Entry arguments must be paired with the correct thread's return." }, { title: "Return semantics", description: "A nonnegative return is a descriptor, including zero. Negative values encode errors: -2 is ENOENT and -13 is EACCES. Neither result explains why the application selected the path." }, { title: "Path context", description: "A relative pathname is interpreted using dirfd or the current directory and the process filesystem view." }],
    transfer: "Two threads open the same relative filename under different directory descriptors; one succeeds. Explain how you would identify the failing attempt and reconstruct its target without guessing intent.",
    recall: "From memory, name the fields needed to pair an open attempt with its outcome and explain why a pathname alone cannot establish success.",
  },
  "03": {
    readiness: { question: "A nonblocking connect returns EINPROGRESS. What does that establish?", options: ["Final failure", "Final success", "Connection completion is pending"], answer: 2, remediation: "EINPROGRESS describes asynchronous initiation. Final outcome needs later socket readiness/state and error evidence." },
    hypotheses: ["The blocking connection reached an available listener", "The blocking connection was refused after the listener closed", "The nonblocking attempt is pending and needs later completion evidence"],
    hints: ["Compare the available-listener interval with the closed-listener interval.", "Bind destination and return to the same thread and attempt. Check whether the socket is blocking before interpreting errno.", "For blocking attempts, compare zero with refusal; for EINPROGRESS propose readiness plus SO_ERROR or socket-state evidence rather than declaring failure."],
    concepts: [{ title: "Attempt identity", description: "Destination address/port, host identity and timing connect an entry to the right return." }, { title: "Blocking outcome", description: "A blocking connect's return reports the result for that attempt, not general service health." }, { title: "Asynchronous completion", description: "EINPROGRESS requires later completion evidence; initiation and establishment are distinct boundaries." }],
    transfer: "A connection pool uses nonblocking sockets and retries across two destinations. Logs show EINPROGRESS and one timeout. Design evidence that identifies which attempt eventually succeeded or failed.",
    recall: "Explain the difference between a refused blocking connect and EINPROGRESS, and name a measurement that resolves the latter.",
  },
  "04": {
    readiness: { question: "The fixture adds a 500 ms sleep inside the measured resolver wrapper. Does 500 ms wrapper duration prove server latency?", options: ["Yes", "No, the wrapper includes intentional delay and other work", "Only on loopback"], answer: 1, remediation: "A probe interval measures its chosen function boundary. Fixture sleep, caches, NSS and network work may all fall inside it." },
    hypotheses: ["The deliberate fixture sleep accounts for the measured increase", "Resolver or network work contributes additional delay", "Entry and return correlation measured different calls"],
    hints: ["Start with the zero-delay baseline. What changes when only the fixture delay changes?", "Subtract comparable baseline durations cautiously; wrapper time still does not isolate DNS-server time.", "Check paired entry/return identity, then compare 0/100/500 ms runs. Add internal resolver or network boundaries to distinguish remaining causes."],
    concepts: [{ title: "Function boundary", description: "Uprobe and uretprobe timestamps measure time inside resolve_backend, not a remote server in isolation." }, { title: "Controlled intervention", description: "An intentional fixture delay is known experimental input and must be reported as such." }, { title: "Attribution", description: "A long wrapper interval leaves cache, NSS, scheduler and network contributions unresolved without additional measurements." }],
    transfer: "A cached lookup and an uncached lookup both take 400 ms inside a wrapper that sometimes sleeps. Propose a controlled experiment and narrower probes to distinguish artificial delay from network work.",
    recall: "Draw the resolver measurement boundary in words and name two delays that could be inside it without being DNS-server time.",
  },
  "05": {
    readiness: { question: "tcp_retransmit_skb fires once. What is directly established?", options: ["The network dropped a packet", "The receiver is overloaded", "The kernel entered a retransmission path"], answer: 2, remediation: "Retransmission is observed behavior. Loss, reordering, receiver delay and congestion are candidate causes, not facts encoded by this event alone." },
    hypotheses: ["Controlled loss coincides with increased retransmits on the fixture flow", "Retransmissions also occur without the controlled loss window", "Aggregate counts include an unrelated flow"],
    hints: ["Compare equal-duration windows with and without the fixture; retain flow identity.", "Inspect endpoints before combining counts. The tracepoint cannot label the cause of each retransmission.", "Use per-flow counts and timing to test association with the intervention, then propose packet or receiver evidence to distinguish causal alternatives."],
    concepts: [{ title: "Flow identity", description: "Address and port pairs distinguish affected traffic from unrelated flows in aggregate counts." }, { title: "Event semantics", description: "A retransmit tracepoint records the kernel's path, not a direct packet-loss measurement." }, { title: "Controlled comparison", description: "Equal-duration baseline and loss windows support a bounded comparison; qdisc cleanup is part of the experiment." }],
    transfer: "Retransmits rise during a deployment even though no loss injection is active. Design a per-flow comparison that distinguishes reordering, receiver delay and actual loss without assigning cause from counts alone.",
    recall: "State exactly what a retransmission event proves and give two distinct explanations it cannot choose between.",
  },
  "06": {
    readiness: { question: "A process is PID 1 inside its namespace and PID 842 on the host. Which observer --pid value targets it?", options: ["1", "842", "Its cgroup ID"], answer: 1, remediation: "The observer filter uses host PID. Namespace PID and cgroup ID represent different identity domains." },
    hypotheses: ["The different PIDs describe one process in two namespace views", "The records describe unrelated processes", "The process exited before /proc enrichment could recover namespace identity"],
    hints: ["Separate host event fields from userspace /proc enrichment.", "Find NSpid while the process is alive and correlate it with host PID and timestamp.", "Successful enrichment can link the views; absent enrichment can be a fast-exit race. A cgroup ID does not supply a container name."],
    concepts: [{ title: "PID domains", description: "The same process may have different host and namespace-visible PIDs; filters must use the observer's domain." }, { title: "Enrichment race", description: "Reading /proc after an event can fail if the process exits first; missing enrichment is not proof of a missing event." }, { title: "Cgroup identity", description: "A numeric cgroup ID helps correlate context but is not a human-readable container identity." }],
    transfer: "Two containers each report PID 1; one exits before inspection. Explain how to correlate host events, what can still be concluded for the exited process, and which identity uncertainty remains.",
    recall: "Explain why two PID 1 records need not identify one process, and why /proc enrichment can be missing despite a valid event.",
  },
  "07": {
    readiness: { question: "A verifier rejects an object before attachment. Is zero event output evidence that the workload did not execute?", options: ["Yes", "No, the observer never attached", "Yes if BTF is present"], answer: 1, remediation: "Load, attach and observe are separate stages. A rejected object cannot provide evidence about workload absence." },
    hypotheses: ["The object failed verifier checks before attachment", "The object attached but the selected workload produced no matching events", "The object loaded and attached and observed the intended workload"],
    hints: ["Locate load and attach diagnostics before interpreting an empty event stream.", "Record object identity and kernel context. BTF availability alone does not establish compatibility.", "A real observation supports successful load and attach here; rejection requires its full verifier log. Compare both kernels with the same object and workload."],
    concepts: [{ title: "Verifier boundary", description: "The verifier evaluates program safety before attachment. A load failure differs from an attached observer receiving no events." }, { title: "CO-RE scope", description: "CO-RE relocates supported type/layout references using BTF; it does not equal universal helper or verifier compatibility." }, { title: "Compatibility evidence", description: "Record kernel, object, logs, attachment and workload result for each tested environment rather than extrapolating from one success." }],
    transfer: "The same object yields events on kernel A but an empty stream on kernel B. Design the minimum diagnostic sequence to separate rejection, attachment failure, filter mismatch and absent workload.",
    recall: "Name the three boundaries between an object file and a real event, and explain why BTF does not prove all three succeed on another kernel.",
  },
};
