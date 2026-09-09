"use client";
import Link from "next/link";
import { labs } from "@/lib/labs";
import { IncidentRail } from "./AppShell";
import { InvestigationFlow } from "./InvestigationFlow";

export function IncidentWorkbench({ initialLab = "01" }: { initialLab?: string }) {
  const lab = labs.find(item => item.id === initialLab) ?? labs[0];
  const index = labs.indexOf(lab);
  return <div className="case-layout"><IncidentRail selected={lab.id}/><main id="main" className="case-main">
    <div className="case-eyebrow"><Link href="/">INVESTIGATIONS</Link><span>/</span><span>CASE {lab.id}</span><span className="environment-badge">{lab.hosted ? "HOSTED LINUX" : "LOCAL LINUX VM"}</span></div>
    <header className="case-heading"><span className="case-number">{lab.id}</span><div><p className="eyebrow">{lab.shortTitle}</p><h1>{lab.title}</h1><p>{lab.symptom}</p></div></header>
    <div className="case-context"><span><i/> {lab.hook}</span><Link href="/guide#boundaries">Understand the evidence boundary ↗</Link></div>
    <InvestigationFlow key={lab.id} lab={lab}/>
    <nav className="adjacent-labs" aria-label="Previous and next investigation"><Link href={index > 0 ? `/labs/${labs[index-1].id}` : "/"}><small>← PREVIOUS</small>{index > 0 ? labs[index-1].shortTitle : "All investigations"}</Link><Link href={index < 6 ? `/labs/${labs[index+1].id}` : "/practice"}><small>NEXT →</small>{index < 6 ? labs[index+1].shortTitle : "Recall & practice"}</Link></nav>
  </main></div>;
}
