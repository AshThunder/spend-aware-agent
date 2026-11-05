import "server-only";
import { MemWal } from "@mysten-incubation/memwal";
import { MEMWAL_NAMESPACE, MEMWAL_RELAYER_URL } from "./config";
import type { Topic } from "./topics";

let client: MemWal | undefined;

export function memory() {
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  if (!key || !accountId) throw new Error("Missing MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID");
  client ??= MemWal.create({ key, accountId, serverUrl: MEMWAL_RELAYER_URL, namespace: MEMWAL_NAMESPACE });
  return client;
}

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
  ].join(" ");
}

const EVAL_RE =
  /\[source-eval\] source=(\S+) topic=(\S+) paid_usd=(\S+) usefulness=(\S+) new_facts=(\d+)\/(\d+) redundant_with=(\S+) tx=(\S+) at=(\S+)/;

export function decodeEval(text: string): SourceEval | null {
  const m = text.match(EVAL_RE);
  if (!m) return null;
  return {
    source: m[1],
    topic: m[2] as Topic,
    paidUsd: Number(m[3]),
    usefulness: Number(m[4]),
    newFacts: Number(m[5]),
    requiredFacts: Number(m[6]),
    redundantWith: m[7] === "-" ? undefined : m[7],
    tx: m[8] === "-" ? undefined : m[8],
    at: m[9],
  };
}

export type RecalledMemory = { text: string; blobId: string; createdAt?: string };

export async function recallTopic(topic: Topic, limit = 100): Promise<{ evals: SourceEval[]; raw: RecalledMemory[] }> {
  const res = await memory().recall({
    query: `source-eval topic=${topic} usefulness of paid data sources for ${topic} questions`,
    limit,
  });
  const raw = res.results.map((r) => ({ text: r.text, blobId: r.blob_id, createdAt: r.created_at }));
  const evals = raw
    .map((r) => decodeEval(r.text))
    .filter((e): e is SourceEval => !!e && e.topic === topic);
  return { evals, raw };
}

export async function recallRecent(limit = 30): Promise<RecalledMemory[]> {
  const res = await memory().recall({ query: "source-eval lesson paid data source", limit: 100 });
  return res.results
    .map((r) => ({ text: r.text, blobId: r.blob_id, createdAt: r.created_at }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, limit);
}

export type SourceStats = { source: string; tries: number; avgUsefulness: number; avgPaid: number; lastAt: string };

export function aggregate(evals: SourceEval[]): Map<string, SourceStats> {
  const out = new Map<string, SourceStats>();
  for (const e of evals) {
    const s = out.get(e.source) ?? { source: e.source, tries: 0, avgUsefulness: 0, avgPaid: 0, lastAt: e.at };
    s.avgUsefulness = (s.avgUsefulness * s.tries + e.usefulness) / (s.tries + 1);
    s.avgPaid = (s.avgPaid * s.tries + e.paidUsd) / (s.tries + 1);
    s.tries += 1;
    if (e.at > s.lastAt) s.lastAt = e.at;
    out.set(e.source, s);
  }
  return out;
}
