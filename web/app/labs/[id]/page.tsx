import { notFound } from "next/navigation";
import { IncidentWorkbench } from "@/components/IncidentWorkbench";
import { getLab, labs } from "@/lib/labs";

export const dynamicParams = false;
export function generateStaticParams() { return labs.flatMap(lab => [{ id: lab.id }, { id: lab.slug }]); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { const lab = getLab((await params).id); return { title: lab ? `${lab.shortTitle} · Incident Lab` : "Lab not found · Incident Lab" }; }

export default async function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lab = getLab(id);
  if (!lab) notFound();
  return <IncidentWorkbench key={lab.id} initialLab={lab.id} />;
}
