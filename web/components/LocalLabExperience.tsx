"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Lab } from "@/lib/labs";
import { labDetails } from "@/lib/lab-details";
import { downloadNotebook, readNotebook, saveNotebook, type Notebook, type Phase } from "@/lib/notebooks";
import { CodeBlock } from "./CodeBlock";

export function LocalLabExperience({ lab, onPhase }: { lab: Lab; onPhase?: (phase: Phase) => void }) {
  const [saved] = useState(() => readNotebook(lab.id));
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? "predict");
  const [prediction, setPrediction] = useState(saved?.prediction ?? "");
  const [output, setOutput] = useState(saved?.localEvidence ?? "");
  const [explanation, setExplanation] = useState(saved?.explanation ?? "");
  const [choice, setChoice] = useState<number | null>(saved?.choice ?? null);
  const [saveFailed, setSaveFailed] = useState(false);
  const detail = labDetails[lab.id];
  const record = (): Notebook => ({ labId: lab.id, source: "local", phase, prediction, localEvidence: output, explanation, choice, events: [], runState: "manual", updatedAt: new Date().toISOString() });
  useEffect(() => {
    const ok = saveNotebook({ labId: lab.id, source: "local", phase, prediction, localEvidence: output, explanation, choice, events: [], runState: "manual", updatedAt: new Date().toISOString() });
    queueMicrotask(() => setSaveFailed(!ok));
  }, [lab.id, phase, prediction, output, explanation, choice]);
  useEffect(() => { onPhase?.(phase); }, [phase, onPhase]);
  const steps: Phase[] = ["predict", "observe", "explain", "transfer", "complete"];
  const canVisit = (step: Phase) => step === "predict" || step === "observe" && prediction.trim().length >= 20 || step === "explain" && output.trim().length >= 20 || step === "transfer" && output.trim().length >= 20 && explanation.trim().length >= 30 || step === "complete" && phase === "complete";
  return <div className="experience embedded"><ol className="progress" aria-label="Local lab progress">{steps.map((step, index) => <li key={step} className={steps.indexOf(phase) >= index ? "active" : ""}><button disabled={!canVisit(step)} onClick={() => setPhase(step)} aria-current={phase === step ? "step" : undefined}><span>{index + 1}</span>{step}</button></li>)}</ol>
    <p className="storage-note">{saveFailed ? "Storage is unavailable. Keep this page open or download your notes." : "Notebook saved on this device."} <Link href="/notebooks">Manage notes</Link><button type="button" onClick={() => downloadNotebook(record())}>Download</button></p>
    <div className="local-mode-label">LOCAL VM · USER-PROVIDED EVIDENCE</div>
    {phase === "predict" && <div className="panel"><p className="kicker">01 · PREDICT</p><h2>Choose the signal.</h2><p>{lab.predictionPrompt}</p><label htmlFor="local-prediction">Your prediction</label><textarea id="local-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} rows={5}/><button className="button primary" disabled={prediction.trim().length < 20} onClick={() => setPhase("observe")}>Open the run instructions →</button><Link className="text-link" href="/guide#local-vm">Set up the learner VM ↗</Link></div>}
    {phase === "observe" && <div className="panel"><p className="kicker">02 · OBSERVE LOCALLY</p><h2>Run it. Keep the evidence.</h2><p>Use two terminals inside the prepared learner VM. Start the observer first; run the fixture when it reports ready.</p><CodeBlock label="TERMINAL 1 / OBSERVER" code={detail.observer!}/><CodeBlock label="TERMINAL 2 / FIXTURE" code={detail.fixture!}/><p className="local-exercise">{detail.exercise}</p><details className="lab-details"><summary>Cleanup</summary><p>{detail.cleanup}</p></details><label htmlFor="local-output">Paste your local output</label><textarea id="local-output" value={output} onChange={event => setOutput(event.target.value)} rows={7} placeholder="Paste the actual output you collected…"/><p className="privacy-note">This application cannot verify pasted output. It stays labeled user-provided and never contributes to hosted observation counts.</p><button className="button primary" disabled={output.trim().length < 20} onClick={() => setPhase("explain")}>Interpret your evidence →</button></div>}
    {phase === "explain" && <div className="panel"><p className="kicker">03 · EXPLAIN + BOUND</p><h2>What does it establish?</h2><p>{lab.explanationPrompt}</p><details className="lab-details"><summary>Review your local output</summary><pre>{output}</pre></details><div className="limits">{lab.limits.map(limit => <p key={limit}>{limit}</p>)}</div><label htmlFor="local-explanation">Your explanation</label><textarea id="local-explanation" value={explanation} onChange={event => setExplanation(event.target.value)} rows={5}/><button className="button primary" disabled={explanation.trim().length < 30} onClick={() => setPhase("transfer")}>Test your understanding →</button></div>}
    {phase === "transfer" && <div className="panel"><p className="kicker">04 · TRANSFER</p><h2>The incident changed.</h2><p>{lab.transferPrompt}</p><div className="choices">{lab.transferOptions.map((option, index) => <button className={`choice ${choice === index ? "selected" : ""}`} key={option.label} onClick={() => setChoice(index)}><span>{String.fromCharCode(65 + index)}</span>{option.label}</button>)}</div>{choice !== null && <p className="result">{lab.transferOptions[choice]?.correct ? "Supported. Your reasoning preserves the evidence boundary." : "Reconsider what this observation establishes on its own."}</p>}{choice !== null && lab.transferOptions[choice]?.correct && <button className="button primary" onClick={() => setPhase("complete")}>Finish this notebook →</button>}</div>}
    {phase === "complete" && <div className="panel completion"><div className="completion-mark">✓</div><p className="kicker">NOTEBOOK COMPLETE</p><h2>A clearer question. A bounded answer.</h2><p>Your reasoning exercise is complete. The local output remains user-provided; this is not an independently verified run.</p><button className="button primary" onClick={() => downloadNotebook(record())}>Download case notes ↓</button><Link className="text-link" href={`/labs/${String(Number(lab.id) + 1).padStart(2, "0")}`}>Next investigation →</Link></div>}
  </div>;
}
