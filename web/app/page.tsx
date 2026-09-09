import Link from "next/link";
import { labs } from "@/lib/labs";

const repo = process.env.NEXT_PUBLIC_REPOSITORY_URL ?? "https://github.com/danielAsaboro/ebpf-incident-lab";

export default function Home() {
  return (
    <main id="main">
      <header className="site-header shell">
        <Link className="wordmark" href="/" aria-label="eBPF Incident Lab home"><span className="mark">e</span> Incident Lab</Link>
        <nav aria-label="Primary navigation"><a href="#labs">Labs</a><a href="#method">Method</a><a href="#roadmap">Roadmap</a><a href={repo}>Source ↗</a></nav>
      </header>

      <section className="hero shell">
        <div className="eyebrow"><span className="live-dot" /> Three hosted investigations · Ubuntu x86_64</div>
        <h1>Stop guessing.<br /><em>Ask the kernel.</em></h1>
        <p className="lede">Seven incident-first labs for engineers who operate Linux. Reproduce one bounded failure, collect one useful signal, and learn exactly where the evidence ends.</p>
        <div className="hero-actions"><Link className="button primary" href="/labs/01">Run the first incident</Link><a className="button secondary" href={repo}>Inspect the source</a></div>
        <div className="boundary"><strong>Current boundary</strong><span>Labs 01, 02, and 07 are browser-accessible. Four more run through the documented local VM.</span></div>
      </section>

      <section className="signal-strip" aria-label="Learning sequence">
        <div className="shell signal-grid">{["Predict", "Observe", "Explain", "Bound", "Transfer"].map((item, index) => <div key={item}><span>0{index + 1}</span>{item}</div>)}</div>
      </section>

      <section className="section shell" id="labs">
        <div className="section-heading"><div><p className="kicker">THE INCIDENT QUEUE</p><h2>Seven failures worth understanding</h2></div><p>Every lab starts with an operational question. Hosted badges describe what runs here today.</p></div>
        <div className="lab-grid">
          {labs.map((lab) => (
            <article className="lab-card" key={lab.id}>
              <div className="lab-meta"><span>LAB {lab.id}</span><span className={lab.hosted ? "status hosted" : "status local"}>{lab.hosted ? "HOSTED" : "LOCAL VM"}</span></div>
              <h3>{lab.title}</h3><p>{lab.symptom}</p>
              <div className="hook"><span>HOOK</span><code>{lab.hook}</code></div>
              {lab.hosted ? <Link className="text-link" href={`/labs/${lab.id}`}>Open investigation →</Link> : <a className="text-link muted" href={`${repo}/tree/main/labs/${lab.id}-${lab.slug}`}>Read local lab ↗</a>}
            </article>
          ))}
        </div>
      </section>

      <section className="method section" id="method"><div className="shell split"><div><p className="kicker">THE METHOD</p><h2>Evidence before explanation</h2></div><div className="method-list">
        <div><b>01</b><h3>Reproduce a bounded symptom</h3><p>Each fixture creates a controlled failure. It is a teaching environment, never a production claim.</p></div>
        <div><b>02</b><h3>Capture the smallest useful signal</h3><p>The observer attaches to a named kernel boundary and emits typed, time-bounded events.</p></div>
        <div><b>03</b><h3>State what remains unknown</h3><p>A learner completes the incident only after naming what the evidence cannot establish.</p></div>
      </div></div></section>

      <section className="section shell" id="roadmap"><div className="section-heading"><div><p className="kicker">PUBLIC ROADMAP</p><h2>Expand only after proof</h2></div></div><div className="roadmap">
        <div className="road active"><span>NOW</span><h3>Three hosted labs</h3><p>Execution, file access, and verifier portability with fixed operations.</p></div>
        <div className="road"><span>NEXT</span><h3>Kernel matrix</h3><p>ARM64 and additional distribution kernels with observed compatibility receipts.</p></div>
        <div className="road"><span>FELLOWSHIP</span><h3>Community fixtures</h3><p>Operator workshops, translations, and reviewed contributor incidents.</p></div>
      </div></section>

      <footer className="footer shell"><div className="wordmark"><span className="mark">e</span> Incident Lab</div><p>Rust + Aya. Bounded observations. Public evidence.</p><a href={repo}>GitHub ↗</a></footer>
    </main>
  );
}
