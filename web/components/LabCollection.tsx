"use client";
import Link from "next/link";
import { useState } from "react";
import { labs } from "@/lib/labs";
import { useLearningRecords } from "@/lib/learning";
import { PageShell } from "./AppShell";
import { EvidenceDiagram } from "./EvidenceDiagram";
const outcomes = ["Distinguish an execution attempt from its outcome.","Use return evidence to separate missing files from denied access.","Locate the boundary of a failed connection.","Measure an interval without inventing its cause.","Compare retransmissions within a specific flow.","Resolve apparently contradictory process identities.","Separate verifier rejection from runtime observation."];
export function LabCollection() {
  const [filter, setFilter] = useState("all");
  const records = useLearningRecords();
  const latest = Object.values(records).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const filtered = labs.filter(lab => filter === "all" || (filter === "hosted" ? lab.hosted : !lab.hosted));
  return <PageShell><div className="case-eyebrow"><span className="accent-square"/>A FIELD GUIDE TO LINUX INCIDENTS<span>RUST / AYA / eBPF</span></div>
    <section className="learning-hero"><div className="hero-copy"><p className="eyebrow">LESS GUESSING. BETTER QUESTIONS.</p><h1>Get beneath<br/>the symptom.</h1><p className="hero-description">Something happened inside Linux.<br/>Learn to find the evidence—and know where it ends.</p><div className="hero-actions"><Link className="button primary" href={latest ? `/labs/${latest.labId}` : "/labs/02"}>{latest ? "Continue your investigation" : "Start with file access"}<span>↗</span></Link><Link href="/guide">Explore the method →</Link></div><p className="hero-audience">For Linux practitioners learning to investigate with eBPF.</p></div><div className="hero-specimen"><EvidenceDiagram labId="02"/><div className="specimen-label"><span>CASE STUDY 02</span><p>The file exists.<br/>So why did the open fail?</p><Link href="/labs/02">Investigate the difference ↗</Link></div></div></section>
    <div className="learning-principles">{[["01","Form a hypothesis","Decide what would change your mind."],["02","Interrogate the evidence","Run a controlled incident. Inspect real output."],["03","Defend your conclusion","Explain what follows—and what does not."]].map(([n,title,body])=><div key={n}><span>{n}</span><div><h3>{title}</h3><p>{body}</p></div></div>)}</div>
    <div className="collection-list-heading"><div><p className="eyebrow">SEVEN INVESTIGATIONS</p><h2>Different incidents.<br/>A sharper way to think.</h2></div><div className="filter-buttons" role="group" aria-label="Filter investigations">{["all","hosted","local"].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All cases" : value === "hosted" ? "Hosted" : "Local VM"}</button>)}</div></div>
    <div className="case-catalog">{filtered.map(lab=><Link key={lab.id} href={`/labs/${lab.id}`} className="case-card"><div className="card-meta"><span>CASE / {lab.id}</span><span>{lab.hosted ? "HOSTED" : "LOCAL VM"}</span></div><div className={`case-glyph glyph-${lab.id}`} aria-hidden="true"><span/><span/><span/><i>↗</i></div><h3>{lab.shortTitle}</h3><p>{outcomes[Number(lab.id)-1]}</p><div className="card-bottom"><span>{records[lab.id] ? "CONTINUE CASE" : lab.id === "02" ? "RECOMMENDED START" : "OPEN INVESTIGATION"}</span><b>↗</b></div></Link>)}</div>
    <aside className="learning-invitation"><div><p className="eyebrow">BUILD THE HABIT</p><h2>Could you solve it<br/>without the guide?</h2><p>Revisit a concept. Take a changed case. Keep an honest record of the help you needed.</p></div><Link className="button primary" href="/practice">Recall & practice ↗</Link></aside>
  </PageShell>;
}
