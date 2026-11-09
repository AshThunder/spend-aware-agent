// Inline line icons (lucide geometry), 16px, 1.5 stroke, inherit text color.
type P = { className?: string };
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const Check = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const Cross = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const ArrowOut = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M7 17 17 7M7 7h10v10" />
  </svg>
);
export const Redo = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
  </svg>
);
