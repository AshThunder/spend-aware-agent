// The learning loop, kept pure (no network, no secrets) so it can be unit tested and reused by the UI.
import { CATALOG, buyEverythingUsd, round6, type CatalogItem } from "./catalog";
import { TOPICS, type Topic } from "./topics";

/** A source whose average usefulness is below this is skipped. */
export const USELESS_BELOW = 0.25;
/** Bad verdicts expire after a week, so a source that improved gets another chance. */
export const REEXPLORE_AFTER_MS = 7 * 24 * 3600 * 1000;
/** Purchases on the same topic closer than this belong to the same run (memories written before run ids existed). */
export const RUN_GAP_MS = 120_000;

export type Facts = Record<string, unknown>;

export type SourceEval = {
  source: string;
  topic: Topic;
  paidUsd: number;
  usefulness: number;
  newFacts: number;
  requiredFacts: number;
  redundantWith?: string;
  tx?: string;
  at: string;
  run?: string;
};

export function encodeEval(e: SourceEval): string {
  return [
    "[source-eval]",
    `source=${e.source}`,
    `topic=${e.topic}`,
    `paid_usd=${e.paidUsd}`,
    `usefulness=${e.usefulness.toFixed(2)}`,
    `new_facts=${e.newFacts}/${e.requiredFacts}`,
    `redundant_with=${e.redundantWith ?? "-"}`,
    `tx=${e.tx ?? "-"}`,
    `at=${e.at}`,
    ...(e.run ? [`run=${e.run}`] : []),
  ].join(" ");
}

const EVAL_RE =
  /\[source-eval\] source=(\S+) topic=(\S+) paid_usd=(\S+) usefulness=(\S+) new_facts=(\d+)\/(\d+) redundant_with=(\S+) tx=(\S+) at=(\S+)(?: run=(\S+))?/;

export function decodeEval(text: string): SourceEval | null {
  const m = text.match(EVAL_RE);
  if (!m || !(m[2] in TOPICS)) return null;
  const paidUsd = Number(m[3]);
  const usefulness = Number(m[4]);
  if (!Number.isFinite(paidUsd) || !Number.isFinite(usefulness) || Number.isNaN(Date.parse(m[9]))) return null;
  return {
    source: m[1],
    topic: m[2] as Topic,
    paidUsd,
    usefulness,
    newFacts: Number(m[5]),
    requiredFacts: Number(m[6]),
    redundantWith: m[7] === "-" ? undefined : m[7],
    tx: m[8] === "-" ? undefined : m[8],
    at: m[9],
    run: m[10],
  };
}

export type SourceStats = {
  source: string;
  tries: number;
  avgUsefulness: number;
  avgPaid: number;
  lastAt: string;
  history: number[];
};

/** Average usefulness per source, oldest purchase first in `history`. */
export function aggregate(evals: SourceEval[]): Map<string, SourceStats> {
  const out = new Map<string, SourceStats>();
  for (const e of [...evals].sort((a, b) => a.at.localeCompare(b.at))) {
    const s = out.get(e.source) ?? { source: e.source, tries: 0, avgUsefulness: 0, avgPaid: 0, lastAt: e.at, history: [] };
    s.avgUsefulness = (s.avgUsefulness * s.tries + e.usefulness) / (s.tries + 1);
    s.avgPaid = (s.avgPaid * s.tries + e.paidUsd) / (s.tries + 1);
    s.tries += 1;
    s.history.push(e.usefulness);
    if (e.at > s.lastAt) s.lastAt = e.at;
    out.set(e.source, s);
  }
  return out;
}

export type Verdict = "keep" | "skip" | "retest" | "untested";

export function verdictFor(stats: SourceStats | undefined, now = Date.now()): Verdict {
  if (!stats) return "untested";
  if (stats.avgUsefulness >= USELESS_BELOW) return "keep";
  return now - Date.parse(stats.lastAt) > REEXPLORE_AFTER_MS ? "retest" : "skip";
}

const usd = (n: number) => `$${n.toFixed(3)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export type PlanStep = { source: CatalogItem; known: boolean; reason: string };
export type PlanSkip = { source: CatalogItem; reason: string; history: { tries: number; avgUsefulness: number } };

/** Decide what to buy: proven sources first, unknown ones once to learn them, known-bad ones skipped. */
export function planPurchases(topic: Topic, stats: Map<string, SourceStats>, now = Date.now(), catalog = CATALOG) {
  const candidates = catalog.filter((s) => s.topics.includes(topic)).sort((a, b) => a.priceUsd - b.priceUsd);
  const proven: PlanStep[] = [];
  const unknown: PlanStep[] = [];
  const skipped: PlanSkip[] = [];

  for (const source of candidates) {
    const s = stats.get(source.id);
    const verdict = verdictFor(s, now);
    if (verdict === "untested" || !s) {
      unknown.push({ source, known: false, reason: "No memory of this source yet. Buying once to learn what it is worth." });
    } else if (verdict === "skip") {
      skipped.push({
        source,
        history: { tries: s.tries, avgUsefulness: s.avgUsefulness },
        reason: `Memory: ${plural(s.tries, "purchase")}, avg usefulness ${s.avgUsefulness.toFixed(2)} for ${topic} questions. Not worth ${usd(source.priceUsd)}.`,
      });
    } else if (verdict === "retest") {
      unknown.push({ source, known: false, reason: "Last verdict is over a week old. Re-testing in case it improved." });
    } else {
      proven.push({
        source,
        known: true,
        reason: `Memory: avg usefulness ${s.avgUsefulness.toFixed(2)} over ${plural(s.tries, "purchase")} at ${usd(source.priceUsd)}.`,
      });
    }
  }
  return { candidates, ordered: [...proven, ...unknown], skipped };
}

/** Marginal usefulness: share of the topic's required facts this purchase added that cheaper purchases had not. */
export function evaluate(topic: Topic, facts: Facts, covered: Map<string, string>) {
  const required = TOPICS[topic].requiredFacts;
  const provided = required.filter((f) => facts[f] !== undefined && facts[f] !== null);
  const fresh = provided.filter((f) => !covered.has(f));
  const overlap = provided.find((f) => covered.has(f));
  return { usefulness: fresh.length / required.length, fresh, redundantWith: overlap ? covered.get(overlap) : undefined };
}

export type RunSummary = {
  id: string;
  topic: Topic;
  at: string;
  /** 1 for the first run on this topic, 2 for the second, and so on. */
  topicRun: number;
  bought: { source: string; paidUsd: number; usefulness: number; tx?: string }[];
  spentUsd: number;
  wastedUsd: number;
  buyEverythingUsd: number;
};

/** Rebuild paid runs from memories. Uses the run id when present, otherwise groups purchases seconds apart. */
export function reconstructRuns(evals: SourceEval[]): RunSummary[] {
  type Open = RunSummary & { key?: string; lastMs: number };
  const sorted = [...evals].sort((a, b) => a.at.localeCompare(b.at));
  const runs: Open[] = [];
  const open = new Map<Topic, Open>();
  for (const e of sorted) {
    const ms = Date.parse(e.at);
    let run = open.get(e.topic);
    const sameRun =
      !!run &&
      (e.run ? run.key === e.run : run.key === undefined && ms - run.lastMs <= RUN_GAP_MS) &&
      !run.bought.some((b) => b.source === e.source);
    if (!run || !sameRun) {
      run = {
        id: e.run ?? `${e.topic}-${e.at}`,
        key: e.run,
        topic: e.topic,
        at: e.at,
        topicRun: runs.filter((r) => r.topic === e.topic).length + 1,
        bought: [],
        spentUsd: 0,
        wastedUsd: 0,
        buyEverythingUsd: buyEverythingUsd(e.topic),
        lastMs: ms,
      };
      runs.push(run);
      open.set(e.topic, run);
    }
    run.bought.push({ source: e.source, paidUsd: e.paidUsd, usefulness: e.usefulness, tx: e.tx });
    run.spentUsd = round6(run.spentUsd + e.paidUsd);
    if (e.usefulness === 0) run.wastedUsd = round6(run.wastedUsd + e.paidUsd);
    run.lastMs = ms;
  }
  return runs.map((r) => {
    const out: RunSummary & { key?: string; lastMs?: number } = { ...r };
    delete out.key;
    delete out.lastMs;
    return out;
  });
}

export function summarize(runs: RunSummary[]) {
  const first = runs.filter((r) => r.topicRun === 1);
  const later = runs.filter((r) => r.topicRun > 1);
  const avg = (rs: RunSummary[]) => (rs.length ? round6(rs.reduce((s, r) => s + r.spentUsd, 0) / rs.length) : null);
  const spent = round6(runs.reduce((s, r) => s + r.spentUsd, 0));
  const everything = round6(runs.reduce((s, r) => s + r.buyEverythingUsd, 0));
  return {
    runs: runs.length,
    spentUsd: spent,
    buyEverythingUsd: everything,
    savedUsd: round6(everything - spent),
    wastedFirstRunsUsd: round6(first.reduce((s, r) => s + r.wastedUsd, 0)),
    wastedLaterRunsUsd: round6(later.reduce((s, r) => s + r.wastedUsd, 0)),
    avgFirstRunUsd: avg(first),
    avgLaterRunUsd: avg(later),
  };
}
