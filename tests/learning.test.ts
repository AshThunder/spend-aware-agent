import { test } from "node:test";
import assert from "node:assert/strict";
import { buyEverythingUsd } from "../src/lib/catalog";
import {
  aggregate,
  decodeEval,
  encodeEval,
  evaluate,
  planPurchases,
  reconstructRuns,
  summarize,
  verdictFor,
  REEXPLORE_AFTER_MS,
  type SourceEval,
} from "../src/lib/learning";
import { parseQuestion } from "../src/lib/topics";

const ev = (source: string, usefulness: number, at: string, extra: Partial<SourceEval> = {}): SourceEval => ({
  source,
  topic: "network",
  paidUsd: { "chain-pulse": 0.002, "staking-scope": 0.005, "alpha-wire": 0.008, "chain-pulse-pro": 0.009 }[source] ?? 0.001,
  usefulness,
  newFacts: Math.round(usefulness * 5),
  requiredFacts: 5,
  at,
  ...extra,
});

// The first real mainnet run on the network topic (Nov 5), as stored in Walrus Memory.
const firstRun = [
  ev("chain-pulse", 1, "2026-11-05T14:34:47.900Z"),
  ev("staking-scope", 0, "2026-11-05T14:34:49.468Z"),
  ev("alpha-wire", 0, "2026-11-05T14:34:50.365Z"),
  ev("chain-pulse-pro", 0, "2026-11-05T14:34:51.599Z"),
];

test("memory text round-trips, with and without a run id", () => {
  const e = ev("chain-pulse", 1, "2026-11-06T11:59:49.495Z", { tx: "BYAqvnFfAQiN", redundantWith: undefined });
  assert.deepEqual(decodeEval(encodeEval(e)), { ...e, run: undefined });
  const withRun = { ...e, run: "a1b2c3d4" };
  assert.deepEqual(decodeEval(encodeEval(withRun)), withRun);
});

test("decoding a real stored memory", () => {
  const text =
    "[source-eval] source=chain-pulse topic=network paid_usd=0.002 usefulness=1.00 new_facts=5/5 redundant_with=- tx=BYAqvnFfAQiNzNacjaPFM6ErUVuy4wt8a8CcDddBTqqC at=2026-11-06T11:59:49.495Z";
  const e = decodeEval(text);
  assert.equal(e?.source, "chain-pulse");
  assert.equal(e?.usefulness, 1);
  assert.equal(e?.tx, "BYAqvnFfAQiNzNacjaPFM6ErUVuy4wt8a8CcDddBTqqC");
});

test("garbage and unknown topics are ignored", () => {
  assert.equal(decodeEval("hello"), null);
  assert.equal(decodeEval(encodeEval({ ...ev("x", 1, "2026-11-05T00:00:00Z"), topic: "weather" as never })), null);
});

test("empty memory explores every source for the topic", () => {
  const plan = planPurchases("network", new Map());
  assert.deepEqual(
    plan.ordered.map((p) => p.source.id),
    ["chain-pulse", "staking-scope", "alpha-wire", "chain-pulse-pro"],
  );
  assert.equal(plan.skipped.length, 0);
});

test("after one run, memory skips the sources that added nothing", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  const plan = planPurchases("network", aggregate(firstRun), now);
  assert.deepEqual(plan.ordered.map((p) => p.source.id), ["chain-pulse"]);
  assert.deepEqual(plan.skipped.map((s) => s.source.id).sort(), ["alpha-wire", "chain-pulse-pro", "staking-scope"]);
  const cost = plan.ordered.reduce((s, p) => s + p.source.priceUsd, 0);
  assert.equal(cost, 0.002);
  assert.equal(buyEverythingUsd("network"), 0.024);
});

test("a bad verdict expires after a week and the source is re-tested", () => {
  const stats = aggregate(firstRun);
  const later = Date.parse("2026-11-05T14:34:51.599Z") + REEXPLORE_AFTER_MS + 1;
  assert.equal(verdictFor(stats.get("alpha-wire"), later), "retest");
  const plan = planPurchases("network", stats, later);
  assert.ok(plan.ordered.some((p) => p.source.id === "alpha-wire"));
});

test("usefulness is marginal: repeated facts score zero", () => {
  const covered = new Map<string, string>();
  const facts = { checkpoint: 1, checkpointAgeSec: 1, totalTransactions: 1, referenceGasPrice: 1, epoch: 1 };
  const first = evaluate("network", facts, covered);
  assert.equal(first.usefulness, 1);
  for (const f of first.fresh) covered.set(f, "chain-pulse");
  const second = evaluate("network", { ...facts, analystNote: "bullish" }, covered);
  assert.equal(second.usefulness, 0);
  assert.equal(second.redundantWith, "chain-pulse");
  assert.equal(evaluate("network", { headline: "alpha" }, covered).usefulness, 0);
});

test("runs are rebuilt from memories and show the drop in spend", () => {
  const evals = [
    ...firstRun,
    ev("chain-pulse", 1, "2026-11-05T15:10:00.000Z"),
    ev("chain-pulse", 1, "2026-11-06T11:59:49.495Z", { run: "abc" }),
  ];
  const runs = reconstructRuns(evals);
  assert.equal(runs.length, 3);
  assert.deepEqual(runs.map((r) => r.spentUsd), [0.024, 0.002, 0.002]);
  assert.deepEqual(runs.map((r) => r.wastedUsd), [0.022, 0, 0]);
  assert.deepEqual(runs.map((r) => r.topicRun), [1, 2, 3]);
  const s = summarize(runs);
  assert.equal(s.savedUsd, 0.044);
  assert.equal(s.wastedLaterRunsUsd, 0);
});

test("questions route to the right topic", () => {
  assert.equal(parseQuestion("How healthy is the Sui network right now?").topic, "network");
  assert.equal(parseQuestion("Who are the biggest validators?").topic, "staking");
  assert.equal(parseQuestion("What is the total supply of USDC on Sui?").topic, "token");
  const w = parseQuestion(`What does wallet 0x${"a".repeat(64)} hold?`);
  assert.equal(w.topic, "wallet");
  assert.equal(w.address, `0x${"a".repeat(64)}`);
});
