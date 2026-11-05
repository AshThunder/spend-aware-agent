import "server-only";
import { suiRpc } from "./tatum";
import { USDC_COIN_TYPE } from "./config";
import type { Topic } from "./topics";

export type SourceParams = { address?: string; coinType?: string };
export type Facts = Record<string, unknown>;

export type SourceDef = {
  id: string;
  name: string;
  priceUsd: number;
  topics: Topic[];
  pitch: string;
  fetch: (p: SourceParams) => Promise<Facts>;
};

type Checkpoint = { sequenceNumber: string; epoch: string; timestampMs: string; networkTotalTransactions: string };

async function networkFacts(): Promise<Facts> {
  const seq = await suiRpc<string>("sui_getLatestCheckpointSequenceNumber");
  const [cp, gas] = await Promise.all([
    suiRpc<Checkpoint>("sui_getCheckpoint", [seq]),
    suiRpc<string>("suix_getReferenceGasPrice"),
  ]);
  return {
    checkpoint: Number(cp.sequenceNumber),
    checkpointAgeSec: Math.max(0, Math.round((Date.now() - Number(cp.timestampMs)) / 1000)),
    totalTransactions: Number(cp.networkTotalTransactions),
    referenceGasPrice: Number(gas),
    epoch: Number(cp.epoch),
  };
}

type SystemState = {
  epoch: string;
  totalStake: string;
  activeValidators: { name: string; suiAddress: string; stakingPoolSuiBalance: string; commissionRate: string }[];
};

export const SOURCES: SourceDef[] = [
  {
    id: "chain-pulse",
    name: "Chain Pulse",
    priceUsd: 0.002,
    topics: ["network"],
    pitch: "Latest checkpoint, throughput and gas price straight from a Sui node.",
    fetch: networkFacts,
  },
  {
    id: "chain-pulse-pro",
    name: "Chain Pulse Pro",
    priceUsd: 0.009,
    topics: ["network", "staking"],
    pitch: "Premium network intelligence with analyst commentary.",
    fetch: async () => ({
      ...(await networkFacts()),
      analystNote: "Network conditions remain constructive. Builders should keep building.",
    }),
  },
  {
    id: "staking-scope",
    name: "Staking Scope",
    priceUsd: 0.005,
    topics: ["staking", "network"],
    pitch: "Validator set, total stake and the largest staking pools.",
    fetch: async () => {
      const s = await suiRpc<SystemState>("suix_getLatestSuiSystemState");
      const top = [...s.activeValidators]
        .sort((a, b) => Number(BigInt(b.stakingPoolSuiBalance) - BigInt(a.stakingPoolSuiBalance)))
        .slice(0, 5)
        .map((v) => ({
          name: v.name,
          stakeSui: Math.round(Number(BigInt(v.stakingPoolSuiBalance) / 1_000_000_000n)),
          commissionPct: Number(v.commissionRate) / 100,
        }));
      return {
        epoch: Number(s.epoch),
        totalStakeSui: Math.round(Number(BigInt(s.totalStake) / 1_000_000_000n)),
        activeValidators: s.activeValidators.length,
        topValidators: top,
      };
    },
  },
  {
    id: "wallet-xray",
    name: "Wallet X-Ray",
    priceUsd: 0.004,
    topics: ["wallet"],
    pitch: "Balances, object count and the latest transactions for any address.",
    fetch: async ({ address }) => {
      if (!address) throw new Error("address is required");
      const [balances, objects, txs] = await Promise.all([
        suiRpc<{ coinType: string; totalBalance: string }[]>("suix_getAllBalances", [address]),
        suiRpc<{ data: unknown[]; hasNextPage: boolean }>("suix_getOwnedObjects", [address, null, null, 50]),
        suiRpc<{ data: { digest: string; timestampMs?: string }[] }>("suix_queryTransactionBlocks", [
          { filter: { FromAddress: address }, options: {} },
          null,
          5,
          true,
        ]),
      ]);
      return {
        balances: balances.map((b) => ({ coinType: b.coinType, raw: b.totalBalance })),
        objectCount: objects.hasNextPage ? "50+" : objects.data.length,
        recentTransactions: txs.data.map((t) => t.digest),
      };
    },
  },
  {
    id: "token-intel",
    name: "Token Intel",
    priceUsd: 0.003,
    topics: ["token"],
    pitch: "On-chain metadata and circulating supply for any Sui coin type.",
    fetch: async ({ coinType }) => {
      const type = coinType || USDC_COIN_TYPE;
      const [meta, supply] = await Promise.all([
        suiRpc<{ name: string; symbol: string; decimals: number } | null>("suix_getCoinMetadata", [type]),
        suiRpc<{ value: string }>("suix_getTotalSupply", [type]),
      ]);
      const decimals = meta?.decimals ?? 0;
      return {
        coinType: type,
        symbol: meta?.symbol ?? "unknown",
        name: meta?.name ?? "unknown",
        decimals,
        totalSupply: Number(BigInt(supply.value) / 10n ** BigInt(decimals)),
      };
    },
  },
  {
    // Deliberately low-signal seller: claims every topic, returns no verifiable data.
    id: "alpha-wire",
    name: "Alpha Wire",
    priceUsd: 0.008,
    topics: ["network", "wallet", "token", "staking"],
    pitch: "Exclusive alpha on everything Sui. Be early.",
    fetch: async () => ({
      headline: "Smart money is watching Sui closely",
      sentiment: "very bullish",
      tip: "Stay tuned for the next big move.",
    }),
  },
];

export function getSource(id: string) {
  return SOURCES.find((s) => s.id === id);
}
