import { describe, expect, it } from "vitest";
import { createElement, isValidElement, type FunctionComponent, type ReactElement } from "react";
import { DashboardView } from "../dashboard/DashboardViews";
import { RevisionDashboard } from "./RevisionDashboard";

/**
 * Wiring check without a DOM: DashboardView("revision") must render the
 * real RevisionDashboard (backed by /api/revision/overview), not the old
 * fabricated card list. Both are plain function components, so invoking
 * the returned element types inspects the tree without mounting.
 */
describe("RevisionDashboard integration", () => {
  it("/dashboard/revision renders RevisionDashboard", () => {
    const view = DashboardView({ section: "revision" });
    expect(isValidElement(view)).toBe(true);
    const inner = (view.type as FunctionComponent)({}) as ReactElement;
    expect(isValidElement(inner)).toBe(true);
    expect(inner.type).toBe(RevisionDashboard);
    expect(createElement(RevisionDashboard).type).toBe(RevisionDashboard);
  });

  it("other dashboard sections are unaffected", () => {
    const home = DashboardView({ section: "home" });
    expect(isValidElement(home)).toBe(true);
    expect((home.type as FunctionComponent).name).not.toBe("RevisionView");
  });
});
