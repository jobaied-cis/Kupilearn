import { notFound } from "next/navigation";
import { DashboardView } from "../../../components/dashboard/DashboardViews";
import type { DashSection } from "../../../components/dashboard/DashboardShell";

const SECTIONS: DashSection[] = ["lesson", "revision", "practice", "homework", "games", "subjects", "progress", "profile", "subscription", "learn", "offline", "help"];

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

export default async function DashboardSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section as DashSection)) notFound();
  return <DashboardView section={section as DashSection} />;
}
