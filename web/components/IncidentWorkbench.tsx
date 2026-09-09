"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import Link from "next/link";
import { labs } from "@/lib/labs";
import { LabExperience } from "./LabExperience";
import { IncidentRail } from "./AppShell";
import { LocalLabExperience } from "./LocalLabExperience";
import { labDetails } from "@/lib/lab-details";
import { useNotebooks, type Phase } from "@/lib/notebooks";
import { LabIcon } from "./LabIcons";
import type { MachineLayer, SceneView } from "./KernelScene";

const KernelScene = dynamic(() => import("./KernelScene").then(module => module.KernelScene), {
  ssr: false, loading: () => <div className="scene-loading"><span className="loading-cross">+</span>Assembling the cutaway</div>,
});
const headlines: Record<string, [string, string]> = {
  "01": ["Something ran.", "Leave no trace?"],
  "02": ["A file was opened.", "Or was it?"],
  "03": ["A connection failed.", "Find the boundary."],
  "04": ["Every millisecond", "has a story."],
  "05": ["Sent. Sent again.", "Find the pattern."],
  "06": ["One process.", "Two identities."],
  "07": ["Before it runs,", "it must prove it."],
};
export function IncidentWorkbench({ initialLab = "01" }: { initialLab?: string }) {
  const selected = initialLab;
  const notebooks = useNotebooks();
  const [layer, setLayer] = useState<MachineLayer>("kernel");
  const [separation, setSeparation] = useState(72);
  const [view, setView] = useState<SceneView>("isometric");
  const [zoom, setZoom] = useState(1);
  const [reset, setReset] = useState(0);
  const [started, setStarted] = useState(false);
  const [observations, setObservations] = useState(0);

  const lab = labs.find(item => item.id === selected) ?? labs[0];
  const title = headlines[lab.id];
  const layerNotes = labDetails[lab.id].layers;
  const currentIndex = labs.indexOf(lab);
  const onPhase = useCallback((phase: Phase) => { setLayer(phase === "predict" ? "process" : phase === "observe" ? "kernel" : "transport"); }, []);
  const repo = process.env.NEXT_PUBLIC_REPOSITORY_URL ?? "https://github.com/danielAsaboro/ebpf-incident-lab";
  const receiveCount = useCallback((count: number) => setObservations(count), []);
  function resetView() { setSeparation(72); setZoom(1); setView("isometric"); setReset(value => value + 1); }

  return <main id="main" className="incident-app">
    <div className="app-body">
      <IncidentRail selected={lab.id}/>
      <section className="machine-workspace" aria-label="Incident cutaway">
        <div className="workspace-topline"><span className="micro"><span className="accent-square"/>INCIDENT {lab.id}<span className="topline-divider">/</span>{lab.shortTitle.toUpperCase()}</span><span className="model-tag">INTERACTIVE MODEL</span></div>
        <div className="incident-headline" key={lab.id}><p className="micro">{lab.id === "01" ? "WHAT JUST RAN ON MY SERVER?" : "AN INVESTIGATION IN LINUX"}</p><h1>{title[0]}<br/><em>{title[1]}</em></h1><p className="incident-deck">{lab.symptom}</p></div>
        <div className="model-stage">
          <div className="stage-scale" aria-hidden="true"><span>Y</span><i/><span>00</span><i/><span>−Y</span></div>
          <KernelScene key={lab.id} labId={lab.id} layer={layer} separation={separation} view={view} zoom={zoom} reset={reset} observations={observations} onSelect={setLayer}/>
          <div className="model-caption caption-top"><span>01</span><div>{layerNotes.process.name.toUpperCase()}<small>the attempted operation</small></div></div>
          <div className="model-caption caption-mid"><span>02</span><div>{layerNotes.kernel.name.toUpperCase()}<small>the observation boundary</small></div></div>
          <div className="model-caption caption-bottom"><span>03</span><div>{layerNotes.transport.name.toUpperCase()}<small>the collected evidence</small></div></div>
          <div className="model-coordinate" aria-hidden="true">FIG. {lab.id} <span> / </span> {labDetails[lab.id].figure}</div>
          <div className="scene-tools"><button aria-label="Zoom in" disabled={zoom >= 1.4} onClick={() => setZoom(value => Math.min(1.4, value + .1))}><LabIcon name="plus" size={16}/></button><button aria-label="Zoom out" disabled={zoom <= .7} onClick={() => setZoom(value => Math.max(.7, value - .1))}><LabIcon name="minus" size={16}/></button><span/><button onClick={resetView} aria-label="Reset camera and separation"><LabIcon name="reset" size={16}/></button></div>
          <span className="drag-hint"><LabIcon name="crosshair" size={13}/>DRAG TO ORBIT · SELECT A LAYER</span>
        </div>
        <div className="machine-controls">
          <div className="view-switch" role="group" aria-label="Camera view"><button aria-pressed={view === "isometric"} onClick={() => setView("isometric")}><LabIcon name="box" size={15}/>3D view</button><button aria-pressed={view === "section"} onClick={() => setView("section")}>Section</button></div>
          <label className="separation-control"><span>Layer separation</span><input type="range" min="0" max="100" value={separation} onChange={event => setSeparation(Number(event.target.value))}/><output>{separation}%</output></label>
        </div>
        <div className="layer-selector" role="group" aria-label="Inspect a system layer">{(Object.keys(layerNotes) as MachineLayer[]).map((id, index) => <button key={id} aria-pressed={layer === id} onClick={() => setLayer(id)}><span>0{index + 1}</span>{layerNotes[id].name}<span className="layer-select-mark">{layer === id ? "↗" : "+"}</span></button>)}</div>
        <div className="layer-explanation"><span className="micro">{layerNotes[layer].label}</span><p>{layerNotes[layer].description}</p></div>
        <div className="evidence-counter"><span>{String(observations).padStart(2,"0")} HOSTED OBSERVATIONS</span><span>MODEL · NOT LIVE TOPOLOGY</span></div>
        <details className="lab-details exercise-details"><summary>Go deeper / the exercise</summary><p>{labDetails[lab.id].exercise}</p><a href={`${repo}/tree/main/labs/${lab.id}-${lab.slug}`} target="_blank" rel="noreferrer">Read the source lab ↗</a></details>
        <nav className="adjacent-labs" aria-label="Previous and next investigation">{currentIndex > 0 ? <Link href={`/labs/${labs[currentIndex-1].id}`}><small>← PREVIOUS</small>{labs[currentIndex-1].shortTitle}</Link> : <Link href="/"><small>← COLLECTION</small>All investigations</Link>}{currentIndex < labs.length-1 ? <Link href={`/labs/${labs[currentIndex+1].id}`}><small>NEXT →</small>{labs[currentIndex+1].shortTitle}</Link> : <Link href="/notebooks"><small>YOUR FIELDWORK →</small>Review your notebooks</Link>}</nav>
      </section>
      <aside className="notebook" aria-label="Investigation notebook">
        <div className="notebook-heading">{started ? <button className="notebook-back" onClick={() => setStarted(false)} aria-label="Back to incident brief">←</button> : null}<LabIcon name="book" size={17}/><span>FIELD NOTES</span><span className="notebook-page">{lab.id} / 07</span></div>
        {started ? (lab.hosted ? <LabExperience key={lab.id} lab={lab} embedded persist onPhase={onPhase} onObservations={receiveCount}/> : <LocalLabExperience key={lab.id} lab={lab} onPhase={onPhase}/>) : <div className="brief" key={lab.id}>
          <div className="brief-heading"><span className="micro">THE QUESTION</span><span className="brief-index">{lab.id}</span></div>
          <h2>{lab.title}</h2><p className="brief-intro">{lab.id === "01" ? "It appeared. It did something. It vanished. A process snapshot arrives too late. Get closer to the moment it happened." : lab.symptom}</p>
          <div className="brief-rule"/>
          <div className="note-section"><span className="micro">YOUR OBSERVATION POINT</span><div className="hook-name"><span>↳</span><code>{lab.hook}</code></div></div>
          <div className="brief-facts"><div><span>ENVIRONMENT</span><strong>Linux / x86_64</strong></div><div><span>CAPTURE WINDOW</span><strong>{lab.hosted ? lab.duration : "Local VM"}</strong></div></div>
          <div className="margin-note"><span>✳</span><p>{lab.id === "01" ? "An exec attempt is a clue. It is not proof that the process succeeded." : lab.limits[1] || "Keep the observation tied to the boundary and environment that produced it."}</p></div>
          <button className="begin-button" onClick={() => setStarted(true)}>{notebooks[lab.id] ? "Resume investigation" : "Begin investigation"}<LabIcon name="arrow" size={20}/></button>
          <p className="begin-note">{lab.hosted ? "Make a prediction. Then ask the kernel." : "This investigation runs in your Linux VM."}</p>
          <div className="notebook-method"><span className="micro">THE INVESTIGATION</span>{["Predict the signal", "Observe the evidence", "Explain its limits", "Test your understanding"].map((step, i) => <div key={step}><span>{String(i + 1).padStart(2, "0")}</span>{step}<span className="method-tick">{i === 0 ? "←" : "·"}</span></div>)}</div>
        </div>}
        <div className="notebook-foot"><span className="status-dot"/>REAL EVENTS. BOUNDED CLAIMS.</div>
      </aside>
    </div>

  </main>;
}
