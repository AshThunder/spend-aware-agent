import "server-only";
import { randomUUID } from "node:crypto";
import { MAX_RUN_BUDGET_USD, appUrl, explorerTx } from "./config";
import type { AgentEvent } from "./events";
import { aggregate, encodeEval, memory, recallTopic, type SourceEval } from "./memory";
import { SOURCES, type Facts, type SourceDef } from "./sources";
import { TOPICS, parseQuestion, type ParsedQuestion, type Topic } from "./topics";
import { agentPayments } from "./x402-client";

const USELESS_BELOW = 0.25;
const REEXPLORE_AFTER_MS = 7 * 24 * 3600 * 1000;

const usd = (n: number) => `$${n.toFixed(3)}`;

type Plan = { source: SourceDef; known: boolean; reason: string };

function planPurchases(topic: Topic, stats: ReturnType<typeof aggregate>) {
  const candidates = SOURCES.filter((s) => s.topics.includes(topic)).sort((a, b) => a.priceUsd - b.priceUsd);
  const proven: Plan[] = [];
  const unknown: Plan[] = [];
  const skipped: { source: SourceDef; reason: string; history: { tries: number; avgUsefulness: number } }[] = [];

  for (const source of candidates) {
    const s = stats.get(source.id);
    if (!s) {
      unknown.push({ source, known: false, reason: "No memory of this source yet. Buying once to learn what it is worth." });
      continue;
    }
    const history = { tries: s.tries, avgUsefulness: s.avgUsefulness };
    const stale = Date.now() - Date.parse(s.lastAt) > REEXPLORE_AFTER_MS;
    if (s.avgUsefulness < USELESS_BELOW && !stale) {
      skipped.push({
        source,
        history,
        reason: `Memory: ${s.tries} purchase${s.tries > 1 ? "s" : ""}, avg usefulness ${s.avgUsefulness.toFixed(2)} for ${topic} questions. Not worth ${usd(source.priceUsd)}.`,
      });
    } else if (s.avgUsefulness < USELESS_BELOW) {
      unknown.push({ source, known: false, reason: "Last checked over a week ago. Re-testing in case it improved." });
    } else {
      proven.push({
        source,
        known: true,
        reason: `Memory: avg usefulness ${s.avgUsefulness.toFixed(2)} over ${s.tries} purchase${s.tries > 1 ? "s" : ""} at ${usd(source.priceUsd)}.`,
      });
    }
  }
  return { candidates, ordered: [...proven, ...unknown], skipped };
}

function evaluate(topic: Topic, facts: Facts, covered: Map<string, string>) {
  const required = TOPICS[topic].requiredFacts;
  const provided = required.filter((f) => facts[f] !== undefined && facts[f] !== null);
  const fresh = provided.filter((f) => !covered.has(f));
  const redundantWith = provided.length > fresh.length ? covered.get(provided.find((f) => covered.has(f))!) : undefined;
  return { usefulness: fresh.length / required.length, fresh, redundantWith };
}

function sourceUrl(base: string, source: SourceDef, q: ParsedQuestion) {
  const url = new URL(`/api/sources/${source.id}`, base);
  if (q.address) url.searchParams.set("address", q.address);
  if (q.coinType) url.searchParams.set("coinType", q.coinType);
  return url;
}

function answer(topic: Topic, f: Facts, q: ParsedQuestion): string {
  const n = (v: unknown) => Number(v).toLocaleString("en-US");
  switch (topic) {
    case "network":
      if (f.checkpoint === undefined) return "I could not get reliable network data this run.";
      return `Sui is producing checkpoints normally: latest is #${n(f.checkpoint)} (${f.checkpointAgeSec}s old) in epoch ${f.epoch}. The network has processed ${n(f.totalTransactions)} transactions in total and the reference gas price is ${n(f.referenceGasPrice)} MIST.`;
    case "staking": {
      if (f.totalStakeSui === undefined) return "I could not get validator data this run.";
      const top = (f.topValidators as { name: string; stakeSui: number; commissionPct: number }[])
        .map((v) => `${v.name} (${n(v.stakeSui)} SUI, ${v.commissionPct}% commission)`)
        .join(", ");
      return `Epoch ${f.epoch}: ${n(f.totalStakeSui)} SUI is staked across ${f.activeValidators} active validators. Largest pools: ${top}.`;
    }
    case "token":
      if (f.totalSupply === undefined) return "I could not get token data this run.";
      return `${f.name} (${f.symbol}) has ${n(f.totalSupply)} tokens in circulation on Sui with ${f.decimals} decimals.`;
    case "wallet": {
      if (!q.address) return "Please include a full 0x… Sui address in the question.";
      if (f.balances === undefined) return "I could not get wallet data this run.";
      const balances = (f.balances as { coinType: string; raw: string }[])
        .map((b) => `${b.coinType.split("::").pop()}: ${b.raw}`)
        .join(", ");
      const types = ((f.topObjectTypes as { type: string; count: number }[] | undefined) ?? [])
        .map((t) => `${t.count}× ${t.type.split("::").slice(-2).join("::")}`)
        .join(", ");
      return `Wallet ${q.address.slice(0, 10)}… holds ${balances || "no coins"} (raw units) and owns ${f.objectCount} objects${types ? `, mostly ${types}` : ""}.`;
    }
  }
}

export async function* runAgent(question: string, budgetUsd: number, request: Request): AsyncGenerator<AgentEvent> {
  const runId = randomUUID().slice(0, 8);
  const budget = Math.min(Math.max(budgetUsd, 0), MAX_RUN_BUDGET_USD);
  const q = parseQuestion(question);
  const { pay, http, address } = agentPayments();
  yield { type: "start", runId, question, topic: q.topic, budgetUsd: budget, agent: address };

  let t = Date.now();
  const { evals, raw } = await recallTopic(q.topic);
  const stats = aggregate(evals);
  yield { type: "recall", memories: raw.length, evaluations: evals.length, ms: Date.now() - t };

  const { candidates, ordered, skipped } = planPurchases(q.topic, stats);
  for (const s of skipped) {
    yield {
      type: "decision",
      source: s.source.id,
      name: s.source.name,
      priceUsd: s.source.priceUsd,
      action: "skip",
      reason: s.reason,
      history: s.history,
    };
  }

  const base = appUrl(request);
  const covered = new Map<string, string>();
  const merged: Facts = {};
  const newEvals: SourceEval[] = [];
  const bought: string[] = [];
  const skippedIds = skipped.map((s) => s.source.id);
  let spent = 0;

  for (const plan of ordered) {
    const { source } = plan;
    const history = stats.get(source.id);
    const historyInfo = history ? { tries: history.tries, avgUsefulness: history.avgUsefulness } : undefined;
    const required = TOPICS[q.topic].requiredFacts;
    if (plan.known && required.every((f) => covered.has(f))) {
      skippedIds.push(source.id);
      yield {
        type: "decision", source: source.id, name: source.name, priceUsd: source.priceUsd, action: "skip",
        reason: "Everything this question needs is already covered by cheaper purchases.", history: historyInfo,
      };
      continue;
    }
    if (spent + source.priceUsd > budget + 1e-9) {
      skippedIds.push(source.id);
      yield {
        type: "decision", source: source.id, name: source.name, priceUsd: source.priceUsd, action: "skip",
        reason: `Would exceed the ${usd(budget)} budget (spent ${usd(spent)}).`, history: historyInfo,
      };
      continue;
    }
    yield {
      type: "decision", source: source.id, name: source.name, priceUsd: source.priceUsd, action: "buy",
      reason: plan.reason, history: historyInfo,
    };

    t = Date.now();
    let body: { facts?: Facts; error?: string };
    let tx: string | undefined;
    try {
      const res = await pay(sourceUrl(base, source, q), { headers: { accept: "application/json" } });
      body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      try {
        tx = http.getPaymentSettleResponse((name) => res.headers.get(name))?.transaction;
      } catch {
        tx = undefined;
      }
    } catch (err) {
      yield { type: "error", source: source.id, message: `Purchase failed, nothing was charged: ${(err as Error).message}` };
      continue;
    }
    spent += source.priceUsd;
    bought.push(source.id);
    yield { type: "paid", source: source.id, priceUsd: source.priceUsd, tx, txUrl: tx ? explorerTx(tx) : undefined, ms: Date.now() - t };

    const facts = body.facts ?? {};
    const ev = evaluate(q.topic, facts, covered);
    for (const f of ev.fresh) {
      covered.set(f, source.id);
      merged[f] = facts[f];
    }
    yield { type: "evaluated", source: source.id, usefulness: ev.usefulness, newFacts: ev.fresh, redundantWith: ev.redundantWith };
    newEvals.push({
      source: source.id,
      topic: q.topic,
      paidUsd: source.priceUsd,
      usefulness: ev.usefulness,
      newFacts: ev.fresh.length,
      requiredFacts: TOPICS[q.topic].requiredFacts.length,
      redundantWith: ev.redundantWith,
      tx,
      at: new Date().toISOString(),
    });
  }

  yield { type: "answer", text: answer(q.topic, merged, q), facts: merged };

  if (newEvals.length) {
    t = Date.now();
    try {
      const mem = memory();
      const accepted = await mem.rememberBulk(newEvals.map((e) => ({ text: encodeEval(e) })));
      const result = await mem.waitForRememberJobs(accepted.job_ids, undefined, { timeoutMs: 90_000 });
      yield {
        type: "remembered",
        count: result.succeeded,
        failed: result.failed,
        blobIds: result.results.map((r) => r.blob_id).filter(Boolean),
        ms: Date.now() - t,
      };
    } catch (err) {
      yield { type: "error", message: `Saving to Walrus Memory failed: ${(err as Error).message}` };
    }
  }

  const naive = candidates.reduce((sum, s) => sum + s.priceUsd, 0);
  yield { type: "done", spentUsd: Number(spent.toFixed(6)), naiveUsd: Number(naive.toFixed(6)), bought, skipped: skippedIds };
}
