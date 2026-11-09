import type { Verdict } from "@/lib/learning";
import { usd, type TrustRow } from "@/lib/view";
import { Check, Cross, Redo } from "./icons";

export function VerdictTag({ verdict }: { verdict: Verdict }) {
  switch (verdict) {
    case "keep":
      return (
        <span className="inline-flex h-6 items-center gap-1 rounded-[4px] bg-good px-2 text-[12px] font-medium text-paper">
          <Check className="size-3.5" /> Keep
        </span>
      );
    case "skip":
      return (
        <span className="inline-flex h-6 items-center gap-1 rounded-[4px] bg-bad px-2 text-[12px] font-medium text-paper">
          <Cross className="size-3.5" /> Skip
        </span>
      );
    case "retest":
      return (
        <span className="inline-flex h-6 items-center gap-1 rounded-[4px] border border-ink/20 px-2 text-[12px] text-ink">
          <Redo className="size-3.5" /> Re-test
        </span>
      );
    default:
      return <span className="inline-flex h-6 items-center px-2 text-[12px] text-muted">Not tried</span>;
  }
}

/** One square per purchase, oldest first. Filled green when it added facts, red when it added nothing. */
export function History({ history }: { history: number[] }) {
  if (!history.length) return <span className="font-mono text-[12px] text-muted">–</span>;
  const shown = history.slice(-10);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Scores: ${history.map((h) => h.toFixed(2)).join(", ")}`}>
      {shown.map((h, i) => (
        <span key={i} className={`size-2.5 ${h >= 0.25 ? "bg-good" : "bg-bad"}`} aria-hidden />
      ))}
      {history.length > shown.length && <span className="font-mono text-[11px] text-muted">+{history.length - shown.length}</span>}
    </span>
  );
}

export default function TrustTable({
  label,
  rows,
  changed,
  caption,
}: {
  label: string;
  rows: TrustRow[];
  changed?: Set<string>;
  caption?: string;
}) {
  const sorted = [...rows].sort((a, b) => (b.avgUsefulness ?? -1) - (a.avgUsefulness ?? -1) || a.priceUsd - b.priceUsd);
  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <caption className="pb-2 text-left">
        <span className="text-[15px] font-medium text-ink">{label}</span>
        {caption && <span className="ml-2 text-[12px] text-muted">{caption}</span>}
      </caption>
      <thead>
        <tr className="border-y border-line text-[12px] text-muted">
          <th scope="col" className="py-2 pr-2 font-normal">Source</th>
          <th scope="col" className="hidden py-2 pr-2 text-right font-normal sm:table-cell">Price</th>
          <th scope="col" className="py-2 pr-2 font-normal">Purchases</th>
          <th scope="col" className="py-2 pr-2 text-right font-normal">Avg score</th>
          <th scope="col" className="py-2 text-right font-normal">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.source} className={`border-b border-line ${changed?.has(r.source) ? "bg-raised" : ""}`}>
            <th scope="row" className="py-2 pr-2 font-normal text-ink">
              {r.name}
              {changed?.has(r.source) && <span className="ml-2 font-mono text-[11px] text-good-ink">updated</span>}
            </th>
            <td className="hidden py-2 pr-2 text-right font-mono tabular-nums text-secondary sm:table-cell">{usd(r.priceUsd)}</td>
            <td className="py-2 pr-2">
              <History history={r.history} />
            </td>
            <td className="py-2 pr-2 text-right font-mono tabular-nums text-ink">
              {r.avgUsefulness === null ? "–" : r.avgUsefulness.toFixed(2)}
            </td>
            <td className="py-2 text-right">
              <VerdictTag verdict={r.verdict} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
