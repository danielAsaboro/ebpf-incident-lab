"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
const NamespaceModel = dynamic(() => import("./NamespaceModel").then(m=>m.NamespaceModel), {ssr:false});
import type { RunnerEvent } from "@/lib/notebooks";

const models: Record<string, { title: string; nodes: [string,string,string]; captions: [string,string,string]; question: string }> = {
  "01": { title: "The moment a snapshot misses", nodes: ["EXEC ATTEMPT", "OBSERVATION", "LATER SNAPSHOT"], captions: ["A thread crosses sys_enter_execve.", "The observer records identity at the hook.", "Absence later cannot tell you whether an attempt occurred."], question: "An attempt is observable. Its outcome needs another signal." },
  "02": { title: "One attempt. Two boundaries.", nodes: ["ENTRY", "THREAD CORRELATION", "RETURN"], captions: ["Capture the pathname, flags and thread identity.", "The kernel program joins entry and exit by thread ID.", "Inspect the joined record: nonnegative descriptor or negative error."], question: "The same pathname can appear in successful and failed attempts." },
  "03": { title: "Where the connection stops", nodes: ["DESTINATION", "CONNECT ATTEMPT", "RETURN + DURATION"], captions: ["Which address and port did this attempt target?", "The observation bounds one blocking connect call.", "A return of EINPROGRESS needs a later completion signal."], question: "A connection result is not a verdict on the whole service." },
  "04": { title: "A measured interval, an open question", nodes: ["WRAPPER ENTRY", "UNRESOLVED WORK", "WRAPPER RETURN"], captions: ["The uprobe records the start of resolve_backend.", "Cache, NSS, fixture delay and network work are not separately timed.", "The uretprobe closes the measured interval."], question: "Wrapper duration cannot be assigned entirely to a DNS server." },
  "05": { title: "Follow the flow, not the average", nodes: ["FLOW IDENTITY", "RETRANSMIT PATH", "COMPARE WINDOWS"], captions: ["Group observations by the recorded flow fields.", "An event means the kernel entered this retransmit path.", "Compare controlled windows; do not infer a unique cause from a count."], question: "A retransmission is an observation. Packet loss is an explanation to investigate." },
  "06": { title: "One process, more than one view", nodes: ["HOST IDENTITY", "NAMESPACE VIEW", "ENRICHMENT"], captions: ["Observer filters use the host PID.", "The same process can be PID 1 inside its namespace.", "Reading /proc is best effort: a fast exit can leave the relationship unknown."], question: "Identity depends on the observer’s view. A cgroup ID is not a container name." },
  "07": { title: "Before attachment, a proof obligation", nodes: ["PROGRAM", "VERIFIER ANALYSIS", "ACCEPT / REJECT"], captions: ["A fixed program is presented to this kernel.", "Register, pointer and control-flow safety must be established.", "Acceptance belongs to this program and environment. Other kernels may differ."], question: "A successful demo cannot explain an unfamiliar verifier rejection." },
};
export function EvidenceDiagram({ labId, events = [], selectedSequence, onSelect }: { labId: string; events?: RunnerEvent[]; selectedSequence?: number; onSelect?: (sequence: number) => void }) {
  const [boundary, setBoundary] = useState(1);
  const model = models[labId] ?? models["01"];
  const observations = events.filter(event => event.kind === "observation");
  const selected = observations.find(event => event.sequence === selectedSequence);
  let fields: Record<string, unknown> = {};
  if (selected) { try { const parsed = JSON.parse(selected.data); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) fields = parsed; } catch { /* Raw record remains available below. */ } }
  return <section className={`evidence-figure figure-${labId}`} aria-label={model.title}>
    <div className="figure-top"><span>OBSERVATION ATLAS / {labId}</span><span>{selected ? `RECORD ${selected.sequence}` : "CONCEPTUAL GUIDE"}</span></div>
    <h3>{model.title}</h3>
    {labId === "06" && <NamespaceModel/>}
    <svg viewBox="0 0 720 180" role="img" aria-label={`${model.nodes.join(" → ")}. ${model.question}`}>
      <defs><pattern id={`grid-${labId}`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".15"/></pattern></defs>
      <rect width="720" height="180" fill={`url(#grid-${labId})`}/>
      <path d="M110 90H610" stroke="currentColor" strokeWidth="1.5" opacity=".4" strokeDasharray={labId === "04" || labId === "06" ? "5 7" : undefined}/>
      {labId === "04" && <path d="M255 45V130H465V45" fill="none" stroke="currentColor" opacity=".25" strokeDasharray="4 5"/>}
      {labId === "05" && [0,1,2].map(n => <path key={n} d={`M${315+n*25} 82q-55 -75 -85 0`} fill="none" stroke="#e8b58c" strokeWidth="2"/>)}
      {labId === "06" && <><rect x="44" y="20" width="628" height="140" rx="8" fill="none" stroke="currentColor" opacity=".22"/><rect x="300" y="40" width="130" height="100" rx="6" fill="none" stroke="#e8b58c" strokeDasharray="5 5"/></>}
      {[110,360,610].map((x,i) => <g key={x}><circle cx={x} cy="90" r={i === boundary ? 27 : 19} fill={i === boundary ? "#f5b78d" : "#263d40"} stroke={i === boundary ? "#f5b78d" : "#83aaa6"} strokeWidth="1.5"/><text x={x} y="95" textAnchor="middle" fill={i === boundary ? "#142b2d" : "#dcebe6"} fontSize="13" fontFamily="monospace">0{i+1}</text></g>)}
    </svg>
    <div className="figure-boundaries" role="group" aria-label="Inspect an observation boundary">{model.nodes.map((node,i) => <button key={node} aria-pressed={boundary === i} onClick={() => setBoundary(i)}><span>0{i+1}</span>{node}</button>)}</div>
    <p className="figure-explanation" aria-live="polite">{model.captions[boundary]}</p>
    {observations.length > 0 && <div className="figure-records"><span>Select received evidence</span>{observations.map(event => <button key={event.sequence} aria-pressed={event.sequence === selectedSequence} onClick={() => onSelect?.(event.sequence)}>#{event.sequence}</button>)}</div>}
    {selected && <div className="figure-fields"><span>RECEIVED RECORD · {selected.sequence}</span>{Object.entries(fields).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}<details><summary>Original record</summary><pre>{selected.data}</pre></details></div>}
    <p className="figure-footnote">{selected ? "Fields above come from the selected record. The diagram explains the observation boundary." : model.question}</p>
  </section>;
}
