# Is DNS Actually the Slow Part?

**Episode:** 4 of 7
**Estimated runtime:** 13–15 minutes
**Audience:** Engineers investigating request latency and name resolution
**Core argument:** DNS should be measured at a defined resolution boundary, not convicted because latency happened before a connection.
**Lab:** [`../../labs/04-dns-latency`](../../labs/04-dns-latency)
**Tone:** Curious, evidence-led, resistant to fashionable blame

---

## [00:00–01:50] DNS is where vague latency goes to hide

**VISUAL:** Request timeline with an unlabeled 500 ms gap before connect. Several engineers point at “DNS.”

**NARRATION**

```text
A request stalls before it reaches an upstream. Somebody says, “It’s probably DNS.”

Sometimes they are right. Production stories include random resolver timeouts during traffic spikes, overloaded DNS components, network policies that block the resolver actually used by a pod, and packet loss that becomes visible only when resolution retries.

But “before connect” is not the same as “inside DNS.” Time can disappear in a queue, a runtime scheduler, service discovery code, a proxy, an NSS module, or application logic that runs before the socket exists.

DNS becomes the default suspect because it sits early, touches several systems, and often lacks an application trace span.

Our question is deliberately smaller: how much time does one known resolver wrapper spend between function entry and return?
```

## [01:50–04:00] Sometimes the right boundary is in userspace

**VISUAL:** Kernel tracepoint icon fades; executable symbol table appears with `resolve_backend`. Uprobe attaches at entry and uretprobe at return.

**NARRATION**

```text
The first three labs attached to kernel tracepoints. This one does not.

eBPF can also attach to userspace functions using uprobes and uretprobes. A uprobe fires when execution reaches a chosen address in an executable or shared library. A return probe observes the function returning.

Our fixture exports a function named resolve_backend. Aya resolves that symbol in the fixture binary, attaches at entry and return, and uses a per-thread map to remember the start timestamp and hostname.

Why trace a wrapper instead of a kernel socket? Because the question is about time spent in a particular application-level resolution path. Moving the probe closer to the semantic question can make the answer more legible.

It also makes the scope narrower. We are measuring this symbol in this binary, not every possible way software can resolve a name.
```

## [04:00–06:50] Artificial delay is a feature when it is labeled honestly

**VISUAL:** Build fixture, export its absolute path, start observer. Run zero-delay and 500 ms cases side by side.

**ON SCREEN — TERMINAL:**

```bash
./scripts/build.sh
export INCIDENT_DNS_FIXTURE="$PWD/target/release/dns-fixture"
sudo --preserve-env=INCIDENT_DNS_FIXTURE \
  ./scripts/run-lab.sh 04-dns-latency --duration 10 --json
```

```bash
./target/release/dns-fixture localhost 0
./target/release/dns-fixture localhost 500
```

**NARRATION**

```text
The fixture accepts a deliberate delay. First we resolve localhost with no added wait. Then we add 500 milliseconds inside the wrapper.

The emitted event should report roughly half a second for the delayed call. Not exactly 500, because it includes the wrapper’s real work and measurement overhead.

We are not pretending this delay is organic DNS behavior. It is a deterministic fault used to validate the instrument. That distinction matters. A staged delay can prove the observer measures its declared boundary; it cannot prove a Kubernetes DNS outage has the same cause.

While building the lab, we also found a platform-specific trap: on Docker Desktop, a uprobe could see the symbol but failed to attach when the executable lived on a macOS-shared mount. Copying the binary onto a native Linux filesystem fixed the attachment. “Symbol exists” and “kernel can probe this inode correctly” were not the same claim.
```

## [06:50–09:50] One duration contains several possible causes

**VISUAL:** Expand the wrapper duration into cache, NSS, libc, network request, DNS server, response, and artificial delay. Keep them all inside one measured bracket.

**NARRATION**

```text
Suppose the event says 500,123 microseconds. What have we learned?

We have learned that the observed thread spent that duration between entry and return of resolve_backend. We know the hostname captured by the fixture and the wrapper’s return code.

We have not separated time in libc from time in NSS. We have not distinguished a local cache miss from a packet timeout. We have not measured CoreDNS CPU saturation or proved a network policy dropped UDP. All of those can live inside—or outside—the wrapper depending on the implementation.

This is why latency attribution should proceed by nested boundaries. First establish that the time is inside the resolution path. Then, if necessary, add narrower probes around resolver functions, socket activity, or packets.

Do not begin with the most invasive instrumentation merely because it produces the most fields. Begin with the boundary that can eliminate the largest wrong branch of the investigation.
```

## [09:50–12:10] Real incidents motivate the hypothesis; they do not validate the lab

**VISUAL:** Briefly show anonymized summaries of community DNS incidents: overloaded resolver, lost response, firewall/network policy. Stamp each “possible cause, not our cause.”

**NARRATION**

```text
Community incident reports are valuable because they reveal how the symptom feels in practice: healthy pods, clean logs, random timeouts, and hours spent staring at configuration. One Kubernetes operator described finding a gap after a socket opened to DNS, then using packet capture to see a response disappear. Another traced failures to a resolver resource limit under load.

Those reports justify asking the question. They do not validate our code and they do not make DNS the cause of our future incident.

Our authority comes from a different place: we control the fixture, we know where the delay is inserted, the probe measures the exported boundary, and the result changes predictably across zero, 100, and 500 milliseconds.

That is the difference between research inspiration and copied certainty.
```

## [12:10–13:40] Resolution is not one implementation

**VISUAL:** Four applications take different routes: libc/NSS, language runtime cache, sidecar proxy, custom asynchronous resolver. Only one crosses `resolve_backend`.

**NARRATION**

```text
There is no universal userspace function called DNS.

A C program may call getaddrinfo and pass through NSS. A language runtime may maintain its own cache or asynchronous resolver. A service mesh may intercept traffic after resolution. An application may avoid names entirely because service discovery already supplied an address.

That is why uprobes demand deployment knowledge. Attaching successfully to resolve_backend proves the probe is on that symbol. It does not prove every request uses the symbol. A binary update, feature flag, or alternate code path may bypass it.

Before relying on this technique during an incident, validate coverage with a known request. Trigger the exact application path, confirm an event arrives, and compare the hostname and return behavior with what the application reports. If the event is absent, investigate coverage before concluding resolution is fast.

You can also combine boundaries. A long wrapper duration with no outbound DNS packet might point toward local NSS behavior, a cache lock, or scheduling. Outbound packets with a delayed response move attention toward the network or resolver. A fast resolution followed by a slow connect clears DNS from that part of the timeline.

The point is not to deploy every probe at once. It is to make each additional probe discriminate between remaining hypotheses.
```

## [13:40–15:00] Measure the suspect before explaining the crime

**VISUAL:** Recap: hypothesis → semantic function → entry/return correlation → measured duration → narrower follow-up.

**NARRATION**

```text
For the exercise, run delays of 10, 100, and 500 milliseconds. Compare the emitted latency with the requested delay. Explain what accounts for the remainder and why one sample is not a performance distribution.

The reusable technique is to attach at a userspace function that represents the question your team is actually asking. Correlate entry and return per thread. Prove the observer against controlled timings. Then name every subsystem still compressed inside the measured duration.

There are practical consequences to choosing a uprobe. Symbols can be stripped. Compilers can inline functions. Different releases can move or rename the target. Shared libraries can be loaded at runtime, and a process may execute a different binary than the path your runbook assumes.

That means “missing userspace symbol” is a tested failure case in this product. The launcher should fail clearly rather than start an observer that can never attach. Before production use, identify the exact executable, verify the symbol, record the build identity, and decide whether the symbol is part of an interface you control.

There is also a sampling question. One slow call is an incident clue, not a latency model. To compare normal and degraded behavior, capture enough calls to understand the distribution and segment them by hostname, process, version, and workload. At that point, map aggregation or userspace streaming decisions begin to matter. High-cardinality hostnames can create unbounded operational cost even when each individual event is cheap.

And be careful with the hostname itself. It may be sensitive data. A production observer needs a collection policy, access control, retention, and perhaps allow-listing or hashing. eBPF’s ability to observe an argument does not automatically grant an organization a good reason to store it.

The lab stays intentionally small: one fixture, one exported wrapper, one bounded hostname, one duration. That smallness is what lets us say exactly what succeeded and what failed.

DNS may be slow. Or DNS may be the story we tell when we have not yet measured the gap.

In the next episode, we move below resolution and connection setup into TCP’s retransmission path. There, too, an event can prove that a mechanism fired without proving why it fired.
```

## Sources and further reading

- [Kubernetes incident discussion involving DNS timeouts and packet loss](https://www.reddit.com/r/kubernetes/comments/1jp0maf/whats_your_craziest_incident_with_kubernetes/)
- [Kubernetes discussion: intermittent DNS and network-policy behavior](https://www.reddit.com/r/kubernetes/comments/1tam7qm/how_common_are_network_problems_in_a_real/)
- [Aya guide](https://aya-rs.dev/book/)
