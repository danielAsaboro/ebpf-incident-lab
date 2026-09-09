import Link from "next/link";
import { notFound } from "next/navigation";
import { LabExperience } from "@/components/LabExperience";
import { getLab, labs } from "@/lib/labs";

export function generateStaticParams() { return labs.filter((lab) => lab.hosted).map((lab) => ({ id: lab.id })); }

export default async function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lab = getLab(id);
  if (!lab?.hosted) notFound();
  return <main id="main" className="lab-page"><header className="site-header shell"><Link className="wordmark" href="/"><span className="mark">e</span> Incident Lab</Link><Link href="/#labs">All labs</Link></header><LabExperience lab={lab} /></main>;
}
