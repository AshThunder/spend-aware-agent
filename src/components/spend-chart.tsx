import type { RunSummary } from "@/lib/learning";
import { TOPIC_SHORT, usd, when } from "@/lib/view";
import type { Topic } from "@/lib/topics";

const ORDER: Topic[] = ["network", "staking", "token", "wallet"];

/** Spend per paid run, grouped by topic. Useful spend in green, spend on sources that added nothing in red. */
export default function SpendChart({ runs, highlight }: { runs: RunSummary[]; highlight?: string }) {
  const groups = ORDER.map((topic) => ({ topic, runs: runs.filter((r) => r.topic === topic) })).filter((g) => g.runs.length);
  if (!groups.length) {
    return <p className="py-12 text-center text-sm text-secondary">No paid runs in memory yet. The first run explores every source.</p>;
  }
  const peak = Math.max(...runs.map((r) => Math.max(r.spentUsd, r.buyEverythingUsd)));
  const step = peak > 0.04 ? 0.02 : peak > 0.02 ? 0.01 : 0.005;
  const max = Math.max(step * 2, Math.ceil(peak / step) * step);
  const H = 220;
  const TOP = 12;
  const BAR = 14;
  const GAP = 6;
  const GROUP_GAP = 28;
  const LEFT = 44;
  const y = (v: number) => TOP + H - (v / max) * H;
  const { placed, width } = layout(groups, { BAR, GAP, GROUP_GAP, start: LEFT + 12 });
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => Number((i * step).toFixed(3)));

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${TOP + H + 40}`}
        className="block h-auto w-full"
        role="img"
        aria-labelledby="spend-chart-title spend-chart-desc"
      >
        <title id="spend-chart-title">Spend per paid run, grouped by topic</title>
        <desc id="spend-chart-desc">
          {placed
            .map((g) => `${TOPIC_SHORT[g.topic]}: ${g.runs.map((r) => usd(r.spentUsd)).join(", ")}`)
            .join(". ")}
        </desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={width} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
            <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" className="fill-muted font-mono text-[10px]">
              {usd(t)}
            </text>
          </g>
        ))}
        {placed.map((g) => (
          <g key={g.topic}>
            <line
              x1={g.start - 4}
              x2={g.end + 4}
              y1={y(g.runs[0].buyEverythingUsd)}
              y2={y(g.runs[0].buyEverythingUsd)}
              className="stroke-ink"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {g.bars.map(({ r, x: bx }) => {
              const useful = r.spentUsd - r.wastedUsd;
              const active = highlight === r.id;
              return (
                <g key={r.id}>
                  <title>{`${TOPIC_SHORT[r.topic]} run ${r.topicRun}, ${when(r.at)}: spent ${usd(r.spentUsd)}, ${usd(r.wastedUsd)} on sources that added nothing`}</title>
                  <rect x={bx} y={y(useful)} width={BAR} height={Math.max(0, TOP + H - y(useful))} className="fill-good" />
                  {r.wastedUsd > 0 && (
                    <rect x={bx} y={y(r.spentUsd)} width={BAR} height={y(useful) - y(r.spentUsd)} className="fill-bad" />
                  )}
                  {active && <rect x={bx - 3} y={y(r.spentUsd) - 6} width={BAR + 6} height={3} className="fill-ink" />}
                </g>
              );
            })}
            <text x={g.start} y={TOP + H + 18} className="fill-secondary text-[11px]">
              {TOPIC_SHORT[g.topic]}
            </text>
            <text x={g.start} y={TOP + H + 32} className="fill-muted font-mono text-[10px]">
              {g.runs.length} run{g.runs.length === 1 ? "" : "s"}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px] leading-4 text-secondary">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 bg-good" aria-hidden /> Spend that added new facts
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 bg-bad" aria-hidden /> Spend on sources that added nothing
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 border-t border-dashed border-ink" aria-hidden /> Price of buying every source
        </span>
      </figcaption>
    </figure>
  );
}

function layout(
  groups: { topic: Topic; runs: RunSummary[] }[],
  o: { BAR: number; GAP: number; GROUP_GAP: number; start: number },
) {
  let x = o.start;
  const placed = groups.map((g) => {
    const start = x;
    const bars = g.runs.map((r) => {
      const bx = x;
      x += o.BAR + o.GAP;
      return { r, x: bx };
    });
    const end = Math.max(x - o.GAP, start + 64);
    x = end + o.GROUP_GAP;
    return { ...g, start, end, bars };
  });
  return { placed, width: x };
}
