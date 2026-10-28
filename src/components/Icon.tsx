const PATHS: Record<string, string> = {
  board: "M3.5 4.5h17v11h-17v-11zM12 15.5V20M8 20h8M7 8.5h5M7 11.5h3.5M15 8.5l2.5 3.5",
  pencil: "M15.5 4.5l4 4L8.5 19.5l-5 1 1-5 11-11zM13.5 6.5l4 4",
  target:
    "M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM12 8.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4zM12 4.5V2M12 22v-2.5M4.5 12H2M22 12h-2.5",
  crosshair: "M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM12 2v4.5M12 17.5V22M2 12h4.5M17.5 12H22",
  chat: "M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 21l1.4-3.5C4.2 16.2 3.5 14.4 3.5 12.5c0-3.9 3.6-7 8-7s8.5 3.1 8.5 7zM8.5 12h.01M12 12h.01M15.5 12h.01",
  keyboard: "M3.5 6.5h17v11h-17v-11zM7 10h.01M10.3 10h.01M13.7 10h.01M17 10h.01M8 14h8",
  lightbulb: "M9.5 20.5h5M10 17.5h4M9 14.2A5.5 5.5 0 1115 14.2c-.4.3-.6.8-.6 1.3v.5h-4.8v-.5c0-.5-.2-1-.6-1.3z",
  notes: "M6 3.5h9l3.5 3.5v13.5H6V3.5zM9 10h6.5M9 13.5h6.5M9 17h4",
  hand: "M8.5 12V5.8a1.3 1.3 0 012.6 0V11M11.1 10.5V4.8a1.3 1.3 0 012.6 0v5.7M13.7 10.5V6a1.3 1.3 0 012.6 0v6M16.3 11a1.3 1.3 0 012.6 0v3.3a6.2 6.2 0 01-6.2 6.2h-.6a6 6 0 01-4.8-2.4L4.6 14a1.3 1.3 0 012-1.6l1.9 1.9",
  expand: "M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15",
  pause: "M9 5.5v13M15 5.5v13",
  play: "M8 5.5l10 6.5-10 6.5v-13z",
  check: "M5 12.8l4.3 4.2L19 6.5",
  send: "M4.5 12h13M12.5 6l6 6-6 6",
  arrow: "M4 12h15.5M13.5 6l6 6-6 6",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  cap: "M2.5 8.5L12 4.5l9.5 4L12 12.5l-9.5-4zM6 10.3V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.7M2.5 8.5v5",
  shield: "M12 3.5l7 2.5v5.5c0 4.2-2.8 7.6-7 9-4.2-1.4-7-4.8-7-9V6l7-2.5zM9.2 12l2 2 3.6-4",
  heart: "M12 19.5s-7-4.2-7-9A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.5c0 4.8-7 9-7 9z",
  clock: "M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM12 8v4.3l3 2",
  stairs: "M4 19h5v-5H4v5zM9.5 14V9.5h5V14M14.5 9.5V5h5v4.5M4 19h16",
  chart: "M4 20V4M4 20h16M8 20v-6.5M12.5 20V9M17 20v-4",
  book: "M3.5 5.5c2.8-1 5.7-1 8.5.8v13c-2.8-1.8-5.7-1.8-8.5-.8v-13zM20.5 5.5c-2.8-1-5.7-1-8.5.8v13c2.8-1.8 5.7-1.8 8.5-.8v-13z",
  compass: "M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM14.8 9.2l-1.7 4-4 1.7 1.7-4 4-1.7z",
  calc: "M5.5 3.5h13v17h-13v-17zM8 7h8M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h3.5M15.5 18h.01",
  lock: "M6 10.5h12v9.5H6v-9.5zM8.5 10.5V8a3.5 3.5 0 017 0v2.5M12 14.3v2.2",
  external: "M7 17L17 7M9 7h8v8",
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  strokeWidth = 1.7,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const filled = name === "play";
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
