export type Topic = "network" | "wallet" | "token" | "staking";

export const TOPICS: Record<Topic, { label: string; requiredFacts: string[] }> = {
  network: {
    label: "Network health",
    requiredFacts: ["checkpoint", "checkpointAgeSec", "totalTransactions", "referenceGasPrice", "epoch"],
  },
  wallet: { label: "Wallet lookup", requiredFacts: ["balances", "objectCount", "recentTransactions"] },
  token: { label: "Token research", requiredFacts: ["symbol", "name", "decimals", "totalSupply"] },
  staking: { label: "Staking & validators", requiredFacts: ["epoch", "totalStakeSui", "activeValidators", "topValidators"] },
};

export type ParsedQuestion = { topic: Topic; address?: string; coinType?: string };

const COIN_TYPE_RE = /0x[0-9a-fA-F]{1,64}::\w+::\w+/;
const ADDRESS_RE = /0x[0-9a-fA-F]{64}\b/;

export function parseQuestion(question: string): ParsedQuestion {
  const q = question.toLowerCase();
  const coinType = question.match(COIN_TYPE_RE)?.[0];
  if (coinType || /\b(token|coin|supply|usdc|decimals)\b/.test(q)) return { topic: "token", coinType };
  const address = question.match(ADDRESS_RE)?.[0];
  if (address || /\b(wallet|address|balance|holdings)\b/.test(q)) return { topic: "wallet", address };
  if (/\b(stak\w*|validator\w*|delegat\w*|apy)\b/.test(q)) return { topic: "staking" };
  return { topic: "network" };
}

export const EXAMPLE_QUESTIONS = [
  "How healthy is the Sui network right now?",
  "Who are the biggest validators and how much SUI is staked?",
  "What is the total supply of USDC on Sui?",
  "What does wallet 0x35ccb4a6c288dfb44f3b21b5e00015a261f8687dd9cf0246837971479453aafd hold?",
];
