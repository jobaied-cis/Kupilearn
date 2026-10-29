"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { getProfile } from "../lib/profile";

export const BTN =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-200 ease-[var(--ease-spring)] disabled:pointer-events-none disabled:opacity-55";
export const BTN_FLAME =
  "bg-flame text-night border-2 border-ink shadow-hard hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-lg hover:bg-[#ffbe45] active:translate-x-px active:translate-y-px active:shadow-hard-sm active:bg-ember";
export const BTN_PAPER =
  "bg-paper text-ink border-2 border-ink shadow-hard-sm hover:-translate-y-px hover:shadow-hard hover:bg-white active:translate-y-0.5 active:shadow-none";

/**
 * No login / no auth. First-time users go to onboarding,
 * returning users (saved profile) go straight to the dashboard.
 */
export function GetStartedButton({
  className = "",
  children,
  arrow = true,
}: {
  className?: string;
  children: ReactNode;
  arrow?: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={`${BTN} ${className}`}
      onClick={() => router.push(getProfile() ? "/dashboard" : "/onboarding")}
    >
      {children}
      {arrow ? <Icon name="arrow" className="size-5 transition-transform duration-300 group-hover/btn:translate-x-1" strokeWidth={2} /> : null}
    </button>
  );
}
