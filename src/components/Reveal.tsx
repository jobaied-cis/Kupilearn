"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type RevealFrom = "bottom" | "left" | "right" | "scale";

export function Reveal({
  from = "bottom",
  delay,
  className,
  as = "div",
  children,
}: {
  from?: RevealFrom;
  delay?: number;
  className?: string;
  as?: "div" | "li";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | HTMLLIElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      requestAnimationFrame(() => node.setAttribute("data-shown", "true"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "true");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;
  if (as === "li") {
    return (
      <li ref={ref as React.RefObject<HTMLLIElement>} data-reveal={from} data-shown="false" style={style} className={className}>
        {children}
      </li>
    );
  }
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} data-reveal={from} data-shown="false" style={style} className={className}>
      {children}
    </div>
  );
}
