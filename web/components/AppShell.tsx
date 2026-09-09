"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { labs } from "@/lib/labs";
import { useLearningRecords } from "@/lib/learning";
import { LabIcon } from "./LabIcons";
export const repo = process.env.NEXT_PUBLIC_REPOSITORY_URL ?? "https://github.com/danielAsaboro/ebpf-incident-lab";
export const labIcons = ["process", "file", "network", "clock", "retry", "box", "shield"];

export function AppHeader() {
  const pathname = usePathname();
  return <header className="lab-header"><Link className="brand" href="/" aria-label="Incident Lab home"><span className="brand-symbol"><LabIcon name="layers" size={24}/></span><span>incident<span className="brand-light"> / lab</span><small>OBSERVE CLOSELY. REASON CLEARLY.</small></span></Link><nav className="global-nav" aria-label="Application navigation">{[{ href: "/", label: "Investigations" }, { href: "/guide", label: "Field guide" }, { href: "/practice", label: "Practice" }, { href: "/notebooks", label: "Notebooks" }].map(item => <Link key={item.href} href={item.href} aria-current={(item.href === "/" ? pathname === "/" || pathname.startsWith("/labs/") : pathname === item.href) ? "page" : undefined}>{item.label}</Link>)}</nav><a className="source-link" href={repo} target="_blank" rel="noreferrer" aria-label="View source on GitHub"><LabIcon name="external" size={18}/></a></header>;
}
export function IncidentRail({ selected }: { selected?: string }) {
  const notes = useLearningRecords();
  const completed = Object.values(notes).filter(note => note.phase === "review").length;
  return <aside className="incident-rail" aria-label="Investigations"><Link href="/" className="rail-heading"><span className="micro">ALL INVESTIGATIONS</span><span className="count-badge">07</span></Link><nav className="incident-list" aria-label="Choose a lab">{labs.map((lab, index) => <Link key={lab.id} href={`/labs/${lab.id}`} className={`incident-item ${selected === lab.id ? "selected" : ""}`} aria-label={`${lab.id} ${lab.shortTitle}, ${lab.hosted ? "hosted lab" : "local VM"}`} aria-current={selected === lab.id ? "page" : undefined}><span className="incident-number">{lab.id}</span><span className="incident-item-content"><span className="incident-item-title">{lab.shortTitle}</span><span className="incident-item-status">{notes[lab.id]?.phase === "review" ? "PRACTICE RECORDED" : notes[lab.id] ? "DRAFT SAVED" : lab.hosted ? "HOSTED LAB" : "LOCAL VM"}</span></span><LabIcon name={labIcons[index]} size={17}/></Link>)}</nav><div className="rail-progress"><span className="micro">YOUR FIELDWORK</span><strong>{completed}<span> / 7 cases recorded</span></strong><div className="progress-track"><i style={{ width: `${completed / 7 * 100}%` }}/></div><Link href="/notebooks">Open your notes ↗</Link></div><div className="maker"><span className="maker-avatar">da.</span><span>Built by Daniel Asaboro<small>AN INDEPENDENT EXPLORATION</small></span></div></aside>;
}
export function AppFooter() { return <footer className="instrument-footer"><span><i className="status-dot"/>RUST + AYA<span className="footer-divider">/</span>eBPF INCIDENT LAB</span><span>REAL OBSERVATIONS. OPEN QUESTIONS.</span><Link href="/guide#boundaries">Know the boundaries ↗</Link></footer>; }
export function PageShell({ children }: { children: React.ReactNode }) { return <div className="app-body content-body"><IncidentRail/><main id="main" className="document-workspace">{children}</main></div>; }
