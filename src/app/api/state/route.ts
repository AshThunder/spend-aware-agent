import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { CATALOG } from "@/lib/catalog";
import { MEMWAL_NAMESPACE, NETWORK, USDC_COIN_TYPE, explorerAccount, explorerTx, sellerAddress } from "@/lib/config";
import { aggregate, reconstructRuns, summarize, verdictFor } from "@/lib/learning";
import { countMemories, recallEvaluations } from "@/lib/memory";
import { usdcBalance } from "@/lib/tatum";
import { TOPICS, type Topic } from "@/lib/topics";
import { agentPayments } from "@/lib/x402-client";

export const dynamic = "force-dynamic";

const CACHE_MS = 15_000;
let cached: { at: number; body: unknown } | undefined;

async function build() {
  const agent = agentPayments().address;
  const seller = sellerAddress();

  const [agentUsdc, sellerUsdc, recalled, listed] = await Promise.all([
    usdcBalance(agent, USDC_COIN_TYPE).catch(() => null),
    usdcBalance(seller, USDC_COIN_TYPE).catch(() => null),
    recallEvaluations().catch((err: Error) => err),
    countMemories().catch(() => null),
  ]);

  const evals = recalled instanceof Error ? [] : recalled;
  const runs = reconstructRuns(evals);
  const now = Date.now();
  const trust = (Object.keys(TOPICS) as Topic[]).map((topic) => {
    const stats = aggregate(evals.filter((e) => e.topic === topic));
    return {
      topic,
      label: TOPICS[topic].label,
      sources: CATALOG.filter((c) => c.topics.includes(topic)).map((c) => {
        const s = stats.get(c.id);
        return {
          source: c.id,
          name: c.name,
          priceUsd: c.priceUsd,
          tries: s?.tries ?? 0,
          avgUsefulness: s?.avgUsefulness ?? null,
          history: s?.history ?? [],
          lastAt: s?.lastAt ?? null,
          verdict: verdictFor(s, now),
        };
      }),
    };
  });

  return {
    network: NETWORK,
    agent: { address: agent, usdc: agentUsdc, url: explorerAccount(agent) },
    seller: { address: seller, usdc: sellerUsdc, url: explorerAccount(seller) },
    memory: {
      error: recalled instanceof Error ? recalled.message : undefined,
      namespace: MEMWAL_NAMESPACE,
      stored: listed,
      readable: evals.length,
      items: evals.map((e) => ({ ...e, txUrl: e.tx ? explorerTx(e.tx) : undefined })),
    },
    runs,
    summary: summarize(runs),
    trust,
    generatedAt: new Date(now).toISOString(),
  };
}

export async function GET(request: Request) {
  // Local UI work without secrets: serve a saved snapshot. Never active in production.
  const fixture = process.env.STATE_FIXTURE;
  if (fixture && process.env.NODE_ENV !== "production") {
    const body = JSON.parse(await readFile(fixture, "utf8"));
    return NextResponse.json({ ...body, fixture: true });
  }
  const fresh = new URL(request.url).searchParams.has("fresh");
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return NextResponse.json(cached.body);
  try {
    const body = await build();
    cached = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 });
  }
}
