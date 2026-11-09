import "server-only";
import { MemWal } from "@mysten-incubation/memwal";
import { MEMWAL_NAMESPACE, MEMWAL_RELAYER_URL } from "./config";
import { decodeEval, type SourceEval } from "./learning";
import type { Topic } from "./topics";

export { aggregate, decodeEval, encodeEval, type SourceEval, type SourceStats } from "./learning";

let client: MemWal | undefined;

export function memory() {
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  if (!key || !accountId) throw new Error("Walrus Memory is not configured (MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID)");
  client ??= MemWal.create({ key, accountId, serverUrl: MEMWAL_RELAYER_URL, namespace: MEMWAL_NAMESPACE });
  return client;
}

export type RecalledMemory = { text: string; blobId: string; createdAt?: string };
export type EvalMemory = SourceEval & { blobId: string; createdAt?: string };

const toRecalled = (r: { text: string; blob_id: string; created_at?: string }): RecalledMemory => ({
  text: r.text,
  blobId: r.blob_id,
  createdAt: r.created_at,
});

export async function recallTopic(topic: Topic, limit = 100): Promise<{ evals: SourceEval[]; raw: RecalledMemory[] }> {
  const res = await memory().recall({
    query: `source-eval topic=${topic} usefulness of paid data sources for ${topic} questions`,
    limit,
  });
  const raw = res.results.map(toRecalled);
  const evals = raw.map((r) => decodeEval(r.text)).filter((e): e is SourceEval => !!e && e.topic === topic);
  return { evals, raw };
}

/** Every source evaluation the agent can read back, newest first, with its Walrus blob id. */
export async function recallEvaluations(limit = 200): Promise<EvalMemory[]> {
  const res = await memory().recall({ query: "source-eval lesson paid data source usefulness", limit });
  const seen = new Set<string>();
  const out: EvalMemory[] = [];
  for (const r of res.results.map(toRecalled)) {
    const e = decodeEval(r.text);
    if (!e || seen.has(r.blobId)) continue;
    seen.add(r.blobId);
    out.push({ ...e, blobId: r.blobId, createdAt: r.createdAt });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Authoritative count of memories stored in this namespace, walked page by page from the relayer index. */
export async function countMemories(maxPages = 10): Promise<number> {
  let cursor: string | undefined;
  let total = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await memory().listMemories({ cursor, limit: 500, namespace: MEMWAL_NAMESPACE });
    total += res.memories.filter((m) => m.status !== "deleted").length;
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return total;
}
