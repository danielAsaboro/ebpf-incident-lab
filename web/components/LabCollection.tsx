"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { labs } from "@/lib/labs";
import { labDetails } from "@/lib/lab-details";
import { useNotebooks } from "@/lib/notebooks";
import { PageShell, labIcons } from "./AppShell";
import { LabIcon } from "./LabIcons";
import type { MachineLayer } from "./KernelScene";
const Scene = dynamic(() => import("./KernelScene").then(module => module.KernelScene), { ssr: false });
export function LabCollection() {
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState("01");
  const [layer, setLayer] = useState<MachineLayer>("kernel");
  const notes = useNotebooks();
  const lab = labs.find(item => item.id === preview)!;
  const filtered = labs.filter(item => filter === "all" || (filter === "hosted" ? item.hosted : !item.hosted));
  return <PageShell><div className="page-eyebrow"><span className="accent-square"/>THE INCIDENT COLLECTION<span>VOL. 01—07</span></div><div className="collection-intro"><div><h1>Seven questions.<br/><em>Under the surface.</em></h1><p>Choose an incident. Find the signal. Learn exactly what it can tell you.</p><div className="collection-counts"><span><b>03</b>Hosted investigations</span><span><b>04</b>Local VM investigations</span></div><Link className="collection-start" href={`/labs/${lab.id}`}>{notes[lab.id] ? "Resume" : "Open"} {lab.shortTitle.toLowerCase()}<LabIcon name="arrow"/></Link></div><div className="collection-model"><Scene key={preview} labId={preview} layer={layer} separation={65} view="isometric" zoom={1.05} reset={0} observations={0} onSelect={setLayer}/><span className="collection-model-caption">FIG. {preview} / {labDetails[preview].figure}</span></div></div><div className="collection-list-heading"><h2>The investigations</h2><div className="filter-buttons" role="group" aria-label="Filter investigations">{["all", "hosted", "local"].map(value => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}>{value === "all" ? "All seven" : value === "hosted" ? "Hosted" : "Local VM"}</button>)}</div></div><div className="collection-list">{filtered.map(item => <article key={item.id} className="collection-row"><span className="collection-number">{item.id}</span><div className="collection-row-icon"><LabIcon name={labIcons[Number(item.id)-1]} size={25}/></div><Link className="collection-row-main" href={`/labs/${item.id}`}><span>{item.hosted ? "HOSTED LAB" : "LOCAL VM"}{notes[item.id] ? ` / ${notes[item.id].phase === "complete" ? "NOTEBOOK COMPLETE" : "DRAFT SAVED"}` : ""}</span><h3>{item.title}</h3><p>{item.symptom}</p></Link><button className="preview-model-button" onClick={() => { setPreview(item.id); setLayer("kernel"); }} aria-label={`Preview ${item.shortTitle} model`} aria-pressed={preview === item.id}><LabIcon name="box" size={18}/><span>3D</span></button><Link className="row-open" href={`/labs/${item.id}`} aria-label={`Open ${item.shortTitle}`}><LabIcon name="arrow" size={21}/></Link></article>)}</div><div className="collection-support"><LabIcon name="book" size={28}/><div><h3>First time at the workbench?</h3><p>The field guide covers the method, your environment and how to read the evidence.</p></div><Link href="/guide">Open the field guide ↗</Link></div></PageShell>;
}
