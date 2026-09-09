import type { CSSProperties } from "react";

export function LabIcon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
  const paths: Record<string, React.ReactNode> = {
    layers: <><path d="m3 7 9-5 9 5-9 5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    external: <><path d="M14 3h7v7m0-7L10 14"/><path d="M10 3H3v18h18v-7"/></>,
    crosshair: <><circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/></>,
    reset: <><path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    minus: <path d="M5 12h14"/>,
    book: <><path d="M3 3h6l3 3 3-3h6v17h-6l-3 2-3-2H3Z"/><path d="M12 6v16"/></>,
    process: <><rect x="8" y="2" width="8" height="6" rx="1"/><rect x="2" y="16" width="7" height="6" rx="1"/><rect x="15" y="16" width="7" height="6" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/></>,
    file: <><path d="M5 2h9l5 5v15H5Z"/><path d="M14 2v6h5M8 13h8m-8 4h6"/></>,
    network: <><circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="m8 10 8-4M8 14l8 4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/></>,
    retry: <><path d="M3 10a9 9 0 0 1 16-5l2 3M21 2v6h-6M21 14a9 9 0 0 1-16 5l-2-3M3 22v-6h6"/></>,
    box: <><path d="m3 6 9-4 9 4v12l-9 4-9-4Zm0 0 9 5 9-5M12 11v11"/></>,
    shield: <><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/></>,
    terminal: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3m6 0h5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name] ?? paths.layers}</svg>;
}
