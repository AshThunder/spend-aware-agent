import { NextResponse } from "next/server";
import { NETWORK, USDC_COIN_TYPE, explorerAccount, sellerAddress } from "@/lib/config";
import { aggregate, decodeEval, recallRecent, type SourceEval } from "@/lib/memory";
import { usdcBalance } from "@/lib/tatum";
import { agentPayments } from "@/lib/x402-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const agent = agentPayments().address;
  const seller = sellerAddress();

  const [agentUsdc, sellerUsdc, recent] = await Promise.all([
    usdcBalance(agent, USDC_COIN_TYPE).catch(() => null),
    usdcBalance(seller, USDC_COIN_TYPE).catch(() => null),
    recallRecent(100).catch((err: Error) => err),
  ]);

  const memories = recent instanceof Error ? [] : recent;
  const evals = memories.map((m) => decodeEval(m.text)).filter((e): e is SourceEval => !!e);
  const byTopic: Record<string, ReturnType<typeof aggregate> extends Map<string, infer V> ? V[] : never> = {};
  for (const topic of new Set(evals.map((e) => e.topic))) {
    byTopic[topic] = [...aggregate(evals.filter((e) => e.topic === topic)).values()];
  }

  return NextResponse.json({
    network: NETWORK,
    agent: { address: agent, usdc: agentUsdc, url: explorerAccount(agent) },
    seller: { address: seller, usdc: sellerUsdc, url: explorerAccount(seller) },
    memory: {
      error: recent instanceof Error ? recent.message : undefined,
      total: memories.length,
      recent: memories.slice(0, 12),
      ledger: byTopic,
    },
  });
}
