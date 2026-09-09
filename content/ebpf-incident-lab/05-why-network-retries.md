# Why Does the Network Keep Retrying?

**Episode:** 5 of 7
**Estimated runtime:** 13–15 minutes
**Audience:** Engineers investigating TCP behavior and tail latency
**Core argument:** A TCP retransmission is evidence that TCP retried a segment, not a verdict that packet loss—or “the network”—caused the incident.
**Lab:** [`../../labs/05-tcp-retransmits`](../../labs/05-tcp-retransmits)
**Tone:** Operational, safety-conscious, deliberately anti-blame

---

## [00:00–01:40] Everything works, except the slow requests

**VISUAL:** Success-rate dashboard stays green while p99 rises. Application spans show no single slow function.

**NARRATION**

```text
The service is up. Most requests succeed. Median latency looks normal.

But the tail is getting worse. A small group of requests take much longer, and application profiling does not reveal a matching burst of work.

At this point, somebody usually says packet loss. Somebody else says congestion. A third person says the cloud network is flaky. All three have jumped from a symptom to a cause.

TCP already contains a recovery mechanism for data that does not appear to arrive as expected: retransmission. If we observe the kernel entering that path during the slow window, we gain an important fact.

But even that fact is narrower than it sounds. A retransmission does not carry a little note saying why it happened.
```

## [01:40–03:50] Observe the recovery mechanism, not a theory about it

**VISUAL:** TCP segment leaves sender; acknowledgement does not arrive by the expected time; kernel fires `tcp_retransmit_skb`. Then show alternative triggers: loss, reordering, delayed ACK, receiver behavior.

**NARRATION**

```text
Linux exposes a tcp_retransmit_skb tracepoint when the TCP stack enters its retransmission path for a socket buffer.

Our eBPF program attaches there and emits the source and destination tuple. The userspace runner aggregates raw events by flow and produces a final count plus a small histogram: flows with one retransmission, two to three, four to seven, and eight or more.

The raw event answers “did this happen?” The summary answers “where did it cluster?” Those are operationally useful questions.

Neither answers “was a packet dropped on the wire?” TCP can retransmit after genuine loss, but also under reordering, delayed acknowledgements, receiver stalls, or timing behavior elsewhere in the path. The tracepoint observes the sender’s recovery decision.

Mechanism first. Cause later.
```

## [03:50–06:40] Fault injection is powerful enough to demand ownership

**VISUAL:** Disposable VM warning. Show `tc netem` attached to loopback, an ownership token, cleanup trap, and refusal when an unexpected qdisc already exists.

**NARRATION**

```text
To produce a deterministic retry, this fixture temporarily applies 100 percent loss to the disposable VM’s loopback interface. A client starts a request, TCP retries during the short loss window, then the fixture removes the fault and lets the request complete.

This is the most dangerous lab in the season—not because eBPF changes the network, but because our fixture does.

Early test code used cleanup that could delete whatever root qdisc happened to exist. That is unacceptable. A cleanup handler should remove only state it knows it created. The corrected fixture first verifies loopback has the expected baseline. It refuses to replace an unfamiliar qdisc. It records ownership only after netem succeeds, and its exit trap removes only that owned change.

We also test interruption. Killing the fixture must restore loopback before the test passes. Cleanup is not an appendix to fault injection. Cleanup is part of the product.
```

## [06:40–09:00] Watch the retry and the recovery

**VISUAL:** Terminal 1 runs observer; Terminal 2 runs fixture. Highlight raw events, per-flow summary, histogram, successful final request, and `tc qdisc show dev lo` after exit.

**ON SCREEN — TERMINAL:**

```bash
sudo ./scripts/run-lab.sh 05-tcp-retransmits --duration 15 --json
sudo ./scripts/run-retransmit-fixture.sh
```

**NARRATION**

```text
Run this only in the disposable Ubuntu VM.

During the loss window, raw tcp_retransmit events identify the loopback flow. When the observer’s bounded duration ends, it emits a deterministic per-flow summary and the histogram. The client still completes after the qdisc is removed.

Then verify the fixture left the interface unchanged.
```

**ON SCREEN — TERMINAL:**

```bash
tc qdisc show dev lo
```

**NARRATION**

```text
This demonstration gives us a known causal chain because we inserted the fault ourselves. In production, seeing the same tracepoint is not proof of the same cause. The fixture validates the observer and teaches the signal. It is not a miniature copy of every real network incident.
```

## [09:00–11:40] Aggregation changes the question

**VISUAL:** Thousands of raw events collapse into flow table and histogram. Keep one raw event linked to its aggregate.

**NARRATION**

```text
Why preserve both raw events and aggregates?

Raw events retain sequence and exact tuples. They help correlate a retry with another timestamped incident signal. But a stream of individual events becomes difficult to reason about under load.

Per-flow summaries reveal concentration. Is one destination responsible for most retries, or are small counts spread across many flows? The histogram gives a quick shape without pretending to be a full latency distribution.

Aggregation can also erase meaning. A total retransmission count without flow identity could combine unrelated services. A flow count without observation duration is hard to compare. A histogram without raw examples can conceal decoding mistakes.

The design keeps these representations together because each catches weaknesses in the other.
```

## [11:40–13:20] Compare rates only when the denominator makes sense

**VISUAL:** Contrast misleading totals—100 retries on one million segments versus 10 retries on 20 segments. Add observation duration and traffic volume beneath each.

**NARRATION**

```text
A retransmission count without a denominator can mislead.

One hundred retransmits on a host serving enormous traffic may be less concerning than ten retransmits on a nearly idle critical connection. Our lab reports counts because the controlled workload and window are known. A production dashboard should pair them with traffic volume, connection counts, observation duration, and service-level latency.

The direction matters as well. This tracepoint describes retransmission by the local TCP stack. It does not directly report retries performed by a remote peer. To understand both directions, you may need observation at both endpoints or packet evidence at a shared boundary.

Then there is timing. A retransmission near a slow request is correlation. To make a stronger case, align monotonic event timing with socket or request identity and look for repeated correspondence. Even then, the retransmission may be one contributor rather than the complete duration.

This is why a histogram is a navigation aid, not an SLO. It tells an investigator whether retries cluster into a few painful flows or spread broadly. It does not normalize by bytes, round trips, or application importance.

The next version of this observer should be designed from the operational question. If the team needs host health, rates and network interfaces may matter. If it needs request attribution, socket-to-cgroup and application correlation become more valuable. Starting with the event type and collecting everything around it reverses the product-design process.
```

## [13:20–15:00] Build a chain of evidence, not a blame machine

**VISUAL:** Chain: application latency → retransmission event → flow concentration → interface counters/packet capture/receiver evidence.

**NARRATION**

```text
For the exercise, repeat the same request without netem and compare counts over the same observation duration. If no retransmission appears, do not conclude the network is perfect. Conclude that this tracepoint did not fire for the observed flow during this controlled run.

The reusable technique is to trace a kernel recovery mechanism, group it by the identity that matters, and then use a second source to investigate cause. Interface counters, packet capture, receiver metrics, congestion state, and application timing may all become relevant next.

Flow identity deserves scrutiny too. The familiar source-address, source-port, destination-address, destination-port tuple is useful, but connections are short-lived and ports are reused. A tuple observed at one time is not a permanent application identity. Network namespaces, NAT, proxies, and load balancers can also make the tuple at one boundary differ from the tuple another team sees.

In this lab, the tracepoint can run in softirq context, so process identity fields may appear as PID zero and comm swapper. That is not a decoding failure. Packet processing is not always executing in the context of the application thread that originally wrote data. This is exactly why we aggregate by flow rather than pretending the current task always identifies the owner.

A production attribution system may correlate sockets, cgroups, and process lifecycle state. That is a larger product. It introduces eviction, race, and namespace questions that should be tested explicitly.

Cardinality is the other pressure. A busy host can have many flows and many retransmits. A map or userspace aggregator has finite memory. You need bounded capacity, deterministic eviction or rollup behavior, and a count of events or flows you could not retain. Without drop accounting, a quiet histogram may reflect good networking—or an overwhelmed observer.

Our lab’s bounded duration and controlled fixture keep the aggregation honest. The next step is not to deploy it everywhere unchanged. The next step is to decide what workload scale, retention window, and attribution accuracy a production version must support, then attack those assumptions with tests.

eBPF is most useful here as a bridge. It connects an application symptom to a kernel action that conventional logs may never mention.

It should not become an automated blame machine. “TCP retransmitted” is an observation. “The network dropped packets” is a hypothesis. “The network team broke production” is a meeting you have not earned.

Next we enter containers, where even the identifier printed beside an event can mean different things depending on where you stand.
```

## Sources and further reading

- [Linux tracepoint documentation](https://docs.kernel.org/trace/tracepoints.html)
- [Kubernetes incident account using system-call and packet evidence](https://www.reddit.com/r/kubernetes/comments/1jp0maf/whats_your_craziest_incident_with_kubernetes/)
- [DevOps discussion on incident-debugging context](https://www.reddit.com/r/devops/comments/1szysrm/what_improved_your_incident_debugging_speed_the/)
