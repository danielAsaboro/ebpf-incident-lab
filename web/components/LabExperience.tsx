"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { readNotebook, saveNotebook, downloadNotebook, type Phase, type RunnerEvent } from "@/lib/notebooks";
import type { Lab } from "@/lib/labs";


export function LabExperience({ lab, embedded = false, onObservations, onPhase, persist = false }: { lab: Lab; embedded?: boolean; persist?: boolean; onPhase?: (phase: Phase) => void; onObservations?: (count: number) => void }) {
  const [saved] = useState(() => persist ? readNotebook(lab.id) : undefined);
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? "predict");
  const [saveFailed, setSaveFailed] = useState(false);
  const [prediction, setPrediction] = useState(saved?.prediction ?? "");
  const [explanation, setExplanation] = useState(saved?.explanation ?? "");
  const [choice, setChoice] = useState<number | null>(saved?.choice ?? null);
  const [events, setEvents] = useState<RunnerEvent[]>(saved?.events ?? []);
  const [selectedEvent, setSelectedEvent] = useState<RunnerEvent | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(saved?.sessionId);
  const [runState, setRunState] = useState(saved ? (["running", "connecting", "queued"].includes(saved.runState) ? "interrupted" : saved.runState) : "idle");
  const [error, setError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackPending, setFeedbackPending] = useState(false);
  const runGenerationRef = useRef(0);
  const feedbackPendingRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const steps: Phase[] = ["predict", "observe", "explain", "transfer", "complete"];
  const stepIndex = steps.indexOf(phase);

  useEffect(() => () => { runGenerationRef.current += 1; sourceRef.current?.close(); requestRef.current?.abort(); }, []);
  const observationCount = useMemo(() => events.filter((event) => event.kind === "observation").length, [events]);

  useEffect(() => { onObservations?.(observationCount); }, [observationCount, onObservations]);

  useEffect(() => { onPhase?.(phase); }, [phase, onPhase]);
  useEffect(() => {
    if (!persist) return;
    const ok = saveNotebook({ labId: lab.id, source: "hosted", phase, prediction, explanation, choice, events, sessionId, runState, updatedAt: new Date().toISOString() });
    queueMicrotask(() => setSaveFailed(!ok));
  }, [persist, lab.id, phase, prediction, explanation, choice, events, sessionId, runState]);
  function downloadCase() { downloadNotebook({ labId: lab.id, source: "hosted", phase, prediction, explanation, choice, events, sessionId, runState, updatedAt: new Date().toISOString() }); }
  const hasEvidence = observationCount > 0 && runState === "completed";
  function canVisit(step: Phase) { return step === "predict" || step === "observe" && !!sessionId || step === "explain" && hasEvidence || step === "transfer" && hasEvidence && explanation.trim().length >= 30 || step === "complete" && phase === "complete"; }

  async function startRun() {
    runGenerationRef.current += 1;
    feedbackPendingRef.current = false; setFeedbackPending(false); setFeedbackError("");
    setSessionId(undefined); setChoice(null); setExplanation("");
    sourceRef.current?.close(); setSelectedEvent(null);
    requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller;
    setPhase("observe"); setRunState("connecting"); setError(""); setEvents([]);
    try {
      const response = await fetch("/api/runner/v1/sessions", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ labId: lab.id }) });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(body.message ?? "The runner did not accept the session.");
      setSessionId(body.id); setRunState(body.status);
      const source = new EventSource(`/api/runner/v1/sessions/${body.id}/events`);
      sourceRef.current = source;
      const receive = (message: MessageEvent) => {
        const event = JSON.parse(message.data) as RunnerEvent;
        setEvents((current) => current.some((item) => item.sequence === event.sequence) ? current : [...current, event]);
        if (event.kind === "terminal") { source.close(); setRunState(event.data.includes("completed") ? "completed" : "failed"); }
        else setRunState("running");
      };
      ["status", "observation", "diagnostic", "terminal"].forEach((name) => source.addEventListener(name, receive));
      source.onerror = () => { if (source.readyState === EventSource.CLOSED) setError("The evidence stream closed unexpectedly."); };
    } catch (cause) { if (controller.signal.aborted) return; setRunState("failed"); setError(cause instanceof Error ? cause.message : "The runner is unavailable."); }
  }

  function submitExplanation(event: FormEvent) { event.preventDefault(); if (explanation.trim().length >= 30) setPhase("transfer"); }
  const correct = choice !== null && lab.transferOptions[choice]?.correct;

  async function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!sessionId || feedbackPendingRef.current) return;
    const generation = runGenerationRef.current;
    const data = new FormData(event.currentTarget);
    feedbackPendingRef.current = true;
    setFeedbackPending(true);
    setFeedbackError("");
    try {
      const response = await fetch(`/api/runner/v1/sessions/${sessionId}/feedback`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ role:data.get("role"), difficulty:Number(data.get("difficulty")), rating:Number(data.get("rating")), checkpointScore:correct ? 2 : 1, comment:data.get("comment") || null, consent:data.get("consent") === "on" }) });
      if (runGenerationRef.current !== generation) return;
      if (!response.ok) {
        setFeedbackError(response.status === 429
          ? "Feedback was not saved because too many requests were sent. Wait a moment and try again, or finish without feedback."
          : "Feedback was not saved. Try again, or finish without feedback.");
        return;
      }
      setPhase("complete");
    } catch {
      if (runGenerationRef.current !== generation) return;
      setFeedbackError("We could not confirm that your feedback was saved. Check your connection and try again, or finish without feedback.");
    } finally {
      if (runGenerationRef.current === generation) {
        feedbackPendingRef.current = false;
        setFeedbackPending(false);
      }
    }
  }

  return <div className={embedded ? "experience embedded" : "experience shell"}>
    {!embedded && <aside className="lab-sidebar"><div className="eyebrow">HOSTED LAB {lab.id}</div><h1>{lab.title}</h1><p>{lab.symptom}</p><dl><div><dt>HOOK</dt><dd><code>{lab.hook}</code></dd></div><div><dt>WINDOW</dt><dd>{lab.duration}</dd></div><div><dt>RUNTIME</dt><dd>Ubuntu 24.04 · x86_64</dd></div></dl></aside>}
    <section className="workbench" aria-live="polite">
      <ol className="progress" aria-label="Lab progress">{steps.map((step, index) => <li key={step} className={index <= stepIndex ? "active" : ""}><button type="button" disabled={!canVisit(step)} onClick={() => setPhase(step)} aria-current={step === phase ? "step" : undefined}><span>{index + 1}</span>{step}</button></li>)}</ol>

      {persist && <p className="storage-note">{saveFailed ? "Storage is unavailable. Download your notes before leaving." : "Notebook saved on this device."} <Link href="/notebooks">Manage notes</Link><button type="button" onClick={downloadCase}>Download</button></p>}
      {phase === "predict" && <div className="panel"><p className="kicker">01 · PREDICT</p><h2>Choose the evidence before the tool</h2><p>{lab.predictionPrompt}</p><label htmlFor="prediction">Your prediction stays in this browser.</label><textarea id="prediction" value={prediction} onChange={(e) => setPrediction(e.target.value)} rows={5} placeholder="I would expect to see…" /><button className="button primary" disabled={prediction.trim().length < 20} onClick={startRun}>Start real observation</button><p className="privacy-note">This starts one fixed fixture. You cannot submit commands or code.</p></div>}

      {phase === "observe" && <div className="panel"><p className="kicker">02 · OBSERVE</p><div className="panel-title"><h2>Kernel evidence stream</h2><span className={`run-state ${runState}`}>{runState}</span></div>{runState === "interrupted" && <div className="error" role="status">This saved stream was interrupted. These are previously received events. Return to your prediction to start a new observation.</div>}<div className="terminal" role="log" aria-label="Real eBPF observation output"><div className="terminal-bar"><i/><i/><i/><span>incident-runner / lab-{lab.id}</span></div>{events.length === 0 ? <p className="terminal-wait">{runState === "failed" || runState === "interrupted" ? "No observations received for this run." : "Waiting for the dedicated runner…"}</p> : events.map((event) => <button type="button" aria-label={`Inspect ${event.kind} ${event.sequence}`} aria-pressed={selectedEvent?.sequence === event.sequence} onClick={() => setSelectedEvent(event)} className={`event-line ${event.kind}`} key={event.sequence}><time>{new Date(event.timestamp * 1000).toISOString().slice(11,19)}</time><span>{event.kind}</span><code>{event.data}</code></button>)}</div>{selectedEvent && <section className="selected-evidence" aria-label="Selected evidence"><span className="micro">EVIDENCE / {selectedEvent.sequence}</span><time>{new Date(selectedEvent.timestamp * 1000).toISOString()}</time><pre>{selectedEvent.data}</pre></section>}{error && <div className="error" role="alert">{error}</div>}<button className="button primary" disabled={runState !== "completed" || observationCount === 0} onClick={() => setPhase("explain")}>Interpret {observationCount} observation{observationCount === 1 ? "" : "s"}</button>{(runState === "failed" || runState === "interrupted") && <button className="button secondary" onClick={() => setPhase("predict")}>Return to prediction</button>}</div>}

      {phase === "explain" && <form className="panel" onSubmit={submitExplanation}><p className="kicker">03 · EXPLAIN + BOUND</p><h2>What did the evidence establish?</h2><p>{lab.explanationPrompt}</p><details className="lab-details"><summary>Review collected evidence</summary><pre>{events.filter(event => event.kind === "observation").map(event => event.data).join("\n")}</pre></details><div className="limits">{lab.limits.map((limit, i) => <p key={limit}><span>{i === 0 ? "PROVES" : "DOES NOT PROVE"}</span>{limit}</p>)}</div><label htmlFor="explanation">Your explanation</label><textarea id="explanation" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={5} placeholder="The event establishes… It cannot establish…" /><button className="button primary" disabled={explanation.trim().length < 30}>Continue to transfer</button></form>}

      {phase === "transfer" && <div className="panel"><p className="kicker">04 · TRANSFER</p><h2>The incident changed</h2><p>{lab.transferPrompt}</p><div className="choices">{lab.transferOptions.map((option, index) => <button key={option.label} className={choice === index ? "choice selected" : "choice"} onClick={() => setChoice(index)}><span>{String.fromCharCode(65 + index)}</span>{option.label}</button>)}</div>{choice !== null && <div className={correct ? "result correct" : "result retry"}>{correct ? "Supported. That preserves the strongest evidence boundary." : "Reconsider which field remains attributable at the kernel event boundary."}</div>}{correct && <form className="feedback" onSubmit={sendFeedback}><h3>Optional, consented feedback</h3><div className="feedback-grid"><label>Role<select name="role" defaultValue="devops"><option value="devops">DevOps engineer</option><option value="sre">SRE</option><option value="systems">Systems engineer</option><option value="platform">Platform engineer</option><option value="other">Other</option></select></label><label>Difficulty<select name="difficulty" defaultValue="3">{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label><label>Rating<select name="rating" defaultValue="4">{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label></div><label>Comment<textarea name="comment" maxLength={1000} rows={3} /></label><label className="consent"><input required type="checkbox" name="consent" /> I consent to storing this feedback without my name, employer, or terminal contents.</label><div role="status">{feedbackPending ? "Saving feedback…" : ""}</div>{feedbackError && <div className="error" role="alert">{feedbackError}</div>}<button className="button primary" disabled={feedbackPending}>Save feedback and finish</button><button className="button secondary" type="button" onClick={() => setPhase("complete")}>Finish without feedback</button></form>}</div>}

      {phase === "complete" && <div className="panel completion"><div className="completion-mark">✓</div><p className="kicker">INCIDENT COMPLETE</p><h2>You followed the evidence to its boundary.</h2><p>The result belongs to this Ubuntu runner, this program, and this observation window. Transfer begins by preserving that scope.</p><button className="button primary" onClick={downloadCase}>Download case notes ↓</button><Link className="text-link" href={Number(lab.id) < 7 ? `/labs/${String(Number(lab.id)+1).padStart(2,"0")}` : "/notebooks"}>{Number(lab.id) < 7 ? "Next investigation →" : "Review your notebooks →"}</Link></div>}
    </section>
  </div>;
}
