import type { Topic } from "./topics";

export type CatalogItem = { id: string; name: string; priceUsd: number; topics: Topic[]; pitch: string };

// Prices and topics for every paid source. Pure data, safe to import from client and tests.
export const CATALOG: CatalogItem[] = [
  {
    id: "chain-pulse",
    name: "Chain Pulse",
    priceUsd: 0.002,
    topics: ["network"],
    pitch: "Latest checkpoint, throughput and gas price straight from a Sui node.",
  },
  {
    id: "chain-pulse-pro",
    name: "Chain Pulse Pro",
    priceUsd: 0.009,
    topics: ["network", "staking"],
    pitch: "Premium network intelligence with analyst commentary.",
  },
  {
    id: "staking-scope",
    name: "Staking Scope",
    priceUsd: 0.005,
    topics: ["staking", "network"],
    pitch: "Validator set, total stake and the largest staking pools.",
  },
  {
    id: "wallet-xray",
    name: "Wallet X-Ray",
    priceUsd: 0.004,
    topics: ["wallet"],
    pitch: "Balances, object count and what kinds of objects any address owns.",
  },
  {
    id: "token-intel",
    name: "Token Intel",
    priceUsd: 0.003,
    topics: ["token"],
    pitch: "On-chain metadata and circulating supply for any Sui coin type.",
  },
  {
    // Deliberately low-signal seller: claims every topic, returns no verifiable data.
    id: "alpha-wire",
    name: "Alpha Wire",
    priceUsd: 0.008,
    topics: ["network", "wallet", "token", "staking"],
    pitch: "Exclusive alpha on everything Sui. Be early.",
  },
];

export const catalogItem = (id: string) => CATALOG.find((c) => c.id === id);
export const sourceName = (id: string) => catalogItem(id)?.name ?? id;

/** What a memoryless agent pays for a topic: every source that claims it. */
export function buyEverythingUsd(topic: Topic): number {
  return round6(CATALOG.filter((c) => c.topics.includes(topic)).reduce((sum, c) => sum + c.priceUsd, 0));
}

export const round6 = (n: number) => Number(n.toFixed(6));
