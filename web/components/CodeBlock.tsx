"use client";
import { useState } from "react";
export function CodeBlock({ label, code }: { label: string; code: string }) {
  const [status, setStatus] = useState("");
  async function copy() { try { await navigator.clipboard.writeText(code); setStatus("Copied"); } catch { setStatus("Select and copy the command below."); } }
  return <div className="command-block"><div><span>{label}</span><button type="button" onClick={copy}>Copy</button></div><pre><code>{code}</code></pre><span className="copy-status" role="status">{status}</span></div>;
}
