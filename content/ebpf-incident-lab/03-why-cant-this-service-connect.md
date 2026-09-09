# Why Can’t This Service Connect?

**Episode:** 3 of 7
**Estimated runtime:** 12–15 minutes
**Audience:** Backend and DevOps engineers debugging service connectivity
**Core argument:** “Upstream connection failed” is not a network diagnosis; first establish the exact destination, duration, and syscall result.
**Lab:** [`../../labs/03-connect-failures`](../../labs/03-connect-failures)
**Tone:** Diagnostic, concrete, careful about socket semantics

---

## [00:00–01:30] The upstream that may not be upstream

**VISUAL:** Alert says “payment upstream unavailable.” Configuration expands to multiple IPs and ports. Show a connection accidentally targeting localhost and a stale port.

**NARRATION**

```text
A backend reports “failed to connect to upstream.”

That sentence feels like a network diagnosis. It is not. It does not tell us which address the process used, which port it selected, whether connect failed immediately, or whether the call waited long enough to suggest a timeout.

Before blaming DNS, a firewall, Kubernetes, the remote service, or the network team, we need the shape of the attempted connection.

This lab asks: where did a blocking connect go, how long did the syscall take, and what return code came back?

The word blocking matters. We are going to earn a useful answer by refusing to pretend this first observer handles every socket model.
```

## [01:30–03:40] Decode the request before interpreting the failure

**VISUAL:** `connect(fd, sockaddr*, len)` becomes IPv4/IPv6 address and port. Show network byte order conversion.

**NARRATION**

```text
The connect syscall receives a pointer to a sockaddr structure. The concrete layout depends on the address family. Ports are stored in network byte order. IPv4 and IPv6 addresses require different decoding.

Our entry tracepoint reads the sockaddr safely, records the destination and start timestamp, and stores that state by thread ID. The exit tracepoint joins the return code and calculates elapsed microseconds.

This is the same correlation pattern as the file lab, but the meaning changes. A return code of zero from a blocking connect means the connection completed during the call. Minus 111 on Linux is ECONNREFUSED: something actively rejected the connection or no listener existed at that destination.

An immediate refusal is a very different lead from a long timeout. Both may surface in an application as “upstream unavailable.”
```

## [03:40–06:20] A fixture should create a question with one known answer

**VISUAL:** Fixture opens an ephemeral loopback listener, connects successfully, closes it, then connects to the same now-closed port.

**ON SCREEN — TERMINAL:**

```bash
sudo ./scripts/run-lab.sh 03-connect-failures --duration 10 --json
./target/release/connect-fixture
```

**NARRATION**

```text
The fixture removes external dependencies from the demonstration. It opens an available loopback port and completes one successful connection. Then it closes the listener and retries the same destination.

That gives us two events with almost identical inputs and different outcomes. One return code is zero. The other is ECONNREFUSED. The destination address and port prove we are comparing the same endpoint.

This kind of fixture is intentionally boring. We are testing the observer, not the internet. If a public service, DNS provider, or cloud firewall sits in the loop, a failed demo can no longer tell us whether the eBPF code is wrong or the outside world changed.

Once the instrument survives a deterministic case, we can bring it to a messier incident with a known baseline.
```

## [06:20–08:50] The non-blocking objection is not a footnote

**VISUAL:** Branch from `connect`: blocking → final result; non-blocking → `EINPROGRESS` → readiness → `SO_ERROR`/socket state.

**NARRATION**

```text
Here is the limitation that defines this lab.

Many production runtimes use non-blocking sockets. For them, connect may return EINPROGRESS. That does not mean the connection failed. It means completion will be reported later through readiness, and the program must inspect socket state or SO_ERROR.

If we labeled every negative return from connect as a failed upstream, we would misclassify healthy asynchronous behavior.

So this observer deliberately teaches blocking connections. Supporting non-blocking connects is not one extra `if` statement. It changes the correlation model: syscall exit is no longer the final outcome.

Good observability tooling states the state machine it understands. Bad tooling prints a red word next to any value below zero.
```

## [08:50–11:20] Filtering removes noise—and can remove truth

**VISUAL:** Unfiltered stream of background connections shrinks to one PID. Then demonstrate wrong PID producing no output.

**NARRATION**

```text
Connection tracepoints are noisy on a working machine. The observer supports a host PID filter so we can isolate the fixture or a target service.

Run once without the filter and notice unrelated activity. Then run with the fixture’s host PID. Finally, use a deliberately wrong PID.

The empty result in the third run is useful because the test suite treats it as a negative case. But absence of events never proves absence of a networking problem by itself. The process may use a different syscall, run in a namespace whose visible PID you copied incorrectly, or complete its attempt outside the observation window.

Filtering is part of the hypothesis. Write it down with the result.
```

## [11:20–13:00] A connect event is the beginning of a protocol story

**VISUAL:** Layered timeline: DNS → TCP connect → TLS → HTTP request → response. Place the lab’s measurement bracket only around TCP connect.

**NARRATION**

```text
Many incident dashboards collapse the entire upstream interaction into one status. The kernel cannot.

That limitation is useful. It forces us to separate transport establishment from everything that follows. A successful connect can lead to a TLS certificate failure. TLS can succeed while authentication fails. The request can reach the correct service and receive a valid 503. None of those outcomes contradicts a zero return from blocking connect.

The reverse is true too. An application may retry several destinations behind one hostname. A failed first connect and successful second connect can become one slow but successful request. If we surface only the refusal, we may exaggerate the user-visible impact. If we surface only the eventual success, we may miss the degradation.

For a fuller product, correlation would connect resolution results, connection attempts, socket identity, and application spans. But the joins must tolerate retries, pools, multiplexed protocols, and asynchronous runtimes. That is why this season builds one boundary at a time instead of presenting a magical end-to-end map.

When you inspect the output, ask two questions. What decision can this event justify right now? And which layer must provide the next piece of evidence? If the destination is unexpected, inspect configuration. If connect is refused, inspect listener and policy state. If connect succeeds, move upward rather than continuing to interrogate the handshake.

Observability becomes faster when each signal has a job and investigators know when that job is finished.
```

## [13:00–15:00] Stop saying “the network” before locating the boundary

**VISUAL:** Evidence ladder: destination → syscall result → TCP state → packets → remote application. Highlight only first two as covered.

**NARRATION**

```text
The reusable technique is to establish the destination and syscall outcome before moving outward.

If the process connected successfully to the wrong port, the network may be doing exactly what it was asked to do. If loopback refused immediately, a remote firewall is not your first suspect. If a blocking call waited and timed out, packet-level evidence may be the next useful layer.

This lab does not prove that an upstream application was healthy. It does not inspect TLS, HTTP, or authentication. It does not follow asynchronous completion. It gives us a clean boundary: this thread asked to connect to this socket address, and the blocking syscall returned this result after this duration.

In a real incident, read those fields as a decision tree.

If the destination is wrong, stop debugging transport and inspect configuration or service discovery. If the destination is correct and the return is immediate ECONNREFUSED, ask whether a listener exists at that address and whether a middlebox actively rejected the attempt. If the call succeeds quickly but the application still reports an upstream failure, move upward: TLS negotiation, protocol parsing, authentication, or application response may be failing after connect.

If the call blocks for a long time, the next observation might be TCP state, retransmissions, routing, or packets. But even a long connect does not automatically prove packet loss. Queueing and scheduling can affect when a thread enters and exits the observed boundary, and policy mechanisms can discard traffic intentionally.

This is why the event includes a monotonic duration. Wall clocks can jump and machines can disagree. A monotonic interval is appropriate for elapsed time on one kernel. The timestamp still lets us align the event approximately with other sources, but cross-system correlation requires a clearly managed time model.

There is another operational tradeoff: reading socket addresses in eBPF keeps the emitted event self-contained, but it increases verifier-sensitive parsing logic. Moving every decode to userspace reduces kernel code but requires copying a bounded raw structure with an explicit family and length. Neither design is universally correct. For this teaching lab, supporting IPv4 and IPv6 directly makes the evidence legible while keeping the accepted environments testable.

The question to ask during review is not “could we collect more?” It is “does each additional field change the next incident decision enough to justify its kernel-side complexity?”

That is smaller than a root cause—and much stronger than “something network-ish happened.”

Next we investigate the most popular network suspect of all: DNS. But instead of blaming it because a request was slow before connecting, we will measure a known resolution path directly.
```

## Sources and further reading

- [Linux `connect(2)` manual](https://man7.org/linux/man-pages/man2/connect.2.html)
- [Aya: eBPF program constraints](https://aya-rs.dev/book/)
- [Frequent Stack Overflow eBPF questions](https://stackoverflow.com/questions/tagged/ebpf?tab=Frequent)
- [Linux eBPF syscall documentation](https://docs.kernel.org/userspace-api/ebpf/syscall.html)
