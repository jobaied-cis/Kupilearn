import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DashboardView } from "../../../components/dashboard/DashboardViews";
import type { DashSection } from "../../../components/dashboard/DashboardShell";

const SECTIONS: DashSection[] = ["classroom", "lesson", "revision", "practice", "homework", "games", "subjects", "progress", "profile", "subscription", "learn", "offline", "help"];

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

function DashboardSectionFallback() {
  return (
    <div className="mx-auto max-w-[84rem]" role="status" aria-label="Loading section">
      <div className="mb-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-ink/10" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl border-2 border-ink/10 bg-white" />
    </div>
  );
}

async function DashboardSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section as DashSection)) notFound();
  return <DashboardView section={section as DashSection} />;
}

export default function DashboardSectionPage({ params }: { params: Promise<{ section: string }> }) {
  return (
    <Suspense fallback={<DashboardSectionFallback />}>
      <DashboardSection params={params} />
    </Suspense>
  );
}
