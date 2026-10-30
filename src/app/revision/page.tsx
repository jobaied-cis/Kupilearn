import { redirect } from "next/navigation";

/** /revision - canonical Revision Engine page lives inside the dashboard shell at /dashboard/revision. */
export default function RevisionPage() {
  redirect("/dashboard/revision");
}