import "server-only";
import { tatumSui } from "./tatum";
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

const MIST_PER_SUI = 1_000_000_000n;

async function networkFacts(): Promise<Facts> {
  const sui = tatumSui();
  const [{ response }, gas] = await Promise.all([
    sui.ledgerService.getCheckpoint({
      checkpointId: { oneofKind: undefined },
      readMask: { paths: ["sequence_number", "summary.timestamp", "summary.epoch", "summary.total_network_transactions"] },
    }),
    sui.getReferenceGasPrice(),
  ]);
  const cp = response.checkpoint!;
  const tsMs = Number(cp.summary?.timestamp?.seconds ?? 0n) * 1000;
  return {
    checkpoint: Number(cp.sequenceNumber),
    checkpointAgeSec: Math.max(0, Math.round((Date.now() - tsMs) / 1000)),
    totalTransactions: Number(cp.summary?.totalNetworkTransactions),
    referenceGasPrice: Number(gas.referenceGasPrice),
    epoch: Number(cp.summary?.epoch),
  };
}

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
      const { response } = await tatumSui().ledgerService.getEpoch({
        readMask: { paths: ["epoch", "system_state.validators.active_validators", "system_state.validators.total_stake"] },
      });
      const validators = response.epoch?.systemState?.validators;
      const active = validators?.activeValidators ?? [];
      const top = [...active]
        .sort((a, b) => Number((b.stakingPool?.suiBalance ?? 0n) - (a.stakingPool?.suiBalance ?? 0n)))
        .slice(0, 5)
        .map((v) => ({
          name: v.name ?? "unknown",
          stakeSui: Number((v.stakingPool?.suiBalance ?? 0n) / MIST_PER_SUI),
          commissionPct: Number(v.commissionRate ?? 0n) / 100,
        }));
      return {
        epoch: Number(response.epoch?.epoch),
        totalStakeSui: Number((validators?.totalStake ?? 0n) / MIST_PER_SUI),
        activeValidators: active.length,
        topValidators: top,
      };
    },
  },
  {
    id: "wallet-xray",
    name: "Wallet X-Ray",
    priceUsd: 0.004,
    topics: ["wallet"],
    pitch: "Balances, object count and what kinds of objects any address owns.",
    fetch: async ({ address }) => {
      if (!address) throw new Error("address is required");
      const sui = tatumSui();
      const [{ balances }, owned] = await Promise.all([
        sui.listBalances({ owner: address }),
        sui.listOwnedObjects({ owner: address, limit: 50 }),
      ]);
      const types = new Map<string, number>();
      for (const o of owned.objects) {
        const t = o.type.replace(/^0x0*2::/, "0x2::");
        types.set(t, (types.get(t) ?? 0) + 1);
      }
      const top = balances.slice(0, 5);
      const infos = await Promise.all(
        top.map((b) =>
          sui.stateService.getCoinInfo({ coinType: b.coinType }).then(({ response }) => response, () => null),
        ),
      );
      return {
        balances: top.map((b, i) => {
          const meta = infos[i]?.metadata;
          const decimals = meta?.decimals ?? 0;
          return {
            coinType: b.coinType,
            symbol: meta?.symbol ?? b.coinType.split("::").pop(),
            amount: Number(b.balance) / 10 ** decimals,
          };
        }),
        objectCount: owned.hasNextPage ? "50+" : owned.objects.length,
        topObjectTypes: [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type, count]) => ({ type, count })),
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
      const { response } = await tatumSui().stateService.getCoinInfo({ coinType: type });
      const decimals = response.metadata?.decimals ?? 0;
      const supply = response.treasury?.totalSupply;
      return {
        coinType: type,
        symbol: response.metadata?.symbol ?? "unknown",
        name: response.metadata?.name ?? "unknown",
        decimals,
        totalSupply: supply === undefined ? undefined : Number(supply / 10n ** BigInt(decimals)),
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
